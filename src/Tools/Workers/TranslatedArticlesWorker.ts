import {PageInfo, PageType} from "../../Utilities/PageUtils";
import {WikiTextParser} from "../../Utilities/WikiTextParser";
import {getCurrentLanguage} from "../../Storage/ScriptDb";
import {LanguageInfo, removeLanguagePostfix} from "../../Internalization/I18nConstants";
import {
    getPageInfos, getPageLinks,
    InfoQueryResultArray,
    InfoQueryResultKeyedObject
} from "../../Utilities/MediaWikiClient";

type LinkScanResult = {
    link: string
    exists: boolean
};

type RedirectScanResult = { link: string, redirects: boolean, redirectsTo?: string };

const localizeLink = (link: string, lang: LanguageInfo): string => {
    const subPageSplit = link.split('/');
    const prefix = ` (${lang.localizedName})`;
    if (subPageSplit.length < 2) {
        return link + prefix;
    }

    return subPageSplit
        .map(s => s + prefix)
        .join('/');
};

export class TranslatedArticlesWorker {
    private _info: PageInfo;

    constructor(pageInfo: PageInfo) {
        this._info = pageInfo;
    }

    willRun() {
        return (this._info.pageType === PageType.CreateEditor || this._info.pageType === PageType.Editor)
            && this._info.isTranslated;
    }

    async run(parser: WikiTextParser){
        if (!this.willRun()) return;

        const language = await getCurrentLanguage();
        const linksWithPostfixes = parser
            .localizableLinks
            .map(l => localizeLink(l, language));
        const info = await this._getPageInfosFor(linksWithPostfixes);
        console.debug(info.filter(i => i.exists));

        const possibleRedirects = info
            .filter(r => !r.exists)
            .map(r => removeLanguagePostfix(r.link));
        const redirectsAndOthers = await this._findRedirects(possibleRedirects);
        console.debug(redirectsAndOthers);
    }

    private async _getPageInfosFor(links: string[]): Promise<LinkScanResult[]> {
        const apiData = await getPageInfos(links);
        if (Array.isArray(typeof apiData.query.pages)) {
            return (apiData as InfoQueryResultArray).query.pages.map(p => {
                return {
                    link: p.title,
                    exists: "missing" in p
                };
            });
        }

        const keyedApiData = apiData as InfoQueryResultKeyedObject;
        return Object.values(keyedApiData.query.pages)
            .map(pageInfo => {
                return {
                    link: pageInfo.title,
                    exists: !("missing" in pageInfo)
                };
            });
    }

    private async _findRedirects(links: string[]): Promise<RedirectScanResult[]> {
        const apiData = await getPageInfos(links);
        const redirects: string[] = [];

        if (Array.isArray(typeof apiData.query.pages)) {
            (apiData as InfoQueryResultArray).query.pages.forEach(p => {
                if ("redirect" in p) {
                    redirects.push(p.title);
                }
            });
        }
        else {
            const keyedApiData = apiData as InfoQueryResultKeyedObject;
            Object.values(keyedApiData.query.pages)
                .forEach(p => {
                    if ("redirect" in p) {
                        redirects.push(p.title);
                    }
                });
        }

        if (redirects.length <= 0) {
            return [];
        }

        const linksApiData = await getPageLinks(redirects);
        const redirectsInfo = Object.values(linksApiData.query.pages)
            .map(l => {
                return {
                    link: l.title,
                    redirects: true,
                    redirectsTo: l.links[0].title
                };
            });
        const nonRedirectsInfo = links
            .filter(l => !redirects.includes(l))
            .map(l => {
                return {
                    link: l,
                    redirects: false
                };
            })
        return [...redirectsInfo, ...nonRedirectsInfo];
    }
}