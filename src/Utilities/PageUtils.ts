import {EditMessage, getMwApi} from "./MediaWikiJsApi";
import {isTranslated, removeLanguagePostfix} from "../Internalization/I18nConstants";
import {getPageContent} from "./Api/MediaWikiApiClient";
import {getCachedPageInfo} from "../Storage/ScriptDb";
import {CodeMirrorEditor} from "./CodeMirrorTypes";

/**
 * Sometimes we do not need to fetch(...) for the raw page content (e.g. on edit pages).
 */
let cachedPageContent: string|null = null;

/**
 * Storing the CodeMirror editor instance allows us to easily get it's current content
 */
let codeMirrorInstance: CodeMirrorEditor|null = null;

export enum PageType {
    /**
     * Normal article read page
     */
    Read = 0,

    /**
     * Read page of a non-existing article
     */
    ReadNonExisting = 1,

    /**
     * Editing an existing page
     */
    Editor = 2,

    /**
     * Creating a new page
     */
    CreateEditor = 3,

    /**
     * Viewing the source of an article (cannot edit due to lack of permissions)
     */
    ViewOnlyEditor = 4,

    /**
     * Other type of page (e.g. Recent changes)
     */
    Other = 5
}

export type PageInfo = {
    isRedirect: boolean
    isTranslated: boolean
    latestRevisionId: number
    pageName: string
    pageType: PageType
    title: string
};

function getCurrentPageType(): PageType {
    const isArticle = getMwApi()
        .config
        .values
        .wgIsArticle;
    const action = getMwApi()
        .config
        .values
        .wgAction;

    switch (action) {
        case 'edit':
            const isEditable = getMwApi()
                .config
                .values
                .wgIsProbablyEditable;
            const editMessage = getMwApi()
                .config
                .values
                .wgEditMessage;

            if (editMessage === EditMessage.Creating) {
                return PageType.CreateEditor;
            }

            return isEditable
                ? PageType.Editor
                : PageType.ViewOnlyEditor;
        case 'view':
            const revisionId = getMwApi()
                .config
                .values
                .wgCurRevisionId;
            if (revisionId === 0) {
                return PageType.ReadNonExisting;
            }

            return isArticle
                ? PageType.Read
                : PageType.Other;
        default:
            return PageType.Other;
    }
}

export function getCurrentPageInfo(): PageInfo {
    const title = getMwApi()
        .config
        .values
        .wgTitle;
    const pageName = getMwApi()
        .config
        .values
        .wgPageName;
    const isRedirect = getMwApi()
        .config
        .values
        .wgIsRedirect;
    const revisionId = getMwApi()
        .config
        .values
        .wgCurRevisionId;

    return {
        isRedirect: isRedirect,
        isTranslated: isTranslated(title),
        latestRevisionId: revisionId,
        pageName: pageName,
        pageType: getCurrentPageType(),
        title: title
    };
}

/**
 * Stores the current page content in memory (and not in the ScriptDb).
 */
export function cacheCurrentPageContent(content: string) {
    cachedPageContent = content;
}

/**
 * Stores the CodeMirror editor instance
 * @param cmEditor The editor instance
 */
export function storeCodeMirrorInstance(cmEditor: CodeMirrorEditor) {
    codeMirrorInstance = cmEditor;
}

export async function getCurrentPageContent() {
    if (codeMirrorInstance == null && cachedPageContent != null) {
        console.debug(`getCurrentPageContent: cache hit`);
        return cachedPageContent;
    }
    else if (codeMirrorInstance != null) {
        return codeMirrorInstance.getValue();
    }

    const pageName = getMwApi()
        .config
        .values
        .wgPageName;

    const type = getCurrentPageType();
    switch (type) {
        case PageType.Editor:
        case PageType.CreateEditor:
        case PageType.ViewOnlyEditor:
            // TODO: Maybe do not rely on CodeMirror hook? Probably won't do much, the content is expected to be ready on doc load
            console.warn("cachedPageContent was null on edit page. You might be requesting the page content too soon.");
            return (await getPageContent(pageName)).content;
        case PageType.Read:
            return (await getPageContent(pageName)).content;
        case PageType.ReadNonExisting:
            return "";
        case PageType.Other:
            throw new Error("Cannot return content for page of 'Other' type");
    }
}

/**
 * Fetches the latest revision ID of the original English page
 */
export async function getEnglishRevisionId(): Promise<number|null> {
    const info = getCurrentPageInfo();
    if (!info.isTranslated) {
        throw new Error("The current page is not a translation");
    }

    const englishPageName = removeLanguagePostfix(info.pageName);
    if (englishPageName === info.pageName) {
        console.warn(`getEnglishRevisionId: Could not get the English for the ${info.pageName}`)
        return null;
    }

    const cachedInfo = await getCachedPageInfo(englishPageName);
    console.debug(`getEnglishRevisionId english name: ${englishPageName}`);

    if (cachedInfo != null) {
        console.debug('getEnglishRevisionId: cache hit');
        return cachedInfo.latestRevisionId;
    }

    // TODO
    return null;
}

export function pageNameToTitle(pageName: string){
    return pageName.replaceAll("_", "");
}

export function titleToPageName(title: string) {
    return title.replaceAll(" ", "_");
}