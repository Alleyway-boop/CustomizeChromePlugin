export interface IndexedDBData {
    id: string;
    data: any;
}

export default class Y_StorageManager {
    private supportsLocalStorage: boolean;
    private supportsSessionStorage: boolean;
    private supportsIndexedDB: boolean;

    constructor(IndexedDBData?: IndexedDBData) {
        this.supportsLocalStorage = typeof window.localStorage !== 'undefined';
        this.supportsSessionStorage = typeof window.sessionStorage !== 'undefined';
        this.supportsIndexedDB = typeof window.indexedDB !== 'undefined';
    }
    // 使用 LocalStorage 保存数据
    setLocalStorage<T>(key: string, value: T): void {
        if (this.supportsLocalStorage) {
            window.localStorage.setItem(key, JSON.stringify(value));
        } else {
            console.warn('LocalStorage is not supported.');
        }
    }

    getLocalStorage<T>(key: string): T | null {
        if (this.supportsLocalStorage) {
            const value = window.localStorage.getItem(key);
            return value ? (JSON.parse(value) as T) : null;
        } else {
            console.warn('LocalStorage is not supported.');
            return null;
        }
    }

    // 使用 SessionStorage 保存数据
    setSessionStorage<T>(key: string, value: T): void {
        if (this.supportsSessionStorage) {
            window.sessionStorage.setItem(key, JSON.stringify(value));
        } else {
            console.warn('SessionStorage is not supported.');
        }
    }

    getSessionStorage<T>(key: string): T | null {
        if (this.supportsSessionStorage) {
            const value = window.sessionStorage.getItem(key);
            return value ? (JSON.parse(value) as T) : null;
        } else {
            console.warn('SessionStorage is not supported.');
            return null;
        }
    }

    // 使用 IndexedDB 保存数据（异步）
    setIndexedDB<T>(dbName: string, storeName: string, key: string, value: T): Promise<string> {
        return new Promise((resolve, reject) => {
            if (!this.supportsIndexedDB) {
                reject('IndexedDB is not supported.');
                return;
            }
            const request = window.indexedDB.open(dbName, 1);

            request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains(storeName)) {
                    db.createObjectStore(storeName, { keyPath: 'id' });
                }
            };

            request.onsuccess = (event: Event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                const transaction = db.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);
                store.put({ id: key, data: value });

                transaction.oncomplete = () => {
                    resolve('Data stored in IndexedDB successfully.');
                };

                transaction.onerror = () => {
                    reject('Error storing data in IndexedDB.');
                };
            };

            request.onerror = () => {
                reject('IndexedDB open failed.');
            };
        });
    }

    getIndexedDB<T>(dbName: string, storeName: string, key: string): Promise<T | null> {
        return new Promise((resolve, reject) => {
            if (!this.supportsIndexedDB) {
                reject('IndexedDB is not supported.');
                return;
            }

            const request = window.indexedDB.open(dbName, 1);

            request.onsuccess = (event: Event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                const transaction = db.transaction([storeName], 'readonly');
                const store = transaction.objectStore(storeName);
                const query = store.get(key);

                query.onsuccess = () => {
                    resolve(query.result ? (query.result.data as T) : null);
                };

                query.onerror = () => {
                    reject('Error retrieving data from IndexedDB.');
                };
            };

            request.onerror = () => {
                reject('IndexedDB open failed.');
            };
        });
    }
}