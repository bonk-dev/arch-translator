import {getEnglishRevisionId, PageInfo, pageNameToTitle, PageType} from "../../Utilities/PageUtils";
import {getPageContent} from "../../Utilities/MediaWikiClient";
import {removeLanguagePostfix} from "../../Internalization/I18nConstants";
import {CodeMirrorEditor} from "../../Utilities/CodeMirrorTypes";
import {WikiTextParser} from "../../Utilities/WikiTextParser";
import {buildTranslationStatusTemplate} from "../../Utilities/TemplateUtils";
import {getCurrentLanguage} from "../../Storage/ScriptDb";

export class NewArticleWorker {
    private _info: PageInfo;
    private _codeMirror: CodeMirrorEditor;

    constructor(pageInfo: PageInfo, codeMirror: CodeMirrorEditor) {
        this._info = pageInfo;
        this._codeMirror = codeMirror;
    }

    willRun() {
        return this._info.pageType === PageType.CreateEditor && this._info.isTranslated;
    }

    async run(){
        if (!this.willRun()) return;
        console.debug('NewArticleWorker: running');

        const englishName = removeLanguagePostfix(this._info.pageName);
        console.debug(`NewArticleWorker: fetching content of ${englishName}`);

        const content = await getPageContent(englishName);
        const parser = new WikiTextParser();
        parser.parse(content);

        const englishTitle = pageNameToTitle(englishName);
        parser.addInterlanguageLink(`[[en:${englishTitle}]]`, 'en');

        const currentLanguage = await getCurrentLanguage();
        const englishRevisionId = await getEnglishRevisionId();
        if (englishRevisionId) {
            console.warn('NewArticleWorker: englishRevisionId was null');
        }

        const translationStatus = buildTranslationStatusTemplate(
            englishName,
            new Date(),
            englishRevisionId ?? 0,
            currentLanguage);
        parser.addTemplate(translationStatus);

        this._codeMirror.setValue(parser.pageContent);
    }
}