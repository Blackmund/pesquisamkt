// Copies the single-page app's index.html to every path the site serves,
// so each page works when the build is served as plain static files.
import { mkdirSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const routes = [
  'login',
  'login/logout',
  'signup',
  'to/dwk6gt',
  'workspace',
  'builder',
  'f',
  'account',
  'project',
  'accounts/01M71R2K5KHS11H3M65ZEYW6ME/workspaces/2TWMSF',
];
for (const r of routes) {
  const dir = join(dist, r);
  mkdirSync(dir, { recursive: true });
  copyFileSync(join(dist, 'index.html'), join(dir, 'index.html'));
}
copyFileSync(join(dist, 'index.html'), join(dist, '404.html'));
console.log('Copied index.html to', routes.length, 'routes');
