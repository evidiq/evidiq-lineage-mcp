import { DependencyGraph, SourceInput } from '../types.js';
import { parseNpmManifest } from './npm.js';
import { parsePypiManifest } from './pypi.js';

const MAX_INLINE_BYTES = 2 * 1024 * 1024; // 2 MiB
const MAX_COMPONENTS = 10000;

export function parseManifest(
  inputOrContent: SourceInput | string,
  fileNameArg?: string,
  ecosystemArg?: 'npm' | 'pypi'
): DependencyGraph {
  let content = '';
  let fileName = 'manifest';
  let ecosystem: 'npm' | 'pypi' = 'npm';

  if (typeof inputOrContent === 'object' && inputOrContent !== null) {
    content = inputOrContent.content || '';
    fileName = inputOrContent.fileName || 'manifest';
    ecosystem = inputOrContent.ecosystem === 'pypi' ? 'pypi' : 'npm';
  } else {
    content = String(inputOrContent || '');
    fileName = fileNameArg || 'manifest';
    ecosystem = ecosystemArg || 'npm';
  }

  if (ecosystem !== 'npm' && ecosystem !== 'pypi') {
    throw new Error(`Unsupported ecosystem '${ecosystem}'. v1 supports 'npm' and 'pypi'.`);
  }

  if (Buffer.byteLength(content, 'utf8') > MAX_INLINE_BYTES) {
    throw new Error(`Inline manifest exceeds maximum size limit of 2 MiB`);
  }

  let graph: DependencyGraph;
  if (ecosystem === 'npm') {
    graph = parseNpmManifest(fileName, content);
  } else {
    graph = parsePypiManifest(fileName, content);
  }

  if (graph.components.length > MAX_COMPONENTS) {
    throw new Error(`Manifest contains ${graph.components.length} components, exceeding maximum limit of ${MAX_COMPONENTS}`);
  }

  return graph;
}
