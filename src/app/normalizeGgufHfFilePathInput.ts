import parseHfGgufResolveUrl from './parseHfGgufResolveUrl';

const normalizeGgufHfFilePathInput = (raw: string): string => {
	const t = raw.trim();
	const parsed = parseHfGgufResolveUrl(t);
	if (parsed) return parsed.fileName;
	return t;
};

export default normalizeGgufHfFilePathInput;
