import {CustomSidebarTool, sideTool} from "./Utils/ToolManager";
import {getMwApi} from "../Utilities/MediaWikiApi";

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

export const allSidebarTools = [
    copyCurrentRevisionIdTool()
];