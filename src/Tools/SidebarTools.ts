import {CustomSidebarTool, sideTool} from "./Utils/ToolManager";
import {getMwApi} from "../Utilities/MediaWikiApi";
import {getCurrentPageInfo, getEnglishRevisionId, PageInfo} from "../Utilities/PageUtils";
import {getCurrentLanguage} from "../Storage/ScriptDb";

export const copyCurrentRevisionIdTool = (): CustomSidebarTool => {
    const toolHandler = async () => {
        const revisionId = getMwApi()
            .config
            .values
            .wgCurRevisionId;

        await window.navigator.clipboard.writeText(revisionId.toString());
    };

    return sideTool({
        name: "copy-current-revision-id",
        displayText: "Copy revision ID",
        handler: toolHandler
    });
};

export const copyEnglishRevisionIdTool = (): CustomSidebarTool => {
    const handler = async () => {
        const englishRevisionId = await getEnglishRevisionId();
        console.debug('English revision id: ' + englishRevisionId);

        await window.navigator.clipboard.writeText(englishRevisionId?.toString() ?? 'null');
    };

    const showCallback = (info: PageInfo): boolean => {
        if (!info.isTranslated) {
            console.debug("Hiding copy English revision ID tool because current page is not a translation");
            return false;
        }

        return true;
    };

    return sideTool({
        name: "copy-english-revision-id",
        displayText: "Copy latest English revision ID",
        handler: handler,
        showCallback: showCallback
    });
};

export const createTranslationTool = (): CustomSidebarTool => {
    const handler = async () => {
        const pageInfo = getCurrentPageInfo();
        const currentLang = await getCurrentLanguage();
        const translationPageName = `${pageInfo.pageName}_(${currentLang.localizedName})`;
        const target = `/index.php?title=${encodeURIComponent(translationPageName)}&action=edit`;

        console.debug(`createTranslationTool: navigating to ${target}`);
        window.location.assign(target);
    };

    const showCallback = (info: PageInfo): boolean => {
        if (info.isTranslated) {
            console.debug("Hiding create translation tool because current page is already a translation");
            return false;
        }

        return true;
    };

    return sideTool({
        name: "create-translation",
        displayText: "Translate this page",
        handler: handler,
        showCallback: showCallback
    });
};

export const allSidebarTools = [
    copyCurrentRevisionIdTool(), copyEnglishRevisionIdTool(), createTranslationTool()
];