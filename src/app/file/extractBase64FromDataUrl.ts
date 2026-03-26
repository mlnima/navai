const extractBase64FromDataUrl = (dataUrl: string) => {
	const commaIndex = dataUrl.indexOf(',');
	if (commaIndex === -1) return '';
	return dataUrl.slice(commaIndex + 1).trim();
};

export default extractBase64FromDataUrl;
