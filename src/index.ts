import {GenericLoadStep, InjectionManager} from "./Injection/InjectionManager";
import {getMwApi} from "./Utilities/MediaWikiJsApi";
import {ToolManager} from "./Tools/Utils/ToolManager";
import {allSidebarTools} from "./Tools/SidebarTools";
import {getCachedPageInfo, getCurrentLanguage, setCachedPageInfo, setupDb} from "./Storage/ScriptDb";
import {cacheCurrentPageContent, getCurrentPageContent, getCurrentPageInfo, PageType} from "./Utilities/PageUtils";
import {cacheCurrentPage} from "./Tools/CurrentPageDumper";
import {CodeMirrorEditor} from "./Utilities/CodeMirrorTypes";
import {NewArticleWorker} from "./Tools/Workers/NewArticleWorker";
import {WikiTextParser} from "./Utilities/WikiTextParser";
import {getPageContent} from "./Utilities/Api/MediaWikiApiClient";
import {removeLanguagePostfix} from "./Internalization/I18nConstants";
import {TranslatedArticlesWorker} from "./Tools/Workers/TranslatedArticlesWorker";
import {addTranslatedArticlesUi, addWorkerResultToUi} from "./Tools/TranslatedArticlesUi";
import {injectCssCode} from "./Utilities/CssInjector";
// @ts-ignore
import tableCss from './Styles/WikiTable.css';
// @ts-ignore
import commonCss from './Styles/Common.css';
import {CachedPageInfoType} from "./Storage/ScriptDbModels";

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
            injectCssCode(commonCss);
            injectCssCode(tableCss);
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
                    const info = getCurrentPageInfo();
                    if (!info.isTranslated) return;

                    addTranslatedArticlesUi(form);

                    const englishName = removeLanguagePostfix(info.pageName);
                    const englishContent = await getPageContent(englishName);
                    await setCachedPageInfo({
                        pageName: englishName,
                        type: CachedPageInfoType.English,
                        latestRevisionId: englishContent.revisionId
                    });

                    const contentToParse = pageInfo.pageType === PageType.CreateEditor
                        ? englishContent.content
                        : cmEditor.getValue();

                    const parser = new WikiTextParser();
                    parser.parse(contentToParse);

                    const newTranslationWorker = new NewArticleWorker(
                        pageInfo,
                        await getCurrentLanguage(),
                        englishContent.revisionId);
                    const translatedArticleWorker = new TranslatedArticlesWorker(pageInfo);
                    translatedArticleWorker.run(parser)
                        .then(r => {
                            console.debug(r);
                            console.debug('Translated articles worker done');

                            addWorkerResultToUi(r);
                        });

                    if (pageInfo.pageType === PageType.CreateEditor) {
                        newTranslationWorker.run(parser);

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