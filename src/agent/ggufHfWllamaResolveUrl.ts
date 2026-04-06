/** Same URL shape as @wllama/wllama `loadModelFromHF` (branch `main`, unencoded path). */
const ggufHfWllamaResolveUrl = (repoId: string, fileName: string): string =>
	`https://huggingface.co/${repoId}/resolve/main/${fileName}`;

export default ggufHfWllamaResolveUrl;
