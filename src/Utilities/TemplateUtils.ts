import {LanguageInfo} from "../Internalization/I18nConstants";

const translateTemplate = (template: string, language?: LanguageInfo) => {
    return language == null
        ? template
        : `${template} (${language.localizedName})`;
};

export const buildTranslationStatusTemplate = (englishName: string,
                                       date: string,
                                       englishRevisionId: number,
                                       language?: LanguageInfo): string => {
    const templateName = translateTemplate('TranslationStatus');
    return `{{${templateName}|${englishName}|${date}|${englishRevisionId}}}`;
};