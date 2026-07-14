import { dataUrlToBlob } from '@/services/imageStore';

// aws4fetch is loaded via dynamic import to avoid Vite/rolldown static resolution issues

const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

export interface CloudStoreConfig {
  endpoint: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
  region: string;
  /** Optional public URL base for generating readable image URLs.
   *  E.g. "https://cdn.example.com/images" — {publicUrlBase}/{uuid}
   *  Defaults to "{endpoint}/{bucket}/images" */
  publicUrlBase?: string;
}

let _config: CloudStoreConfig | null = null;
let _client: any = null;

/** Lazy-load aws4fetch at runtime (avoids Vite/rolldown static resolution issues). */
async function getS3Client(config: CloudStoreConfig) {
  const mod = await import('aws4fetch');
  return new mod.AwsClient({
    accessKeyId: config.accessKey,
    secretAccessKey: config.secretKey,
    service: 's3',
    region: config.region || 'auto',
  });
}

/** Get or create the S3 client lazily from the stored config. */
async function getClient(): Promise<any> {
  if (!_client && _config) {
    _client = await getS3Client(_config);
  }
  return _client!;
}

function normalizeEndpoint(ep: string): string {
  const s = ep.trim().replace(/\/+$/, '');
  if (!s) throw new Error('Empty endpoint');
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(s)) return s;
  return `https://${s}`;
}

/** Initialize cloud store with user config. Normalizes endpoint, whitelists CSP at runtime. */
export function initCloudStore(cfg: CloudStoreConfig): void {
  const ep = normalizeEndpoint(cfg.endpoint);
  _config = { ...cfg, endpoint: ep };
  _client = null;
  whitelistS3Origin(ep);
}

function whitelistS3Origin(endpoint: string): void {
  try {
    const origin = new URL(endpoint).origin;
    const meta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    if (!meta) return;
    let content = meta.getAttribute('content') || '';
    if (content.includes(origin)) return;
    // Whitelist for both fetch (connect-src) and <img> (img-src)
    content = content.replace(/(connect-src[^;]*)/, `$1 ${origin}`);
    content = content.replace(/(img-src[^;]*)/, `$1 ${origin}`);
    meta.setAttribute('content', content);
    console.log('[cloudStore] CSP whitelisted:', origin);
  } catch {
    /* invalid URL — ignore */
  }
}

export function isCloudStoreConfigured(): boolean {
  return _config !== null;
}

export function getCloudConfig(): CloudStoreConfig | null {
  return _config;
}

export function clearCloudConfig(): void {
  _client = null;
  _config = null;
  signedUrlCache.clear();
}

/**
 * Fetch a resource from cloud storage using a signed request (AWS Signature V4).
 * Uses the existing AwsClient which handles request signing automatically.
 */
export async function fetchCloudResource(url: string): Promise<Response> {
  if (!_config) throw new Error('Cloud store not configured');
  const client = await getClient();
  return client.fetch(url);
}

/**
 * Build the raw S3 object URL for a cloud: ref.
 * Always uses the S3 endpoint (not publicUrlBase) so it can be signed.
 */
export function getS3ObjectUrl(ref: string): string {
  if (!_config) throw new Error('Cloud store not configured');
  const ep = _config.endpoint.replace(/\/+$/, '');
  const uuid = ref.slice(6); // strip "cloud:"
  return `${ep}/${_config.bucket}/images/${uuid}`;
}

/**
 * Generate a pre-signed GET URL for a cloud: ref using AWS Signature V4 query params.
 * The URL is valid for `ttlSeconds` (default 3600 = 1 hour).
 * Results are cached in-memory to avoid re-signing on every access.
 */
export async function getSignedUrl(ref: string, ttlSeconds = 3600): Promise<string> {
  if (!ref.startsWith('cloud:')) throw new Error(`Invalid cloud ref: ${ref}`);
  if (!_config) throw new Error('Cloud store not configured');

  // Check cache first
  const cached = signedUrlCache.get(ref);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.url;
  }

  const { AwsV4Signer } = await import('aws4fetch');
  const url = getS3ObjectUrl(ref);

  const signer = new AwsV4Signer({
    url,
    method: 'GET',
    accessKeyId: _config.accessKey,
    secretAccessKey: _config.secretKey,
    service: 's3',
    region: _config.region || 'auto',
    signQuery: true,
  });

  const signed = await signer.sign();
  const signedUrl = signed.url.toString();

  // Cache the signed URL
  signedUrlCache.set(ref, { url: signedUrl, expiresAt: Date.now() + ttlSeconds * 1000 });
  return signedUrl;
}

/**
 * Synchronously retrieve a cached signed URL for a cloud: ref.
 * Returns null if not cached or expired.
 */
export function getCachedSignedUrl(ref: string): string | null {
  const cached = signedUrlCache.get(ref);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.url;
  }
  return null;
}

/**
 * Upload a compressed image data URL to 缤纷云 (S3-compatible).
 * Returns a `cloud:uuid.jpg` reference string.
 */
export async function uploadImage(dataUrl: string): Promise<string> {
  if (!_config) throw new Error('Cloud store not configured');
  const client = await getClient();

  const ep = _config.endpoint.replace(/\/+$/, '');
  const uuid = crypto.randomUUID().slice(0, 8) + '.jpg';
  const key = `images/${uuid}`;
  const uploadUrl = `${ep}/${_config.bucket}/${key}`;
  console.log('[cloudStore] uploadImage URL:', uploadUrl);

  const blob = dataUrlToBlob(dataUrl);

  const response = await client.fetch(uploadUrl, {
    method: 'PUT',
    body: blob,
    headers: {
      'Content-Type': blob.type || 'image/jpeg',
      'x-amz-acl': 'public-read',
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Cloud upload failed (${response.status}): ${body.slice(0, 200)}`);
  }

  return `cloud:${uuid}`;
}

/**
 * Construct the public URL for a cloud: ref.
 * E.g. `cloud:a1b2c3d4.jpg` → `https://cdn.example.com/images/a1b2c3d4.jpg`
 */
export function getRefUrl(ref: string): string {
  if (!ref.startsWith('cloud:')) throw new Error(`Invalid cloud ref: ${ref}`);
  if (!_config) throw new Error('Cloud store not configured');
  const ep = _config.endpoint.replace(/\/+$/, '');
  const uuid = ref.slice(6); // strip "cloud:"
  const base = _config.publicUrlBase || `${ep}/${_config.bucket}/images`;
  return `${base}/${uuid}`;
}

/** Delete an image from cloud storage. */
export async function deleteImage(ref: string): Promise<void> {
  if (!_config) throw new Error('Cloud store not configured');
  const client = await getClient();
  const ep = _config.endpoint.replace(/\/+$/, '');
  const uuid = ref.replace('cloud:', '');
  const key = `images/${uuid}`;
  const url = `${ep}/${_config.bucket}/${key}`;
  const response = await client.fetch(url, { method: 'DELETE' });
  if (!response.ok && response.status !== 404) {
    throw new Error(`Cloud delete failed (${response.status})`);
  }
}

/** Verify cloud connection by uploading a temp file.
 *  Returns true only if S3 PUT + body response confirm a real S3-compatible endpoint. */
export async function testConnection(cfg: CloudStoreConfig): Promise<boolean> {
  try {
    const endpoint = normalizeEndpoint(cfg.endpoint);
    const client = await getS3Client({ ...cfg, endpoint });
    const testKey = `_test_${Date.now()}.tmp`;
    const url = `${endpoint}/${cfg.bucket}/${testKey}`;
    const resp = await client.fetch(url, {
      method: 'PUT',
      body: new Blob(['x'], { type: 'text/plain' }),
      headers: { 'Content-Type': 'text/plain' },
    });
    if (!resp.ok) {
      console.warn('[cloudStore] testConnection PUT failed:', resp.status);
      return false;
    }
    // Verify S3: S3 returns XML/empty body. Generic HTTP servers return HTML.
    const body = await resp.text().catch(() => '');
    if (body.trimStart().startsWith('<!')) {
      console.warn('[cloudStore] testConnection: got HTML body instead of S3 response');
      return false;
    }
    // Best-effort cleanup
    client.fetch(url, { method: 'DELETE' }).catch(() => {});
    return true;
  } catch (e) {
    console.warn('[cloudStore] testConnection error:', e);
    return false;
  }
}

/** Read a value stored by Quasar's $q.localStorage. Handles __q_*| type prefix markers. */
function readStorage(key: string): string | null {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  // Quasar v2 localStorage plugin uses __q_strn|, __q_num|, __q_bln|, __q_obj| prefix markers
  if (raw.startsWith('__q_strn|')) return raw.slice(9);
  if (raw.startsWith('__q_num|')) return raw.slice(9);
  if (raw.startsWith('__q_bln|')) return raw.slice(9);
  if (raw.startsWith('__q_obj|')) return String(JSON.parse(raw.slice(9)));
  // Not Quasar-encoded — return raw (legacy or direct usage)
  return raw;
}

export function initCloudStoreFromStorage(): boolean {
  const endpoint = readStorage('cloudEndpoint');
  const bucket = readStorage('cloudBucket');
  const accessKey = readStorage('cloudAccessKey');
  const secretKey = readStorage('cloudSecretKey');
  const region = readStorage('cloudRegion') || 'auto';
  const publicUrlBase = readStorage('cloudPublicUrl') || undefined;
  if (endpoint && bucket && accessKey && secretKey) {
    initCloudStore({ endpoint, region, bucket, accessKey, secretKey, ...(publicUrlBase ? { publicUrlBase } : {}) });
    return true;
  }
  return false;
}
