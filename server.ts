import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { parseManifest } from "./lib/lineage/parse/index.js";
import { evaluateRules } from "./lib/lineage/rules/engine.js";
import { generateSbom, generateAibom } from "./lib/lineage/bom.js";
import { queryOsvAdvisories } from "./lib/lineage/sources/osv.js";
import { verifyPackageRegistryClaim } from "./lib/lineage/sources/registry.js";
import { getIocDatasetVersion, getMaliciousIocs, getPopularNames } from "./lib/lineage/sources/iocs.js";
import { buildSignedLineageReport, verifyLineageReport } from "./lib/lineage/report.js";
import { getArtifact } from "./lib/artifacts/index.js";
import { FREE_TOOL_NAMES, PAID_TOOL_NAMES, TOOL_PRICES } from "./lib/x402/config.js";

const LINEAGE_INSTRUCTIONS = `EVIDIQ Lineage — deterministic supply-chain provenance, SBOM/AI-BOM generation, and dependency risk analysis for AI-generated code.

Use validate_manifest before paying. Paid tools accept manifest/lockfile content or file path. All scans run deterministically against bundled IOC datasets and live OSV.dev advisories.

Five free tools: lineage_capabilities, validate_manifest, estimate_cost, verify_lineage_report, get_artifact.
Five x402-paid tools: verify_package_claim (0.005 USDT0), audit_licenses (0.01 USDT0), generate_sbom (0.015 USDT0), scan_dependencies (0.02 USDT0), generate_aibom (0.03 USDT0). Payment settles before work begins.`;

const paidToolSchema = z.enum(PAID_TOOL_NAMES);
const ecosystemSchema = z.enum(["npm", "pypi", "unknown"]).default("unknown");

function textResult(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

function resolveEcosystem(eco: string): 'npm' | 'pypi' {
  return eco === 'pypi' ? 'pypi' : 'npm';
}

export const handler = createMcpHandler(
  (server) => {
    // 1. lineage_capabilities (Free)
    server.registerTool(
      "lineage_capabilities",
      {
        title: "Lineage capabilities, supported ecosystems, and pricing",
        description: "Inspect supported manifest types, deterministic rule engine rules, dataset versions, and tool prices. Free.",
        inputSchema: {},
      },
      async () => textResult({
        service: "EVIDIQ Lineage",
        version: "0.1.0",
        purpose: "Supply-chain provenance, dependency risk analysis, and TEE-anchored BOM generation",
        ecosystems: ["npm (package.json, package-lock.json, yarn.lock, pnpm-lock.yaml)", "PyPI (requirements.txt, pyproject.toml, poetry.lock)"],
        datasetVersions: {
          maliciousIocs: getIocDatasetVersion(),
          rulesCatalog: "1.0.0"
        },
        rulesCount: 14,
        tools: [
          ...PAID_TOOL_NAMES.map((name) => ({ name, paid: true, amountAtomic: TOOL_PRICES[name].toString(), usdt0: Number(TOOL_PRICES[name]) / 1_000_000 })),
          ...FREE_TOOL_NAMES.map((name) => ({ name, paid: false, amountAtomic: "0", usdt0: 0 })),
        ],
        payment: { protocol: "x402 v2", scheme: "exact", network: "eip155:196", asset: "USDT0", decimals: 6 },
      })
    );

    // 2. validate_manifest (Free)
    server.registerTool(
      "validate_manifest",
      {
        title: "Validate a manifest or lockfile syntax before payment",
        description: "Parse manifest/lockfile content or format without remote network calls. Free.",
        inputSchema: {
          content: z.string().min(1),
          fileName: z.string().optional(),
          ecosystem: ecosystemSchema
        },
      },
      async ({ content, fileName, ecosystem }) => {
        try {
          const parsed = parseManifest(content, fileName || 'manifest', resolveEcosystem(ecosystem));
          return textResult({
            valid: true,
            ecosystem: parsed.ecosystem,
            componentCount: parsed.components.length,
            directDependenciesCount: parsed.components.filter(c => c.direct !== false).length,
            sampleComponents: parsed.components.slice(0, 5).map(c => `${c.name}@${c.version}`)
          });
        } catch (err) {
          return textResult({
            valid: false,
            error: (err as Error).message
          });
        }
      }
    );

    // 3. estimate_cost (Free)
    server.registerTool(
      "estimate_cost",
      {
        title: "Quote a Lineage paid tool",
        description: "Return the immutable x402 price and execution details for one paid tool. Free.",
        inputSchema: { tool: paidToolSchema },
      },
      async ({ tool }) => {
        const amount = TOOL_PRICES[tool];
        return textResult({
          tool,
          amountAtomic: amount.toString(),
          amountUSDT0: Number(amount) / 1_000_000,
          network: "eip155:196",
          asset: "0x779ded0c9e1022225f8e0630b35a9b54be713736",
          symbol: "USDT0",
        });
      }
    );

    // 4. verify_lineage_report (Free)
    server.registerTool(
      "verify_lineage_report",
      {
        title: "Verify authenticity and signature of a Lineage report",
        description: "Cryptographically verify EIP-191 signature and SHA-256 digest of a generated report artifact. Free.",
        inputSchema: {
          report: z.any()
        },
      },
      async ({ report }) => {
        try {
          const verified = await verifyLineageReport(report);
          return textResult(verified);
        } catch (err) {
          return textResult({ integrityValid: false, authentic: false, error: (err as Error).message });
        }
      }
    );

    // 5. get_artifact (Free)
    server.registerTool(
      "get_artifact",
      {
        title: "Retrieve stored Lineage report artifact",
        description: "Retrieve a previously generated Lineage report or BOM artifact by ID. Free.",
        inputSchema: { artifactId: z.string().min(1) },
      },
      async ({ artifactId }) => {
        const artifact = getArtifact(artifactId);
        if (!artifact) {
          return textResult({ error: `Artifact ${artifactId} not found` });
        }
        return textResult(artifact);
      }
    );

    // 6. verify_package_claim (Paid: 0.005 USDT0)
    server.registerTool(
      "verify_package_claim",
      {
        title: "Verify a package claim against public registry",
        description: "Query npm/PyPI registry to verify package exists, version matches, and extract publisher metadata. Cost: 0.005 USDT0.",
        inputSchema: {
          name: z.string().min(1),
          version: z.string().min(1),
          ecosystem: z.enum(["npm", "pypi"])
        },
      },
      async ({ name, version, ecosystem }) => {
        try {
          const verification = await verifyPackageRegistryClaim(name, version, ecosystem);
          return textResult(verification);
        } catch (err) {
          return textResult({ name, version, ecosystem, exists: false, error: (err as Error).message });
        }
      }
    );

    // 7. audit_licenses (Paid: 0.01 USDT0)
    server.registerTool(
      "audit_licenses",
      {
        title: "Audit dependency licenses and legal compliance",
        description: "Check for copyleft (GPL/AGPL), incompatible, missing, or UNKNOWN licenses in manifest components. Cost: 0.01 USDT0.",
        inputSchema: {
          content: z.string().min(1),
          fileName: z.string().optional(),
          ecosystem: ecosystemSchema,
          allowCopyleft: z.boolean().default(false)
        },
      },
      async ({ content, fileName, ecosystem, allowCopyleft }) => {
        try {
          const parsed = parseManifest(content, fileName || 'manifest', resolveEcosystem(ecosystem));
          const osv = await queryOsvAdvisories(parsed.components);
          const scanResult = await evaluateRules(parsed, osv.advisories);
          
          const licenseFindings = scanResult.findings.filter(f => f.ruleId === 'LICENSE_CONFLICT' || f.ruleId === 'LICENSE_UNKNOWN');
          const summary = {
            verdict: scanResult.verdict,
            score: scanResult.score,
            totalComponents: scanResult.totalComponents,
            copyleftFindings: licenseFindings.filter(f => f.ruleId === 'LICENSE_CONFLICT'),
            unknownMissingFindings: licenseFindings.filter(f => f.ruleId === 'LICENSE_UNKNOWN'),
            compliant: licenseFindings.length === 0 || allowCopyleft
          };

          const { report, artifactId } = await buildSignedLineageReport(scanResult, { ecosystem: parsed.ecosystem, fileName: fileName || 'manifest' });
          return textResult({ summary, reportId: report.reportId, artifactId, report });
        } catch (err) {
          return textResult({ error: (err as Error).message });
        }
      }
    );

    // 8. generate_sbom (Paid: 0.015 USDT0)
    server.registerTool(
      "generate_sbom",
      {
        title: "Generate CycloneDX 1.6 or SPDX 3.0 SBOM",
        description: "Produce a standard Software Bill of Materials (SBOM) for compliance and auditing. Cost: 0.015 USDT0.",
        inputSchema: {
          content: z.string().min(1),
          fileName: z.string().optional(),
          ecosystem: ecosystemSchema,
          format: z.enum(["cyclonedx", "spdx"]).default("cyclonedx")
        },
      },
      async ({ content, fileName, ecosystem, format }) => {
        try {
          const parsed = parseManifest(content, fileName || 'manifest', resolveEcosystem(ecosystem));
          const sbom = generateSbom(parsed, format);
          return textResult({ format, sbom });
        } catch (err) {
          return textResult({ error: (err as Error).message });
        }
      }
    );

    // 9. scan_dependencies (Paid: 0.02 USDT0)
    server.registerTool(
      "scan_dependencies",
      {
        title: "Run comprehensive 14-rule supply-chain risk analysis",
        description: "Execute full rule engine: typosquatting, malicious IOCs, OSV vulnerabilities, install scripts, unpinned dependencies, etc. Cost: 0.02 USDT0.",
        inputSchema: {
          content: z.string().min(1),
          fileName: z.string().optional(),
          ecosystem: ecosystemSchema
        },
      },
      async ({ content, fileName, ecosystem }) => {
        try {
          const parsed = parseManifest(content, fileName || 'manifest', resolveEcosystem(ecosystem));
          const osv = await queryOsvAdvisories(parsed.components);
          const scanResult = await evaluateRules(parsed, osv.advisories);
          const { report, artifactId } = await buildSignedLineageReport(
            scanResult,
            { ecosystem: parsed.ecosystem, fileName: fileName || 'manifest' },
            osv.sourceUnavailable
          );
          return textResult({ scanResult, reportId: report.reportId, artifactId, report });
        } catch (err) {
          return textResult({ error: (err as Error).message });
        }
      }
    );

    // 10. generate_aibom (Paid: 0.03 USDT0)
    server.registerTool(
      "generate_aibom",
      {
        title: "Generate AI-BOM (Artificial Intelligence Bill of Materials)",
        description: "Produce an AI-BOM detailing model lineage, pipeline dependencies, TEE runtime requirements, and dataset risks. Cost: 0.03 USDT0.",
        inputSchema: {
          content: z.string().min(1),
          fileName: z.string().optional(),
          ecosystem: ecosystemSchema,
          modelMetadata: z.object({
            modelName: z.string().optional(),
            modelVersion: z.string().optional(),
            publisher: z.string().optional(),
            license: z.string().optional()
          }).optional()
        },
      },
      async ({ content, fileName, ecosystem, modelMetadata }) => {
        try {
          const parsed = parseManifest(content, fileName || 'manifest', resolveEcosystem(ecosystem));
          const aibom = generateAibom(
            {
              models: modelMetadata ? [{
                name: modelMetadata.modelName || 'ai-model',
                version: modelMetadata.modelVersion || '1.0',
                provider: modelMetadata.publisher,
                license: modelMetadata.license
              }] : []
            },
            fileName || 'manifest'
          );
          return textResult({ aibom });
        } catch (err) {
          return textResult({ error: (err as Error).message });
        }
      }
    );
  },
  {
    instructions: LINEAGE_INSTRUCTIONS,
    capabilities: { tools: {} },
  },
  {
    basePath: "",
    maxDuration: 300,
    verboseLogs: false,
  }
);
