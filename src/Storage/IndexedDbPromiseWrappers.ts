export enum OpenDbResultType {
    Success = 0,
    Blocked = 1,
    UpgradeNeeded = 2
}
type OpenDbResult =
    | { type: OpenDbResultType.Success, database: IDBDatabase }
    | { type: OpenDbResultType.Blocked }
    | { type: OpenDbResultType.UpgradeNeeded, database: IDBDatabase, oldVer: number, newVer: number|null }

export const openDb = (name: string, version: number): Promise<OpenDbResult> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(name, version);
        request.onsuccess = (e) => {
            resolve({
                type: OpenDbResultType.Success,
                // @ts-ignore
                database: e.target.result
            });
        };
        request.onblocked = (e) => {
            resolve({
                type: OpenDbResultType.Blocked
            });
        };
        request.onupgradeneeded = (e) => {
            resolve({
                type: OpenDbResultType.UpgradeNeeded,
                // @ts-ignore
                database: e.target.result,
                oldVer: e.oldVersion,
                newVer: e.newVersion
            });
        };
        request.onerror = (e) => {
            reject(e);
        };
    });
}

export const transaction = (database: IDBDatabase,
                     storeNames: string | Iterable<string>,
                     mode?: IDBTransactionMode,
                     options?: IDBTransactionOptions): Promise<IDBTransaction> => {

    return new Promise((resolve, reject) => {
        const transaction = database.transaction(storeNames, mode, options);
        transaction.oncomplete = () => {
            resolve(transaction);
        };
        transaction.onerror = () => {
            reject(transaction.error);
        };
    });
};

const wrapGenericRequest = <T>(request: IDBRequest<T>): Promise<T> => {
    return new Promise((resolve, reject) => {
        request.onerror = () => {
            reject(request.error)
        };
        request.onsuccess = () => {
            resolve(request.result);
        };
    });
};

export const get = async <T>(store: IDBObjectStore, key: IDBValidKey | IDBKeyRange): Promise<T|null> => {
    const request = store.get(key);
    return await wrapGenericRequest<T>(request);
};

export const put = async <T>(store: IDBObjectStore, value: T, key?: IDBValidKey): Promise<IDBValidKey> => {
    const request = store.put(value, key);
    return await wrapGenericRequest(request);
};

const openCursor = (store: IDBObjectStore,
                    query?: IDBValidKey | IDBKeyRange | null,
                    direction?: IDBCursorDirection): Promise<IDBCursorWithValue|null> => {
    return new Promise((resolve, reject) => {
        const request = store.openCursor(query, direction);
        request.onerror = () => {
            reject(request.error);
        };
        request.onsuccess = () => {
            resolve(request.result);
        };
    });
};

const cursorNext = async (cursor: IDBCursorWithValue): Promise<IDBCursorWithValue|null> => {
    const request = cursor.request;
    const promise = wrapGenericRequest(request);
    cursor.continue();

    return await promise;
};

export async function* enumerate(store: IDBObjectStore,
                          query?: IDBValidKey | IDBKeyRange | null,
                          direction?: IDBCursorDirection) {
    let cursor = await openCursor(store, query, direction);
    while (cursor != null) {
        yield cursor;
        cursor = await cursorNext(cursor);
    }
}