import fs from 'node:fs';
import path from 'node:path';
import {syncShenlun,SHENLUN_ROOT} from './sync-shenlun.mjs';
if(fs.existsSync(path.join(SHENLUN_ROOT,'每日积累')))console.log(JSON.stringify(syncShenlun({apply:true,mirror:true})));
else console.log('本机未找到旧申论库，构建保留已有同步快照。');
