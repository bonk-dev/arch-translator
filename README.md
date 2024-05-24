# ArchTranslator
Useful tools for ArchWiki translators, now written in TypeScript.

## Usage
- Install the UserScript
- Change the active language (the default is Polish)

## Features
- Copies and pastes the original source;
- Inserts the localized {{TranslationStatus}} template;
- Inserts the English interlanguage link;
- Sorts the header elements according to the ArchWiki style;
- Scans the page content for already translated articles.

### Translated articles scanner
The script scans the article for links to other articles and checks if these articles have
been already translated to the language of choice.

In this example we can see that the page content contains many links to English pages.
Pages highlighted in green have a translation page.
![Translated articles scanner UI](assets/translated-articles.png)
