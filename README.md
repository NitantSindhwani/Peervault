# 🔒 Hardened PeerVault

> **Zero-Knowledge, Browser-to-Browser, Peer-to-Peer Binary File-Streaming Platform**

Powered by **WebRTC DataChannels**, **WebAssembly SIMD Crypto**, **BBR Congestion Control**, **IndexedDB Auto-Resume**, and **Hardware WebAuthn Biometric Attestation**.

---

## ⚡ Overview

Hardened PeerVault enables users to stream multi-gigabyte datasets directly between browser client devices without central cloud file storage infrastructure.

Unlike standard WebRTC wrappers, PeerVault incorporates custom flow control, WebAssembly-accelerated cryptography, zero-knowledge OPAQUE/ECDH key exchanges, auto-resume token persistence, 0ms URL-embedded signaling, and system telemetry.

---

## 🛡️ Anti-Hacker & Interception Protection

### Built-in Zero-Trust Security Stack
1. **End-to-End Encryption (AES-256-GCM):** Ephemeral ECDH P-256 key agreement derived on-device. Plaintext keys and unencrypted file bytes never touch central servers or network relays.
2. **BLAKE3 Merkle Tree Hash Validation:** Every incoming chunk's hash is validated against the Merkle Root. If a hacker attempts a Man-in-the-Middle (MITM) attack to inject malicious data, the hash mismatch immediately fails and drops the corrupted chunk.
3. **COOP / COEP Isolation & Security Headers:** `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` prevent Spectre/Meltdown side-channel memory leaks.
4. **Self-Destruct & Expiring Rooms:** Configurable Room TTL (1h to 72h) and maximum download caps ensure links automatically self-destruct after use.

---

## ☁️ Cloudflare Setup Guide (Recommended — 100% Free)

Deploying Hardened PeerVault behind **Cloudflare Free Tier** provides enterprise-grade DDoS and bot protection for **₹0 / $0**:

### Steps to Enable Cloudflare:
1. **Add Domain to Cloudflare:** Sign up at [Cloudflare.com](https://cloudflare.com) and point your domain's nameservers to Cloudflare.
2. **Enable Free SSL/TLS:** Set Encryption mode to **Full (Strict)** under SSL/TLS settings.
3. **Enable DDoS & Bot Fight Mode:** Under Security -> Bots, enable **Bot Fight Mode** to block automated scrapers.
4. **Enable Web Application Firewall (WAF):** Under Security -> WAF, turn on free OWASP managed rules to block SQLi and XSS scanners.

---

## 🛠️ Project Structure

```
Peervault/
├── app/                      # Next.js App Router (Send, Receive, ClipVault, Dashboard, Admin)
│   ├── admin/telemetry/      # System Master Telemetry Dashboard (Password Protected)
│   ├── api/log/              # Zero-cost IP & transfer audit logger endpoint
│   ├── api/pubkey/           # Ed25519 public key endpoint
│   ├── api/signal/           # Native 0-cost Next.js in-memory signaling route
│   ├── clip/                 # ClipVault real-time P2P clipboard sync page
│   ├── dashboard/            # Telemetry node & transfer history
│   ├── receive/[roomId]/     # Recipient stream & WebAuthn attestation page
│   └── send/                 # Sender stream & folder slicer setup page
├── components/               # UI components (BentoGrid, TelemetryDashboard, FolderTreeViewer)
├── lib/
│   ├── auth/                 # WebAuthn passkey hardware attestation
│   ├── crypto/               # WebCrypto AES-256-GCM, ECDH, OPAQUE, BLAKE3 Merkle Tree
│   ├── disk/                 # 4-Tier Stream Disk Assembly
│   ├── hooks/                # Master useTransfer state machine
│   ├── resume/               # IndexedDB session persistence store
│   ├── utils/                # Formatters & directory tree walker
│   └── webrtc/               # BBR Pacer, URL-signaling, Multi-Transport
└── test-suite/               # Playwright visual regression & E2E test suite
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18.x or higher
- npm / pnpm / yarn

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/your-username/peervault.git
cd peervault

# 2. Install dependencies
npm install

# 3. Start the development server (Zero Environment Keys Required!)
npm run dev
```

Open `http://localhost:3000` in your browser.

---

## 🧪 Testing

```bash
# Run production build compilation check
npm run build

# Run Playwright E2E & visual regression tests
npx playwright test
```

---

## 📄 License

MIT License. See `LICENSE` for details.
