const STORAGE_KEY = "fincaPlanner.v1";
const THEME_KEY = "fincaPlanner.theme";
const STANDARD_DAY_HOURS = 7;
const WEEKLY_SCHEDULE = [
  { day: 1, label: "Lunes", shifts: [{ start: "07:00", end: "13:30" }, { start: "19:00", end: "21:00" }] },
  { day: 2, label: "Martes", shifts: [{ start: "08:00", end: "13:00" }] },
  { day: 3, label: "Miercoles", shifts: [{ start: "08:00", end: "13:00" }, { start: "19:00", end: "21:00" }] },
  { day: 4, label: "Jueves", shifts: [{ start: "08:00", end: "13:00" }] },
  { day: 5, label: "Viernes", shifts: [{ start: "08:00", end: "13:00" }, { start: "19:00", end: "21:00" }] },
  { day: 6, label: "Sabado", shifts: [{ start: "07:00", end: "13:30" }, { start: "19:00", end: "21:00" }] },
  { day: 0, label: "Domingo", shifts: [] }
];

const state = {
  workEntries: [],
  tasks: [],
  horses: [],
  calendarNotes: [],
  currentView: "dashboard",
  currentWorkSection: "fichaje",
  currentHorseSection: "buscar",
  selectedHorseId: null,
  calendarDate: new Date(),
  selectedWorkDate: "",
  manualSegments: [],
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
let navigationStack = [];
let isRestoringNavigation = false;
let activeRecognition = null;

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

function hoursBetween(startTime, endTime) {
  const start = minutesFromTime(startTime);
  const end = minutesFromTime(endTime);
  if (start === null || end === null || end <= start) return 0;
  return roundHours((end - start) / 60);
}

function getScheduleForDate(dateString) {
  const date = new Date(`${dateString}T12:00:00`);
  const day = date.getDay();
  return WEEKLY_SCHEDULE.find((item) => item.day === day) || WEEKLY_SCHEDULE[0];
}

function scheduleExpectedHours(dateString) {
  const schedule = getScheduleForDate(dateString);
  return scheduleTotalHours(schedule);
}

function scheduleTotalHours(schedule) {
  return roundHours(schedule.shifts.reduce((sum, shift) => sum + hoursBetween(shift.start, shift.end), 0));
}

function scheduleLabel(schedule) {
  if (!schedule.shifts.length) return "Descanso";
  return schedule.shifts.map((shift) => `${shift.start} - ${shift.end}`).join(" / ");
}

function isoFromDateAndTime(dateString, timeString) {
  if (!dateString || !timeString) return null;
  const date = new Date(`${dateString}T${timeString}:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
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
    horses: state.horses,
    calendarNotes: state.calendarNotes,
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
    state.horses = Array.isArray(data.horses) ? data.horses : [];
    state.calendarNotes = Array.isArray(data.calendarNotes) ? data.calendarNotes : [];
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
  $("#expectedHours").value = scheduleExpectedHours(todayISO());
  $("#manualDate").value = todayISO();
  $("#taskDate").value = todayISO();
}

function render() {
  renderClock();
  renderManualSegments();
  renderDashboard();
  renderWorkTable();
  renderTasks();
  renderHorses();
  renderWeeklySchedule();
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
      expectedHours: scheduleExpectedHours(date) || STANDARD_DAY_HOURS,
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

function entrySegmentsForTimeline(entry) {
  if (Array.isArray(entry.segments) && entry.segments.length) {
    return entry.segments
      .map((segment) => ({ start: segment.start, end: segment.end }))
      .filter((segment) => segment.start)
      .sort((a, b) => new Date(a.start) - new Date(b.start));
  }
  if (entry.startTime && entry.endTime) {
    return [{
      start: isoFromDateAndTime(entry.date, entry.startTime),
      end: isoFromDateAndTime(entry.date, entry.endTime)
    }];
  }
  return [];
}

function workHoursChip(entry) {
  if (entry.dayType !== "trabajado") return `<span class="time-chip rest">0 h</span>`;
  return `<span class="time-chip work">${calculateWorkHours(entry)} h</span>`;
}

function breakHoursChip(entry) {
  const segments = entrySegmentsForTimeline(entry);
  const breakHours = roundHours(calculateBreakMinutesFromSegments(segments) / 60);
  if (!breakHours) return `<span class="time-chip rest">Sin pausa</span>`;
  return `<span class="time-chip break">${breakHours} h</span>`;
}

function workStatusHtml(entry) {
  if (entry.dayType !== "trabajado") {
    return `<span class="time-chip rest">${entry.dayType}</span>`;
  }
  const segments = entrySegmentsForTimeline(entry);
  if (!segments.length) {
    return `<span class="time-chip alert">Sin horario</span>`;
  }
  if (segments.some((segment) => !segment.end)) {
    return `<div class="work-status"><span class="time-chip alert">Tramo abierto</span><small>Falta hora de fin</small></div>`;
  }
  const expected = Number(entry.expectedHours) || scheduleExpectedHours(entry.date) || STANDARD_DAY_HOURS;
  const worked = calculateWorkHours(entry);
  if (worked >= expected) {
    return `<span class="time-chip work">Completa</span>`;
  }
  return `<div class="work-status"><span class="time-chip break">Parcial</span><small>Faltan ${roundHours(expected - worked)} h</small></div>`;
}

function loadManualSegmentsForDate(dateString = $("#manualDate").value || todayISO()) {
  const entry = state.workEntries.find((item) => item.date === dateString);
  if (entry && Array.isArray(entry.segments) && entry.segments.length) {
    state.manualSegments = entry.segments.map((segment) => ({
      start: timeInputFromIso(segment.start),
      end: segment.end ? timeInputFromIso(segment.end) : ""
    }));
  } else if (entry && entry.startTime && entry.endTime) {
    state.manualSegments = [{ start: entry.startTime, end: entry.endTime }];
  } else {
    state.manualSegments = [{ start: "", end: "" }];
  }
  renderManualSegments();
}

function renderManualSegments() {
  const container = $("#manualSegments");
  if (!container) return;
  if (!state.manualSegments.length) {
    state.manualSegments = [{ start: "", end: "" }];
  }
  container.innerHTML = state.manualSegments.map((segment, index) => `
    <div class="manual-segment-row">
      <label>Inicio tramo ${index + 1}
        <input type="time" value="${escapeHtml(segment.start || "")}" data-manual-start="${index}">
      </label>
      <label>Fin tramo ${index + 1}
        <input type="time" value="${escapeHtml(segment.end || "")}" data-manual-end="${index}">
      </label>
      <button class="small-button" type="button" data-remove-segment="${index}">Quitar</button>
    </div>
  `).join("");
  $("#manualTotal").textContent = `${manualSegmentsHours()} h`;
}

function manualSegmentsHours() {
  return roundHours(state.manualSegments.reduce((sum, segment) => sum + hoursBetween(segment.start, segment.end), 0));
}

function addManualSegment() {
  state.manualSegments.push({ start: "", end: "" });
  renderManualSegments();
}

function removeManualSegment(index) {
  state.manualSegments.splice(index, 1);
  if (!state.manualSegments.length) state.manualSegments.push({ start: "", end: "" });
  renderManualSegments();
}

function updateManualSegment(index, field, value) {
  if (!state.manualSegments[index]) return;
  state.manualSegments[index][field] = value;
  $("#manualTotal").textContent = `${manualSegmentsHours()} h`;
}

function loadScheduleIntoManualEditor() {
  const date = $("#manualDate").value || todayISO();
  const schedule = getScheduleForDate(date);
  state.manualSegments = schedule.shifts.length
    ? schedule.shifts.map((shift) => ({ start: shift.start, end: shift.end }))
    : [{ start: "", end: "" }];
  renderManualSegments();
}

function saveManualSegments() {
  const date = $("#manualDate").value || todayISO();
  const validSegments = state.manualSegments
    .filter((segment) => segment.start && segment.end && hoursBetween(segment.start, segment.end) > 0)
    .map((segment) => ({
      start: isoFromDateAndTime(date, segment.start),
      end: isoFromDateAndTime(date, segment.end)
    }))
    .filter((segment) => segment.start && segment.end);

  if (!validSegments.length) {
    alert("Añade al menos un tramo completo con hora de inicio y hora de fin.");
    return;
  }

  let entry = state.workEntries.find((item) => item.date === date && item.dayType === "trabajado");
  if (!entry) {
    entry = {
      id: uid(),
      date,
      dayType: "trabajado",
      startTime: "",
      endTime: "",
      breakMinutes: 0,
      expectedHours: scheduleExpectedHours(date) || STANDARD_DAY_HOURS,
      notes: "Jornada corregida manualmente",
      updatedAt: new Date().toISOString()
    };
    state.workEntries.push(entry);
  }

  entry.dayType = "trabajado";
  entry.segments = validSegments;
  entry.startTime = timeInputFromIso(validSegments[0].start);
  entry.endTime = timeInputFromIso(validSegments[validSegments.length - 1].end);
  entry.breakMinutes = calculateBreakMinutesFromSegments(validSegments);
  entry.expectedHours = Number(entry.expectedHours) || scheduleExpectedHours(date) || STANDARD_DAY_HOURS;
  entry.notes = entry.notes || "Jornada corregida manualmente";
  entry.updatedAt = new Date().toISOString();

  if (date === todayISO()) {
    state.clock = {
      date,
      isRunning: validSegments.some((segment) => !segment.end),
      segments: validSegments.map((segment) => ({ ...segment }))
    };
  }

  render();
  alert("Fichaje corregido y guardado.");
}

function openTodayCorrection() {
  rememberNavigation();
  switchView("jornada", false);
  switchWorkSection("corregir", false);
  $("#manualDate").value = todayISO();
  loadManualSegmentsForDate(todayISO());
  document.querySelector(".manual-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function cssVar(name) {
  return getComputedStyle(document.body).getPropertyValue(name).trim();
}

function currentNavigationState() {
  return {
    view: state.currentView,
    workSection: state.currentWorkSection,
    horseSection: state.currentHorseSection,
    selectedWorkDate: state.selectedWorkDate
  };
}

function rememberNavigation() {
  if (isRestoringNavigation) return;
  const last = navigationStack[navigationStack.length - 1];
  const current = currentNavigationState();
  if (last && last.view === current.view && last.workSection === current.workSection && last.horseSection === current.horseSection && last.selectedWorkDate === current.selectedWorkDate) return;
  navigationStack.push(current);
  updateBackButton();
}

function updateBackButton() {
  const button = $("#backBtn");
  if (button) button.disabled = navigationStack.length === 0;
}

function goBack() {
  const previous = navigationStack.pop();
  if (!previous) {
    updateBackButton();
    return;
  }
  isRestoringNavigation = true;
  state.selectedWorkDate = previous.selectedWorkDate || "";
  switchView(previous.view, false);
  switchWorkSection(previous.workSection || "fichaje", false);
  switchHorseSection(previous.horseSection || "buscar", false);
  renderWorkTable();
  isRestoringNavigation = false;
  updateBackButton();
}

function switchView(view, track = true) {
  if (track && view !== state.currentView) rememberNavigation();
  state.currentView = view;
  $$(".view").forEach((el) => el.classList.toggle("active", el.id === view));
  $$(".nav-link").forEach((btn) => btn.classList.toggle("active", btn.dataset.view === view));
  $("#viewTitle").textContent = {
    dashboard: "Inicio",
    jornada: "Registro de jornada",
    tareas: "Gestion de tareas",
    calendario: "Calendario",
    cuadras: "Cuadras y mapa",
    estadisticas: "Graficos",
    historial: "Historial"
  }[view];
  renderStats();
  updateBackButton();
}

function switchWorkSection(section, track = true) {
  if (track && section !== state.currentWorkSection) rememberNavigation();
  state.currentWorkSection = section;
  $$(".work-section").forEach((el) => el.classList.toggle("active", el.id === `work-section-${section}`));
  $$("[data-work-section]").forEach((btn) => btn.classList.toggle("active", btn.dataset.workSection === section));
  updateBackButton();
}

function switchHorseSection(section, track = true) {
  if (track && section !== state.currentHorseSection) rememberNavigation();
  state.currentHorseSection = section;
  $$(".horse-section").forEach((el) => el.classList.toggle("active", el.id === `horse-section-${section}`));
  $$("[data-horse-section]").forEach((btn) => btn.classList.toggle("active", btn.dataset.horseSection === section));
  updateBackButton();
}

function openWorkDate(dateString) {
  rememberNavigation();
  state.selectedWorkDate = dateString;
  switchView("jornada", false);
  switchWorkSection("listado", false);
  $("#manualDate").value = dateString;
  $("#workDate").value = dateString;
  $("#expectedHours").value = scheduleExpectedHours(dateString) || STANDARD_DAY_HOURS;
  loadManualSegmentsForDate(dateString);
  renderWorkTable();
  document.querySelector("#work-section-listado")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function showAllWorkEntries() {
  rememberNavigation();
  state.selectedWorkDate = "";
  switchView("jornada", false);
  switchWorkSection("listado", false);
  renderWorkTable();
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
  const todaySchedule = getScheduleForDate(todayISO());
  $("#todaySummary").innerHTML = [
    `<div class="summary-item"><strong>Horario previsto</strong><p>${scheduleLabel(todaySchedule)} - ${scheduleExpectedHours(todayISO())} h</p></div>`,
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

function renderWeeklySchedule() {
  const today = new Date().getDay();
  $("#weeklySchedule").innerHTML = WEEKLY_SCHEDULE.map((schedule) => {
    const isToday = schedule.day === today;
    const isRest = !schedule.shifts.length;
    const shifts = isRest
      ? `<span class="schedule-shift">Descanso</span>`
      : schedule.shifts.map((shift) => `<span class="schedule-shift">${shift.start} - ${shift.end}</span>`).join("");
    return `
      <article class="schedule-day ${isToday ? "today" : ""} ${isRest ? "rest" : ""}">
        <strong>${schedule.label}</strong>
        ${shifts}
        <span class="schedule-total">${scheduleTotalHours(schedule)} h previstas</span>
      </article>
    `;
  }).join("");
}

function renderWorkTable() {
  const entries = state.selectedWorkDate
    ? state.workEntries.filter((entry) => entry.date === state.selectedWorkDate)
    : state.workEntries;
  $("#selectedWorkDateLabel").textContent = state.selectedWorkDate
    ? `Mostrando ${formatDate(state.selectedWorkDate)}`
    : "Todos los dias";

  const rows = [...entries]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((entry) => `
      <tr>
        <td data-label="Fecha">${formatDate(entry.date)}</td>
        <td data-label="Tipo"><span class="badge">${entry.dayType}</span></td>
        <td data-label="Horario">${workScheduleLabel(entry)}</td>
        <td data-label="Trabajo">${workHoursChip(entry)}</td>
        <td data-label="Pausa">${breakHoursChip(entry)}</td>
        <td data-label="Estado">${workStatusHtml(entry)}</td>
        <td data-label="Total">${calculateWorkHours(entry)} h</td>
        <td data-label="Extra">${calculateExtraHours(entry)} h</td>
        <td data-label="Acciones">
          <button class="small-button" data-edit-work="${entry.id}" type="button">Editar</button>
          <button class="small-button" data-delete-work="${entry.id}" type="button">Borrar</button>
        </td>
      </tr>
    `);
  $("#workTable").innerHTML = rows.join("") || `<tr><td colspan="9">${emptyState(state.selectedWorkDate ? "No hay jornada registrada para este dia." : "No hay jornadas registradas.")}</td></tr>`;
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

function renderHorses() {
  renderHorseList();
  renderHorseObservations();
}

function renderHorseList() {
  const list = $("#horseList");
  if (!list) return;
  const query = normalizeSearch($("#horseListSearch")?.value || "");
  const horses = [...state.horses]
    .sort((a, b) => naturalHorseSort(a, b))
    .filter((horse) => {
      if (!query) return true;
      return normalizeSearch(`${horse.number} ${horse.name} ${horse.stable}`).includes(query);
    });

  list.innerHTML = horses.map((horse) => {
    const thumb = horse.photo
      ? `<img src="${horse.photo}" alt="">`
      : `<span>${escapeHtml(horse.number || "?")}</span>`;
    const selected = state.selectedHorseId === horse.id ? "selected" : "";
    return `
      <div class="horse-list-row ${selected}" data-browse-horse="${horse.id}" tabindex="0" role="button" aria-label="${escapeHtml(horseLabel(horse))}">
        <div class="horse-list-row-thumb">${thumb}</div>
        <div class="horse-list-row-info">
          <strong>${escapeHtml(horse.name || horseLabel(horse))}</strong>
          <small>${escapeHtml(horse.number ? `Caballo ${horse.number}` : "Sin número")} · ${escapeHtml(horse.stable || "Sin cuadra")}</small>
        </div>
      </div>
    `;
  }).join("") || emptyState("No hay caballos con ese criterio.");
}

function openCalendarDayModal(iso) {
  const modal = $("#calendarDayModal");
  if (!modal) return;
  $("#calNoteDate").value = iso;
  $("#calModalTitle").textContent = formatDate(iso);
  renderCalendarModalInfo(iso);
  renderCalendarModalNotes(iso);
  modal.classList.add("open");
  document.body.style.overflow = "hidden";
  setTimeout(() => $("#calNoteText")?.focus(), 100);
}

function closeCalendarDayModal() {
  $("#calendarDayModal")?.classList.remove("open");
  document.body.style.overflow = "";
}

function renderCalendarModalInfo(iso) {
  const work = state.workEntries.filter((e) => e.date === iso);
  const tasks = state.tasks.filter((t) => t.date === iso);
  const schedule = getScheduleForDate(iso);
  const info = [
    `<div class="cal-info-chip schedule">🕐 ${escapeHtml(scheduleLabel(schedule))} — ${scheduleTotalHours(schedule)} h previstas</div>`,
    ...work.map((e) => `<div class="cal-info-chip work">✅ ${escapeHtml(e.dayType)}: ${calculateWorkHours(e)} h trabajadas</div>`),
    ...tasks.map((t) => `<div class="cal-info-chip task">📋 ${escapeHtml(t.name)} — ${labelStatus(t.status)}</div>`)
  ].join("");
  $("#calModalInfo").innerHTML = info || `<p class="muted">Sin jornada ni tareas este día.</p>`;
}

function renderCalendarModalNotes(iso) {
  const notes = state.calendarNotes.filter((n) => n.date === iso).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const colors = { green: "🟢", blue: "🔵", amber: "🟡", red: "🔴" };
  $("#calModalNotes").innerHTML = notes.map((note) => `
    <div class="cal-note-item cal-note-${note.color}">
      <span class="cal-note-dot">${colors[note.color] || "🟢"}</span>
      <span class="cal-note-body">${escapeHtml(note.text)}</span>
      <button class="cal-note-delete" data-delete-note="${note.id}" type="button" aria-label="Borrar nota">✕</button>
    </div>
  `).join("") || "";
}

function saveCalendarNote(event) {
  event.preventDefault();
  const text = $("#calNoteText").value.trim();
  const date = $("#calNoteDate").value;
  if (!text || !date) return;
  state.calendarNotes.push({
    id: uid(),
    date,
    text,
    color: $("#calNoteColor").value,
    createdAt: new Date().toISOString()
  });
  $("#calNoteText").value = "";
  saveData();
  renderCalendarModalNotes(date);
  renderCalendar();
}

function deleteCalendarNote(id) {
  state.calendarNotes = state.calendarNotes.filter((n) => n.id !== id);
  const date = $("#calNoteDate").value;
  saveData();
  renderCalendarModalNotes(date);
  renderCalendar();
}

function openLightbox(src) {
  const lb = $("#photoLightbox");
  const img = $("#lightboxImg");
  if (!lb || !img || !src) return;
  img.src = src;
  lb.classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeLightbox() {
  const lb = $("#photoLightbox");
  if (!lb) return;
  lb.classList.remove("open");
  document.body.style.overflow = "";
}

function showHorseDetail(id) {
  const horse = state.horses.find((h) => h.id === id);
  state.selectedHorseId = id;
  renderHorseList();

  const empty = $("#horseBrowserEmpty");
  const card = $("#horseBrowserCard");
  if (!horse || !empty || !card) return;

  empty.style.display = "none";
  card.style.display = "grid";
  document.querySelector(".horse-browser")?.classList.add("has-detail");

  const stableLink = horseHasLocation(horse, "stable")
    ? `<a class="map-link" href="${googleMapsUrl(horse, "stable")}" target="_blank" rel="noopener">Ver cuadra en Maps</a>`
    : `<span class="muted">Cuadra sin ubicación</span>`;
  const paddockLink = horse.paddock && horseHasLocation(horse, "paddock")
    ? `<a class="map-link" href="${googleMapsUrl(horse, "paddock")}" target="_blank" rel="noopener">Ver paddock en Maps</a>`
    : horse.paddock ? `<span class="muted">Paddock sin ubicación</span>` : "";

  const photo = horse.photo
    ? `<img src="${horse.photo}" alt="" class="lightbox-trigger" data-lightbox="${horse.photo}" title="Ver foto completa" style="cursor:zoom-in">`
    : `<span>${escapeHtml(horse.number || "?")}</span>`;

  card.innerHTML = `
    <div class="horse-detail-header">
      <div class="horse-detail-photo">${photo}</div>
      <div>
        <div class="horse-title-block">
          <span class="horse-code">${escapeHtml(horse.number ? `Caballo ${horse.number}` : "Ficha de caballo")}</span>
          <h3>${escapeHtml(horse.name || horseLabel(horse))}</h3>
        </div>
      </div>
      <div class="horse-detail-actions">
        <button class="small-button" data-edit-horse="${horse.id}" type="button">Editar</button>
        <button class="small-button" data-share-horse="${horse.id}" type="button">Compartir</button>
        <button class="small-button" data-delete-horse="${horse.id}" type="button">Borrar</button>
      </div>
    </div>

    <div class="horse-detail-feed">
      <h4 class="feed-title">Alimentación</h4>
      <div class="feed-grid">
        <div class="feed-slot">
          <span class="feed-icon">🌅</span>
          <div><label>Mañana</label><p>${escapeHtml(horse.feedMorning || "—")}</p></div>
        </div>
        <div class="feed-slot">
          <span class="feed-icon">☀️</span>
          <div><label>Mediodía</label><p>${escapeHtml(horse.feedNoon || "—")}</p></div>
        </div>
        <div class="feed-slot">
          <span class="feed-icon">🌙</span>
          <div><label>Tarde</label><p>${escapeHtml(horse.feedEvening || "—")}</p></div>
        </div>
      </div>
    </div>

    <div class="horse-detail-meta">
      <div class="horse-detail-field">
        <label>Cuadra</label>
        <p>
          ${escapeHtml(horse.stable || "—")}
          ${horseHasLocation(horse, "stable") ? `<a class="coord-map-link" href="${googleMapsUrl(horse, "stable")}" target="_blank" rel="noopener" title="Ver en Maps">🗺️</a>` : ""}
        </p>
      </div>
      ${horse.paddock ? `
      <div class="horse-detail-field">
        <label>Paddock</label>
        <p>
          ${escapeHtml(horse.paddock)}
          ${horseHasLocation(horse, "paddock") ? `<a class="coord-map-link" href="${googleMapsUrl(horse, "paddock")}" target="_blank" rel="noopener" title="Ver en Maps">🗺️</a>` : ""}
        </p>
      </div>` : ""}
    </div>

    ${horse.notes ? `<div class="horse-detail-notes"><label>Observaciones</label><p>${escapeHtml(horse.notes)}</p></div>` : ""}

    ${(horseHasLocation(horse, "stable") || horseHasLocation(horse, "paddock")) ? `
    <div class="map-link-row">
      ${horseHasLocation(horse, "stable") ? `<a class="map-link" href="${googleMapsUrl(horse, "stable")}" target="_blank" rel="noopener">Ver cuadra en Maps</a>` : ""}
      ${horseHasLocation(horse, "paddock") ? `<a class="map-link" href="${googleMapsUrl(horse, "paddock")}" target="_blank" rel="noopener">Ver paddock en Maps</a>` : ""}
    </div>` : ""}
  `;
}

function renderHorseObservations() {
  const list = $("#horseObservationsList");
  if (!list) return;
  const horsesWithNotes = state.horses
    .filter((horse) => horse.notes && horse.notes.trim())
    .sort((a, b) => naturalHorseSort(a, b));

  list.innerHTML = horsesWithNotes.map((horse) => `
    <article class="observation-card">
      <span class="icon-slot" data-icon="notes"></span>
      <div>
        <div class="horse-title-block">
          <span class="horse-code">${escapeHtml(horse.number ? `Caballo ${horse.number}` : "Ficha de caballo")}</span>
          <h3>${escapeHtml(horse.name || horseLabel(horse))}</h3>
        </div>
        <p>${escapeHtml(horse.notes)}</p>
        <div class="meta">
          <span>${escapeHtml(horse.stable || "Sin cuadra")}</span>
          ${horse.paddock ? `<span>${escapeHtml(horse.paddock)}</span>` : ""}
        </div>
      </div>
      <div class="card-actions">
        <button class="small-button" data-open-horse="${horse.id}" type="button">Abrir ficha</button>
        <button class="small-button" data-complete-horse-note="${horse.id}" type="button">Hecho</button>
      </div>
    </article>
  `).join("") || emptyState("No hay observaciones pendientes.");
}

function naturalHorseSort(a, b) {
  const aNum = Number(a.number);
  const bNum = Number(b.number);
  if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) return aNum - bNum;
  return String(a.number || a.name).localeCompare(String(b.number || b.name), "es", { numeric: true });
}

function horseCardHtml(horse) {
  return `
    <article class="horse-card">
      <div class="horse-photo-thumb">${horse.photo ? `<img src="${horse.photo}" alt="">` : `<span>${escapeHtml(horse.number || "?")}</span>`}</div>
      <div>
        <div class="horse-title-block">
          <span class="horse-code">${escapeHtml(horse.number ? `Caballo ${horse.number}` : "Ficha de caballo")}</span>
          <h3>${escapeHtml(horse.name || horseLabel(horse))}</h3>
        </div>
        <div class="meta">
          <span>${escapeHtml(horse.stable || "Sin cuadra")}</span>
          <span class="location-status">${horseHasLocation(horse, "stable") ? "Cuadra guardada" : "Cuadra sin ubicacion"}</span>
          ${horse.paddock ? `<span>${escapeHtml(horse.paddock)}</span>` : ""}
          ${horse.paddock ? `<span class="location-status">${horseHasLocation(horse, "paddock") ? "Paddock guardado" : "Paddock sin ubicacion"}</span>` : ""}
        </div>
        ${horse.notes ? `<p class="muted">${escapeHtml(horse.notes)}</p>` : ""}
      </div>
      <div class="card-actions">
        <button class="small-button" data-find-horse="${horse.id}" type="button">Ver</button>
        <button class="small-button" data-edit-horse="${horse.id}" type="button">Editar</button>
        <button class="small-button" data-delete-horse="${horse.id}" type="button">Borrar</button>
      </div>
    </article>
  `;
}

function horseLabel(horse) {
  const number = horse.number ? `Caballo ${horse.number}` : "Caballo";
  return horse.name ? `${number} - ${horse.name}` : number;
}

function googleMapsUrl(horse, locationType = "stable") {
  const location = horseLocation(horse, locationType);
  const query = encodeURIComponent(`${location.lat},${location.lng}`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

function coordinateValue(selector) {
  const value = $(selector).value;
  return value === "" ? null : Number(value);
}

function syncManualCoordinateInputsToHidden() {
  const pairs = [
    ["#manualStableLat", "#stableLat"],
    ["#manualStableLng", "#stableLng"],
    ["#manualPaddockLat", "#paddockLat"],
    ["#manualPaddockLng", "#paddockLng"]
  ];
  pairs.forEach(([manualSelector, hiddenSelector]) => {
    const manual = $(manualSelector);
    const hidden = $(hiddenSelector);
    if (manual && hidden) hidden.value = manual.value;
  });
}

function syncHiddenCoordinatesToManualInputs() {
  const pairs = [
    ["#stableLat", "#manualStableLat"],
    ["#stableLng", "#manualStableLng"],
    ["#paddockLat", "#manualPaddockLat"],
    ["#paddockLng", "#manualPaddockLng"]
  ];
  pairs.forEach(([hiddenSelector, manualSelector]) => {
    const hidden = $(hiddenSelector);
    const manual = $(manualSelector);
    if (manual && hidden) manual.value = hidden.value;
  });
}

function saveHorse(event) {
  event.preventDefault();
  syncManualCoordinateInputsToHidden();

  const number = $("#horseNumber").value.trim();
  const name = $("#horseName").value.trim();
  if (!number && !name) {
    alert("Introduce al menos el código o el nombre del caballo.");
    return;
  }

  const id = $("#horseId").value || uid();
  const horse = {
    id,
    number,
    name,
    stable: $("#stableName").value.trim(),
    paddock: $("#paddockName").value.trim(),
    lat: coordinateValue("#stableLat"),
    lng: coordinateValue("#stableLng"),
    paddockLat: coordinateValue("#paddockLat"),
    paddockLng: coordinateValue("#paddockLng"),
    photo: $("#horsePhotoData").value,
    notes: $("#horseNotes").value.trim(),
    feedMorning: $("#horseFeedMorning").value.trim(),
    feedNoon: $("#horseFeedNoon").value.trim(),
    feedEvening: $("#horseFeedEvening").value.trim(),
    updatedAt: new Date().toISOString()
  };

  state.horses = state.horses.filter((item) => item.id !== id);
  state.horses.push(horse);
  render();
  triggerHorseSaveAnimation();
  resetHorseForm();
}

function triggerHorseSaveAnimation() {
  const btn = $("#horseSaveBtn");
  if (!btn) return;
  btn.classList.add("btn-saving");
  btn.disabled = true;
  setTimeout(() => {
    btn.classList.remove("btn-saving");
    btn.classList.add("btn-saved");
    setTimeout(() => {
      btn.classList.remove("btn-saved");
      btn.disabled = false;
    }, 1600);
  }, 700);
}

function resetHorseForm() {
  $("#horseForm").reset();
  $("#horseId").value = "";
  $("#horsePhotoData").value = "";
  $("#locationHelp").textContent = "Pulsa estando junto a la cuadra del caballo.";
  syncHiddenCoordinatesToManualInputs();
  updateHorseFormTitle();
  renderHorsePhotoPreview("");
}

function editHorse(id) {
  const horse = state.horses.find((item) => item.id === id);
  if (!horse) return;
  switchView("cuadras");
  switchHorseSection("ficha");
  fillHorseForm(horse);
}

function fillHorseForm(horse) {
  $("#horseId").value = horse.id;
  $("#horseNumber").value = horse.number;
  $("#horseName").value = horse.name;
  $("#stableName").value = horse.stable;
  $("#paddockName").value = horse.paddock || "";
  $("#stableLat").value = horse.lat;
  $("#stableLng").value = horse.lng;
  $("#paddockLat").value = horse.paddockLat || "";
  $("#paddockLng").value = horse.paddockLng || "";
  syncHiddenCoordinatesToManualInputs();
  $("#horsePhotoData").value = horse.photo || "";
  $("#locationHelp").textContent = horseLocationStatus(horse);
  updateHorseFormTitle();
  renderHorsePhotoPreview(horse.photo || "");
  $("#horseNotes").value = horse.notes;
  $("#horseFeedMorning").value = horse.feedMorning || "";
  $("#horseFeedNoon").value = horse.feedNoon || "";
  $("#horseFeedEvening").value = horse.feedEvening || "";
}

function openHorseFromObservation(id) {
  rememberNavigation();
  switchView("cuadras", false);
  switchHorseSection("listado", false);
  showHorseDetail(id);
}

function completeHorseObservation(id) {
  const horse = state.horses.find((item) => item.id === id);
  if (!horse) return;
  if (!confirm("Marcar esta observacion como hecha? Se borrara de la ficha del caballo.")) return;
  horse.notes = "";
  horse.updatedAt = new Date().toISOString();
  render();
}

function updateHorseFormTitle() {
  const name = $("#horseName")?.value.trim();
  const number = $("#horseNumber")?.value.trim();
  const title = $("#horseFormTitle");
  if (!title) return;
  title.innerHTML = `
    <span>${escapeHtml(number ? `Caballo ${number}` : "Ficha de caballo")}</span>
    <strong>${escapeHtml(name || "Nuevo caballo")}</strong>
  `;
}

function shareHorse(id) {
  const horse = state.horses.find((h) => h.id === id);
  if (!horse) return;

  const lines = [
    `🐴 ${horseLabel(horse)}`,
    horse.stable  ? `📍 Cuadra: ${horse.stable}`  : null,
    horse.paddock ? `🌿 Paddock: ${horse.paddock}` : null,
    horseHasLocation(horse, "stable")  ? `🗺️ Ubicación cuadra: ${horse.lat}, ${horse.lng}` : null,
    horseHasLocation(horse, "stable")  ? googleMapsUrl(horse, "stable")  : null,
    horseHasLocation(horse, "paddock") ? `🗺️ Ubicación paddock: ${horse.paddockLat}, ${horse.paddockLng}` : null,
    horseHasLocation(horse, "paddock") ? googleMapsUrl(horse, "paddock") : null,
    horse.notes ? `📝 Notas: ${horse.notes}` : null,
    (horse.feedMorning || horse.feedNoon || horse.feedEvening) ? `\n🍽️ Alimentación:` : null,
    horse.feedMorning ? `  🌅 Mañana: ${horse.feedMorning}` : null,
    horse.feedNoon    ? `  ☀️ Mediodía: ${horse.feedNoon}`   : null,
    horse.feedEvening ? `  🌙 Tarde: ${horse.feedEvening}`   : null,
  ].filter(Boolean).join("\n");

  if (navigator.share) {
    navigator.share({ title: horseLabel(horse), text: lines }).catch(() => {});
  } else {
    navigator.clipboard.writeText(lines).then(() => alert("Información copiada al portapapeles.")).catch(() => alert("No se pudo compartir ni copiar."));
  }
}

function deleteHorse(id) {
  if (!confirm("Quieres borrar este caballo del registro?")) return;
  state.horses = state.horses.filter((item) => item.id !== id);
  if (state.selectedHorseId === id) {
    state.selectedHorseId = null;
    const empty = $("#horseBrowserEmpty");
    const card = $("#horseBrowserCard");
    if (empty) empty.style.display = "";
    if (card) card.style.display = "none";
  }
  render();
}

function findHorseByQuery(query) {
  const clean = normalizeSearch(query);
  if (!clean) return null;
  const numberMatch = clean.match(/\b(\d+)\b/);
  return state.horses.find((horse) => {
    const haystack = normalizeSearch(`${horse.number} ${horse.name} ${horse.stable} caballo ${horse.number}`);
    if (numberMatch && String(horse.number) === numberMatch[1]) return true;
    return haystack.includes(clean);
  }) || null;
}

function normalizeSearch(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function showHorseResult(horse) {
  const result = $("#horseResult");
  if (!horse) {
    result.innerHTML = emptyState("No he encontrado ese caballo. Revisa el numero, nombre o cuadra.");
    return;
  }
  result.innerHTML = `
    <article class="horse-result-card">
      <div class="horse-title-block">
        <span class="horse-code">${escapeHtml(horse.number ? `Caballo ${horse.number}` : "Ficha de caballo")}</span>
        <h3>${escapeHtml(horse.name || horseLabel(horse))}</h3>
      </div>
      ${horse.photo ? `<div class="horse-photo-preview"><img src="${horse.photo}" alt=""></div>` : ""}
      <div class="meta">
        <span>${escapeHtml(horse.stable)}</span>
        <span class="location-status">${horseHasLocation(horse, "stable") ? "Cuadra guardada" : "Cuadra sin ubicacion"}</span>
        ${horse.paddock ? `<span>${escapeHtml(horse.paddock)}</span>` : ""}
        ${horse.paddock ? `<span class="location-status">${horseHasLocation(horse, "paddock") ? "Paddock guardado" : "Paddock sin ubicacion"}</span>` : ""}
      </div>
      ${horse.notes ? `<p class="muted">${escapeHtml(horse.notes)}</p>` : ""}
      <div class="map-link-row">
        ${horseHasLocation(horse, "stable") ? `<a class="map-link" href="${googleMapsUrl(horse, "stable")}" target="_blank" rel="noopener">Google Maps cuadra</a>` : ""}
        ${horseHasLocation(horse, "paddock") ? `<a class="map-link" href="${googleMapsUrl(horse, "paddock")}" target="_blank" rel="noopener">Google Maps paddock</a>` : ""}
        <button class="ghost-button" data-open-horse-list="${horse.id}" type="button">Ver ficha</button>
      </div>
    </article>
  `;
}

function horseHasLocation(horse, locationType = "stable") {
  const location = horseLocation(horse, locationType);
  return location.lat !== null && location.lng !== null && Number.isFinite(Number(location.lat)) && Number.isFinite(Number(location.lng));
}

function horseLocation(horse, locationType = "stable") {
  if (locationType === "paddock") {
    return { lat: toCoordinate(horse.paddockLat), lng: toCoordinate(horse.paddockLng) };
  }
  return { lat: toCoordinate(horse.lat), lng: toCoordinate(horse.lng) };
}

function toCoordinate(value) {
  return value === "" || value === null || value === undefined ? null : Number(value);
}

function horseLocationStatus(horse) {
  const stable = horseHasLocation(horse, "stable") ? "cuadra guardada" : "cuadra sin ubicacion";
  const paddock = horse.paddock ? horseHasLocation(horse, "paddock") ? "paddock guardado" : "paddock sin ubicacion" : "sin paddock";
  return `${stable}; ${paddock}.`;
}

function renderHorsePhotoPreview(photoData) {
  const preview = $("#horsePhotoPreview");
  if (!preview) return;
  const input = preview.querySelector("#horsePhotoInput");
  preview.innerHTML = photoData
    ? `<img src="${photoData}" alt="" style="width:100%;height:100%;object-fit:cover;">`
    : `<span class="photo-placeholder">📷<br><small>Añadir foto</small></span>`;
  if (input) preview.appendChild(input);
}

function handleHorsePhoto(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener("load", () => compressImage(String(reader.result || ""), 900, 0.78)
    .then((dataUrl) => {
      $("#horsePhotoData").value = dataUrl;
      renderHorsePhotoPreview(dataUrl);
    })
    .catch(() => alert("No se ha podido preparar la foto.")));
  reader.readAsDataURL(file);
}

function compressImage(dataUrl, maxSize, quality) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext("2d");
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    image.onerror = reject;
    image.src = dataUrl;
  });
}

function useCurrentLocationForHorse(locationType) {
  if (!navigator.geolocation) {
    alert("Tu navegador no permite obtener ubicacion.");
    return;
  }
  $("#locationHelp").textContent = "Obteniendo coordenadas...";
  navigator.geolocation.getCurrentPosition((position) => {
    if (locationType === "paddock") {
      $("#paddockLat").value = position.coords.latitude.toFixed(6);
      $("#paddockLng").value = position.coords.longitude.toFixed(6);
      syncHiddenCoordinatesToManualInputs();
      $("#locationHelp").textContent = `Ubicacion de paddock guardada con precision aprox. ${Math.round(position.coords.accuracy)} m.`;
    } else {
      $("#stableLat").value = position.coords.latitude.toFixed(6);
      $("#stableLng").value = position.coords.longitude.toFixed(6);
      syncHiddenCoordinatesToManualInputs();
      $("#locationHelp").textContent = `Ubicacion de cuadra guardada con precision aprox. ${Math.round(position.coords.accuracy)} m.`;
    }
  }, () => {
    $("#locationHelp").textContent = "No se pudo obtener la ubicacion.";
    alert("No se pudo obtener la ubicacion. Revisa permisos de ubicacion del navegador.");
  }, {
    enableHighAccuracy: true,
    timeout: 12000,
    maximumAge: 0
  });
}

function findHorseFromInput() {
  showHorseResult(findHorseByQuery($("#horseSearch").value));
}

function startHorseVoiceSearch() {
  const Recognition = speechRecognitionConstructor();
  if (!Recognition) {
    alert("Tu navegador no permite busqueda por voz aqui. Prueba con Chrome o Edge.");
    return;
  }
  if (activeRecognition) activeRecognition.stop();
  const recognition = new Recognition();
  activeRecognition = recognition;
  recognition.lang = "es-ES";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.addEventListener("result", (event) => {
    const text = Array.from(event.results).map((result) => result[0]?.transcript || "").join(" ").trim();
    $("#horseSearch").value = text;
    showHorseResult(findHorseByQuery(text));
  });
  recognition.addEventListener("end", () => {
    if (activeRecognition === recognition) activeRecognition = null;
  });
  recognition.start();
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
    const schedule = getScheduleForDate(iso);
    const isToday = iso === todayISO();
    const notes = state.calendarNotes.filter((n) => n.date === iso);
    const hasWork = work.length > 0;
    const hasTasks = tasks.length > 0;
    const hasNotes = notes.length > 0;

    const scheduleTooltip = scheduleLabel(schedule) + ` (${scheduleTotalHours(schedule)} h previstas)`;
    const workTooltip = hasWork
      ? work.map((e) => `${e.dayType}: ${calculateWorkHours(e)} h`).join(" · ")
      : "";

    const scheduleIcon = `
      <button class="cal-icon-btn" data-cal-schedule="${iso}" title="${escapeHtml(scheduleTooltip)}" type="button">
        🕐
        <span class="cal-tooltip">${escapeHtml(scheduleTooltip)}</span>
      </button>`;

    const workIcon = hasWork ? `
      <button class="cal-icon-btn cal-icon-work" data-calendar-date="${iso}" title="${escapeHtml(workTooltip)}" type="button">
        ✅
        <span class="cal-tooltip">${escapeHtml(workTooltip)}</span>
      </button>` : "";

    const taskDots = hasTasks ? `<span class="cal-task-dot" title="${tasks.map((t) => escapeHtml(t.name)).join(", ")}">●</span>` : "";
    const notesDots = hasNotes ? notes.slice(0, 3).map((n) => `<span class="cal-note-pip cal-note-pip-${n.color}"></span>`).join("") : "";

    cells.push(`
      <div class="calendar-day ${isToday ? "today" : ""}" data-open-day="${iso}" style="cursor:pointer">
        <div class="cal-day-top">
          <span class="day-number">${day}</span>
          <div class="cal-icons">
            ${scheduleIcon}
            ${workIcon}
            ${taskDots}
          </div>
        </div>
        ${notesDots ? `<div class="cal-note-pips">${notesDots}</div>` : ""}
        ${tasks.map((task) => `<span class="calendar-event task">${escapeHtml(task.name)}</span>`).join("")}
        ${notes.map((n) => `<span class="calendar-event cal-note-event cal-note-event-${n.color}">${escapeHtml(n.text)}</span>`).join("")}
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
  $("#workDate").value = todayISO();
  $("#expectedHours").value = scheduleExpectedHours(todayISO()) || STANDARD_DAY_HOURS;
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
  rememberNavigation();
  switchView("jornada", false);
  switchWorkSection("registro", false);
  $("#workId").value = entry.id;
  $("#workDate").value = entry.date;
  $("#workDayType").value = entry.dayType;
  $("#workStart").value = entry.startTime;
  $("#workEnd").value = entry.endTime;
  $("#workBreaks").value = entry.breakMinutes;
  $("#expectedHours").value = entry.expectedHours;
  $("#workNotes").value = entry.notes;
  $("#manualDate").value = entry.date;
  loadManualSegmentsForDate(entry.date);
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
  state.horses = [];
  state.clock = { date: todayISO(), isRunning: false, segments: [] };
  render();
}

function createBackup() {
  return {
    app: "Finca Planner",
    version: 1,
    exportedAt: new Date().toISOString(),
    data: {
      workEntries: state.workEntries.map(normalizeWorkEntry),
      tasks: state.tasks.map(normalizeTask),
      horses: state.horses.map(normalizeHorse),
      clock: normalizeClock(state.clock),
      theme: normalizeTheme(state.theme)
    }
  };
}

function exportData() {
  const backup = createBackup();
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `finca-planner-copia-${todayISO()}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function readBackupData(parsed) {
  if (!parsed || typeof parsed !== "object") return null;
  if (parsed.app === "Finca Planner" && parsed.version === 1 && parsed.data) return parsed.data;
  if (Array.isArray(parsed.workEntries) && Array.isArray(parsed.tasks)) return parsed;
  return null;
}

function normalizeImportedData(data) {
  if (!data || !Array.isArray(data.workEntries) || !Array.isArray(data.tasks)) return null;
  return {
    workEntries: data.workEntries.map(normalizeWorkEntry).filter((entry) => entry.id && entry.date),
    tasks: data.tasks.map(normalizeTask).filter((task) => task.id && task.name && task.date),
    horses: Array.isArray(data.horses) ? data.horses.map(normalizeHorse).filter((horse) => horse.id && (horse.number || horse.name)) : [],
    clock: normalizeClock(data.clock),
    theme: normalizeTheme(data.theme)
  };
}

function normalizeWorkEntry(entry) {
  const source = entry && typeof entry === "object" ? entry : {};
  return {
    id: String(source.id || uid()),
    date: String(source.date || todayISO()),
    dayType: String(source.dayType || "trabajado"),
    startTime: String(source.startTime || ""),
    endTime: String(source.endTime || ""),
    breakMinutes: Number(source.breakMinutes) || 0,
    expectedHours: Number(source.expectedHours) || scheduleExpectedHours(source.date || todayISO()) || STANDARD_DAY_HOURS,
    notes: String(source.notes || ""),
    generatedByClock: Boolean(source.generatedByClock),
    segments: Array.isArray(source.segments) ? source.segments.map(normalizeSegment).filter(Boolean) : [],
    updatedAt: String(source.updatedAt || new Date().toISOString())
  };
}

function normalizeTask(task) {
  const source = task && typeof task === "object" ? task : {};
  return {
    id: String(source.id || uid()),
    name: String(source.name || ""),
    date: String(source.date || todayISO()),
    time: String(source.time || ""),
    duration: Number(source.duration) || 0,
    status: String(source.status || "pendiente"),
    priority: String(source.priority || "media"),
    notes: String(source.notes || ""),
    updatedAt: String(source.updatedAt || new Date().toISOString())
  };
}

function normalizeHorse(horse) {
  const source = horse && typeof horse === "object" ? horse : {};
  const lat = source.lat === "" || source.lat === null || source.lat === undefined ? null : Number(source.lat);
  const lng = source.lng === "" || source.lng === null || source.lng === undefined ? null : Number(source.lng);
  const paddockLat = source.paddockLat === "" || source.paddockLat === null || source.paddockLat === undefined ? null : Number(source.paddockLat);
  const paddockLng = source.paddockLng === "" || source.paddockLng === null || source.paddockLng === undefined ? null : Number(source.paddockLng);
  return {
    id: String(source.id || uid()),
    number: String(source.number || ""),
    name: String(source.name || ""),
    stable: String(source.stable || ""),
    paddock: String(source.paddock || ""),
    lat,
    lng,
    paddockLat,
    paddockLng,
    photo: String(source.photo || ""),
    notes: String(source.notes || ""),
    feedMorning: String(source.feedMorning || ""),
    feedNoon: String(source.feedNoon || ""),
    feedEvening: String(source.feedEvening || ""),
    updatedAt: String(source.updatedAt || new Date().toISOString())
  };
}

function normalizeSegment(segment) {
  if (!segment || typeof segment !== "object" || !segment.start) return null;
  const start = new Date(segment.start);
  const end = segment.end ? new Date(segment.end) : null;
  if (Number.isNaN(start.getTime())) return null;
  if (end && Number.isNaN(end.getTime())) return null;
  return {
    start: start.toISOString(),
    end: end ? end.toISOString() : null
  };
}

function normalizeClock(clock) {
  const source = clock && typeof clock === "object" ? clock : {};
  const segments = Array.isArray(source.segments) ? source.segments.map(normalizeSegment).filter(Boolean) : [];
  return {
    date: String(source.date || todayISO()),
    isRunning: Boolean(source.isRunning && segments.some((segment) => !segment.end)),
    segments
  };
}

function normalizeTheme(theme) {
  const source = theme && typeof theme === "object" ? theme : {};
  return {
    mode: source.mode === "dark" ? "dark" : "light"
  };
}

function importData(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const parsed = JSON.parse(String(reader.result || "{}"));
      const data = normalizeImportedData(readBackupData(parsed));

      if (!data) {
        alert("El archivo no parece una copia valida de Finca Planner.");
        return;
      }

      if (!confirm("Importar esta copia sustituira los datos actuales guardados en este navegador. Continuar?")) return;

      state.workEntries = data.workEntries;
      state.tasks = data.tasks;
      state.horses = data.horses;
      state.clock = data.clock;
      state.theme = data.theme;

      saveTheme();
      applyTheme();
      loadManualSegmentsForDate($("#manualDate").value || todayISO());
      render();
      alert("Copia importada correctamente.");
    } catch {
      alert("No se ha podido leer el archivo. Comprueba que sea una copia JSON valida.");
    } finally {
      event.target.value = "";
    }
  });
  reader.readAsText(file);
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

function setupVoiceInputs() {
  const fields = ["#workNotes", "#taskName", "#taskNotes"];
  fields.forEach((selector) => {
    const field = $(selector);
    if (!field || field.closest(".voice-control")) return;

    const wrapper = document.createElement("div");
    wrapper.className = "voice-control";
    field.parentNode.insertBefore(wrapper, field);
    wrapper.appendChild(field);

    const button = document.createElement("button");
    button.className = "voice-button";
    button.type = "button";
    button.title = "Dictar texto";
    button.setAttribute("aria-label", "Dictar texto");
    button.innerHTML = microphoneIcon();
    wrapper.appendChild(button);

    button.addEventListener("click", () => startDictation(field, button));
  });
  updateVoiceAvailability();
}

function microphoneIcon() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z"></path>
      <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
      <path d="M12 19v3"></path>
      <path d="M8 22h8"></path>
    </svg>
  `;
}

function speechRecognitionConstructor() {
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function updateVoiceAvailability() {
  const supported = Boolean(speechRecognitionConstructor());
  $$(".voice-button").forEach((button) => {
    button.disabled = !supported;
    button.title = supported ? "Dictar texto" : "Dictado no disponible en este navegador";
  });
}

function startDictation(field, button) {
  const Recognition = speechRecognitionConstructor();
  if (!Recognition) {
    alert("Tu navegador no permite dictado por voz aqui. Prueba con Chrome o Edge.");
    return;
  }

  if (activeRecognition) {
    activeRecognition.stop();
    activeRecognition = null;
  }

  const recognition = new Recognition();
  activeRecognition = recognition;
  recognition.lang = "es-ES";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.addEventListener("start", () => {
    button.classList.add("listening");
  });

  recognition.addEventListener("result", (event) => {
    const text = Array.from(event.results)
      .map((result) => result[0]?.transcript || "")
      .join(" ")
      .trim();
    if (text) insertDictatedText(field, text);
  });

  recognition.addEventListener("end", () => {
    button.classList.remove("listening");
    if (activeRecognition === recognition) activeRecognition = null;
  });

  recognition.addEventListener("error", () => {
    button.classList.remove("listening");
    if (activeRecognition === recognition) activeRecognition = null;
  });

  recognition.start();
}

function insertDictatedText(field, text) {
  const current = field.value.trim();
  const separator = current ? " " : "";
  field.value = `${current}${separator}${text}`;
  field.dispatchEvent(new Event("input", { bubbles: true }));
  field.focus();
}

function bindEvents() {
  $$(".nav-link").forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.view));
  });
  $$(".section-tab").forEach((button) => {
    if (button.dataset.workSection) button.addEventListener("click", () => switchWorkSection(button.dataset.workSection));
    if (button.dataset.horseSection) button.addEventListener("click", () => switchHorseSection(button.dataset.horseSection));
  });

  $("#workForm").addEventListener("submit", saveWork);
  $("#taskForm").addEventListener("submit", saveTask);
  $("#horseForm").addEventListener("submit", saveHorse);
  $("#resetWorkBtn").addEventListener("click", resetWorkForm);
  $("#resetTaskBtn").addEventListener("click", resetTaskForm);
  $("#resetHorseBtn").addEventListener("click", resetHorseForm);
  $("#findHorseBtn").addEventListener("click", findHorseFromInput);
  $("#voiceHorseBtn").addEventListener("click", startHorseVoiceSearch);
  $("#horsePhotoInput").addEventListener("change", handleHorsePhoto);
  $("#useStableLocationBtn").addEventListener("click", () => useCurrentLocationForHorse("stable"));
  $("#usePaddockLocationBtn").addEventListener("click", () => useCurrentLocationForHorse("paddock"));
  $("#horseName").addEventListener("input", updateHorseFormTitle);
  $("#horseNumber").addEventListener("input", updateHorseFormTitle);
  $("#taskFilter").addEventListener("change", renderTasks);
  $("#manualDate").addEventListener("change", () => loadManualSegmentsForDate($("#manualDate").value));
  $("#addSegmentBtn").addEventListener("click", addManualSegment);
  $("#loadScheduleBtn").addEventListener("click", loadScheduleIntoManualEditor);
  $("#saveManualSegmentsBtn").addEventListener("click", saveManualSegments);
  $("#calNoteForm").addEventListener("submit", saveCalendarNote);
  $("#calModalClose").addEventListener("click", closeCalendarDayModal);
  $("#calendarDayModal").addEventListener("click", (e) => { if (e.target === e.currentTarget) closeCalendarDayModal(); });

  $("#lightboxClose").addEventListener("click", closeLightbox);
  $("#photoLightbox").addEventListener("click", (e) => { if (e.target === e.currentTarget || e.target === $("#lightboxImg")) closeLightbox(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeLightbox(); });

  $("#horseBrowserBack").addEventListener("click", () => {
    document.querySelector(".horse-browser")?.classList.remove("has-detail");
    state.selectedHorseId = null;
    renderHorseList();
  });

  $("#exportDataBtn").addEventListener("click", exportData);
  $("#importDataInput").addEventListener("change", importData);
  $("#showAllWorkEntriesBtn").addEventListener("click", showAllWorkEntries);
  $("#backBtn").addEventListener("click", goBack);
  $("#workDate").addEventListener("change", () => {
    $("#expectedHours").value = scheduleExpectedHours($("#workDate").value) || STANDARD_DAY_HOURS;
  });
  $("#clearDataBtn").addEventListener("click", clearData);
  $("#clockToggleBtn").addEventListener("click", toggleClock);
  $("#clockEditBtn").addEventListener("click", openTodayCorrection);
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
    const lightboxTrigger = event.target.closest("[data-lightbox]");
    const shareHorseButton = event.target.closest("[data-share-horse]");
    const openHorseListButton = event.target.closest("[data-open-horse-list]");
    const browseHorseRow = event.target.closest("[data-browse-horse]");
    const findHorseButton = event.target.closest("[data-find-horse]");
    const editHorseButton = event.target.closest("[data-edit-horse]");
    const deleteHorseButton = event.target.closest("[data-delete-horse]");
    const openHorseButton = event.target.closest("[data-open-horse]");
    const completeHorseNoteButton = event.target.closest("[data-complete-horse-note]");
    const removeSegmentButton = event.target.closest("[data-remove-segment]");
    const calendarDay = event.target.closest("[data-calendar-date]");

    if (editWorkButton) editWork(editWorkButton.dataset.editWork);
    if (deleteWorkButton) deleteWork(deleteWorkButton.dataset.deleteWork);
    if (editTaskButton) editTask(editTaskButton.dataset.editTask);
    if (deleteTaskButton) deleteTask(deleteTaskButton.dataset.deleteTask);
    if (lightboxTrigger) openLightbox(lightboxTrigger.dataset.lightbox);
    if (shareHorseButton) shareHorse(shareHorseButton.dataset.shareHorse);
    if (openHorseListButton) {
      switchHorseSection("listado");
      showHorseDetail(openHorseListButton.dataset.openHorseList);
    }
    if (browseHorseRow) showHorseDetail(browseHorseRow.dataset.browseHorse);
    if (findHorseButton) showHorseResult(state.horses.find((horse) => horse.id === findHorseButton.dataset.findHorse));
    if (editHorseButton) editHorse(editHorseButton.dataset.editHorse);
    if (deleteHorseButton) deleteHorse(deleteHorseButton.dataset.deleteHorse);
    if (openHorseButton) openHorseFromObservation(openHorseButton.dataset.openHorse);
    if (completeHorseNoteButton) completeHorseObservation(completeHorseNoteButton.dataset.completeHorseNote);
    if (removeSegmentButton) removeManualSegment(Number(removeSegmentButton.dataset.removeSegment));
    const calScheduleBtn = event.target.closest("[data-cal-schedule]");
    const openDayBtn = event.target.closest("[data-open-day]");
    const deleteNoteBtn = event.target.closest("[data-delete-note]");
    if (calScheduleBtn) { event.stopPropagation(); }
    if (deleteNoteBtn) { event.stopPropagation(); deleteCalendarNote(deleteNoteBtn.dataset.deleteNote); }
    if (openDayBtn && !calScheduleBtn && !deleteNoteBtn) openCalendarDayModal(openDayBtn.dataset.openDay);
    if (calendarDay && !calScheduleBtn && !openDayBtn) openWorkDate(calendarDay.dataset.calendarDate);
  });

  document.body.addEventListener("input", (event) => {
    if (event.target.id === "horseListSearch") renderHorseList();
    const startInput = event.target.closest("[data-manual-start]");
    const endInput = event.target.closest("[data-manual-end]");
    if (startInput) updateManualSegment(Number(startInput.dataset.manualStart), "start", startInput.value);
    if (endInput) updateManualSegment(Number(endInput.dataset.manualEnd), "end", endInput.value);
  });
}

function init() {
  $("#todayLabel").textContent = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
  loadTheme();
  loadData();
  setDefaultDates();
  setupVoiceInputs();
  bindEvents();
  loadManualSegmentsForDate(todayISO());
  applyTheme();
  render();
  updateBackButton();
  clockInterval = setInterval(renderClock, 1000);
}

init();
