let rows:{id:string;text:string}[]=[];
self.onmessage=(event:MessageEvent)=>{const {type,data,query,seq}=event.data;if(type==='init'){rows=data;return;}const terms=String(query).toLowerCase().trim().split(/\s+/).filter(Boolean);self.postMessage({seq,ids:rows.filter(row=>terms.every(t=>row.text.includes(t))).map(r=>r.id)});};
export {};
