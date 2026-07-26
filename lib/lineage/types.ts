export type SupportedEcosystem = 'npm' | 'pypi' | 'cargo' | 'go' | 'maven';

export interface SourceInput {
  kind: 'inline' | 'url';
  ecosystem: SupportedEcosystem;
  fileName: string;
  content?: string;
  url?: string;
}

export interface Component {
  name: string;
  version: string;
  ecosystem: SupportedEcosystem;
  purl?: string;
  license?: string;
  direct?: boolean;
  integrity?: string;
  resolvedUrl?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  transitiveDepth?: number;
  maintainersCount?: number;
  publishAgeDays?: number;
  deprecated?: boolean;
  yanked?: boolean;
  provenance?: boolean;
  exists?: boolean;
}

export interface DependencyGraph {
  rootName?: string;
  rootVersion?: string;
  ecosystem: SupportedEcosystem;
  components: Component[];
}

export type RuleId =
  | 'MALICIOUS_KNOWN'
  | 'ADVISORY_KNOWN'
  | 'INSTALL_SCRIPT_RISK'
  | 'TYPOSQUAT_DISTANCE'
  | 'DEPENDENCY_CONFUSION'
  | 'HALLUCINATED_PACKAGE'
  | 'INTEGRITY_MISSING'
  | 'PROVENANCE_MISSING'
  | 'MAINTAINER_THIN'
  | 'VERSION_FLOAT'
  | 'DEPRECATED_OR_YANKED'
  | 'LICENSE_CONFLICT'
  | 'LICENSE_UNKNOWN'
  | 'TRANSITIVE_DEPTH_RISK';

export type RuleSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface RuleFinding {
  ruleId: RuleId;
  severity: RuleSeverity;
  component: string;
  version?: string;
  title: string;
  details: string;
  cve?: string;
  spdx?: string;
  target?: string;
}

export type ScanVerdict = 'PASS' | 'REVIEW' | 'BLOCK';

export interface ScanResult {
  score: number;
  verdict: ScanVerdict;
  totalComponents: number;
  directCount: number;
  transitiveCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  findings: RuleFinding[];
  sourceUnavailable?: boolean;
  warnings?: string[];
}

export interface ReportIntegrity {
  digest: string;
  signature?: string;
  signer?: string;
}

export interface LineageReportMetadata {
  engineVersion: string;
  ruleCatalogVersion: string;
  iocDatasetVersion: string;
  sourceAvailable: boolean;
}

export interface LineageReport {
  reportId: string;
  timestamp: string;
  request: {
    ecosystem?: string;
    fileName?: string;
    inputDigest?: string;
    inputByteCount?: number;
  };
  result: ScanResult;
  integrity: ReportIntegrity;
  metadata: LineageReportMetadata;
  storageRoot?: string;
  storageTx?: string;
  storageNote?: string;
}

export interface LicensePolicy {
  policyName?: 'permissive-only' | 'no-copyleft' | 'commercial-safe';
  allowedLicenses?: string[];
  blockedLicenses?: string[];
}

export interface LicenseAuditResult {
  componentsAnalyzed: number;
  compliantCount: number;
  conflictCount: number;
  unknownCount: number;
  policy: string;
  findings: RuleFinding[];
  summary: Record<string, number>;
}

export interface AIModelSpec {
  name: string;
  version: string;
  license?: string;
  provider?: string;
  digest?: string;
}

export interface AIDatasetSpec {
  name: string;
  version: string;
  license?: string;
  url?: string;
  digest?: string;
}

export interface AIMcpServerSpec {
  name: string;
  version: string;
  endpoint?: string;
  license?: string;
}

export interface AISkillSpec {
  name: string;
  version: string;
  author?: string;
  hash?: string;
}

export interface AIStackInput {
  models?: AIModelSpec[];
  datasets?: AIDatasetSpec[];
  mcpServers?: AIMcpServerSpec[];
  skills?: AISkillSpec[];
}

export interface AIBOMReport {
  artifactId: string;
  timestamp: string;
  format: 'CycloneDX-AI-1.6';
  stack: AIStackInput;
  summary: {
    modelCount: number;
    datasetCount: number;
    mcpServerCount: number;
    skillCount: number;
    licenseRiskCount: number;
  };
  licensePosture: Array<{
    component: string;
    type: 'model' | 'dataset' | 'mcp' | 'skill';
    license: string;
    risk: 'clean' | 'review' | 'blocked';
  }>;
  bom: any;
  reportId: string;
  integrity: ReportIntegrity;
}
