import { describe, it, expect } from 'vitest';
import { handler } from '../server.js';

describe('All 10 EVIDIQ Lineage MCP Tools Verification', () => {
  async function callTool(name: string, args: Record<string, any> = {}) {
    const req = new Request('http://localhost:3000/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream, application/json'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name, arguments: args }
      })
    });

    const res = await handler(req);
    expect(res.status).toBe(200);
    const text = await res.text();
    const dataLine = text.split('\n').find(l => l.startsWith('data: '));
    if (!dataLine) {
      throw new Error(`No SSE data line found in response: ${text}`);
    }

    const json = JSON.parse(dataLine.slice(6));
    expect(json.result).toBeDefined();
    expect(json.result.content).toBeDefined();
    expect(json.result.content[0].type).toBe('text');
    return JSON.parse(json.result.content[0].text);
  }

  it('1. lineage_capabilities (Free)', async () => {
    const data = await callTool('lineage_capabilities');
    expect(data.service).toBe('EVIDIQ Lineage');
    expect(data.rulesCount).toBe(14);
    expect(data.tools).toHaveLength(10);
  });

  it('2. validate_manifest (Free)', async () => {
    const manifest = JSON.stringify({ name: 'my-app', dependencies: { express: '4.18.2' } });
    const data = await callTool('validate_manifest', {
      content: manifest,
      fileName: 'package.json',
      ecosystem: 'npm'
    });
    expect(data.valid).toBe(true);
    expect(data.componentCount).toBe(1);
  });

  it('3. estimate_cost (Free)', async () => {
    const data = await callTool('estimate_cost', { tool: 'scan_dependencies' });
    expect(data.tool).toBe('scan_dependencies');
    expect(data.amountUSDT0).toBe(0.02);
  });

  it('4. verify_package_claim (Paid: 0.005 USDT0)', async () => {
    const data = await callTool('verify_package_claim', {
      name: 'express',
      version: '4.18.2',
      ecosystem: 'npm'
    });
    expect(data.name).toBe('express');
    expect(data.exists).toBeDefined();
  });

  it('5. audit_licenses (Paid: 0.01 USDT0)', async () => {
    const manifest = JSON.stringify({ name: 'my-app', dependencies: { express: '4.18.2' } });
    const data = await callTool('audit_licenses', {
      content: manifest,
      fileName: 'package.json',
      ecosystem: 'npm'
    });
    expect(data.summary).toBeDefined();
    expect(data.reportId).toBeDefined();
    expect(data.artifactId).toBeDefined();
  });

  it('6. generate_sbom (Paid: 0.015 USDT0)', async () => {
    const manifest = JSON.stringify({ name: 'my-app', dependencies: { express: '4.18.2' } });
    const data = await callTool('generate_sbom', {
      content: manifest,
      fileName: 'package.json',
      ecosystem: 'npm',
      format: 'cyclonedx'
    });
    expect(data.format).toBe('cyclonedx');
    expect(data.sbom.bomFormat).toBe('CycloneDX');
  });

  it('7. scan_dependencies (Paid: 0.02 USDT0)', async () => {
    const manifest = JSON.stringify({ name: 'my-app', dependencies: { express: '4.18.2' } });
    const data = await callTool('scan_dependencies', {
      content: manifest,
      fileName: 'package.json',
      ecosystem: 'npm'
    });
    expect(data.scanResult).toBeDefined();
    expect(data.reportId).toBeDefined();
    expect(data.artifactId).toBeDefined();
  });

  it('8. generate_aibom (Paid: 0.03 USDT0)', async () => {
    const manifest = JSON.stringify({ name: 'my-app', dependencies: { express: '4.18.2' } });
    const data = await callTool('generate_aibom', {
      content: manifest,
      fileName: 'package.json',
      ecosystem: 'npm',
      modelMetadata: { modelName: 'claude-3-5-sonnet', publisher: 'Anthropic' }
    });
    expect(data.aibom).toBeDefined();
    expect(data.aibom.format).toBe('CycloneDX-AI-1.6');
  });

  it('9. get_artifact (Free)', async () => {
    const manifest = JSON.stringify({ name: 'my-app', dependencies: { express: '4.18.2' } });
    const scanData = await callTool('scan_dependencies', {
      content: manifest,
      fileName: 'package.json',
      ecosystem: 'npm'
    });
    const artifactId = scanData.artifactId;

    const artifactData = await callTool('get_artifact', { artifactId });
    expect(artifactData).toBeDefined();
  });

  it('10. verify_lineage_report (Free)', async () => {
    const manifest = JSON.stringify({ name: 'my-app', dependencies: { express: '4.18.2' } });
    const scanData = await callTool('scan_dependencies', {
      content: manifest,
      fileName: 'package.json',
      ecosystem: 'npm'
    });

    const verifyData = await callTool('verify_lineage_report', { report: scanData.report });
    expect(verifyData.integrityValid).toBe(true);
  });

  it('11. handles malformed manifest inputs gracefully without crashing', async () => {
    const malformedContent = 'invalid json { name: ';
    const scanData = await callTool('scan_dependencies', {
      content: malformedContent,
      fileName: 'package.json',
      ecosystem: 'npm'
    });
    expect(scanData.error).toBeDefined();
  });
});
