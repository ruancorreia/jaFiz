const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const path = require("path");
const { Pool } = require("pg");
const { URL } = require("url");

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "db.json");
const PUBLIC_DIR = path.join(__dirname, "public");
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14;
const APP_TIME_ZONE = "America/Sao_Paulo";
const DEFAULT_PHONE_PENALTY_PER_10_MINUTES = 1;
const PHONE_RULE_MATCH = "celular";
const STATE_KEY = "main";
const DATABASE_URL = process.env.DATABASE_URL;
const pool = DATABASE_URL ? new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes("localhost") || DATABASE_URL.includes("127.0.0.1") ? false : { rejectUnauthorized: false }
}) : null;

const weekdayKeys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
function createInitialDb() {
  const now = new Date().toISOString();
  const initial = {
    users: [
      { id: id("usr"), name: "Admin", role: "admin", passwordHash: null, createdAt: now },
      { id: id("usr"), name: "Ruan", role: "responsible", passwordHash: null, createdAt: now },
      { id: id("usr"), name: "Ana Carla", role: "responsible", passwordHash: null, createdAt: now },
      { id: id("usr"), name: "Lara", role: "child", passwordHash: null, createdAt: now }
    ],
    childrenSettings: [],
    tasks: [],
    completions: [],
    monthClosings: [],
    auditLog: [],
    sessions: []
  };

  const lara = initial.users.find((user) => user.name === "Lara");
  initial.childrenSettings.push({
    childId: lara.id,
    allowance: 50,
    currency: "BRL",
    phonePenaltyPer10Minutes: DEFAULT_PHONE_PENALTY_PER_10_MINUTES
  });
  const defaults = [
    ["Limpar coco da Lola do quintal", "daily", ["sun", "mon", "tue", "wed", "thu", "fri", "sat"], "20:00", "poop"],
    ["Colocar ração para a Lola - manhã", "daily", ["sun", "mon", "tue", "wed", "thu", "fri", "sat"], "09:00", "food"],
    ["Colocar ração para a Lola - noite", "daily", ["sun", "mon", "tue", "wed", "thu", "fri", "sat"], "19:00", "food"],
    ["Trocar os tapetes de xixi da Lola", "daily", ["sun", "mon", "tue", "wed", "thu", "fri", "sat"], "20:00", "sparkles"],
    ["Lavar a louça", "weekdays", ["mon", "tue", "wed", "thu", "fri"], "21:00", "dish"],
    ["Não usar celular após 21h e antes de 6h", "daily", ["sun", "mon", "tue", "wed", "thu", "fri", "sat"], "21:00", "moon"]
  ];
  initial.tasks = defaults.map(([title, scheduleType, days, dueTime, icon]) => ({
    id: id("tsk"),
    childId: lara.id,
    title,
    scheduleType,
    days,
    dueTime,
    icon,
    weight: title.toLowerCase().includes(PHONE_RULE_MATCH) ? 2 : 1,
    requiresChildConfirmation: !title.toLowerCase().includes(PHONE_RULE_MATCH),
    active: true,
    createdAt: now
  }));

  return initial;
}

function ensureDb() {
  if (pool) return;
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(DB_FILE)) {
    migrateDbText();
    return;
  }

  writeDb(createInitialDb());
}

async function initStorage() {
  if (!pool) {
    ensureDb();
    return;
  }
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_state (
      key TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  const existing = await pool.query("SELECT 1 FROM app_state WHERE key = $1", [STATE_KEY]);
  if (existing.rowCount) {
    const db = await readDb();
    const changed = migrateDbSchema(db) || ensureMonthlyClosings(db);
    if (changed) await writeDb(db);
    return;
  }
  const seed = fs.existsSync(DB_FILE) ? JSON.parse(fs.readFileSync(DB_FILE, "utf8")) : createInitialDb();
  migrateDbSchema(seed);
  ensureMonthlyClosings(seed);
  await writeDb(seed);
}

function migrateDbText() {
  const db = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  const taskTitleMap = new Map([
    ["Colocar racao pra Lola - manha", "Colocar ração para a Lola - manhã"],
    ["Colocar racao pra Lola - noite", "Colocar ração para a Lola - noite"],
    ["Lavar a louca", "Lavar a louça"],
    ["Nao usar celular apos 21h e antes de 6h", "Não usar celular após 21h e antes de 6h"]
  ]);
  let changed = false;
  db.tasks.forEach((task) => {
    if (taskTitleMap.has(task.title)) {
      task.title = taskTitleMap.get(task.title);
      changed = true;
    }
  });
  changed = migrateDbSchema(db) || changed;
  if (changed) writeDb(db);
}

async function readDb() {
  if (pool) {
    const result = await pool.query("SELECT data FROM app_state WHERE key = $1", [STATE_KEY]);
    if (!result.rowCount) return createInitialDb();
    const db = result.rows[0].data;
    const changed = migrateDbSchema(db) || ensureMonthlyClosings(db);
    if (changed) await writeDb(db);
    return db;
  }
  ensureDb();
  const db = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  const changed = migrateDbSchema(db) || ensureMonthlyClosings(db);
  if (changed) await writeDb(db);
  return db;
}

async function writeDb(db) {
  if (pool) {
    await pool.query(`
      INSERT INTO app_state (key, data, updated_at)
      VALUES ($1, $2::jsonb, NOW())
      ON CONFLICT (key)
      DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
    `, [STATE_KEY, JSON.stringify(db)]);
    return;
  }
  fs.writeFileSync(DB_FILE, `${JSON.stringify(db, null, 2)}\n`, "utf8");
}

function addAudit(db, actorId, action, details = {}) {
  if (!Array.isArray(db.auditLog)) db.auditLog = [];
  db.auditLog.unshift({
    id: id("aud"),
    actorId,
    action,
    details,
    createdAt: new Date().toISOString()
  });
  db.auditLog = db.auditLog.slice(0, 500);
}

function id(prefix) {
  return `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored) return false;
  const [salt, hash] = stored.split(":");
  const candidate = hashPassword(password, salt).split(":")[1];
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(candidate, "hex"));
}

function parseCookies(req) {
  const header = req.headers.cookie || "";
  return Object.fromEntries(header.split(";").filter(Boolean).map((part) => {
    const [key, ...value] = part.trim().split("=");
    return [key, decodeURIComponent(value.join("="))];
  }));
}

function sendJson(res, status, payload, headers = {}) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", ...headers });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.destroy();
        reject(new Error("Payload muito grande."));
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("JSON inválido."));
      }
    });
  });
}

function cleanSessions(db) {
  const now = Date.now();
  db.sessions = db.sessions.filter((session) => new Date(session.expiresAt).getTime() > now);
}

function getSessionUser(req, db) {
  cleanSessions(db);
  const token = parseCookies(req).session;
  const session = db.sessions.find((item) => item.token === token);
  if (!session) return null;
  return db.users.find((user) => user.id === session.userId) || null;
}

function requireUser(req, res, db) {
  const user = getSessionUser(req, db);
  if (!user) sendJson(res, 401, { error: "Login necessário." });
  return user;
}

function requireResponsible(req, res, db) {
  const user = requireUser(req, res, db);
  if (!user) return null;
  if (!isResponsible(user)) {
    sendJson(res, 403, { error: "Apenas responsáveis podem fazer isso." });
    return null;
  }
  return user;
}

function requireAdmin(req, res, db) {
  const user = requireUser(req, res, db);
  if (!user) return null;
  if (!isAdmin(user)) {
    sendJson(res, 403, { error: "Apenas administradores podem fazer isso." });
    return null;
  }
  return user;
}

function isAdmin(user) {
  return user?.role === "admin";
}

function isResponsible(user) {
  return user?.role === "responsible" || isAdmin(user);
}

function saoPauloParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(date);
  return Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
}

function isoDateLocal(date = new Date()) {
  const parts = saoPauloParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function currentMinutesLocal(date = new Date()) {
  const parts = saoPauloParts(date);
  return Number(parts.hour) * 60 + Number(parts.minute);
}

function formatCalendarDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function daysInMonth(year, monthNumber) {
  return new Date(year, monthNumber, 0).getDate();
}

function isLastDayOfLocalMonth(date = new Date()) {
  const parts = saoPauloParts(date);
  return Number(parts.day) === daysInMonth(Number(parts.year), Number(parts.month));
}

function previousMonthKey(month) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(year, monthNumber - 2, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthKeysBetween(startMonth, endMonth) {
  const keys = [];
  const [startYear, startNumber] = startMonth.split("-").map(Number);
  const [endYear, endNumber] = endMonth.split("-").map(Number);
  const cursor = new Date(startYear, startNumber - 1, 1);
  const end = new Date(endYear, endNumber - 1, 1);
  while (cursor <= end) {
    keys.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`);
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return keys;
}

function isPhoneTask(task) {
  return String(task.title || "").toLowerCase().includes(PHONE_RULE_MATCH) || task.icon === "moon";
}

function phonePenaltyFor(setting, minutes) {
  const blocks = Math.ceil(Math.max(0, Number(minutes || 0)) / 10);
  return blocks * Number(setting?.phonePenaltyPer10Minutes || DEFAULT_PHONE_PENALTY_PER_10_MINUTES);
}

function minutesBetweenTimes(startTime, endTime) {
  if (!/^\d{2}:\d{2}$/.test(String(startTime)) || !/^\d{2}:\d{2}$/.test(String(endTime))) return 0;
  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);
  const start = startHour * 60 + startMinute;
  let end = endHour * 60 + endMinute;
  if (end < start) end += 24 * 60;
  return Math.max(0, end - start);
}

function migrateDbSchema(db) {
  let changed = false;
  if (!db.users.some((user) => user.role === "admin" || user.name.toLowerCase() === "admin")) {
    db.users.unshift({
      id: id("usr"),
      name: "Admin",
      role: "admin",
      passwordHash: null,
      createdAt: new Date().toISOString()
    });
    changed = true;
  }
  if (!Array.isArray(db.monthClosings)) {
    db.monthClosings = [];
    changed = true;
  }
  if (!Array.isArray(db.auditLog)) {
    db.auditLog = [];
    changed = true;
  }
  db.childrenSettings.forEach((setting) => {
    if (setting.phonePenaltyPer10Minutes === undefined || setting.phonePenaltyPer10Minutes === 2) {
      setting.phonePenaltyPer10Minutes = DEFAULT_PHONE_PENALTY_PER_10_MINUTES;
      changed = true;
    }
  });
  db.tasks.forEach((task) => {
    const phoneTask = isPhoneTask(task);
    if (task.weight === undefined) {
      task.weight = phoneTask ? 2 : 1;
      changed = true;
    }
    if (task.requiresChildConfirmation === undefined) {
      task.requiresChildConfirmation = !phoneTask;
      changed = true;
    }
  });
  db.completions.forEach((completion) => {
    if (completion.penaltyAmount === undefined) {
      completion.penaltyAmount = 0;
      changed = true;
    }
  });
  return changed;
}

function ensureMonthlyClosings(db) {
  const today = isoDateLocal();
  const currentMonth = today.slice(0, 7);
  const firstTaskMonth = db.tasks.reduce((first, task) => {
    const month = String(task.createdAt || today).slice(0, 7);
    return !first || month < first ? month : first;
  }, null);
  if (!firstTaskMonth) return false;
  const lastClosedMonth = isLastDayOfLocalMonth() ? currentMonth : previousMonthKey(currentMonth);
  if (lastClosedMonth < firstTaskMonth) return false;

  let changed = false;
  monthKeysBetween(firstTaskMonth, lastClosedMonth).forEach((month) => {
    db.users.filter((user) => user.role === "child").forEach((child) => {
      if (db.monthClosings.some((closing) => closing.childId === child.id && closing.month === month)) return;
      const summary = childSummary(db, child.id, month, { skipClosing: true });
      db.monthClosings.push({
        id: id("cls"),
        childId: child.id,
        month,
        allowance: summary.allowance,
        lost: summary.lost,
        finalAmount: summary.remaining,
        closedAt: new Date().toISOString()
      });
      changed = true;
    });
  });
  return changed;
}

function getTaskDatesForMonth(task, year, monthIndex) {
  const dates = [];
  const cursor = new Date(year, monthIndex, 1);
  const taskStart = String(task.createdAt || "").slice(0, 10);
  while (cursor.getMonth() === monthIndex) {
    const key = weekdayKeys[cursor.getDay()];
    const date = formatCalendarDate(cursor);
    if (task.active && task.days.includes(key) && (!taskStart || date >= taskStart)) dates.push(date);
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function isTaskScheduledOn(task, dateString) {
  const date = new Date(`${dateString}T12:00:00`);
  return task.active && task.days.includes(weekdayKeys[date.getDay()]);
}

function taskValueMap(db, childId, month = isoDateLocal().slice(0, 7)) {
  const [year, monthNumber] = month.split("-").map(Number);
  const monthIndex = monthNumber - 1;
  const settings = db.childrenSettings.find((item) => item.childId === childId);
  const allowance = Number(settings?.allowance || 0);
  const tasks = db.tasks.filter((task) => task.childId === childId && task.active);
  const totalOccurrences = tasks.reduce((sum, task) => sum + getTaskDatesForMonth(task, year, monthIndex).length, 0);
  const totalWeight = tasks.reduce((sum, task) => {
    return sum + getTaskDatesForMonth(task, year, monthIndex).length * Math.max(0, Number(task.weight || 1));
  }, 0);
  const unitValue = totalWeight ? allowance / totalWeight : 0;
  return {
    allowance,
    totalOccurrences,
    totalWeight,
    unitValue,
    values: Object.fromEntries(tasks.map((task) => [task.id, unitValue * Math.max(0, Number(task.weight || 1))]))
  };
}

function expectedEntriesForMonth(db, childId, month) {
  const valueMap = taskValueMap(db, childId, month);
  const tasks = db.tasks.filter((task) => task.childId === childId && task.active);
  const [year, monthNumber] = month.split("-").map(Number);
  const expected = [];
  tasks.forEach((task) => {
    getTaskDatesForMonth(task, year, monthNumber - 1).forEach((date) => {
      expected.push({ taskId: task.id, date, value: valueMap.values[task.id] || 0 });
    });
  });
  return { valueMap, tasks, expected };
}

function missedEntries(db, childId, month, throughDate = isoDateLocal()) {
  const { tasks, expected } = expectedEntriesForMonth(db, childId, month);
  const completions = db.completions.filter((item) => item.childId === childId && item.date.startsWith(month));
  const today = isoDateLocal();
  return expected.filter((entry) => {
    if (entry.date > throughDate) return false;
    const task = tasks.find((item) => item.id === entry.taskId);
    if (entry.date === throughDate && throughDate === today && task) {
      const [dueHour, dueMinute] = task.dueTime.split(":").map(Number);
      if (currentMinutesLocal() <= dueHour * 60 + dueMinute) return false;
    }
    const completion = completions.find((item) => item.taskId === entry.taskId && item.date === entry.date);
    if (isPhoneTask(task) && !completion) return false;
    return !completion || completion.status === "rejected" || completion.status === "missed";
  });
}

function progressForMonth(db, childId, month, allowance) {
  const [year, monthNumber] = month.split("-").map(Number);
  const totalDays = daysInMonth(year, monthNumber);
  const today = isoDateLocal();
  const endDay = month === today.slice(0, 7) ? Number(today.slice(8, 10)) : totalDays;
  const points = [];
  for (let day = 1; day <= endDay; day += 1) {
    const date = `${month}-${String(day).padStart(2, "0")}`;
    const missedValue = missedEntries(db, childId, month, date).reduce((sum, entry) => sum + entry.value, 0);
    const penalties = db.completions
      .filter((item) => item.childId === childId && item.date.startsWith(month) && item.date <= date)
      .reduce((sum, item) => sum + Number(item.penaltyAmount || 0), 0);
    const lost = missedValue + penalties;
    points.push({ date, lost, remaining: Math.max(0, allowance - lost) });
  }
  return points;
}

function childSummary(db, childId, month = isoDateLocal().slice(0, 7), options = {}) {
  const { valueMap } = expectedEntriesForMonth(db, childId, month);
  const completions = db.completions.filter((item) => item.childId === childId && item.date.startsWith(month));
  const missed = missedEntries(db, childId, month);
  const approved = completions.filter((item) => item.status === "approved").length;
  const pending = completions.filter((item) => item.status === "pending").length;
  const penaltyLost = completions.reduce((sum, item) => sum + Number(item.penaltyAmount || 0), 0);
  const lost = missed.reduce((sum, entry) => sum + entry.value, 0) + penaltyLost;
  const closed = db.monthClosings.find((closing) => closing.childId === childId && closing.month === month);
  return {
    allowance: valueMap.allowance,
    totalOccurrences: valueMap.totalOccurrences,
    totalWeight: valueMap.totalWeight,
    taskValue: valueMap.unitValue,
    approved,
    pending,
    missed: missed.length,
    penaltyLost,
    lost,
    remaining: Math.max(0, valueMap.allowance - lost),
    closed: options.skipClosing ? null : closed || null,
    progress: progressForMonth(db, childId, month, valueMap.allowance)
  };
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    role: user.role,
    needsPassword: !user.passwordHash
  };
}

function normalizeName(name) {
  return String(name || "").trim().replace(/\s+/g, " ");
}

function routeStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const safePath = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const filePath = path.normalize(path.join(PUBLIC_DIR, safePath));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const ext = path.extname(filePath);
    const types = { ".html": "text/html", ".css": "text/css", ".js": "application/javascript", ".json": "application/json" };
    res.writeHead(200, { "Content-Type": `${types[ext] || "application/octet-stream"}; charset=utf-8` });
    res.end(data);
  });
}

async function routeApi(req, res) {
  const db = await readDb();
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathName = url.pathname;

  try {
    if (req.method === "GET" && pathName === "/api/users") {
      return sendJson(res, 200, { users: db.users.map(publicUser) });
    }

    if (req.method === "POST" && pathName === "/api/login") {
      const body = await readBody(req);
      const name = normalizeName(body.name);
      const password = String(body.password || "");
      const nextPassword = String(body.nextPassword || "");
      const user = db.users.find((item) => item.name.toLowerCase() === name.toLowerCase());
      if (!user) return sendJson(res, 404, { error: "Usuário não encontrado." });
      if (!password && user.passwordHash) return sendJson(res, 400, { error: "Informe sua senha." });
      if (!user.passwordHash) {
        if (nextPassword.length < 4) return sendJson(res, 400, { error: "Crie uma senha com pelo menos 4 caracteres." });
        user.passwordHash = hashPassword(nextPassword);
      } else if (!verifyPassword(password, user.passwordHash)) {
        return sendJson(res, 401, { error: "Senha incorreta." });
      }
      const token = id("ses");
      db.sessions.push({ token, userId: user.id, expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString() });
      await writeDb(db);
      return sendJson(res, 200, { user: publicUser(user) }, {
        "Set-Cookie": `session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_MS / 1000}`
      });
    }

    if (req.method === "POST" && pathName === "/api/logout") {
      const token = parseCookies(req).session;
      db.sessions = db.sessions.filter((session) => session.token !== token);
      await writeDb(db);
      return sendJson(res, 200, { ok: true }, { "Set-Cookie": "session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0" });
    }

    if (req.method === "GET" && pathName === "/api/me") {
      const user = requireUser(req, res, db);
      if (!user) return;
      return sendJson(res, 200, { user: publicUser(user) });
    }

    if (req.method === "GET" && pathName === "/api/app") {
      const user = requireUser(req, res, db);
      if (!user) return;
      const today = url.searchParams.get("date") || isoDateLocal();
      const month = url.searchParams.get("month") || today.slice(0, 7);
      const children = db.users.filter((item) => item.role === "child").map((child) => ({
        ...publicUser(child),
        settings: db.childrenSettings.find((setting) => setting.childId === child.id) || {
          allowance: 0,
          phonePenaltyPer10Minutes: DEFAULT_PHONE_PENALTY_PER_10_MINUTES
        },
        summary: childSummary(db, child.id, month)
      }));
      const tasks = db.tasks.map((task) => ({ ...task, value: taskValueMap(db, task.childId, month).values[task.id] || 0 }));
      const completions = db.completions.filter((item) => item.date.startsWith(month));
      const auditLog = isResponsible(user) ? db.auditLog.slice(0, 30) : [];
      const users = isAdmin(user) ? db.users.map(publicUser) : [];
      return sendJson(res, 200, { user: publicUser(user), users, children, tasks, completions, auditLog, today, month });
    }

    if (req.method === "POST" && pathName === "/api/tasks/complete") {
      const user = requireUser(req, res, db);
      if (!user) return;
      const body = await readBody(req);
      const date = body.date || isoDateLocal();
      const task = db.tasks.find((item) => item.id === body.taskId && item.active);
      if (!task) return sendJson(res, 404, { error: "Tarefa não encontrada." });
      if (user.role !== "child" || user.id !== task.childId) return sendJson(res, 403, { error: "Essa tarefa pertence a outra criança." });
      if (isPhoneTask(task)) return sendJson(res, 403, { error: "Essa regra deve ser avaliada por um responsável." });
      if (!isTaskScheduledOn(task, date)) return sendJson(res, 400, { error: "Essa tarefa não existe nesse dia." });
      const now = new Date();
      const currentMinutes = currentMinutesLocal(now);
      const [dueHour, dueMinute] = task.dueTime.split(":").map(Number);
      const dueMinutes = dueHour * 60 + dueMinute;
      const lateMinutes = Math.max(0, currentMinutes - dueMinutes);
      if (date !== isoDateLocal() || lateMinutes > 120) {
        return sendJson(res, 400, { error: "O horário limite passou. Peça para um responsável avaliar." });
      }
      const existing = db.completions.find((item) => item.taskId === task.id && item.date === date);
      if (existing && existing.status !== "rejected") return sendJson(res, 409, { error: "Tarefa já marcada." });
      const completion = existing || { id: id("cmp"), taskId: task.id, childId: user.id, date };
      completion.status = "pending";
      completion.completedLate = lateMinutes > 0;
      completion.lateMinutes = lateMinutes;
      completion.completedAt = now.toISOString();
      completion.approvedAt = null;
      completion.approvedBy = null;
      if (!existing) db.completions.push(completion);
      await writeDb(db);
      return sendJson(res, 200, { completion });
    }

    if (req.method === "POST" && pathName === "/api/tasks") {
      const responsible = requireResponsible(req, res, db);
      if (!responsible) return;
      const body = await readBody(req);
      const child = db.users.find((item) => item.id === body.childId && item.role === "child");
      if (!child) return sendJson(res, 400, { error: "Criança inválida." });
      const title = String(body.title || "").trim();
      const dueTime = String(body.dueTime || "21:00");
      const days = Array.isArray(body.days) ? body.days.filter((day) => weekdayKeys.includes(day)) : [];
      if (title.length < 3 || !days.length || !/^\d{2}:\d{2}$/.test(dueTime)) return sendJson(res, 400, { error: "Preencha título, dias e horário." });
      const task = {
        id: id("tsk"),
        childId: child.id,
        title,
        scheduleType: body.scheduleType || "custom",
        days,
        dueTime,
        icon: body.icon || "star",
        weight: Math.max(0.1, Number(body.weight || 1)),
        requiresChildConfirmation: body.requiresChildConfirmation === false ? false : true,
        active: true,
        createdAt: new Date().toISOString()
      };
      db.tasks.push(task);
      addAudit(db, responsible.id, "task_created", { taskId: task.id, childId: child.id, title: task.title });
      await writeDb(db);
      return sendJson(res, 201, { task });
    }

    if (req.method === "PUT" && pathName.startsWith("/api/tasks/")) {
      const responsible = requireResponsible(req, res, db);
      if (!responsible) return;
      const task = db.tasks.find((item) => item.id === pathName.split("/").pop());
      if (!task) return sendJson(res, 404, { error: "Tarefa não encontrada." });
      const body = await readBody(req);
      if (body.title !== undefined) task.title = String(body.title).trim();
      if (body.dueTime !== undefined && /^\d{2}:\d{2}$/.test(body.dueTime)) task.dueTime = body.dueTime;
      if (Array.isArray(body.days)) task.days = body.days.filter((day) => weekdayKeys.includes(day));
      if (body.active !== undefined) task.active = Boolean(body.active);
      if (body.icon !== undefined) task.icon = String(body.icon);
      if (body.weight !== undefined) task.weight = Math.max(0.1, Number(body.weight || 1));
      if (body.requiresChildConfirmation !== undefined) task.requiresChildConfirmation = Boolean(body.requiresChildConfirmation);
      addAudit(db, responsible.id, "task_updated", { taskId: task.id, childId: task.childId, title: task.title });
      await writeDb(db);
      return sendJson(res, 200, { task });
    }

    if (req.method === "POST" && pathName === "/api/children") {
      const responsible = requireResponsible(req, res, db);
      if (!responsible) return;
      const body = await readBody(req);
      const name = normalizeName(body.name);
      if (name.length < 2) return sendJson(res, 400, { error: "Nome inválido." });
      if (db.users.some((item) => item.name.toLowerCase() === name.toLowerCase())) return sendJson(res, 409, { error: "Já existe usuário com esse nome." });
      const child = { id: id("usr"), name, role: "child", passwordHash: null, createdAt: new Date().toISOString() };
      db.users.push(child);
      db.childrenSettings.push({
        childId: child.id,
        allowance: Number(body.allowance || 50),
        currency: "BRL",
        phonePenaltyPer10Minutes: Number(body.phonePenaltyPer10Minutes || DEFAULT_PHONE_PENALTY_PER_10_MINUTES)
      });
      addAudit(db, responsible.id, "child_created", { childId: child.id, name: child.name });
      await writeDb(db);
      return sendJson(res, 201, { child: publicUser(child) });
    }

    if (req.method === "PUT" && pathName.startsWith("/api/children/")) {
      const responsible = requireResponsible(req, res, db);
      if (!responsible) return;
      const childId = pathName.split("/")[3];
      const child = db.users.find((item) => item.id === childId && item.role === "child");
      if (!child) return sendJson(res, 404, { error: "Criança não encontrada." });
      const body = await readBody(req);
      let setting = db.childrenSettings.find((item) => item.childId === childId);
      if (!setting) {
        setting = { childId, allowance: 0, currency: "BRL" };
        db.childrenSettings.push(setting);
      }
      if (body.allowance !== undefined) setting.allowance = Math.max(0, Number(body.allowance || 0));
      if (body.phonePenaltyPer10Minutes !== undefined) {
        setting.phonePenaltyPer10Minutes = Math.max(0, Number(body.phonePenaltyPer10Minutes || 0));
      }
      addAudit(db, responsible.id, "child_settings_updated", { childId, allowance: setting.allowance, phonePenaltyPer10Minutes: setting.phonePenaltyPer10Minutes });
      await writeDb(db);
      return sendJson(res, 200, { child: publicUser(child), setting });
    }

    if (req.method === "POST" && pathName === "/api/password") {
      const responsible = requireResponsible(req, res, db);
      if (!responsible) return;
      const body = await readBody(req);
      const targetUser = db.users.find((item) => item.id === body.userId);
      const password = String(body.password || "");
      if (!targetUser || password.length < 4) return sendJson(res, 400, { error: "Usuário ou senha inválida." });
      if (!isAdmin(responsible) && targetUser.role !== "child") {
        return sendJson(res, 403, { error: "Apenas administradores podem resetar qualquer senha." });
      }
      targetUser.passwordHash = hashPassword(password);
      db.sessions = db.sessions.filter((session) => session.userId !== targetUser.id);
      addAudit(db, responsible.id, "password_changed", { userId: targetUser.id });
      await writeDb(db);
      return sendJson(res, 200, { user: publicUser(targetUser) });
    }

    if (req.method === "POST" && pathName === "/api/completions/approve") {
      const responsible = requireResponsible(req, res, db);
      if (!responsible) return;
      const body = await readBody(req);
      const ids = Array.isArray(body.ids) ? body.ids : [];
      const status = body.status === "rejected" ? "rejected" : "approved";
      const now = new Date().toISOString();
      const changed = [];
      db.completions.forEach((completion) => {
        if (ids.includes(completion.id)) {
          completion.status = status;
          completion.approvedAt = now;
          completion.approvedBy = responsible.id;
          changed.push(completion);
          addAudit(db, responsible.id, status === "approved" ? "completion_approved" : "completion_rejected", {
            completionId: completion.id,
            taskId: completion.taskId,
            childId: completion.childId,
            date: completion.date
          });
        }
      });
      await writeDb(db);
      return sendJson(res, 200, { completions: changed });
    }

    if (req.method === "POST" && pathName === "/api/phone-rule/report") {
      const responsible = requireResponsible(req, res, db);
      if (!responsible) return;
      const body = await readBody(req);
      const child = db.users.find((item) => item.id === body.childId && item.role === "child");
      if (!child) return sendJson(res, 400, { error: "Criança inválida." });
      const date = body.date || isoDateLocal();
      const task = db.tasks.find((item) => item.childId === child.id && item.active && isPhoneTask(item));
      if (!task) return sendJson(res, 404, { error: "Regra do celular não encontrada." });
      if (!isTaskScheduledOn(task, date)) return sendJson(res, 400, { error: "A regra do celular não existe nesse dia." });

      const setting = db.childrenSettings.find((item) => item.childId === child.id);
      const fulfilled = Boolean(body.fulfilled);
      const minutes = fulfilled ? 0 : body.usedUntil
        ? minutesBetweenTimes(task.dueTime, String(body.usedUntil))
        : Math.max(0, Math.round(Number(body.minutes || 0)));
      const penaltyAmount = fulfilled ? 0 : phonePenaltyFor(setting, minutes);
      let completion = db.completions.find((item) => item.taskId === task.id && item.date === date);
      if (!completion) {
        completion = { id: id("cmp"), taskId: task.id, childId: child.id, date };
        db.completions.push(completion);
      }
      completion.status = fulfilled ? "approved" : "rejected";
      completion.completedAt = new Date().toISOString();
      completion.approvedAt = completion.completedAt;
      completion.approvedBy = responsible.id;
      completion.reportedBy = responsible.id;
      completion.reportedAt = completion.completedAt;
      completion.violationMinutes = minutes;
      completion.usedUntil = fulfilled ? null : body.usedUntil || null;
      completion.penaltyAmount = penaltyAmount;
      addAudit(db, responsible.id, fulfilled ? "phone_rule_approved" : "phone_rule_rejected", {
        completionId: completion.id,
        taskId: task.id,
        childId: child.id,
        date,
        minutes,
        penaltyAmount
      });
      await writeDb(db);
      return sendJson(res, 200, { completion });
    }

    return sendJson(res, 404, { error: "Rota não encontrada." });
  } catch (error) {
    return sendJson(res, 500, { error: error.message || "Erro inesperado." });
  }
}

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    sendJson(res, 200, { ok: true, storage: pool ? "postgres" : "json" });
    return;
  }
  if (req.url.startsWith("/api/")) {
    routeApi(req, res);
  } else {
    routeStatic(req, res);
  }
});

initStorage()
  .then(() => {
    server.listen(PORT, HOST, () => {
      console.log(`JaFiz rodando em http://${HOST}:${PORT} usando ${pool ? "PostgreSQL" : "JSON local"}`);
    });
  })
  .catch((error) => {
    console.error("Falha ao inicializar armazenamento:", error);
    process.exit(1);
  });
