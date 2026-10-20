import { copyFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
await copyFile(join(root, 'dist/index.html'), join(root, 'JoJo-Journey.html'));
console.log('Standalone preview updated: JoJo-Journey.html');
