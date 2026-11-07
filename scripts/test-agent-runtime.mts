import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const dir=await fs.mkdtemp(path.join(os.tmpdir(),'gpu-agents-'));
try {
  await fs.mkdir(path.join(dir,'agents'));
  const source=JSON.parse(await fs.readFile('agents/registry.json','utf8'));
  await fs.writeFile(path.join(dir,'agents/registry.json'),JSON.stringify(source));
  const data=[{title:'GPU compute rental',description:'We need the gpu compute for better things',source:'Hacker News',source_url:'https://news.ycombinator.com/item?id=48550666'},{title:'H100 GPU cloud capacity',description:'We need H100 GPU cloud capacity and are seeking quotes',source:'Company procurement',source_url:'https://example.org/rfq/1'}];
  const input=path.join(dir,'fixtures.json');await fs.writeFile(input,JSON.stringify(data));
  const runtime=path.resolve('agents/runtime.mts');
  const tsxCli=path.resolve('node_modules/tsx/dist/cli.mjs');
  const result=spawnSync(process.execPath,[tsxCli,runtime,input],{cwd:dir,encoding:'utf8'});
  if(result.status!==0) throw Error(result.stderr||result.stdout);
  const report=JSON.parse(await fs.readFile(path.join(dir,'reports','agent-triage-report.json'),'utf8'));
  if(report.categories.DISCUSSION_ONLY!==1||report.categories.BUYER_REQUEST_REVIEW!==1||report.outreachEnabled!==false||report.verifiedCustomers!==0) throw Error('REGRESSION_FAILED');
  console.log('PASS: discussion false-positive excluded; legitimate buyer request retained as unverified; no external actions');
} finally {await fs.rm(dir,{recursive:true,force:true});}
