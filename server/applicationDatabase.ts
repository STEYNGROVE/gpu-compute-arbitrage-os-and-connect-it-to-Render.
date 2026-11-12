import {pgDbService} from './pgDatabase.js';

/** All application adapters share the authenticated pool, readiness and fallback policy. */
export const applicationDatabase={
  query:(sql:string,params:any[]=[])=>pgDbService.query(sql,params),
  connect:()=>pgDbService.getClient()
};
export function configuredApplicationDatabase() {
  return process.env.DATABASE_URL ? applicationDatabase : null;
}

export type ApplicationDatabase=typeof applicationDatabase;
