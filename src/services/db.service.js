const DB_NAME = 'authDB';
const DB_VERSION = 1;
const USER_STORE = 'users';

export const initDB = () => {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);

		request.onerror = (event) => reject(`Database error: ${event.target.error}`);

		request.onsuccess = (event) => resolve(event.target.result);

		request.onupgradeneeded = (event) => {
			const db = event.target.result;
			if (!db.objectStoreNames.contains(USER_STORE)) {
				const store = db.createObjectStore(USER_STORE, { keyPath: 'username' });
				store.createIndex('username', 'username', { unique: true });
			}
		};
	});
};

export const registerUser = async (userData) => {
	const db = await initDB();
	return new Promise((resolve, reject) => {
		const transaction = db.transaction([USER_STORE], 'readwrite');
		const store = transaction.objectStore(USER_STORE);
		const request = store.add(userData);

		request.onsuccess = () => resolve(true);
		request.onerror = (event) => {
			if (event.target.error.name === 'ConstraintError') {
				reject('Username already exists');
			} else {
				reject(`Error: ${event.target.error}`);
			}
		};
	});
};

export const loginUser = async (username, password) => {
	const db = await initDB();
	return new Promise((resolve, reject) => {
		const transaction = db.transaction([USER_STORE], 'readonly');
		const store = transaction.objectStore(USER_STORE);
		const request = store.get(username);

		request.onsuccess = (event) => {
			const user = event.target.result;
			if (user && user.password === password) {
				resolve(user);
			} else {
				reject('Invalid username or password');
			}
		};

		request.onerror = () => reject('Error accessing database');
	});
};