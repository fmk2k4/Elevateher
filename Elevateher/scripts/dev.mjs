/* ElevateHer Development Launcher

Starts all services concurrently in a platform-agnostic way.
Works on Windows (cmd.exe, PowerShell), macOS, and Linux.

Usage:
    node scripts/dev.mjs
    npm run dev
*/

import { spawn } from 'node:child_process';
import { platform } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

const isWindows = platform() === 'win32';
const shell = true;
import { existsSync } from 'node:fs';

function findPython() {
  const candidates = isWindows
    ? [
        join(rootDir, '.venv', 'Scripts', 'python.exe'),
        join(rootDir, '.venv-1', 'Scripts', 'python.exe'),
        'python',
      ]
    : [
        join(rootDir, '.venv', 'bin', 'python'),
        join(rootDir, '.venv-1', 'bin', 'python'),
        'python3',
        'python',
      ];
  for (const c of candidates) {
    if (c.includes('/') || c.includes('\\')) {
      if (existsSync(c)) return c;
    } else {
      return c;
    }
  }
  return isWindows ? 'python' : 'python3';
}

const pythonBin = findPython();

// Services to start
const services = [
  {
    name: 'Web App',
    command: isWindows ? 'npm.cmd' : 'npm',
    args: ['run', 'dev:web'],
    cwd: rootDir,
    color: '\x1b[36m', // cyan
  },
  {
    name: 'Dashboard',
    command: isWindows ? 'npm.cmd' : 'npm',
    args: ['run', 'dev:dashboard'],
    cwd: rootDir,
    color: '\x1b[35m', // magenta
  },
  {
    name: 'API',
    command: pythonBin,
    args: ['-m', 'uvicorn', 'main:app', '--reload', '--host', '0.0.0.0', '--port', '8000'],
    cwd: join(rootDir, 'services', 'api'),
    color: '\x1b[33m', // yellow
  },
];

console.log('\x1b[32m╔════════════════════════════════════════════════════════╗\x1b[0m');
console.log('\x1b[32m║        ElevateHer Development Environment              ║\x1b[0m');
console.log('\x1b[32m╠════════════════════════════════════════════════════════╣\x1b[0m');
console.log('\x1b[32m║  Web App:      http://localhost:3000                   ║\x1b[0m');
console.log('\x1b[32m║  Dashboard:    http://localhost:3001                   ║\x1b[0m');
console.log('\x1b[32m║  API:          http://localhost:8000                     ║\x1b[0m');
console.log('\x1b[32m║  API Docs:     http://localhost:8000/docs               ║\x1b[0m');
console.log('\x1b[32m╚════════════════════════════════════════════════════════╝\x1b[0m');
console.log('');

// Start each service
const children = [];

services.forEach(({ name, command, args, cwd }) => {
  const color = services.find((s) => s.name === name)?.color || '\x1b[0m';
  console.log(`${color}[Dev]${'\x1b[0m'} Starting ${name}...`);

  const child = spawn(command, args, {
    cwd,
    shell,
    stdio: 'inherit',
  });

  child.on('error', (err) => {
    console.error(`\x1b[31m[Error] ${name}: ${err.message}\x1b[0m`);
  });

  child.on('close', (code) => {
    if (code !== 0 && code !== null) {
      console.log(`\x1b[33m[Dev] ${name} exited with code ${code}\x1b[0m`);
    }
  });

  children.push(child);
});

// Handle shutdown gracefully
const shutdown = () => {
  console.log('\n\x1b[33m[Dev] Shutting down services...\x1b[0m');
  children.forEach((child) => {
    if (!child.killed) {
      child.kill('SIGTERM');
    }
  });
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);