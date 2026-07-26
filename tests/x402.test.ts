import { describe, it, expect } from 'vitest';
import { getLineageConfig, priceForTool, TOOL_PRICES } from '../lib/x402/config.js';
import { buildChallenge, buildDiscoveryResponse } from '../lib/x402/challenge.js';

describe('x402 payment configuration and challenge creation', () => {
  it('returns price for paid tools and undefined for free tools', () => {
    expect(priceForTool('scan_dependencies')).toBe(20_000n);
    expect(priceForTool('verify_package_claim')).toBe(5_000n);
    expect(priceForTool('lineage_capabilities')).toBeUndefined();
  });

  it('builds valid x402 v2 challenge', () => {
    const mockConfig = {
      network: 'eip155:196',
      chainId: 196,
      asset: '0x779ded0c9e1022225f8e0630b35a9b54be713736' as const,
      payTo: '0x1111111111111111111111111111111111111111' as const,
      domainName: 'USD₮0',
      domainVersion: '1',
      facilitatorUrl: 'https://web3.okx.com',
      rpcUrl: 'https://rpc.xlayer.tech',
      publicBaseUrl: 'https://mcp.evidiq.dev/lineage',
      useFacilitator: false
    };

    const challenge = buildChallenge(mockConfig, TOOL_PRICES.scan_dependencies);
    expect(challenge.x402Version).toBe(2);
    expect(challenge.resource.url).toBe('https://mcp.evidiq.dev/lineage/mcp');
    expect(challenge.accepts[0].amount).toBe('20000');
    expect(challenge.accepts[0].payTo).toBe('0x1111111111111111111111111111111111111111');
  });
});
