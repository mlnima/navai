import openModelBlobDb from './openModelBlobDb';
import { modelBlobStoreName } from './modelBlobDbConstants';

const putModelBlob = async (id: string, blob: Blob): Promise<void> => {
	const db = await openModelBlobDb();
	await new Promise<void>((resolve, reject) => {
		const tx = db.transaction(modelBlobStoreName, 'readwrite');
		const store = tx.objectStore(modelBlobStoreName);
		const r = store.put(blob, id);
		r.onerror = () => reject(r.error);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
	db.close();
};

export default putModelBlob;
