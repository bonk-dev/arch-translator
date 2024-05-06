// ==UserScript==
// @name        ArchTranslator
// @namespace   bb89542e-b358-4be0-8c01-3797d1f3a1e3
// @match       https://wiki.archlinux.org/*
// @grant       none
// @version     1.0.2
// @author      bonk-dev
// @description Tools for making translating articles easier. Works on the new Vector theme
// @icon        https://gitlab.archlinux.org/uploads/-/system/group/avatar/23/iconfinder_archlinux_386451.png
// @run-at      document-end
// ==/UserScript==

'use strict';

const STORAGE_GUID = '8efccd2b-73a5-4977-8099-985fc708c422';
const LOCALIZED_LANG_NAME = "Polski";
const USE_LOCALIZED_TRANSLATION_STATUS_TEMPLATE = true;

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

function insertAfterArticleHeader(articleText, value) {
    const lines = articleText.split('\n');

    let newText = '';
    let index = 0;
    for (let line of lines) {
        // lines like: {{text}} or [[text]]
        if (/^{{.*}}$/g.test(line) || /^\[\[.*]]$/g.test(line)) {
            newText += line;
            newText += '\n';

            index += 1;
        } else {
            // header end
            console.debug("End of header: " + line);
            break;
        }
    }

    newText += value;
    newText += '\n';

    // add rest of the text;
    lines.splice(0, index);
    return newText + lines.join('\n');
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
async function modCodeMirror(cmInstance) {
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

    // cmInstance.setValue(status);

    console.debug("Fetching original source");
    const originalSrc = await fetchSource(originalTitle);

    // Yes, we could just insert the TranslationStatus template at the beginning,
    // but it would look bad
    const srcWithStatus = insertAfterArticleHeader(originalSrc, status);
    cmInstance.setValue(srcWithStatus);

    // cmInstance.setValue(originalSrc);
}

// run when the user opens up an edit article page
function modEditPage() {
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
                modCodeMirror(codeMirrorElement.CodeMirror)
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
    if (heading != null &&
        heading.textContent.indexOf('Creating') !== -1 &&
        getCurrentArticleTitle().indexOf(getLangPrefix()) !== -1) {
        modEditPage();
    }
}