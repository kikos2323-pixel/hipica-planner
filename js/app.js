const STORAGE_KEY = "fincaPlanner.v1";
const THEME_KEY = "fincaPlanner.theme";
const STANDARD_DAY_HOURS = 7;

const state = {
  workEntries: [],
  tasks: [],
  currentView: "dashboard",
  calendarDate: new Date(),
  clock: {
    date: todayISO(),
    isRunning: false,
    segments: []
  },
  theme: {
    mode: "light"
  }
};

let charts = {};
let clockInterval = null;

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
  if (Array.isArray(entry.segments) && entry.segments.length) {
    return roundHours(entry.segments.reduce((sum, segment) => sum + segmentMinutes(segment), 0) / 60);
  }
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
    tasks: state.tasks,
    clock: state.clock
  }));
}

function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    state.workEntries = Array.isArray(data.workEntries) ? data.workEntries : [];
    state.tasks = Array.isArray(data.tasks) ? data.tasks : [];
    if (data.clock && Array.isArray(data.clock.segments)) {
      state.clock = {
        date: data.clock.date || todayISO(),
        isRunning: Boolean(data.clock.isRunning),
        segments: data.clock.segments
      };
    } else {
      const todayEntry = state.workEntries.find((entry) => entry.date === todayISO() && Array.isArray(entry.segments));
      if (todayEntry) {
        state.clock = {
          date: todayISO(),
          isRunning: todayEntry.segments.some((segment) => !segment.end),
          segments: todayEntry.segments
        };
      }
    }
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
    state.theme.mode = theme.mode || "light";
  } catch {
    state.theme.mode = "light";
  }
}

function saveTheme() {
  localStorage.setItem(THEME_KEY, JSON.stringify(state.theme));
}

function applyTheme() {
  document.body.dataset.mode = state.theme.mode;
  $("#modeToggleBtn").textContent = state.theme.mode === "dark" ? "Modo claro" : "Modo oscuro";
  saveTheme();
  renderStats();
}

function setDefaultDates() {
  $("#workDate").value = todayISO();
  $("#taskDate").value = todayISO();
}

function render() {
  renderClock();
  renderDashboard();
  renderWorkTable();
  renderTasks();
  renderCalendar();
  renderHistory();
  renderStats();
  saveData();
}

function normalizeClockDate() {
  if (state.clock.date === todayISO()) return;
  state.clock = {
    date: todayISO(),
    isRunning: false,
    segments: []
  };
}

function timeLabelFromIso(isoValue) {
  if (!isoValue) return "";
  return new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit" }).format(new Date(isoValue));
}

function timeInputFromIso(isoValue) {
  if (!isoValue) return "";
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) return "";
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  return [hours, minutes, rest].map((value) => String(value).padStart(2, "0")).join(":");
}

function segmentMinutes(segment, includeRunning = true) {
  return Math.round(segmentSeconds(segment, includeRunning) / 60);
}

function segmentSeconds(segment, includeRunning = true) {
  if (!segment.start) return 0;
  const start = new Date(segment.start);
  const end = segment.end ? new Date(segment.end) : includeRunning ? new Date() : start;
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return 0;
  return Math.floor((end - start) / 1000);
}

function clockElapsedSeconds() {
  return state.clock.segments.reduce((sum, segment) => sum + segmentSeconds(segment), 0);
}

function segmentListHtml(segments) {
  if (!segments.length) return `<span class="muted">Sin tramos registrados hoy</span>`;
  return segments.map((segment) => {
    const isRunning = !segment.end;
    const endLabel = isRunning ? "en curso" : timeLabelFromIso(segment.end);
    return `<span class="clock-segment ${isRunning ? "running" : ""}">${timeLabelFromIso(segment.start)} - ${endLabel}</span>`;
  }).join("");
}

function renderClock() {
  normalizeClockDate();
  const elapsed = formatDuration(clockElapsedSeconds());
  const status = state.clock.isRunning ? "Jornada en marcha" : state.clock.segments.length ? "Jornada pausada" : "Jornada sin iniciar";
  const segmentsHtml = segmentListHtml(state.clock.segments);

  $("#clockStatus").textContent = status;
  $("#clockElapsed").textContent = elapsed;
  $("#clockSegments").innerHTML = segmentsHtml;
  $("#clockToggleBtn").textContent = state.clock.isRunning ? "Pausar jornada" : state.clock.segments.length ? "Reanudar jornada" : "Iniciar jornada";

  $("#workClockStatus").textContent = status;
  $("#workClockElapsed").textContent = elapsed;
  $("#workClockSegments").innerHTML = segmentsHtml;
}

function startClock() {
  normalizeClockDate();
  if (state.clock.isRunning) return;
  state.clock.isRunning = true;
  state.clock.segments.push({ start: new Date().toISOString(), end: null });
  syncClockToWorkEntry();
  render();
}

function pauseClock() {
  normalizeClockDate();
  const activeSegment = state.clock.segments.find((segment) => !segment.end);
  if (!activeSegment) {
    state.clock.isRunning = false;
    render();
    return;
  }
  activeSegment.end = new Date().toISOString();
  state.clock.isRunning = false;
  syncClockToWorkEntry();
  render();
}

function toggleClock() {
  if (state.clock.isRunning) {
    pauseClock();
  } else {
    startClock();
  }
}

function resetClock() {
  if (!confirm("Quieres reiniciar el fichaje de hoy? Se borraran los tramos registrados hoy en este navegador.")) return;
  const date = todayISO();
  state.clock = { date, isRunning: false, segments: [] };
  const entry = state.workEntries.find((item) => item.date === date && item.generatedByClock);
  if (entry) {
    state.workEntries = state.workEntries.filter((item) => item.id !== entry.id);
  } else {
    const todayEntry = state.workEntries.find((item) => item.date === date);
    if (todayEntry) {
      todayEntry.segments = [];
      todayEntry.startTime = "";
      todayEntry.endTime = "";
      todayEntry.breakMinutes = 0;
      todayEntry.updatedAt = new Date().toISOString();
    }
  }
  render();
}

function syncClockToWorkEntry() {
  const date = state.clock.date;
  const segments = state.clock.segments;
  if (!segments.length) return;

  let entry = state.workEntries.find((item) => item.date === date && item.dayType === "trabajado");
  if (!entry) {
    entry = {
      id: uid(),
      date,
      dayType: "trabajado",
      startTime: "",
      endTime: "",
      breakMinutes: 0,
      expectedHours: STANDARD_DAY_HOURS,
      notes: "Registro creado con el fichaje automatico",
      generatedByClock: true,
      updatedAt: new Date().toISOString()
    };
    state.workEntries.push(entry);
  }

  entry.dayType = "trabajado";
  entry.segments = segments.map((segment) => ({ ...segment }));
  entry.startTime = timeInputFromIso(segments[0].start);
  const lastFinished = [...segments].reverse().find((segment) => segment.end);
  entry.endTime = lastFinished ? timeInputFromIso(lastFinished.end) : "";
  entry.breakMinutes = calculateBreakMinutesFromSegments(segments);
  entry.updatedAt = new Date().toISOString();
}

function calculateBreakMinutesFromSegments(segments) {
  const finished = segments.filter((segment) => segment.start && segment.end);
  return finished.reduce((sum, segment, index) => {
    const next = finished[index + 1];
    if (!next) return sum;
    const end = new Date(segment.end);
    const nextStart = new Date(next.start);
    return sum + Math.max(0, Math.round((nextStart - end) / 60000));
  }, 0);
}

function workScheduleLabel(entry) {
  if (Array.isArray(entry.segments) && entry.segments.length) {
    return entry.segments.map((segment) => `${timeLabelFromIso(segment.start)} - ${segment.end ? timeLabelFromIso(segment.end) : "en curso"}`).join("<br>");
  }
  return `${entry.startTime || "-"} - ${entry.endTime || "-"}`;
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
    ...todayEntries.map((entry) => `<div class="summary-item"><strong>${entry.dayType}</strong><p>${calculateWorkHours(entry)} h trabajadas - Extra ${calculateExtraHours(entry)} h</p></div>`),
    ...todayTasks.map((task) => `<div class="summary-item"><strong>${task.name}</strong><p>${task.time || "Sin hora"} - ${labelStatus(task.status)} - ${task.priority}</p></div>`)
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
        <td>${workScheduleLabel(entry)}</td>
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
      <span class="icon-slot task-icon" data-icon="${taskIconKey(task.name)}"></span>
      <div class="task-main">
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

function taskIconKey(taskName) {
  const name = taskName.toLowerCase();
  if (name.includes("cuadra") || name.includes("limpieza")) return "stable";
  if (name.includes("caballo") || name.includes("comer")) return "horse";
  if (name.includes("bebedero") || name.includes("agua")) return "water";
  if (name.includes("alimento") || name.includes("comida")) return "feed";
  if (name.includes("repar") || name.includes("herramient")) return "tools";
  if (name.includes("poda")) return "prune";
  return "custom-task";
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
      html: `<div class="history-item"><strong>Jornada - ${formatDate(entry.date)}</strong><p>${entry.dayType} - ${calculateWorkHours(entry)} h - ${escapeHtml(entry.notes || "Sin observaciones")}</p></div>`
    })),
    ...state.tasks.map((task) => ({
      date: task.date,
      html: `<div class="history-item"><strong>Tarea - ${escapeHtml(task.name)}</strong><p>${formatDate(task.date)} - ${labelStatus(task.status)} - ${escapeHtml(task.notes || "Sin observaciones")}</p></div>`
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

function clearData() {
  if (!confirm("Esto borrara todas las jornadas y tareas guardadas en este navegador. Continuar?")) return;
  state.workEntries = [];
  state.tasks = [];
  state.clock = { date: todayISO(), isRunning: false, segments: [] };
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
  $("#clearDataBtn").addEventListener("click", clearData);
  $("#clockToggleBtn").addEventListener("click", toggleClock);
  $("#clockResetBtn").addEventListener("click", resetClock);
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
  clockInterval = setInterval(renderClock, 1000);
}

init();
