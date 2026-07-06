// Copy runtime assets (three.js, loaders, postprocessing, fonts) into
// public/vendor so the client is a plain static directory (required for
// Cloudflare Workers static assets; also used by the Node server).
import { mkdirSync, copyFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const vendor = (...p) => join(root, 'public', 'vendor', ...p);
mkdirSync(vendor('fonts'), { recursive: true });
mkdirSync(vendor('loaders'), { recursive: true });
mkdirSync(vendor('utils'), { recursive: true });

const three = (...p) => join(root, 'node_modules', 'three', ...p);

// core builds (three.module.js re-exports from three.core.js)
copyFileSync(three('build', 'three.module.js'), vendor('three.module.js'));
copyFileSync(three('build', 'three.core.js'), vendor('three.core.js'));

// example loaders (import 'three' bare — resolved by the page's import map)
for (const f of ['RGBELoader.js', 'HDRLoader.js', 'GLTFLoader.js']) {
  copyFileSync(three('examples', 'jsm', 'loaders', f), vendor('loaders', f));
}
for (const f of ['BufferGeometryUtils.js', 'SkeletonUtils.js']) {
  copyFileSync(three('examples', 'jsm', 'utils', f), vendor('utils', f));
}

// pmndrs postprocessing ESM build
copyFileSync(
  join(root, 'node_modules', 'postprocessing', 'build', 'index.js'),
  vendor('postprocessing.js'),
);

for (const weight of [400, 700, 800]) {
  copyFileSync(
    join(root, 'node_modules', '@fontsource', 'baloo-2', 'files', `baloo-2-latin-${weight}-normal.woff2`),
    vendor('fonts', `baloo-2-${weight}.woff2`),
  );
}
