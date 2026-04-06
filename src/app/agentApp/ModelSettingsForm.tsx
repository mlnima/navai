import { useEffect, useState } from 'react';
import loadOnnxPipeline, {
	isOnnxPipelineCached,
} from '../../agent/loadOnnxPipeline';
import parseHfRepoId from '../../agent/parseHfRepoId';
import buildGgufConfigForCacheInfo from '../buildGgufConfigForCacheInfo';
import buildHfGgufDownloadUrl from '../buildHfGgufDownloadUrl';
import clearGgufDownloadCacheAndRuntime from '../clearGgufDownloadCacheAndRuntime';
import getGgufStorageInfo from '../getGgufStorageInfo';
import downloadGgufFromUrl from '../model/downloadGgufFromUrl';
import normalizeGgufHfFilePathInput from '../normalizeGgufHfFilePathInput';
import type { ModelConfig } from '../types/ModelConfig';
import validateFullHfGgufFileUrl from '../validateFullHfGgufFileUrl';
import getDefaultWebGpuContextWindowTokens from '../getDefaultWebGpuContextWindowTokens';
import {
	getWebGpuContextWindowMax,
	snapWebGpuContextWindowTokens,
	WEBGPU_CONTEXT_WINDOW_MIN_TOKENS,
	WEBGPU_CONTEXT_WINDOW_SNAP_STEP,
} from '../webGpuContextWindowPolicy';

type ModelFormTab = 'api' | 'webgpu';

type Props = {
	isDark: boolean;
	showModelForm: boolean;
	editingModelId: string | null;
	modelFormTab: ModelFormTab;
	setModelFormTab: (t: ModelFormTab) => void;
	modelFormName: string;
	setModelFormName: (v: string) => void;
	modelFormBaseUrl: string;
	setModelFormBaseUrl: (v: string) => void;
	modelFormApiKey: string;
	setModelFormApiKey: (v: string) => void;
	modelFormModelName: string;
	setModelFormModelName: (v: string) => void;
	modelFormSupportsVision: boolean;
	setModelFormSupportsVision: (v: boolean) => void;
	modelFormUseManual: boolean;
	setModelFormUseManual: (v: boolean) => void;
	modelFormAvailableModels: string[];
	fetchModelsForForm: () => void;
	modelFormWebGpuBackend: 'onnx' | 'gguf';
	setModelFormWebGpuBackend: (v: 'onnx' | 'gguf') => void;
	modelFormOnnxModelType: 'text-generation' | 'image-text-to-text';
	setModelFormOnnxModelType: (v: 'text-generation' | 'image-text-to-text') => void;
	modelFormWebGpuSource: 'hf' | 'upload' | 'url';
	setModelFormWebGpuSource: (v: 'hf' | 'upload' | 'url') => void;
	modelFormWebGpuHfOnnx: string;
	setModelFormWebGpuHfOnnx: (v: string) => void;
	modelFormWebGpuHfGgufRepo: string;
	setModelFormWebGpuHfGgufRepo: (v: string) => void;
	modelFormWebGpuHfGgufFile: string;
	setModelFormWebGpuHfGgufFile: (v: string) => void;
	modelFormWebGpuGgufUrl: string;
	setModelFormWebGpuGgufUrl: (v: string) => void;
	modelFormGgufConfigError: string;
	setModelFormGgufConfigError: (v: string) => void;
	modelFormWebGpuUpload: File | null;
	setModelFormWebGpuUpload: (f: File | null) => void;
	modelFormWebGpuContextWindowTokens: number;
	setModelFormWebGpuContextWindowTokens: (n: number) => void;
	webGpuSaving: boolean;
	saveModelConfig: () => void | Promise<void>;
	clearModelForm: () => void;
	inputClass: string;
	labelClass: string;
	subtleClass: string;
	secondaryButtonClass: string;
	modelConfigs: ModelConfig[];
};

const ModelSettingsForm = ({
	isDark,
	showModelForm,
	editingModelId,
	modelFormTab,
	setModelFormTab,
	modelFormName,
	setModelFormName,
	modelFormBaseUrl,
	setModelFormBaseUrl,
	modelFormApiKey,
	setModelFormApiKey,
	modelFormModelName,
	setModelFormModelName,
	modelFormSupportsVision,
	setModelFormSupportsVision,
	modelFormUseManual,
	setModelFormUseManual,
	modelFormAvailableModels,
	fetchModelsForForm,
	modelFormWebGpuBackend,
	setModelFormWebGpuBackend,
	modelFormOnnxModelType,
	setModelFormOnnxModelType,
	modelFormWebGpuSource,
	setModelFormWebGpuSource,
	modelFormWebGpuHfOnnx,
	setModelFormWebGpuHfOnnx,
	modelFormWebGpuHfGgufRepo,
	setModelFormWebGpuHfGgufRepo,
	modelFormWebGpuHfGgufFile,
	setModelFormWebGpuHfGgufFile,
	modelFormWebGpuGgufUrl,
	setModelFormWebGpuGgufUrl,
	modelFormGgufConfigError,
	setModelFormGgufConfigError,
	modelFormWebGpuUpload,
	setModelFormWebGpuUpload,
	modelFormWebGpuContextWindowTokens,
	setModelFormWebGpuContextWindowTokens,
	webGpuSaving,
	saveModelConfig,
	clearModelForm,
	inputClass,
	labelClass,
	subtleClass,
	secondaryButtonClass,
	modelConfigs,
}: Props) => {
	const [ggufDlNote, setGgufDlNote] = useState('');
	const [ggufDlBusy, setGgufDlBusy] = useState(false);
	const [ggufDlProgress, setGgufDlProgress] = useState<{
		loaded: number;
		total: number | null;
	} | null>(null);
	const [ggufStorageLoading, setGgufStorageLoading] = useState(false);
	const [ggufStorageInfo, setGgufStorageInfo] = useState<Awaited<
		ReturnType<typeof getGgufStorageInfo>
	> | null>(null);
	const [ggufClearBusy, setGgufClearBusy] = useState(false);
	const [onnxDlBusy, setOnnxDlBusy] = useState(false);
	const [onnxDlNote, setOnnxDlNote] = useState('');
	const [onnxDlProgress, setOnnxDlProgress] = useState<{
		loaded: number;
		total: number;
		progress: number;
	} | null>(null);

	const fmtBytes = (n: number) =>
		n < 1024
			? `${n} B`
			: n < 1024 * 1024
				? `${(n / 1024).toFixed(1)} KB`
				: `${(n / (1024 * 1024)).toFixed(1)} MB`;

	useEffect(() => {
		let cancelled = false;
		const run = async () => {
			if (!showModelForm) {
				setGgufStorageInfo(null);
				return;
			}
			if (modelFormTab !== 'webgpu' || modelFormWebGpuBackend !== 'gguf') {
				setGgufStorageInfo(null);
				return;
			}
			const cfg = buildGgufConfigForCacheInfo({
				backend: modelFormWebGpuBackend,
				source: modelFormWebGpuSource,
				modelFormWebGpuHfGgufRepo,
				modelFormWebGpuHfGgufFile,
				modelFormWebGpuGgufUrl,
				modelFormWebGpuUpload,
				editingModelId,
				modelConfigs,
			});
			if (!cfg) {
				setGgufStorageInfo(null);
				return;
			}
			setGgufStorageLoading(true);
			try {
				const info = await getGgufStorageInfo(cfg);
				if (!cancelled) setGgufStorageInfo(info);
			} catch {
				if (!cancelled) setGgufStorageInfo(null);
			} finally {
				if (!cancelled) setGgufStorageLoading(false);
			}
		};
		void run();
		return () => {
			cancelled = true;
		};
	}, [
		showModelForm,
		modelFormTab,
		modelFormWebGpuBackend,
		modelFormWebGpuSource,
		modelFormWebGpuHfGgufRepo,
		modelFormWebGpuHfGgufFile,
		modelFormWebGpuGgufUrl,
		modelFormWebGpuUpload,
		editingModelId,
		modelConfigs,
	]);

	const onClearGgufCache = async () => {
		const cfg = buildGgufConfigForCacheInfo({
			backend: modelFormWebGpuBackend,
			source: modelFormWebGpuSource,
			modelFormWebGpuHfGgufRepo,
			modelFormWebGpuHfGgufFile,
			modelFormWebGpuGgufUrl,
			modelFormWebGpuUpload,
			editingModelId,
			modelConfigs,
		});
		if (!cfg) return;
		setGgufClearBusy(true);
		setGgufDlNote('');
		try {
			await clearGgufDownloadCacheAndRuntime(cfg);
			const next = await getGgufStorageInfo(cfg);
			setGgufStorageInfo(next);
			setGgufDlNote(
				cfg.source.type === 'huggingface'
					? 'Runtime unloaded and browser download cache cleared (model stays in list).'
					: 'Runtime unloaded. Uploaded .gguf stays in extension storage until you delete this model.'
			);
		} catch (e: unknown) {
			setGgufDlNote(e instanceof Error ? e.message : 'Clear failed');
		} finally {
			setGgufClearBusy(false);
		}
	};

	const tabBtn = (active: boolean) =>
		`text-xs px-3 py-1.5 rounded border ${
			active
				? 'border-gpt-accent bg-gpt-accent/15 text-gpt-text'
				: secondaryButtonClass
		}`;

	const runGgufDownload = async (url: string): Promise<boolean> => {
		setGgufDlNote('');
		setGgufDlProgress({ loaded: 0, total: null });
		setGgufDlBusy(true);
		try {
			const r = await downloadGgufFromUrl(url, {
				onProgress: (loaded, total) => setGgufDlProgress({ loaded, total }),
			});
			setGgufDlNote(r.message);
			return r.ok;
		} catch {
			return false;
		} finally {
			setGgufDlBusy(false);
			setGgufDlProgress(null);
		}
	};

	const refreshGgufStorageInfo = async () => {
		const cfg = buildGgufConfigForCacheInfo({
			backend: modelFormWebGpuBackend,
			source: modelFormWebGpuSource,
			modelFormWebGpuHfGgufRepo,
			modelFormWebGpuHfGgufFile,
			modelFormWebGpuGgufUrl,
			modelFormWebGpuUpload,
			editingModelId,
			modelConfigs,
		});
		if (!cfg) {
			setGgufStorageInfo(null);
			return;
		}
		try {
			const info = await getGgufStorageInfo(cfg);
			setGgufStorageInfo(info);
		} catch {
			setGgufStorageInfo(null);
		}
	};

	const onDownloadGgufHf = () => {
		const repoId = parseHfRepoId(modelFormWebGpuHfGgufRepo);
		const fileName = normalizeGgufHfFilePathInput(modelFormWebGpuHfGgufFile);
		if (!repoId || !fileName) {
			setGgufDlNote('Enter repo id and the path to a .gguf file inside that repo.');
			return;
		}
		if (!fileName.toLowerCase().endsWith('.gguf')) {
			setGgufDlNote(
				'File path must include the full .gguf name (not only the repo), e.g. model-q4_k_m.gguf'
			);
			return;
		}
		const u = buildHfGgufDownloadUrl({
			repoId,
			revision: 'main',
			fileName,
		});
		void (async () => {
			const ok = await runGgufDownload(u);
			if (ok) await refreshGgufStorageInfo();
		})();
	};

	const onDownloadGgufUrlField = () => {
		const v = validateFullHfGgufFileUrl(modelFormWebGpuGgufUrl);
		if (!v.ok) {
			setGgufDlNote(v.message);
			return;
		}
		const u = buildHfGgufDownloadUrl(v.parsed);
		void (async () => {
			const ok = await runGgufDownload(u);
			if (ok) await refreshGgufStorageInfo();
		})();
	};

	const onDownloadOnnxHf = () => {
		const repoId = parseHfRepoId(modelFormWebGpuHfOnnx);
		if (!repoId || !/^[\w.-]+\/[\w.-]+$/.test(repoId)) {
			setOnnxDlNote('Enter a valid Hugging Face repo id (org/model).');
			return;
		}
		if (isOnnxPipelineCached(repoId)) {
			setOnnxDlNote(
				'This repo is already loaded in this session (ready to run). Browser cache may still hold weights from a prior visit.'
			);
			return;
		}
		setOnnxDlNote('');
		setOnnxDlProgress({ loaded: 0, total: 0, progress: 0 });
		setOnnxDlBusy(true);
		void (async () => {
			try {
				await loadOnnxPipeline(repoId, {
					progress_callback: (info) => {
						if (info.status === 'progress_total') {
							setOnnxDlProgress({
								loaded: info.loaded,
								total: info.total,
								progress: info.progress,
							});
						}
						if (info.status === 'download' || info.status === 'initiate') {
							setOnnxDlNote(`Fetching ${info.file}…`);
						}
					},
				});
				setOnnxDlNote(
					'Download finished and pipeline is ready. Weights stay in the browser cache for later.'
				);
			} catch (e: unknown) {
				setOnnxDlNote(e instanceof Error ? e.message : 'ONNX load failed');
			} finally {
				setOnnxDlBusy(false);
				setOnnxDlProgress(null);
			}
		})();
	};

	if (!showModelForm) return null;

	return (
		<div
			className={`space-y-3 rounded-lg border p-3 ${
				isDark ? 'border-gpt-border bg-gpt-sidebar/30' : 'border-gpt-border bg-gpt-surface/50'
			}`}
		>
			<div className={`text-xs font-semibold ${labelClass}`}>
				{editingModelId ? 'Edit Model' : 'New Model'}
			</div>

			<div className='flex gap-2'>
				<button
					type='button'
					className={tabBtn(modelFormTab === 'api')}
					onClick={() => setModelFormTab('api')}
				>
					API
				</button>
				<button
					type='button'
					className={tabBtn(modelFormTab === 'webgpu')}
					onClick={() => setModelFormTab('webgpu')}
				>
					Web GPU
				</button>
			</div>

			<div>
				<label className={`block text-xs mb-1 ${labelClass}`}>Display Name</label>
				<input
					className={inputClass}
					value={modelFormName}
					onChange={(e) => setModelFormName(e.target.value)}
					placeholder='e.g. My model'
				/>
			</div>

			{modelFormTab === 'api' ? (
				<>
					<div>
						<label className={`block text-xs mb-1 ${labelClass}`}>Base URL</label>
						<input
							className={inputClass}
							value={modelFormBaseUrl}
							onChange={(e) => setModelFormBaseUrl(e.target.value)}
							placeholder='http://localhost:11434/v1'
						/>
					</div>
					<div>
						<label className={`block text-xs mb-1 ${labelClass}`}>API Key</label>
						<input
							type='password'
							className={inputClass}
							value={modelFormApiKey}
							onChange={(e) => setModelFormApiKey(e.target.value)}
						/>
					</div>
					<div>
						<div className='flex justify-between items-center mb-1'>
							<label className={`block text-xs ${labelClass}`}>Model Name</label>
							<div className='flex items-center gap-3'>
								<label className={`flex items-center gap-1 text-[11px] ${subtleClass}`}>
									<input
										type='checkbox'
										className='accent-gpt-accent'
										checked={modelFormUseManual}
										onChange={(e) => setModelFormUseManual(e.target.checked)}
									/>
									Manual
								</label>
								<button
									type='button'
									onClick={fetchModelsForForm}
									className='text-[11px] text-gpt-accent hover:text-gpt-accent-hover'
								>
									↻ Fetch
								</button>
							</div>
						</div>
						{!modelFormUseManual && modelFormAvailableModels.length > 0 ? (
							<select
								className={inputClass}
								value={modelFormModelName}
								onChange={(e) => setModelFormModelName(e.target.value)}
							>
								<option value=''>Select a model</option>
								{modelFormAvailableModels.map((m) => (
									<option key={m} value={m}>
										{m}
									</option>
								))}
							</select>
						) : (
							<input
								className={inputClass}
								value={modelFormModelName}
								onChange={(e) => setModelFormModelName(e.target.value)}
								placeholder='e.g. gpt-4o'
							/>
						)}
					</div>
					<label
						className={`flex items-center gap-2 text-xs ${
							isDark ? 'text-gpt-text' : 'text-gpt-text'
						}`}
					>
						<input
							type='checkbox'
							className='accent-gpt-accent'
							checked={modelFormSupportsVision}
							onChange={(e) => setModelFormSupportsVision(e.target.checked)}
						/>
						Vision support
					</label>
				</>
			) : (
				<>
					<div className={`text-[11px] ${subtleClass}`}>
						ONNX uses WebGPU when available (WASM fallback). GGUF uses bundled WebAssembly (CPU);
						not WebGPU.
					</div>
					<div className='flex gap-2'>
						<button
							type='button'
							className={tabBtn(modelFormWebGpuBackend === 'onnx')}
							onClick={() => {
								setModelFormWebGpuBackend('onnx');
								if (modelFormWebGpuSource === 'url') {
									setModelFormWebGpuSource('hf');
								}
								setModelFormWebGpuContextWindowTokens(
									snapWebGpuContextWindowTokens(
										modelFormWebGpuContextWindowTokens,
										'onnx'
									)
								);
							}}
						>
							ONNX
						</button>
						<button
							type='button'
							className={tabBtn(modelFormWebGpuBackend === 'gguf')}
							onClick={() => {
								setModelFormWebGpuBackend('gguf');
								setModelFormWebGpuContextWindowTokens(
									snapWebGpuContextWindowTokens(
										modelFormWebGpuContextWindowTokens,
										'gguf'
									)
								);
							}}
						>
							GGUF
						</button>
					</div>
					{modelFormWebGpuBackend === 'onnx' && (
						<div>
							<label className={`block text-xs mb-1 ${labelClass}`}>Architecture</label>
							<select
								className={inputClass}
								value={modelFormOnnxModelType}
								onChange={(e) =>
									setModelFormOnnxModelType(
										e.target.value as 'text-generation' | 'image-text-to-text'
									)
								}
							>
								<option value='text-generation'>Text Generation (causal LM)</option>
								<option value='image-text-to-text'>Image-Text-to-Text (VLM, e.g. Gemma 4)</option>
							</select>
							<div className={`text-[11px] mt-1 ${subtleClass}`}>
								Use &quot;Image-Text-to-Text&quot; for multimodal ONNX models that have a vision encoder
								(e.g. Gemma 4, LLaVA). Use &quot;Text Generation&quot; for text-only models (e.g. Qwen, Phi).
							</div>
						</div>
					)}
					<div className='flex gap-2 flex-wrap'>
						<button
							type='button'
							className={tabBtn(modelFormWebGpuSource === 'hf')}
							onClick={() => {
								setModelFormWebGpuSource('hf');
								setModelFormGgufConfigError('');
							}}
						>
							Hugging Face
						</button>
						{modelFormWebGpuBackend === 'gguf' ? (
							<button
								type='button'
								className={tabBtn(modelFormWebGpuSource === 'url')}
								onClick={() => {
									setModelFormWebGpuSource('url');
									setModelFormGgufConfigError('');
								}}
							>
								From URL
							</button>
						) : null}
						<button
							type='button'
							className={tabBtn(modelFormWebGpuSource === 'upload')}
							onClick={() => {
								setModelFormWebGpuSource('upload');
								setModelFormGgufConfigError('');
							}}
						>
							Upload
						</button>
					</div>
					<div>
						<label className={`block text-xs mb-1 ${labelClass}`}>
							Context window (tokens)
						</label>
						<input
							type='range'
							className='w-full h-2 mb-2 accent-gpt-accent cursor-pointer'
							min={WEBGPU_CONTEXT_WINDOW_MIN_TOKENS}
							max={getWebGpuContextWindowMax(modelFormWebGpuBackend)}
							step={WEBGPU_CONTEXT_WINDOW_SNAP_STEP}
							value={Math.min(
								modelFormWebGpuContextWindowTokens,
								getWebGpuContextWindowMax(modelFormWebGpuBackend)
							)}
							onChange={(e) => {
								const n = Number(e.target.value);
								setModelFormWebGpuContextWindowTokens(
									snapWebGpuContextWindowTokens(
										Number.isFinite(n) ? n : getDefaultWebGpuContextWindowTokens(),
										modelFormWebGpuBackend
									)
								);
							}}
						/>
						<input
							type='number'
							min={WEBGPU_CONTEXT_WINDOW_MIN_TOKENS}
							max={getWebGpuContextWindowMax(modelFormWebGpuBackend)}
							step={WEBGPU_CONTEXT_WINDOW_SNAP_STEP}
							className={inputClass}
							value={modelFormWebGpuContextWindowTokens}
							onChange={(e) => {
								const n = Number(e.target.value);
								setModelFormWebGpuContextWindowTokens(
									snapWebGpuContextWindowTokens(
										Number.isFinite(n) ? n : getDefaultWebGpuContextWindowTokens(),
										modelFormWebGpuBackend
									)
								);
							}}
							onBlur={(e) => {
								const n = Number(e.target.value);
								setModelFormWebGpuContextWindowTokens(
									snapWebGpuContextWindowTokens(
										Number.isFinite(n) ? n : getDefaultWebGpuContextWindowTokens(),
										modelFormWebGpuBackend
									)
								);
							}}
						/>
						<div className={`text-[11px] mt-1 ${subtleClass}`}>
							Default {getDefaultWebGpuContextWindowTokens()} — snapped to {WEBGPU_CONTEXT_WINDOW_SNAP_STEP}{' '}
							tok steps; ONNX up to {getWebGpuContextWindowMax('onnx').toLocaleString()}; GGUF up to{' '}
							{getWebGpuContextWindowMax('gguf').toLocaleString()} (
							<code className='text-gpt-text'>n_ctx</code>).
						</div>
					</div>
					{modelFormWebGpuBackend === 'gguf' && modelFormGgufConfigError ? (
						<div className='text-[11px] text-red-400'>{modelFormGgufConfigError}</div>
					) : null}
					{modelFormWebGpuBackend === 'onnx' ? (
						<>
							{modelFormWebGpuUpload && modelFormWebGpuSource === 'upload' ? (
								<div className={`text-[11px] ${subtleClass}`}>
									File: {modelFormWebGpuUpload.name}
								</div>
							) : null}
							{modelFormWebGpuSource === 'hf' ? (
								<div className='space-y-2'>
									<label className={`block text-xs mb-1 ${labelClass}`}>
										Model repo (Transformers.js ONNX)
									</label>
									<input
										className={inputClass}
										value={modelFormWebGpuHfOnnx}
										onChange={(e) => setModelFormWebGpuHfOnnx(e.target.value)}
										placeholder='onnx-community/Qwen3-0.6B-ONNX'
									/>
									<button
										type='button'
										disabled={onnxDlBusy}
										onClick={() => void onDownloadOnnxHf()}
										className='text-xs px-2 py-1 rounded border border-gpt-border text-gpt-text hover:bg-gpt-elevated disabled:opacity-50 disabled:cursor-not-allowed'
									>
										{onnxDlBusy ? 'Downloading…' : 'Download & load model'}
									</button>
									{onnxDlProgress ? (
										<div className='space-y-1'>
											<div className='h-1.5 w-full rounded-full bg-gpt-border overflow-hidden'>
												<div
													className='h-full rounded-full bg-gpt-accent transition-[width] duration-150'
													style={{
														width: onnxDlProgress.total
															? `${Math.min(100, onnxDlProgress.progress || 0)}%`
															: '35%',
													}}
												/>
											</div>
											<div className={`text-[11px] ${subtleClass}`}>
												{onnxDlProgress.total > 0
													? `${Math.min(100, Math.round(onnxDlProgress.progress))}% · ${fmtBytes(onnxDlProgress.loaded)} / ${fmtBytes(onnxDlProgress.total)}`
													: `${fmtBytes(onnxDlProgress.loaded)} received (total unknown until first file completes)`}
											</div>
										</div>
									) : null}
									{onnxDlNote ? (
										<div className={`text-[11px] ${subtleClass}`}>{onnxDlNote}</div>
									) : null}
								</div>
							) : (
								<div>
									<label className={`block text-xs mb-1 ${labelClass}`}>
										ONNX model file (.onnx)
									</label>
									<input
										type='file'
										accept='.onnx'
										className={inputClass}
										onChange={(e) =>
											setModelFormWebGpuUpload(e.target.files?.[0] ?? null)
										}
									/>
								</div>
							)}
							<label
								className={`flex items-center gap-2 text-xs ${
									isDark ? 'text-gpt-text' : 'text-gpt-text'
								}`}
							>
								<input
									type='checkbox'
									className='accent-gpt-accent'
									checked={modelFormSupportsVision}
									onChange={(e) => setModelFormSupportsVision(e.target.checked)}
								/>
								Vision (multimodal ONNX; use a vision-language ONNX repo)
							</label>
						</>
					) : (
						<>
							{modelFormWebGpuUpload && modelFormWebGpuSource === 'upload' ? (
								<div className={`text-[11px] ${subtleClass}`}>
									File: {modelFormWebGpuUpload.name}
								</div>
							) : null}
							{modelFormWebGpuSource === 'hf' ? (
								<>
									<div>
										<label className={`block text-xs mb-1 ${labelClass}`}>
											Hugging Face repo id
										</label>
										<input
											className={inputClass}
											value={modelFormWebGpuHfGgufRepo}
											onChange={(e) => {
												setModelFormWebGpuHfGgufRepo(e.target.value);
												setModelFormGgufConfigError('');
											}}
											placeholder='org/model'
										/>
									</div>
									<div>
										<label className={`block text-xs mb-1 ${labelClass}`}>
											GGUF path in repo (not a full URL)
										</label>
										<input
											className={inputClass}
											value={modelFormWebGpuHfGgufFile}
											onChange={(e) => {
												setModelFormWebGpuHfGgufFile(e.target.value);
												setModelFormGgufConfigError('');
											}}
											placeholder='model-q4_k_m.gguf'
										/>
										<div className={`text-[11px] mt-1 space-y-1 ${subtleClass}`}>
											<div>
												Use the file path inside the repo (for example{' '}
												<code className='text-gpt-text'>weights/model.gguf</code>), not{' '}
												<code className='text-gpt-text'>https://…</code>. Loading uses branch{' '}
												<code className='text-gpt-text'>main</code>.
											</div>
											<div>
												Example resolve URL shape:{' '}
												<code className='text-gpt-text break-all'>
													https://huggingface.co/org/model/resolve/main/model-q4_k_m.gguf
												</code>
											</div>
										</div>
										<button
											type='button'
											disabled={ggufDlBusy}
											onClick={() => void onDownloadGgufHf()}
											className='mt-2 text-xs px-2 py-1 rounded border border-gpt-border text-gpt-text hover:bg-gpt-elevated disabled:opacity-50 disabled:cursor-not-allowed'
										>
											{ggufDlBusy ? 'Downloading…' : 'Download .gguf'}
										</button>
									</div>
								</>
							) : modelFormWebGpuSource === 'url' ? (
								<div>
									<label className={`block text-xs mb-1 ${labelClass}`}>
										Hugging Face GGUF URL
									</label>
									<input
										className={inputClass}
										value={modelFormWebGpuGgufUrl}
										onChange={(e) => {
											setModelFormWebGpuGgufUrl(e.target.value);
											setModelFormGgufConfigError('');
										}}
										placeholder='https://huggingface.co/org/model/resolve/main/file.gguf'
									/>
									<div className={`text-[11px] mt-1 space-y-1 ${subtleClass}`}>
										<div>
											Required: full <code className='text-gpt-text'>https://huggingface.co/…/resolve/…/file.gguf</code>{' '}
											(or <code className='text-gpt-text'>…/blob/…/file.gguf</code>). Repo-only or
											repo + branch without a filename is invalid.
										</div>
										<div>
											Example:{' '}
											<code className='text-gpt-text break-all'>
												https://huggingface.co/unsloth/gemma-4-E2B-it-GGUF/resolve/main/gemma-4-E2B-it-Q4_K_M.gguf
											</code>
										</div>
									</div>
									<button
										type='button'
										disabled={ggufDlBusy}
										onClick={() => void onDownloadGgufUrlField()}
										className='mt-2 text-xs px-2 py-1 rounded border border-gpt-border text-gpt-text hover:bg-gpt-elevated disabled:opacity-50 disabled:cursor-not-allowed'
									>
										{ggufDlBusy ? 'Downloading…' : 'Download .gguf'}
									</button>
								</div>
							) : (
								<div>
									<label className={`block text-xs mb-1 ${labelClass}`}>GGUF file</label>
									<input
										type='file'
										accept='.gguf'
										className={inputClass}
										onChange={(e) =>
											setModelFormWebGpuUpload(e.target.files?.[0] ?? null)
										}
									/>
								</div>
							)}
							<div
								className={`rounded border p-2 space-y-1.5 ${
									isDark ? 'border-gpt-border bg-gpt-sidebar/20' : 'border-gpt-border bg-gpt-surface/30'
								}`}
							>
								<div className={`text-[11px] font-semibold ${labelClass}`}>
									GGUF storage and runtime
								</div>
								{ggufStorageLoading ? (
									<div className={`text-[11px] ${subtleClass}`}>Checking…</div>
								) : !ggufStorageInfo ? (
									<div className={`text-[11px] ${subtleClass}`}>
										Enter a complete HF path, full URL, or saved upload to see disk and memory
										status.
									</div>
								) : ggufStorageInfo.kind === 'huggingface' ? (
									<div className={`text-[11px] space-y-0.5 ${subtleClass}`}>
										<div>
											Browser disk cache (wllama):{' '}
											{ggufStorageInfo.onDisk
												? `${fmtBytes(ggufStorageInfo.diskBytes)}${
														ggufStorageInfo.cacheValid ? ' · valid' : ' · invalid or partial'
													}`
												: 'not present'}
										</div>
										<div>
											WASM runtime:{' '}
											{ggufStorageInfo.runtimeLoaded ? 'loaded in memory' : 'not loaded'}
										</div>
										<div className='text-[10px] opacity-80 break-all'>
											Cache key URL: {ggufStorageInfo.resolveUrl}
										</div>
									</div>
								) : (
									<div className={`text-[11px] space-y-0.5 ${subtleClass}`}>
										<div>
											Extension file:{' '}
											{ggufStorageInfo.blobPresent
												? `${fmtBytes(ggufStorageInfo.blobBytes)} · present`
												: `pending save (${fmtBytes(ggufStorageInfo.blobBytes)})`}
										</div>
										<div>
											WASM runtime:{' '}
											{ggufStorageInfo.runtimeLoaded ? 'loaded in memory' : 'not loaded'}
										</div>
									</div>
								)}
								<div className='flex flex-wrap gap-2 items-center'>
									<button
										type='button'
										disabled={
											ggufClearBusy ||
											!buildGgufConfigForCacheInfo({
												backend: modelFormWebGpuBackend,
												source: modelFormWebGpuSource,
												modelFormWebGpuHfGgufRepo,
												modelFormWebGpuHfGgufFile,
												modelFormWebGpuGgufUrl,
												modelFormWebGpuUpload,
												editingModelId,
												modelConfigs,
											})
										}
										onClick={() => void onClearGgufCache()}
										className='text-[11px] px-2 py-1 rounded border border-gpt-border text-gpt-text hover:bg-gpt-elevated disabled:opacity-50 disabled:cursor-not-allowed'
									>
										{ggufClearBusy ? 'Clearing…' : 'Clear cache & unload runtime'}
									</button>
									<button
										type='button'
										disabled={ggufStorageLoading}
										onClick={() => void refreshGgufStorageInfo()}
										className='text-[11px] px-2 py-1 rounded border border-gpt-border text-gpt-muted hover:bg-gpt-elevated disabled:opacity-50'
									>
										Refresh
									</button>
								</div>
							</div>
							<label
								className={`flex items-center gap-2 text-xs ${
									isDark ? 'text-gpt-text' : 'text-gpt-text'
								}`}
							>
								<input
									type='checkbox'
									className='accent-gpt-accent'
									checked={modelFormSupportsVision}
									onChange={(e) => setModelFormSupportsVision(e.target.checked)}
								/>
								Vision (multimodal GGUF; images are sent as labeled data URLs in the prompt)
							</label>
						</>
					)}
					{modelFormWebGpuBackend === 'gguf' && ggufDlProgress ? (
						<div className='space-y-1'>
							<div className='h-1.5 w-full rounded-full bg-gpt-border overflow-hidden'>
								<div
									className='h-full rounded-full bg-gpt-accent transition-[width] duration-150'
									style={{
										width: ggufDlProgress.total
											? `${Math.min(100, (ggufDlProgress.loaded / ggufDlProgress.total) * 100)}%`
											: '35%',
									}}
								/>
							</div>
							<div className={`text-[11px] ${subtleClass}`}>
								{ggufDlProgress.total
									? `${Math.min(100, Math.round((ggufDlProgress.loaded / ggufDlProgress.total) * 100))}% · `
									: ''}
								{fmtBytes(ggufDlProgress.loaded)}
								{ggufDlProgress.total
									? ` / ${fmtBytes(ggufDlProgress.total)}`
									: ' received (total size unknown until complete)'}
							</div>
						</div>
					) : null}
					{modelFormWebGpuBackend === 'gguf' && ggufDlNote ? (
						<div className={`text-[11px] ${subtleClass}`}>{ggufDlNote}</div>
					) : null}
				</>
			)}

			<div className='flex items-center gap-2'>
				<button
					type='button'
					onClick={() => void saveModelConfig()}
					disabled={webGpuSaving}
					className='bg-gpt-accent hover:bg-gpt-accent-hover text-gpt-on-accent rounded px-3 py-1.5 text-xs disabled:opacity-60'
				>
					{webGpuSaving ? 'Saving…' : editingModelId ? 'Update Model' : 'Save Model'}
				</button>
				<button
					type='button'
					onClick={clearModelForm}
					className={`text-xs px-3 py-1.5 rounded border ${secondaryButtonClass}`}
				>
					Cancel
				</button>
			</div>
		</div>
	);
};

export default ModelSettingsForm;
