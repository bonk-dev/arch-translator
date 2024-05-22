import {LanguageInfo} from "../Internalization/I18nConstants";

const translateTemplate = (template: string, language?: LanguageInfo) => {
    return language == null
        ? template
        : `${template} (${language.localizedName})`;
};

export const buildTranslationStatusTemplate = (englishName: string,
                                       date: Date,
                                       englishRevisionId: number,
                                       language?: LanguageInfo): string => {
    const templateName = translateTemplate('TranslationStatus', language);
    const formattedDate = date.toISOString().split('T')[0];
    return `{{${templateName}|${englishName}|${formattedDate}|${englishRevisionId}}}`;
};