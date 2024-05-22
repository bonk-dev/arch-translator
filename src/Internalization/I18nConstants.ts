import {post} from "jquery";

export class LanguageInfo {
    englishName: string
    localizedName: string
    subtag: string|null

    constructor(subtag: string|null, englishName: string, localizedName: string) {
        this.subtag = subtag;
        this.englishName = englishName;
        this.localizedName = localizedName;
    }
}

export const LanguagesInfo: { [key: string]: LanguageInfo } = {
    Arabic: new LanguageInfo('ar', 'Arabic', 'العربية'),
    Bangla: new LanguageInfo(null, 'Bangla', 'বাংলা'),
    Bosnian: new LanguageInfo('bs', 'Bosnian', 'Bosanski'),
    Bulgarian: new LanguageInfo('bg', 'Bulgarian', 'Български'),
    Cantonese: new LanguageInfo(null, 'Cantonese', '粵語'),
    Catalan: new LanguageInfo('ca', 'Catalan', 'Català'),
    ChineseClassical: new LanguageInfo(null, 'Chinese (Classical)', '文言文'),
    ChineseSimplified: new LanguageInfo('zh-hans', 'Chinese (Simplified)', '简体中文'),
    ChineseTraditional: new LanguageInfo('zh-hant', 'Chinese (Traditional)', '正體中文'),
    Croatian: new LanguageInfo('hr', 'Croatian', 'Hrvatski'),
    Czech: new LanguageInfo('cs', 'Czech', 'Čeština'),
    Danish: new LanguageInfo('da', 'Danish', 'Dansk'),
    Dutch: new LanguageInfo('nl', 'Dutch', 'Nederlands'),
    English: new LanguageInfo('en', 'English', 'English'),
    Esperanto: new LanguageInfo(null, 'Esperanto', 'Esperanto'),
    Finnish: new LanguageInfo('fi', 'Finnish', 'Suomi'),
    French: new LanguageInfo('fr', 'French', 'Français'),
    German: new LanguageInfo('de', 'German', 'Deutsch'),
    Greek: new LanguageInfo('el', 'Greek', 'Ελληνικά'),
    Hebrew: new LanguageInfo('he', 'Heberew', 'עברית'),
    Hungarian: new LanguageInfo('hu', 'Hungarian', 'Magyar'),
    Indonesian: new LanguageInfo('id', 'Indonesian', 'Bahasa Indonesia'),
    Italian: new LanguageInfo('it', 'Italian', 'Italiano'),
    Japanese: new LanguageInfo('ja', 'Japanese', '日本語'),
    Korean: new LanguageInfo('ko', 'Korean', '한국어'),
    Lithuanian: new LanguageInfo('lt', 'Lithuanian', 'Lietuvių'),
    NorwegianBokmal: new LanguageInfo(null, 'Norwegian (Bokmål)', 'Norsk Bokmål'),
    Polish: new LanguageInfo('pl', 'Polish', 'Polski'),
    Portuguese: new LanguageInfo('pt', 'Portuguese', 'Português'),
    Romanian: new LanguageInfo(null, 'Romanian', 'Română'),
    Russian: new LanguageInfo('ru', 'Russian', 'Русский'),
    Serbian: new LanguageInfo('sr', 'Serbian', 'Српски (Srpski)'),
    Slovak: new LanguageInfo('sk', 'Slovak', 'Slovenčina'),
    Spanish: new LanguageInfo('es', 'Spanish', 'Español'),
    Swedish: new LanguageInfo('sv', 'Swedish', 'Svenska'),
    Thai: new LanguageInfo('th', 'Thai', 'ไทย'),
    Turkish: new LanguageInfo('tr', 'Turkish', 'Türkçe'),
    Ukrainian: new LanguageInfo('uk', 'Ukrainian', 'Українська'),
    Vietnamese: new LanguageInfo(null, 'Vietnamese', 'Tiếng Việt'),
    Quechua: new LanguageInfo(null, 'Quechua', 'Runa simi')
};

const validLangPostfixes = Object
    .values(LanguagesInfo)
    .map(i => '(' + i.localizedName + ')');

export function isTranslated(title: string): boolean {
    for (const postfix of validLangPostfixes) {
        if (title.endsWith(postfix)) {
            return true;
        }
    }

    return false;
}

export function removeLanguagePostfix(pageOrTitle: string) {
    for (const postfix of validLangPostfixes) {
        if (pageOrTitle.endsWith(postfix)) {
            return pageOrTitle.substring(0, pageOrTitle.length - 1 - postfix.length);
        }
    }

    return pageOrTitle;
}

export function getLangInfoFor(key: string): LanguageInfo {
    const info = LanguagesInfo[key];
    if (info == null) {
        throw new Error(`Invalid language key: ${key}`);
    }

    return info;
}