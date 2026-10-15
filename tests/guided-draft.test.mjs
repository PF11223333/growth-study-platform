import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyGuidedState} from '../src/guided-state.mjs';
import {chooseGuidedDraft} from '../src/guided-draft.mjs';
const draft=(deviceId,updatedAt,done=false)=>({draftId:deviceId+updatedAt,deviceId,knowledgeId:'police-duty',updatedAt,values:{done,step:done?5:3,restatement:deviceId+'的复述'}});
const complete=at=>({eventId:'completed',deviceId:'desktop',knowledgeId:'police-duty',occurredAt:at,type:'complete',payload:{rating:'掌握',independentRecall:true}});
test('较早的本机完成稿不遮住新导入的手机未完成稿',()=>{
 const state=emptyGuidedState();state.drafts=[draft('desktop','2026-10-15T01:00:01Z',true),draft('phone','2026-10-15T02:00:00Z')];state.events=[complete('2026-10-15T01:00:00Z')];
 assert.equal(chooseGuidedDraft(state,'police-duty','desktop','2026-10-15').values.restatement,'phone的复述');
});
test('两台设备都有未完成稿时保留本机续写，并保留所有原版本',()=>{
 const state=emptyGuidedState();state.drafts=[draft('phone','2026-10-15T01:00:00Z'),draft('desktop','2026-10-15T02:00:00Z')];const before=structuredClone(state);
 assert.equal(chooseGuidedDraft(state,'police-duty','phone','2026-10-15').values.restatement,'phone的复述');assert.deepEqual(state,before);
});
test('完成事件比草稿新时恢复完成状态，到期后开始新一轮',()=>{
 const state=emptyGuidedState();state.drafts=[draft('phone','2026-10-15T01:00:00Z')];state.events=[complete('2026-10-15T01:01:00Z')];
 assert.equal(chooseGuidedDraft(state,'police-duty','phone','2026-10-15').values.done,true);
 assert.deepEqual(chooseGuidedDraft(state,'police-duty','phone','2026-10-16').values,{});
});
test('最新已完成版本不会退回同设备更旧的未完成草稿',()=>{
 const state=emptyGuidedState();state.drafts=[draft('phone','2026-10-15T01:00:00Z'),draft('phone','2026-10-15T02:00:00Z',true)];
 assert.equal(chooseGuidedDraft(state,'police-duty','phone','2026-10-15').values.done,true);
});
