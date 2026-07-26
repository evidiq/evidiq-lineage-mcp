import { createHash } from 'crypto';

interface StoredArtifact {
  id: string;
  type: string;
  content: any;
  digest: string;
  createdAt: string;
}

const artifactStore = new Map<string, StoredArtifact>();

export function storeArtifact(content: any, type = 'report'): { artifactId: string; digest: string } {
  const jsonStr = typeof content === 'string' ? content : JSON.stringify(content);
  const digest = createHash('sha256').update(jsonStr, 'utf8').digest('hex');
  const artifactId = `art-${digest.slice(0, 16)}`;

  artifactStore.set(artifactId, {
    id: artifactId,
    type,
    content,
    digest,
    createdAt: new Date().toISOString()
  });

  return { artifactId, digest };
}

export function getArtifact(artifactId: string): StoredArtifact | null {
  return artifactStore.get(artifactId) || null;
}
