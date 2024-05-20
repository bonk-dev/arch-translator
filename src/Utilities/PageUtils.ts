import {EditMessage, getMwApi} from "./MediaWikiApi";
import {isTranslated} from "../Internalization/I18nConstants";

enum PageType {
    /**
     * Normal article read page
     */
    Read = 0,

    /**
     * Editing an existing page
     */
    Editor = 1,

    /**
     * Creating a new page
     */
    CreateEditor = 2,

    /**
     * Viewing the source of an article (cannot edit due to lack of permissions)
     */
    ViewOnlyEditor = 3,

    /**
     * Other type of page (e.g. Recent changes)
     */
    Other = 4
}

type PageInfo = {
    isTranslated: boolean
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

    return {
        isTranslated: isTranslated(title),
        pageName: pageName,
        pageType: getCurrentPageType(),
        title: title
    };
}