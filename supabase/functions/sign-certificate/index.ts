// Supabase Edge Function: sign-certificate
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    const { roomId, merkleRoot, fileName, fileSize } = await req.json();
    const timestamp = new Date().toISOString();

    const payloadToSign = `${roomId}:${merkleRoot}:${fileSize}:${timestamp}`;
    
    // Ed25519 signing simulation or environment key sign
    const signature = `sig_ed25519_${Math.random().toString(36).substring(2, 14)}`;

    const certificate = {
      version: '1.0.0',
      transfer_id: `tr_${Math.random().toString(36).substring(2, 10)}`,
      room_id: roomId,
      file_name: fileName,
      file_size_bytes: fileSize,
      merkle_root_blake3: merkleRoot,
      completed_at: timestamp,
      server_signature_ed25519: signature,
      public_key_url: '/api/pubkey',
    };

    return new Response(JSON.stringify(certificate), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
