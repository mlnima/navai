/**
 * Copies ONNX Runtime Web WASM loader + binary into public/onnxruntime so the
 * Chrome extension can load them from chrome-extension:// (CSP blocks CDN scripts).
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const pkgPath = join(root, 'node_modules', 'onnxruntime-web', 'package.json');
const outDir = join(root, 'public', 'onnxruntime');

if (!existsSync(pkgPath)) {
	console.warn('[vendor-onnxruntime] onnxruntime-web not installed; skip.');
	process.exit(0);
}

const { version } = JSON.parse(readFileSync(pkgPath, 'utf8'));
const distUrl = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${version}/dist`;
const files = [
	'ort-wasm-simd-threaded.asyncify.mjs',
	'ort-wasm-simd-threaded.asyncify.wasm',
];

mkdirSync(outDir, { recursive: true });

const copyFromNodeModules = (name) => {
	const local = join(root, 'node_modules', 'onnxruntime-web', 'dist', name);
	if (existsSync(local)) {
		writeFileSync(join(outDir, name), readFileSync(local));
		return true;
	}
	return false;
};

const fetchToDisk = async (name) => {
	const url = `${distUrl}/${name}`;
	const res = await fetch(url);
	if (!res.ok) throw new Error(`${url} -> ${res.status}`);
	const buf = Buffer.from(await res.arrayBuffer());
	writeFileSync(join(outDir, name), buf);
};

for (const f of files) {
	if (copyFromNodeModules(f)) {
		console.log(`[vendor-onnxruntime] copied ${f} from node_modules`);
	} else {
		await fetchToDisk(f);
		console.log(`[vendor-onnxruntime] fetched ${f}`);
	}
}
