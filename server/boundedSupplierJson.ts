// Consume decompressed bytes under the caller's abort deadline; Content-Length is advisory only.
export async function boundedSupplierJson(response: Response, maxBytes = 1024 * 1024): Promise<unknown> {
  if (!response.body) throw Error('SUPPLIER_BODY_MISSING');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      bytes += next.value.byteLength;
      if (bytes > maxBytes) throw Error('SUPPLIER_BODY_TOO_LARGE');
      chunks.push(next.value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  } finally { reader.releaseLock(); }
}
