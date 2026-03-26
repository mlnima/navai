const tryParseJson = (raw: string) => {
	try {
		return JSON.parse(raw);
	} catch {
		return null;
	}
};

export default tryParseJson;
