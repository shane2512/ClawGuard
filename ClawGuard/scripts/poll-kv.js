const http = require('http');
require('dotenv').config({ path: 'd:/Project/ClawGuard/.env' });

const STREAM = process.env.ZG_STREAM_ID;
const key = Buffer.from('skill:defi-reader:manifest', 'utf-8').toString('base64');

function probe() {
  return new Promise((res) => {
    const payload = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'kv_getValue', params: [STREAM, key, 0, 600] });
    const req = http.request({
      host: '178.238.236.119', port: 6789, path: '/', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
    }, r => {
      let d = ''; r.on('data', c => d += c);
      r.on('end', () => res(JSON.parse(d)));
    });
    req.on('error', () => res(null));
    req.write(payload); req.end();
  });
}

async function main() {
  console.log('Stream ID:', STREAM);
  for (let i = 0; i < 10; i++) {
    const result = await probe();
    const data = result && result.result ? result.result.data : '';
    const size = result && result.result ? result.result.size : 0;
    const decoded = data ? Buffer.from(data, 'base64').toString('utf-8').slice(0, 80) : '(empty)';
    console.log(new Date().toISOString(), '| size=' + size + ' | ' + decoded);
    if (size > 0) {
      console.log('KV data is live!');
      break;
    }
    if (i < 9) await new Promise(r => setTimeout(r, 15000));
  }
}
main();
