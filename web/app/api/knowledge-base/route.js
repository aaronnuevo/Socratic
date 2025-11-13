import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  const projectRoot = process.env.PROJECT_ROOT;
  
  if (!projectRoot) {
    return NextResponse.json({ error: 'PROJECT_ROOT is not set' }, { status: 500 });
  }

  try {
    const filePath = path.join(projectRoot, 'synth-consolidated.json');
    
    // Check if file exists
    try {
      await fs.promises.access(filePath);
    } catch {
      return NextResponse.json({ exists: false }, { status: 200 });
    }

    // Read and parse the file
    const content = await fs.promises.readFile(filePath, 'utf8');
    const data = JSON.parse(content);
    
    return NextResponse.json({ exists: true, data }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ error: err?.message || 'Failed to read knowledge base' }, { status: 500 });
  }
}

export async function POST(req) {
  const projectRoot = process.env.PROJECT_ROOT;
  
  if (!projectRoot) {
    return NextResponse.json({ error: 'PROJECT_ROOT is not set' }, { status: 500 });
  }

  try {
    const body = await req.json();
    const { knowledge_units } = body;

    if (!Array.isArray(knowledge_units)) {
      return NextResponse.json({ error: 'knowledge_units must be an array' }, { status: 400 });
    }

    const filePath = path.join(projectRoot, 'synth-consolidated.json');
    const data = { knowledge_units };
    
    // Write the file with pretty formatting
    await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
    
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ error: err?.message || 'Failed to save knowledge base' }, { status: 500 });
  }
}

