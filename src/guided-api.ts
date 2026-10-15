import {getJSON,isLocal} from './api';
import type {GuidedBundle} from './guided-types';
let bundle:Promise<GuidedBundle>|undefined;
export function guidedLessons(){return bundle??=getJSON(isLocal()?'/api/guided-lessons':'./data/guided-lessons.json').catch(e=>{bundle=undefined;throw e;});}
