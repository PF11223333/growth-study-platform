import {xingceSection,xingceSections} from './xingce-sections.mjs';

// Old imports and manually created questions use sectionId="xingce". Apply
// the same classification as the five-subject desk without rewriting IDs.
export function matchesPracticeSection(record,section=''){
 if(!section)return true;
 if(section.startsWith('xingce-')){
  const requested=section.slice('xingce-'.length);
  return record?.subject==='xingce'&&xingceSections.some(item=>item.id===requested)&&xingceSection(record)===requested;
 }
 return record?.studyQuestion?.sectionId===section;
}
