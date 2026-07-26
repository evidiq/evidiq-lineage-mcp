import { Component, DependencyGraph } from '../types.js';

export function parseRequirementsTxt(content: string): DependencyGraph {
  const components: Component[] = [];
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('-r') || trimmed.startsWith('-e')) {
      continue;
    }

    const match = trimmed.match(/^([a-zA-Z0-9_\-\.]+)\s*([==|>=|<=|~=|>|<|!=].+)?/);
    if (match && match[1]) {
      const name = match[1];
      const rawVersion = match[2] ? match[2].trim() : '*';
      const cleanVersion = rawVersion.replace(/^[==|>=|<=|~=|>|<|!=]+/, '').trim() || '*';

      components.push({
        name,
        version: cleanVersion,
        ecosystem: 'pypi',
        purl: `pkg:pypi/${encodeURIComponent(name.toLowerCase())}@${encodeURIComponent(cleanVersion)}`,
        direct: true,
        transitiveDepth: 1
      });
    }
  }

  return { rootName: 'pypi-requirements', rootVersion: '1.0.0', ecosystem: 'pypi', components };
}

export function parsePoetryLock(content: string): DependencyGraph {
  const components: Component[] = [];
  const blocks = content.split(/\[\[package\]\]/g);

  for (const block of blocks) {
    if (!block.trim()) continue;
    const nameMatch = block.match(/name\s*=\s*"([^"]+)"/);
    const versionMatch = block.match(/version\s*=\s*"([^"]+)"/);

    if (nameMatch && nameMatch[1] && versionMatch && versionMatch[1]) {
      const name = nameMatch[1].trim();
      const version = versionMatch[1].trim();
      let integrity: string | undefined;

      const hashMatch = block.match(/hash\s*=\s*"([^"]+)"/);
      if (hashMatch) {
        integrity = hashMatch[1];
      }

      components.push({
        name,
        version,
        ecosystem: 'pypi',
        purl: `pkg:pypi/${encodeURIComponent(name.toLowerCase())}@${encodeURIComponent(version)}`,
        integrity,
        direct: true,
        transitiveDepth: 1
      });
    }
  }

  return { rootName: 'poetry-lock-project', rootVersion: '1.0.0', ecosystem: 'pypi', components };
}

export function parsePyprojectToml(content: string): DependencyGraph {
  const components: Component[] = [];
  const lines = content.split('\n');
  let inDepsSection = false;

  for (const line of lines) {
    let trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      const section = trimmed.slice(1, -1).toLowerCase();
      inDepsSection = section.includes('dependencies') || section.includes('poetry.dependencies');
      continue;
    }

    if (trimmed.startsWith('dependencies = [')) {
      inDepsSection = true;
      continue;
    }

    if (inDepsSection) {
      if (trimmed === ']' || trimmed === ')') {
        continue;
      }

      trimmed = trimmed.replace(/,$/, '').trim();

      // 1. PEP 621 string item: "requests>=2.28.0" or 'pydantic==1.10.2'
      const stringMatch = trimmed.match(/^["']([a-zA-Z0-9_\-\.]+)\s*([==|>=|<=|~=|>|<|!=].+)?["']/);
      if (stringMatch && stringMatch[1]) {
        const name = stringMatch[1];
        const rawVersion = stringMatch[2] ? stringMatch[2].trim() : '*';
        const cleanVersion = rawVersion.replace(/^[==|>=|<=|~=|>|<|!=]+/, '').trim() || '*';
        if (name.toLowerCase() !== 'python' && !['name', 'version', 'description', 'readme'].includes(name.toLowerCase()) && !components.some(c => c.name === name)) {
          components.push({
            name,
            version: cleanVersion,
            ecosystem: 'pypi',
            purl: `pkg:pypi/${encodeURIComponent(name.toLowerCase())}@${encodeURIComponent(cleanVersion)}`,
            direct: true,
            transitiveDepth: 1
          });
        }
        continue;
      }

      // 2. Poetry key-value: requests = "^2.28.0"
      const kvMatch = trimmed.match(/^([a-zA-Z0-9_\-\.]+)\s*=\s*"?([^"]+)"?/);
      if (kvMatch && kvMatch[1] && kvMatch[2]) {
        const name = kvMatch[1];
        const rawVersion = kvMatch[2].replace(/["',]/g, '').trim();
        if (name.toLowerCase() !== 'python' && !['name', 'version', 'description', 'readme'].includes(name.toLowerCase()) && !components.some(c => c.name === name)) {
          components.push({
            name,
            version: rawVersion,
            ecosystem: 'pypi',
            purl: `pkg:pypi/${encodeURIComponent(name.toLowerCase())}@${encodeURIComponent(rawVersion)}`,
            direct: true,
            transitiveDepth: 1
          });
        }
      }
    }
  }

  return { rootName: 'pyproject', rootVersion: '1.0.0', ecosystem: 'pypi', components };
}

export function parsePypiManifest(fileName: string, content: string): DependencyGraph {
  const lowerName = fileName.toLowerCase();

  if (lowerName.includes('requirements.txt')) {
    return parseRequirementsTxt(content);
  }

  if (lowerName.includes('poetry.lock')) {
    return parsePoetryLock(content);
  }

  if (lowerName.includes('pyproject.toml')) {
    return parsePyprojectToml(content);
  }

  throw new Error(`Unsupported pypi manifest name: ${fileName}`);
}
