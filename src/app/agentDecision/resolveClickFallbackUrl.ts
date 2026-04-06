const normalizeText = (value: unknown) =>
	typeof value === 'string' ? value.trim().toLowerCase() : '';

const scoreTextMatch = (candidate: string, target: string) =>
	!candidate || !target
		? 0
		: candidate === target
		? 6
		: candidate.startsWith(target)
		? 4
		: candidate.includes(target)
		? 2
		: 0;

const sanitizeUrl = (value: unknown) => {
	const raw = typeof value === 'string' ? value.trim() : '';
	if (!raw) return '';
	return /^(https?:\/\/|chrome-extension:\/\/)/i.test(raw) ? raw : '';
};

const resolveClickFallbackUrl = (
	elements: unknown,
	action: { action: string; params: Record<string, unknown> }
) => {
	if (!Array.isArray(elements) || elements.length === 0) return '';
	const rows = elements as Array<Record<string, unknown>>;

	if (action.action === 'CLICK_ID') {
		const id = typeof action.params?.id === 'string' ? action.params.id : '';
		if (!id) return '';
		const row = rows.find((item) => item?.id === id);
		return sanitizeUrl(row?.hrefFull ?? row?.href);
	}

	if (action.action === 'CLICK_INDEX') {
		const index = Number(action.params?.index);
		if (!Number.isInteger(index) || index < 0 || index >= rows.length) return '';
		const row = rows[index];
		return sanitizeUrl(row?.hrefFull ?? row?.href);
	}

	if (action.action === 'CLICK') {
		const label = normalizeText(action.params?.label);
		if (!label) return '';
		const scored = rows
			.map((row) => {
				const text = normalizeText(row?.text);
				const ariaLabel = normalizeText(row?.ariaLabel);
				const title = normalizeText(row?.title);
				const name = normalizeText(row?.name);
				const placeholder = normalizeText(row?.placeholder);
				const best = Math.max(
					scoreTextMatch(text, label),
					scoreTextMatch(ariaLabel, label),
					scoreTextMatch(title, label),
					scoreTextMatch(name, label),
					scoreTextMatch(placeholder, label)
				);
				return { row, score: best };
			})
			.filter((item) => item.score > 0)
			.sort((a, b) => b.score - a.score);
		if (scored.length === 0) return '';
		return sanitizeUrl(scored[0].row?.hrefFull ?? scored[0].row?.href);
	}

	return '';
};

export default resolveClickFallbackUrl;
