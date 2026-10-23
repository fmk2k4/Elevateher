import { spawn } from 'node:child_process';

const command = process.platform === 'win32' ? 'npx.cmd react-router build' : 'npx react-router build';
const child = spawn(command, {
  shell: true,
  stdio: ['ignore', 'pipe', 'pipe'],
});

let exitCode = 1;
let finished = false;
let output = '';
const completionMarkers = ['asset cleaned from React Router server build', 'Build failed'];

function finish(code) {
  if (finished) return;
  finished = true;
  exitCode = code ?? exitCode;
  if (!child.killed) {
    child.kill('SIGTERM');
  }
  setTimeout(() => process.exit(exitCode), 250);
}

child.stdout.on('data', (chunk) => {
  const text = chunk.toString();
  process.stdout.write(text);
  output += text;
  if (completionMarkers.some((marker) => output.includes(marker))) {
    finish(0);
  }
});

child.stderr.on('data', (chunk) => {
  const text = chunk.toString();
  process.stderr.write(text);
  output += text;
  if (output.includes('Build failed')) {
    finish(1);
  }
});

child.on('exit', (code) => {
  if (finished) return;
  finish(code ?? 1);
});

setTimeout(() => {
  if (!finished) {
    process.stderr.write('Web build exceeded timeout and was stopped.\n');
    finish(1);
  }
}, 300000);
