import {GenericLoadStep, InjectionManager} from "./Injection/InjectionManager";
import {getMwApi} from "./Utilities/MediaWikiApi";
import {ToolManager} from "./Tools/Utils/ToolManager";
import {allSidebarTools} from "./Tools/SidebarTools";
import {getCachedPageInfo, setCachedPageInfo, setupDb} from "./Storage/ScriptDb";
import {cacheCurrentPageContent, getCurrentPageContent, getCurrentPageInfo, PageType} from "./Utilities/PageUtils";
import {cacheCurrentPage} from "./Tools/CurrentPageDumper";
import {CodeMirrorEditor} from "./Utilities/CodeMirrorTypes";
import {NewArticleWorker} from "./Tools/Workers/NewArticleWorker";
import {WikiTextParser} from "./Utilities/WikiTextParser";
import {getPageContent} from "./Utilities/MediaWikiClient";
import {removeLanguagePostfix} from "./Internalization/I18nConstants";
import {TranslatedArticlesWorker} from "./Tools/Workers/TranslatedArticlesWorker";
import {addTranslatedArticlesUi, addWorkerResultToUi} from "./Tools/TranslatedArticlesUi";

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
        manager.onEditForm(async (form) => {
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
                if (pageInfo.pageType === PageType.CreateEditor || pageInfo.pageType === PageType.Editor) {
                    addTranslatedArticlesUi(form);

                    const info = getCurrentPageInfo();
                    const englishContent = await getPageContent(removeLanguagePostfix(info.pageName));
                    const parser = new WikiTextParser();
                    parser.parse(englishContent);

                    const newTranslationWorker = new NewArticleWorker(pageInfo);
                    const translatedArticleWorker = new TranslatedArticlesWorker(pageInfo);
                    translatedArticleWorker.run(parser)
                        .then(r => {
                            console.debug(r);
                            console.debug('Translated articles worker done');

                            addWorkerResultToUi(r);
                        });

                    if (pageInfo.pageType === PageType.CreateEditor) {
                        // no need to await translatedArticleWorker.run(...), it does not make any changes to the parser
                        const workerPromises = [
                            newTranslationWorker.run(parser)
                        ];

                        await Promise.all(workerPromises);
                        const newContent = parser.pageContent;
                        cacheCurrentPageContent(newContent);
                        cmEditor.setValue(newContent);
                    }
                }
            }
        });

        manager.startAgents();
    })
    .catch(e => {
        console.debug('ArchTranslator: an error has occurred while setting up the database');
        console.error(e);
    });