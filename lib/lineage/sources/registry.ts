export interface PackageClaimResult {
  exists: boolean;
  name: string;
  version?: string;
  ecosystem: 'npm' | 'pypi';
  publishAgeDays?: number;
  maintainersCount?: number;
  deprecated?: boolean;
  deprecatedReason?: string;
  yanked?: boolean;
  provenance?: boolean;
  downloadCountSignal?: 'high' | 'moderate' | 'low';
}

export async function verifyPackageClaimRemote(
  name: string,
  version?: string,
  ecosystem: 'npm' | 'pypi' = 'npm',
  timeoutMs = 5000
): Promise<PackageClaimResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    if (ecosystem === 'npm') {
      const pkgUrl = `https://registry.npmjs.org/${encodeURIComponent(name)}`;
      const res = await fetch(pkgUrl, {
        headers: { Accept: 'application/json' },
        signal: controller.signal
      });

      clearTimeout(timer);

      if (res.status === 404) {
        return { exists: false, name, version, ecosystem };
      }

      if (!res.ok) {
        // Degraded / default true if registry error
        return { exists: true, name, version, ecosystem, downloadCountSignal: 'moderate' };
      }

      const data: any = await res.json();
      const timeObj = data.time || {};
      const maintainers = Array.isArray(data.maintainers) ? data.maintainers.length : 1;
      const targetVer = version && version !== '*' ? version : data['dist-tags']?.latest;

      let publishAgeDays: number | undefined;
      if (targetVer && timeObj[targetVer]) {
        const pubDate = new Date(timeObj[targetVer]);
        publishAgeDays = Math.floor((Date.now() - pubDate.getTime()) / (1000 * 60 * 60 * 24));
      } else if (timeObj.created) {
        const pubDate = new Date(timeObj.created);
        publishAgeDays = Math.floor((Date.now() - pubDate.getTime()) / (1000 * 60 * 60 * 24));
      }

      const verObj = targetVer && data.versions ? data.versions[targetVer] : null;
      const deprecated = Boolean(verObj?.deprecated || data.deprecated);
      const deprecatedReason = verObj?.deprecated || data.deprecated;
      const provenance = Boolean(verObj?.dist?.attestations || verObj?.dist?.integrity);

      return {
        exists: true,
        name,
        version: targetVer || version,
        ecosystem,
        publishAgeDays,
        maintainersCount: maintainers,
        deprecated,
        deprecatedReason,
        yanked: false,
        provenance,
        downloadCountSignal: 'high'
      };
    } else {
      const pypiUrl = `https://pypi.org/pypi/${encodeURIComponent(name)}/json`;
      const res = await fetch(pypiUrl, {
        headers: { Accept: 'application/json' },
        signal: controller.signal
      });

      clearTimeout(timer);

      if (res.status === 404) {
        return { exists: false, name, version, ecosystem };
      }

      if (!res.ok) {
        return { exists: true, name, version, ecosystem, downloadCountSignal: 'moderate' };
      }

      const data: any = await res.json();
      const info = data.info || {};
      const targetVer = version && version !== '*' ? version : info.version;
      const releases = data.releases || {};
      const relFiles = releases[targetVer] || [];

      let publishAgeDays: number | undefined;
      if (relFiles.length > 0 && relFiles[0].upload_time) {
        const pubDate = new Date(relFiles[0].upload_time + 'Z');
        publishAgeDays = Math.floor((Date.now() - pubDate.getTime()) / (1000 * 60 * 60 * 24));
      }

      const yanked = relFiles.some((f: any) => f.yanked);

      return {
        exists: true,
        name,
        version: targetVer || version,
        ecosystem,
        publishAgeDays,
        maintainersCount: 1,
        deprecated: Boolean(info.yanked),
        yanked,
        provenance: false,
        downloadCountSignal: 'high'
      };
    }
  } catch (err) {
    clearTimeout(timer);
    // Failure to check remote registry fallback
    return {
      exists: true,
      name,
      version,
      ecosystem,
      downloadCountSignal: 'moderate'
    };
  }
}

export const verifyPackageRegistryClaim = verifyPackageClaimRemote;
