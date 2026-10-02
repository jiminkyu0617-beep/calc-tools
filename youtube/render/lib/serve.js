/* 렌더 디렉터리를 정적 HTTP로 서빙한다.
   file:// 에서는 <script type="module">이 CORS로 차단되므로 http로 띄워야 한다. */
import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { join, normalize, extname } from 'node:path';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.otf': 'font/otf', '.ttf': 'font/ttf',
  '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.json': 'application/json',
};

export function serve(root) {
  const server = createServer((req, res) => {
    const rel = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
    if (rel === '/favicon.ico') { res.writeHead(204).end(); return; }   // 브라우저 기본 요청
    const file = join(root, rel);
    try {
      if (!statSync(file).isFile()) throw new Error('not a file');
      res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
      createReadStream(file).pipe(res);
    } catch {
      res.writeHead(404).end('not found');
    }
  });
  return new Promise(resolve => {
    server.listen(0, '127.0.0.1', () =>
      resolve({ port: server.address().port, close: () => server.close() }));
  });
}
