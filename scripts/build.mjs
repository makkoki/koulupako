import { cp, mkdir, rm } from 'node:fs/promises';

const output = 'dist';

await rm(output, { recursive: true, force: true });
await mkdir(`${output}/vendor`, { recursive: true });

await Promise.all([
  cp('index.html', `${output}/index.html`),
  cp('style.css', `${output}/style.css`),
  cp('main.js', `${output}/main.js`),
  cp('.nojekyll', `${output}/.nojekyll`),
  cp(
    'node_modules/three/build/three.module.min.js',
    `${output}/vendor/three.module.min.js`,
  ),
]);

console.log('Koulupako 3D rakennettiin dist-kansioon.');
