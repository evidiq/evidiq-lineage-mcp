import { generateCycloneDX16, generateSPDX30 } from './sbom.js';
import { generateAIBOM } from './aibom.js';
import { DependencyGraph, AIStackInput, AIBOMReport } from './types.js';

export function generateSbom(graph: DependencyGraph, format: 'cyclonedx' | 'spdx' = 'cyclonedx') {
  if (format === 'spdx') {
    return generateSPDX30(graph);
  }
  return generateCycloneDX16(graph);
}

export function generateAibom(stack: AIStackInput, artifactId: string): AIBOMReport {
  return generateAIBOM(stack, artifactId);
}
