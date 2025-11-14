import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';

// Simple YAML parser for basic key: value format
function parseSimpleYaml(content) {
  const result = {};
  const lines = content.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    
    const colonIndex = trimmed.indexOf(':');
    if (colonIndex === -1) continue;
    
    const key = trimmed.substring(0, colonIndex).trim();
    const value = trimmed.substring(colonIndex + 1).trim();
    
    if (key && value) {
      result[key] = value;
    }
  }
  
  return result;
}

export async function GET() {
  try {
    const projectName = process.env.PROJECT_NAME || 'Socratic Project';
    const webCwd = process.cwd();
    const repoRoot = path.resolve(webCwd, '..');
    const projectDir = path.join(repoRoot, 'projects', projectName);
    const projectYamlPath = path.join(projectDir, 'project.yaml');

    // Check if project.yaml exists
    if (!fs.existsSync(projectYamlPath)) {
      return NextResponse.json(
        { error: 'Project configuration not found' },
        { status: 404 }
      );
    }

    // Read and parse project.yaml
    const content = await fs.promises.readFile(projectYamlPath, 'utf8');
    const projectData = parseSimpleYaml(content);

    // Validate that input_dir exists
    if (!projectData.input_dir) {
      return NextResponse.json(
        { error: 'input_dir not found in project configuration' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      projectName: projectData.project_name || projectName,
      inputDir: projectData.input_dir,
      createdAt: projectData.created_at
    });
  } catch (err) {
    return NextResponse.json(
      { error: err?.message || 'Failed to read project configuration' },
      { status: 500 }
    );
  }
}

