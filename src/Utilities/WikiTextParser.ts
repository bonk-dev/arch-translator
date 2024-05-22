import {isTranslated, validLangSubtags} from "../Internalization/I18nConstants";

enum WikiLinkType {
    Category = 'category',
    Header = 'header',
    Article = 'article'
}

export class WikiLink {
    private readonly _link: string
    private readonly _linkedHeader: string|null
    private readonly _alias: string|null
    private readonly _linkType: WikiLinkType

    public constructor(rawLink: string) {
        if (rawLink.startsWith("[[")) {
            rawLink = rawLink.substring(2);
        }
        if (rawLink.endsWith("]]")) {
            rawLink = rawLink.substring(0, rawLink.length - 2);
        }

        const split = rawLink.split('|');
        this._link = split[0];
        const headerSplit = this._link.split('#');
        if (headerSplit.length > 1) {
            this._link = headerSplit[0];
            this._linkedHeader = headerSplit[1];
        } else {
            this._linkedHeader = null;
        }

        this._alias = split.length > 1
            ? split[1]
            : null;

        if (split[0].startsWith(':')) {
            this._linkType = WikiLinkType.Category;
        } else if (split[0].startsWith('#')) {
            this._linkType = WikiLinkType.Header;
        } else {
            this._linkType = WikiLinkType.Article;
        }
    }

    public get link() {
        return this._link;
    }

    public get alias() {
        return this._alias;
    }

    public get linkType() {
        return this._linkType;
    }

    public get header() {
        return this._linkedHeader;
    }

    public get linkWithHeader() {
        const header = this.header != null
            ? `#${this.header}`
            : '';
        return this.link + header;
    }
}

enum LineParseResult {
    Redirect,
    MagicWord,
    Category,
    InterlanguageLink,
    Template,
    RelatedArticle,
    EndOfHeader,
    EmptyLine,
    ContentLine
}

export class WikiTextParser {
    private _redirects: string[] = [];
    private _magicWords: string[] = [];
    private _categories: string[] = [];
    private _interlanguageLinks: { [key: string]: string } = {};
    private _templates: string[] = [];
    private _relatedArticleElements: string[] = [];

    private _parsingContent: boolean = false;
    private _parseMagicWords: boolean = true;

    private _rawContentLines: string[] = [];
    private _links: WikiLink[] = [];

    public get headerText() {
        let sortedLinks = [];
        for (let langSubtag of Object.keys(this._interlanguageLinks).sort()) {
            sortedLinks.push(this._interlanguageLinks[langSubtag]);
        }

        // This follows https://wiki.archlinux.org/title/Help:Style#Layout
        const finalArray = [
            ...this._redirects, ...this._magicWords, ...this._categories,
            ...sortedLinks, ...this._templates, ...this._relatedArticleElements
        ];

        return finalArray.join('\n') + '\n';
    }

    public get pageBodyText() {
        return this._rawContentLines.join('\n');
    }

    public get pageContent() {
        return this.headerText + this.pageBodyText;
    }

    public parse(wikiTextContent: string) {
        const lines = wikiTextContent.split('\n');
        for (let line of lines) {
            this.parseLine(line);
        }
    }

    public parseLine(line: string): LineParseResult {
        if (!this._parsingContent) {
            const headerResult = this._parseHeaderLine(line);
            if (headerResult === LineParseResult.EndOfHeader || headerResult === LineParseResult.Redirect) {
                this._parsingContent = true;
            }

            return headerResult;
        }
        else {
            return this._parseContentLine(line);
        }
    }

    public get localizableLinks() {
        return [
            ...this._links
                .filter(l => !isTranslated(l.link)
                    && (l.linkType === WikiLinkType.Category
                        || l.linkType === WikiLinkType.Article))
                .map(l => l.link)
        ]
    }

    private _parseHeaderLine(line: string): LineParseResult {
        const isBlank = (str: string) => {
            return (!str || /^\s*$/.test(str));
        }

        if (isBlank(line)) {
            return LineParseResult.EmptyLine;
        }

        if (line.startsWith("#REDIRECT")) {
            this._redirects.push(line);
            this._log("Found redirect: " + line);
            return LineParseResult.Redirect;
        }

        // Check if line is an interlanguage link
        for (let subtag of validLangSubtags) {
            if (line.startsWith(`[[${subtag}:`)) {
                this.addInterlanguageLink(line, subtag);
                this._parseMagicWords = false;

                return LineParseResult.InterlanguageLink;
            }
        }

        if (line.startsWith("[[Category")) {
            this._addCategory(line);
            this._parseMagicWords = false;

            return LineParseResult.Category;
        }
        else if (line.startsWith("{{Related")) {
            this._addRelatedArticleElement(line);

            return LineParseResult.RelatedArticle;
        }
        else if (line.startsWith("{{") || line.startsWith("__")) {
            if (this._parseMagicWords) {
                this._addMagicWord(line);
                return LineParseResult.MagicWord;
            }
            else {
                this.addTemplate(line);
                return LineParseResult.Template;
            }
        }
        else {
            this._rawContentLines.push(line);
            return LineParseResult.EndOfHeader;
        }
    }

    addInterlanguageLink(line: string, subtag: string) {
        this._interlanguageLinks[subtag] = line;
    }

    private _addCategory(line: string) {
        this._categories.push(line);
    }

    private _addMagicWord(line: string) {
        this._magicWords.push(line);
    }

    addTemplate(line: string) {
        this._templates.push(line);
    }

    private _addRelatedArticleElement(line: string) {
        this._relatedArticleElements.push(line);
    }

    private _parseContentLine(line: string): LineParseResult {
        this._rawContentLines.push(line);

        // Match: [[text - cant contain square brackets]]
        // Skips Wikipedia links
        for (let match of line.matchAll(/\[\[(?!Wikipedia)(?!w)(?!mw)([^\[\]]*)]]/ig)) {
            // TODO: Support subpages (e.g. dm-crypt/Device encryption)

            const link = new WikiLink(match[1]);
            this._links.push(link);
        }

        return LineParseResult.ContentLine;
    }

    private _log(msg: string) {
        console.debug(`WikiTextParser: ${msg}`);
    }
}

/**
 * Extract the redirect target from the wikitext content
 * @param wikiText The page content, in wikitext format
 * @return string|null Redirect target page name or null if the content is not a redirect page
 */
export const findRedirect = (wikiText: string): WikiLink|null => {
    if (!wikiText.startsWith("#REDIRECT")) {
        return null;
    }

    const linkText = wikiText
        .substring("#REDIRECT ".length)
        .trim();
    return new WikiLink(linkText);
};