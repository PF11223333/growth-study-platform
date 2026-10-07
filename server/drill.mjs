import fs from 'node:fs';
import path from 'node:path';
import {DATA,atomic,now} from './store.mjs';
import {emptyProgress,applyEvent,gradeQuestion,normalizeAnswer} from '../src/drill-state.mjs';
const file=()=>path.join(DATA,'drill-progress.json');
export function readDrill(){return fs.existsSync(file())?JSON.parse(fs.readFileSync(file(),'utf8')):emptyProgress();}
export function saveDrillEvent(db,input){
  const state=readDrill();
  const r=db.records.find(r=>r.id===input.id&&!r.archived);
  if(!r || (!r.studyQuestion && r.kind!=='error'))throw new Error('题目不存在或尚未整理为刷题');
  if(!['attempt','confirm','dismiss'].includes(input.action))throw new Error('刷题操作无效');
  if(typeof input.eventId!=='string'||input.eventId.length>100)throw new Error('刷题事件编号无效');
  if(state.items[r.id]?.history?.some(h=>h.eventId===input.eventId))return state;
  if(input.revision!==state.revision){const e=new Error('刷题进度已被其他窗口更新，请刷新进度后重试');e.status=409;throw e;}
  if(input.action==='attempt'&&!r.details?.question)throw new Error('此错题暂无可自动判分的题目');
  const answer=normalizeAnswer(input.answer);
  const correct=input.action==='attempt'?gradeQuestion(r.details.question,answer,input.rating):null;
  if(input.action==='attempt'&&correct===null)throw new Error('请先选择答案；开放题请选择掌握、模糊或忘记');
  const result=applyEvent(state,{id:r.id,action:input.action,answer,correct,rating:input.rating,eventId:input.eventId,historicalWrong:!!r.studyQuestion?.historicalWrong,at:now()});
  atomic(file(),result);return result;
}
