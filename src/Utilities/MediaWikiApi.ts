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
    wgEditMessage: string
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

// There is a lot more than just config, but I do not need anything. At least for now.
interface MediaWikiApi {
    config: MediaWikiConfig
}

export function getMwApi(): MediaWikiApi {
    // @ts-ignore
    return mw;
}