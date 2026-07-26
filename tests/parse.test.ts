import { describe, it, expect } from 'vitest';
import { parseNpmLockfile, parsePackageJson } from '../lib/lineage/parse/npm.js';
import { parseRequirementsTxt, parsePyprojectToml, parsePoetryLock } from '../lib/lineage/parse/pypi.js';

describe('npm manifest parsing', () => {
  it('parses package.json dependencies and devDependencies', () => {
    const pkgJson = JSON.stringify({
      name: 'my-app',
      version: '1.0.0',
      dependencies: {
        express: '^4.18.2',
        lodash: '4.17.21'
      },
      devDependencies: {
        typescript: '^5.0.0'
      },
      scripts: {
        postinstall: 'node scripts/setup.js'
      }
    });

    const parsed = parsePackageJson(pkgJson);
    expect(parsed.components).toHaveLength(3);
    const express = parsed.components.find(c => c.name === 'express');
    expect(express).toBeDefined();
    expect(express?.version).toBe('^4.18.2');
    expect(express?.direct).toBe(true);
  });

  it('parses package-lock.json v3 format', () => {
    const lockJson = JSON.stringify({
      name: 'my-app',
      version: '1.0.0',
      lockfileVersion: 3,
      packages: {
        '': {
          name: 'my-app',
          version: '1.0.0',
          dependencies: { lodash: '^4.17.21' }
        },
        'node_modules/lodash': {
          version: '4.17.21',
          resolved: 'https://registry.npmjs.org/lodash/-/lodash-4.17.21.tgz',
          integrity: 'sha512-v2kDEeAs886uGgSDFbt91Y62G+X1QM2jV2vR28Q'
        }
      }
    });

    const parsed = parseNpmLockfile(lockJson, 'package-lock.json');
    expect(parsed.components).toHaveLength(1);
    expect(parsed.components[0].name).toBe('lodash');
    expect(parsed.components[0].version).toBe('4.17.21');
  });
});

describe('PyPI manifest parsing', () => {
  it('parses requirements.txt dependencies', () => {
    const reqTxt = `
# Core dependencies
requests==2.28.1
flask>=2.0.0
# Comment line
-e .
requests-oauthlib
    `;

    const parsed = parseRequirementsTxt(reqTxt);
    expect(parsed.components).toHaveLength(3);
    expect(parsed.components.find(c => c.name === 'requests')?.version).toBe('2.28.1');
  });

  it('parses pyproject.toml dependencies', () => {
    const pyproject = `
[project]
name = "my-python-app"
version = "0.1.0"
dependencies = [
    "requests>=2.28.0",
    "pydantic==1.10.2",
]
    `;

    const parsed = parsePyprojectToml(pyproject);
    expect(parsed.components).toHaveLength(2);
    expect(parsed.components.find(c => c.name === 'pydantic')?.version).toBe('1.10.2');
  });

  it('parses poetry.lock dependencies', () => {
    const poetryLock = `
[[package]]
name = "requests"
version = "2.28.1"
description = "Python HTTP for Humans."
files = [
    {file = "requests-2.28.1-py3-none-any.whl", hash = "sha256:12345"},
]

[[package]]
name = "urllib3"
version = "1.26.12"
description = "HTTP library with thread-safe connection pooling."
    `;

    const parsed = parsePoetryLock(poetryLock);
    expect(parsed.components).toHaveLength(2);
    expect(parsed.components.find(c => c.name === 'requests')?.version).toBe('2.28.1');
  });
});
