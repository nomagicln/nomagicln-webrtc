# nomagicln-webrtc

A lightweight Node.js signaling server for [Yjs](https://github.com/yjs/yjs), supporting both **y-webrtc WebRTC signaling** and **Hocuspocus real-time collaboration** on a single port.

## Endpoints

| Path | Protocol | Purpose |
|---|---|---|
| `GET /` | HTTP | Health check |
| `ws://<host>/signaling` | WebSocket | y-webrtc signaling (default) |
| `ws://<host>/collaboration` | WebSocket | Hocuspocus CRDT collaboration (default) |

Paths are configurable via environment variables.

## Quick Start

### Local development

```bash
npm install
npm run dev
# Server starts at ws://localhost:4444
```

### Production build

```bash
npm run build
npm start
```

### Docker

```bash
# Build
docker build -t nomagicln-webrtc .

# Run
docker run -p 4444:4444 nomagicln-webrtc

# With custom port
docker run -p 80:80 -e PORT=80 nomagicln-webrtc
```

## Client Usage

### y-webrtc (WebRTC signaling)

```js
import * as Y from 'yjs'
import { WebrtcProvider } from 'y-webrtc'

const doc = new Y.Doc()
const provider = new WebrtcProvider('my-room', doc, {
  signaling: ['ws://localhost:4444/signaling'],
})
```

### Hocuspocus (CRDT collaboration)

```js
import { HocuspocusProvider } from '@hocuspocus/provider'
import * as Y from 'yjs'

const doc = new Y.Doc()
const provider = new HocuspocusProvider({
  url: 'ws://localhost:4444/collaboration',
  name: 'my-document',
  document: doc,
})
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `4444` | HTTP/WebSocket listen port |
| `SIGNALING_PATH` | `/signaling` | y-webrtc signaling WebSocket path |
| `HOCUSPOCUS_PATH` | `/collaboration` | Hocuspocus WebSocket path |
| `NODE_ENV` | — | Set to `production` for production |

## Deploy to Render

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

This repo includes a [`render.yaml`](./render.yaml) for one-click deployment:

1. Fork or clone this repository to your GitHub account
2. Go to [render.com](https://render.com) → New → Blueprint
3. Connect your GitHub repo
4. Render will auto-detect `render.yaml` and configure the service

The service will be available at `wss://<your-service>.onrender.com`.

## License

MIT
