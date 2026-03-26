const readFileAsText = (file: File) =>
	new Promise<string>((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result || ''));
		reader.onerror = () => reject(new Error('Failed to read file'));
		reader.readAsText(file);
	});

export default readFileAsText;
