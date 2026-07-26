import { AIBOMReport, AIStackInput } from './types.js';

export function generateAIBOM(stack: AIStackInput, artifactId: string): AIBOMReport {
  const models = stack.models || [];
  const datasets = stack.datasets || [];
  const mcpServers = stack.mcpServers || [];
  const skills = stack.skills || [];

  const licensePosture: AIBOMReport['licensePosture'] = [];
  let licenseRiskCount = 0;

  // Process models
  for (const m of models) {
    const lic = m.license || 'UNKNOWN';
    const isRestrictive = /non-commercial|nc|research-only|llama-license/i.test(lic);
    const isUnknown = lic === 'UNKNOWN' || !lic;
    const risk = isRestrictive ? 'review' : isUnknown ? 'review' : 'clean';
    if (risk !== 'clean') licenseRiskCount++;

    licensePosture.push({
      component: m.name,
      type: 'model',
      license: lic,
      risk
    });
  }

  // Process datasets
  for (const d of datasets) {
    const lic = d.license || 'UNKNOWN';
    const isNC = /cc-by-nc|non-commercial/i.test(lic);
    const risk = isNC ? 'blocked' : lic === 'UNKNOWN' ? 'review' : 'clean';
    if (risk !== 'clean') licenseRiskCount++;

    licensePosture.push({
      component: d.name,
      type: 'dataset',
      license: lic,
      risk
    });
  }

  // Process MCP servers & skills
  for (const m of mcpServers) {
    const lic = m.license || 'MIT';
    licensePosture.push({
      component: m.name,
      type: 'mcp',
      license: lic,
      risk: 'clean'
    });
  }

  for (const s of skills) {
    licensePosture.push({
      component: s.name,
      type: 'skill',
      license: 'MIT',
      risk: 'clean'
    });
  }

  const bom = {
    $schema: 'http://cyclonedx.org/schema/bom-1.6.schema.json',
    bomFormat: 'CycloneDX',
    specVersion: '1.6',
    serialNumber: `urn:uuid:${crypto.randomUUID()}`,
    version: 1,
    metadata: {
      timestamp: new Date().toISOString(),
      tools: [{ name: 'EVIDIQ Lineage', version: '0.1.0' }]
    },
    components: [
      ...models.map(m => ({
        type: 'machine-learning-model',
        name: m.name,
        version: m.version,
        publisher: m.provider || 'unknown',
        licenses: m.license ? [{ license: { id: m.license } }] : undefined
      })),
      ...datasets.map(d => ({
        type: 'data',
        name: d.name,
        version: d.version,
        licenses: d.license ? [{ license: { id: d.license } }] : undefined
      })),
      ...mcpServers.map(s => ({
        type: 'service',
        name: s.name,
        version: s.version,
        endpoints: s.endpoint ? [s.endpoint] : undefined
      })),
      ...skills.map(sk => ({
        type: 'application',
        name: sk.name,
        version: sk.version
      }))
    ]
  };

  const timestamp = new Date().toISOString();

  return {
    artifactId,
    timestamp,
    format: 'CycloneDX-AI-1.6',
    stack,
    summary: {
      modelCount: models.length,
      datasetCount: datasets.length,
      mcpServerCount: mcpServers.length,
      skillCount: skills.length,
      licenseRiskCount
    },
    licensePosture,
    bom,
    reportId: `aibom-${artifactId}`,
    integrity: {
      digest: '' // will be computed by report builder
    }
  };
}
