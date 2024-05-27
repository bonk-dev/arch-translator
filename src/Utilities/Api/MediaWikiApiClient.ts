import {
    GetPageContentResult,
    InfoQueryResultArray,
    InfoQueryResultKeyedObject,
    LinkQueryResult, RevisionQueryResult
} from "./MediaWikiApiTypes";
import {titleToPageName} from "../PageUtils";

/**
 * Fetches the latest revision page content (no caching)
 */
export const getPageContent = async (pageName: string): Promise<GetPageContentResult> => {
    // In case someone passes in the title not the page name
    // (the page name has _ while the title has whitespace).
    pageName = titleToPageName(pageName);

    const response = await fetch(
        `/api.php?action=query&prop=revisions&titles=${pageName}&rvslots=*&rvprop=ids|content&format=json&formatversion=2`);
    const jsonObj = await response.json() as RevisionQueryResult;

    const revision = jsonObj.query.pages[0].revisions[0];
    return {
        revisionId: revision.revid,
        content: revision.slots.main.content,
        title: jsonObj.query.pages[0].title
    };
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