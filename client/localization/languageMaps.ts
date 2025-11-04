
const languageMapEn: { [key: string]: string } = {
    Arabic: 'ar',
    Bengali: 'bn',
    Chinese: 'zh',
    Czech: 'cs',
    Dutch: 'nl',
    English: 'en',
    Finnish: 'fi',
    French: 'fr',
    German: 'de',
    Greek: 'el',
    Hebrew: 'he',
    Hindi: 'hi',
    Hungarian: 'hu',
    Italian: 'it',
    Japanese: 'ja',
    Korean: 'ko',
    Norwegian: 'no',
    Polish: 'pl',
    Portuguese: 'pt',
    Romanian: 'ro',
    Russian: 'ru',
    Spanish: 'es',
    Swedish: 'sv',
    Thai: 'th',
    Turkish: 'tr',
    Ukrainian: 'uk',
    Vietnamese: 'vi',
  };

  export const reverseLanguageMapEn: { [key: string]: string } = Object.fromEntries(
    Object.entries(languageMapEn).map(([lang, code]) => [code, lang])
  );
  
  export default languageMapEn;