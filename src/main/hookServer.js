// The only network code in Lily: an HTTP server on 127.0.0.1 (never other interfaces) that turns
// POST /event/stop and POST /event/notification into a callback. Request bodies are never read or kept.
const http = require('node:http');

const ROUTES = { '/event/stop': 'stop', '/event/notification': 'notification' };
let server = null;

// onFail(err) is called if the port can't be used (e.g. EADDRINUSE).
function start(port, onEvent, onFail) {
  stop();
  const s = http.createServer((req, res) => {
    // Browsers always send Origin on a cross-site POST; curl doesn't, so web pages can't poke her.
    const kind = req.method === 'POST' && !req.headers.origin ? ROUTES[req.url] : undefined;
    req.resume();
    res.writeHead(kind ? 204 : 404).end();
    if (kind) onEvent(kind);
  });
  s.headersTimeout = 2000;
  s.requestTimeout = 2000;
  s.on('error', (err) => {
    if (server === s) server = null;
    onFail(err);
  });
  s.listen(port, '127.0.0.1');
  server = s;
}

function stop() {
  if (server) server.close();
  server = null;
}

module.exports = { start, stop };
