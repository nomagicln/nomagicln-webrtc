import http from 'http'
import { WebSocketServer } from 'ws'
import { attachSignaling } from './signaling'
import { createHocuspocus } from './hocuspocus'

const PORT = parseInt(process.env.PORT ?? '4444', 10)
const SIGNALING_PATH = process.env.SIGNALING_PATH ?? '/signaling'
const HOCUSPOCUS_PATH = process.env.HOCUSPOCUS_PATH ?? '/collaboration'

// ── y-webrtc signaling ──────────────────────────────────────
const signalingWss = new WebSocketServer({ noServer: true })
attachSignaling(signalingWss)

// ── Hocuspocus collaboration ────────────────────────────────
const hocuspocus = createHocuspocus()
const hocuspocusWss = new WebSocketServer({ noServer: true })
hocuspocusWss.on('connection', (ws, req) => {
  hocuspocus.handleConnection(ws, req)
})

// ── HTTP server ─────────────────────────────────────────────
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({
    name: 'nomagicln-webrtc',
    status: 'ok',
    endpoints: {
      signaling: `ws://<host>${SIGNALING_PATH}`,
      collaboration: `ws://<host>${HOCUSPOCUS_PATH}`,
    },
  }))
})

server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url ?? '/', `http://localhost`)
  const { pathname } = url

  if (pathname === SIGNALING_PATH) {
    signalingWss.handleUpgrade(request, socket, head, (ws) => {
      signalingWss.emit('connection', ws, request)
    })
  } else if (pathname === HOCUSPOCUS_PATH) {
    hocuspocusWss.handleUpgrade(request, socket, head, (ws) => {
      hocuspocusWss.emit('connection', ws, request)
    })
  } else {
    socket.destroy()
  }
})

server.listen(PORT, () => {
  console.log(`[nomagicln-webrtc] Server listening on port ${PORT}`)
  console.log(`  y-webrtc signaling  → ws://localhost:${PORT}${SIGNALING_PATH}`)
  console.log(`  Hocuspocus collab   → ws://localhost:${PORT}${HOCUSPOCUS_PATH}`)
})
