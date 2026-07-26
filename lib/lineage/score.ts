import { DependencyGraph, RuleFinding, ScanResult, ScanVerdict } from './types.js';

export function calculateScanResult(
  graph: DependencyGraph,
  findings: RuleFinding[],
  sourceUnavailable = false,
  warnings: string[] = []
): ScanResult {
  let score = 100;
  let criticalCount = 0;
  let highCount = 0;
  let mediumCount = 0;
  let lowCount = 0;

  for (const f of findings) {
    const sev = (f.severity || '').toLowerCase();
    if (sev === 'critical') {
      criticalCount++;
      score -= 50;
    } else if (sev === 'high') {
      highCount++;
      score -= 20;
    } else if (sev === 'medium') {
      mediumCount++;
      score -= 10;
    } else if (sev === 'low') {
      lowCount++;
      score -= 5;
    }
  }

  score = Math.max(0, Math.min(100, score));

  let verdict: ScanVerdict = 'PASS';
  if (criticalCount > 0) {
    verdict = 'BLOCK';
  } else if (score < 70) {
    verdict = 'REVIEW';
  }

  const directCount = graph.components.filter(c => c.direct !== false).length;
  const transitiveCount = graph.components.length - directCount;

  return {
    score,
    verdict,
    totalComponents: graph.components.length,
    directCount,
    transitiveCount,
    criticalCount,
    highCount,
    mediumCount,
    lowCount,
    findings,
    sourceUnavailable,
    warnings: warnings.length > 0 ? warnings : undefined
  };
}
