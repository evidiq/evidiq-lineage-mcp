import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface MaliciousIoc {
  ecosystem: string;
  name: string;
  versions: string[];
  reason: string;
  cve?: string;
  severity: 'critical' | 'high' | 'medium';
}

export interface IocDataset {
  version: string;
  updatedAt: string;
  packages: MaliciousIoc[];
}

export interface PopularNamesDataset {
  version: string;
  updatedAt: string;
  npm: string[];
  pypi: string[];
}

let cachedIocs: IocDataset | null = null;
let cachedPopular: PopularNamesDataset | null = null;

function loadIocs(): IocDataset {
  if (cachedIocs) return cachedIocs;
  const candidatePaths = [
    path.resolve(process.cwd(), 'data/malicious-iocs.json'),
    path.resolve(__dirname, '../../../data/malicious-iocs.json'),
    path.resolve(__dirname, '../../data/malicious-iocs.json')
  ];

  for (const p of candidatePaths) {
    try {
      if (fs.existsSync(p)) {
        const content = fs.readFileSync(p, 'utf8');
        cachedIocs = JSON.parse(content);
        return cachedIocs!;
      }
    } catch {}
  }

  return {
    version: '2026.07.1',
    updatedAt: new Date().toISOString(),
    packages: []
  };
}

function loadPopularNames(): PopularNamesDataset {
  if (cachedPopular) return cachedPopular;
  const candidatePaths = [
    path.resolve(process.cwd(), 'data/popular-names.json'),
    path.resolve(__dirname, '../../../data/popular-names.json'),
    path.resolve(__dirname, '../../data/popular-names.json')
  ];

  for (const p of candidatePaths) {
    try {
      if (fs.existsSync(p)) {
        const content = fs.readFileSync(p, 'utf8');
        cachedPopular = JSON.parse(content);
        return cachedPopular!;
      }
    } catch {}
  }

  return {
    version: '2026.07.1',
    updatedAt: new Date().toISOString(),
    npm: ['express', 'react', 'lodash', 'axios'],
    pypi: ['requests', 'urllib3', 'numpy', 'pandas']
  };
}

export function getIocDatasetVersion(): string {
  return loadIocs().version;
}

export function getMaliciousIocs(): MaliciousIoc[] {
  return loadIocs().packages;
}

export function getPopularNames(): PopularNamesDataset {
  return loadPopularNames();
}

export function checkKnownMalicious(ecosystem: string, name: string, version: string): MaliciousIoc | null {
  const dataset = loadIocs();
  const lowerName = name.toLowerCase();

  for (const item of dataset.packages) {
    if (item.ecosystem.toLowerCase() === ecosystem.toLowerCase() && item.name.toLowerCase() === lowerName) {
      if (item.versions.includes('*') || item.versions.includes(version)) {
        return item;
      }
    }
  }
  return null;
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) {
    const row: number[] = [];
    for (let j = 0; j <= a.length; j++) {
      if (i === 0) row.push(j);
      else if (j === 0) row.push(i);
      else row.push(0);
    }
    matrix.push(row);
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i]![j] = matrix[i - 1]![j - 1]!;
      } else {
        matrix[i]![j] = Math.min(
          matrix[i - 1]![j - 1]! + 1,
          Math.min(matrix[i]![j - 1]! + 1, matrix[i - 1]![j]! + 1)
        );
      }
    }
  }

  return matrix[b.length]![a.length]!;
}

export function checkTyposquat(ecosystem: string, name: string): { isTyposquat: boolean; matchedPopular?: string; distance?: number } {
  const popular = loadPopularNames();
  const list = ecosystem.toLowerCase() === 'npm' ? popular.npm : popular.pypi;
  const cleanName = name.toLowerCase().replace(/^@[^\/]+\//, '');

  for (const pop of list) {
    if (cleanName === pop) continue;
    const dist = levenshteinDistance(cleanName, pop);
    if (dist <= 2) {
      return { isTyposquat: true, matchedPopular: pop, distance: dist };
    }
  }

  return { isTyposquat: false };
}
