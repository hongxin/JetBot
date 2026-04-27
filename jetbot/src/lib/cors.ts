export function resolveProxyUrl(targetUrl: string, proxyBaseUrl?: string): string {
  const trimmed = proxyBaseUrl?.trim();
  if (!trimmed) return targetUrl;
  const base = trimmed.replace(/\/$/, '');
  return `${base}/proxy?url=${encodeURIComponent(targetUrl)}`;
}
