import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {sensitiveContent} from './frontend-policy.mjs';

export function auditFrontend(root = path.resolve('dist-client')) {
  const files = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, {withFileTypes:true})) {
      const full = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) throw Error('FRONTEND_SYMLINK_REJECTED');
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) files.push(full);
      else throw Error('FRONTEND_SPECIAL_FILE_REJECTED');
    }
  }
  if (fs.lstatSync(root).isSymbolicLink()) throw Error('FRONTEND_SYMLINK_REJECTED');
  walk(root);
  if (!fs.statSync(path.join(root, 'index.html')).isFile()) throw Error('FRONTEND_INDEX_MISSING');
  for (const file of files) {
    const relative = path.relative(root, file).replaceAll('\\','/');
    // Static HTML/CSS/JS/images/fonts only. No server code, manifests, SQL or secrets.
    if (!/^(?:index\.html|assets\/[\w./-]+\.(?:js|css|svg|png|jpe?g|webp|ico|woff2?|ttf))$/.test(relative) ||
        /(?:^|\/)(?:server|api|\.env[^/]*|credentials|service-account)(?:[./]|$)/i.test(relative))
      throw Error('FRONTEND_ARTIFACT_REJECTED');
    if (/\.(?:html|js|css|svg)$/.test(file) && sensitiveContent(fs.readFileSync(file,'utf8')))
      throw Error('FRONTEND_SENSITIVE_CONTENT');
  }
  return files.length;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { console.log(`PASS: ${auditFrontend()} frontend files; artifact and sensitive-content checks passed`); }
  catch { console.error('FAIL: Frontend artifact audit rejected output'); process.exitCode=1; }
}
