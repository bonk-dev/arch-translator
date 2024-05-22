import {GenericLoadStep, InjectionManager} from "./Injection/InjectionManager";
import {getMwApi} from "./Utilities/MediaWikiApi";
import {ToolManager} from "./Tools/Utils/ToolManager";
import {allSidebarTools} from "./Tools/RevisionTools";
import {getCachedPageInfo, setCachedPageInfo, setupDb} from "./Storage/ScriptDb";
import {cacheCurrentPageContent, getCurrentPageContent, getCurrentPageInfo} from "./Utilities/PageUtils";
import {cacheCurrentPage} from "./Tools/CurrentPageDumper";

// @ts-ignore
globalThis.getMwApi = getMwApi;

// @ts-ignore
globalThis.getId = getCachedPageInfo;
// @ts-ignore
globalThis.setId = setCachedPageInfo;

// @ts-ignore
globalThis.getContent = getCurrentPageContent;

setupDb()
    .then(() => {
        console.debug('ArchTranslator: setupDb successful');

        const manager = new InjectionManager();
        manager.on(GenericLoadStep.DocumentLoad, () => {
            console.debug('Document loaded');

            // TODO: Sync up with MediaWikiStartup
            const pageInfo = getCurrentPageInfo();
            for (const tool of allSidebarTools) {
                ToolManager.instance.addSidebarTool(tool, pageInfo);
            }
            ToolManager.instance.addSidebarToPage();
        });
        manager.on(GenericLoadStep.MediaWikiStartup, () => {
            const api = getMwApi();
            console.debug(api.config.values.wgTitle);

            cacheCurrentPage()
                .then(() => {
                    console.debug('index (MediaWikiStartup): cached current page');
                });
        });
        manager.onEditForm((form) => {
            console.debug('editform hook');

            const codeMirror = form.find('.CodeMirror');
            if (codeMirror.length > 0) {
                console.debug('CodeMirror found');
                // @ts-ignore
                cacheCurrentPageContent(codeMirror.get()[0].CodeMirror.getValue());
            }
        });

        manager.startAgents();
    })
    .catch(e => {
        console.debug('ArchTranslator: an error has occurred while setting up the database');
        console.error(e);
    });