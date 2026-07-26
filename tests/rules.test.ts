import { describe, it, expect } from 'vitest';
import { evaluateRules } from '../lib/lineage/rules/engine.js';
import { DependencyGraph } from '../lib/lineage/types.js';

describe('14-rule evaluation engine', () => {
  it('detects typosquatting against popular package names', async () => {
    const graph: DependencyGraph = {
      rootName: 'test-app',
      rootVersion: '1.0.0',
      ecosystem: 'pypi',
      components: [
        {
          name: 'reqeusts', // typosquat of requests
          version: '1.0.0',
          ecosystem: 'pypi',
          direct: true
        }
      ]
    };

    const result = await evaluateRules(graph);
    const typosquatFinding = result.findings.find(f => f.ruleId === 'TYPOSQUAT_DISTANCE');
    expect(typosquatFinding).toBeDefined();
    expect(typosquatFinding?.severity).toBe('high');
  });

  it('detects bundled malicious IOCs', async () => {
    const graph: DependencyGraph = {
      rootName: 'test-app',
      rootVersion: '1.0.0',
      ecosystem: 'npm',
      components: [
        {
          name: 'flatmap-stream',
          version: '0.1.1',
          ecosystem: 'npm',
          direct: true
        }
      ]
    };

    const result = await evaluateRules(graph);
    const iocFinding = result.findings.find(f => f.ruleId === 'MALICIOUS_KNOWN');
    expect(iocFinding).toBeDefined();
    expect(iocFinding?.severity).toBe('critical');
    expect(result.verdict).toBe('BLOCK');
  });

  it('detects lifecycle install scripts in npm package.json', async () => {
    const graph: DependencyGraph = {
      rootName: 'test-app',
      rootVersion: '1.0.0',
      ecosystem: 'npm',
      components: [
        {
          name: 'pkg-with-scripts',
          version: '1.0.0',
          ecosystem: 'npm',
          direct: true,
          scripts: {
            postinstall: 'node setup.js'
          }
        }
      ]
    };

    const result = await evaluateRules(graph);
    const scriptFinding = result.findings.find(f => f.ruleId === 'INSTALL_SCRIPT_RISK');
    expect(scriptFinding).toBeDefined();
    expect(scriptFinding?.severity).toBe('high');
  });

  it('flags unpinned dependencies', async () => {
    const graph: DependencyGraph = {
      rootName: 'test-app',
      rootVersion: '1.0.0',
      ecosystem: 'npm',
      components: [
        {
          name: 'lodash',
          version: '*',
          ecosystem: 'npm',
          direct: true
        }
      ]
    };

    const result = await evaluateRules(graph);
    const unpinnedFinding = result.findings.find(f => f.ruleId === 'VERSION_FLOAT');
    expect(unpinnedFinding).toBeDefined();
    expect(unpinnedFinding?.severity).toBe('medium');
  });
});
