import { WebSocket, WebSocketServer } from "ws";

interface Message {
  type: "subscribe" | "unsubscribe" | "publish" | "ping";
  topics?: string[];
  topic?: string;
  clients?: number;
  [key: string]: unknown;
}

const PING_INTERVAL_MS = 30_000;

export function attachSignaling(wss: WebSocketServer): void {
  // topic -> set of connected clients
  const topics = new Map<string, Set<WebSocket>>();

  function removeSubs(conn: WebSocket, subscribedTopics: Set<string>): void {
    subscribedTopics.forEach((topicName) => {
      const subs = topics.get(topicName);
      if (!subs) return;
      subs.delete(conn);
      if (subs.size === 0) topics.delete(topicName);
    });
    subscribedTopics.clear();
  }

  wss.on("connection", (conn: WebSocket) => {
    const subscribedTopics = new Set<string>();
    let closed = false;

    // Heartbeat: detect broken connections
    let isAlive = true;
    conn.on("pong", () => {
      isAlive = true;
    });
    const pingTimer = setInterval(() => {
      if (!isAlive) {
        removeSubs(conn, subscribedTopics);
        conn.terminate();
        clearInterval(pingTimer);
        return;
      }
      isAlive = false;
      conn.ping();
    }, PING_INTERVAL_MS);

    conn.on("close", () => {
      closed = true;
      clearInterval(pingTimer);
      removeSubs(conn, subscribedTopics);
    });

    conn.on("error", () => {
      closed = true;
      clearInterval(pingTimer);
      removeSubs(conn, subscribedTopics);
    });

    conn.on("message", (rawData: Buffer | string) => {
      if (closed) return;
      let message: Message;
      try {
        message = JSON.parse(rawData.toString()) as Message;
      } catch {
        return;
      }
      if (!message?.type) return;

      switch (message.type) {
        case "subscribe": {
          (message.topics ?? []).forEach((topicName) => {
            let topic = topics.get(topicName);
            if (!topic) {
              topic = new Set();
              topics.set(topicName, topic);
            }
            topic.add(conn);
            subscribedTopics.add(topicName);
          });
          break;
        }
        case "unsubscribe": {
          (message.topics ?? []).forEach((topicName) => {
            const topic = topics.get(topicName);
            if (!topic) return;
            topic.delete(conn);
            subscribedTopics.delete(topicName);
            if (topic.size === 0) topics.delete(topicName);
          });
          break;
        }
        case "publish": {
          const topicName = message.topic;
          if (!topicName) break;
          const receivers = topics.get(topicName);
          if (!receivers) break;
          message.clients = receivers.size;
          const data = JSON.stringify(message);
          receivers.forEach((receiver) => {
            if (receiver !== conn && receiver.readyState === WebSocket.OPEN) {
              receiver.send(data);
            }
          });
          break;
        }
        case "ping": {
          conn.send(JSON.stringify({ type: "pong" }));
          break;
        }
      }
    });
  });
}
