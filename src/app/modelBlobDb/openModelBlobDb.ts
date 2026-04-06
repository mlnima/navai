import {
	modelBlobDbName,
	modelBlobDbVersion,
	modelBlobStoreName,
} from './modelBlobDbConstants';

const openModelBlobDb = (): Promise<IDBDatabase> =>
	new Promise((resolve, reject) => {
		const req = indexedDB.open(modelBlobDbName, modelBlobDbVersion);
		req.onerror = () => reject(req.error ?? new Error('indexedDB open failed'));
		req.onsuccess = () => resolve(req.result);
		req.onupgradeneeded = () => {
			const db = req.result;
			if (!db.objectStoreNames.contains(modelBlobStoreName)) {
				db.createObjectStore(modelBlobStoreName);
			}
		};
	});

export default openModelBlobDb;
