import {InfoQueryResultArray, InfoQueryResultKeyedObject, LinkQueryResult} from "./MediaWikiApiTypes";

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