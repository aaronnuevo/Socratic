import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(req) {
  try {
    const url = new URL(req.url);
    let dir = url.searchParams.get('dir');
    if (!dir || dir.trim() === '') {
      dir = process.env.PROJECT_ROOT || process.cwd();
    }
    // Resolve and normalize the directory
    const absDir = path.resolve(dir);
    const stats = await fs.promises.stat(absDir);
    if (!stats.isDirectory()) {
      return NextResponse.json({ error: 'Not a directory' }, { status: 400 });
    }

    const entries = await fs.promises.readdir(absDir, { withFileTypes: true });
    const items = await Promise.all(
      entries.map(async (entry) => {
        const p = path.join(absDir, entry.name);
        let size = 0;
        try {
          const s = await fs.promises.stat(p);
          size = s.isFile() ? s.size : 0;
        } catch {}
        return {
          name: entry.name,
          path: p,
          isDir: entry.isDirectory(),
          size
        };
      })
    );

    // Sort: directories first, then files; alpha by name
    items.sort((a, b) => {
      if (a.isDir && !b.isDir) return -1;
      if (!a.isDir && b.isDir) return 1;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({ cwd: absDir, items });
  } catch (err) {
    const message = err?.message || 'Failed to read directory';
    const status = err?.code === 'ENOENT' ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}


