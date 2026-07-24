/**
 * Environment Variable Validation for Hardened PeerVault
 */

export function validateEnv(): { valid: boolean; missing: string[] } {
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ];

  const missing = required.filter(
    (key) => !process.env[key] || process.env[key]?.includes('mock-')
  );

  return {
    valid: missing.length === 0,
    missing,
  };
}
