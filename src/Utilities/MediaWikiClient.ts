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