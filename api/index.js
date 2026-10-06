const { sql } = require("@vercel/postgres");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const ADMIN_COOKIE = "apology.admin";
const SUBMIT_COOKIE = "apology.sent";
const ADMIN_MAX_AGE = 60 * 60 * 8;
const SUBMIT_MAX_AGE = 60 * 60 * 24 * 365;

function env(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function sign(value) {
  const secret = env("SESSION_SECRET");
  return crypto.createHmac("sha256", secret).update(value).digest("base64url");
}

function makeToken(value) {
  return `${value}.${sign(value)}`;
}

function verifyToken(token) {
  if (!token || typeof token !== "string") return null;
  const dot = token.lastIndexOf(".");
  if (dot < 1) return null;
  const value = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  const expected = sign(value);
  if (signature.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  return value;
}

function parseCookies(req) {
  const header = req.headers.cookie || "";
  return Object.fromEntries(
    header.split(";").map((part) => part.trim()).filter(Boolean).map((part) => {
      const i = part.indexOf("=");
      return [i === -1 ? part : part.slice(0, i), i === -1 ? "" : decodeURIComponent(part.slice(i + 1))];
    })
  );
}

function setCookie(res, name, value, maxAge) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`);
}

function clearCookie(res, name) {
  setCookie(res, name, "", 0);
}

function sendJson(res, status, body) {
  res.status(status).json(body);
}

function isAdmin(req) {
  const value = verifyToken(parseCookies(req)[ADMIN_COOKIE]);
  if (!value) return false;
  const [kind, timestamp] = value.split(":");
  if (kind !== "admin" || !timestamp) return false;
  const age = Math.floor(Date.now() / 1000) - Number(timestamp);
  return Number.isFinite(age) && age >= 0 && age <= ADMIN_MAX_AGE;
}

function alreadySubmitted(req) {
  const value = verifyToken(parseCookies(req)[SUBMIT_COOKIE]);
  return value === "submitted";
}

async function ensureDatabase() {
  await sql`
    CREATE TABLE IF NOT EXISTS responses (
      id SERIAL PRIMARY KEY,
      answer TEXT NOT NULL CHECK (answer IN ('forgiven', 'not_forgiven')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_responses_created_at ON responses(created_at)`;
}

function serveAdminPage(req, res) {
  const filename = isAdmin(req) ? "dashboard.html" : "login.html";
  const file = path.join(process.cwd(), "admin", filename);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).send(fs.readFileSync(file, "utf8"));
}

module.exports = async function handler(req, res) {
  try {
    const route = req.query?.route || "";

    if (route === "admin-page") return serveAdminPage(req, res);

    if (req.method === "POST" && route === "response") {
      const { answer } = req.body || {};
      if (answer !== "forgiven" && answer !== "not_forgiven") {
        return sendJson(res, 400, { success: false, message: "Jawaban tidak valid." });
      }
      if (alreadySubmitted(req)) {
        return sendJson(res, 409, { success: false, message: "Jawaban dari perangkat ini sudah terkirim." });
      }
      await ensureDatabase();
      await sql`INSERT INTO responses (answer) VALUES (${answer})`;
      setCookie(res, SUBMIT_COOKIE, makeToken("submitted"), SUBMIT_MAX_AGE);
      return sendJson(res, 200, { success: true });
    }

    if (req.method === "POST" && route === "admin-login") {
      const { username, password } = req.body || {};
      if (typeof username !== "string" || typeof password !== "string" || username.length > 100 || password.length > 200) {
        return sendJson(res, 400, { success: false, message: "Username atau password tidak valid." });
      }
      const usernameMatches = username === env("ADMIN_USERNAME");
      const passwordMatches = usernameMatches && await bcrypt.compare(password, env("ADMIN_PASSWORD_HASH"));
      if (!usernameMatches || !passwordMatches) {
        return sendJson(res, 401, { success: false, message: "Username atau password salah." });
      }
      setCookie(res, ADMIN_COOKIE, makeToken(`admin:${Math.floor(Date.now() / 1000)}`), ADMIN_MAX_AGE);
      return sendJson(res, 200, { success: true });
    }

    if (req.method === "POST" && route === "admin-logout") {
      if (!isAdmin(req)) return sendJson(res, 401, { success: false, message: "Unauthorized" });
      clearCookie(res, ADMIN_COOKIE);
      return sendJson(res, 200, { success: true });
    }

    if (req.method === "GET" && route === "admin-stats") {
      if (!isAdmin(req)) return sendJson(res, 401, { success: false, message: "Unauthorized" });
      await ensureDatabase();
      const result = await sql`
        SELECT COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE answer = 'forgiven')::int AS forgiven,
          COUNT(*) FILTER (WHERE answer = 'not_forgiven')::int AS "notForgiven"
        FROM responses
      `;
      return sendJson(res, 200, result.rows[0] || { total: 0, forgiven: 0, notForgiven: 0 });
    }

    if (req.method === "GET" && route === "admin-responses") {
      if (!isAdmin(req)) return sendJson(res, 401, { success: false, message: "Unauthorized" });
      await ensureDatabase();
      const result = await sql`SELECT id, answer, created_at AS "createdAt" FROM responses ORDER BY created_at DESC, id DESC`;
      return sendJson(res, 200, { success: true, responses: result.rows });
    }

    return sendJson(res, 404, { success: false, message: "Not found" });
  } catch (error) {
    console.error(error);
    return sendJson(res, 500, { success: false, message: "Terjadi gangguan pada server." });
  }
};
