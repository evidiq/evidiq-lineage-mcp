import { Component, RuleFinding } from '../types.js';

interface OsvAdvisory {
  id: string;
  summary?: string;
  details?: string;
  severity?: Array<{ type: string; score: string }>;
  aliases?: string[];
}

export interface OsvQueryResult {
  sourceUnavailable: boolean;
  advisories: RuleFinding[];
}

export async function fetchOsvAdvisories(components: Component[], timeoutMs = 8000): Promise<OsvQueryResult> {
  const osvBase = process.env.OSV_BASE_URL || 'https://api.osv.dev';
  const url = `${osvBase}/v1/querybatch`;

  const queries = components.map(c => ({
    package: {
      name: c.name,
      ecosystem: c.ecosystem === 'npm' ? 'npm' : 'PyPI'
    },
    version: c.version && c.version !== '*' ? c.version : undefined
  }));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queries }),
      signal: controller.signal
    });

    clearTimeout(timer);

    if (!res.ok) {
      return { sourceUnavailable: true, advisories: [] };
    }

    const data: any = await res.json();
    const findings: RuleFinding[] = [];

    if (data.results && Array.isArray(data.results)) {
      data.results.forEach((resItem: any, idx: number) => {
        const comp = components[idx];
        if (!comp || !resItem.vulns || !Array.isArray(resItem.vulns)) return;

        for (const vuln of resItem.vulns as OsvAdvisory[]) {
          const cve = (vuln.aliases || []).find(a => a.startsWith('CVE-')) || vuln.id;
          let severity: 'critical' | 'high' | 'medium' | 'low' = 'high';

          if (vuln.severity && Array.isArray(vuln.severity)) {
            const cvss = vuln.severity.find(s => s.type === 'CVSS_V3')?.score;
            if (cvss) {
              const numScore = parseFloat(cvss.split('/')[0]?.replace('CVSS:3.1/S:', '') || '7.5');
              if (numScore >= 9.0) severity = 'critical';
              else if (numScore >= 7.0) severity = 'high';
              else if (numScore >= 4.0) severity = 'medium';
              else severity = 'low';
            }
          }

          findings.push({
            ruleId: 'ADVISORY_KNOWN',
            severity,
            component: comp.name,
            version: comp.version,
            title: `Advisory match ${cve} for ${comp.name}`,
            details: vuln.summary || vuln.details || `Known vulnerability ${vuln.id} affects ${comp.name}@${comp.version}`,
            cve
          });
        }
      });
    }

    return { sourceUnavailable: false, advisories: findings };
  } catch (err) {
    clearTimeout(timer);
    return { sourceUnavailable: true, advisories: [] };
  }
}

export const queryOsvAdvisories = fetchOsvAdvisories;
