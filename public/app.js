const app = document.querySelector("#app");
const weekdays = [
  ["sun", "Dom"],
  ["mon", "Seg"],
  ["tue", "Ter"],
  ["wed", "Qua"],
  ["thu", "Qui"],
  ["fri", "Sex"],
  ["sat", "Sáb"]
];
const iconMap = {
  poop: "\u{1F9F9}",
  food: "\u{1F963}",
  sparkles: "\u2728",
  dish: "\u{1F37D}\uFE0F",
  moon: "\u{1F319}",
  star: "\u2B50"
};
const iconLabels = {
  star: "Estrela",
  food: "Comida",
  sparkles: "Brilho",
  dish: "Louça",
  moon: "Noite",
  poop: "Limpeza"
};
let state = { view: "dashboard", data: null, me: null };

const points = (value) => `${Number(value || 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} pts`;
const rewardLabel = (reward) => Number(reward?.amount || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const isAdmin = () => state.me?.role === "admin";
const roleLabel = (role) => ({
  admin: "Admin",
  responsible: "Responsável",
  child: "Criança"
})[role] || role;
const today = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
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


function uiIcon(name) {
  const paths = {
    dashboard: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
    tasks: '<path d="m3 6 2 2 4-4M3 13l2 2 4-4M3 20l2 2 4-4M13 6h8M13 13h8M13 20h8"/>',
    family: '<circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M17 4a3 3 0 0 1 0 6M18 15a5 5 0 0 1 3 6"/>',
    analysis: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 11h18M8 15h2M14 15h2"/>',
    logout: '<path d="M9 3H4v18h5M14 7l5 5-5 5M8 12h12"/>'
  };
  return `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.dashboard}</svg>`;
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
            <p>Mesada clara, combinados visíveis e aprovação dos responsáveis no mesmo lugar.</p>
          </div>
        </div>
        <form class="login-form">
          <div>
            <div class="login-mark">✓</div><h2>Acesse o JaFiz</h2>
            <p class="page-title p">Selecione seu perfil para continuar. No primeiro acesso, crie sua senha.</p>
          </div>
          <div class="profile-options" role="group" aria-label="Selecione seu perfil"></div><label class="field login-user-select">
            <span>Usuário</span>
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
          <button class="primary" type="submit">Entrar no JaFiz →</button><p class="login-help">Esqueceu a senha? Solicite a redefinição ao administrador.</p>
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
  const profiles = view.querySelector('.profile-options');
  usersPayload.users.forEach((user) => {
    const button = el(`<button type="button" class="profile-option"><span class="avatar">${escapeHtml(user.name.slice(0,2).toUpperCase())}</span><span><strong>${escapeHtml(user.name)}</strong><small>${escapeHtml(roleLabel(user.role))}</small></span><span class="profile-radio" aria-hidden="true"></span></button>`);
    button.addEventListener('click', () => { select.value = user.name; syncPasswordMode(); });
    button.dataset.name = user.name;
    profiles.append(button);
  });
  const syncPasswordMode = () => {
    profiles.querySelectorAll('button').forEach(button => { const active=button.dataset.name === select.value; button.classList.toggle('selected',active); button.setAttribute('aria-pressed',String(active)); });
    const needs = select.selectedOptions[0]?.dataset.needsPassword === "true";
    view.querySelector(".first-password").hidden = !needs;
    view.querySelector(".password-field").hidden = needs;
    const current = view.querySelector("[name=password]");
    const next = view.querySelector("[name=nextPassword]");
    current.disabled = needs;
    current.required = !needs;
    next.disabled = !needs;
    next.required = needs;
    next.minLength = 4;
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
  return { pending: "Aguardando", approved: "Aprovada", rejected: "Não valeu" }[status] || "Aberta";
}

function renderProgressChart(child, title = "Evolução no mês") {
  const progressPoints = child.summary.progress || [];
  const allowance = Number(child.summary.totalPoints || 0);
  const width = 520;
  const height = 160;
  const pad = 18;
  const plotWidth = width - pad * 2;
  const plotHeight = height - pad * 2;
  const max = Math.max(allowance, ...progressPoints.map((point) => Number(point.remaining || 0)), 1);
  const coords = progressPoints.map((point, index) => {
    const x = pad + (progressPoints.length <= 1 ? 0 : (index / (progressPoints.length - 1)) * plotWidth);
    const y = pad + plotHeight - (Number(point.remaining || 0) / max) * plotHeight;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const latest = progressPoints.at(-1);
  return `
    <section class="progress-panel">
      <div class="panel-heading">
        <h2>${escapeHtml(title)}</h2>
        <span>${points(latest?.remaining ?? child.summary.pointsAvailable)}</span>
      </div>
      <svg class="progress-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(title)}">
        <line x1="${pad}" y1="${pad}" x2="${pad}" y2="${height - pad}"></line>
        <line x1="${pad}" y1="${height - pad}" x2="${width - pad}" y2="${height - pad}"></line>
        <polyline points="${coords.join(" ")}"></polyline>
        ${progressPoints.map((point, index) => {
          const [x, y] = coords[index]?.split(",") || [pad, height - pad];
          return `<circle cx="${x}" cy="${y}" r="3"><title>${point.date.split("-").reverse().join("/")} - ${points(point.remaining)}</title></circle>`;
        }).join("")}
      </svg>
      <div class="progress-legend">
        <span>Pontos perdidos: ${points(child.summary.pointsLost)}</span>
        <span>Penalidades de celular: ${points(child.summary.penaltyLost || 0)}</span>
      </div>
    </section>
  `;
}

function renderChild() {
  const child = state.data.children.find((item) => item.id === state.me.id);
  const tasks = state.data.tasks.filter((task) => {
    return task.childId === child.id && task.active && task.days.includes(dayKey(today()));
  });
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
          <p>Marque as tarefas antes do horário limite. Depois um responsável confere e aprova.</p>
        </div>
        <div class="score-grid">
          <div class="score"><span>Recompensa prevista</span><strong>${rewardLabel(summary.reward)}</strong></div>
          <div class="score"><span>Feitas</span><strong>${summary.approved}</strong></div>
          <div class="score"><span>Pendentes</span><strong>${summary.pending}</strong></div>
        </div>
      </section>
      <section class="child-balance"><span>Seu saldo no mês</span><strong>${points(summary.pointsAvailable ?? summary.totalPoints)} <small>/ ${points(summary.totalPoints)}</small></strong><div class="metric-progress"><i style="width:${Math.max(0,Math.min(100,summary.totalPoints ? Number(summary.pointsAvailable ?? summary.totalPoints)/summary.totalPoints*100 : 0))}%"></i></div><p>1 ponto = R$ 1,00 · Continue cuidando dos seus combinados!</p></section>
      <div class="child-section-title"><h2>Suas tarefas de hoje</h2><span>${tasks.length} atividades</span></div><section class="task-board"></section>
      <details class="child-evolution"><summary>Sua evolução no mês</summary>${renderProgressChart(child, "Sua evolução no mês")}</details>
      ${renderChildHistory(child)}
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
  const phoneTask = task.icon === "moon";
  const overdueMinutes = phoneTask ? 0 : minutesPastDue(task);
  const blockedLate = overdueMinutes > 120;
  const late = !phoneTask && overdueMinutes > 0;
  const completedLate = completion?.completedLate;
  const displayedStatus = completion
    ? completedLate && completion.status === "pending" ? "Feita com atraso" : statusText(completion.status)
    : phoneTask ? "Aguardando responsável" : blockedLate ? "Atrasada" : late ? "Atrasada" : "Aberta";
  const statusClass = completion ? `status-${completion.status}` : phoneTask ? "status-pending" : "";
  const cardState = completion?.status === "approved"
    ? "approved"
    : completion?.status === "rejected"
      ? "rejected"
      : completedLate || blockedLate || (late && !completion)
        ? "late"
        : "";
  const card = el(`
    <article class="task-card ${cardState} ${phoneTask && !completion ? "waiting" : ""}">
      <div>
        <div class="task-icon">${iconMap[task.icon] || iconMap.star}</div>
        <h3>${escapeHtml(task.title)}</h3>
        <div class="task-meta">
          <span class="pill">Até ${task.dueTime}</span>
          <span class="pill">${points(task.value)}</span>
          <span class="pill ${statusClass}">${displayedStatus}</span>
        </div>
      </div>
      <button class="primary" type="button" ${completion || blockedLate || phoneTask ? "disabled" : ""}>${phoneTask ? "Responsável avalia" : "Já fiz"}</button>
    </article>
  `);
  if (phoneTask) return card;
  card.querySelector("button").addEventListener("click", async () => {
    try {
      if (!late) card.classList.add("celebrate");
      await api("/api/tasks/complete", { method: "POST", body: JSON.stringify({ taskId: task.id, date: today() }) });
      setTimeout(() => loadApp(), late ? 0 : 520);
    } catch (error) {
      card.classList.remove("celebrate");
      alert(error.message);
    }
  });
  return card;
}

function renderChildHistory(child) {
  const rows = state.data.completions
    .filter((completion) => completion.childId === child.id)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date) || String(b.completedAt || "").localeCompare(String(a.completedAt || "")))
    .slice(0, 12);
  return `
    <section class="child-history">
      <div class="panel-heading">
        <h2>Histórico do mês</h2>
        <span>${rewardLabel(child.summary.reward)}</span>
      </div>
      ${rows.length ? rows.map((completion) => {
        const task = state.data.tasks.find((item) => item.id === completion.taskId);
        const penalty = Number(completion.penaltyAmount || 0);
        const value = Number(task?.value || 0);
        const detail = completion.status === "approved"
          ? `Ganhou ${points(value)}`
          : completion.status === "rejected"
            ? `Perdeu ${points(value + penalty)}`
            : completion.completedLate ? "Feita com atraso, aguardando aprovação" : "Aguardando aprovação";
        return `
          <div class="history-item">
            <div>
              <strong>${escapeHtml(task?.title || "Tarefa")}</strong>
              <span>${completion.date.split("-").reverse().join("/")}</span>
            </div>
            <span class="pill status-${completion.status}">${detail}</span>
          </div>
        `;
      }).join("") : `<div class="empty">Nenhum registro neste mês ainda.</div>`}
    </section>
  `;
}

function renderResponsible() {
  const child = state.data.children[0];
  const summary = child?.summary || {};
  app.innerHTML = "";
  const shell = el(`
    <main class="layout">
      <aside class="sidebar">
        <div class="brand">JaFiz</div>
        <button class="nav-button active" data-view="dashboard">${uiIcon("dashboard")}<span>Painel</span></button>
        <button class="nav-button" data-view="tasks">${uiIcon("tasks")}<span>Tarefas</span></button>
        <button class="nav-button" data-view="family">${uiIcon("family")}<span>Família</span></button><button class="nav-button" data-view="analysis">${uiIcon("analysis")}<span>Evolução</span></button>
        <div class="sidebar-user"><span class="avatar">${escapeHtml(state.me.name.slice(0,2).toUpperCase())}</span><div><strong>${escapeHtml(state.me.name)}</strong><small>${escapeHtml(roleLabel(state.me.role))}</small></div></div><button class="nav-button logout">${uiIcon("logout")}<span>Sair</span></button>
      </aside>
      <section class="main">
        <div class="topbar">
          <div class="page-title">
            <h1>Painel dos responsáveis</h1>
            <p>Hoje: ${new Date().toLocaleDateString("pt-BR")}</p>
          </div>
          <div class="row-actions">
            <button class="secondary approve-selected" type="button">Aprovar selecionadas</button>
            <button class="secondary approve-all" type="button">Aprovar pendentes</button>
          </div>
        </div>
        <div class="cards">
          <div class="metric"><span>Meta mensal de pontos</span><strong>${points(summary.pointsAvailable ?? summary.totalPoints)} <small>/ ${points(summary.totalPoints)}</small></strong><div class="metric-progress"><i style="width:${Math.max(0,Math.min(100,Number(summary.totalPoints) ? Number(summary.pointsAvailable ?? summary.totalPoints)/summary.totalPoints*100 : 0))}%"></i></div><p>Saldo disponível no mês</p></div>
          <div class="metric"><span>Recompensa prevista</span><strong>${rewardLabel(summary.reward)}</strong><p>Conversão: 1 ponto = R$ 1,00</p></div>
          <div class="metric"><span>Valor por atividade</span><strong>${rewardLabel({amount:summary.taskValue})}</strong><p>${points(summary.totalPoints)} ÷ ${summary.totalOccurrences || 0} atividades mensais</p></div>
          <div class="metric metric-pending"><span>Pendentes de validação</span><strong>${summary.pending || 0}</strong><p>${summary.pending ? "Aguardando sua aprovação" : "Tudo em dia"}</p></div>
        </div>
        <div class="content"></div>
      </section>
    </main>
  `);
  shell.querySelectorAll(".nav-button[data-view]").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === state.view);
    button.addEventListener("click", () => {
      state.view = button.dataset.view;
      shell.querySelectorAll(".nav-button[data-view]").forEach((item) => item.classList.toggle("active", item === button));
      renderResponsibleContent(shell.querySelector(".content"));
      window.scrollTo({top:0});
    });
  });
  shell.querySelector(".logout").addEventListener("click", logout);
  shell.querySelector(".approve-all").addEventListener("click", () => approveAllPending());
  shell.querySelector(".approve-selected").addEventListener("click", () => approveSelected());
  app.appendChild(shell);
  renderResponsibleContent(shell.querySelector(".content"));
}

function renderResponsibleContent(container) {
  const titles = {dashboard:['Painel dos responsáveis','Acompanhe os combinados e as aprovações da família.'],tasks:['Gestão de tarefas','Organize atividades, horários e dias da rotina.'],family:['Família e administração','Gerencie os perfis, as metas e os acessos.'],analysis:['Evolução e calendário','Acompanhe a constância e o histórico do mês.']};
  const title=titles[state.view] || titles.dashboard;
  const main=container.closest('.main');
  main.querySelector('h1').textContent=title[0];
  main.querySelector('.page-title p').textContent=title[1];
  main.querySelector('.topbar .row-actions').hidden=state.view !== 'dashboard';
  main.querySelector('.cards').hidden=['tasks','family'].includes(state.view);
  if(state.view === 'analysis') {state.dashboardTab='analysis'; return renderDashboardView(container);}
  if(state.view === 'dashboard' && state.dashboardTab === 'analysis') state.dashboardTab='daily';
  if (state.view === "tasks") return renderTasksView(container);
  if (state.view === "family") return renderFamilyView(container);
  return renderDashboardView(container);
}

function renderDashboardView(container) {
  container.innerHTML = `
    <div class="workspace">
      <div class="main-stack">
        ${renderPhoneRulePanel()}
        <section class="panel dashboard-filters">
          <div class="form-grid">
            <label class="field"><span>Criança</span><select name="filterChild">
              <option value="">Todas</option>
              ${state.data.children.map((child) => `<option value="${child.id}">${escapeHtml(child.name)}</option>`).join("")}
            </select></label>
            <label class="field"><span>Status</span><select name="filterStatus">
              <option value="">Todos</option>
              <option value="pending">Pendentes</option>
              <option value="approved">Aprovadas</option>
              <option value="rejected">Reprovadas</option>
              <option value="late">Feitas com atraso</option>
            </select></label>
          </div>
        </section>
        <section class="table-wrap">
          <table>
            <thead><tr><th></th><th>Criança</th><th>Tarefa</th><th>Dia</th><th>Status</th><th>Desconto</th><th>Ações</th></tr></thead>
            <tbody></tbody>
          </table>
        </section>
      </div>
      <div class="side-stack">
        <section class="panel">
          <h2>Resumo do mês</h2>
          ${state.data.children.map((child) => `
            <p><strong>${escapeHtml(child.name)}</strong></p>
            <details class="goal-settings"><summary>Editar meta mensal</summary><form class="monthly-goal-form" data-id="${child.id}">
              <label class="field"><span>Meta mensal de ${escapeHtml(child.name)} (pontos)</span><input name="monthlyPoints" type="number" min="0" step="0.01" required value="${child.settings.monthlyPoints ?? 0}"></label>
              <p>1 ponto = R$ 1,00. Cada repetição no calendário conta como uma atividade.</p>
              <p class="monthly-goal-preview" aria-live="polite"></p>
              <button class="secondary" type="submit">Salvar meta e recalcular</button>
              <p class="error" role="alert"></p>
            </form></details>
            <p>Atividades previstas no mês: ${child.summary.totalOccurrences}</p>
            <p>Valor por atividade: ${rewardLabel({ amount: child.summary.taskValue })} (${points(child.summary.taskValue)})</p>
            <p class="field-hint">Valores arredondados para exibição.</p>
            <p>Pontos perdidos: ${points(child.summary.pointsLost)}</p>
            <p>Recompensa: ${rewardLabel(child.summary.reward)}</p>
            ${renderRewardClosing(child)}
          `).join("")}
        </section>
        ${state.data.children.map((child) => renderProgressChart(child, `Evolução de ${child.name}`)).join("")}
        ${renderMonthCalendar()}
        ${renderTaskReport()}
        ${renderAuditLog()}
      </div>
    </div>
  `;
  const workspace = container.querySelector(".workspace");
  const main = workspace.querySelector(".main-stack");
  const side = workspace.querySelector(".side-stack");
  const blocks = [...side.children];
  const summary = blocks.shift();
  const audit = blocks.pop();
  const tabs = el(`<div class="dashboard-tabs" role="tablist" aria-label="Informações do painel">
    <button id="tab-daily" role="tab" aria-controls="panel-daily" data-tab="daily">Dia a dia</button>
    <button id="tab-analysis" role="tab" aria-controls="panel-analysis" data-tab="analysis">Evolução e calendário</button>
    <button id="tab-history" role="tab" aria-controls="panel-history" data-tab="history">Auditoria</button>
  </div>`);
  const daily = el('<section id="panel-daily" role="tabpanel" aria-labelledby="tab-daily" class="dashboard-daily"></section>');
  const analysis = el('<section id="panel-analysis" role="tabpanel" aria-labelledby="tab-analysis" class="dashboard-analysis"></section>');
  const history = el('<section id="panel-history" role="tabpanel" aria-labelledby="tab-history"></section>');
  summary.classList.add("monthly-summary");
  const heading=el('<div class="panel-heading approvals-heading"><div><h2>Aprovações do dia a dia</h2><p>Confira as atividades e valide os combinados.</p></div><span class="pill status-pending">'+state.data.completions.filter(item=>item.status==='pending').length+' pendentes</span></div>');
  main.insertBefore(heading, main.firstChild);
  daily.append(main, summary);
  analysis.append(...blocks);
  history.append(audit);
  container.replaceChildren(tabs, daily, analysis, history);
  const activateTab = (name) => {
    state.dashboardTab = name;
    [daily, analysis, history].forEach((panel) => { panel.hidden = panel.id !== `panel-${name}`; });
    tabs.querySelectorAll("[role=tab]").forEach((button) => {
      const active = button.dataset.tab === name;
      button.setAttribute("aria-selected", String(active));
      button.tabIndex = active ? 0 : -1;
    });
  };
  tabs.querySelectorAll("button").forEach((button, index, buttons) => {
    button.addEventListener("click", () => activateTab(button.dataset.tab));
    button.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length;
      activateTab(buttons[next].dataset.tab);
      buttons[next].focus();
    });
  });
  activateTab(["daily", "analysis", "history"].includes(state.dashboardTab) ? state.dashboardTab : "daily");
  container.querySelectorAll(".monthly-goal-form").forEach((form) => {
    const child = state.data.children.find((item) => item.id === form.dataset.id);
    const input = form.elements.monthlyPoints;
    const preview = () => {
      const target = Number(input.value);
      const count = child.summary.totalOccurrences;
      form.querySelector(".monthly-goal-preview").textContent = input.value !== "" && Number.isFinite(target) && target >= 0
        ? `${points(target)} ÷ ${count} atividades = ${rewardLabel({ amount: count ? target / count : 0 })} por atividade`
        : "Informe uma meta válida.";
    };
    input.addEventListener("input", preview);
    preview();
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = form.querySelector("button");
      button.disabled = true;
      try {
        await api(`/api/children/${form.dataset.id}`, { method: "PUT", body: JSON.stringify({ monthlyPoints: Number(input.value) }) });
        await loadApp();
      } catch (error) {
        form.querySelector(".error").textContent = error.message;
      } finally { button.disabled = false; }
    });
  });
  const tbody = container.querySelector("tbody");
  const renderRows = () => {
    const rows = filteredDashboardRows(container).sort((a, b) => String(b.completedAt || "").localeCompare(String(a.completedAt || "")));
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="7"><div class="empty">Nenhuma tarefa marcada ainda.</div></td></tr>`;
    } else {
      tbody.innerHTML = "";
      rows.forEach((completion) => tbody.appendChild(completionRow(completion)));
    }
  };
  container.querySelectorAll(".dashboard-filters select").forEach((select) => select.addEventListener("change", renderRows));
  renderRows();
  bindPhoneRulePanel(container);
  container.querySelectorAll(".reward-action").forEach((button) => button.addEventListener("click", async () => {
    try {
      await api(`/api/rewards/${button.dataset.closing}`, { method: "POST", body: JSON.stringify({ action: button.dataset.action }) });
      await loadApp();
    } catch (error) {
      alert(error.message);
    }
  }));
}

function renderRewardClosing(child) {
  const closing = child.summary.closed;
  if (!closing) return `<p class="task-meta">A recompensa será fechada no fim do mês.</p>`;
  const status = { pending_approval: "Aguardando aprovação", approved: "Pronta para entregar", delivered: "Entrega confirmada", cancelled: "Cancelada" }[closing.rewardStatus] || "Fechada";
  const actions = closing.rewardStatus === "pending_approval"
    ? `<button class="secondary reward-action" data-closing="${closing.id}" data-action="approve">Aprovar recompensa</button> <button class="danger reward-action" data-closing="${closing.id}" data-action="cancel">Cancelar</button>`
    : closing.rewardStatus === "approved"
      ? `<button class="primary reward-action" data-closing="${closing.id}" data-action="deliver">Confirmar entrega</button>`
      : "";
  return `<div class="reward-closing"><p><span class="pill">${status}: ${rewardLabel({ type: closing.rewardType, amount: closing.rewardAmount })}</span></p>${actions}</div>`;
}

function filteredDashboardRows(container) {
  const childId = container.querySelector("[name='filterChild']")?.value || "";
  const status = container.querySelector("[name='filterStatus']")?.value || "";
  return state.data.completions.filter((completion) => {
    if (childId && completion.childId !== childId) return false;
    if (status === "late") return completion.completedLate;
    if (status && completion.status !== status) return false;
    return true;
  });
}

function completionRow(completion) {
  const task = state.data.tasks.find((item) => item.id === completion.taskId);
  const child = state.data.children.find((item) => item.id === completion.childId);
  const penalty = Number(completion.penaltyAmount || 0);
  const row = el(`
    <tr>
      <td data-label="Selecionar"><input type="checkbox" data-id="${completion.id}" ${completion.status === "pending" ? "" : "disabled"}></td>
      <td data-label="Criança">${escapeHtml(child?.name || "-")}</td>
      <td data-label="Tarefa">${escapeHtml(task?.title || "-")}</td>
      <td data-label="Dia">${completion.date.split("-").reverse().join("/")}</td>
      <td data-label="Status"><span class="pill status-${completion.status}">${statusText(completion.status)}</span></td>
      <td data-label="Penalidade">${penalty ? `${points(penalty)}${completion.violationMinutes ? ` (${completion.violationMinutes} min)` : ""}` : "-"}</td>
      <td data-label="Ações" class="row-actions">
        <button class="secondary approve" ${completion.status !== "pending" ? "disabled" : ""}>Aprovar</button>
        <button class="danger reject" ${completion.status !== "pending" ? "disabled" : ""}>Rejeitar</button>
      </td>
    </tr>
  `);
  row.querySelector(".approve").addEventListener("click", () => approveIds([completion.id], "approved"));
  row.querySelector(".reject").addEventListener("click", () => approveIds([completion.id], "rejected"));
  return row;
}

function renderPhoneRulePanel() {
  return `
    <details class="panel phone-rule-disclosure">
      <summary>Registrar regra do celular</summary>
      <form class="phone-rule-form">
        <label class="field">
          <span>Criança</span>
          <select name="childId">${state.data.children.map((child) => `<option value="${child.id}">${escapeHtml(child.name)}</option>`).join("")}</select>
        </label>
        <div class="form-grid">
          <label class="field"><span>Dia</span><input name="date" type="date" value="${today()}"></label>
          <label class="field"><span>Usou até</span><input name="usedUntil" type="time" value="21:00"></label>
        </div>
        <label class="check-row">
          <input name="fulfilled" type="checkbox" checked>
          <span>Cumpriu a regra</span>
        </label>
        <p class="phone-preview"></p>
        <button class="primary" type="submit">Registrar regra</button>
      </form>
    </details>
  `;
}

function bindPhoneRulePanel(container) {
  const form = container.querySelector(".phone-rule-form");
  if (!form) return;
  const preview = form.querySelector(".phone-preview");
  const phoneTaskFor = () => state.data.tasks.find((task) => task.childId === form.childId.value && task.icon === "moon");
  const minutesBetweenTimes = (startTime, endTime) => {
    if (!startTime || !endTime) return 0;
    const [startHour, startMinute] = startTime.split(":").map(Number);
    const [endHour, endMinute] = endTime.split(":").map(Number);
    const start = startHour * 60 + startMinute;
    let end = endHour * 60 + endMinute;
    if (end < start) end += 24 * 60;
    return Math.max(0, end - start);
  };
  const sync = () => {
    const child = state.data.children.find((item) => item.id === form.childId.value);
    const phoneTask = phoneTaskFor();
    const allowedUntil = phoneTask?.dueTime || "21:00";
    const unit = Number(child?.settings?.pointsPenaltyPer10Minutes ?? child?.settings?.phonePenaltyPer10Minutes ?? 0);
    const minutes = minutesBetweenTimes(allowedUntil, form.usedUntil.value);
    const penalty = form.fulfilled.checked ? 0 : Math.ceil(minutes / 10) * unit;
    form.usedUntil.disabled = form.fulfilled.checked;
    preview.textContent = form.fulfilled.checked
      ? "Sem desconto extra."
      : `Permitido até ${allowedUntil}. Excedeu ${minutes} min. Penalidade: ${points(penalty)} (${points(unit)} a cada 10 min).`;
  };
  form.addEventListener("input", sync);
  sync();
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    try {
      await api("/api/phone-rule/report", {
        method: "POST",
        body: JSON.stringify({
          childId: data.get("childId"),
          date: data.get("date"),
          fulfilled: data.get("fulfilled") === "on",
          usedUntil: data.get("usedUntil")
        })
      });
      await loadApp();
    } catch (error) {
      alert(error.message);
    }
  });
}

function renderMonthCalendar() {
  const [year, month] = state.data.month.split("-").map(Number);
  const totalDays = new Date(year, month, 0).getDate();
  const cells = Array.from({ length: totalDays }, (_, index) => {
    const date = `${state.data.month}-${String(index + 1).padStart(2, "0")}`;
    const dayTasks = state.data.tasks.filter((task) => task.active && task.days.includes(dayKey(date)));
    const completions = state.data.completions.filter((completion) => completion.date === date);
    const approved = completions.filter((completion) => completion.status === "approved").length;
    const pending = completions.filter((completion) => completion.status === "pending").length;
    const rejected = completions.filter((completion) => completion.status === "rejected").length;
    const late = completions.filter((completion) => completion.completedLate).length;
    const doneIds = new Set(completions.map((completion) => completion.taskId));
    const open = dayTasks.filter((task) => !doneIds.has(task.id) && !isPhoneTask(task)).length;
    const status = rejected ? "rejected" : pending ? "pending" : late ? "late" : approved && !open ? "approved" : open && date < today() ? "late" : "";
    return `
      <div class="calendar-day ${status}">
        <strong>${index + 1}</strong>
        <span>${approved} ok</span>
        <span>${pending} pend.</span>
      </div>
    `;
  }).join("");
  return `
    <section class="panel">
      <h2>Calendário do mês</h2>
      <div class="calendar-grid">${cells}</div>
    </section>
  `;
}

function renderTaskReport() {
  const rows = state.data.tasks.filter((task) => task.active).map((task) => {
    const completions = state.data.completions.filter((completion) => completion.taskId === task.id);
    return {
      task,
      approved: completions.filter((completion) => completion.status === "approved").length,
      pending: completions.filter((completion) => completion.status === "pending").length,
      rejected: completions.filter((completion) => completion.status === "rejected").length,
      late: completions.filter((completion) => completion.completedLate).length
    };
  }).sort((a, b) => (b.rejected + b.pending + b.late) - (a.rejected + a.pending + a.late));
  return `
    <section class="panel">
      <h2>Relatório por tarefa</h2>
      <div class="report-list">
        ${rows.map((row) => `
          <div class="report-item">
            <strong>${escapeHtml(row.task.title)}</strong>
            <div class="task-meta">
              <span class="pill status-approved">${row.approved} aprov.</span>
              <span class="pill status-pending">${row.pending} pend.</span>
              <span class="pill status-rejected">${row.rejected} repro.</span>
              <span class="pill">${row.late} atraso</span>
            </div>
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function renderAuditLog() {
  const actions = {
    task_created: "Tarefa criada",
    task_updated: "Tarefa editada",
    child_created: "Criança adicionada",
    child_settings_updated: "Regras financeiras editadas",
    password_changed: "Senha alterada",
    password_reset: "Senha redefinida para o próximo acesso",
    completion_approved: "Tarefa aprovada",
    completion_rejected: "Tarefa reprovada",
    phone_rule_approved: "Celular aprovado",
    phone_rule_rejected: "Celular reprovado"
  };
  const rows = state.data.auditLog || [];
  return `
    <section class="panel">
      <h2>Auditoria recente</h2>
      ${rows.length ? rows.slice(0, 8).map((item) => {
        const actor = [...(state.data.users || []), ...state.data.children].find((user) => user.id === item.actorId) || state.data.user;
        return `
          <div class="audit-item">
            <strong>${actions[item.action] || item.action}</strong>
            <span>${escapeHtml(actor?.name || "Responsável")} - ${new Date(item.createdAt).toLocaleString("pt-BR")}</span>
          </div>
        `;
      }).join("") : `<div class="empty">Nenhuma alteração registrada ainda.</div>`}
    </section>
  `;
}

function renderTasksView(container) {
  container.innerHTML = `
    <div class="workspace tasks-workspace">
      <section class="table-wrap">
        <table>
          <thead><tr><th>Tarefa</th><th>Criança</th><th>Dias</th><th>Limite</th><th>Valor</th><th>Ativa</th><th>Ações</th></tr></thead>
          <tbody></tbody>
        </table>
      </section>
      <section class="panel task-editor">
        <h2 class="task-form-title">Nova tarefa</h2>
        <p class="task-form-intro">Defina a atividade, o horário e os dias da rotina.</p>
        <form class="task-form">
          <input name="taskId" type="hidden">
          <label class="field full"><span>Criança</span><select name="childId">${state.data.children.map((item) => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join("")}</select></label>
          <label class="field full"><span>Título</span><input name="title" required placeholder="Ex: Guardar mochila"></label>
          <div class="form-grid">
            <label class="field"><span>Horário limite</span><input name="dueTime" type="time" value="21:00" required></label>
            <label class="field"><span>Ícone</span><select name="icon">${Object.entries(iconLabels).map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}</select></label>
          </div>
          <fieldset class="confirmation-options">
            <legend>Quem confirma a atividade?</legend>
            <label class="confirmation-option"><input type="radio" name="requiresChildConfirmation" value="true" checked><span>Criança marca e responsável aprova</span></label>
            <label class="confirmation-option"><input type="radio" name="requiresChildConfirmation" value="false"><span>Responsável informa</span></label>
          </fieldset>
          <fieldset class="task-days">
            <legend>Dias da atividade</legend>
            <p class="field-hint">Selecione os dias em que a tarefa deve acontecer.</p>
            <div class="row-actions day-presets">
              <button class="ghost preset-weekdays" type="button">Dias úteis</button>
              <button class="ghost preset-all" type="button">Todos os dias</button>
              <button class="ghost preset-clear" type="button">Limpar</button>
            </div>
            <div class="days-grid">${weekdays.map(([key, label]) => `<button class="day-toggle" type="button" data-day="${key}">${label}</button>`).join("")}</div>
          </fieldset>
          <label class="field full task-active" hidden>
            <span>Status</span>
            <select name="active">
              <option value="true">Ativa</option>
              <option value="false">Inativa</option>
            </select>
          </label>
          <div class="row-actions task-form-actions">
            <button class="primary task-submit" type="submit">Criar tarefa</button>
            <button class="ghost task-cancel" type="button" hidden>Cancelar edição</button>
          </div>
        </form>
      </section>
    </div>
  `;
  const tbody = container.querySelector("tbody");
  const form = container.querySelector(".task-form");
  const selectedDays = new Set(["mon", "tue", "wed", "thu", "fri"]);
  const syncDayButtons = () => form.querySelectorAll(".day-toggle").forEach((button) => {
    button.classList.toggle("active", selectedDays.has(button.dataset.day));
    button.setAttribute("aria-pressed", String(selectedDays.has(button.dataset.day)));
  });
  const setSelectedDays = (days) => {
    selectedDays.clear();
    days.forEach((day) => selectedDays.add(day));
    syncDayButtons();
  };
  const resetTaskForm = () => {
    form.reset();
    form.taskId.value = "";
    form.childId.disabled = false;
    form.active.value = "true";

    form.requiresChildConfirmation.value = "true";
    setSelectedDays(["mon", "tue", "wed", "thu", "fri"]);
    container.querySelector(".task-form-title").textContent = "Nova tarefa";
    container.querySelector(".task-submit").textContent = "Criar tarefa";
    container.querySelector(".task-cancel").hidden = true;
    container.querySelector(".task-active").hidden = true;
  };

  state.data.tasks.forEach((task) => {
    const owner = state.data.children.find((item) => item.id === task.childId);
    const row = el(`
      <tr>
        <td data-label="Tarefa"><span class="table-task-icon">${iconMap[task.icon] || iconMap.star}</span><strong>${escapeHtml(task.title)}</strong></td>
        <td data-label="Criança">${escapeHtml(owner?.name || "-")}</td>
        <td data-label="Dias">${task.days.map((day) => weekdays.find(([key]) => key === day)?.[1]).join(", ")}</td>
        <td data-label="Limite">${task.dueTime}</td>
        <td data-label="Pontos">${points(task.value)}</td>
        <td data-label="Ativa"><span class="pill">${task.active ? "Sim" : "Não"}</span></td>
        <td data-label="Ações"><button class="secondary edit-task" type="button">Editar</button></td>
      </tr>
    `);
    row.querySelector(".edit-task").addEventListener("click", () => {
      form.taskId.value = task.id;
      form.childId.value = task.childId;
      form.childId.disabled = true;
      form.title.value = task.title;
      form.dueTime.value = task.dueTime;
      form.icon.value = task.icon || "star";
      form.active.value = String(task.active);

      form.requiresChildConfirmation.value = String(task.requiresChildConfirmation !== false);
      setSelectedDays(task.days);
      container.querySelector(".task-form-title").textContent = "Editar tarefa";
      container.querySelector(".task-submit").textContent = "Salvar alterações";
      container.querySelector(".task-cancel").hidden = false;
      container.querySelector(".task-active").hidden = false;
      form.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    tbody.appendChild(row);
  });

  form.querySelectorAll(".day-toggle").forEach((button) => {
    button.addEventListener("click", () => {
      if (selectedDays.has(button.dataset.day)) selectedDays.delete(button.dataset.day);
      else selectedDays.add(button.dataset.day);
      syncDayButtons();
    });
  });
  form.querySelector(".preset-weekdays").addEventListener("click", () => setSelectedDays(["mon", "tue", "wed", "thu", "fri"]));
  form.querySelector(".preset-all").addEventListener("click", () => setSelectedDays(weekdays.map(([day]) => day)));
  form.querySelector(".preset-clear").addEventListener("click", () => setSelectedDays([]));
  form.querySelector(".task-cancel").addEventListener("click", resetTaskForm);
  resetTaskForm();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const taskId = form.taskId.value;
    const payload = {
      title: data.get("title"),
      dueTime: data.get("dueTime"),
      icon: data.get("icon"),
      weight: 1,
      requiresChildConfirmation: data.get("requiresChildConfirmation") === "true",
      days: [...selectedDays]
    };
    if (taskId) payload.active = data.get("active") === "true";
    else payload.childId = form.childId.value;

    try {
      await api(taskId ? `/api/tasks/${taskId}` : "/api/tasks", {
        method: taskId ? "PUT" : "POST",
        body: JSON.stringify(payload)
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
        <h2>Crianças</h2>
        <p>Conversão fixa: 1 ponto = R$ 1,00. A meta mensal de pontos define o valor máximo em reais.</p>
        ${state.data.children.map((child) => `
          <form class="child-settings" data-id="${child.id}">
            <p><strong>${escapeHtml(child.name)}</strong></p>
            <div class="form-grid">
          <label class="field"><span>Meta mensal de pontos</span><input name="monthlyPoints" type="number" min="0" step="0.01" value="${child.settings.monthlyPoints || 0}"></label>
          <label class="field"><span>Penalidade celular / 10 min</span><input name="pointsPenaltyPer10Minutes" type="number" min="0" step="1" value="${child.settings.pointsPenaltyPer10Minutes || 0}"></label>
              <label class="field"><span>Nova senha</span><input name="password" type="password" placeholder="Opcional"></label>
            </div>
            <button class="secondary" type="submit">Salvar</button>
          </form>
        `).join("<hr>")}
      </section>
      <section class="panel">
        <h2>Adicionar criança</h2>
        <form class="new-child">
          <p>Recompensa em reais: 1 ponto = R$ 1,00.</p>
          <label class="field"><span>Nome</span><input name="name" required></label>
          <label class="field"><span>Meta mensal de pontos</span><input name="monthlyPoints" type="number" min="0" step="0.01" value="1000"></label>
          <label class="field"><span>Penalidade celular / 10 min</span><input name="pointsPenaltyPer10Minutes" type="number" min="0" step="1" value="10"></label>
          <button class="primary" type="submit">Adicionar</button>
        </form>
      </section>
      ${renderAdminUsersPanel()}
    </div>
  `;
  container.querySelectorAll(".child-settings").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const childId = form.dataset.id;
      try {
        await api(`/api/children/${childId}`, {
          method: "PUT",
          body: JSON.stringify({
            monthlyPoints: data.get("monthlyPoints"),
            robloxUsername: data.get("robloxUsername"), pointsPenaltyPer10Minutes: data.get("pointsPenaltyPer10Minutes")
          })
        });
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
      await api("/api/children", {
        method: "POST",
        body: JSON.stringify({
          name: data.get("name"),
          monthlyPoints: data.get("monthlyPoints"),
          pointsPenaltyPer10Minutes: data.get("pointsPenaltyPer10Minutes")
        })
      });
      await loadApp();
    } catch (error) {
      alert(error.message);
    }
  });
  container.querySelectorAll(".user-password-reset").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const reset = event.submitter?.value === "reset";
      if (reset && !confirm("Redefinir a senha? As sessões serão encerradas e o usuário criará uma nova senha no próximo acesso.")) return;
      const data = new FormData(form);
      try {
        await api("/api/password", {
          method: "POST",
          body: JSON.stringify({ userId: form.dataset.id, password: data.get("password"), reset })
        });
        form.reset();
        alert(reset ? "Senha redefinida. O usuário criará uma nova senha no próximo acesso." : "Senha alterada com sucesso.");
        if (form.dataset.id === state.me.id) {
          await renderLogin();
          return;
        }
        await loadApp();
      } catch (error) {
        alert(error.message);
      }
    });
  });
}

function renderAdminUsersPanel() {
  if (!isAdmin()) return "";
  const users = state.data.users || [];
  return `
    <section class="panel">
      <h2>Administração de usuários</h2>
      <p>Altere a senha ou permita que o usuário crie uma nova no próximo acesso. Ambas as ações encerram as sessões do usuário.</p>
      ${users.map((user) => `
        <form class="user-password-reset" data-id="${user.id}">
          <p><strong>${escapeHtml(user.name)}</strong> <span class="pill">${escapeHtml(roleLabel(user.role))}</span> — ${user.needsPassword ? "Aguardando criação de senha" : "Senha cadastrada"}</p>
          <div class="form-grid">
            <label class="field"><span>Nova senha</span><input name="password" type="password" minlength="4" required autocomplete="new-password" placeholder="Mínimo 4 caracteres"></label>
          </div>
          <button class="secondary" type="submit" value="change">Alterar senha</button>
          <button class="secondary" type="submit" value="reset" formnovalidate>Redefinir para o próximo acesso</button>
        </form>
      `).join("<hr>")}
    </section>
  `;
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

function isPhoneTask(task) {
  return task?.icon === "moon" || String(task?.title || "").toLowerCase().includes("celular");
}

function minutesPastDue(task) {
  const now = new Date();
  const [hour, minute] = task.dueTime.split(":").map(Number);
  return Math.max(0, now.getHours() * 60 + now.getMinutes() - (hour * 60 + minute));
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
