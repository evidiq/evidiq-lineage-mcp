import { DependencyGraph } from './types.js';

export function generateCycloneDX16(graph: DependencyGraph): any {
  return {
    $schema: 'http://cyclonedx.org/schema/bom-1.6.schema.json',
    bomFormat: 'CycloneDX',
    specVersion: '1.6',
    serialNumber: `urn:uuid:${crypto.randomUUID()}`,
    version: 1,
    metadata: {
      timestamp: new Date().toISOString(),
      tools: {
        components: [
          {
            type: 'application',
            name: 'EVIDIQ Lineage',
            version: '0.1.0',
            vendor: 'EVIDIQ'
          }
        ]
      },
      component: {
        type: 'application',
        name: graph.rootName || 'app',
        version: graph.rootVersion || '1.0.0'
      }
    },
    components: graph.components.map(c => ({
      type: 'library',
      name: c.name,
      version: c.version,
      purl: c.purl,
      licenses: c.license ? [{ license: { id: c.license } }] : undefined,
      hashes: c.integrity ? [{ alg: c.integrity.startsWith('sha512-') ? 'SHA-512' : 'SHA-256', content: c.integrity }] : undefined,
      properties: [
        { name: 'evidiq:ecosystem', value: c.ecosystem },
        { name: 'evidiq:direct', value: String(c.direct !== false) },
        { name: 'evidiq:transitiveDepth', value: String(c.transitiveDepth || 1) }
      ]
    })),
    dependencies: [
      {
        ref: `${graph.rootName}@${graph.rootVersion}`,
        dependsOn: graph.components.filter(c => c.direct !== false).map(c => c.purl || `${c.name}@${c.version}`)
      }
    ]
  };
}

export function generateSPDX30(graph: DependencyGraph): any {
  const rootSpdxId = `SPDXRef-Root-${graph.rootName || 'app'}`;
  return {
    spdxVersion: 'SPDX-3.0',
    dataLicense: 'CC0-1.0',
    SPDXID: 'SPDXRef-DOCUMENT',
    name: `${graph.rootName || 'app'}-SBOM`,
    documentNamespace: `https://evidiq.dev/spdx/${graph.rootName || 'app'}-${Date.now()}`,
    creationInfo: {
      created: new Date().toISOString(),
      creators: ['Tool: EVIDIQ Lineage-0.1.0']
    },
    elements: [
      {
        type: 'software_Package',
        spdxId: rootSpdxId,
        name: graph.rootName || 'app',
        version: graph.rootVersion || '1.0.0'
      },
      ...graph.components.map(c => ({
        type: 'software_Package',
        spdxId: `SPDXRef-Package-${encodeURIComponent(c.name)}-${encodeURIComponent(c.version)}`,
        name: c.name,
        versionInfo: c.version,
        downloadLocation: c.resolvedUrl || 'NOASSERTION',
        licenseConcluded: c.license || 'NOASSERTION',
        externalIdentifier: [
          {
            externalIdentifierType: 'purl',
            identifier: c.purl || `pkg:${c.ecosystem}/${c.name}@${c.version}`
          }
        ]
      }))
    ]
  };
}
