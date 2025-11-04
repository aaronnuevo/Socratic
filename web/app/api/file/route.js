import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(req) {
  const projectRoot = process.env.PROJECT_ROOT;
  try {
    const { searchParams } = new URL(req.url);
    const inputPath = searchParams.get('path') || '';
    if (!inputPath) {
      return NextResponse.json({ error: 'Missing path parameter' }, { status: 400 });
    }

    // Determine absolute path: allow absolute path, else resolve relative to project root
    let absPath;
    if (inputPath.startsWith('/')) {
      absPath = path.resolve(inputPath);
    } else {
      if (!projectRoot) {
        return NextResponse.json({ error: 'PROJECT_ROOT is not set' }, { status: 500 });
      }
      absPath = path.resolve(projectRoot, inputPath);
      const normalizedRoot = path.resolve(projectRoot) + path.sep;
      if (!absPath.startsWith(normalizedRoot)) {
        return NextResponse.json({ error: 'Path traversal detected' }, { status: 400 });
      }
    }

    const stat = await fs.promises.stat(absPath);
    if (!stat.isFile()) {
      return NextResponse.json({ error: 'Not a file' }, { status: 400 });
    }
    const content = await fs.promises.readFile(absPath, 'utf8');
    return NextResponse.json({ path: absPath, content });
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
    return NextResponse.json({ error: err?.message || 'Failed to read file' }, { status: 500 });
  }
}


