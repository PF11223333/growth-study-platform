import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
test('增量站点重建逐文件校验、删除旧文件并拒绝损坏及路径穿越',()=>{
 const run=spawnSync(process.env.GROWTH_PYTHON||'python',['-I','tests/test_site_bundle_delta.py'],{encoding:'utf8',windowsHide:true,timeout:30000});
 assert.equal(run.status,0,run.stderr||run.error?.message||run.stdout);
});
