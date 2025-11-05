#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

function getProjectName(argv) {
  const index = argv.indexOf('--project');
  if (index !== -1 && argv[index + 1]) {
    return argv[index + 1];
  }
  return 'Socratic Project';
}

function clearNextCache(webDir) {
  const nextDir = path.join(webDir, '.next');
  if (fs.existsSync(nextDir)) {
    console.log('Clearing Next.js cache...');
    fs.rmSync(nextDir, { recursive: true, force: true });
  }
}

const projectName = getProjectName(process.argv.slice(2));
const repoRoot = path.resolve(__dirname, '..', '..');
const projectsDir = path.join(repoRoot, 'projects');
const projectDir = path.join(projectsDir, projectName);
const webDir = path.resolve(__dirname, '..');

// Ensure project directory exists
fs.mkdirSync(projectDir, { recursive: true });

// Clear Next.js cache
clearNextCache(webDir);

console.log(`Starting dev server for project: "${projectName}"`);
console.log(`Project directory: ${projectDir}`);

// Start Next.js dev server with environment variables
const child = spawn('npm', ['run', 'dev'], {
  cwd: webDir,
  stdio: 'inherit',
  env: { 
    ...process.env, 
    PROJECT_NAME: projectName, 
    PROJECT_ROOT: projectDir 
  }
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});

