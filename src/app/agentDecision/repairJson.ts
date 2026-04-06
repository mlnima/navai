const repairJson = (raw: string) => {
	let cleaned = raw.trim();
	cleaned = cleaned.replace(/```json|```/gi, '');
	cleaned = cleaned.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
	cleaned = cleaned.replace(/=>/g, ':');
	cleaned = cleaned.replace(/\/\/.*$/gm, '');
	cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');
	cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');
	cleaned = cleaned.replace(
		/'([^'\\]*(?:\\.[^'\\]*)*)'/g,
		(_m, s) => `"${String(s).replace(/"/g, '\\"')}"`
	);
	cleaned = cleaned.replace(/([,{]\s*)([A-Za-z0-9_]+)\s*:/g, '$1"$2":');
	return cleaned;
};

export default repairJson;
