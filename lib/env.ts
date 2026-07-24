/**
 * Environment Variable Validation for Hardened PeerVault
 * 
 * 100% Free Serverless Architecture — 0 External Databases Required!
 */

export function validateEnv(): { valid: boolean; missing: string[] } {
  // 0 mandatory external database variables required!
  const required: string[] = [];

  const missing = required.filter(
    (key) => !process.env[key]
  );

  return {
    valid: missing.length === 0,
    missing,
  };
}
