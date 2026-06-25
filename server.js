const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const path = require("path");
const { URL } = require("url");

const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "db.json");
const PUBLIC_DIR = path.join(__dirname, "public");
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14;
const APP_TIME_ZONE = "America/Sao_Paulo";

const weekdayKeys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const responsibleNames = ["Ruan", "Ana Carla"];

function ensureDb() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(DB_FILE)) return;

  const now = new Date().toISOString();
  const initial = {
    users: [
      { id: id("usr"), name: "Ruan", role: "responsible", passwordHash: null, createdAt: now },
      { id: id("usr"), name: "Ana Carla", role: "responsible", passwordHash: null, createdAt: now },
      { id: id("usr"), name: "Lara", role: "child", passwordHash: null, createdAt: now }
    ],
    childrenSettings: [],
    tasks: [],
    completions: [],
    sessions: []
  };

  const lara = initial.users.find((user) => user.name === "Lara");
  initial.childrenSettings.push({ childId: lara.id, allowance: 50, currency: "BRL" });
  const defaults = [
    ["Limpar coco da Lola do quintal", "daily", ["sun", "mon", "tue", "wed", "thu", "fri", "sat"], "20:00", "poop"],
    ["Colocar racao pra Lola - manha", "daily", ["sun", "mon", "tue", "wed", "thu", "fri", "sat"], "09:00", "food"],
    ["Colocar racao pra Lola - noite", "daily", ["sun", "mon", "tue", "wed", "thu", "fri", "sat"], "19:00", "food"],
    ["Trocar os tapetes de xixi da Lola", "daily", ["sun", "mon", "tue", "wed", "thu", "fri", "sat"], "20:00", "sparkles"],
    ["Lavar a louca", "weekdays", ["mon", "tue", "wed", "thu", "fri"], "21:00", "dish"],
    ["Nao usar celular apos 21h e antes de 6h", "daily", ["sun", "mon", "tue", "wed", "thu", "fri", "sat"], "21:00", "moon"]
  ];
  initial.tasks = defaults.map(([title, scheduleType, days, dueTime, icon]) => ({
    id: id("tsk"),
    childId: lara.id,
    title,
    scheduleType,
    days,
    dueTime,
    icon,
    active: true,
    createdAt: now
  }));

  writeDb(initial);
}

function readDb() {
  ensureDb();
  return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
}

function writeDb(db) {
  fs.writeFileSync(DB_FILE, `${JSON.stringify(db, null, 2)}\n`, "utf8");
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
        reject(new Error("JSON invalido."));
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
  if (!user) sendJson(res, 401, { error: "Login necessario." });
  return user;
}

function requireResponsible(req, res, db) {
  const user = requireUser(req, res, db);
  if (!user) return null;
  if (user.role !== "responsible") {
    sendJson(res, 403, { error: "Apenas responsaveis podem fazer isso." });
    return null;
  }
  return user;
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
  const unitValue = totalOccurrences ? allowance / totalOccurrences : 0;
  return {
    allowance,
    totalOccurrences,
    unitValue,
    values: Object.fromEntries(tasks.map((task) => [task.id, unitValue]))
  };
}

function childSummary(db, childId, month = isoDateLocal().slice(0, 7)) {
  const valueMap = taskValueMap(db, childId, month);
  const tasks = db.tasks.filter((task) => task.childId === childId && task.active);
  const [year, monthNumber] = month.split("-").map(Number);
  const expected = [];
  tasks.forEach((task) => {
    getTaskDatesForMonth(task, year, monthNumber - 1).forEach((date) => {
      expected.push({ taskId: task.id, date, value: valueMap.values[task.id] || 0 });
    });
  });

  const today = isoDateLocal();
  const completions = db.completions.filter((item) => item.childId === childId && item.date.startsWith(month));
  const missed = expected.filter((entry) => {
    if (entry.date > today) return false;
    const task = tasks.find((item) => item.id === entry.taskId);
    if (entry.date === today && task) {
      const [dueHour, dueMinute] = task.dueTime.split(":").map(Number);
      if (currentMinutesLocal() <= dueHour * 60 + dueMinute) return false;
    }
    const completion = completions.find((item) => item.taskId === entry.taskId && item.date === entry.date);
    return !completion || completion.status === "rejected" || completion.status === "missed";
  });
  const approved = completions.filter((item) => item.status === "approved").length;
  const pending = completions.filter((item) => item.status === "pending").length;
  const lost = missed.reduce((sum, entry) => sum + entry.value, 0);
  return {
    allowance: valueMap.allowance,
    totalOccurrences: valueMap.totalOccurrences,
    taskValue: valueMap.unitValue,
    approved,
    pending,
    missed: missed.length,
    lost,
    remaining: Math.max(0, valueMap.allowance - lost)
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
  const db = readDb();
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
      if (!user) return sendJson(res, 404, { error: "Usuario nao encontrado." });
      if (!password && user.passwordHash) return sendJson(res, 400, { error: "Informe sua senha." });
      if (!user.passwordHash) {
        if (nextPassword.length < 4) return sendJson(res, 400, { error: "Crie uma senha com pelo menos 4 caracteres." });
        user.passwordHash = hashPassword(nextPassword);
      } else if (!verifyPassword(password, user.passwordHash)) {
        return sendJson(res, 401, { error: "Senha incorreta." });
      }
      const token = id("ses");
      db.sessions.push({ token, userId: user.id, expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString() });
      writeDb(db);
      return sendJson(res, 200, { user: publicUser(user) }, {
        "Set-Cookie": `session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_MS / 1000}`
      });
    }

    if (req.method === "POST" && pathName === "/api/logout") {
      const token = parseCookies(req).session;
      db.sessions = db.sessions.filter((session) => session.token !== token);
      writeDb(db);
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
        settings: db.childrenSettings.find((setting) => setting.childId === child.id) || { allowance: 0 },
        summary: childSummary(db, child.id, month)
      }));
      const tasks = db.tasks.map((task) => ({ ...task, value: taskValueMap(db, task.childId, month).values[task.id] || 0 }));
      const completions = db.completions.filter((item) => item.date.startsWith(month));
      return sendJson(res, 200, { user: publicUser(user), children, tasks, completions, today, month });
    }

    if (req.method === "POST" && pathName === "/api/tasks/complete") {
      const user = requireUser(req, res, db);
      if (!user) return;
      const body = await readBody(req);
      const date = body.date || isoDateLocal();
      const task = db.tasks.find((item) => item.id === body.taskId && item.active);
      if (!task) return sendJson(res, 404, { error: "Tarefa nao encontrada." });
      if (user.role !== "child" || user.id !== task.childId) return sendJson(res, 403, { error: "Essa tarefa pertence a outra crianca." });
      if (!isTaskScheduledOn(task, date)) return sendJson(res, 400, { error: "Essa tarefa nao existe nesse dia." });
      const now = new Date();
      const currentMinutes = currentMinutesLocal(now);
      const [dueHour, dueMinute] = task.dueTime.split(":").map(Number);
      if (date !== isoDateLocal() || currentMinutes > dueHour * 60 + dueMinute) {
        return sendJson(res, 400, { error: "O horario limite passou. Peça para um responsavel avaliar." });
      }
      const existing = db.completions.find((item) => item.taskId === task.id && item.date === date);
      if (existing && existing.status !== "rejected") return sendJson(res, 409, { error: "Tarefa ja marcada." });
      const completion = existing || { id: id("cmp"), taskId: task.id, childId: user.id, date };
      completion.status = "pending";
      completion.completedAt = now.toISOString();
      completion.approvedAt = null;
      completion.approvedBy = null;
      if (!existing) db.completions.push(completion);
      writeDb(db);
      return sendJson(res, 200, { completion });
    }

    if (req.method === "POST" && pathName === "/api/tasks") {
      const responsible = requireResponsible(req, res, db);
      if (!responsible) return;
      const body = await readBody(req);
      const child = db.users.find((item) => item.id === body.childId && item.role === "child");
      if (!child) return sendJson(res, 400, { error: "Crianca invalida." });
      const title = String(body.title || "").trim();
      const dueTime = String(body.dueTime || "21:00");
      const days = Array.isArray(body.days) ? body.days.filter((day) => weekdayKeys.includes(day)) : [];
      if (title.length < 3 || !days.length || !/^\d{2}:\d{2}$/.test(dueTime)) return sendJson(res, 400, { error: "Preencha titulo, dias e horario." });
      const task = {
        id: id("tsk"),
        childId: child.id,
        title,
        scheduleType: body.scheduleType || "custom",
        days,
        dueTime,
        icon: body.icon || "star",
        active: true,
        createdAt: new Date().toISOString()
      };
      db.tasks.push(task);
      writeDb(db);
      return sendJson(res, 201, { task });
    }

    if (req.method === "PUT" && pathName.startsWith("/api/tasks/")) {
      const responsible = requireResponsible(req, res, db);
      if (!responsible) return;
      const task = db.tasks.find((item) => item.id === pathName.split("/").pop());
      if (!task) return sendJson(res, 404, { error: "Tarefa nao encontrada." });
      const body = await readBody(req);
      if (body.title !== undefined) task.title = String(body.title).trim();
      if (body.dueTime !== undefined && /^\d{2}:\d{2}$/.test(body.dueTime)) task.dueTime = body.dueTime;
      if (Array.isArray(body.days)) task.days = body.days.filter((day) => weekdayKeys.includes(day));
      if (body.active !== undefined) task.active = Boolean(body.active);
      if (body.icon !== undefined) task.icon = String(body.icon);
      writeDb(db);
      return sendJson(res, 200, { task });
    }

    if (req.method === "POST" && pathName === "/api/children") {
      const responsible = requireResponsible(req, res, db);
      if (!responsible) return;
      const body = await readBody(req);
      const name = normalizeName(body.name);
      if (name.length < 2) return sendJson(res, 400, { error: "Nome invalido." });
      if (db.users.some((item) => item.name.toLowerCase() === name.toLowerCase())) return sendJson(res, 409, { error: "Ja existe usuario com esse nome." });
      const child = { id: id("usr"), name, role: "child", passwordHash: null, createdAt: new Date().toISOString() };
      db.users.push(child);
      db.childrenSettings.push({ childId: child.id, allowance: Number(body.allowance || 50), currency: "BRL" });
      writeDb(db);
      return sendJson(res, 201, { child: publicUser(child) });
    }

    if (req.method === "PUT" && pathName.startsWith("/api/children/")) {
      const responsible = requireResponsible(req, res, db);
      if (!responsible) return;
      const childId = pathName.split("/")[3];
      const child = db.users.find((item) => item.id === childId && item.role === "child");
      if (!child) return sendJson(res, 404, { error: "Crianca nao encontrada." });
      const body = await readBody(req);
      let setting = db.childrenSettings.find((item) => item.childId === childId);
      if (!setting) {
        setting = { childId, allowance: 0, currency: "BRL" };
        db.childrenSettings.push(setting);
      }
      if (body.allowance !== undefined) setting.allowance = Math.max(0, Number(body.allowance || 0));
      writeDb(db);
      return sendJson(res, 200, { child: publicUser(child), setting });
    }

    if (req.method === "POST" && pathName === "/api/password") {
      const responsible = requireResponsible(req, res, db);
      if (!responsible) return;
      const body = await readBody(req);
      const user = db.users.find((item) => item.id === body.userId);
      const password = String(body.password || "");
      if (!user || password.length < 4) return sendJson(res, 400, { error: "Usuario ou senha invalida." });
      user.passwordHash = hashPassword(password);
      db.sessions = db.sessions.filter((session) => session.userId !== user.id);
      writeDb(db);
      return sendJson(res, 200, { user: publicUser(user) });
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
        }
      });
      writeDb(db);
      return sendJson(res, 200, { completions: changed });
    }

    return sendJson(res, 404, { error: "Rota nao encontrada." });
  } catch (error) {
    return sendJson(res, 500, { error: error.message || "Erro inesperado." });
  }
}

ensureDb();

http.createServer((req, res) => {
  if (req.url.startsWith("/api/")) {
    routeApi(req, res);
  } else {
    routeStatic(req, res);
  }
}).listen(PORT, () => {
  console.log(`JaFiz rodando em http://localhost:${PORT}`);
});
