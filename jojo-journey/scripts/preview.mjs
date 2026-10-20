#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const cache = join(root, '.preview-cache');
const args = process.argv.slice(2);
const portOption = args.findIndex(arg => arg === '--port' || arg.startsWith('--port='));
const port = portOption < 0 ? 5174 : Number(args[portOption].includes('=') ? args[portOption].split('=')[1] : args[portOption + 1]);
let child;
let stopping = false;
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => { stopping = true; if (child) child.kill(signal); else process.exit(0); });
}

function run(command, commandArgs, env = process.env) {
  return new Promise((resolve, reject) => {
    child = spawn(command, commandArgs, { cwd: root, stdio: 'inherit', env });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      child = undefined;
      if (stopping) process.exit(0);
      if (code === 0) resolve();
      else reject(new Error(`Command stopped ${signal ? `with ${signal}` : `with exit code ${code}`}.`));
    });
  });
}

try {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < 22 || (major === 22 && minor < 13)) throw new Error('Install Node.js 22.13 or newer, then run npm start again. You can also open JoJo-Journey.html directly without Node.');
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Choose a valid port, for example: npm start -- --port 5175');

  // Keep a fixed origin for browser saves. Never silently select a different port.
  await new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', error => reject(error.code === 'EADDRINUSE'
      ? new Error(`Port ${port} is already in use. Stop the existing server first, or choose another port with npm start -- --port ${port === 5174 ? 5175 : 5174}. Browser saves belong to their original address and port.`)
      : error));
    server.listen(port, '0.0.0.0', () => server.close(resolve));
  });

  const fingerprint = createHash('sha256')
    .update(await readFile(join(root, 'package.json')))
    .update(await readFile(join(root, 'package-lock.json')))
    .digest('hex');
  const stamp = join(cache, 'dependencies.sha256');
  let installed = false;
  try {
    installed = (await readFile(stamp, 'utf8')) === fingerprint;
    await access(join(root, 'node_modules/vite/bin/vite.js'));
    await access(join(root, 'node_modules/typescript/bin/tsc'));
  } catch { installed = false; }

  await mkdir(cache, { recursive: true });
  if (!installed) {
    console.log('\nJoJo Journey: installing the locked dependencies…\n');
    // npm supplies its CLI path for both `npm start` and `npm run preview`,
    // avoiding Windows .cmd shell quoting and keeping paths with spaces valid.
    if (!process.env.npm_execpath) throw new Error('Run this launcher with npm start or npm run preview.');
    await run(process.execPath, [process.env.npm_execpath, 'ci', '--no-audit', '--no-fund'], { ...process.env, npm_config_cache: join(cache, 'npm') });
    await writeFile(stamp, fingerprint);
  }

  console.log('\nJoJo Journey: building the latest preview…\n');
  await run(process.execPath, [join(root, 'node_modules/typescript/bin/tsc'), '--noEmit']);
  await run(process.execPath, [join(root, 'node_modules/vite/bin/vite.js'), 'build']);
  await run(process.execPath, [join(root, 'scripts/export-preview.mjs')]);
  console.log('\nPreview is starting. Keep this terminal open; press Ctrl+C to stop.\n');
  await run(process.execPath, [join(root, 'node_modules/vite/bin/vite.js'), 'preview', '--host', '0.0.0.0', '--port', '5174', '--strictPort', ...args]);
} catch (error) {
  console.error(`\nCould not start JoJo Journey: ${error instanceof Error ? error.message : error}\n`);
  process.exitCode = 1;
}
