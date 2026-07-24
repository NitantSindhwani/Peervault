import { supabase } from './client';

export interface TransferRoomRecord {
  id?: string;
  room_id: string;
  sender_pubkey: string;
  recipient_pubkey?: string;
  file_name: string;
  file_size: number;
  status: 'waiting' | 'active' | 'completed' | 'expired' | 'cancelled';
  merkle_root?: string;
  staging_available?: boolean;
  max_downloads?: number;
  download_count?: number;
  created_at?: string;
  expires_at?: string;
}

export async function createTransferRoom(params: {
  roomId: string;
  senderPubKey: string;
  fileName: string;
  fileSize: number;
  ttlHours?: number;
  maxDownloads?: number;
}): Promise<TransferRoomRecord | null> {
  const ttl = params.ttlHours || 24;
  const expiresAt = new Date(Date.now() + ttl * 60 * 60 * 1000).toISOString();

  try {
    const { data, error } = await supabase
      .from('transfer_rooms')
      .insert({
        room_id: params.roomId,
        sender_pubkey: params.senderPubKey,
        file_name: params.fileName,
        file_size: params.fileSize,
        status: 'waiting',
        max_downloads: params.maxDownloads || 1,
        download_count: 0,
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (error) {
      console.warn('[Room] Error creating database record:', error.message);
      return {
        room_id: params.roomId,
        sender_pubkey: params.senderPubKey,
        file_name: params.fileName,
        file_size: params.fileSize,
        status: 'waiting',
        expires_at: expiresAt,
        max_downloads: params.maxDownloads || 1,
      };
    }

    return data as TransferRoomRecord;
  } catch (e) {
    console.warn('[Room] Supabase client exception during room creation:', e);
    return {
      room_id: params.roomId,
      sender_pubkey: params.senderPubKey,
      file_name: params.fileName,
      file_size: params.fileSize,
      status: 'waiting',
      expires_at: expiresAt,
      max_downloads: params.maxDownloads || 1,
    };
  }
}

export async function getTransferRoom(roomId: string): Promise<TransferRoomRecord | null> {
  try {
    const { data, error } = await supabase
      .from('transfer_rooms')
      .select()
      .eq('room_id', roomId)
      .single();

    if (error) return null;
    return data as TransferRoomRecord;
  } catch {
    return null;
  }
}

export async function updateRoomStatus(
  roomId: string,
  updates: Partial<TransferRoomRecord>
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('transfer_rooms')
      .update(updates)
      .eq('room_id', roomId);

    return !error;
  } catch {
    return false;
  }
}
