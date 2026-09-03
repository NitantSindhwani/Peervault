const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const USER_DATA = path.join(__dirname, 'chrome-profile');

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve(data); }
      });
    }).on('error', reject);
  });
}

function fetchPut(url) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method: 'PUT' }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve(data); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

class CDPClient {
  constructor(wsUrl, name) {
    this.ws = new WebSocket(wsUrl);
    this.name = name;
    this.id = 1;
    this.callbacks = new Map();
    this.events = [];

    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.callbacks.has(msg.id)) {
        const { resolve, reject } = this.callbacks.get(msg.id);
        this.callbacks.delete(msg.id);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      } else if (msg.method) {
        if (msg.method === 'Runtime.consoleAPICalled') {
          const text = msg.params.args.map(a => a.value || a.description || JSON.stringify(a)).join(' ');
          console.log(`[${this.name} CONSOLE ${msg.params.type}] ${text}`);
        } else if (msg.method === 'Runtime.exceptionThrown') {
          console.error(`[${this.name} EXCEPTION]`, JSON.stringify(msg.params.exceptionDetails));
        } else if (msg.method === 'Log.entryAdded') {
          console.log(`[${this.name} LOG ENTRY]`, msg.params.entry.level, msg.params.entry.text);
        }
      }
    };
  }

  async waitOpen() {
    if (this.ws.readyState === WebSocket.OPEN) return;
    return new Promise((resolve) => {
      this.ws.onopen = resolve;
    });
  }

  send(method, params = {}) {
    const id = this.id++;
    return new Promise((resolve, reject) => {
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      throw new Error(res.exceptionDetails.text || 'Eval error');
    }
    return res.result ? res.result.value : undefined;
  }
}

async function main() {
  // 1. Create a dummy test file (20 MB)
  const testFilePath = path.join(__dirname, 'test-payload.bin');
  const buffer = Buffer.alloc(1024 * 1024 * 20); // 20 MB
  for (let i = 0; i < buffer.length; i += 1024) buffer.fill(i % 256, i, i + 1024);
  fs.writeFileSync(testFilePath, buffer);

  // 2. Launch Chrome
  console.log('Launching Chrome...');
  const chromeProc = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=9222',
    `--user-data-dir=${USER_DATA}`,
    '--no-first-run',
    '--no-default-browser-check',
  ]);

  await sleep(2000);

  try {
    const ver = await fetchJson('http://127.0.0.1:9222/json/version');
    console.log('Connected to Chrome:', ver['User-Agent']);

    // 3. Open Sender Tab
    const senderTarget = await fetchPut('http://127.0.0.1:9222/json/new?http://localhost:3000/send');
    console.log('Sender tab opened:', senderTarget.webSocketDebuggerUrl);

    const senderCdp = new CDPClient(senderTarget.webSocketDebuggerUrl, 'SENDER');
    await senderCdp.waitOpen();
    await senderCdp.send('Runtime.enable');
    await senderCdp.send('Page.enable');
    await senderCdp.send('DOM.enable');

    await sleep(2000);

    // 4. Select file in Sender
    console.log('Uploading test file in Sender...');
    let fileInput = null;
    let doc = null;
    for (let i = 0; i < 10; i++) {
      await sleep(1000);
      try {
        doc = await senderCdp.send('DOM.getDocument');
        fileInput = await senderCdp.send('DOM.querySelector', {
          nodeId: doc.root.nodeId,
          selector: '#file-input',
        });
        if (fileInput && fileInput.nodeId) break;
      } catch {}
    }

    await senderCdp.send('DOM.setFileInputFiles', {
      files: [testFilePath],
      nodeId: fileInput.nodeId,
    });

    await senderCdp.eval(`(() => {
      const input = document.querySelector('#file-input');
      input.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);

    await sleep(1000);

    // Check button state
    const btnInfo = await senderCdp.eval(`(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Generate Instant Sharing Link'));
      return { found: !!btn, disabled: btn ? btn.disabled : null, text: btn ? btn.textContent : null };
    })()`);
    console.log('Button info:', btnInfo);

    // Click "Generate Instant Sharing Link"
    console.log('Clicking Generate Instant Sharing Link...');
    const clicked = await senderCdp.eval(`(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Generate Instant Sharing Link'));
      if (btn && !btn.disabled) { btn.click(); return true; }
      return false;
    })()`);
    console.log('Button clicked:', clicked);

    // Wait for shareUrl to be generated
    let shareUrl = null;
    for (let i = 0; i < 20; i++) {
      await sleep(500);
      shareUrl = await senderCdp.eval(`(() => {
        const input = document.querySelector('#share-link-url-input');
        return input ? input.value : null;
      })()`);
      if (shareUrl && shareUrl.includes('/receive/')) {
        console.log('Generated Share URL:', shareUrl);
        break;
      }
    }

    if (!shareUrl) {
      console.error('Failed to get share URL!');
      return;
    }

    const receiverUrl = shareUrl.replace('192.168.0.144', 'localhost').split('#')[0];
    console.log('Opening Receiver Tab without Hash URL:', receiverUrl);
    const receiverTarget = await fetchPut(`http://127.0.0.1:9222/json/new?${encodeURIComponent(receiverUrl)}`);
    const receiverCdp = new CDPClient(receiverTarget.webSocketDebuggerUrl, 'RECEIVER');
    await receiverCdp.waitOpen();
    await receiverCdp.send('Runtime.enable');
    await receiverCdp.send('Page.enable');
    await receiverCdp.send('DOM.enable');
    await receiverCdp.send('Log.enable');

    console.log('Reloading Receiver tab to capture all logs from start...');
    await receiverCdp.send('Page.reload');
    await sleep(3000);

    // Click "Accept & Start P2P Stream" in Receiver
    console.log('Waiting for and clicking Accept in Receiver...');
    const mainHtml = await receiverCdp.eval(`document.querySelector('main')?.innerHTML`);
    console.log('RECEIVER MAIN HTML:', mainHtml);

    const locInfo = await receiverCdp.eval(`({
      href: window.location.href.substring(0, 80),
      hash: window.location.hash.substring(0, 40),
      hasReact: Boolean(window.__NEXT_DATA__ || window.__next_f),
    })`);
    console.log('Receiver window.location info:', JSON.stringify(locInfo));

    const testApi = await receiverCdp.eval(`(async () => {
      try {
        const id = window.location.pathname.split('/').pop().split('#')[0];
        const res = await fetch('/api/signal?roomId=' + id);
        return { ok: res.ok, status: res.status, data: await res.json() };
      } catch (e) {
        return { error: e.message };
      }
    })()`);
    console.log('Direct fetch inside receiver tab result:', JSON.stringify(testApi));

    let acceptClicked = null;
    for (let i = 0; i < 20; i++) {
      await sleep(1000);
      const url = await receiverCdp.eval(`window.location.href`);
      const buttons = await receiverCdp.eval(`Array.from(document.querySelectorAll('button')).map(b => b.outerHTML)`);
      const text = await receiverCdp.eval(`document.body.innerText.replace(/\\n+/g, ' | ').substring(0, 150)`);
      console.log(`[Receiver Poll ${i}] url: ${url} | text: ${text} | buttons:`, buttons);
      acceptClicked = await receiverCdp.eval(`(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Accept') || b.textContent.includes('Download') || b.textContent.includes('Stream') || b.textContent.includes('Decrypt'));
        if (btn && !btn.disabled) { btn.click(); return btn.textContent; }
        return null;
      })()`);
      if (acceptClicked) break;
    }
    console.log('Accept button clicked:', acceptClicked);

    // 6. Monitor both tabs for 10 seconds
    console.log('Monitoring WebRTC connection and transfer for 10 seconds...');
    for (let i = 0; i < 10; i++) {
      await sleep(1000);
      const senderH3 = await senderCdp.eval(`document.querySelector('h3')?.textContent`);
      const receiverH2 = await receiverCdp.eval(`document.querySelector('h2')?.textContent`);
      const receiverH3 = await receiverCdp.eval(`document.querySelector('h3')?.textContent`);
      console.log(`--- [T+${i+1}s] ---`);
      console.log('Sender H3:', senderH3);
      console.log('Receiver Heading:', receiverH2 || receiverH3);
    }

  } catch (err) {
    console.error('Test error:', err);
  } finally {
    chromeProc.kill();
  }
}

main();
