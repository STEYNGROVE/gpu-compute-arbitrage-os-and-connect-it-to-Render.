import dotenv from "dotenv";
/** Local developer convenience only. Deployed, test and production processes never load a file implicitly. */
export function loadDevelopmentMigrationEnvironment(
  env: NodeJS.ProcessEnv = process.env,
) {
  if (env.NODE_ENV !== "development" || env.RENDER || env.CI) return false;
  dotenv.config({ quiet: true, override: false, processEnv: env });
  return true;
}
