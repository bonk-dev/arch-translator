export enum CachedPageInfoType {
    English = 'english',
    Translated = 'translated',
    Redirect = 'redirect'
}

export type CachedPageInfo =
    | { type: CachedPageInfoType.English, pageName: string, latestRevisionId: number }
    | { type: CachedPageInfoType.Translated, pageName: string, latestRevisionId: number, translationRevisionId: number }
    | { type: CachedPageInfoType.Redirect, pageName: string, latestRevisionId: number, redirectsTo: string };