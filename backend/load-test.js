// backend/load-test.js

import http from 'k6/http';
import ws from 'k6/ws';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 500 },  // Ramp-up to 500 virtual users
    { duration: '3m', target: 2000 }, // Stress phase: 2000 VUs
    { duration: '1m', target: 0 },    // Ramp-down
  ],
  thresholds: {
    http_req_duration: ['p(95)<200'], // 95% of HTTP requests must complete under 200ms
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3000';
const WS_URL = __ENV.WS_URL || 'ws://localhost:3000';

export default function () {
  const userId = `user_${__VU}_${__ITER}`;
  const nusp = (10000000 + __VU * 100 + __ITER).toString();
  const pin = '8821'; // Seeded PIN matching AuthGuard mock and Argon2 logic

  // 1. PIN Login Flow (HTTP POST)
  const loginPayload = JSON.stringify({ nusp, pin });
  const loginParams = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const loginRes = http.post(`${BASE_URL}/auth/login`, loginPayload, loginParams);
  check(loginRes, {
    'login status is 200 or 401 (expected)': (r) => r.status === 200 || r.status === 401,
  });

  sleep(1);

  // 2. Matchmaking Queue Entry (HTTP POST)
  const queuePayload = JSON.stringify({ userId, gameType: 'BOLA_8' });
  const queueParams = {
    headers: {
      'Content-Type': 'application/json',
    },
  };
  const queueRes = http.post(`${BASE_URL}/matchmaking/queue`, queuePayload, queueParams);
  check(queueRes, {
    'queue status is 201 or 401 (expected)': (r) => r.status === 201 || r.status === 401,
  });

  sleep(1);

  // 3. WebSocket Heartbeat Loop
  const url = `${WS_URL}/match/socket.io/?EIO=4&transport=websocket`;
  ws.connect(url, {}, function (socket) {
    socket.on('open', function () {
      // Send connection frame
      socket.send('40'); // Socket.io connection payload
      
      // Heartbeat interval simulation (high-frequency pings)
      const heartbeatInterval = setInterval(() => {
        // Emit Socket.io event frame for presence heartbeat
        const payload = `42/match,["heartbeat",{"userId":"${userId}"}]`;
        socket.send(payload);
      }, 5000);

      // Keep websocket alive for 15 seconds
      socket.setTimeout(() => {
        clearInterval(heartbeatInterval);
        socket.close();
      }, 15000);
    });

    socket.on('error', function () {
      // Ignore or catch connection drops
    });
  });
}
