import type {RecordItem, Region} from './types';

export type PracticeClip = {
 sourceId:string; page:number; width:number; height:number; region:Region; previewSuffix:'-clean'|'-hd';
};
export type PracticeVisuals = {status:'ready'|'pending'; question:PracticeClip[]; context:PracticeClip[]};
export type PolicePracticeSurface = {
 stem?:string;
 stemClips?:PracticeClip[];
 context?:string;
 contextClips?:PracticeClip[];
 options:Record<string,{text?:string;clips?:PracticeClip[]}>;
};

export function hidePoliceSourcesDuringPractice(record:RecordItem) {
 return record.subject==='gongan' && record.kind==='practice' &&
  !!record.details?.question && !record.studyQuestion?.groupOnly;
}

export function needsPolicePracticeSurface(record:RecordItem) {
 const question=record.details?.question;
 return hidePoliceSourcesDuringPractice(record) &&
  (question.origin==='source-scan'||!!question.originalPages?.length||!!question.contextPages?.length);
}
