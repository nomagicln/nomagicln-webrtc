const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { WebSocket } = require('ws');
const { createGomokuRelay } = require('../dist/gomoku');

test('two-seat room lifecycle, relay, capacity, disconnect and cleanup', async () => {
  const server = http.createServer();
  const wss = createGomokuRelay();
  server.on('upgrade', (req, socket, head) => wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws)));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `ws://127.0.0.1:${server.address().port}`;
  const sockets = [];
  async function client() {
    const socket = new WebSocket(url);
    sockets.push(socket);
    const messages = [], waits = [];
    socket.on('message', raw => {
      const message = JSON.parse(raw.toString());
      const index = waits.findIndex(wait => wait.type === message.t);
      if (index < 0) messages.push(message); else waits.splice(index, 1)[0].resolve(message);
    });
    await new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); });
    return {
      socket,
      send: data => socket.send(JSON.stringify(data)),
      next: type => {
        const index = messages.findIndex(message => message.t === type);
        if (index >= 0) return Promise.resolve(messages.splice(index, 1)[0]);
        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error(`Missing ${type}`)), 2000);
          waits.push({ type, resolve: message => { clearTimeout(timeout); resolve(message); } });
        });
      },
    };
  }
  try {
    const host = await client(); host.send({ t: 'host', code: 'ABC23' });
    assert.equal((await host.next('created')).code, 'ABC23');
    const collision = await client(); collision.send({ t: 'host', code: 'ABC23' });
    assert.match((await collision.next('error')).message, /占用/);
    const missing = await client(); missing.send({ t: 'join', code: 'BCD23' });
    assert.match((await missing.next('error')).message, /没有找到/);
    const guest = await client(); guest.send({ t: 'join', code: 'ABC23' });
    await guest.next('joined'); await host.next('peer-joined');
    host.send({ t: 'message', data: { t: 'move', x: 7, y: 7, color: 1, ply: 1 } });
    assert.deepEqual((await guest.next('message')).data, { t: 'move', x: 7, y: 7, color: 1, ply: 1 });
    guest.send({ t: 'message', data: { t: 'rematch-request' } });
    assert.equal((await host.next('message')).data.t, 'rematch-request');
    const third = await client(); third.send({ t: 'join', code: 'ABC23' });
    assert.match((await third.next('error')).message, /房间已满/);
    guest.socket.close(); await host.next('peer-left');
    const retry = await client(); retry.send({ t: 'join', code: 'ABC23' });
    await retry.next('joined'); await host.next('peer-joined');
    host.socket.close(); await retry.next('peer-left');
    const replaced = await client(); replaced.send({ t: 'host', code: 'ABC23' });
    assert.equal((await replaced.next('created')).code, 'ABC23');
    const invalid = await client(); invalid.send({ t: 'join', code: '../other' });
    assert.match((await invalid.next('error')).message, /房间码/);
  } finally {
    for (const socket of sockets) socket.terminate();
    for (const socket of wss.clients) socket.terminate();
    await new Promise(resolve => wss.close(resolve));
    await new Promise(resolve => server.close(resolve));
  }
});
