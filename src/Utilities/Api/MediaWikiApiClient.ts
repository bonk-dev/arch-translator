import {
    GetPageContentResult,
    InfoQueryResultArray,
    InfoQueryResultKeyedObject,
    LinkQueryResult, RevisionQueryResult
} from "./MediaWikiApiTypes";
import {titleToPageName} from "../PageUtils";

const MAX_PAGE_QUERY_LIMIT = 50;

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
    if (titles.length <= 0) {
        throw new Error("Titles array must be larger than 0");
    }

    const fetchInfo = async (titles: string[]): Promise<InfoQueryResultKeyedObject | InfoQueryResultArray> => {
        const encodedTitles = encodeURIComponent(titles.join('|'));
        const apiResponse = await fetch(`/api.php?action=query&prop=info&titles=${encodedTitles}&format=json`);
        if (!apiResponse.ok) {
            throw new Error("API request failed: " + apiResponse.statusText);
        }

        return await apiResponse.json();
    };
    const groupLimit = <T>(bigArray: T[], limit: number): T[][] => {
        if (limit <= 0) {
            throw new Error("groupLimit 'limit' parameter must be larger than 0");
        }

        if (bigArray.length <= limit) {
            return [bigArray];
        }

        const parentArray: T[][] = [];
        let addedTitles = 0;
        while (addedTitles < bigArray.length) {
            const childArray: T[] = [];
            const childSize = Math.min(bigArray.length - addedTitles, limit);
            const startingIndex: number = addedTitles;

            for (let i = 0; i < childSize; ++i) {
                childArray.push(bigArray[i + startingIndex]);
                addedTitles++;
            }

            parentArray.push(childArray);
        }

        return parentArray;
    };

    const groups = groupLimit(titles, MAX_PAGE_QUERY_LIMIT);

    // I would love to Promise.all(...), but that could easily result in HTTP 429
    // const responses = await Promise.all(groups.map(
    //     titleGroup => fetchInfo(titleGroup)
    // ));

    const responses = [];
    for (const titleGroup of groups) {
        responses.push(await fetchInfo(titleGroup));
    }

    return Object.assign({}, ...responses);
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