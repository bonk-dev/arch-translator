import {GenericLoadStep, InjectionManager} from "./Injection/InjectionManager";
import {getMwApi} from "./Utilities/MediaWikiApi";
import {ToolManager} from "./Tools/Utils/ToolManager";
import {allSidebarTools} from "./Tools/SidebarTools";
import {getCachedPageInfo, setCachedPageInfo, setupDb} from "./Storage/ScriptDb";
import {cacheCurrentPageContent, getCurrentPageContent, getCurrentPageInfo, PageType} from "./Utilities/PageUtils";
import {cacheCurrentPage} from "./Tools/CurrentPageDumper";
import {CodeMirrorEditor} from "./Utilities/CodeMirrorTypes";
import {NewArticleWorker} from "./Tools/Workers/NewArticleWorker";

// @ts-ignore
globalThis.getMwApi = getMwApi;

// @ts-ignore
globalThis.getId = getCachedPageInfo;
// @ts-ignore
globalThis.setId = setCachedPageInfo;

// @ts-ignore
globalThis.getContent = getCurrentPageContent;

// wikieditor.editform can run multiple times
let runEditHook = true;

setupDb()
    .then(() => {
        console.debug('ArchTranslator: setupDb successful');

        const manager = new InjectionManager();
        manager.on(GenericLoadStep.DocumentLoad, () => {
            console.debug('Document loaded');
        });
        manager.on(GenericLoadStep.MediaWikiStartup, () => {
            const api = getMwApi();
            console.debug(api.config.values.wgTitle);

            cacheCurrentPage()
                .then(() => {
                    console.debug('index (MediaWikiStartup): cached current page');
                });

            const pageInfo = getCurrentPageInfo();
            for (const tool of allSidebarTools) {
                ToolManager.instance.addSidebarTool(tool, pageInfo);
            }
            ToolManager.instance.addSidebarToPage();
        });
        manager.onEditForm((form) => {
            if (!runEditHook) return;

            console.debug('editform hook');

            const codeMirrorElement = form.find('.CodeMirror');
            if (codeMirrorElement.length > 0) {
                console.debug('CodeMirror found');
                runEditHook = false;

                // @ts-ignore
                const cmEditor = codeMirrorElement.get()[0].CodeMirror as CodeMirrorEditor;
                cacheCurrentPageContent(cmEditor.getValue());

                const pageInfo = getCurrentPageInfo();
                if (pageInfo.pageType === PageType.CreateEditor) {
                    const newTranslationWorker = new NewArticleWorker(pageInfo, cmEditor);
                    newTranslationWorker.run()
                        .then(() => console.debug("index: NewArticleWorker done"));
                }
            }
        });

        manager.startAgents();
    })
    .catch(e => {
        console.debug('ArchTranslator: an error has occurred while setting up the database');
        console.error(e);
    });