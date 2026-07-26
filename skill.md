---
name: EVIDIQ Lineage
version: 1.0.0
description: Deterministic supply-chain provenance, dependency risk analysis, vulnerability detection, license auditing, and signed SBOM/AI-BOM generation with x402 pricing.
category: Security & Provenance
provider: EVIDIQ
provider_url: https://evidiq.dev
license: MIT
---

# EVIDIQ Lineage MCP

**Supply-chain provenance, SBOM/AI-BOM generation, and dependency risk analysis for AI-generated code.**

EVIDIQ Lineage lets an agent validate a manifest or lockfile for free, then execute 14-rule deterministic risk evaluation (typosquatting, hallucinated dependencies, malicious IOCs, lifecycle install scripts, unpinned dependencies, copyleft licenses) or generate machine-readable SBOM and AI-BOM artifacts. Every paid result includes a signed lineage report digest, optional EIP-191 signature, and content-addressed local artifacts.

**Launch status: live endpoint.** The MCP server is deployed at `https://mcp.evidiq.dev/lineage`; the OKX.AI marketplace listing is in progress.

Documentation URL: `https://evidiq.dev/docs/lineage`

## Route to Lineage when

Use Lineage for:

- Manifest & lockfile validation (`package.json`, `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `requirements.txt`, `pyproject.toml`, `poetry.lock`).
- Supply-chain risk & typosquatting detection.
- Registry package claim verification (npm/PyPI).
- Dependency license auditing (copyleft vs permissive).
- Standard Software Bill of Materials (CycloneDX 1.6 / SPDX 3.0).
- AI-BOM generation for AI model, dataset, MCP server, and skill stacks.
- Re-verifying a Lineage report or retrieving a known artifact.

Do **not** route runtime network scanning or service probing to Lineage (use EVIDIQ Sentinel for services). Lineage scans components an agent builds with.

## Free tools

| Tool | Purpose |
|---|---|
| `lineage_capabilities` | Supported ecosystems, 14-rule catalog, dataset versions, and full pricing |
| `validate_manifest` | Validate manifest syntax and component counts before payment; offline processing |
| `estimate_cost` | Quote one immutable paid-tool price |
| `verify_lineage_report` | Recompute report digest integrity and verify trusted EIP-191 signature |
| `get_artifact` | Retrieve a content-addressed JSON artifact by exact ID |

## Paid tools

| Tool | Atomic USDT0 | Cost | Purpose |
|---|---:|---:|---|
| `verify_package_claim` | `5000` | 0.005 USDT0 | Verify package existence, versions, and maintainer count on npm/PyPI |
| `audit_licenses` | `10000` | 0.01 USDT0 | Audit dependency licenses for copyleft (GPL/AGPL) conflicts and missing licenses |
| `generate_sbom` | `15000` | 0.015 USDT0 | Generate CycloneDX 1.6 or SPDX 3.0 Software Bill of Materials |
| `scan_dependencies` | `20000` | 0.02 USDT0 | Execute full 14-rule supply-chain risk analysis with OSV vulnerability matching |
| `generate_aibom` | `30000` | 0.03 USDT0 | Generate AI-BOM detailing model lineage, datasets, MCP servers, and skill risks |

Prices are immutable in service code. Asset: USDT0 with 6 decimals on X Layer (`eip155:196`), contract `0x779ded0c9e1022225f8e0630b35a9b54be713736`.

## Recommended agent workflow

1. Call `lineage_capabilities` to inspect current rules and versions.
2. Call `validate_manifest` with the manifest content.
3. Call `estimate_cost` for the intended paid tool.
4. Submit payment via x402 header.
5. Preserve the returned `report`, report artifact ID, and optional `storageRoot`/`storageTx`.
6. Call `verify_lineage_report` before relying on a report received from another party.

## Public endpoints

- Docs: `https://evidiq.dev/docs/lineage`
- Health: `GET https://mcp.evidiq.dev/lineage/health`
- Skill: `GET https://mcp.evidiq.dev/lineage/skill.md`
- Pricing: `GET https://mcp.evidiq.dev/lineage/x402`
- MCP: `POST https://mcp.evidiq.dev/lineage/mcp`

## Settlement proof

Paid calls settle through the official OKX Onchain OS Payment SDK
(`@okxweb3/x402-core` + `@okxweb3/x402-evm`). Live examples on X Layer, both `status 0x1`:

- `verify_package_claim` — `0.005 USDT0` — `0xfd9a7480710d7278a7b965d47a6568a59b9651aa5826f5f16e80df448c2ea2af`
- `scan_dependencies` — `0.02 USDT0` — `0xcf5360d545bc941153e04d6079365248507a81e617f809f650840c7c48b23423`

## Version

`v1.0.0` — MIT © 2026 EVIDIQ — OKX.AI Agent #9575.
