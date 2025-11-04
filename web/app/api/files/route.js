import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

async function listFilesRecursive(rootDir) {
  const results = [];
  async function walk(currentDir) {
    const entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(entryPath);
      } else if (entry.isFile()) {
        const relPath = path.relative(rootDir, entryPath);
        results.push(relPath);
      }
    }
  }
  await walk(rootDir);
  return results.sort();
}

export async function GET() {
  const projectRoot = process.env.PROJECT_ROOT;
  if (!projectRoot) {
    return NextResponse.json({ error: 'PROJECT_ROOT is not set' }, { status: 500 });
  }
  try {
    const stats = await fs.promises.stat(projectRoot);
    if (!stats.isDirectory()) {
      return NextResponse.json({ error: 'PROJECT_ROOT is not a directory' }, { status: 500 });
    }
    const files = await listFilesRecursive(projectRoot);
    return NextResponse.json({ files });
  } catch (err) {
    return NextResponse.json({ error: err?.message || 'Failed to list files' }, { status: 500 });
  }
}


