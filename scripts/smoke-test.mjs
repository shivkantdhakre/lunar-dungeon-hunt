// scripts/smoke-test.mjs
import { spawn } from 'child_process';
import http from 'http';
import { io } from 'socket.io-client';
import crypto from 'crypto';

const rawPort = process.env.TEST_PORT ?? '3999';
const TEST_PORT = Number(rawPort);
if (!Number.isSafeInteger(TEST_PORT) || TEST_PORT < 1024 || TEST_PORT > 65535) {
  throw new Error(`Invalid TEST_PORT: "${rawPort}". Must be between 1024 and 65535.`);
}

const SERVER_URL = `http://localhost:${TEST_PORT}`;
const ALLOWED_ORIGIN = 'http://localhost:3000';
const UNTRUSTED_ORIGIN = 'http://evil-unapproved.com';
const TEST_SECRET = 'test-secret-change-in-production-min32chars';
const TEST_ADMIN_KEY = 'test-admin-key-change-in-production-min32chars';

// Helper to generate valid HMAC test token with numeric runId (P0.4, P0.6)
function generateTestToken(role = 'arena', matchId = 'smoke-match-1', runId = 1, expOffsetSec = 300, secret = TEST_SECRET) {
  const claims = {
    matchId,
    runId,
    userId: 'smoke-test-user',
    role,
    partySide: role === 'party' ? 'A' : undefined,
    exp: Math.floor(Date.now() / 1000) + expOffsetSec,
    iss: 'lunar-dungeon-server',
    aud: 'lunar-dungeon-game',
  };
  const payloadStr = Buffer.from(JSON.stringify(claims), 'utf8').toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(payloadStr).digest('base64url');
  return `${payloadStr}.${signature}`;
}

function httpRequest(url, options = {}, body = null, timeoutMs = 2500) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const reqOptions = {
      protocol: parsed.protocol,
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method: options.method ?? 'GET',
      headers: options.headers ?? {},
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body: data }));
    });

    req.setTimeout(timeoutMs, () => {
      req.destroy();
      reject(new Error(`HTTP request to ${url} timed out after ${timeoutMs}ms`));
    });
    req.on('error', reject);

    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

// P1.11: Capture stderr/stdout and assert specific fail-closed diagnostic on placeholder secret
async function verifyPlaceholderSecretStartupFailure() {
  console.log('[SmokeTest] 0. Verifying fail-closed startup behavior for placeholder secrets...');
  const failProc = spawn('node', ['apps/server/dist/main.js'], {
    env: {
      ...process.env,
      PORT: (TEST_PORT + 1).toString(),
      WEB_ORIGIN: ALLOWED_ORIGIN,
      NODE_ENV: 'production',
      AUTH_SECRET: 'generate-a-secure-random-hmac-secret-min32chars',
      HOST_ADMIN_KEY: TEST_ADMIN_KEY,
    },
    stdio: 'pipe',
  });

  let output = '';
  failProc.stdout.on('data', (d) => { output += d.toString(); });
  failProc.stderr.on('data', (d) => { output += d.toString(); });

  const exitCode = await new Promise((resolve) => {
    const timer = setTimeout(() => {
      failProc.kill('SIGKILL');
      resolve(-1);
    }, 5000);

    failProc.on('exit', (code) => {
      clearTimeout(timer);
      resolve(code);
    });
  });

  if (exitCode === 0 || exitCode === -1) {
    throw new Error(`Security failure: Server did not fail closed on placeholder AUTH_SECRET (exit code: ${exitCode})`);
  }

  if (!output.includes('cannot use an unedited placeholder')) {
    throw new Error(`Security failure: Server exited with code ${exitCode} but did not output expected fail-closed diagnostic. Output: ${output}`);
  }

  console.log(`[SmokeTest] 0. Verified: Server exited with code ${exitCode} and logged fail-closed diagnostic.`);
}

let serverProc;
let serverExited = false;
let exitPromise;

async function spawnTestServer() {
  console.log(`[SmokeTest] Spawning test server on port ${TEST_PORT}...`);
  serverProc = spawn('node', ['apps/server/dist/main.js'], {
    env: {
      ...process.env,
      PORT: TEST_PORT.toString(),
      WEB_ORIGIN: ALLOWED_ORIGIN,
      NODE_ENV: 'test',
      LOG_LEVEL: 'warn',
      AUTH_SECRET: TEST_SECRET,
      HOST_ADMIN_KEY: TEST_ADMIN_KEY,
    },
    stdio: 'inherit',
  });

  serverProc.on('error', (err) => {
    console.error('[SmokeTest] Fatal error spawning child process:', err);
    process.exit(1);
  });

  exitPromise = new Promise((resolve) => {
    serverProc.on('exit', (code, signal) => {
      serverExited = true;
      console.log(`[SmokeTest] Server exited with code=${code}, signal=${signal}`);
      resolve({ code, signal });
    });
  });
}

async function pollHealth(timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await httpRequest(`${SERVER_URL}/health`, {}, null, 1500);
      if (res.statusCode === 200) {
        const parsed = JSON.parse(res.body);
        if (parsed.status === 'ok' && parsed.probe === 'liveness') return true;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('Timeout waiting for /health liveness probe to respond 200 OK');
}

async function verifyRestCorsHeaders() {
  const allowedRest = await httpRequest(`${SERVER_URL}/health`, {
    headers: { Origin: ALLOWED_ORIGIN },
  });
  if (allowedRest.headers['access-control-allow-origin'] !== ALLOWED_ORIGIN) {
    throw new Error(`REST CORS failed: expected ${ALLOWED_ORIGIN}, got ${allowedRest.headers['access-control-allow-origin']}`);
  }

  const untrustedRest = await httpRequest(`${SERVER_URL}/health`, {
    headers: { Origin: UNTRUSTED_ORIGIN },
  });
  const untrustedRestAllow = untrustedRest.headers['access-control-allow-origin'];
  if (untrustedRestAllow === UNTRUSTED_ORIGIN || untrustedRestAllow === '*') {
    throw new Error(`REST CORS failed: untrusted origin was granted access: ${untrustedRestAllow}`);
  }
  console.log('[SmokeTest] 2. REST CORS header policy verified.');
}

// P0.1, P0.5, P1.5, P1.6: Verify POST /matches provisioning, structured tokens, and idempotency auth
async function verifyMatchProvisioning() {
  console.log('[SmokeTest] 3. Testing POST /matches provisioning & authentication...');
  const payload = { partyAName: 'Solar Vanguard', partyBName: 'Lunar Wardens' };
  const idempotencyKey = crypto.randomUUID();

  // 1. Missing admin key -> 401
  const noKey = await httpRequest(`${SERVER_URL}/matches`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-idempotency-key': idempotencyKey },
  }, payload);
  if (noKey.statusCode !== 401) {
    throw new Error(`Expected 401 for missing admin key, got ${noKey.statusCode}`);
  }

  // 2. Invalid admin key -> 401
  const badKey = await httpRequest(`${SERVER_URL}/matches`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-host-admin-key': 'wrong-admin-key',
      'x-idempotency-key': idempotencyKey,
    },
  }, payload);
  if (badKey.statusCode !== 401) {
    throw new Error(`Expected 401 for invalid admin key, got ${badKey.statusCode}`);
  }

  // 3. Valid admin key -> 201 Created
  const created = await httpRequest(`${SERVER_URL}/matches`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-host-admin-key': TEST_ADMIN_KEY,
      'x-idempotency-key': idempotencyKey,
    },
  }, payload);
  if (created.statusCode !== 201) {
    throw new Error(`Expected 201 for valid match creation, got ${created.statusCode}: ${created.body}`);
  }

  const body = JSON.parse(created.body);
  if (!body.matchId || typeof body.runId !== 'number' || !body.tokens?.host || !body.tokens?.partyA || !body.tokens?.partyB || !body.tokens?.arena) {
    throw new Error(`Match provisioning payload incomplete: ${JSON.stringify(body)}`);
  }

  // 4. P0.1: Idempotent replay with SAME idempotency key and VALID admin key -> 201 with identical matchId
  const replay = await httpRequest(`${SERVER_URL}/matches`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-host-admin-key': TEST_ADMIN_KEY,
      'x-idempotency-key': idempotencyKey,
    },
  }, payload);
  const replayBody = JSON.parse(replay.body);
  if (replay.statusCode !== 201 || replayBody.matchId !== body.matchId) {
    throw new Error(`Idempotent match replay failed: statusCode=${replay.statusCode}, matchId=${replayBody.matchId}`);
  }

  // 5. P0.1: Idempotent lookup with SAME idempotency key but MISSING/INVALID admin key must be strictly rejected (cannot bypass auth!)
  const forgedReplay = await httpRequest(`${SERVER_URL}/matches`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-host-admin-key': 'invalid-key-attempting-cache-theft',
      'x-idempotency-key': idempotencyKey,
    },
  }, payload);
  if (forgedReplay.statusCode !== 401) {
    throw new Error(`P0.1 Security Vulnerability: Cached match retrieved without valid admin key! Status: ${forgedReplay.statusCode}`);
  }

  // 6. P1.5: Idempotent replay with SAME key but CHANGED body must be rejected with 400 without creating match
  const alteredPayload = { partyAName: 'Tampered Vanguard', partyBName: 'Lunar Wardens' };
  const alteredReplay = await httpRequest(`${SERVER_URL}/matches`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-host-admin-key': TEST_ADMIN_KEY,
      'x-idempotency-key': idempotencyKey,
    },
  }, alteredPayload);
  if (alteredReplay.statusCode !== 400) {
    throw new Error(`P1.5 Idempotency Flaw: Reused key with altered body expected 400, got ${alteredReplay.statusCode}`);
  }

  console.log(`[SmokeTest] 3. Verified: Match provisioned (matchId=${body.matchId}, runId=${body.runId}) with auth-guarded idempotency & changed-body rejection.`);
  return body;
}

async function verifyExtendedRestEndpoints(provisioned) {
  console.log('[SmokeTest] 3b. Verifying extended REST endpoints (/roles, /public, /start, /pause, /resume, /audit)...');
  // 1. GET /roles
  const rolesRes = await httpRequest(`${SERVER_URL}/roles`);
  if (rolesRes.statusCode !== 200) {
    throw new Error(`GET /roles failed: statusCode=${rolesRes.statusCode}`);
  }
  const roles = JSON.parse(rolesRes.body);
  if (!Array.isArray(roles) || roles.length !== 8) {
    throw new Error(`GET /roles invalid: expected 8 roles, got ${roles?.length}`);
  }

  // 2. GET /matches/:id/public
  const publicRes = await httpRequest(`${SERVER_URL}/matches/${provisioned.matchId}/public`);
  if (publicRes.statusCode !== 200) {
    throw new Error(`GET /matches/:id/public failed: statusCode=${publicRes.statusCode}`);
  }
  const publicSnap = JSON.parse(publicRes.body);
  if (publicSnap.matchId !== provisioned.matchId) {
    throw new Error(`Public snapshot mismatch: expected ${provisioned.matchId}, got ${publicSnap.matchId}`);
  }

  // 3. POST /matches/:id/start via host token
  const startRes = await httpRequest(`${SERVER_URL}/matches/${provisioned.matchId}/start`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${provisioned.tokens.host}` },
  });
  if (startRes.statusCode !== 201 && startRes.statusCode !== 200) {
    throw new Error(`POST /matches/:id/start failed: statusCode=${startRes.statusCode}`);
  }

  // 4. POST /matches/:id/pause via host token
  const pauseRes = await httpRequest(`${SERVER_URL}/matches/${provisioned.matchId}/pause`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${provisioned.tokens.host}`,
    },
  }, { reason: 'Smoke test pause' });
  if (pauseRes.statusCode !== 201 && pauseRes.statusCode !== 200) {
    throw new Error(`POST /matches/:id/pause failed: statusCode=${pauseRes.statusCode}`);
  }

  // 5. POST /matches/:id/resume via host token
  const resumeRes = await httpRequest(`${SERVER_URL}/matches/${provisioned.matchId}/resume`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${provisioned.tokens.host}` },
  });
  if (resumeRes.statusCode !== 201 && resumeRes.statusCode !== 200) {
    throw new Error(`POST /matches/:id/resume failed: statusCode=${resumeRes.statusCode}`);
  }

  // 6. GET /matches/:id/audit via host token
  const auditRes = await httpRequest(`${SERVER_URL}/matches/${provisioned.matchId}/audit`, {
    headers: { Authorization: `Bearer ${provisioned.tokens.host}` },
  });
  if (auditRes.statusCode !== 200) {
    throw new Error(`GET /matches/:id/audit failed: statusCode=${auditRes.statusCode}`);
  }
  const audit = JSON.parse(auditRes.body);
  if (!Array.isArray(audit.auditLog) || audit.auditLog.length < 2) {
    throw new Error(`Audit log entries missing or empty in /matches/:id/audit`);
  }

  console.log('[SmokeTest] 3b. Verified: Extended REST API endpoints (/roles, /public, /start, /pause, /resume, /audit) operational.');
}

async function verifyUntrustedPollingHandshakeRejected() {
  const socketIoPollingUrl = `${SERVER_URL}/socket.io/?EIO=4&transport=polling`;

  const allowedWs = await httpRequest(socketIoPollingUrl, {
    headers: { Origin: ALLOWED_ORIGIN },
  });
  if (allowedWs.headers['access-control-allow-origin'] !== ALLOWED_ORIGIN) {
    throw new Error(`Socket.IO polling CORS failed: expected ${ALLOWED_ORIGIN}, got ${allowedWs.headers['access-control-allow-origin']}`);
  }

  const untrustedWs = await httpRequest(socketIoPollingUrl, {
    headers: { Origin: UNTRUSTED_ORIGIN },
  });
  const untrustedWsAllow = untrustedWs.headers['access-control-allow-origin'];
  if (untrustedWsAllow === UNTRUSTED_ORIGIN || untrustedWsAllow === '*') {
    throw new Error(`Socket.IO polling CORS failed: untrusted origin header granted: ${untrustedWsAllow}`);
  }
  if (untrustedWs.statusCode !== 400 && untrustedWs.statusCode !== 403) {
    throw new Error(`Socket.IO polling security failure: expected HTTP 400 or 403 rejection from allowRequest, got HTTP ${untrustedWs.statusCode}`);
  }
  console.log(`[SmokeTest] 4. Untrusted polling handshake rejected with HTTP ${untrustedWs.statusCode}.`);
}

// P0.8, P1.15: WebSocket upgrade denied specifically due to untrusted Origin, asserting specific rejection reason
async function verifyUntrustedWebSocketUpgradeDenied(matchId, runId) {
  return new Promise((resolve, reject) => {
    const validToken = generateTestToken('arena', matchId, runId);
    const socket = io(SERVER_URL, {
      transports: ['websocket'],
      extraHeaders: { Origin: UNTRUSTED_ORIGIN },
      auth: { token: validToken },
      timeout: 3000,
    });

    socket.on('connect', () => {
      socket.disconnect();
      reject(new Error('Security violation: untrusted origin established WebSocket connection!'));
    });

    socket.on('connect_error', (err) => {
      socket.disconnect();
      if (serverExited) {
        return reject(new Error('Server crashed or exited unexpectedly during upgrade test'));
      }
      const msg = err?.message || String(err);
      if (
        !msg.toLowerCase().includes('unauthorized origin on websocket upgrade') &&
        !msg.toLowerCase().includes('websocket error')
      ) {
        return reject(new Error(`P0.8, P1.4 Security check failed: Expected deterministic origin rejection ("Unauthorized origin on WebSocket upgrade" or "websocket error"), got: "${msg}"`));
      }
      console.log(`[SmokeTest] 5. Verified: Untrusted origin WebSocket upgrade rejected specifically with: "${msg}".`);
      resolve();
    });
  });
}

// P1.13: Invalid/forged auth signature rejected on trusted origin
async function verifyInvalidAuthTokenRejected() {
  return new Promise((resolve, reject) => {
    const socket = io(SERVER_URL, {
      transports: ['websocket'],
      extraHeaders: { Origin: ALLOWED_ORIGIN },
      auth: { token: 'invalid.forged-token-payload' },
      timeout: 3000,
    });

    socket.on('connect', () => {
      socket.disconnect();
      reject(new Error('Security violation: invalid token established WebSocket connection!'));
    });

    socket.on('connect_error', (err) => {
      socket.disconnect();
      if (serverExited) {
        return reject(new Error('Server crashed or exited unexpectedly during auth test'));
      }
      if (!err.message || !err.message.includes('UNAUTHORIZED')) {
        return reject(new Error(`Security check failed: expected connect_error to contain "UNAUTHORIZED", got: "${err.message}"`));
      }
      console.log('[SmokeTest] 6. Verified: Invalid token strictly rejected with UNAUTHORIZED message.');
      resolve();
    });
  });
}

// P1.13: Expired auth token rejected on trusted origin
async function verifyExpiredAuthTokenRejected(matchId, runId) {
  return new Promise((resolve, reject) => {
    const expiredToken = generateTestToken('arena', matchId, runId, -60); // 60s in the past
    const socket = io(SERVER_URL, {
      transports: ['websocket'],
      extraHeaders: { Origin: ALLOWED_ORIGIN },
      auth: { token: expiredToken },
      timeout: 3000,
    });

    socket.on('connect', () => {
      socket.disconnect();
      reject(new Error('Security violation: Expired token established WebSocket connection!'));
    });

    socket.on('connect_error', (err) => {
      socket.disconnect();
      if (!err.message || !err.message.includes('UNAUTHORIZED: Token expired')) {
        return reject(new Error(`Security check failed: expected connect_error to contain "UNAUTHORIZED: Token expired", got: "${err.message}"`));
      }
      console.log('[SmokeTest] 7. Verified: Expired token strictly rejected with UNAUTHORIZED: Token expired.');
      resolve();
    });
  });
}

// P0.4, P0.6, P1.13: Token with valid schema and signature but STALE numeric runId rejected
async function verifyStaleRunIdRejected(matchId, currentRunId) {
  return new Promise((resolve, reject) => {
    const staleNumericRunId = currentRunId + 999;
    const staleToken = generateTestToken('arena', matchId, staleNumericRunId);
    const socket = io(SERVER_URL, {
      transports: ['websocket'],
      extraHeaders: { Origin: ALLOWED_ORIGIN },
      auth: { token: staleToken },
      timeout: 3000,
    });

    socket.on('connect', () => {
      socket.disconnect();
      reject(new Error('Security violation: Stale runId token established connection!'));
    });

    socket.on('connect_error', (err) => {
      socket.disconnect();
      if (!err.message || !err.message.includes('UNAUTHORIZED: Stale token session')) {
        return reject(new Error(`Security check failed: expected "UNAUTHORIZED: Stale token session", got: "${err.message}"`));
      }
      console.log(`[SmokeTest] 8. Verified: Stale numeric runId (${staleNumericRunId}) strictly rejected.`);
      resolve();
    });
  });
}

// P0.5: Authenticated ping/pong using provisioned host token
async function verifyAppPingPong(token, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const socket = io(SERVER_URL, {
      transports: ['polling', 'websocket'],
      extraHeaders: { Origin: ALLOWED_ORIGIN },
      auth: { token },
      timeout: timeoutMs,
    });

    const timer = setTimeout(() => {
      socket.disconnect();
      reject(new Error('WebSocket application ping/pong timed out'));
    }, timeoutMs);

    let sentPerf = 0;
    socket.on('connect', () => {
      sentPerf = Date.now();
      socket.emit('ping', { requestId: crypto.randomUUID(), sentAt: sentPerf });
    });

    socket.on('pong', (data) => {
      const rtt = Date.now() - sentPerf;
      clearTimeout(timer);
      socket.disconnect();
      console.log(`[SmokeTest] 9. Verified: Authenticated ping/pong succeeded (RTT: ${rtt}ms, serverClock: ${data.serverReceivedAt}).`);
      resolve();
    });

    socket.on('connect_error', (err) => {
      clearTimeout(timer);
      socket.disconnect();
      reject(err);
    });
  });
}

async function terminateServer() {
  if (!serverProc || serverExited) return;
  console.log('[SmokeTest] Sending SIGTERM to server...');
  serverProc.kill('SIGTERM');

  const gracePeriod = Promise.race([
    exitPromise,
    new Promise((r) => setTimeout(r, 4000)),
  ]);
  await gracePeriod;

  if (!serverExited) {
    console.log('[SmokeTest] Server still alive after SIGTERM. Sending SIGKILL...');
    serverProc.kill('SIGKILL');
    const killPeriod = Promise.race([
      exitPromise,
      new Promise((r) => setTimeout(r, 2000)),
    ]);
    await killPeriod;
  }

  if (!serverExited) {
    throw new Error('[SmokeTest] Child process failed to exit after SIGKILL');
  }
}

// P1.12: Increased global timeout budget (60s) to avoid racing worst-case path
async function run() {
  const globalTimeout = setTimeout(() => {
    console.error('[SmokeTest] Global timeout reached (60s). Forcing termination.');
    terminateServer().then(() => process.exit(1));
  }, 60000);

  let passed = false;
  try {
    await verifyPlaceholderSecretStartupFailure();
    await spawnTestServer();
    await pollHealth();
    console.log('[SmokeTest] 1. HTTP /health liveness probe responded 200 OK.');
    await verifyRestCorsHeaders();
    const match = await verifyMatchProvisioning();
    await verifyExtendedRestEndpoints(match);
    await verifyUntrustedPollingHandshakeRejected();
    await verifyUntrustedWebSocketUpgradeDenied(match.matchId, match.runId);
    await verifyInvalidAuthTokenRejected();
    await verifyExpiredAuthTokenRejected(match.matchId, match.runId);
    await verifyStaleRunIdRejected(match.matchId, match.runId);
    await verifyAppPingPong(match.tokens.host);
    passed = true;
    console.log('[SmokeTest] ALL 12 HARDENED SECURITY & FUNCTIONAL SMOKE GATES PASSED.');
  } catch (err) {
    console.error('[SmokeTest] FAILED:', err);
  } finally {
    clearTimeout(globalTimeout);
    await terminateServer();
    process.exit(passed ? 0 : 1);
  }
}

run();
