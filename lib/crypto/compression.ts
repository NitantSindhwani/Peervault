/**
 * PeerVault High-Speed Chunk Compression Engine
 * Uses Native Web APIs for zero-dependency, ultra-fast streaming compression
 */

export async function compressChunk(buffer: ArrayBuffer): Promise<ArrayBuffer> {
  const stream = new Response(buffer).body;
  if (!stream) throw new Error('Failed to create compression stream body');
  
  const compressedStream = stream.pipeThrough(new CompressionStream('deflate-raw'));
  const response = new Response(compressedStream);
  return await response.arrayBuffer();
}

export async function decompressChunk(buffer: ArrayBuffer): Promise<ArrayBuffer> {
  const stream = new Response(buffer).body;
  if (!stream) throw new Error('Failed to create decompression stream body');
  
  const decompressedStream = stream.pipeThrough(new DecompressionStream('deflate-raw'));
  const response = new Response(decompressedStream);
  return await response.arrayBuffer();
}
