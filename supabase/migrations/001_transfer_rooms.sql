-- Hardened PeerVault Schema: Transfer Rooms & Staging Table
CREATE TABLE IF NOT EXISTS public.transfer_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id VARCHAR(64) UNIQUE NOT NULL,
  sender_pubkey TEXT NOT NULL,
  recipient_pubkey TEXT,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'waiting', -- waiting, active, completed, expired, cancelled
  merkle_root TEXT,
  staging_available BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours')
);

-- Enable RLS
ALTER TABLE public.transfer_rooms ENABLE ROW LEVEL SECURITY;

-- Policies for public room creation and joining
CREATE POLICY "Allow public select rooms" ON public.transfer_rooms FOR SELECT USING (true);
CREATE POLICY "Allow public insert rooms" ON public.transfer_rooms FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update rooms" ON public.transfer_rooms FOR UPDATE USING (true);
