export type AssetFile = {
	id: string;
	name: string;
	type: string;
	size: number;
	dataUrl: string;
	source?: 'uploaded' | 'generated';
};
