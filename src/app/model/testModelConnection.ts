interface TestModelConnectionInput {
	baseUrl: string;
	apiKey: string;
	modelName: string;
}

interface TestModelConnectionResult {
	ok: boolean;
	message: string;
}

const testModelConnection = async ({
	baseUrl,
	apiKey,
	modelName,
}: TestModelConnectionInput): Promise<TestModelConnectionResult> => {
	const url = `${baseUrl.replace(/\/+$/, '')}/models`;
	const headers: Record<string, string> = {};
	if (apiKey.trim()) headers.Authorization = `Bearer ${apiKey}`;
	try {
		const response = await fetch(url, { headers });
		if (!response.ok) {
			return {
				ok: false,
				message: `Connection failed (${response.status} ${response.statusText || 'error'})`,
			};
		}
		const payload = await response.json();
		const models = Array.isArray(payload?.data)
			? payload.data
					.map((item: any) => String(item?.id || '').trim())
					.filter(Boolean)
			: [];
		if (models.length === 0) {
			return { ok: true, message: 'Connected, but no models were returned.' };
		}
		const target = modelName.trim().toLowerCase();
		const hasTarget = models.some((id: string) => id.toLowerCase() === target);
		return hasTarget
			? { ok: true, message: `Connected. Model "${modelName}" is available.` }
			: {
					ok: true,
					message: `Connected. ${models.length} model(s) found, but "${modelName}" was not listed.`,
			  };
	} catch (error: any) {
		return {
			ok: false,
			message: `Connection failed (${error?.message || 'unknown error'})`,
		};
	}
};

export default testModelConnection;
