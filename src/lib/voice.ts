import type { SupportedLanguage } from "./domain";
export const voiceLocales:Record<SupportedLanguage,string>={en:"en-IN",hi:"hi-IN",hinglish:"hi-IN"};
export function transcriptionDecision(confidence:number,language:SupportedLanguage){if(!Number.isFinite(confidence)||confidence<.6)return{accepted:false,locale:voiceLocales[language],message:"Please repeat your issue."};return{accepted:true,locale:voiceLocales[language],message:null};}
