// ==UserScript==
// @name        ArchTranslator
// @namespace   bb89542e-b358-4be0-8c01-3797d1f3a1e3
// @match       https://wiki.archlinux.org/*
// @grant       none
// @version     1.0.3
// @author      bonk-dev
// @description Tools for making translating articles easier. Works on the new Vector theme
// @icon        https://gitlab.archlinux.org/uploads/-/system/group/avatar/23/iconfinder_archlinux_386451.png
// @run-at      document-end
// ==/UserScript==

'use strict';

const STORAGE_GUID = '8efccd2b-73a5-4977-8099-985fc708c422';
const LOCALIZED_LANG_NAME = "Polski";
const LANG_SUBTAG = 'pl';
const USE_LOCALIZED_TRANSLATION_STATUS_TEMPLATE = true;

const LANG_SUBTAGS = [
    "ar", "bs", "bg", "ca", "zh-hans", "zh-hant", "hr",
    "cs", "da", "nl", "en", "fi", "fr", "de", "el", "he",
    "hu", "id", "it", "ja", "ko", "lt", "pl", "pt", "ru",
    "sr", "sk", "es", "sv", "th", "tr", "uk"
];

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

function getLangPrefix() {
    return `_(${LOCALIZED_LANG_NAME})`;
}

function getISODate() {
    const date = new Date();
    return date.toISOString().split("T")[0];
}

async function fetchSource(articleTitle) {
    try {
        const response = await fetch(`/index.php?title=${articleTitle}&action=edit`);
        const htmlText = await response.text();

        const parser = new DOMParser();
        const srcDom = parser.parseFromString(htmlText, 'text/html');
        const srcElement = srcDom.querySelector('#wpTextbox1');

        return srcElement == null
            ? ''
            : srcElement.textContent;
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
        this._foundSquareBracketElement = false;

        this._rawContentLines = [];

        // e.g. :Category:System administration
        this._categoryLinks = [];

        // e.g. Installation guide
        this._articleLinks = [];

        // #System administration
        this._headerLinks = [];
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
        return [...this._categoryLinks, ...this._articleLinks]
    }

    _parseHeaderLine(line) {
        if (line.startsWith("#REDIRECT")) {
            this._redirects.push(line);
            this._log("Found redirect: " + line);
            return LineParseResult.redirect;
        }

        // Check if line is an interlanguage link
        for (let subtag of LANG_SUBTAGS) {
            if (line.startsWith(`[[${subtag}:`)) {
                this.addInterlanguageLink(line, subtag);
                this._foundSquareBracketElement = true;

                return LineParseResult.interlanguageLink;
            }
        }

        if (line.startsWith("[[Category")) {
            this._addCategory(line);
            this._foundSquareBracketElement = true;

            return LineParseResult.category;
        }
        else if (line.startsWith("{{Related")) {
            this._addRelatedArticleElement(line);

            return LineParseResult.relatedArticle;
        }
        else if (line.startsWith("{{")) {
            if (this._foundSquareBracketElement) {
                this._addMagicWord(line);
                return LineParseResult.magicWord;
            }
            else {
                this.addTemplate(line);
                return LineParseResult.template;
            }
        }
        else {
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
        for (let match of line.matchAll(/\[\[(?!Wikipedia)([^\[\]]*)]]/g)) {
            if (match[1].startsWith(':')) {
                this._categoryLinks.push(match[1]);
            }
            else if (match[1].startsWith('#')) {
                this._headerLinks.push(match[1]);
            }
            else {
                this._articleLinks.push(match[1]);
            }
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

    if (!options.isCreating) {
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
        .then(() => console.debug("findLocalizedArticles done"));

    return parser.articleText;
}

async function findLocalizedArticles(links) {
    for (let link of links) {
        console.debug(`findLocalizedArticles link: ${link}`);
    }
}

// Get&Set revision id for usage in template
// Todo: Use IndexedDB
function getKey(translatedTitle) {
    return `${STORAGE_GUID}_${translatedTitle}`;
}

function saveRevisionId(translatedTitle, revisionId) {
    localStorage.setItem(getKey(translatedTitle), revisionId);
}

function getRevisionId(translatedTitle) {
    console.debug(`Get revision id: ${translatedTitle}`)
    return localStorage.getItem(getKey(translatedTitle));
}

function removeRevisionId(translatedTitle) {
    localStorage.removeItem(getKey(translatedTitle));
}

// CodeMirror callback
async function modCodeMirror(cmInstance, isCreating) {
    let newSourceText = '';
    if (isCreating) {
        const title = getCurrentArticleTitle();
        const langPostfix = getLangPrefix();
        const originalTitle = title
            .replace(langPostfix, '')
            .replace('_', ' ');
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
                modCodeMirror(codeMirrorElement.CodeMirror, isCreating)
                    .then(() => {
                        console.debug("modCodeMirror done");
                    });

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
function modReadPage() {
    const permLinkAnchor = permanentLinkTool.querySelector('a');
    const revisionId = new URL(permLinkAnchor.href)
        .searchParams
        .get('oldid');

    // get translated article title
    const translatedArticleTitle = `${getCurrentArticleTitle()}${getLangPrefix()}`;
    const translatedArticleHref = encodeURI(`${window.location.origin}/index.php?title=${translatedArticleTitle}&action=edit`);

    // save revision id for TranslationStatus
    saveRevisionId(translatedArticleTitle, revisionId);

    // create Translate button
    const translateTool = document.createElement('li');
    translateTool.id = 't-translate-article';
    translateTool.className = 'mw-list-item';
    translateTool.innerHTML = `
      <a href='${translatedArticleHref}'>
        <span>Translate to ${LOCALIZED_LANG_NAME}</span>
      </a>`;

    // add the button
    const toolsList = permanentLinkTool.parentElement;
    toolsList.appendChild(translateTool);
}

// "Permanent link" tool, exists only on normal articles
const permanentLinkTool = document.getElementById('t-permalink');
console.debug(permanentLinkTool);

// "Translate to LANG" feature
if (permanentLinkTool != null) {
    const currentTitle = getCurrentArticleTitle();

    if (!/_\(.*\)/g.test(currentTitle)) {
        modReadPage();
    } else {
        console.debug("This looks like a translated article.");
    }

} else {
    // If creating a new article, insert the template
    const heading = document.getElementById('firstHeading');
    const isEditing = (typeof mw !== 'undefined') && mw.config.get('wgAction') === 'edit';
    const isCreating = isEditing && heading.textContent.indexOf('Creating') !== -1;

    if (heading != null &&
        isEditing &&
        getCurrentArticleTitle().indexOf(getLangPrefix()) !== -1) {
        modEditPage(isCreating);
    }
}