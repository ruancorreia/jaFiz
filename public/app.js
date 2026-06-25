const app = document.querySelector("#app");
const weekdays = [
  ["sun", "Dom"],
  ["mon", "Seg"],
  ["tue", "Ter"],
  ["wed", "Qua"],
  ["thu", "Qui"],
  ["fri", "Sex"],
  ["sat", "Sab"]
];
const iconMap = {
  poop: "🧹",
  food: "🥣",
  sparkles: "✨",
  dish: "🍽️",
  moon: "🌙",
  star: "⭐"
};
let state = { view: "dashboard", data: null, me: null };

const money = (value) => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const today = () => new Date().toISOString().slice(0, 10);
const currentMonth = () => today().slice(0, 7);

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Algo saiu do trilho.");
  return payload;
}

function el(html) {
  const template = document.createElement("template");
  template.innerHTML = html.trim();
  return template.content.firstElementChild;
}

async function init() {
  try {
    const { user } = await api("/api/me");
    state.me = user;
    await loadApp();
  } catch {
    renderLogin();
  }
}

async function loadApp() {
  state.data = await api(`/api/app?date=${today()}&month=${currentMonth()}`);
  state.me = state.data.user;
  if (state.me.role === "child") renderChild();
  else renderResponsible();
}

async function renderLogin() {
  const usersPayload = await api("/api/users");
  app.innerHTML = "";
  const view = el(`
    <main class="login-shell">
      <section class="login-card">
        <div class="login-art">
          <div class="brand">JaFiz</div>
          <div>
            <h1>Tarefa feita vira conquista.</h1>
            <p>Mesada clara, combinados visiveis e aprovacao dos responsaveis no mesmo lugar.</p>
          </div>
        </div>
        <form class="login-form">
          <div>
            <h2>Entrar</h2>
            <p class="page-title p">Escolha seu nome. No primeiro acesso voce cria sua senha.</p>
          </div>
          <label class="field">
            <span>Usuario</span>
            <select name="name"></select>
          </label>
          <label class="field password-field">
            <span>Senha</span>
            <input name="password" type="password" autocomplete="current-password">
          </label>
          <label class="field first-password" hidden>
            <span>Criar senha</span>
            <input name="nextPassword" type="password" autocomplete="new-password">
          </label>
          <button class="primary" type="submit">Entrar</button>
          <div class="error" role="alert"></div>
        </form>
      </section>
    </main>
  `);
  const select = view.querySelector("select");
  usersPayload.users.forEach((user) => {
    const option = document.createElement("option");
    option.value = user.name;
    option.textContent = user.needsPassword ? `${user.name} (primeiro acesso)` : user.name;
    option.dataset.needsPassword = user.needsPassword;
    select.appendChild(option);
  });
  const syncPasswordMode = () => {
    const needs = select.selectedOptions[0]?.dataset.needsPassword === "true";
    view.querySelector(".first-password").hidden = !needs;
    view.querySelector(".password-field").hidden = needs;
  };
  select.addEventListener("change", syncPasswordMode);
  syncPasswordMode();
  view.querySelector("form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api("/api/login", {
        method: "POST",
        body: JSON.stringify({
          name: form.get("name"),
          password: form.get("password"),
          nextPassword: form.get("nextPassword")
        })
      });
      await loadApp();
    } catch (error) {
      view.querySelector(".error").textContent = error.message;
    }
  });
  app.appendChild(view);
}

function completionFor(taskId, date = today()) {
  return state.data.completions.find((item) => item.taskId === taskId && item.date === date);
}

function statusText(status) {
  return { pending: "Aguardando", approved: "Aprovada", rejected: "Nao valeu" }[status] || "Aberta";
}

function renderChild() {
  const child = state.data.children.find((item) => item.id === state.me.id);
  const tasks = state.data.tasks.filter((task) => task.childId === child.id && task.active && task.days.includes(dayKey(today())));
  const summary = child.summary;
  app.innerHTML = "";
  const shell = el(`
    <main class="child-shell">
      <div class="child-top">
        <div class="brand">JaFiz</div>
        <button class="ghost logout" type="button">Sair</button>
      </div>
      <section class="child-hero">
        <div>
          <h1>Oi, ${escapeHtml(child.name)}!</h1>
          <p>Marque as tarefas antes do horario limite. Depois um responsavel confere e aprova.</p>
        </div>
        <div class="score-grid">
          <div class="score"><span>Mesada prevista</span><strong>${money(summary.remaining)}</strong></div>
          <div class="score"><span>Feitas</span><strong>${summary.approved}</strong></div>
          <div class="score"><span>Pendentes</span><strong>${summary.pending}</strong></div>
        </div>
      </section>
      <section class="task-board"></section>
    </main>
  `);
  const board = shell.querySelector(".task-board");
  if (!tasks.length) board.appendChild(el(`<div class="task-card"><h3>Nada para hoje</h3><p class="task-meta">Aproveite o dia.</p></div>`));
  tasks.forEach((task) => board.appendChild(renderChildTask(task)));
  shell.querySelector(".logout").addEventListener("click", logout);
  app.appendChild(shell);
}

function renderChildTask(task) {
  const completion = completionFor(task.id);
  const late = isPastDue(task);
  const card = el(`
    <article class="task-card ${completion ? "done" : late ? "late" : ""}">
      <div>
        <div class="task-icon">${iconMap[task.icon] || iconMap.star}</div>
        <h3>${escapeHtml(task.title)}</h3>
        <div class="task-meta">
          <span class="pill">Ate ${task.dueTime}</span>
          <span class="pill">${money(task.value)}</span>
          <span class="pill ${completion ? `status-${completion.status}` : ""}">${completion ? statusText(completion.status) : late ? "Passou do horario" : "Aberta"}</span>
        </div>
      </div>
      <button class="primary" type="button" ${completion || late ? "disabled" : ""}>Ja fiz</button>
    </article>
  `);
  card.querySelector("button").addEventListener("click", async () => {
    try {
      await api("/api/tasks/complete", { method: "POST", body: JSON.stringify({ taskId: task.id, date: today() }) });
      await loadApp();
    } catch (error) {
      alert(error.message);
    }
  });
  return card;
}

function renderResponsible() {
  const child = state.data.children[0];
  const summary = child?.summary || {};
  app.innerHTML = "";
  const shell = el(`
    <main class="layout">
      <aside class="sidebar">
        <div class="brand">JaFiz</div>
        <button class="nav-button active" data-view="dashboard">🏠 Painel</button>
        <button class="nav-button" data-view="tasks">✅ Tarefas</button>
        <button class="nav-button" data-view="family">👥 Familia</button>
        <button class="nav-button logout">↩ Sair</button>
      </aside>
      <section class="main">
        <div class="topbar">
          <div class="page-title">
            <h1>Painel dos responsaveis</h1>
            <p>Hoje: ${new Date().toLocaleDateString("pt-BR")}</p>
          </div>
          <div class="row-actions">
            <button class="secondary approve-selected" type="button">Aprovar selecionadas</button>
            <button class="secondary approve-all" type="button">Aprovar pendentes</button>
          </div>
        </div>
        <div class="cards">
          <div class="metric"><span>Mesada atual</span><strong>${money(summary.allowance)}</strong></div>
          <div class="metric"><span>Previsto a receber</span><strong>${money(summary.remaining)}</strong></div>
          <div class="metric"><span>Valor por tarefa</span><strong>${money(summary.taskValue)}</strong></div>
          <div class="metric"><span>Pendentes</span><strong>${summary.pending || 0}</strong></div>
        </div>
        <div class="content"></div>
      </section>
    </main>
  `);
  shell.querySelectorAll(".nav-button[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      state.view = button.dataset.view;
      shell.querySelectorAll(".nav-button[data-view]").forEach((item) => item.classList.toggle("active", item === button));
      renderResponsibleContent(shell.querySelector(".content"));
    });
  });
  shell.querySelector(".logout").addEventListener("click", logout);
  shell.querySelector(".approve-all").addEventListener("click", () => approveAllPending());
  shell.querySelector(".approve-selected").addEventListener("click", () => approveSelected());
  app.appendChild(shell);
  renderResponsibleContent(shell.querySelector(".content"));
}

function renderResponsibleContent(container) {
  if (state.view === "tasks") return renderTasksView(container);
  if (state.view === "family") return renderFamilyView(container);
  return renderDashboardView(container);
}

function renderDashboardView(container) {
  const pending = state.data.completions.filter((item) => item.status === "pending");
  container.innerHTML = `
    <div class="workspace">
      <section class="table-wrap">
        <table>
          <thead><tr><th></th><th>Crianca</th><th>Tarefa</th><th>Dia</th><th>Status</th><th>Acoes</th></tr></thead>
          <tbody></tbody>
        </table>
      </section>
      <section class="panel">
        <h2>Resumo do mes</h2>
        ${state.data.children.map((child) => `
          <p><strong>${escapeHtml(child.name)}</strong></p>
          <p>Mesada: ${money(child.summary.allowance)}</p>
          <p>Descontos: ${money(child.summary.lost)}</p>
          <p>Recebe hoje: ${money(child.summary.remaining)}</p>
        `).join("")}
      </section>
    </div>
  `;
  const tbody = container.querySelector("tbody");
  const rows = state.data.completions.slice().sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty">Nenhuma tarefa marcada ainda.</div></td></tr>`;
    return;
  }
  rows.forEach((completion) => tbody.appendChild(completionRow(completion, pending)));
}

function completionRow(completion) {
  const task = state.data.tasks.find((item) => item.id === completion.taskId);
  const child = state.data.children.find((item) => item.id === completion.childId);
  const row = el(`
    <tr>
      <td><input type="checkbox" data-id="${completion.id}" ${completion.status === "pending" ? "" : "disabled"}></td>
      <td>${escapeHtml(child?.name || "-")}</td>
      <td>${escapeHtml(task?.title || "-")}</td>
      <td>${completion.date.split("-").reverse().join("/")}</td>
      <td><span class="pill status-${completion.status}">${statusText(completion.status)}</span></td>
      <td class="row-actions">
        <button class="secondary approve" ${completion.status !== "pending" ? "disabled" : ""}>Aprovar</button>
        <button class="danger reject" ${completion.status !== "pending" ? "disabled" : ""}>Rejeitar</button>
      </td>
    </tr>
  `);
  row.querySelector(".approve").addEventListener("click", () => approveIds([completion.id], "approved"));
  row.querySelector(".reject").addEventListener("click", () => approveIds([completion.id], "rejected"));
  return row;
}

function renderTasksView(container) {
  const child = state.data.children[0];
  container.innerHTML = `
    <div class="workspace">
      <section class="table-wrap">
        <table>
          <thead><tr><th>Tarefa</th><th>Crianca</th><th>Dias</th><th>Limite</th><th>Valor</th><th>Ativa</th></tr></thead>
          <tbody></tbody>
        </table>
      </section>
      <section class="panel">
        <h2>Nova tarefa</h2>
        <form class="task-form">
          <label class="field full"><span>Crianca</span><select name="childId">${state.data.children.map((item) => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join("")}</select></label>
          <label class="field full"><span>Titulo</span><input name="title" required placeholder="Ex: Guardar mochila"></label>
          <div class="form-grid">
            <label class="field"><span>Horario limite</span><input name="dueTime" type="time" value="21:00" required></label>
            <label class="field"><span>Icone</span><select name="icon"><option value="star">Estrela</option><option value="food">Comida</option><option value="sparkles">Brilho</option><option value="dish">Louca</option><option value="moon">Noite</option><option value="poop">Limpeza</option></select></label>
          </div>
          <label class="field full">
            <span>Dias</span>
            <div class="row-actions">
              <button class="ghost preset-weekdays" type="button">Dias uteis</button>
              <button class="ghost preset-all" type="button">Todos</button>
              <button class="ghost preset-clear" type="button">Especificos</button>
            </div>
            <div class="days-grid">${weekdays.map(([key, label]) => `<button class="day-toggle" type="button" data-day="${key}">${label}</button>`).join("")}</div>
          </label>
          <button class="primary" type="submit">Criar tarefa</button>
        </form>
      </section>
    </div>
  `;
  const tbody = container.querySelector("tbody");
  state.data.tasks.forEach((task) => {
    const owner = state.data.children.find((item) => item.id === task.childId);
    tbody.appendChild(el(`
      <tr>
        <td>${escapeHtml(task.title)}</td>
        <td>${escapeHtml(owner?.name || "-")}</td>
        <td>${task.days.map((day) => weekdays.find(([key]) => key === day)?.[1]).join(", ")}</td>
        <td>${task.dueTime}</td>
        <td>${money(task.value)}</td>
        <td><span class="pill">${task.active ? "Sim" : "Nao"}</span></td>
      </tr>
    `));
  });
  const form = container.querySelector(".task-form");
  const selectedDays = new Set(["mon", "tue", "wed", "thu", "fri"]);
  const syncDayButtons = () => form.querySelectorAll(".day-toggle").forEach((button) => {
    button.classList.toggle("active", selectedDays.has(button.dataset.day));
  });
  form.querySelectorAll(".day-toggle").forEach((button) => {
    syncDayButtons();
    button.addEventListener("click", () => {
      if (selectedDays.has(button.dataset.day)) selectedDays.delete(button.dataset.day);
      else selectedDays.add(button.dataset.day);
      syncDayButtons();
    });
  });
  form.querySelector(".preset-weekdays").addEventListener("click", () => {
    selectedDays.clear();
    ["mon", "tue", "wed", "thu", "fri"].forEach((day) => selectedDays.add(day));
    syncDayButtons();
  });
  form.querySelector(".preset-all").addEventListener("click", () => {
    selectedDays.clear();
    weekdays.forEach(([day]) => selectedDays.add(day));
    syncDayButtons();
  });
  form.querySelector(".preset-clear").addEventListener("click", () => {
    selectedDays.clear();
    syncDayButtons();
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    try {
      await api("/api/tasks", {
        method: "POST",
        body: JSON.stringify({
          childId: data.get("childId"),
          title: data.get("title"),
          dueTime: data.get("dueTime"),
          icon: data.get("icon"),
          days: [...selectedDays]
        })
      });
      await loadApp();
      state.view = "tasks";
      renderResponsible();
    } catch (error) {
      alert(error.message);
    }
  });
}

function renderFamilyView(container) {
  container.innerHTML = `
    <div class="workspace">
      <section class="panel">
        <h2>Criancas</h2>
        ${state.data.children.map((child) => `
          <form class="child-settings" data-id="${child.id}">
            <p><strong>${escapeHtml(child.name)}</strong></p>
            <div class="form-grid">
              <label class="field"><span>Mesada mensal</span><input name="allowance" type="number" min="0" step="0.01" value="${child.settings.allowance || 0}"></label>
              <label class="field"><span>Nova senha</span><input name="password" type="password" placeholder="Opcional"></label>
            </div>
            <button class="secondary" type="submit">Salvar</button>
          </form>
        `).join("<hr>")}
      </section>
      <section class="panel">
        <h2>Adicionar crianca</h2>
        <form class="new-child">
          <label class="field"><span>Nome</span><input name="name" required></label>
          <label class="field"><span>Mesada</span><input name="allowance" type="number" min="0" step="0.01" value="50"></label>
          <button class="primary" type="submit">Adicionar</button>
        </form>
      </section>
    </div>
  `;
  container.querySelectorAll(".child-settings").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const childId = form.dataset.id;
      try {
        await api(`/api/children/${childId}`, { method: "PUT", body: JSON.stringify({ allowance: data.get("allowance") }) });
        if (data.get("password")) {
          await api("/api/password", { method: "POST", body: JSON.stringify({ userId: childId, password: data.get("password") }) });
        }
        await loadApp();
      } catch (error) {
        alert(error.message);
      }
    });
  });
  container.querySelector(".new-child").addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      await api("/api/children", { method: "POST", body: JSON.stringify({ name: data.get("name"), allowance: data.get("allowance") }) });
      await loadApp();
    } catch (error) {
      alert(error.message);
    }
  });
}

async function approveIds(ids, status = "approved") {
  if (!ids.length) return;
  await api("/api/completions/approve", { method: "POST", body: JSON.stringify({ ids, status }) });
  await loadApp();
}

function approveAllPending() {
  const ids = state.data.completions.filter((item) => item.status === "pending").map((item) => item.id);
  approveIds(ids);
}

function approveSelected() {
  const ids = [...document.querySelectorAll("input[type='checkbox'][data-id]:checked")].map((item) => item.dataset.id);
  approveIds(ids);
}

async function logout() {
  await api("/api/logout", { method: "POST" });
  renderLogin();
}

function dayKey(dateString) {
  return weekdays[new Date(`${dateString}T12:00:00`).getDay()][0];
}

function isPastDue(task) {
  const now = new Date();
  const [hour, minute] = task.dueTime.split(":").map(Number);
  return now.getHours() * 60 + now.getMinutes() > hour * 60 + minute;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

init();
