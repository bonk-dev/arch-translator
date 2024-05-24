/**
 * Fetches the latest revision page content (no caching)
 */
export const getPageContent = async (pageName: string) => {
    // In case someone passes in the title not the page name
    // (the page name has _ while the title has whitespace).
    pageName = pageName.replaceAll(" ", "_");

    const response = await fetch(`/index.php?title=${encodeURIComponent(pageName)}&action=raw`);
    return await response.text();
};

interface BasePage {
    ns: number
    title: string
    contentmodel: string
    pagelanguage: string
    pagelanguagehtmlcode: string
    pagelanguagedir: string
}

export interface MissingPage extends BasePage {
    missing: string
}

export interface RealPage extends BasePage {
    touched: string
    lastrevid: number
    lengtr: number
}

export interface RedirectPage extends RealPage {
    redirect: string
}

interface NormalizedInfo {
    from: string
    to: string
}

interface InterwikiLinkInfo {
    title: string
    iw: string
}

export interface InfoQueryResultKeyedObject {
    batchComplete: any
    query: {
        normalized?: NormalizedInfo[]
        pages: { [key: string]: (RealPage|RedirectPage) }
        interwiki: { [key: string]: InterwikiLinkInfo }
    }
}

export interface InfoQueryResultArray {
    batchComplete: any
    query: {
        normalized?: NormalizedInfo[]
        pages: (MissingPage|RealPage|RedirectPage)[]
    }
}

export interface LinkQueryLinkInfo {
    ns: number
    title: string
}

export interface LinkQueryPageInfo {
    pageid: number
    ns: number
    title: string
    links: LinkQueryLinkInfo[]
}

export interface LinkQueryResult {
    batchComplete: any
    query: {
        pages: { [key: string]: LinkQueryPageInfo }
    }
}

/**
 * Queries the API for the basic info about specified pages
 * @param titles
 */
export const getPageInfos = async (titles: string[]): Promise<InfoQueryResultKeyedObject | InfoQueryResultArray> => {
    const titleConcat = encodeURIComponent(titles.join('|'));

    // sometimes the API returns an array instead of an object, IDK why
    const response = await fetch(`/api.php?action=query&prop=info&titles=${titleConcat}&format=json`);
    if (!response.ok) {
        throw new Error("API request failed: " + response.statusText);
    }

    return await response.json();
};

/**
 * Queries the API for links in the specified pages' content
 * @param titles
 */
export const getPageLinks = async(titles: string[]): Promise<LinkQueryResult> => {
    const titleConcat = encodeURIComponent(titles.join('|'));

    // sometimes the API returns an array instead of an object, IDK why
    const response = await fetch(`/api.php?action=query&prop=links&titles=${titleConcat}&format=json`);
    if (!response.ok) {
        throw new Error("API request failed: " + response.statusText);
    }

    return await response.json();
}