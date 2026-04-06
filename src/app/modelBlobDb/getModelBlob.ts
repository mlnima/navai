import openModelBlobDb from './openModelBlobDb';
import { modelBlobStoreName } from './modelBlobDbConstants';

const getModelBlob = async (id: string): Promise<Blob | undefined> => {
	const db = await openModelBlobDb();
	const blob = await new Promise<Blob | undefined>((resolve, reject) => {
		const tx = db.transaction(modelBlobStoreName, 'readonly');
		const store = tx.objectStore(modelBlobStoreName);
		const r = store.get(id);
		r.onerror = () => reject(r.error);
		r.onsuccess = () => resolve(r.result as Blob | undefined);
	});
	db.close();
	return blob;
};

export default getModelBlob;
