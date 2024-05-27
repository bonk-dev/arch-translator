import {PageInfo, pageNameToTitle, PageType} from "../../Utilities/PageUtils";
import {LanguageInfo, removeLanguagePostfix} from "../../Internalization/I18nConstants";
import {WikiTextParser} from "../../Utilities/WikiTextParser";
import {buildTranslationStatusTemplate} from "../../Utilities/TemplateUtils";

export class NewArticleWorker {
    private readonly _info: PageInfo;
    private readonly _language: LanguageInfo;
    private readonly _englishRevisionId: number;

    constructor(pageInfo: PageInfo, language: LanguageInfo, englishRevisionId: number) {
        this._info = pageInfo;
        this._language = language;
        this._englishRevisionId = englishRevisionId ?? 0;
    }

    willRun() {
        return this._info.pageType === PageType.CreateEditor && this._info.isTranslated;
    }

    run(parser: WikiTextParser){
        if (!this.willRun()) return;
        console.debug('NewArticleWorker: running');

        const englishName = removeLanguagePostfix(this._info.pageName);
        console.debug(`NewArticleWorker: fetching content of ${englishName}`);

        const englishTitle = pageNameToTitle(englishName);
        parser.addInterlanguageLink(`[[en:${englishTitle}]]`, 'en');

        const translationStatus = buildTranslationStatusTemplate(
            englishName,
            new Date(),
            this._englishRevisionId,
            this._language);
        parser.addTemplate(translationStatus);
    }
}