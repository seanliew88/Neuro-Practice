const SESSION_COOKIE = "neuropractice_session";
const SESSION_SECONDS = 14 * 24 * 60 * 60;
const LOGIN_WINDOW_SECONDS = 15 * 60;
const LOGIN_ATTEMPT_LIMIT = 5;
const LOGIN_SOURCE_ATTEMPT_LIMIT = 20;
const PASSWORD_ITERATIONS = 100000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GAME_RULES = {
  shapeshift: { modes: new Set(["symbol", "arrow"]), durations: new Set([60, 120, 180]) },
  tower: { modes: new Set(["tower"]), durations: new Set([60, 120, 180, 240, 300]) },
  numberbox: { modes: new Set(["classic"]), durations: new Set([60, 120, 180, 240, 300]) },
  grillmaster: { modes: new Set(["classic"]), durations: new Set([60, 120, 180]) },
  balloon: { modes: new Set(["classic"]), durations: new Set([60, 120, 180, 240, 300]) },
  figureitout: { modes: new Set(["classic"]), durations: new Set([60, 120, 180, 240, 300]) },
};

const encoder = new TextEncoder();

// Convert bytes to a compact representation suitable for D1 and cookies.
function toBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

// Generate an unpredictable URL-safe token using Workers cryptography.
function randomToken(byteLength = 32) {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(byteLength)));
}

// Derive a password hash using a unique salt and a deliberately expensive KDF.
async function hashPassword(password, salt) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const result = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: encoder.encode(salt), iterations: PASSWORD_ITERATIONS },
    key,
    256,
  );
  return toBase64Url(new Uint8Array(result));
}

// Compare fixed-length strings without leaking the first differing position.
function constantTimeEqual(left, right) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

// Return one cookie value from the request without trusting malformed pairs.
function readCookie(request, name) {
  const header = request.headers.get("Cookie") || "";
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === name) return part.slice(separator + 1).trim();
  }
  return null;
}

// Build a secure same-origin session cookie for HTTPS deployments.
function sessionCookie(id, maxAge = SESSION_SECONDS) {
  return `${SESSION_COOKIE}=${id}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

// Apply browser security headers consistently to API and static responses.
function secure(response) {
  const secured = new Response(response.body, response);
  secured.headers.set("Content-Security-Policy", "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
  secured.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  secured.headers.set("X-Content-Type-Options", "nosniff");
  secured.headers.set("X-Frame-Options", "DENY");
  secured.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  return secured;
}

// Return a JSON response with a stable API content type.
function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });
}

// Parse a small JSON request body and reject invalid input uniformly.
async function requestJson(request) {
  const contentLength = Number(request.headers.get("Content-Length") || 0);
  if (contentLength > 32768) throw new Error("Request body is too large.");
  try {
    const payload = await request.json();
    return payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};
  } catch {
    throw new Error("A valid JSON request body is required.");
  }
}

// Load an unexpired session and its optional account from D1.
async function loadSession(request, env) {
  const id = readCookie(request, SESSION_COOKIE);
  if (!id) return null;
  return env.DB.prepare(
    `SELECT sessions.id, sessions.user_id, sessions.csrf_token, sessions.expires_at,
            users.email, users.display_name
       FROM sessions LEFT JOIN users ON users.id = sessions.user_id
      WHERE sessions.id = ? AND sessions.expires_at > ?`,
  ).bind(id, Math.floor(Date.now() / 1000)).first();
}

// Create an anonymous session used for login CSRF protection.
async function createSession(env, userId = null) {
  const session = {
    id: randomToken(),
    user_id: userId,
    csrf_token: randomToken(),
    expires_at: Math.floor(Date.now() / 1000) + SESSION_SECONDS,
  };
  await env.DB.prepare(
    "INSERT INTO sessions (id, user_id, csrf_token, expires_at) VALUES (?, ?, ?, ?)",
  ).bind(session.id, session.user_id, session.csrf_token, session.expires_at).run();
  return session;
}

// Ensure state-changing requests carry the token associated with the session.
function csrfMatches(request, session) {
  const supplied = request.headers.get("X-CSRF-Token") || "";
  return Boolean(session && supplied && constantTimeEqual(supplied, session.csrf_token));
}

// Replace an anonymous or old session after successful authentication.
async function rotateSession(env, previousSession, userId) {
  const next = await createSession(env, userId);
  if (previousSession) await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(previousSession.id).run();
  return next;
}

// Expose only non-sensitive account fields to the browser.
function publicUser(session) {
  return session?.user_id
    ? { id: session.user_id, email: session.email, displayName: session.display_name }
    : null;
}

// Calculate trusted statistics and sanitize game-specific numeric details.
function validatePerformance(payload) {
  const rules = GAME_RULES[payload.game];
  if (!rules) throw new Error("Unsupported game.");
  if (!rules.modes.has(payload.mode)) throw new Error("Unsupported game mode.");
  if (!rules.durations.has(payload.durationSeconds)) throw new Error("Unsupported session duration.");
  if (!Number.isInteger(payload.correct) || !Number.isInteger(payload.total)) {
    throw new Error("Correct and total answers must be integers.");
  }
  if (payload.correct < 0 || payload.total < 0 || payload.correct > payload.total) {
    throw new Error("Correct answers must be between zero and total answers.");
  }
  if (typeof payload.startedAt !== "string" || !payload.startedAt || payload.startedAt.length > 80) {
    throw new Error("A valid session start time is required.");
  }
  if (payload.details !== undefined && (typeof payload.details !== "object" || Array.isArray(payload.details) || payload.details === null)) {
    throw new Error("Details must be a JSON object.");
  }
  const details = {};
  for (const [key, value] of Object.entries(payload.details || {})) {
    if (key.length <= 80 && Number.isInteger(value) && value >= 0) details[key] = value;
  }
  const score = payload.correct - (payload.total - payload.correct);
  return {
    id: crypto.randomUUID(),
    game: payload.game,
    mode: payload.mode,
    durationSeconds: payload.durationSeconds,
    correct: payload.correct,
    total: payload.total,
    accuracy: Math.round(((payload.total ? payload.correct / payload.total * 100 : 0) + Number.EPSILON) * 10) / 10,
    score,
    scorePerMinute: Math.round(((score * 60 / payload.durationSeconds) + Number.EPSILON) * 10) / 10,
    details,
    startedAt: payload.startedAt,
    savedAt: new Date().toISOString(),
  };
}

// Convert a D1 performance row to the established browser response shape.
function serializePerformance(row) {
  return {
    id: row.id,
    game: row.game,
    mode: row.mode,
    durationSeconds: row.duration_seconds,
    correct: row.correct,
    total: row.total,
    accuracy: row.accuracy,
    score: row.score,
    scorePerMinute: row.score_per_minute,
    details: JSON.parse(row.details || "{}"),
    startedAt: row.started_at,
    savedAt: row.saved_at,
  };
}

// Count recent failed attempts for one account or source identifier.
async function loginAllowed(env, identifier, limit, now) {
  const result = await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM login_attempts WHERE identifier = ? AND attempted_at >= ?",
  ).bind(identifier, now - LOGIN_WINDOW_SECONDS).first();
  return Number(result?.count || 0) < limit;
}

// Record a failed login or clear failures after successful authentication.
async function updateLoginAttempts(env, identifiers, failed, now) {
  if (failed) {
    await env.DB.batch(identifiers.map((identifier) => env.DB.prepare(
      "INSERT INTO login_attempts (identifier, attempted_at) VALUES (?, ?)",
    ).bind(identifier, now)));
  } else {
    await env.DB.batch(identifiers.map((identifier) => env.DB.prepare(
      "DELETE FROM login_attempts WHERE identifier = ?",
    ).bind(identifier)));
  }
}

// Remove expired security records during the daily scheduled maintenance run.
async function cleanExpiredRecords(env) {
  const now = Math.floor(Date.now() / 1000);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM sessions WHERE expires_at <= ?").bind(now),
    env.DB.prepare("DELETE FROM login_attempts WHERE attempted_at < ?").bind(now - LOGIN_WINDOW_SECONDS),
  ]);
}

// Serve authentication lifecycle endpoints using D1-backed sessions.
async function handleAuth(request, env, pathname, session) {
  if (pathname === "/api/auth/me" && request.method === "GET") {
    const active = session || await createSession(env);
    const headers = session ? {} : { "Set-Cookie": sessionCookie(active.id) };
    return json({ user: publicUser(active), csrfToken: active.csrf_token }, 200, headers);
  }

  if (!["/api/auth/register", "/api/auth/login", "/api/auth/logout"].includes(pathname) || request.method !== "POST") {
    return json({ error: "Not found." }, 404);
  }
  if (!csrfMatches(request, session)) return json({ error: "Invalid security token. Refresh and try again." }, 403);

  if (pathname === "/api/auth/logout") {
    if (!session.user_id) return json({ error: "Authentication required." }, 401);
    await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(session.id).run();
    return json({ ok: true }, 200, { "Set-Cookie": sessionCookie("", 0) });
  }

  let payload;
  try {
    payload = await requestJson(request);
  } catch (error) {
    return json({ error: error.message }, 400);
  }
  const email = String(payload.email || "").trim().toLowerCase();
  const password = String(payload.password || "");

  if (pathname === "/api/auth/register") {
    const displayName = String(payload.displayName || "").trim();
    if (!EMAIL_PATTERN.test(email) || email.length > 254) return json({ error: "Enter a valid email address." }, 400);
    if (displayName.length < 2 || displayName.length > 40) return json({ error: "Display name must be 2 to 40 characters." }, 400);
    if (password.length < 10 || password.length > 128) return json({ error: "Password must be 10 to 128 characters." }, 400);
    const userId = crypto.randomUUID();
    const salt = randomToken(16);
    const passwordHash = await hashPassword(password, salt);
    try {
      await env.DB.prepare(
        "INSERT INTO users (id, email, display_name, password_hash, password_salt, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      ).bind(userId, email, displayName, passwordHash, salt, new Date().toISOString()).run();
    } catch (error) {
      if (String(error).toLowerCase().includes("unique")) return json({ error: "An account with that email already exists." }, 409);
      throw error;
    }
    const next = await rotateSession(env, session, userId);
    return json({ user: { id: userId, email, displayName }, csrfToken: next.csrf_token }, 201, { "Set-Cookie": sessionCookie(next.id) });
  }

  const now = Math.floor(Date.now() / 1000);
  const source = request.headers.get("CF-Connecting-IP") || "unknown";
  const identifiers = [`account:${email}`, `source:${source}`];
  if (!await loginAllowed(env, identifiers[0], LOGIN_ATTEMPT_LIMIT, now)
      || !await loginAllowed(env, identifiers[1], LOGIN_SOURCE_ATTEMPT_LIMIT, now)) {
    return json({ error: "Too many sign-in attempts. Try again in 15 minutes." }, 429);
  }
  const user = await env.DB.prepare(
    "SELECT id, email, display_name, password_hash, password_salt FROM users WHERE email = ? COLLATE NOCASE",
  ).bind(email).first();
  const suppliedHash = await hashPassword(password, user?.password_salt || "invalid-account-salt");
  if (!user || !constantTimeEqual(suppliedHash, user.password_hash)) {
    await updateLoginAttempts(env, identifiers, true, now);
    return json({ error: "Email or password is incorrect." }, 401);
  }
  await updateLoginAttempts(env, identifiers, false, now);
  const next = await rotateSession(env, session, user.id);
  return json({ user: { id: user.id, email: user.email, displayName: user.display_name }, csrfToken: next.csrf_token }, 200, { "Set-Cookie": sessionCookie(next.id) });
}

// Load and store account-scoped game performance records.
async function handlePerformances(request, env, url, session) {
  if (!session?.user_id) return json({ error: "Authentication required." }, 401);
  if (request.method === "GET") {
    const game = url.searchParams.get("game");
    if (game && !GAME_RULES[game]) return json({ error: "Unsupported game." }, 400);
    const query = game
      ? env.DB.prepare("SELECT * FROM performances WHERE user_id = ? AND game = ? ORDER BY saved_at DESC LIMIT 50").bind(session.user_id, game)
      : env.DB.prepare("SELECT * FROM performances WHERE user_id = ? ORDER BY saved_at DESC LIMIT 50").bind(session.user_id);
    const result = await query.all();
    return json({ performances: result.results.map(serializePerformance) });
  }
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  if (!csrfMatches(request, session)) return json({ error: "Invalid security token. Refresh and try again." }, 403);
  let performance;
  try {
    performance = validatePerformance(await requestJson(request));
  } catch (error) {
    return json({ error: error.message }, 400);
  }
  await env.DB.prepare(
    `INSERT INTO performances
      (id, user_id, game, mode, duration_seconds, correct, total, accuracy, score,
       score_per_minute, details, started_at, saved_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    performance.id, session.user_id, performance.game, performance.mode,
    performance.durationSeconds, performance.correct, performance.total,
    performance.accuracy, performance.score, performance.scorePerMinute,
    JSON.stringify(performance.details), performance.startedAt, performance.savedAt,
  ).run();
  await env.DB.prepare(
    `DELETE FROM performances WHERE user_id = ? AND id IN (
       SELECT id FROM performances WHERE user_id = ? ORDER BY saved_at DESC LIMIT -1 OFFSET 50
     )`,
  ).bind(session.user_id, session.user_id).run();
  return json({ performance }, 201);
}

// Route API requests and guard game assets before delegating to static assets.
async function handleRequest(request, env) {
  const url = new URL(request.url);
  const session = await loadSession(request, env);
  if (url.pathname.startsWith("/api/auth/")) return handleAuth(request, env, url.pathname, session);
  if (url.pathname === "/api/performances") return handlePerformances(request, env, url, session);
  if (url.pathname === "/health") {
    await env.DB.prepare("SELECT 1").first();
    return json({ status: "ok" });
  }
  if (url.pathname.startsWith("/games/") && !session?.user_id) {
    const next = `${url.pathname}${url.search}`;
    return Response.redirect(`${url.origin}/account/?next=${encodeURIComponent(next)}`, 302);
  }
  return env.ASSETS.fetch(request);
}

export default {
  async fetch(request, env) {
    try {
      return secure(await handleRequest(request, env));
    } catch (error) {
      console.error(error);
      return secure(json({ error: "Internal server error." }, 500));
    }
  },
  async scheduled(_controller, env) {
    await cleanExpiredRecords(env);
  },
};

export { constantTimeEqual, readCookie, serializePerformance, validatePerformance };
