/**
 * @huggingface/transformers TextGenerationPipeline clears tokenizer_encode_kwargs after
 * apply_chat_template(..., tokenize:false), so truncation/max_length never reach tokenizer().
 * Chat prompts then grow to tokenizer model_max_length (~131k) → ORT SafeInt overflow.
 * Restore encode kwargs for the tokenizer() step (upstream bug workaround).
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- mirrors upstream pipeline _call */
const isChat = (x: unknown): boolean =>
	Array.isArray(x) && x.every((m) => m && typeof m === 'object' && 'role' in m && 'content' in m);

const wrapOnnxTextGenerationPipelineCall = (pipeline: any) => {
	pipeline._call = async function (this: any, texts: any, generate_kwargs: Record<string, any> = {}) {
		let isBatched = false;
		let isChatInput = false;

		let add_special_tokens =
			generate_kwargs.add_special_tokens ??
			(this.tokenizer.add_bos_token || this.tokenizer.add_eos_token) ??
			false;

		let tokenizer_kwargs = generate_kwargs.tokenizer_encode_kwargs;

		let inputs: string[];
		if (typeof texts === 'string') {
			texts = [texts];
			inputs = texts;
		} else if (Array.isArray(texts) && texts.every((x: unknown) => typeof x === 'string')) {
			isBatched = true;
			inputs = texts;
		} else {
			if (isChat(texts)) {
				texts = [texts];
			} else if (Array.isArray(texts) && texts.every(isChat)) {
				isBatched = true;
			} else {
				throw new Error(
					'Input must be a string, an array of strings, a Chat, or an array of Chats'
				);
			}
			isChatInput = true;

			inputs = texts.map((x: unknown) =>
				this.tokenizer.apply_chat_template(x, {
					tokenize: false,
					add_generation_prompt: true,
					...tokenizer_kwargs,
				})
			);
			add_special_tokens = false;
			tokenizer_kwargs = generate_kwargs.tokenizer_encode_kwargs;
		}

		const return_full_text = isChatInput ? false : (generate_kwargs.return_full_text ?? true);

		this.tokenizer.padding_side = 'left';
		const text_inputs = this.tokenizer(inputs, {
			add_special_tokens,
			padding: true,
			truncation: true,
			...tokenizer_kwargs,
		});

		const { tokenizer_encode_kwargs: _omit, ...genRest } = generate_kwargs;
		void _omit;

		const outputTokenIds = await this.model.generate({
			...text_inputs,
			...genRest,
		});

		const decoded = this.tokenizer.batch_decode(outputTokenIds, {
			skip_special_tokens: true,
		});

		let promptLengths: number[] | undefined;
		if (!return_full_text && text_inputs.input_ids.dims.at(-1) > 0) {
			promptLengths = this.tokenizer
				.batch_decode(text_inputs.input_ids, {
					skip_special_tokens: true,
				})
				.map((x: string) => x.length);
		}

		const toReturn: unknown[][] = Array.from({ length: texts.length }, () => []);
		for (let i = 0; i < decoded.length; ++i) {
			const textIndex = Math.floor((i / outputTokenIds.dims[0]) * texts.length);

			if (promptLengths) {
				decoded[i] = decoded[i].slice(promptLengths[textIndex]);
			}
			toReturn[textIndex].push({
				generated_text: isChatInput
					? [...texts[textIndex], { role: 'assistant', content: decoded[i] }]
					: decoded[i],
			});
		}
		return !isBatched && toReturn.length === 1 ? toReturn[0] : toReturn;
	};
};

export default wrapOnnxTextGenerationPipelineCall;
