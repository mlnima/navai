const toDataUrlFromBase64 = (base64: string, mimeType: string) =>
	`data:${mimeType || 'application/octet-stream'};base64,${base64}`;

export default toDataUrlFromBase64;
