// ==UserScript==
// @name        ArchTranslator
// @namespace   bb89542e-b358-4be0-8c01-3797d1f3a1e3
// @match       https://wiki.archlinux.org/*
// @grant       none
// @version     1.0.6
// @author      bonk-dev
// @description Tools for making translating articles easier. Works on the new Vector theme
// @icon        https://gitlab.archlinux.org/uploads/-/system/group/avatar/23/iconfinder_archlinux_386451.png
// @run-at      document-body
// ==/UserScript==

'use strict';

const STORAGE_GUID = '8efccd2b-73a5-4977-8099-985fc708c422';
const LOCALIZED_LANG_NAME = "Polski";
const USE_LOCALIZED_TRANSLATION_STATUS_TEMPLATE = true;

const LANG_SUBTAGS = [
    "ar", "bs", "bg", "ca", "zh-hans", "zh-hant", "hr",
    "cs", "da", "nl", "en", "fi", "fr", "de", "el", "he",
    "hu", "id", "it", "ja", "ko", "lt", "pl", "pt", "ru",
    "sr", "sk", "es", "sv", "th", "tr", "uk"
];

const LANG_LOCALIZED_NAMES = {
    "Arabic": "العربية",
    "Bangla": "বাংলা",
    "Bosnian": "Bosanski",
    "Bulgarian": "Български",
    "Cantonese": "粵語",
    "Catalan": "Català",
    "Chinese (Classical)": "文言文",
    "Chinese (Simplified)": "简体中文",
    "Chinese (Traditional)": "正體中文",
    "Croatian": "Hrvatski",
    "Czech": "Čeština",
    "Danish": "Dansk",
    "Dutch": "Nederlands",
    "English": "English",
    "Esperanto": "Esperanto",
    "Finnish": "Suomi",
    "French": "Français",
    "German": "Deutsch",
    "Greek": "Ελληνικά",
    "Hebrew": "עברית",
    "Hungarian": "Magyar",
    "Indonesian": "Bahasa Indonesia",
    "Italian": "Italiano",
    "Japanese": "t日本語",
    "Korean": "한국어",
    "Lithuanian": "Lietuvių",
    "Norwegian (Bokmål)": "Norsk Bokmål",
    "Polish": "Polski",
    "Portuguese": "Português",
    "Romanian": "Română"
}

let VALID_LOCALIZED_NAMES_PATTERN = '';

const LOCALIZED_LINKS_UI_STORE_KEY = 'mwedit-state-arch-translator-loc-links';
let editFormModded = false;
let editFormLocalizedArticlesList = null;
let editFormLocalizedArticlesLinksToAdd = {};

let toolsMenu = null;

function getCurrentArticleTitle() {
    if (typeof mw === 'undefined') {
        if (window.location.pathname.startsWith("/title/")) {
            return window.location.pathname.split('/')[2];
        } else {
            return new URL(window.location.href).searchParams.get('title');
        }
    }
    return mw.config.get('wgPageName');
}

function getLangPostfix() {
    return `_(${LOCALIZED_LANG_NAME})`;
}

function getISODate() {
    const date = new Date();
    return date.toISOString().split("T")[0];
}

async function fetchSource(articleTitle) {
    try {
        const response = await fetch(`/index.php?title=${articleTitle}&action=raw`);
        return await response.text();
    } catch (e) {
        console.log("An error has occured while fetching article source:");
        console.error(e);
        return '';
    }
}

class LineParseResult {
    static get redirect() {
        return "redirect";
    }
    static get magicWord() {
        return "magicWord";
    }
    static get category() {
        return "category";
    }
    static get interlanguageLink() {
        return "interlanguageLink";
    }
    static get template() {
        return "template";
    }
    static get relatedArticle() {
        return "relatedArticle";
    }
    static get endOfHeader() {
        return "endOfHeader";
    }
    static get emptyLine() {
        return 'emptyLine';
    }
}

class WikiLink {
    constructor(rawLink) {
        // TODO: Handle redirects (mainly the English redirections, not the old-translation ones)

        const split = rawLink.split('|');
        this._link = split[0];
        const headerSplit = this._link.split('#');
        if (headerSplit.length > 1) {
            this._link = headerSplit[0];
            this._linkedHeader = headerSplit[1];
        }
        else {
            this._linkedHeader = null;
        }

        this._alias = split.length > 1
            ? split[1]
            : null;

        if (split[0].startsWith(':')) {
            this._linkType = 'category';
        }
        else if (split[0].startsWith('#')) {
            this._linkType = 'header';
        }
        else {
            this._linkType = 'article';
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

class ArticleParser {
    constructor() {
        this._redirects = [];
        this._magicWords = [];
        this._categories = [];
        this._interlanguageLinks = {};
        this._templates = [];
        this._relatedArticleElements = [];
        this._parsingContent = false;

        // True if parser found a line starting with '[['
        this._parseMagicWords = true;

        this._rawContentLines = [];
        this._links = [];

        console.debug(`ArticleParser: already_localized_regex: ${VALID_LOCALIZED_NAMES_PATTERN}`);
        this._validLocalizedPrefixesRegex = new RegExp(VALID_LOCALIZED_NAMES_PATTERN);
    }

    get headerText() {
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

    get contentText() {
        return this._rawContentLines.join('\n');
    }

    get articleText() {
        return this.headerText + this.contentText;
    }

    parse(line) {
        if (!this._parsingContent) {
            const headerResult = this._parseHeaderLine(line);
            if (headerResult === LineParseResult.endOfHeader || headerResult === LineParseResult.redirect) {
                this._parsingContent = true;
            }

            return headerResult;
        }
        else {
            return this._parseContentLine(line);
        }
    }

    get localizableLinks() {
        return [
            ...this._links
                .filter(l => !this._validLocalizedPrefixesRegex.test(l.link)
                    && (l.linkType === 'category'
                        || l.linkType === 'article'))
                .map(l => l.link)
        ]
    }

    _parseHeaderLine(line) {
        function isBlank(str) {
            return (!str || /^\s*$/.test(str));
        }

        if (isBlank(line)) {
            return LineParseResult.emptyLine;
        }

        if (line.startsWith("#REDIRECT")) {
            this._redirects.push(line);
            this._log("Found redirect: " + line);
            return LineParseResult.redirect;
        }

        // Check if line is an interlanguage link
        for (let subtag of LANG_SUBTAGS) {
            if (line.startsWith(`[[${subtag}:`)) {
                this.addInterlanguageLink(line, subtag);
                this._parseMagicWords = false;

                return LineParseResult.interlanguageLink;
            }
        }

        if (line.startsWith("[[Category")) {
            this._addCategory(line);
            this._parseMagicWords = false;

            return LineParseResult.category;
        }
        else if (line.startsWith("{{Related")) {
            this._addRelatedArticleElement(line);

            return LineParseResult.relatedArticle;
        }
        else if (line.startsWith("{{") || line.startsWith("__")) {
            if (this._parseMagicWords) {
                this._addMagicWord(line);
                return LineParseResult.magicWord;
            }
            else {
                this.addTemplate(line);
                return LineParseResult.template;
            }
        }
        else {
            this._rawContentLines.push(line);
            return LineParseResult.endOfHeader;
        }
    }

    addInterlanguageLink(line, subtag) {
        this._log("Found interlanguage link: " + line);
        this._interlanguageLinks[subtag] = line;
    }

    _addCategory(line) {
        this._log("Found category: " + line);
        this._categories.push(line);
    }

    _addMagicWord(line) {
        this._log("Found magic word: " + line);
        this._magicWords.push(line);
    }

    addTemplate(line) {
        this._log("Found template: " + line);
        this._templates.push(line);
    }

    _addRelatedArticleElement(line) {
        this._log("Found related article element: " + line);
        this._relatedArticleElements.push(line);
    }

    _parseContentLine(line) {
        this._rawContentLines.push(line);

        // Match: [[text - cant contain square brackets]]
        // Skips Wikipedia links
        for (let match of line.matchAll(/\[\[(?!Wikipedia)(?!w)([^\[\]]*)]]/ig)) {
            // TODO: Support subpages (e.g. dm-crypt/Device encryption)

            const link = new WikiLink(match[1]);
            this._links.push(link);
        }
    }

    _log(msg) {
        console.debug(`HeaderParser: ${msg}`);
    }
}

class ParseSourceOptions {
    statusTemplate
    interlanguageLink
    isCreating
}

function parseSource(articleText, options) {
    const lines = articleText.split('\n');
    const parser = new ArticleParser();

    let redirectFound = false;
    for (let line of lines) {
        const result = parser.parse(line);
        if (result === LineParseResult.redirect) {
            redirectFound = true;
        }
    }

    if (options.isCreating) {
        if (!redirectFound) {
            if (options.interlanguageLink != null) {
                parser.addInterlanguageLink(options.interlanguageLink, 'en');
            }

            if (options.statusTemplate != null) {
                parser.addTemplate(options.statusTemplate);
            }
        }
        else {
            console.debug("This is a redirect page. Skipping TranslationStatus and the interlanguage link");
        }
    }
    else {
        console.debug("Editing a page. Skipping TranslationStatus and the interlanguage link");
    }

    findLocalizedArticles(parser.localizableLinks)
        .then(r => {
            console.debug("findLocalizedArticles done. result:");
            console.debug(r);

            if (editFormLocalizedArticlesList == null) {
                console.debug('parseSource: localized links list not yet initialized. Adding result to queue');
                editFormLocalizedArticlesLinksToAdd = r;
            }
            else {
                console.debug('parseSource: adding localized links to UI');
                addLinksToUi(r);
            }
        });

    return parser.articleText;
}

class LocalizedArticleFinder {
    constructor() {
        this._base = 'https://wiki.archlinux.org';
    }

    async checkIfLocalizedVersionExists(title) {
        const localizedTitle = title + getLangPostfix();
        const response = await fetch(
            `${this._base}/index.php?title=${localizedTitle.replaceAll(' ', '_')}&action=raw`);
        if (response.ok) {
            return LocalizedArticleStatus.exists();
        }
        else if (response.status === 404) {
            console.debug(`checkIfLocalizedVersionExists: not found, checking if redirect: ${title}`);
            const redirectResponse = await fetch(
                `${this._base}/index.php?title=${title.replaceAll(' ', '_')}&action=raw`);
            if (redirectResponse.ok) {
                const originalSource = await redirectResponse.text();
                const sourceSlice = originalSource
                    .substring(0, 9)
                    .toUpperCase();

                if (sourceSlice === '#REDIRECT') {
                    // TODO: Maybe change this function so that it returns the 'redirects to' instead of saving it

                    const redirectsToLinkStr = originalSource.match(/\[\[([^\[\]]*)]]/)[1];
                    const redirectsToLink = new WikiLink(redirectsToLinkStr);
                    setCachedLinkRedirectsTo(title, redirectsToLink.linkWithHeader);

                    return LocalizedArticleStatus.redirects();
                }
            }

            return LocalizedArticleStatus.notExists();
        }

        throw new Error("Invalid response status: " + response.status);
    }
}

async function findLocalizedArticles(links) {
    const finder = new LocalizedArticleFinder();
    let result = {};
    const redirects = [];

    for (let link of links) {
        // try cache first
        const cachedStatus = getCachedLinkStatus(link);
        if (cachedStatus === LocalizedArticleStatus.unknown()) {
            console.debug(`findLocalizedArticles: cache NOT hit for link: ${link}. Fetching status...`);
            const freshStatus = await finder.checkIfLocalizedVersionExists(link);
            setCachedLinkStatus(link, freshStatus);

            if (freshStatus === LocalizedArticleStatus.redirects()) {
                redirects.push(getCachedLinkRedirectsTo(link, true));
                result[link] = {
                    status: freshStatus,
                    to: getCachedLinkRedirectsTo(link)
                };
            }
            else {
                result[link] = {
                    status: freshStatus
                };
            }
        }
        else if (cachedStatus === LocalizedArticleStatus.redirects()) {
            console.debug(`findLocalizedArticles: cache HIT REDIRECT for link: ${link}`);
            result[link] = {
                status: cachedStatus,
                to: getCachedLinkRedirectsTo(link)
            };

            redirects.push(getCachedLinkRedirectsTo(link, true));
        }
        else {
            console.debug(`findLocalizedArticles: cache HIT for link: ${link}. Status: ${cachedStatus}`);
            result[link] = {
                status: cachedStatus
            };
        }
    }

    if (redirects.length > 0) {
        console.debug(`findLocalizedArticles: scanning ${redirects.length} redirects`);

        const langNameRegex = new RegExp(VALID_LOCALIZED_NAMES_PATTERN);
        const redirectsResult = await findLocalizedArticles(redirects.filter(t => !langNameRegex.test(t)));

        let resultWithoutLocalRedirects = {};
        for (let key of Object.keys(redirectsResult)) {
            if (!langNameRegex.test(key)) {
                resultWithoutLocalRedirects[key] = redirectsResult[key];
            }
        }

        return {...result, ...resultWithoutLocalRedirects};
    }

    return result;
}

// Get&Set revision id for usage in template
// Todo: Use IndexedDB
function getRevisionIdKey(translatedTitle) {
    return `${STORAGE_GUID}_${translatedTitle}`;
}

function saveRevisionId(translatedTitle, revisionId) {
    localStorage.setItem(getRevisionIdKey(translatedTitle), revisionId);
}

function getRevisionId(translatedTitle) {
    console.debug(`Get revision id: ${translatedTitle}`)
    return localStorage.getItem(getRevisionIdKey(translatedTitle));
}

function removeRevisionId(translatedTitle) {
    localStorage.removeItem(getRevisionIdKey(translatedTitle));
}

// Localized links cache implementation
class LocalizedArticleStatus {
    static unknown() {
        return 'unknown';
    }

    static exists() {
        return 'exists';
    }

    static notExists() {
        return 'notExists';
    }

    static redirects() {
        return 'redirects';
    }
}

function getCacheStatusKey(link) {
    return `${STORAGE_GUID}_CACHE_${link}_STATUS`;
}

function getCacheExpirationKey(link) {
    return `${STORAGE_GUID}_CACHE_${link}_EXPIRATION`;
}

function getCacheRedirectKey(link) {
    return `${STORAGE_GUID}_CACHE_${link}_REDIRECTS_TO`;
}

function validateStatus(status) {
    switch (status) {
        case LocalizedArticleStatus.unknown():
        case LocalizedArticleStatus.exists():
        case LocalizedArticleStatus.notExists():
        case LocalizedArticleStatus.redirects():
            return true;
        default:
            return false;
    }
}

function getCachedLinkStatus(link) {
    const expirationDateString = localStorage.getItem(getCacheExpirationKey(link));
    if (expirationDateString == null) {
        return LocalizedArticleStatus.unknown();
    }

    const expirationDate = parseInt(expirationDateString);
    if (expirationDate <= Date.now()) {
        invalidateLinkCache(link);
        return LocalizedArticleStatus.unknown();
    }

    const status = localStorage.getItem(getCacheStatusKey(link));
    if (!validateStatus(status)) {
        throw new Error(`Invalid cache status: ${status}`);
    }

    return status;
}

function getCachedLinkRedirectsTo(link, withoutHeader = false) {
    const redirectsTo = localStorage.getItem(getCacheRedirectKey(link));
    if (redirectsTo == null) {
        console.warn(`getCachedLinkRedirectsTo: redirectsTo was null (link: ${link})`);
    }

    return withoutHeader
        ? redirectsTo.split('#')[0]
        : redirectsTo;
}

function setCachedLinkStatus(link, status) {
    console.debug(`LinkCache: setting ${link}: ${status}`);

    if (typeof status !== 'string') {
        throw new Error('"status" must be a "string"');
    }

    const expirationDate = Date.now() + 21600000; // 6 hours
    localStorage.setItem(getCacheExpirationKey(link), expirationDate.toString());
    localStorage.setItem(getCacheStatusKey(link), status.toString());
}

function setCachedLinkRedirectsTo(link, redirectsTo) {
    console.debug(`LinkCache: setting 'redirectsTo' of ${link}: ${redirectsTo}`);

    if (typeof redirectsTo !== 'string') {
        throw new Error('"redirectsTo" must be a "string"');
    }

    localStorage.setItem(getCacheRedirectKey(link), redirectsTo);
}

function invalidateLinkCache(link) {
    console.debug(`LinkCache: invalidating ${link}`);

    localStorage.removeItem(getCacheExpirationKey(link));
    localStorage.removeItem(getCacheStatusKey(link));
    localStorage.removeItem(getCachedLinkRedirectsTo(link));
}

// ======= Localized links UI =======

function makeCollapsibleFooter($list, $toggler, storeKey) {
    // we have to reimplement the collapsible list, because the original code is inside an anonymous function

    const collapsedVal = '0';
    const expandedVal = '1';
    const isCollapsed = mw.storage.get( storeKey ) !== expandedVal;

    // Style the toggler with an arrow icon and add a tabIndex and a role for accessibility
    $toggler
        .addClass('mw-editfooter-toggler')
        .prop('tabIndex', 0)
        .attr('role', 'button');
    $list.addClass('mw-editfooter-list');

    $list.makeCollapsible( {
        $customTogglers: $toggler,
        linksPassthru: true,
        plainMode: true,
        collapsed: isCollapsed
    } );

    $toggler.addClass(isCollapsed
        ? 'mw-icon-arrow-collapsed'
        : 'mw-icon-arrow-expanded');

    $list.on('beforeExpand.mw-collapsible', () => {
        $toggler
            .removeClass('mw-icon-arrow-collapsed')
            .addClass('mw-icon-arrow-expanded');
        mw.storage.set(storeKey, expandedVal);
    } );

    $list.on('beforeCollapse.mw-collapsible', () => {
        $toggler
            .removeClass('mw-icon-arrow-expanded')
            .addClass('mw-icon-arrow-collapsed');
        mw.storage.set(storeKey, collapsedVal);
    } );
}

function addLinksToUi(links) {
    // remove placeholder
    editFormLocalizedArticlesList.innerHTML = '';

    const sortLinks = (a, b) => {
        const aInfo = links[a];
        const bInfo = links[b];

        const orderingTable = {
            [LocalizedArticleStatus.exists()]: 0,
            [LocalizedArticleStatus.redirects()]: 1,
            [LocalizedArticleStatus.notExists()]: 2,
            [LocalizedArticleStatus.unknown()]: 3
        };

        const aOrder = orderingTable[aInfo.status];
        const bOrder = orderingTable[bInfo.status];

        return aOrder - bOrder;
    };

    for (let key of Object
            .keys(links)
            .sort(sortLinks)) {
        const linkInfo = links[key];
        let listItemElement = document.createElement('li');

        // TODO: Show redirects-to link status
        switch (linkInfo.status) {
            case LocalizedArticleStatus.exists():
                listItemElement.innerText = `${key + getLangPostfix()} -> ${linkInfo.status}`;
                listItemElement.classList.add('localized-green');
                break;
            case LocalizedArticleStatus.redirects():
                listItemElement.innerText = `${key} -> ${linkInfo.status} -> ${linkInfo.to}`;
                listItemElement.classList.add('localized-blue');
                break;
            case LocalizedArticleStatus.notExists():
                listItemElement.innerText = `${key + getLangPostfix()} -> ${linkInfo.status}`;
                listItemElement.classList.add('localized-red');
                break;
            default:
                listItemElement.innerText = `${key + getLangPostfix()} -> ${linkInfo.status}`;
                listItemElement.classList.add('localized-gray');
                break;
        }

        editFormLocalizedArticlesList.appendChild(listItemElement);
    }
}

function modEditForm($editForm) {
    console.debug('Running modEditForm');

    if (!editFormModded) {
        editFormModded = true;
    }
    else {
        return;
    }

    console.debug('modEditForm: Adding CSS for localized links UI');
    const styleElement = document.createElement('style');
    styleElement.innerHTML =
        `.localized-green {
            color: green;
        }
        .localized-blue {
            color: blue;
        }
        .localized-red {
            color: red;
        }
        .localized-gray {
            color: darkgray;
        }
        `
    document.head.appendChild(styleElement);

    const localizedArticlesUiHtml =
        `<div class="localizedArticlesUi">
            <div class="localizedArticlesUi-toggler">
                <p>AT - Localized articles:</p>
            </div>
            <ul>
                <li>Please wait...</li>
            </ul>
        </div>`;

    $editForm
        .find('.templatesUsed')
        .before(localizedArticlesUiHtml);

    const linksList = $editForm.find('.localizedArticlesUi ul');
    editFormLocalizedArticlesList = linksList[0];

    if (editFormLocalizedArticlesLinksToAdd.length > 0) {
        addLinksToUi(editFormLocalizedArticlesList);
    }

    makeCollapsibleFooter(
        linksList,
        $editForm.find('.localizedArticlesUi-toggler'),
        LOCALIZED_LINKS_UI_STORE_KEY
    );

    console.debug('modEditForm done');
}

// CodeMirror callback
async function modCodeMirror(cmInstance, isCreating) {
    let newSourceText;
    if (isCreating) {
        const title = getCurrentArticleTitle();
        const langPostfix = getLangPostfix();
        const originalTitle = title
            .replace(langPostfix, '')
            .replaceAll('_', ' ');
        const revisionId = getRevisionId(title);

        const templateName = USE_LOCALIZED_TRANSLATION_STATUS_TEMPLATE
            ? `TranslationStatus (${LOCALIZED_LANG_NAME})`
            : 'TranslationStatus';
        const status = `{{${templateName}|${originalTitle}|${getISODate()}|${revisionId}}}`;
        console.debug(`Status template: ${status}`);

        console.debug("Fetching original source");
        const originalSrc = await fetchSource(originalTitle);

        // Yes, we could just insert the TranslationStatus template at the beginning,
        // but it would be against the wiki style

        newSourceText = parseSource(originalSrc, {
            statusTemplate: status,
            interlanguageLink: `[[en:${originalTitle}]]`,
            isCreating: true
        });
    }
    else {
        newSourceText = parseSource(cmInstance.getValue(), {
            isCreating: false
        });
    }

    cmInstance.setValue(newSourceText);
}

// run when the user opens up an edit article page
function modEditPage(isCreating) {
    const handleCodeMirror = (codeMirror) => {
        // At this point, we can be sure that other extensions are loaded as well
        mw.hook('wikipage.editform')
            .add( ($editForm) => {
                modEditForm($editForm);
            });

        modCodeMirror(codeMirror, isCreating)
            .then(() => {
                console.debug("modCodeMirror done");
            });
    };

    const panel1CodeMirrorSelector = '.ext-WikiEditor-twopanes-pane1 .CodeMirror';
    const existingCodeMirror = document.querySelector(panel1CodeMirrorSelector);
    if (existingCodeMirror != null && typeof existingCodeMirror.CodeMirror !== 'undefined') {
        handleCodeMirror(existingCodeMirror.CodeMirror);
        return;
    }

    // Wait for CodeMirror init
    // Select the node that will be observed for mutations
    const targetNode = document.getElementById("editform");

    // Options for the observer (which mutations to observe)
    const config = {
        attributes: false,
        childList: true,
        subtree: true
    };

    // Callback function to execute when mutations are observed
    const callback = (mutationList, observer) => {
        for (const mutation of mutationList) {
            if (mutation.type === "childList" &&
                mutation.addedNodes.length > 0 &&
                mutation.target.className === 'wikiEditor-ui-text' &&
                mutation.addedNodes[0].classList.contains("CodeMirror")) {

                // Found the CodeMirror instance, no need to observe further
                observer.disconnect();

                const codeMirrorElement = mutation.addedNodes[0];
                handleCodeMirror(codeMirrorElement.CodeMirror);

                break;
            }
        }
    };

    // Create an observer instance linked to the callback function
    const observer = new MutationObserver(callback);

    // Start observing the target node for configured mutations
    observer.observe(targetNode, config);
}

// run when the user opens up a normal, read article page
function modReadPage(permanentLinkTool) {
    const permLinkAnchor = permanentLinkTool.querySelector('a');
    const revisionId = new URL(permLinkAnchor.href)
        .searchParams
        .get('oldid');

    // get translated article title
    const translatedArticleTitle = `${getCurrentArticleTitle()}${getLangPostfix()}`;
    const translatedArticleHref = encodeURI(`${window.location.origin}/index.php?title=${translatedArticleTitle}&action=edit`);

    // save revision id for TranslationStatus
    saveRevisionId(translatedArticleTitle, revisionId);

    // create Translate button
    const createTranslationTool = document.createElement('a');
    createTranslationTool.href = translatedArticleHref;
    createTranslationTool.innerHTML = `Translate to ${LOCALIZED_LANG_NAME}`;

    addCustomTool(createTranslationTool, 'create-translation');
}

function createToolSection() {
    const toolContainer = document.createElement('div');
    toolContainer.id = 'p-arch-translator';
    toolContainer.classList.add('vector-menu', 'mw-portlet');

    // Heading
    const menuHeading = document.createElement('div');
    menuHeading.classList.add('vector-menu-heading');
    menuHeading.innerText = 'Arch Translator';
    toolContainer.appendChild(menuHeading);

    // Content
    const menuContent = document.createElement('div');
    menuContent.classList.add('vector-menu-content');
    toolContainer.appendChild(menuContent);

    const menuList = document.createElement('ul');
    menuList.classList.add('vector-menu-content-list');
    menuContent.appendChild(menuList);

    return [toolContainer, menuList];
}

function addCustomTool(toolElement, name) {
    if (typeof name !== 'string') {
        throw new Error("'name' must be a string");
    }
    if (toolsMenu == null) {
        throw new Error('The tools menu was not created yet');
    }

    const listItem = document.createElement('li');
    listItem.id = `t-at-${name}`;
    listItem.classList.add('mw-list-item');
    listItem.appendChild(toolElement);
    toolsMenu.appendChild(listItem);
}

function handleRecreateToolClick(e) {
    console.debug('Running handleRecreateToolClick');
    e.preventDefault();

    modEditPage(true);
}

// Adds tools useful when the user is editing a page
function addEditArticleTools() {
    const forceRecreateTool = document.createElement('a');
    forceRecreateTool.href = '#';
    forceRecreateTool.innerHTML = '<span>Paste original English source</span>';
    forceRecreateTool.addEventListener('click', handleRecreateToolClick);

    addCustomTool(forceRecreateTool, 'recreate');
}

// Executed after 'startup' module was run (MediaWiki API is ready)
function run() {
    const names = Object.values(LANG_LOCALIZED_NAMES)
        .map(n => `(?:${n})`)
        .join('|');
    VALID_LOCALIZED_NAMES_PATTERN = `\((?:${names})\)`;

    console.debug('run(): creating the custom tool section');
    const [toolSection, toolList] = createToolSection();
    toolsMenu = toolList;
    const toolSectionContainer = document.getElementById('vector-page-tools');
    toolSectionContainer.appendChild(toolSection);
    console.debug('run(): tool section created');

    // "Permanent link" tool, exists only on normal articles
    const permanentLinkTool = document.getElementById('t-permalink');

    // "Translate to LANG" feature
    if (permanentLinkTool != null) {
        const currentTitle = getCurrentArticleTitle();

        if (!/_\(.*\)/g.test(currentTitle)) {
            modReadPage(permanentLinkTool);
        } else {
            console.debug("This looks like a translated article.");
        }

    } else {
        addEditArticleTools();

        // If creating a new article, insert the template
        const heading = document.getElementById('firstHeading');
        const isEditing = (typeof mw !== 'undefined') && mw.config.get('wgAction') === 'edit';
        const isCreating = isEditing && heading.textContent.indexOf('Creating') !== -1;
        const isTranslating = getCurrentArticleTitle().indexOf(getLangPostfix()) !== -1;

        console.debug(`heading: ${heading}`);
        console.debug(`isEditing: ${isEditing}`);
        console.debug(`isCreating: ${isCreating}`);
        console.debug(`isTranslating: ${isTranslating}`);

        if (heading != null &&
            isEditing &&
            isTranslating) {
            modEditPage(isCreating);
        }
    }
}

function waitForStartup() {
    return new Promise((resolve, reject) => {
        let found = false;
        const scripts = document.querySelectorAll('script');

        for (let script of scripts) {
            if (script.src.length <= 0) continue;

            console.debug('Checking url: ' + script.src);
            const srcUrl = new URL(script.src);
            if (srcUrl.searchParams.get('modules') === 'startup') {
                found = true;
                script.addEventListener('load', () => {
                    resolve();
                });

                break;
            }
        }

        if (!found) {
            reject("Could not find script loading the 'startup' module");
        }
    });
}

waitForStartup()
    .then(() => {
        console.debug('Startup module loaded. Running ArchTranslator');
        run();
    })
    .catch(e => {
        console.log('Startup failed:');
        console.error(e);
    })