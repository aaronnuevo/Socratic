import { NextResponse } from 'next/server';
import { readFile, writeFile } from 'fs/promises';
import path from 'path';

export const runtime = 'nodejs';

export async function POST(req) {
  try {
    const { promptName } = await req.json();
    
    if (!promptName) {
      return NextResponse.json({ error: 'Prompt name is required' }, { status: 400 });
    }

    const projectName = process.env.PROJECT_NAME || 'Socratic Project';
    const webCwd = process.cwd();
    const repoRoot = path.resolve(webCwd, '..');
    const projectDir = path.join(repoRoot, 'projects', projectName);
    const kbFilePath = path.join(projectDir, 'socratic_kbs.json');

    // Read the current KB file
    let kbData;
    try {
      const content = await readFile(kbFilePath, 'utf-8');
      kbData = JSON.parse(content);
    } catch (err) {
      if (err.code === 'ENOENT') {
        return NextResponse.json({ error: 'KB file not found' }, { status: 404 });
      }
      return NextResponse.json({ error: `Failed to read KB file: ${err.message}` }, { status: 500 });
    }

    // Check if the prompt exists
    if (!(promptName in kbData)) {
      return NextResponse.json({ error: 'Prompt not found in KB' }, { status: 404 });
    }

    // Delete the prompt
    delete kbData[promptName];

    // Write back to file
    try {
      await writeFile(kbFilePath, JSON.stringify(kbData, null, 2), 'utf-8');
      return NextResponse.json({ success: true, message: 'Prompt deleted successfully' });
    } catch (err) {
      return NextResponse.json({ error: `Failed to write KB file: ${err.message}` }, { status: 500 });
    }

  } catch (err) {
    return NextResponse.json({ error: err?.message || 'Failed to delete prompt' }, { status: 500 });
  }
}

