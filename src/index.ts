import {GenericLoadStep, InjectionManager} from "./Injection/InjectionManager";
import {getMwApi} from "./Utilities/MediaWikiJsApi";
import {ToolManager} from "./Tools/Utils/ToolManager";
import {allSidebarTools} from "./Tools/SidebarTools";
import {getCachedPageInfo, getCurrentLanguage, setCachedPageInfo, setupDb} from "./Storage/ScriptDb";
import {
    cacheCurrentPageContent,
    getCurrentPageContent,
    getCurrentPageInfo,
    PageType,
    storeCodeMirrorInstance
} from "./Utilities/PageUtils";
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

let editFormJQuery: JQuery<HTMLElement> | null = null;
let codeMirrorFound = false;

const initAfterCodeMirror = async (cmEditor: CodeMirrorEditor) => {
    storeCodeMirrorInstance(cmEditor);
    codeMirrorFound = true;
    cacheCurrentPageContent(cmEditor.getValue());

    if (editFormJQuery == null) {
        // TODO: Try to find
        throw new Error("editForm was null");
    }

    const pageInfo = getCurrentPageInfo();
    if (pageInfo.pageType === PageType.CreateEditor || pageInfo.pageType === PageType.Editor) {
        const info = getCurrentPageInfo();
        if (!info.isTranslated) return;

        addTranslatedArticlesUi(editFormJQuery);

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
};

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
        manager.on(GenericLoadStep.ExtCodeMirrorSwitch, async () => {
            if (codeMirrorFound) {
                return;
            }

            const cmElement = $(".CodeMirror");
            if (cmElement != null) {
                // @ts-ignore
                const cmEditor = cmElement.get()[0].CodeMirror as CodeMirrorEditor;
                if (cmEditor == null) {
                    console.error("Found .CodeMirror during the ExtCodeMirrorSwitch hook, but the JS editor instance was null");
                }
                else {
                    console.debug("Found CodeMirror instance");
                    await initAfterCodeMirror(cmEditor);
                }
            }
            else {
                console.error("Could not find .CodeMirror during the ExtCodeMirrorSwitch hook");
            }
        });
        manager.onEditForm(async (form) => {
            if (!runEditHook || codeMirrorFound) return;

            console.debug('editform hook');
            if (editFormJQuery == null) {
                console.debug('editForm found');
                editFormJQuery = form;
            }

            const codeMirrorElement = form.find('.CodeMirror');
            if (!codeMirrorFound && codeMirrorElement.length > 0) {
                console.debug('CodeMirror found (editForm hook)');
                runEditHook = false;

                // @ts-ignore
                const cmEditor = codeMirrorElement.get()[0].CodeMirror as CodeMirrorEditor;
                await initAfterCodeMirror(cmEditor);
            }
        });

        manager.startAgents();
    })
    .catch(e => {
        console.debug('ArchTranslator: an error has occurred while setting up the database');
        console.error(e);
    });