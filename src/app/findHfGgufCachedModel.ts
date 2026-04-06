import { ModelManager, type Model } from '@wllama/wllama';
import ggufHfWllamaResolveUrl from '../agent/ggufHfWllamaResolveUrl';
import buildHfGgufDownloadUrl from './buildHfGgufDownloadUrl';

const findHfGgufCachedModel = async (
	repoId: string,
	fileName: string
): Promise<Model | null> => {
	const canonical = ggufHfWllamaResolveUrl(repoId, fileName);
	const encodedAlt = buildHfGgufDownloadUrl({
		repoId,
		revision: 'main',
		fileName,
	});
	const mm = new ModelManager();
	const models = await mm.getModels({ includeInvalid: true });
	return (
		models.find((m) => m.url === canonical) ??
		models.find((m) => m.url === encodedAlt) ??
		null
	);
};

export default findHfGgufCachedModel;
