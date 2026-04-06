import openModelBlobDb from './openModelBlobDb';
import { modelBlobStoreName } from './modelBlobDbConstants';

const deleteModelBlob = async (id: string): Promise<void> => {
	const db = await openModelBlobDb();
	await new Promise<void>((resolve, reject) => {
		const tx = db.transaction(modelBlobStoreName, 'readwrite');
		const store = tx.objectStore(modelBlobStoreName);
		const r = store.delete(id);
		r.onerror = () => reject(r.error);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
	db.close();
};

export default deleteModelBlob;
