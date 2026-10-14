import test from 'node:test';import assert from 'node:assert/strict';
import {gradeLower,summarizeLower} from '../scripts/lower-results.mjs';
test('red choice only: blue notes cannot make unknown answers right or wrong',()=>{
 assert.equal(gradeLower({type:'multi',referenceAnswer:'ABCD',originalAnswer:'ABC'}),'wrong');
 assert.equal(gradeLower({type:'single',referenceAnswer:'B',originalAnswer:'',blueAnswer:'B'}),'pending');
 assert.equal(gradeLower({type:'single',referenceAnswer:'B',originalAnswer:'A',keyNote:'争议'}),'excluded');
});
test('paper average is equal-weight, dispute excluded, unknown remains an interval',()=>{
 const q=(paperId,a,k,n='')=>({paperId,originalAnswer:a,referenceAnswer:k,keyNote:n,type:'multi',topic:'test'});
 const a=summarizeLower([{id:'one'},{id:'two'}],[q('one','AB','AB'),q('one','','AB'),q('one','C','C','争议'),q('two','A','AB')]);
 assert.equal(a.papers[0].lower,50);assert.equal(a.papers[0].upper,100);assert.equal(a.averageLower,25);assert.equal(a.averageUpper,50);assert.equal(a.multiErrors.omissions,1);
});
