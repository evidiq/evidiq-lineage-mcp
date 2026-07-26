import { createHash } from 'crypto';
import { privateKeyToAccount } from 'viem/accounts';
import { verifyMessage } from 'viem';
import { LineageReport, ScanResult } from './types.js';
import { getIocDatasetVersion } from './sources/iocs.js';
import { storeArtifact } from '../artifacts/index.js';

export function createCanonicalReportBody(result: ScanResult, request: any, sourceAvailable = true): any {
  return {
    version: '1.0.0',
    request: {
      ecosystem: request?.ecosystem || 'unknown',
      fileName: request?.fileName || 'manifest',
      inputDigest: request?.inputDigest || '',
      inputByteCount: request?.inputByteCount || 0
    },
    result,
    metadata: {
      engineVersion: '0.1.0',
      ruleCatalogVersion: '1.0.0',
      iocDatasetVersion: getIocDatasetVersion(),
      sourceAvailable
    }
  };
}

export function computeReportDigest(reportBody: any): string {
  const canonicalString = JSON.stringify(reportBody);
  return createHash('sha256').update(canonicalString, 'utf8').digest('hex');
}

export async function signDigest(digest: string, privateKey: string): Promise<{ signature: string; signer: string }> {
  try {
    const formattedKey = (privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`) as `0x${string}`;
    const account = privateKeyToAccount(formattedKey);
    const messageToSign = `EVIDIQ Lineage Report Digest: ${digest}`;
    const signature = await account.signMessage({ message: messageToSign });
    return { signature, signer: account.address };
  } catch (err) {
    return { signature: '', signer: '' };
  }
}

export async function buildSignedLineageReport(
  result: ScanResult,
  request: any,
  sourceAvailable = true
): Promise<{ report: LineageReport; artifactId: string }> {
  const body = createCanonicalReportBody(result, request, sourceAvailable);
  const digest = computeReportDigest(body);
  const reportId = `lin-${digest.slice(0, 16)}`;

  let signature: string | undefined;
  let signer: string | undefined;

  const envKey = process.env.LINEAGE_SIGNER_PRIVATE_KEY;
  if (envKey) {
    const signed = await signDigest(digest, envKey);
    signature = signed.signature;
    signer = signed.signer;
  } else if (process.env.LINEAGE_SIGNER_ADDRESS) {
    signer = process.env.LINEAGE_SIGNER_ADDRESS;
  }

  const report: LineageReport = {
    reportId,
    timestamp: new Date().toISOString(),
    request: body.request,
    result,
    integrity: {
      digest,
      signature,
      signer: signer || process.env.LINEAGE_SIGNER_ADDRESS || '0x0000000000000000000000000000000000000000'
    },
    metadata: body.metadata,
    storageNote: '0G anchor available on demand'
  };

  const { artifactId } = storeArtifact(report, 'report');
  return { report, artifactId };
}

export async function verifyLineageReport(reportObj: any): Promise<{
  integrityValid: boolean;
  authentic: boolean;
  signer: string;
  reportId: string;
  timestamp: string;
  error?: string;
}> {
  try {
    if (!reportObj || !reportObj.integrity || !reportObj.result) {
      return { integrityValid: false, authentic: false, signer: '', reportId: '', timestamp: '', error: 'Invalid report structure' };
    }

    const body = createCanonicalReportBody(reportObj.result, reportObj.request, reportObj.metadata?.sourceAvailable !== false);
    const computedDigest = computeReportDigest(body);
    const integrityValid = computedDigest === reportObj.integrity.digest;

    let authentic = false;
    const signer = reportObj.integrity.signer || '';

    if (integrityValid && reportObj.integrity.signature && signer) {
      try {
        const messageToVerify = `EVIDIQ Lineage Report Digest: ${computedDigest}`;
        const isValidSig = await verifyMessage({
          address: signer as `0x${string}`,
          message: messageToVerify,
          signature: reportObj.integrity.signature as `0x${string}`
        });
        authentic = isValidSig;
      } catch (e) {
        authentic = false;
      }
    }

    return {
      integrityValid,
      authentic,
      signer,
      reportId: reportObj.reportId || '',
      timestamp: reportObj.timestamp || new Date().toISOString()
    };
  } catch (err) {
    return {
      integrityValid: false,
      authentic: false,
      signer: '',
      reportId: '',
      timestamp: '',
      error: (err as Error).message
    };
  }
}
