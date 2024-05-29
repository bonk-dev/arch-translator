import {PageInfo, PageType, titleToPageName} from "../../Utilities/PageUtils";
import {findRedirect, WikiTextParser} from "../../Utilities/WikiTextParser";
import {getCurrentLanguage} from "../../Storage/ScriptDb";
import {isTranslated, LanguageInfo, removeLanguagePostfix} from "../../Internalization/I18nConstants";
import {
    getPageContent,
    getPageInfos, getPageLinks
} from "../../Utilities/Api/MediaWikiApiClient";
import {InfoQueryResultArray, InfoQueryResultKeyedObject} from "../../Utilities/Api/MediaWikiApiTypes";

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

export type RedirectResult = {
    /**
     * The original English link
     */
    link: string

    /**
     * The English redirect target
     */
    redirectsTo: string

    /**
     * redirectsTo value with added language postfix
     */
    localizedRedirectTarget: string

    /**
     * Whether the localizedRedirectTarget page exists
     */
    exists: boolean
};

export type TranslatedArticlesResult = {
    existing: string[]
    notExisting: string[]
    redirects: RedirectResult[]
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

    async run(parser: WikiTextParser): Promise<TranslatedArticlesResult> {
        if (!this.willRun()) {
            return {
                existing: [],
                notExisting: [],
                redirects: []
            };
        }

        const language = await getCurrentLanguage();
        const linksWithPostfixes = parser
            .localizableLinks
            .map(l => localizeLink(l, language));
        const info = await this._getPageInfosFor(linksWithPostfixes);
        console.debug(info.filter(i => i.exists));

        const possibleRedirects = info
            .filter(r => !r.exists)
            .map(r => removeLanguagePostfix(r.link));
        const redirectsAndOther = await this._findRedirects(possibleRedirects);
        console.debug(redirectsAndOther.filter(r => r.redirects));

        // TODO: Handle weird redirects instead of ignoring them
        const actualRedirects = redirectsAndOther
            .filter(r => r.redirects && !isTranslated(r.redirectsTo!))
            .map(r => localizeLink(r.redirectsTo!, language));
        const redirectResults = actualRedirects.length > 0
            ? await this._getPageInfosFor(actualRedirects)
            : [];
        console.debug(redirectResults);

        const findRedirectSource = (localizedLink: string): string => {
            const englishLink = removeLanguagePostfix(localizedLink);
            if (englishLink === localizedLink) return localizedLink;

            const original = redirectsAndOther.find(r => r.redirectsTo === englishLink)!;
            return original.link!;
        };

        return {
            existing: info
                .filter(i => i.exists)
                .map(r => r.link),
            redirects: redirectResults.map(r => {
                return {
                    link: findRedirectSource(r.link),
                    redirectsTo: removeLanguagePostfix(r.link),
                    localizedRedirectTarget: r.link,
                    exists: r.exists
                }
            }),
            notExisting: redirectsAndOther
                .filter(r => !r.redirects)
                .map(r => localizeLink(r.link, language))
        };
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

        const data: LinkScanResult[] = [];
        const keyedApiData = apiData as InfoQueryResultKeyedObject;

        if ("pages" in keyedApiData.query) {
            const pageValues = Object.values(keyedApiData.query.pages);
            data.push(...pageValues.map(pageInfo => {
                return {
                    link: pageInfo.title,
                    exists: !("missing" in pageInfo)
                };
            }))
        }
        if ("interwiki" in keyedApiData.query) {
            const interwikiValues = Object.values(keyedApiData.query.interwiki);
            data.push(...interwikiValues.map(iwInfo => {
                return {
                    link: iwInfo.title,
                    exists: false // Just assume it does not exist TODO: for now
                };
            }))
        }

        return data;
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
                    redirectsTo: "links" in l ? l.links[0].title : null
                };
            });
        for (const info of redirectsInfo) {
            if (info.redirectsTo == null) {
                console.warn(`API returned no links for the redirect "${info.link}". Fixing...`);
                const content = await getPageContent(titleToPageName(info.link));
                console.debug(content);

                const redirectLink = findRedirect(content.content);
                if (redirectLink == null) {
                    throw new Error(`Could not get redirect target for link ${info.link}`);
                }

                info.redirectsTo = redirectLink.link;
            }
        }

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