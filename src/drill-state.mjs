import {reasonLabels} from './error-insights.mjs';
export const normalizeAnswer = value => [...new Set(String(value || '').toUpperCase().match(/[A-D]/g) || [])].sort().join('');
export const emptyProgress = () => ({revision:0, items:{}});
export function gradeQuestion(question, answer, rating) {
  if(question.gradingExcluded)return null;
  if(question.type === 'recall') return rating === '掌握' ? true : rating === '忘记' || rating === '模糊' ? false : null;
  const expected = normalizeAnswer(question.referenceAnswer);
  const selected = normalizeAnswer(answer);
  return expected && selected ? expected === selected : null;
}
export function applyEvent(progress, event) {
  const state = structuredClone(progress || emptyProgress());
  state.items ||= {};
  const previous = state.items[event.id] || {attempts:0,wrongCount:0,streak:0,history:[]};
  if(previous.history?.some(x=>x.eventId===event.eventId)) return state;
  const at = event.at || new Date().toISOString();
  const day = new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date(at));
  const row = {...previous, history:[...(previous.history||[]),{...event,at}].slice(-60)};
  if(event.historicalWrong) {row.isWrong=true;row.origin ||= '历史红蓝笔错题';}
  if(event.action === 'confirm') {row.isWrong=true;row.origin='历史错题确认';row.streak=0;row.nextReview=day;row.dismissed=false;}
  else if(event.action === 'dismiss') {row.dismissed=true;}
  else if(event.action === 'reason') {if(!reasonLabels[event.reason])throw new Error('错因类型无效');row.errorReason=event.reason;row.reasonAt=at;}
  else if(event.correct !== null && event.correct !== undefined) {
    row.attempts++; row.lastAnswer=event.answer; row.lastAt=at; row.lastCorrect=event.correct;
    row.streak=event.correct ? row.streak+1 : 0;
    if(!event.correct) {row.isWrong=true;row.wrongCount++;row.origin ||= '刷题作答';}
    row.correctDays=event.correct ? [...new Set([...(previous.correctDays||[]),day])].slice(-10) : [];
    row.mastered=!!row.isWrong && row.streak>=3 && row.correctDays.length>=2;
    const due=new Date(day+'T12:00:00+08:00');due.setUTCDate(due.getUTCDate()+(event.correct?[1,3,7,14,30][Math.min(row.correctDays.length-1,4)]:1));
    row.nextReview=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(due);
  }
  state.items[event.id]=row;state.revision=(state.revision||0)+1;return state;
}
export function mergeProgress(base, overlay) {
  const result = structuredClone(base || emptyProgress());
  for(const [id,row] of Object.entries(overlay?.items || {})) {
    const baseline=result.items[id];
    if(!baseline || (row.lastAt||row.history?.at(-1)?.at||'') >= (baseline.lastAt||baseline.history?.at(-1)?.at||'')) result.items[id]=row;
  }
  return result;
}
export function isPending(record, progress) { return !!record.studyQuestion?.wrongCandidate && !progress.items?.[record.id]?.isWrong && !progress.items?.[record.id]?.dismissed; }
export function isWrongRecord(record, progress) { return record.kind === 'error' || !!record.studyQuestion?.historicalWrong || !!progress.items?.[record.id]?.isWrong; }
