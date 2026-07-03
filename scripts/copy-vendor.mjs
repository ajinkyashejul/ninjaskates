// Copy three.js into public/vendor so the client is a plain static directory
// (required for Cloudflare Workers static assets; also used by the Node server).
import { mkdirSync, copyFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
mkdirSync(join(root, 'public', 'vendor'), { recursive: true });
copyFileSync(
  join(root, 'node_modules', 'three', 'build', 'three.module.js'),
  join(root, 'public', 'vendor', 'three.module.js'),
);
