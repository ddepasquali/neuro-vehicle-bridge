/**
 * OBD-II bridge: TCP (ELM327 Wi-Fi) -> WebSocket (browser)
 * Usage:
 *   OBD_HOST=192.168.0.10 OBD_PORT=35000 WS_PORT=3001 node backend/bridges/obd/bridge.js
 */
const net = require('net');
const WebSocket = require('ws');

const OBD_HOST = process.env.OBD_HOST || '192.168.0.10';
const OBD_PORT = Number(process.env.OBD_PORT || 35000);
const WS_PORT = Number(process.env.WS_PORT || 3001);

// Init commands for ELM327-style dongles
const INIT_COMMANDS = [
  'ATZ',   // reset
  'ATE0',  // echo off
  'ATL0',  // linefeeds off
  'ATS1',  // keep spaces so browser parser can split bytes
  'ATH0',  // headers off
  'ATSP0'  // auto protocol
];

const wss = new WebSocket.Server({ port: WS_PORT }, () => {
  console.log(`WS server ready at ws://localhost:${WS_PORT} -> ${OBD_HOST}:${OBD_PORT}`);
});

wss.on('connection', (ws) => {
  console.log('Browser connected');

  const sock = net.createConnection({ host: OBD_HOST, port: OBD_PORT }, () => {
    console.log('Connected to OBD dongle');
    INIT_COMMANDS.forEach(cmd => sock.write(cmd + '\r'));
  });

  const send = (obj) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
  };

  sock.on('data', (chunk) => {
    send({ type: 'obd_raw', data: chunk.toString('utf8') });
  });
  sock.on('error', (err) => send({ type: 'error', message: err.message }));
  sock.on('close', () => send({ type: 'status', message: 'obd_disconnected' }));

  ws.on('message', (msg) => {
    try {
      const parsed = JSON.parse(msg);
      if (typeof parsed.cmd === 'string') sock.write(parsed.cmd.trim() + '\r');
    } catch (_) {
      // ignore malformed messages
    }
  });

  ws.on('close', () => {
    sock.destroy();
    console.log('Browser disconnected');
  });
});
