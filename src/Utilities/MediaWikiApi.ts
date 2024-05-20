type Dictionary<TKey extends string | number | symbol, TValue> = {
    [Key in TKey]: TValue;
};

interface EchoSeenTime {
    alert: string
    notice: string
}

interface VisualEditor {
    pageLanguageCode: string
    pageLanguageDir: string
    pageVariantFallbacks: string
}

interface VisualEditorConfig {
    // I could not be bothered honestly
    // implement if you need it
}

export enum EditMessage {
    Editing = 'editing',
    Creating = 'creating'
}

interface MediaWikiConfigValues {
    debug: number
    extCodeMirrorConfig: any
    skin: string
    // noinspection SpellCheckingInspection
    stylepath: string
    wgAction: string
    wgActionPaths: any
    wgArticleId: number
    wgArticlePath: string
    wgBackendResponseTime: number
    wgBreakFrames: boolean
    wgCanonicalNamespace: string
    wgCanonicalSpecialPageName: boolean
    wgCaseSensitiveNamespaces: Array<any>
    wgCategories: Array<any>
    wgCheckUserClientHintsHeadersJsApi: Array<string>
    wgCodeMirrorLineNumberingNamespaces: any
    wgCommentCodePointLimit: number
    wgContentLanguage: string
    wgContentNamespaces: Array<number>
    wgCurRevisionId: number
    // noinspection SpellCheckingInspection
    wgDBname: string
    wgDefaultDateFormat: string
    wgDigitTransformTable: Array<string>
    wgEchoSeenTime: EchoSeenTime
    wgEditMessage: EditMessage
    wgEditSubmitButtonLabelPublish: boolean
    wgExtensionAssetsPath: string
    wgExtraSignatureNamespaces: Array<any>
    wgFormattedNamespaces: Dictionary<number, string>
    wgIllegalChars: string
    wgIsArticle: boolean
    wgIsProbablyEditable: boolean
    wgIsRedirect: boolean
    wgLegalTitleChars: string
    wgMonthNames: Array<string>
    wgNamespaceIds: Dictionary<string, number>
    wgNamespaceNumber: number
    wgPageContentLanguage: string
    wgPageContentModel: string
    // The page name - basically wgTitle with whitespace replaced by '_'
    wgPageName: string
    wgPageViewLanguage: string
    wgRelevantArticleId: number
    wgRelevantPageIsProbablyEditable: boolean
    wgRelevantPageName: string
    wgRequestId: string
    wgRestrictionEdit: Array<string>
    wgRestrictionMove: Array<string>
    wgRevisionId: number
    wgScript: string
    wgScriptPath: string
    wgSearchType: any
    wgSeparatorTransformTable: Array<string>
    wgServer: string
    wgServerName: string
    wgSiteName: string
    // The article title - basically wgPageName without the '_'
    wgTitle: string
    wgTranslateNumerals: boolean
    wgUrlProtocols: string
    wgUserEditCount: number
    wgUserGroups: Array<string>
    wgUserId: number
    wgUserIsTemp: boolean
    wgUserLanguage: string
    wgUserName: string
    wgUserRegistration: number
    wgVariantArticlePath: boolean
    wgVersion: string
    wgVisualEditor: VisualEditor
    wgVisualEditorConfig: VisualEditorConfig
    wgWikiID: string
}

interface MediaWikiConfig {
    get(key: string): any
    values: MediaWikiConfigValues
}

interface MediaWikiHookContext {
    add(callback: Function): any
    fire(): any
    remove(): any
}

interface MediaWikiLoader {
    using(module: string): Promise<void>
}

// There is a lot more than just config and hook(...), but I do not need anything else - for now at least.
interface MediaWikiApi {
    config: MediaWikiConfig
    hook(name: string): MediaWikiHookContext
    loader: MediaWikiLoader
}

export function isMwApiReady() {
    // @ts-ignore
    return typeof mw !== 'undefined';
}

export function getMwApi(): MediaWikiApi {
    // @ts-ignore
    return mw;
}