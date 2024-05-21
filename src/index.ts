import {GenericLoadStep, InjectionManager} from "./Injection/InjectionManager";
import {getMwApi} from "./Utilities/MediaWikiApi";
import {ToolManager} from "./Tools/Utils/ToolManager";
import {allSidebarTools} from "./Tools/RevisionTools";


// @ts-ignore
globalThis.getMwApi = getMwApi;

const manager = new InjectionManager();
manager.on(GenericLoadStep.DocumentLoad, () => {
    console.debug('Document loaded');

    for (const tool of allSidebarTools) {
        ToolManager.instance.addSidebarTool(tool);
    }
    ToolManager.instance.addSidebarToPage();
});
manager.on(GenericLoadStep.MediaWikiStartup, () => {
    const api = getMwApi();
    console.debug(api.config.values.wgTitle);
});
manager.onEditForm((form) => {
    console.debug('form hook');
});

manager.startAgents();