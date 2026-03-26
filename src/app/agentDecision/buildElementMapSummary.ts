const buildElementMapSummary = (elements: any[]) => {
	if (!Array.isArray(elements)) return '';
	const limited = elements.slice(0, 250);
	const json = JSON.stringify(limited);
	return json.length > 20000 ? json.slice(0, 20000) : json;
};

export default buildElementMapSummary;
