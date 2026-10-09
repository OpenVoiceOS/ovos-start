import { createServer } from 'node:http';
import { realpathSync } from 'node:fs';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { configuration, createApi } from './node-api.mjs';
import { openDatabase } from './node-database.mjs';

/** Build a bounded HTTP listener; the only supported bind address is loopback.
 * @param {object} store Open SQLite store. @param {object} config Runtime configuration.
 * @param {Function|undefined} clock Test clock. @returns {import('node:http').Server}
 */
export function createHttpServer(store, config, clock) {
  const api = createApi(store, config, clock);
  const server = createServer({ maxHeaderSize: 8192, requestTimeout: 10000, headersTimeout: 5000, connectionsCheckingInterval: 1000 }, async (incoming, outgoing) => {
    const timer = setTimeout(() => { incoming.destroy(); outgoing.destroy(); }, 12000);
    timer.unref();
    try {
      const url = new URL(incoming.url || '/', config.publicOrigin);
      if (url.origin !== config.publicOrigin) throw new Error('Invalid request target.');
      const headers = new Headers();
      for (const [name, value] of Object.entries(incoming.headers)) {
        if (Array.isArray(value)) headers.set(name, value.join(','));
        else if (value !== undefined) headers.set(name, value);
      }
      const options = { method: incoming.method, headers };
      if (['GET', 'HEAD'].includes(incoming.method) && (incoming.headers['transfer-encoding'] || Number(incoming.headers['content-length'] || 0) > 0)) {
        outgoing.writeHead(400, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', Connection: 'close' });
        outgoing.end('{"error":"invalid_payload"}'); return;
      }
      if (!['GET', 'HEAD'].includes(incoming.method)) {
        // Bound input before making a Web Request; never buffer arbitrary HTTP bodies.
        const chunks = []; let size = 0;
        for await (const chunk of incoming) {
          size += chunk.length;
          if (size > 1024) {
            outgoing.writeHead(413, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', Connection: 'close' });
            outgoing.end('{"error":"invalid_payload"}'); return;
          }
          chunks.push(chunk);
        }
        options.body = Buffer.concat(chunks);
      }
      const response = await api(new Request(url, options), incoming.socket.remoteAddress);
      outgoing.writeHead(response.status, Object.fromEntries(response.headers));
      if (incoming.method === 'HEAD' || !response.body) outgoing.end();
      else for await (const chunk of Readable.fromWeb(response.body)) outgoing.write(chunk);
      outgoing.end();
    } catch {
      if (!outgoing.headersSent) outgoing.writeHead(503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      outgoing.end('{"error":"unavailable"}');
    } finally { clearTimeout(timer); }
  });
  server.maxConnections = 64;
  server.maxRequestsPerSocket = 100;
  server.keepAliveTimeout = 5000;
  server.on('clientError', (_error, socket) => {
    if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
  });
  return server;
}

/** Start the standalone service and release SQLite on process shutdown.
 * @param {object} env Process environment. @returns {object}
 */
export function start(env = process.env) {
  process.umask(0o077);
  const config = configuration(env), store = openDatabase(config.databasePath);
  const server = createHttpServer(store, config);
  const stop = () => {
    server.close(() => { store.close(); process.exitCode = 0; });
    server.closeIdleConnections();
    const timer = setTimeout(() => { server.closeAllConnections(); }, 13000); timer.unref();
  };
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
  server.on('error', () => { console.error('API listener unavailable.'); store.close(); process.exitCode = 1; });
  server.listen(config.port, '127.0.0.1', () => console.info('OVOS API listening on loopback.'));
  return { server, store };
}

/** Recognize the CLI even when systemd starts it through the current-release symlink.
 * @returns {boolean}
 */
function invokedDirectly() {
  try { return Boolean(process.argv[1]) && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); }
  catch { return false; }
}

if (invokedDirectly()) {
  try { start(); } catch { console.error('OVOS API could not start; check private runtime configuration.'); process.exitCode = 1; }
}
