#!/usr/bin/env node
const { execSync } = require('child_process');

const port = Number(process.argv[2]);

if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  console.error('[free-port] Invalid port. Usage: node scripts/free-port.js <port>');
  process.exit(1);
}

function getPidsOnWindows(targetPort) {
  try {
    const output = execSync(`netstat -ano -p tcp | findstr :${targetPort}`, {
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf8'
    });

    return [...new Set(
      output
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .filter((line) => /LISTENING/i.test(line))
        .map((line) => line.split(/\s+/).pop())
        .filter(Boolean)
    )];
  } catch {
    return [];
  }
}

function getPidsOnUnix(targetPort) {
  try {
    const output = execSync(`lsof -ti tcp:${targetPort}`, {
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf8'
    });

    return [...new Set(output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean))];
  } catch {
    return [];
  }
}

function killPid(pid) {
  if (process.platform === 'win32') {
    execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
    return;
  }

  execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
}

const pids = process.platform === 'win32' ? getPidsOnWindows(port) : getPidsOnUnix(port);

if (pids.length === 0) {
  console.log(`[free-port] Port ${port} is already free.`);
  process.exit(0);
}

let killed = 0;

for (const pid of pids) {
  try {
    killPid(pid);
    killed += 1;
  } catch (error) {
    console.warn(`[free-port] Failed to terminate PID ${pid}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (killed > 0) {
  console.log(`[free-port] Released port ${port} by terminating ${killed} process(es).`);
} else {
  console.warn(`[free-port] Could not terminate processes on port ${port}.`);
}
