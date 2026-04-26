const STORAGE_KEY = "fincaPlanner.v1";
const THEME_KEY = "fincaPlanner.theme";
const STANDARD_DAY_HOURS = 8;

const state = {
  workEntries: [],
  tasks: [],
  currentView: "dashboard",
  calendarDate: new Date(),
  theme: {
    name: "finca",
    mode: "light"
  }
};

let charts = {};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(dateString) {
  if (!dateString) return "";
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${dateString}T00:00:00`));
}

function formatMonth(date) {
  return new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(date);
}

function roundHours(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function minutesFromTime(time) {
  if (!time) return null;
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function calculateWorkHours(entry) {
  if (entry.dayType !== "trabajado") return 0;
  const start = minutesFromTime(entry.startTime);
  const end = minutesFromTime(entry.endTime);
  if (start === null || end === null || end <= start) return 0;
  const breakMinutes = Number(entry.breakMinutes) || 0;
  return roundHours(Math.max(0, end - start - breakMinutes) / 60);
}

function calculateExtraHours(entry) {
  return roundHours(Math.max(0, calculateWorkHours(entry) - (Number(entry.expectedHours) || STANDARD_DAY_HOURS)));
}

function getWeekRange(date = new Date()) {
  const current = new Date(date);
  const day = current.getDay() || 7;
  const monday = new Date(current);
  monday.setDate(current.getDate() - day + 1);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { monday, sunday };
}

function isDateInRange(dateString, start, end) {
  const date = new Date(`${dateString}T12:00:00`);
  return date >= start && date <= end;
}

function isSameMonth(dateString, date = new Date()) {
  const value = new Date(`${dateString}T12:00:00`);
  return value.getMonth() === date.getMonth() && value.getFullYear() === date.getFullYear();
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    workEntries: state.workEntries,
    tasks: state.tasks
  }));
}

function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    state.workEntries = Array.isArray(data.workEntries) ? data.workEntries : [];
    state.tasks = Array.isArray(data.tasks) ? data.tasks : [];
  } catch {
    state.workEntries = [];
    state.tasks = [];
  }
}

function loadTheme() {
  const raw = localStorage.getItem(THEME_KEY);
  if (!raw) return;
  try {
    const theme = JSON.parse(raw);
    state.theme.name = theme.name || "finca";
    state.theme.mode = theme.mode || "light";
  } catch {
    state.theme.name = "finca";
    state.theme.mode = "light";
  }
}

function saveTheme() {
  localStorage.setItem(THEME_KEY, JSON.stringify(state.theme));
}

function applyTheme() {
  document.body.dataset.theme = state.theme.name;
  document.body.dataset.mode = state.theme.mode;
  $("#themeSelect").value = state.theme.name;
  $("#modeToggleBtn").textContent = state.theme.mode === "dark" ? "Modo claro" : "Modo oscuro";
  saveTheme();
  renderStats();
}

function setDefaultDates() {
  $("#workDate").value = todayISO();
  $("#taskDate").value = todayISO();
}

function render() {
  renderDashboard();
  renderWorkTable();
  renderTasks();
  renderCalendar();
  renderHistory();
  renderStats();
  saveData();
}

function cssVar(name) {
  return getComputedStyle(document.body).getPropertyValue(name).trim();
}

function switchView(view) {
  state.currentView = view;
  $$(".view").forEach((el) => el.classList.toggle("active", el.id === view));
  $$(".nav-link").forEach((btn) => btn.classList.toggle("active", btn.dataset.view === view));
  $("#viewTitle").textContent = {
    dashboard: "Inicio",
    jornada: "Registro de jornada",
    tareas: "Gestion de tareas",
    calendario: "Calendario",
    estadisticas: "Graficos",
    historial: "Historial"
  }[view];
  renderStats();
}

function renderDashboard() {
  const now = new Date();
  const { monday, sunday } = getWeekRange(now);
  const monthEntries = state.workEntries.filter((entry) => isSameMonth(entry.date, now));
  const weekEntries = state.workEntries.filter((entry) => isDateInRange(entry.date, monday, sunday));
  const workedDays = monthEntries.filter((entry) => calculateWorkHours(entry) > 0).length;
  const monthHours = monthEntries.reduce((sum, entry) => sum + calculateWorkHours(entry), 0);
  const weekHours = weekEntries.reduce((sum, entry) => sum + calculateWorkHours(entry), 0);
  const pendingTasks = state.tasks.filter((task) => task.status !== "terminada").length;

  $("#monthHours").textContent = `${roundHours(monthHours)} h`;
  $("#weekHours").textContent = `${roundHours(weekHours)} h`;
  $("#pendingTasks").textContent = pendingTasks;
  $("#averageHours").textContent = `${workedDays ? roundHours(monthHours / workedDays) : 0} h`;

  const todayEntries = state.workEntries.filter((entry) => entry.date === todayISO());
  const todayTasks = state.tasks.filter((task) => task.date === todayISO());
  $("#todaySummary").innerHTML = [
    ...todayEntries.map((entry) => `<div class="summary-item"><strong>${entry.dayType}</strong><p>${calculateWorkHours(entry)} h trabajadas · Extra ${calculateExtraHours(entry)} h</p></div>`),
    ...todayTasks.map((task) => `<div class="summary-item"><strong>${task.name}</strong><p>${task.time || "Sin hora"} · ${labelStatus(task.status)} · ${task.priority}</p></div>`)
  ].join("") || emptyState("Aun no hay registros para hoy.");

  const upcoming = state.tasks
    .filter((task) => task.status !== "terminada")
    .sort((a, b) => `${a.date} ${a.time || ""}`.localeCompare(`${b.date} ${b.time || ""}`))
    .slice(0, 5);
  $("#upcomingTasks").innerHTML = upcoming.map(taskCardHtml).join("") || emptyState("No hay tareas pendientes.");

  drawMonthChart();
}

function renderWorkTable() {
  const rows = [...state.workEntries]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((entry) => `
      <tr>
        <td>${formatDate(entry.date)}</td>
        <td><span class="badge">${entry.dayType}</span></td>
        <td>${entry.startTime || "-"} - ${entry.endTime || "-"}</td>
        <td>${calculateWorkHours(entry)} h</td>
        <td>${calculateExtraHours(entry)} h</td>
        <td>
          <button class="small-button" data-edit-work="${entry.id}" type="button">Editar</button>
          <button class="small-button" data-delete-work="${entry.id}" type="button">Borrar</button>
        </td>
      </tr>
    `);
  $("#workTable").innerHTML = rows.join("") || `<tr><td colspan="6">${emptyState("No hay jornadas registradas.")}</td></tr>`;
}

function renderTasks() {
  const filter = $("#taskFilter").value;
  const tasks = state.tasks
    .filter((task) => filter === "todas" || task.status === filter)
    .sort((a, b) => `${a.date} ${a.time || ""}`.localeCompare(`${b.date} ${b.time || ""}`));
  $("#taskList").innerHTML = tasks.map(taskCardHtml).join("") || emptyState("No hay tareas con este filtro.");
}

function taskCardHtml(task) {
  const priorityClass = task.priority === "alta" ? "high" : "";
  const doneClass = task.status === "terminada" ? "done" : "";
  return `
    <article class="task-card">
      <div>
        <h3>${escapeHtml(task.name)}</h3>
        <div class="meta">
          <span>${formatDate(task.date)}</span>
          <span>${task.time || "Sin hora"}</span>
          <span>${task.duration || 0} h</span>
          <span class="badge ${doneClass}">${labelStatus(task.status)}</span>
          <span class="badge ${priorityClass}">${task.priority}</span>
        </div>
        ${task.notes ? `<p class="muted">${escapeHtml(task.notes)}</p>` : ""}
      </div>
      <div class="card-actions">
        <button class="small-button" data-edit-task="${task.id}" type="button">Editar</button>
        <button class="small-button" data-delete-task="${task.id}" type="button">Borrar</button>
      </div>
    </article>
  `;
}

function labelStatus(status) {
  return {
    pendiente: "Pendiente",
    "en-proceso": "En proceso",
    terminada: "Terminada"
  }[status] || status;
}

function renderCalendar() {
  const year = state.calendarDate.getFullYear();
  const month = state.calendarDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const leadingEmpty = (firstDay.getDay() + 6) % 7;
  const cells = [];

  $("#calendarTitle").textContent = formatMonth(state.calendarDate);

  for (let i = 0; i < leadingEmpty; i += 1) {
    cells.push(`<div class="calendar-day empty"></div>`);
  }

  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const work = state.workEntries.filter((entry) => entry.date === iso);
    const tasks = state.tasks.filter((task) => task.date === iso);
    const isToday = iso === todayISO();
    const events = [
      ...work.map((entry) => `<span class="calendar-event">${entry.dayType}: ${calculateWorkHours(entry)} h</span>`),
      ...tasks.map((task) => `<span class="calendar-event task">${escapeHtml(task.name)}</span>`)
    ].join("");
    cells.push(`
      <div class="calendar-day ${isToday ? "today" : ""}">
        <span class="day-number">${day}</span>
        ${events}
      </div>
    `);
  }

  $("#calendarGrid").innerHTML = cells.join("");
}

function renderHistory() {
  const items = [
    ...state.workEntries.map((entry) => ({
      date: entry.date,
      html: `<div class="history-item"><strong>Jornada · ${formatDate(entry.date)}</strong><p>${entry.dayType} · ${calculateWorkHours(entry)} h · ${escapeHtml(entry.notes || "Sin observaciones")}</p></div>`
    })),
    ...state.tasks.map((task) => ({
      date: task.date,
      html: `<div class="history-item"><strong>Tarea · ${escapeHtml(task.name)}</strong><p>${formatDate(task.date)} · ${labelStatus(task.status)} · ${escapeHtml(task.notes || "Sin observaciones")}</p></div>`
    }))
  ].sort((a, b) => b.date.localeCompare(a.date));

  $("#historyList").innerHTML = items.map((item) => item.html).join("") || emptyState("El historial esta vacio.");
}

function renderStats() {
  if (state.currentView !== "estadisticas" && state.currentView !== "dashboard") return;
  drawDailyChart();
  drawTaskHoursChart();
  drawDayTypeChart();
  renderTopTasks();
}

function drawChart(id, config) {
  const canvas = $(`#${id}`);
  if (!canvas || typeof Chart === "undefined") return;
  if (charts[id]) charts[id].destroy();
  charts[id] = new Chart(canvas, config);
}

function drawMonthChart() {
  const now = new Date();
  const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const labels = Array.from({ length: days }, (_, index) => String(index + 1));
  const data = labels.map((day) => {
    const iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${day.padStart(2, "0")}`;
    return state.workEntries.filter((entry) => entry.date === iso).reduce((sum, entry) => sum + calculateWorkHours(entry), 0);
  });

  drawChart("monthChart", {
    type: "bar",
    data: { labels, datasets: [{ label: "Horas", data, backgroundColor: cssVar("--chart-a") }] },
    options: chartOptions()
  });
}

function drawDailyChart() {
  const entries = [...state.workEntries].sort((a, b) => a.date.localeCompare(b.date)).slice(-14);
  drawChart("dailyChart", {
    type: "line",
    data: {
      labels: entries.map((entry) => formatDate(entry.date)),
      datasets: [{ label: "Horas", data: entries.map(calculateWorkHours), borderColor: cssVar("--chart-a"), backgroundColor: colorWithAlpha("--chart-a", 0.16), tension: 0.25, fill: true }]
    },
    options: chartOptions()
  });
}

function drawTaskHoursChart() {
  const grouped = groupBy(state.tasks, "name", (task) => Number(task.duration) || 0);
  drawChart("taskHoursChart", {
    type: "doughnut",
    data: {
      labels: Object.keys(grouped),
      datasets: [{ data: Object.values(grouped), backgroundColor: chartPalette() }]
    },
    options: chartOptions(false)
  });
}

function drawDayTypeChart() {
  const grouped = groupBy(state.workEntries, "dayType", () => 1);
  drawChart("dayTypeChart", {
    type: "pie",
    data: {
      labels: Object.keys(grouped),
      datasets: [{ data: Object.values(grouped), backgroundColor: chartPalette() }]
    },
    options: chartOptions(false)
  });
}

function renderTopTasks() {
  const grouped = groupBy(state.tasks, "name", () => 1);
  const rows = Object.entries(grouped)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, count]) => `<div class="rank-item"><strong>${escapeHtml(name)}</strong><p>${count} veces</p></div>`);
  $("#topTasks").innerHTML = rows.join("") || emptyState("Todavia no hay tareas registradas.");
}

function groupBy(items, key, valueGetter) {
  return items.reduce((acc, item) => {
    const name = item[key] || "Sin categoria";
    acc[name] = (acc[name] || 0) + valueGetter(item);
    return acc;
  }, {});
}

function chartOptions(showLegend = true) {
  return {
    responsive: true,
    plugins: {
      legend: {
        display: showLegend,
        labels: { color: cssVar("--muted") }
      }
    },
    scales: showLegend ? {
      x: { ticks: { color: cssVar("--muted") }, grid: { color: colorWithAlpha("--line", 0.7) } },
      y: { beginAtZero: true, ticks: { color: cssVar("--muted") }, grid: { color: colorWithAlpha("--line", 0.7) } }
    } : undefined
  };
}

function chartPalette() {
  return ["--chart-a", "--chart-b", "--chart-c", "--chart-d", "--primary", "--accent"].map(cssVar);
}

function colorWithAlpha(variableName, alpha) {
  const color = cssVar(variableName);
  if (color.startsWith("#") && color.length === 7) {
    const red = parseInt(color.slice(1, 3), 16);
    const green = parseInt(color.slice(3, 5), 16);
    const blue = parseInt(color.slice(5, 7), 16);
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  }
  return color;
}

function saveWork(event) {
  event.preventDefault();
  const id = $("#workId").value || uid();
  const entry = {
    id,
    date: $("#workDate").value,
    dayType: $("#workDayType").value,
    startTime: $("#workStart").value,
    endTime: $("#workEnd").value,
    breakMinutes: Number($("#workBreaks").value) || 0,
    expectedHours: Number($("#expectedHours").value) || STANDARD_DAY_HOURS,
    notes: $("#workNotes").value.trim(),
    updatedAt: new Date().toISOString()
  };

  state.workEntries = state.workEntries.filter((item) => item.id !== id);
  state.workEntries.push(entry);
  resetWorkForm();
  render();
}

function saveTask(event) {
  event.preventDefault();
  const id = $("#taskId").value || uid();
  const task = {
    id,
    name: $("#taskName").value.trim(),
    date: $("#taskDate").value,
    time: $("#taskTime").value,
    duration: Number($("#taskDuration").value) || 0,
    status: $("#taskStatus").value,
    priority: $("#taskPriority").value,
    notes: $("#taskNotes").value.trim(),
    updatedAt: new Date().toISOString()
  };

  state.tasks = state.tasks.filter((item) => item.id !== id);
  state.tasks.push(task);
  resetTaskForm();
  render();
}

function resetWorkForm() {
  $("#workForm").reset();
  $("#workId").value = "";
  $("#workBreaks").value = 0;
  $("#expectedHours").value = STANDARD_DAY_HOURS;
  $("#workDate").value = todayISO();
}

function resetTaskForm() {
  $("#taskForm").reset();
  $("#taskId").value = "";
  $("#taskDuration").value = 1;
  $("#taskDate").value = todayISO();
}

function editWork(id) {
  const entry = state.workEntries.find((item) => item.id === id);
  if (!entry) return;
  switchView("jornada");
  $("#workId").value = entry.id;
  $("#workDate").value = entry.date;
  $("#workDayType").value = entry.dayType;
  $("#workStart").value = entry.startTime;
  $("#workEnd").value = entry.endTime;
  $("#workBreaks").value = entry.breakMinutes;
  $("#expectedHours").value = entry.expectedHours;
  $("#workNotes").value = entry.notes;
}

function editTask(id) {
  const task = state.tasks.find((item) => item.id === id);
  if (!task) return;
  switchView("tareas");
  $("#taskId").value = task.id;
  $("#taskName").value = task.name;
  $("#taskDate").value = task.date;
  $("#taskTime").value = task.time;
  $("#taskDuration").value = task.duration;
  $("#taskStatus").value = task.status;
  $("#taskPriority").value = task.priority;
  $("#taskNotes").value = task.notes;
}

function deleteWork(id) {
  if (!confirm("Quieres borrar esta jornada?")) return;
  state.workEntries = state.workEntries.filter((item) => item.id !== id);
  render();
}

function deleteTask(id) {
  if (!confirm("Quieres borrar esta tarea?")) return;
  state.tasks = state.tasks.filter((item) => item.id !== id);
  render();
}

function seedDemoData() {
  const today = new Date();
  const isoForOffset = (offset) => {
    const date = new Date(today);
    date.setDate(today.getDate() + offset);
    return date.toISOString().slice(0, 10);
  };

  state.workEntries = [
    { id: uid(), date: isoForOffset(-4), dayType: "trabajado", startTime: "08:00", endTime: "16:30", breakMinutes: 30, expectedHours: 8, notes: "Limpieza y alimentacion" },
    { id: uid(), date: isoForOffset(-3), dayType: "trabajado", startTime: "08:15", endTime: "17:00", breakMinutes: 45, expectedHours: 8, notes: "Poda y mantenimiento" },
    { id: uid(), date: isoForOffset(-2), dayType: "libre", startTime: "", endTime: "", breakMinutes: 0, expectedHours: 8, notes: "Descanso" },
    { id: uid(), date: isoForOffset(-1), dayType: "trabajado", startTime: "07:45", endTime: "16:15", breakMinutes: 30, expectedHours: 8, notes: "Revision bebederos" },
    { id: uid(), date: isoForOffset(0), dayType: "trabajado", startTime: "08:00", endTime: "15:30", breakMinutes: 30, expectedHours: 8, notes: "Turno de manana" }
  ];

  state.tasks = [
    { id: uid(), name: "Limpiar cuadras", date: isoForOffset(0), time: "09:00", duration: 2, status: "en-proceso", priority: "alta", notes: "Empezar por la zona norte" },
    { id: uid(), name: "Dar de comer a los caballos", date: isoForOffset(0), time: "12:00", duration: 1, status: "pendiente", priority: "alta", notes: "" },
    { id: uid(), name: "Revisar bebederos", date: isoForOffset(1), time: "10:30", duration: 1.5, status: "pendiente", priority: "media", notes: "Comprobar presion" },
    { id: uid(), name: "Mantenimiento de herramientas", date: isoForOffset(2), time: "15:00", duration: 2, status: "pendiente", priority: "baja", notes: "" },
    { id: uid(), name: "Poda", date: isoForOffset(3), time: "08:30", duration: 3, status: "pendiente", priority: "media", notes: "Llevar tijeras grandes" }
  ];

  render();
}

function clearData() {
  if (!confirm("Esto borrara todas las jornadas y tareas guardadas en este navegador. Continuar?")) return;
  state.workEntries = [];
  state.tasks = [];
  render();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function emptyState(text) {
  return `<div class="empty-state">${text}</div>`;
}

function bindEvents() {
  $$(".nav-link").forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.view));
  });

  $("#workForm").addEventListener("submit", saveWork);
  $("#taskForm").addEventListener("submit", saveTask);
  $("#resetWorkBtn").addEventListener("click", resetWorkForm);
  $("#resetTaskBtn").addEventListener("click", resetTaskForm);
  $("#taskFilter").addEventListener("change", renderTasks);
  $("#seedDemoBtn").addEventListener("click", seedDemoData);
  $("#clearDataBtn").addEventListener("click", clearData);
  $("#themeSelect").addEventListener("change", (event) => {
    state.theme.name = event.target.value;
    applyTheme();
  });
  $("#modeToggleBtn").addEventListener("click", () => {
    state.theme.mode = state.theme.mode === "dark" ? "light" : "dark";
    applyTheme();
  });

  $("#prevMonthBtn").addEventListener("click", () => {
    state.calendarDate.setMonth(state.calendarDate.getMonth() - 1);
    renderCalendar();
  });

  $("#nextMonthBtn").addEventListener("click", () => {
    state.calendarDate.setMonth(state.calendarDate.getMonth() + 1);
    renderCalendar();
  });

  document.body.addEventListener("click", (event) => {
    const editWorkButton = event.target.closest("[data-edit-work]");
    const deleteWorkButton = event.target.closest("[data-delete-work]");
    const editTaskButton = event.target.closest("[data-edit-task]");
    const deleteTaskButton = event.target.closest("[data-delete-task]");

    if (editWorkButton) editWork(editWorkButton.dataset.editWork);
    if (deleteWorkButton) deleteWork(deleteWorkButton.dataset.deleteWork);
    if (editTaskButton) editTask(editTaskButton.dataset.editTask);
    if (deleteTaskButton) deleteTask(deleteTaskButton.dataset.deleteTask);
  });
}

function init() {
  $("#todayLabel").textContent = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
  loadTheme();
  loadData();
  setDefaultDates();
  bindEvents();
  applyTheme();
  render();
}

init();
