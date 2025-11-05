import { NextResponse } from 'next/server';
import { readdir, readFile } from 'fs/promises';
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

    // Filter for concept*-synth.json files and sort by concept number
    const conceptPattern = /^concept(\d+)-synth\.json$/;
    const conceptFiles = files
      .filter(f => conceptPattern.test(f))
      .map(f => {
        const match = f.match(conceptPattern);
        return { name: f, number: parseInt(match[1], 10) };
      })
      .sort((a, b) => a.number - b.number);

    // Extract knowledge units from each file
    const allUnits = [];
    for (const { name } of conceptFiles) {
      try {
        const filePath = path.join(projectDir, name);
        const content = await readFile(filePath, 'utf-8');
        const data = JSON.parse(content);
        
        const knowledgeUnits = data.knowledge_units || [];
        for (const unit of knowledgeUnits) {
          allUnits.push({
            unit: unit,
            conceptFile: name
          });
        }
      } catch (err) {
        console.error(`Error processing ${name}:`, err.message);
      }
    }

    return NextResponse.json({ units: allUnits });
  } catch (err) {
    return NextResponse.json({ error: err?.message || 'Failed to list knowledge units' }, { status: 500 });
  }
}

