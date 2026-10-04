import { WebSocket, WebSocketServer } from "ws";

interface Room { host: WebSocket; guest: WebSocket | null }
interface Seat { code: string; role: "host" | "guest" }
const MESSAGE_TYPES = new Set(["hello", "ready", "start", "move", "undo-request", "undo-accept", "undo-reject", "resign", "rematch-request", "rematch-accept", "chat", "ping", "pong", "sync", "bye"]);

/** Two-seat, in-memory room relay. Never persists game messages. */
export function createGomokuRelay(): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 8192 });
  const rooms = new Map<string, Room>();
  const seats = new Map<WebSocket, Seat>();
  const alive = new Set<WebSocket>();
  const send = (ws: WebSocket, data: object) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
  };
  const reject = (ws: WebSocket, message: string) => {
    send(ws, { t: "error", message });
    ws.close(1008, "Room unavailable");
  };
  const timer = setInterval(() => {
    for (const ws of wss.clients) {
      if (!alive.delete(ws)) { ws.terminate(); continue; }
      ws.ping();
    }
  }, 20000);
  timer.unref();
  wss.on("close", () => clearInterval(timer));
  wss.on("connection", ws => {
    alive.add(ws);
    const registrationTimer = setTimeout(() => ws.close(1008, "Join timeout"), 10000);
    ws.on("pong", () => alive.add(ws));
    ws.on("error", () => ws.terminate());
    ws.on("message", raw => {
      let message: { t?: string; code?: string; data?: { t?: string } };
      try { message = JSON.parse(raw.toString()); } catch { reject(ws, "房间消息格式有误"); return; }
      if (!message || typeof message !== "object") { reject(ws, "房间消息格式有误"); return; }
      const seat = seats.get(ws);
      if (!seat) {
        const code = message.code;
        if (!code || !/^[A-HJ-NP-Z2-9]{5}$/.test(code)) { reject(ws, "请输入完整的 5 位房间码"); return; }
        const room = rooms.get(code);
        if (message.t === "host") {
          if (room) { reject(ws, "房间码已被占用，请换一个"); return; }
          rooms.set(code, { host: ws, guest: null });
          seats.set(ws, { code, role: "host" });
          send(ws, { t: "created", code });
        } else if (message.t === "join") {
          if (!room || room.host.readyState !== WebSocket.OPEN) { reject(ws, "没有找到该房间，请确认房间码并让房主保持页面打开"); return; }
          if (room.guest) { reject(ws, "房间已满，请确认邀请的房间"); return; }
          room.guest = ws;
          seats.set(ws, { code, role: "guest" });
          // Guest receives its seat before the host can send hello.
          send(ws, { t: "joined", code });
          send(room.host, { t: "peer-joined" });
        } else { reject(ws, "请先创建或加入房间"); return; }
        clearTimeout(registrationTimer);
        return;
      }
      if (message.t !== "message" || !message.data || typeof message.data !== "object" || !MESSAGE_TYPES.has(message.data.t ?? "")) return;
      const room = rooms.get(seat.code);
      if (!room) return;
      const opponent = seat.role === "host" ? room.guest : room.host;
      if (opponent) send(opponent, { t: "message", data: message.data });
    });
    ws.on("close", () => {
      clearTimeout(registrationTimer);
      alive.delete(ws);
      const seat = seats.get(ws);
      seats.delete(ws);
      if (!seat) return;
      const room = rooms.get(seat.code);
      if (!room) return;
      if (seat.role === "host") {
        rooms.delete(seat.code);
        if (room.guest) { send(room.guest, { t: "peer-left" }); room.guest.close(1000, "Host left"); }
      } else if (room.guest === ws) {
        room.guest = null;
        send(room.host, { t: "peer-left" });
      }
    });
  });
  return wss;
}
