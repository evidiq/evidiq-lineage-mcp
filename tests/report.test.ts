import { describe, it, expect } from 'vitest';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { buildSignedLineageReport, verifyLineageReport } from '../lib/lineage/report.js';
import { ScanResult } from '../lib/lineage/types.js';

describe('Report generation and EIP-191 signing', () => {
  const dummyScanResult: ScanResult = {
    verdict: 'PASS',
    score: 100,
    totalComponents: 2,
    directCount: 2,
    transitiveCount: 0,
    criticalCount: 0,
    highCount: 0,
    mediumCount: 0,
    lowCount: 0,
    findings: []
  };

  it('generates report digest and signs with EIP-191 when private key provided', async () => {
    const pkey = generatePrivateKey();
    const account = privateKeyToAccount(pkey);
    process.env.LINEAGE_SIGNER_PRIVATE_KEY = pkey;

    const { report, artifactId } = await buildSignedLineageReport(dummyScanResult, {
      ecosystem: 'npm',
      fileName: 'package.json'
    });

    expect(report.reportId).toMatch(/^lin-[0-9a-f]{16}$/);
    expect(report.integrity.digest).toBeDefined();
    expect(report.integrity.signature).toBeDefined();
    expect(report.integrity.signer).toBe(account.address);
    expect(artifactId).toMatch(/^art-[0-9a-f]{16}$/);

    const verification = await verifyLineageReport(report);
    expect(verification.integrityValid).toBe(true);
    expect(verification.authentic).toBe(true);

    delete process.env.LINEAGE_SIGNER_PRIVATE_KEY;
  });

  it('detects report tampering', async () => {
    const pkey = generatePrivateKey();
    process.env.LINEAGE_SIGNER_PRIVATE_KEY = pkey;

    const { report } = await buildSignedLineageReport(dummyScanResult, {
      ecosystem: 'npm',
      fileName: 'package.json'
    });

    // Tamper with verdict
    const tamperedReport = JSON.parse(JSON.stringify(report));
    tamperedReport.result.verdict = 'BLOCK';

    const verification = await verifyLineageReport(tamperedReport);
    expect(verification.integrityValid).toBe(false);
    expect(verification.authentic).toBe(false);

    delete process.env.LINEAGE_SIGNER_PRIVATE_KEY;
  });
});
