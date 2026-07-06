// Copy runtime assets (three.js, fonts) into public/vendor so the client is
// a plain static directory (required for Cloudflare Workers static assets;
// also used by the Node server).
import { mkdirSync, copyFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
mkdirSync(join(root, 'public', 'vendor', 'fonts'), { recursive: true });

copyFileSync(
  join(root, 'node_modules', 'three', 'build', 'three.module.js'),
  join(root, 'public', 'vendor', 'three.module.js'),
);

for (const weight of [400, 700, 800]) {
  copyFileSync(
    join(root, 'node_modules', '@fontsource', 'baloo-2', 'files', `baloo-2-latin-${weight}-normal.woff2`),
    join(root, 'public', 'vendor', 'fonts', `baloo-2-${weight}.woff2`),
  );
}
