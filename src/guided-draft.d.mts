import type {GuidedState} from './guided-state.mjs';
export function chooseGuidedDraft(state:GuidedState,knowledgeId:string,deviceId:string,at?:Date|string):{values:Record<string,any>;draftId?:string;reset:boolean};
