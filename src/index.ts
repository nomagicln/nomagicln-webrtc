import http from "http";
import { WebSocketServer } from "ws";
import { createHocuspocus } from "./hocuspocus";

const PORT = parseInt(process.env.PORT ?? "4444", 10);
const HOCUSPOCUS_PATH = process.env.HOCUSPOCUS_PATH ?? "/collaboration";

// ── Hocuspocus collaboration ────────────────────────────────
const hocuspocus = createHocuspocus();
const hocuspocusWss = new WebSocketServer({ noServer: true });
hocuspocusWss.on("connection", (ws, req) => {
  hocuspocus.handleConnection(ws, req);
});

const startTime = Date.now();

// ── HTTP server ─────────────────────────────────────────────
const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost`);

  if (url.pathname === "/healthz") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "ok",
        uptime: Math.floor((Date.now() - startTime) / 1000),
        connections: hocuspocusWss.clients.size,
      }),
    );
    return;
  }

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      name: "nomagicln-webrtc",
      status: "ok",
      endpoint: `ws://<host>${HOCUSPOCUS_PATH}`,
    }),
  );
});

server.on("upgrade", (request, socket, head) => {
  const url = new URL(request.url ?? "/", `http://localhost`);

  if (url.pathname === HOCUSPOCUS_PATH) {
    hocuspocusWss.handleUpgrade(request, socket, head, (ws) => {
      hocuspocusWss.emit("connection", ws, request);
    });
  } else {
    socket.destroy();
  }
});

server.listen(PORT, () => {
  console.log(`[nomagicln-webrtc] Server listening on port ${PORT}`);
  console.log(`  Hocuspocus collab → ws://localhost:${PORT}${HOCUSPOCUS_PATH}`);
});
