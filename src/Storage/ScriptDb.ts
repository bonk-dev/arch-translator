import {get, openDb, OpenDbResultType, put} from "./IndexedDbPromiseWrappers";
import {CachedPageInfo} from "./ScriptDbModels";
import {getLangInfoFor, LanguageInfo} from "../Internalization/I18nConstants";

const ARCH_TRANSLATOR_DB_NAME = 'ArchTranslator';
const ARCH_TRANSLATOR_DB_VERSION  = 1;
const CACHED_PAGES_STORE = 'cached_pages';
const SETTINGS_STORE = 'settings';

const SETTINGS_LANG_KEY = 'language';
const DEFAULT_SETTINGS: { [key: string]: string } = {
    [SETTINGS_LANG_KEY]: 'Polish'
};

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
    getDb().createObjectStore(SETTINGS_STORE);
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

const getDefaultSettingValue = <T>(key: string): T => {
    return DEFAULT_SETTINGS[key] as T;
};

export const getCurrentLanguage = async(): Promise<LanguageInfo> => {
    const db = getDb();
    const tr = db.transaction(SETTINGS_STORE);
    const store = tr.objectStore(SETTINGS_STORE);

    let languageKey = await get<string>(store, SETTINGS_LANG_KEY);
    if (languageKey == null) {
        languageKey = getDefaultSettingValue<string>(SETTINGS_LANG_KEY);
    }

    return getLangInfoFor(languageKey);
};

export const setCurrentLanguage = async(info: LanguageInfo) => {
    const db = getDb();
    const tr = db.transaction(SETTINGS_STORE, "readwrite");
    const store = tr.objectStore(SETTINGS_STORE);

    await put<string>(store, info.englishName, SETTINGS_LANG_KEY);
};