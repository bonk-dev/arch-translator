import {get, openDb, OpenDbResultType, put} from "./IndexedDbPromiseWrappers";
import {CachedPageInfo} from "./ScriptDbModels";

const ARCH_TRANSLATOR_DB_NAME = 'ArchTranslator';
const ARCH_TRANSLATOR_DB_VERSION  = 1;
const CACHED_PAGES_STORE = 'cached_pages';

let database : IDBDatabase | null = null;
const getDb = (): IDBDatabase => {
    if (database == null) {
        throw new Error("Non-null database instance was requested, but the instance was null");
    }

    return database;
};

const upgradeDb = async (oldVersion: number, newVersion: number | null) => {
    console.debug(`upgradeDb: Upgrading from ${oldVersion} to ${newVersion}`);

    getDb().createObjectStore(CACHED_PAGES_STORE, {
        keyPath: 'pageName'
    });
};

export const setupDb = async (): Promise<boolean> => {
    console.debug(`setupDb: ${ARCH_TRANSLATOR_DB_NAME} (${ARCH_TRANSLATOR_DB_VERSION})`);

    try {
        const dbResult = await openDb(ARCH_TRANSLATOR_DB_NAME, ARCH_TRANSLATOR_DB_VERSION);
        switch (dbResult.type) {
            case OpenDbResultType.Success:
                database = dbResult.database;
                return true;
            case OpenDbResultType.UpgradeNeeded:
                database = dbResult.database;
                await upgradeDb(dbResult.oldVer, dbResult.newVer);
                return true;
            default:
                console.error(dbResult);
                return false;
        }
    } catch (e) {
        console.error(e);
        return false;
    }
};

export const getCachedPageInfo = async (pageName: string): Promise<CachedPageInfo|null> => {
    const db = getDb();
    const tr = db.transaction([CACHED_PAGES_STORE]);
    const store = tr.objectStore(CACHED_PAGES_STORE);

    return await get<CachedPageInfo>(store, pageName);
};

export const setCachedPageInfo = async (pageInfo: CachedPageInfo) => {
    const db = getDb();
    const tr = db.transaction(CACHED_PAGES_STORE, "readwrite");
    const store = tr.objectStore(CACHED_PAGES_STORE);

    await put<CachedPageInfo>(store, pageInfo);
};