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

    constructor(rawLink: string) {
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

    get link() {
        return this._link;
    }

    get alias() {
        return this._alias;
    }

    get linkType() {
        return this._linkType;
    }

    get header() {
        return this._linkedHeader;
    }

    get linkWithHeader() {
        const header = this.header != null
            ? `#${this.header}`
            : '';
        return this.link + header;
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