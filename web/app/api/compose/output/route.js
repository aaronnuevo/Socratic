import { NextResponse } from 'next/server';
import { readdir, readFile, stat } from 'fs/promises';
import path from 'path';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const projectName = process.env.PROJECT_NAME || 'Socratic Project';
    const webCwd = process.cwd();
    const repoRoot = path.resolve(webCwd, '..');
    const projectDir = path.join(repoRoot, 'projects', projectName);

    // Read all files in the project directory
    let files;
    try {
      files = await readdir(projectDir);
    } catch (err) {
      return NextResponse.json({ error: `Project directory not found: ${projectDir}` }, { status: 404 });
    }

    // Filter for compose-*.md files
    const composePattern = /^compose-.*\.md$/;
    const composeFiles = files.filter(f => composePattern.test(f));

    if (composeFiles.length === 0) {
      return NextResponse.json({ error: 'No compose output files found', notYetRun: true }, { status: 404 });
    }

    // Find the most recently modified compose file
    let latestFile = null;
    let latestTime = 0;
    
    for (const file of composeFiles) {
      const filePath = path.join(projectDir, file);
      try {
        const stats = await stat(filePath);
        if (stats.mtimeMs > latestTime) {
          latestTime = stats.mtimeMs;
          latestFile = filePath;
        }
      } catch (err) {
        // Skip files we can't stat
        continue;
      }
    }

    if (!latestFile) {
      return NextResponse.json({ error: 'No valid compose output files found' }, { status: 404 });
    }

    // Read and return the latest file content
    try {
      const content = await readFile(latestFile, 'utf-8');
      return NextResponse.json({ content, filename: path.basename(latestFile) });
    } catch (err) {
      return NextResponse.json({ error: `Failed to read compose output: ${err.message}` }, { status: 500 });
    }

  } catch (err) {
    return NextResponse.json({ error: err?.message || 'Failed to get compose output' }, { status: 500 });
  }
}

