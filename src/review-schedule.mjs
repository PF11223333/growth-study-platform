
export const reviewIntervals=[1,3,7,14,30];
export const reviewDay=at=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date(at));
export function scheduleReview(rating,stage=0,base=new Date(),lastAt=''){
 const day=reviewDay(base),sameDay=!!lastAt&&reviewDay(lastAt)===day;
 let nextStage,days;if(rating==='忘记'){nextStage=0;days=1;}else if(rating==='模糊'){nextStage=Math.max(0,stage-1);days=1;}else{nextStage=sameDay?stage:Math.min(stage+1,5);days=reviewIntervals[Math.max(0,Math.min(nextStage-1,4))];}
 const due=new Date(day+'T12:00:00+08:00');due.setUTCDate(due.getUTCDate()+days);return {nextReview:reviewDay(due),reviewStage:nextStage};
}
