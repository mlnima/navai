import type { Dispatch, SetStateAction } from 'react';
import type { AssetFile } from '../types/AssetFile';
import extractBase64FromDataUrl from '../file/extractBase64FromDataUrl';
import normalizeAssetRef from '../file/normalizeAssetRef';
import toBase64Utf8 from '../file/toBase64Utf8';
import toDataUrlFromBase64 from '../file/toDataUrlFromBase64';

type EnrichResult =
	| { ok: false; error: string }
	| { ok: true; args: Record<string, unknown>; attachmentSummary: string };

const enrichMcpArgumentsWithAssets = (
	rawArgs: Record<string, unknown>,
	assets: AssetFile[],
	setAssets: Dispatch<SetStateAction<AssetFile[]>>
): EnrichResult => {
	const args = { ...rawArgs };
	const generatedAssets: AssetFile[] = [];
	const unresolvedRefs: string[] = [];
	const canonicalAttachments: Array<{
		filename: string;
		content: string;
		mimeType: string;
	}> = [];

	const resolveAssetRef = (ref: string) => {
		const raw = ref.trim();
		if (!raw) return null;
		const lower = raw.toLowerCase();
		const normalized = normalizeAssetRef(raw);
		const exact = assets.find((asset) => asset.name.trim().toLowerCase() === lower);
		if (exact) return exact;
		const normalizedExact = assets.find(
			(asset) => normalizeAssetRef(asset.name) === normalized
		);
		if (normalizedExact) return normalizedExact;
		const partial = assets.filter((asset) =>
			normalizeAssetRef(asset.name).includes(normalized)
		);
		if (partial.length === 1) return partial[0];
		return null;
	};

	const addGeneratedAsset = (
		filename: string,
		mimeType: string,
		base64Content: string
	) => {
		const cleanName = String(filename || 'generated.txt').trim();
		const cleanMime = String(mimeType || 'text/plain').trim();
		const dataUrl = toDataUrlFromBase64(base64Content, cleanMime);
		generatedAssets.push({
			id: `asset_${Date.now()}_${Math.random().toString(36).slice(2)}`,
			name: cleanName,
			type: cleanMime,
			size: Math.max(0, Math.floor((base64Content.length * 3) / 4)),
			dataUrl,
			source: 'generated',
		});
	};

	const addCanonicalAttachment = (
		filename: string,
		content: string,
		mimeType: string
	) => {
		const cleanFilename = String(filename || '').trim();
		const cleanContent = String(content || '').trim();
		const cleanMime = String(mimeType || 'application/octet-stream').trim();
		if (!cleanFilename || !cleanContent) return;
		canonicalAttachments.push({
			filename: cleanFilename,
			content: cleanContent,
			mimeType: cleanMime,
		});
	};

	const addAttachmentFromAsset = (
		asset: AssetFile,
		filenameOverride?: string,
		mimeTypeOverride?: string
	) => {
		addCanonicalAttachment(
			filenameOverride || asset.name,
			extractBase64FromDataUrl(asset.dataUrl),
			mimeTypeOverride || asset.type || 'application/octet-stream'
		);
	};

	const tryResolveRefFromObject = (item: Record<string, unknown>) => {
		const refKeys = ['assetName', 'asset', 'file', 'fileName', 'filename', 'name'];
		for (const key of refKeys) {
			if (typeof item[key] === 'string' && item[key]?.trim()) {
				return String(item[key]);
			}
		}
		return '';
	};

	const sourceAttachments = Array.isArray(args.attachments)
		? args.attachments
		: [];

	sourceAttachments.forEach((item: any) => {
		if (!item || typeof item !== 'object') return;
		const filename = String(item.filename || item.fileName || item.name || '').trim();
		const mimeType = String(item.mimeType || item.type || 'application/octet-stream').trim();
		const textContent = String(item.textContent || item.text || '').trim();
		const content = String(item.content || '').trim();
		if (textContent) {
			const generatedBase64 = toBase64Utf8(textContent);
			const generatedName = filename || 'generated.txt';
			const generatedMime = mimeType || 'text/plain';
			addGeneratedAsset(generatedName, generatedMime, generatedBase64);
			addCanonicalAttachment(generatedName, generatedBase64, generatedMime);
			return;
		}
		if (content) {
			addCanonicalAttachment(
				filename || 'attachment.bin',
				content,
				mimeType || 'application/octet-stream'
			);
			return;
		}
		const ref = tryResolveRefFromObject(item);
		if (ref) {
			const asset = resolveAssetRef(ref);
			if (!asset) {
				unresolvedRefs.push(ref);
				return;
			}
			addAttachmentFromAsset(asset, filename || undefined, mimeType || undefined);
		}
	});

	if (typeof args.assetName === 'string' && args.assetName.trim()) {
		const asset = resolveAssetRef(args.assetName);
		if (!asset) {
			unresolvedRefs.push(args.assetName);
		} else {
			addAttachmentFromAsset(asset);
		}
	}

	if (Array.isArray(args.generatedFiles)) {
		args.generatedFiles.forEach((item: any) => {
			if (!item || typeof item !== 'object') return;
			const filename = String(item.filename || item.name || 'generated.txt');
			const text = String(item.textContent || item.text || '').trim();
			if (!text) return;
			const mimeType = String(item.mimeType || 'text/plain');
			const content = toBase64Utf8(text);
			addGeneratedAsset(filename, mimeType, content);
			addCanonicalAttachment(filename, content, mimeType);
		});
	}

	if (generatedAssets.length > 0) {
		setAssets((prev) => [...prev, ...generatedAssets]);
	}

	const deduped = new Map<string, { filename: string; content: string; mimeType: string }>();
	canonicalAttachments.forEach((item) => {
		const key = `${item.filename}|${item.mimeType}|${item.content.length}`;
		if (!deduped.has(key)) deduped.set(key, item);
	});
	const finalAttachments = Array.from(deduped.values());

	if (unresolvedRefs.length > 0) {
		return {
			ok: false as const,
			error: `Missing assets referenced by MCP_CALL: ${Array.from(new Set(unresolvedRefs)).join(', ')}`,
		};
	}
	if (finalAttachments.some((item) => !item.content || item.content.trim().length === 0)) {
		return { ok: false as const, error: 'One or more attachments resolved with empty content.' };
	}

	const nextArgs = { ...args };
	if (finalAttachments.length > 0) {
		nextArgs.attachments = finalAttachments;
	}
	delete (nextArgs as any).generatedFiles;
	return {
		ok: true as const,
		args: nextArgs,
		attachmentSummary: finalAttachments
			.map(
				(item) =>
					`${item.filename} (${item.mimeType}, base64:${item.content.length})`
			)
			.join('; '),
	};
};

export default enrichMcpArgumentsWithAssets;
