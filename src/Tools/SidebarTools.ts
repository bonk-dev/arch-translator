import {CustomSidebarTool, sideTool} from "./Utils/ToolManager";
import {getMwApi} from "../Utilities/MediaWikiApi";
import {getEnglishRevisionId, PageInfo} from "../Utilities/PageUtils";

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

export const allSidebarTools = [
    copyCurrentRevisionIdTool(), copyEnglishRevisionIdTool()
];