import { Component, DependencyGraph, LicensePolicy, RuleFinding, ScanResult } from '../types.js';
import { checkKnownMalicious, checkTyposquat } from '../sources/iocs.js';
import { PackageClaimResult } from '../sources/registry.js';
import { calculateScanResult } from '../score.js';

export async function evaluateRules(
  graph: DependencyGraph,
  osvFindingsOrRegistry?: Map<string, PackageClaimResult> | RuleFinding[],
  osvFindingsInput: RuleFinding[] = [],
  policy?: LicensePolicy
): Promise<ScanResult> {
  let registryResults: Map<string, PackageClaimResult>;
  let osvFindings: RuleFinding[];

  if (Array.isArray(osvFindingsOrRegistry)) {
    osvFindings = osvFindingsOrRegistry;
    registryResults = new Map();
  } else if (osvFindingsOrRegistry instanceof Map) {
    registryResults = osvFindingsOrRegistry;
    osvFindings = osvFindingsInput || [];
  } else {
    registryResults = new Map();
    osvFindings = Array.isArray(osvFindingsInput) ? osvFindingsInput : [];
  }

  const findings: RuleFinding[] = [];

  // Add OSV findings first
  if (Array.isArray(osvFindings)) {
    findings.push(...osvFindings);
  }

  for (const comp of graph.components) {
    const compKey = `${comp.ecosystem}:${comp.name}@${comp.version}`;
    const claim = registryResults.get(compKey) || {
      exists: comp.exists !== false,
      name: comp.name,
      version: comp.version,
      ecosystem: comp.ecosystem as 'npm' | 'pypi'
    };

    // 1. MALICIOUS_KNOWN (critical)
    const ioc = checkKnownMalicious(comp.ecosystem, comp.name, comp.version);
    if (ioc) {
      findings.push({
        ruleId: 'MALICIOUS_KNOWN',
        severity: ioc.severity || 'critical',
        component: comp.name,
        version: comp.version,
        title: `Known malicious component: ${comp.name}`,
        details: ioc.reason,
        cve: ioc.cve
      });
    }

    // 2. HALLUCINATED_PACKAGE (critical)
    if (claim.exists === false) {
      findings.push({
        ruleId: 'HALLUCINATED_PACKAGE',
        severity: 'critical',
        component: comp.name,
        version: comp.version,
        title: `Hallucinated package: ${comp.name}`,
        details: `Package '${comp.name}' does not exist in the public ${comp.ecosystem} registry. AI model may have hallucinated this dependency.`
      });
    }

    // 3. INSTALL_SCRIPT_RISK (high)
    if (comp.scripts) {
      const scriptKeys = Object.keys(comp.scripts).filter(k =>
        ['preinstall', 'install', 'postinstall', 'preuninstall', 'postuninstall'].includes(k)
      );
      if (scriptKeys.length > 0) {
        let details = `Lifecycle install scripts detected: ${scriptKeys.join(', ')}.`;
        let severity: 'critical' | 'high' = 'high';

        const scriptContent = Object.values(comp.scripts).join(' ').toLowerCase();
        if (
          scriptContent.includes('curl') ||
          scriptContent.includes('wget') ||
          scriptContent.includes('base64') ||
          scriptContent.includes('eval(') ||
          scriptContent.includes('/etc/passwd') ||
          scriptContent.includes('.aws/credentials')
        ) {
          severity = 'high';
          details += ' Escalated due to shell execution, network request, or credential path references.';
        }

        findings.push({
          ruleId: 'INSTALL_SCRIPT_RISK',
          severity,
          component: comp.name,
          version: comp.version,
          title: `Install script risk on ${comp.name}`,
          details
        });
      }
    }

    // 4. TYPOSQUAT_DISTANCE (high)
    const typoCheck = checkTyposquat(comp.ecosystem, comp.name);
    if (typoCheck.isTyposquat) {
      findings.push({
        ruleId: 'TYPOSQUAT_DISTANCE',
        severity: 'high',
        component: comp.name,
        version: comp.version,
        title: `Possible typosquat of popular package '${typoCheck.matchedPopular}'`,
        details: `Package '${comp.name}' has Levenshtein edit distance of ${typoCheck.distance} to popular package '${typoCheck.matchedPopular}'.`,
        target: typoCheck.matchedPopular
      });
    }

    // 5. DEPENDENCY_CONFUSION (high)
    const isInternalLooking = (
      comp.name.startsWith('@internal/') ||
      comp.name.startsWith('@corp/') ||
      comp.name.startsWith('@company/') ||
      comp.name.includes('internal-') ||
      comp.name.includes('private-')
    );
    if (isInternalLooking && claim.exists === true && !comp.name.startsWith('@')) {
      findings.push({
        ruleId: 'DEPENDENCY_CONFUSION',
        severity: 'high',
        component: comp.name,
        version: comp.version,
        title: `Potential dependency confusion risk for ${comp.name}`,
        details: `Package '${comp.name}' matches internal namespace patterns but resolves to a public registry package.`
      });
    }

    // 6. INTEGRITY_MISSING (medium)
    if (!comp.direct && !comp.integrity && !comp.resolvedUrl) {
      findings.push({
        ruleId: 'INTEGRITY_MISSING',
        severity: 'medium',
        component: comp.name,
        version: comp.version,
        title: `Missing integrity checksum for ${comp.name}`,
        details: `Lockfile entry for '${comp.name}@${comp.version}' lacks integrity hash / resolved URL.`
      });
    }

    // 7. PROVENANCE_MISSING (low)
    if (claim.exists && claim.provenance === false) {
      findings.push({
        ruleId: 'PROVENANCE_MISSING',
        severity: 'low',
        component: comp.name,
        version: comp.version,
        title: `Missing build provenance attestation for ${comp.name}`,
        details: `No published SLSA or build-provenance attestation found for '${comp.name}'.`
      });
    }

    // 8. MAINTAINER_THIN (medium)
    if (claim.exists && claim.maintainersCount === 1 && claim.publishAgeDays !== undefined && claim.publishAgeDays < 30) {
      findings.push({
        ruleId: 'MAINTAINER_THIN',
        severity: 'medium',
        component: comp.name,
        version: comp.version,
        title: `Single maintainer with recent publish date for ${comp.name}`,
        details: `Package '${comp.name}' has 1 maintainer and was published ${claim.publishAgeDays} days ago (< 30 days).`
      });
    }

    // 9. VERSION_FLOAT (medium)
    if (comp.direct) {
      const isUnpinned = ['*', 'latest'].includes(comp.version) || /^[\^~><]/.test(comp.version);
      if (isUnpinned) {
        findings.push({
          ruleId: 'VERSION_FLOAT',
          severity: 'medium',
          component: comp.name,
          version: comp.version,
          title: `Unpinned version range '${comp.version}' on direct dependency ${comp.name}`,
          details: `Direct dependency '${comp.name}' uses unpinned range '${comp.version}', introducing non-deterministic builds.`
        });
      }
    }

    // 10. DEPRECATED_OR_YANKED (medium)
    if (claim.deprecated || claim.yanked) {
      findings.push({
        ruleId: 'DEPRECATED_OR_YANKED',
        severity: 'medium',
        component: comp.name,
        version: comp.version,
        title: `Component ${comp.name} is ${claim.yanked ? 'yanked' : 'deprecated'}`,
        details: claim.deprecatedReason || `Package '${comp.name}' is marked as ${claim.yanked ? 'yanked' : 'deprecated'} in registry.`
      });
    }

    // 11. LICENSE_CONFLICT & 12. LICENSE_UNKNOWN
    const license = comp.license || 'UNKNOWN';
    if (license === 'UNKNOWN' || license === 'UNLICENSED' || !license.trim()) {
      findings.push({
        ruleId: 'LICENSE_UNKNOWN',
        severity: 'medium',
        component: comp.name,
        version: comp.version,
        title: `Unknown or missing license for ${comp.name}`,
        details: `Component '${comp.name}' has no declared or parseable license expression.`
      });
    } else {
      const isCopyleft = /GPL|AGPL|SSPL|EUPL|CC-BY-SA/i.test(license);

      if (isCopyleft) {
        findings.push({
          ruleId: 'LICENSE_CONFLICT',
          severity: 'high',
          component: comp.name,
          version: comp.version,
          title: `Copyleft license conflict (${license}) on ${comp.name}`,
          details: `License '${license}' introduces copyleft legal risk.`,
          spdx: license
        });
      }
    }

    // 13. TRANSITIVE_DEPTH_RISK (low)
    if (comp.transitiveDepth && comp.transitiveDepth > 3) {
      const hasCriticalFinding = findings.some(f => f.component === comp.name && f.severity === 'critical');
      if (hasCriticalFinding) {
        findings.push({
          ruleId: 'TRANSITIVE_DEPTH_RISK',
          severity: 'low',
          component: comp.name,
          version: comp.version,
          title: `Critical risk at deep transitive depth (${comp.transitiveDepth}) for ${comp.name}`,
          details: `Component '${comp.name}' is located at transitive depth ${comp.transitiveDepth}.`
        });
      }
    }
  }

  return calculateScanResult(graph, findings);
}
