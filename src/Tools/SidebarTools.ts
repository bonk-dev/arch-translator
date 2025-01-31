import {CustomSidebarTool, sideTool} from "./Utils/ToolManager";
import {getMwApi} from "../Utilities/MediaWikiJsApi";
import {
    getCurrentPageContent,
    getCurrentPageInfo,
    getEnglishRevisionId,
    PageInfo,
    PageType
} from "../Utilities/PageUtils";
import {getCurrentLanguage, setCurrentLanguage} from "../Storage/ScriptDb";
import {getLangInfoFor, LanguagesInfo} from "../Internalization/I18nConstants";
import {TranslatedArticlesWorker} from "./Workers/TranslatedArticlesWorker";
import {addWorkerResultToUi} from "./TranslatedArticlesUi";
import {WikiTextParser} from "../Utilities/WikiTextParser";

export const copyCurrentRevisionIdTool = (): CustomSidebarTool => {
    const showCallback = (info: PageInfo) => {
        return info.pageType !== PageType.CreateEditor && info.pageType !== PageType.ReadNonExisting;
    };

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
        handler: toolHandler,
        showCallback: showCallback
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

export const changeActiveLanguageTool = (): CustomSidebarTool => {
    let anchorElement: HTMLAnchorElement | null = null;
    let select: HTMLSelectElement | null = null;

    const saveLanguage = async() => {
        if (select == null) {
            throw new Error("Tried to save the language when the UI was not yet created");
        }

        const newLanguage = getLangInfoFor(select.value);
        await setCurrentLanguage(newLanguage);

        alert(`The Arch Translator active language was changed to ${newLanguage.localizedName}. Please refresh the page.`);

        select.parentElement!.classList.add('hidden');
    };

    const createChangeUi = async () => {
        const parent = document.createElement('div');
        parent.classList.add('hidden');

        const selectElement = document.createElement('select');
        for (const [langKey, langInfo] of Object.entries(LanguagesInfo)) {
            const option = document.createElement('option');
            option.value = langKey;
            option.innerText = langInfo.localizedName;
            selectElement.appendChild(option);
        }
        selectElement.onchange = saveLanguage;

        const currentLang = await getCurrentLanguage();
        selectElement.value = currentLang.key;

        select = selectElement;
        parent.appendChild(selectElement);

        return parent;
    };

    const handler = async () => {
        if (anchorElement == null) {
            anchorElement = document.getElementById('t-at-change-language')! as HTMLAnchorElement;
        }

        if (select == null) {
            const changeUi = await createChangeUi();
            anchorElement.after(changeUi);
        }

        select!.parentElement!.classList.toggle('hidden');
    };

    return sideTool({
        name: "change-language",
        displayText: "Change active language",
        handler: handler
    });
};

export const refreshTranslatedArticles = (): CustomSidebarTool => {
    const handler = async () => {
        console.debug('Rerunning translated articles worker');

        const pageInfo = getCurrentPageInfo();
        const contentToParse = await getCurrentPageContent();

        const parser = new WikiTextParser();
        parser.parse(contentToParse);

        const translatedArticleWorker = new TranslatedArticlesWorker(pageInfo);
        translatedArticleWorker.run(parser)
            .then(r => {
                console.debug(r);
                console.debug('Translated articles worker done');

                addWorkerResultToUi(r);
            });
    };

    return sideTool({
       name: "refresh-translated-articles",
       displayText: "Refresh translated articles",
       handler: handler
    });
};

export const allSidebarTools = [
    changeActiveLanguageTool(), copyCurrentRevisionIdTool(), copyEnglishRevisionIdTool(), createTranslationTool(),
    refreshTranslatedArticles()
];