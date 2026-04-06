const formatElement = (el: any) => {
	const parts: string[] = [`[${el.id}]`, el.tag];
	if (Number.isInteger(el.frameId)) parts.push(`frame=${el.frameId}`);
	if (el.type) parts.push(`type=${el.type}`);
	if (el.role) parts.push(`role=${el.role}`);
	if (el.name) parts.push(`name="${el.name}"`);
	if (el.text) parts.push(`"${el.text.length > 60 ? el.text.slice(0, 60) + '…' : el.text}"`);
	if (el.placeholder) parts.push(`placeholder="${el.placeholder}"`);
	if (el.ariaLabel && el.ariaLabel !== el.text) parts.push(`aria="${el.ariaLabel}"`);
	if (el.href) parts.push(`href="${el.href}"`);
	if (el.value) parts.push(`val="${el.value}"`);
	if (el.checked) parts.push('checked');
	if (el.disabled) parts.push('disabled');
	if (el.rect) parts.push(`(${el.rect.x},${el.rect.y} ${el.rect.w ?? el.rect.width}x${el.rect.h ?? el.rect.height})`);
	return parts.join(' ');
};

const buildElementMapSummary = (elements: any[]) => {
	if (!Array.isArray(elements) || elements.length === 0) return '';
	const limited = elements.slice(0, 300);
	const lines = limited.map(formatElement);
	const result = lines.join('\n');
	return result.length > 25000 ? result.slice(0, 25000) : result;
};

export default buildElementMapSummary;
