import { Component, DependencyGraph } from '../types.js';

export function parsePackageJson(content: string, fileName = 'package.json'): DependencyGraph {
  let pkg: any = {};
  try {
    pkg = JSON.parse(content);
  } catch (err) {
    throw new Error(`Invalid package.json format: ${(err as Error).message}`);
  }

  const rootName = pkg.name || 'unnamed-pkg';
  const rootVersion = pkg.version || '0.0.0';

  const components: Component[] = [];
  const deps = { ...pkg.dependencies };
  const devDeps = { ...pkg.devDependencies };
  const scripts = pkg.scripts || {};

  for (const [name, versionSpec] of Object.entries<string>(deps)) {
    components.push({
      name,
      version: String(versionSpec),
      ecosystem: 'npm',
      purl: `pkg:npm/${encodeURIComponent(name)}@${encodeURIComponent(String(versionSpec))}`,
      direct: true,
      transitiveDepth: 1,
      scripts: scripts,
      dependencies: {}
    });
  }

  for (const [name, versionSpec] of Object.entries<string>(devDeps)) {
    if (!components.some(c => c.name === name)) {
      components.push({
        name,
        version: String(versionSpec),
        ecosystem: 'npm',
        purl: `pkg:npm/${encodeURIComponent(name)}@${encodeURIComponent(String(versionSpec))}`,
        direct: true,
        transitiveDepth: 1,
        scripts: scripts,
        dependencies: {}
      });
    }
  }

  return { rootName, rootVersion, ecosystem: 'npm', components };
}

export function parseNpmLockfile(content: string, fileName = 'package-lock.json'): DependencyGraph {
  let lock: any = {};
  try {
    lock = JSON.parse(content);
  } catch (err) {
    throw new Error(`Invalid package-lock.json format: ${(err as Error).message}`);
  }

  const components: Component[] = [];
  const rootName = lock.name || 'unnamed-lock';
  const rootVersion = lock.version || '0.0.0';
  const directNames = new Set<string>();

  if (lock.packages && lock.packages['']) {
    const rootPkg = lock.packages[''];
    const rootDeps = { ...rootPkg.dependencies, ...rootPkg.devDependencies };
    Object.keys(rootDeps).forEach(d => directNames.add(d));
  } else if (lock.dependencies) {
    Object.keys(lock.dependencies).forEach(d => directNames.add(d));
  }

  if (lock.packages) {
    for (const [key, pkgInfo] of Object.entries<any>(lock.packages)) {
      if (!key) continue; // skip root ''
      const name = key.replace(/^node_modules\//, '').replace(/^.*node_modules\//, '');
      const version = pkgInfo.version || '0.0.0';
      const isDirect = directNames.has(name) || key.indexOf('node_modules/') === key.lastIndexOf('node_modules/');
      const depth = (key.match(/node_modules/g) || []).length;

      components.push({
        name,
        version,
        ecosystem: 'npm',
        purl: `pkg:npm/${encodeURIComponent(name)}@${encodeURIComponent(version)}`,
        license: pkgInfo.license,
        integrity: pkgInfo.integrity,
        resolvedUrl: pkgInfo.resolved,
        direct: isDirect,
        transitiveDepth: depth,
        scripts: pkgInfo.scripts
      });
    }
  } else if (lock.dependencies) {
    const walkDeps = (depsObj: Record<string, any>, currentDepth: number) => {
      for (const [name, info] of Object.entries(depsObj)) {
        const version = info.version || '0.0.0';
        components.push({
          name,
          version,
          ecosystem: 'npm',
          purl: `pkg:npm/${encodeURIComponent(name)}@${encodeURIComponent(version)}`,
          integrity: info.integrity,
          resolvedUrl: info.resolved,
          direct: currentDepth === 1,
          transitiveDepth: currentDepth
        });

        if (info.dependencies) {
          walkDeps(info.dependencies, currentDepth + 1);
        }
      }
    };
    walkDeps(lock.dependencies, 1);
  }

  return { rootName, rootVersion, ecosystem: 'npm', components };
}

export function parseNpmManifest(fileName: string, content: string): DependencyGraph {
  const lowerName = fileName.toLowerCase();

  if (lowerName === 'package.json') {
    return parsePackageJson(content, fileName);
  }

  if (lowerName === 'package-lock.json') {
    return parseNpmLockfile(content, fileName);
  }

  if (lowerName.includes('yarn.lock')) {
    const components: Component[] = [];
    const lines = content.split('\n');
    let currentPkg: string | null = null;
    let currentVersion = '';
    let currentResolved = '';
    let currentIntegrity = '';

    const pushCurrent = () => {
      if (currentPkg && currentVersion) {
        const cleanName = currentPkg.replace(/@.+$/, '').replace(/^"/, '').replace(/"$/, '');
        components.push({
          name: cleanName,
          version: currentVersion,
          ecosystem: 'npm',
          purl: `pkg:npm/${encodeURIComponent(cleanName)}@${encodeURIComponent(currentVersion)}`,
          integrity: currentIntegrity || undefined,
          resolvedUrl: currentResolved || undefined,
          direct: true,
          transitiveDepth: 1
        });
      }
      currentPkg = null;
      currentVersion = '';
      currentResolved = '';
      currentIntegrity = '';
    };

    for (const line of lines) {
      if (line.endsWith(':') && !line.startsWith(' ') && !line.startsWith('#')) {
        pushCurrent();
        currentPkg = line.slice(0, -1).trim();
      } else if (line.trim().startsWith('version')) {
        const match = line.match(/version\s+"?([^"]+)"?/);
        if (match && match[1]) currentVersion = match[1];
      } else if (line.trim().startsWith('resolved')) {
        const match = line.match(/resolved\s+"?([^"]+)"?/);
        if (match && match[1]) currentResolved = match[1];
      } else if (line.trim().startsWith('integrity')) {
        const match = line.match(/integrity\s+"?([^"]+)"?/);
        if (match && match[1]) currentIntegrity = match[1];
      }
    }
    pushCurrent();

    return { rootName: 'yarn-project', rootVersion: '1.0.0', ecosystem: 'npm', components };
  }

  if (lowerName.includes('pnpm-lock.yaml')) {
    const components: Component[] = [];
    const lines = content.split('\n');
    let inPackages = false;

    for (const line of lines) {
      if (line.startsWith('packages:')) {
        inPackages = true;
        continue;
      }
      if (inPackages && line && !line.startsWith(' ') && !line.startsWith('packages:')) {
        inPackages = false;
      }

      if (inPackages) {
        const match = line.match(/^\s+'?\/?([^@:]+)@([^':\s()]+)/) || line.match(/^\s+'?\/?([^@:]+)\/([^':\s()]+)/);
        if (match) {
          const name = match[1];
          const version = match[2];
          if (name && version && !components.some(c => c.name === name && c.version === version)) {
            components.push({
              name,
              version,
              ecosystem: 'npm',
              purl: `pkg:npm/${encodeURIComponent(name)}@${encodeURIComponent(version)}`,
              direct: false,
              transitiveDepth: 2
            });
          }
        }
      }
    }

    return { rootName: 'pnpm-project', rootVersion: '1.0.0', ecosystem: 'npm', components };
  }

  throw new Error(`Unsupported npm lockfile / manifest name: ${fileName}`);
}
