import dotenv from 'dotenv';

/** Explicit development only; an .env cannot opt production or tests into loading. */
export function loadMigrationEnvironment(env: NodeJS.ProcessEnv, load = () => dotenv.config({quiet:true})) {
  if (env.NODE_ENV === 'development') load();
}
