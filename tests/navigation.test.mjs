import test from 'node:test';import assert from 'node:assert/strict';import {routeHash} from '../src/navigation.mjs';
test('links with embedded filters and explicit lesson parameters reach the intended route',()=>{
 assert.equal(routeHash('drill?bank=police-lower-20261014&mode=wrong'),'#/drill?bank=police-lower-20261014&mode=wrong');
 assert.equal(routeHash('#/guided-review?lesson=guardian',{lesson:'police-duty'}),'#/guided-review?lesson=police-duty');
 const hash=routeHash('record/example',{from:'cards?subject=gongan&kind=memory',search:'监督 法律'});
 const params=new URLSearchParams(hash.split('?')[1]);assert.equal(params.get('from'),'cards?subject=gongan&kind=memory');assert.equal(params.get('search'),'监督 法律');
});
