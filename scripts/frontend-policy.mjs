// Shared build/output policy. Diagnostics identify rules, never matched values.
export const publicEnvironmentKeys = new Set(['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']);
export function sensitiveContent(text) {
  return /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----|postgres(?:ql)?:\/\/[^\s/@]+:[^\s/@]+@|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{30,}|sk-(?:proj-)?[A-Za-z0-9_-]{40,}|sb_secret_[A-Za-z0-9_-]+|sess_[a-f0-9]{64}|dev_auto=true/.test(text) ||
    [...text.matchAll(/eyJ[A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+/g)].some(m => {
      try { return JSON.parse(Buffer.from(m[1], 'base64url').toString()).role === 'service_role'; }
      catch { return false; }
    });
}
function publicUrl(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; }
  catch { return false; }
}
function publicAnonKey(value) {
  if (!value || /^sb_publishable_[A-Za-z0-9_-]{16,}$/.test(value)) return true;
  try { return JSON.parse(Buffer.from(value.split('.')[1], 'base64url').toString()).role === 'anon'; }
  catch { return false; }
}
export function validateBrowserEnvironment(env) {
  for (const [key, value] of Object.entries(env)) {
    if (key.startsWith('VITE_') && (!publicEnvironmentKeys.has(key) || sensitiveContent(value) ||
      (key === 'VITE_SUPABASE_ANON_KEY' && !publicAnonKey(value)) ||
      (key === 'VITE_SUPABASE_URL' && value && !publicUrl(value))))
      throw Error('FRONTEND_ENVIRONMENT_REJECTED');
  }
}
export function backendModule(id) {
  const normalized = id.replaceAll('\\', '/').split('?')[0];
  const dependency = normalized.includes('/node_modules/');
  return (!dependency && /(?:^|\/)server(?:\/|\.[cm]?[jt]s$)|(?:^|\/)scripts\//.test(normalized)) ||
    /\/node_modules\/(?:pg|pg-pool|pg-protocol|dotenv|express|@google\/genai)\//.test(normalized) ||
    /\/node_modules\/react-dom\/server(?:[./]|$)/.test(normalized) ||
    normalized.startsWith('node:') || normalized.includes('__vite-browser-external');
}
