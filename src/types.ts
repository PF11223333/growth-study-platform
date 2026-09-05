export type Region={x:number;y:number;w:number;h:number};
export type SourceRef={sourceId?:string;page?:number;label?:string;quote?:string;url?:string;regions?:Region[]};
export type RecordItem={id:string;kind:string;title:string;body?:string;excerpt?:string;subject:string;topic:string;date:string;tags:string[];sourceRefs:SourceRef[];links:string[];revision:number;nextReview?:string;activationStatus?:string;verificationStatus?:string;starred?:boolean;archived?:boolean;details?:any;reviewHistory?:{at:string;rating:string}[];[key:string]:any};
export type Source={id:string;title:string;filename:string;kind:string;subject:string;topic:string;date:string;pageCount:number;missing?:boolean;size:number;downloadUrl?:string;previewError?:string};
export type Catalog={mode?:string;token?:string;version:number;updatedAt:string;records:RecordItem[];sources:Source[];counts:{records:number;sources:number;conflicts:number};reviewSettings:any};
export const subjects:Record<string,string>={xingce:'行测',shenlun:'申论',gongan:'公安',growth:'成长'};
export const kinds:Record<string,string>={knowledge:'学习卡',review:'复盘卡',memory:'速记卡',note:'随手记',article:'精读资料',quote:'金句表达',growth:'成长复盘',practice:'套题练习',error:'错题复盘',weekly:'周复盘',letter:'与明天的我',common:'常识学习包',fortune:'娱乐参考'};
export const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date());
