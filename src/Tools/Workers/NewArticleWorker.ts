import {PageInfo, PageType} from "../../Utilities/PageUtils";
import {getPageContent} from "../../Utilities/MediaWikiClient";
import {removeLanguagePostfix} from "../../Internalization/I18nConstants";
import {CodeMirrorEditor} from "../../Utilities/CodeMirrorTypes";

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
        this._codeMirror.setValue(content);
    }
}