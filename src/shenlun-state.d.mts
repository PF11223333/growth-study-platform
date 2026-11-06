export const SHENLUN_PERSONAL_KEY:string;export const SHENLUN_VIEW_KEY:string;
export function shenlunExcerpt(record:{excerpt?:string}):string;
export type ShenlunPersonal={schemaVersion:number;favorites:string[];recent:string[]};
export type ShenlunView={query:string;date:string;topic:string;police:boolean;limit:number};
export function readShenlunPersonal(raw:string|null):ShenlunPersonal;
export function updateShenlunPersonal(current:ShenlunPersonal,action:'favorite'|'read',id:string):ShenlunPersonal;
export function readShenlunView(raw:string|null,view:string,params?:URLSearchParams):ShenlunView;
