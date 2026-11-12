import {readdirSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {migrationSource,planMigrations} from '../server/phase21/migrations.js';
const readSources=(directory:string,proposal:boolean)=>readdirSync(directory).filter(f=>f.endsWith('.sql')).sort().map(file=>migrationSource(file.slice(0,-4),readFileSync(join(directory,file),'utf8'),proposal));
// Source-only planning: no dotenv, database modules, DDL runner or network dependencies.
const sources=[...readSources('supabase/migrations',false),...readSources('docs/migration-proposals',true)];
const plan=planMigrations(sources,[]);
console.log(JSON.stringify({mode:'SOURCE_ONLY_NO_DATABASE',...plan},null,2));
// A successful planning command is not a compatible baseline or migration authorization.
