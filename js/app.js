import {
  auth, db, provider, signInWithPopup, signOut, onAuthStateChanged,
  doc, setDoc, getDoc, collection, getDocs, deleteDoc
} from "./firebase.js";

const CLOUDINARY_CLOUD = "dozjsexgz";
const CLOUDINARY_PRESET = "Hipica_photos";

function dataUrlToBlob(dataUrl) {
  const [header, data] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)[1];
  const binary = atob(data);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

function cloudinaryUrl(horseId) {
  return `https://res.cloudinary.com/${CLOUDINARY_CLOUD}/image/upload/hipica_horse_${horseId}`;
}

async function uploadHorsePhotoCloudinary(horseId, dataUrl) {
  const blob = dataUrlToBlob(dataUrl);
  const formData = new FormData();
  formData.append("file", blob, `${horseId}.jpg`);
  formData.append("upload_preset", CLOUDINARY_PRESET);
  formData.append("public_id", `hipica_horse_${horseId}`);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, {
    method: "POST",
    body: formData
  });
  const json = await res.json();
  if (!res.ok || json.error) {
    const msg = json.error?.message || ("HTTP " + res.status);
    console.error("Cloudinary error:", msg, json);
    throw new Error(msg);
  }
  return json.secure_url;
}

async function recoverCloudinaryPhotos(user) {
  const horsesWithoutPhoto = state.horses.filter((h) => !h.photo);
  if (horsesWithoutPhoto.length === 0) return;

  // Assign deterministic Cloudinary URLs and let the img tag handle 404s silently
  for (const horse of horsesWithoutPhoto) {
    const idx = state.horses.findIndex((h) => h.id === horse.id);
    if (idx !== -1) state.horses[idx] = { ...state.horses[idx], photo: cloudinaryUrl(horse.id) };
  }

  try {
    persistLocalSnapshot();
    await setDoc(doc(db, "users", user.uid, "data", "main"), buildCloudPayload());
  } catch (e) {
    console.warn("Error guardando fotos recuperadas:", e);
  }
  render();
}

const STORAGE_KEY = "fincaPlanner.v1";
const THEME_KEY = "fincaPlanner.theme";
const STANDARD_DAY_HOURS = 7;
const APP_SETTINGS_DOC = ["appSettings", "main"];
const USER_PROFILES_COLLECTION = "userProfiles";
const SHARED_HORSES_COLLECTION = "sharedHorses";
const DEFAULT_THEME = {
  mode: "light",
  preset: "hipica",
  primary: "#245f48",
  accent: "#a66f3f",
  glass: 0.82,
  bgStrength: 100
};
const THEME_PRESETS = {
  hipica: {
    primary: "#245f48",
    accent: "#a66f3f",
    glass: 0.82,
    bgStrength: 100
  },
  bosque: {
    primary: "#2f6f57",
    accent: "#8f6a3d",
    glass: 0.78,
    bgStrength: 85
  },
  arena: {
    primary: "#6d5b3b",
    accent: "#c5853f",
    glass: 0.8,
    bgStrength: 92
  },
  noche: {
    primary: "#6ba88a",
    accent: "#d3a56d",
    glass: 0.74,
    bgStrength: 70
  },
  oceano: {
    primary: "#1a6b8a",
    accent: "#2ea8c4",
    glass: 0.80,
    bgStrength: 90
  },
  atardecer: {
    primary: "#c2491a",
    accent: "#e88a2c",
    glass: 0.82,
    bgStrength: 95
  },
  lavanda: {
    primary: "#6b4fa8",
    accent: "#a87fc2",
    glass: 0.80,
    bgStrength: 88
  },
  carbono: {
    primary: "#4a4a4a",
    accent: "#888888",
    glass: 0.72,
    bgStrength: 60
  }
};
const WEEKLY_SCHEDULE = [
  { day: 1, label: "Lunes", shifts: [{ start: "07:00", end: "13:30" }, { start: "19:00", end: "21:00" }] },
  { day: 2, label: "Martes", shifts: [{ start: "08:00", end: "13:00" }] },
  { day: 3, label: "Miercoles", shifts: [{ start: "08:00", end: "13:00" }, { start: "19:00", end: "21:00" }] },
  { day: 4, label: "Jueves", shifts: [{ start: "08:00", end: "13:00" }] },
  { day: 5, label: "Viernes", shifts: [{ start: "08:00", end: "13:00" }, { start: "19:00", end: "21:00" }] },
  { day: 6, label: "Sabado", shifts: [{ start: "07:00", end: "13:30" }, { start: "19:00", end: "21:00" }] },
  { day: 0, label: "Domingo", shifts: [] }
];
const DEFAULT_GAMES = {
  flappyHorse: {
    bestScore: 0,
    lastScore: 0,
    selectedColor: "castano",
    speedFactor: 1
  },
  pixelRunner: {
    bestScore: 0,
    lastScore: 0,
    selectedHorse: "horse-caramelo"
  }
};
const state = {
  workEntries: [],
  tasks: [],
  horses: [],
  sharedHorses: [],
  calendarNotes: [],
  generalNotes: [],
  trash: [],
  adminProfiles: [],
  appSettings: {
    primaryAdminUid: "",
    primaryAdminEmail: ""
  },
  isAdmin: false,
  currentObsTab: "pendientes",
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
  games: normalizeGamesData(),
  theme: {
    ...DEFAULT_THEME
  }
};

let charts = {};
let clockInterval = null;
let navigationStack = [];
let isRestoringNavigation = false;
let activeRecognition = null;
let currentSessionStartedAt = null;
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function currentUser() {
  return auth.currentUser || null;
}

function isPrimaryAdmin(user = currentUser()) {
  if (!user) return false;
  if (state.appSettings.primaryAdminUid && user.uid === state.appSettings.primaryAdminUid) return true;
  if (state.appSettings.primaryAdminEmail && user.email === state.appSettings.primaryAdminEmail) return true;
  return false;
}

function sharedHorseDocId(ownerUid, horseId) {
  return `${ownerUid}__${horseId}`;
}

function totalWorkedHours(entries = []) {
  return roundHours(entries.reduce((sum, entry) => sum + calculateWorkHours(entry), 0));
}

function minutesSince(isoString) {
  if (!isoString) return 0;
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return 0;
  return Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
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

function buttonIcon(name) {
  return `<span class="button-icon icon-slot" data-icon="${name}" aria-hidden="true"></span>`;
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

function sanitizeHorseForCloud(horse) {
  const normalized = normalizeHorse(horse);
  // Keep Storage URLs, strip Base64 (too large for Firestore)
  const photo = normalized.photo && normalized.photo.startsWith("https://") ? normalized.photo : "";
  return { ...normalized, photo };
}

function buildCloudPayload() {
  return {
    workEntries: state.workEntries.map(normalizeWorkEntry),
    tasks: state.tasks.map(normalizeTask),
    horses: state.horses.map(sanitizeHorseForCloud),
    calendarNotes: state.calendarNotes,
    generalNotes: state.generalNotes,
    trash: state.trash,
    clock: normalizeClock(state.clock),
    games: normalizeGamesData(state.games),
    theme: normalizeTheme(state.theme)
  };
}

function buildPersistentPayload() {
  return {
    workEntries: state.workEntries,
    tasks: state.tasks,
    horses: state.horses,
    calendarNotes: state.calendarNotes,
    generalNotes: state.generalNotes,
    trash: state.trash,
    clock: state.clock,
    games: normalizeGamesData(state.games)
  };
}

function persistLocalSnapshot() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(buildPersistentPayload()));
  } catch (error) {
    console.warn("No se pudo actualizar la copia local:", error);
  }
}

function saveData() {
  const payload = buildPersistentPayload();
  try {
    const existingLocalData = readLegacyLocalData();
    if (dataHasContent(payload) || !existingLocalData) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    }
  } catch (error) {
    console.warn("No se pudo guardar la copia local:", error);
  }
  syncToFirestore(buildCloudPayload());
  queueRemoteMetadataSync();
}

let _syncTimeout = null;
let _remoteMetadataTimeout = null;
function syncToFirestore(payload) {
  const user = currentUser();
  if (!user) return;
  clearTimeout(_syncTimeout);
  _syncTimeout = setTimeout(async () => {
    try {
      await setDoc(doc(db, "users", user.uid, "data", "main"), payload);
    } catch (e) {
      console.warn("Error al sincronizar con Firebase:", e);
    }
  }, 1500);
}

async function syncOptionalRemoteData() {
  try {
    await syncSharedHorses();
  } catch (error) {
    console.warn("No se pudieron sincronizar las fichas compartidas:", error);
  }

  try {
    await syncUserProfile();
  } catch (error) {
    console.warn("No se pudo sincronizar el perfil del usuario:", error);
  }

  if (state.isAdmin) {
    try {
      await loadAdminProfiles();
    } catch (error) {
      console.warn("No se pudo refrescar el panel de administracion:", error);
    }
  }
}

function queueRemoteMetadataSync() {
  const user = currentUser();
  if (!user) return;
  clearTimeout(_remoteMetadataTimeout);
  _remoteMetadataTimeout = setTimeout(async () => {
    await syncOptionalRemoteData();
  }, 1800);
}

async function loadAppSettings() {
  try {
    const snap = await getDoc(doc(db, ...APP_SETTINGS_DOC));
    if (!snap.exists()) {
      state.appSettings = { primaryAdminUid: "", primaryAdminEmail: "" };
      return;
    }
    const data = snap.data() || {};
    state.appSettings = {
      primaryAdminUid: String(data.primaryAdminUid || ""),
      primaryAdminEmail: String(data.primaryAdminEmail || "")
    };
  } catch (error) {
    console.warn("No se pudo cargar la configuracion general:", error);
  }
}

async function claimPrimaryAdmin(user = currentUser()) {
  if (!user) return;
  const settings = {
    primaryAdminUid: user.uid,
    primaryAdminEmail: user.email || ""
  };
  await setDoc(doc(db, ...APP_SETTINGS_DOC), settings);
  state.appSettings = settings;
  state.isAdmin = true;
  updateAdminAccess();
}

async function syncUserProfile() {
  const user = currentUser();
  if (!user) return;
  try {
    await setDoc(doc(db, USER_PROFILES_COLLECTION, user.uid), {
      uid: user.uid,
      email: user.email || "",
      displayName: user.displayName || "",
      photoURL: user.photoURL || "",
      horseCount: state.horses.length,
      sharedHorseCount: state.horses.filter((horse) => horse.shared).length,
      workEntryCount: state.workEntries.length,
      taskCount: state.tasks.length,
      totalWorkedHours: totalWorkedHours(state.workEntries),
      sessionStartedAt: currentSessionStartedAt || new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      lastSyncAt: new Date().toISOString()
    }, { merge: true });
  } catch (error) {
    console.warn("No se pudo actualizar el perfil del usuario:", error);
  }
}

async function loadAdminProfiles() {
  if (!state.isAdmin) {
    state.adminProfiles = [];
    return;
  }
  try {
    const snapshot = await getDocs(collection(db, USER_PROFILES_COLLECTION));
    state.adminProfiles = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
      .sort((a, b) => String(a.displayName || a.email || "").localeCompare(String(b.displayName || b.email || ""), "es"));
  } catch (error) {
    console.warn("No se pudieron cargar los perfiles de usuario:", error);
  }
}

async function syncSharedHorses() {
  const user = currentUser();
  if (!user) return;
  const ownSharedIds = new Set();
  try {
    for (const horse of state.horses) {
      const sharedId = sharedHorseDocId(user.uid, horse.id);
      if (horse.shared) {
        ownSharedIds.add(sharedId);
        await setDoc(doc(db, SHARED_HORSES_COLLECTION, sharedId), {
          ...normalizeHorse(horse),
          id: sharedId,
          originalHorseId: horse.id,
          ownerUid: user.uid,
          ownerEmail: user.email || "",
          ownerName: user.displayName || user.email || "Usuario",
          shared: true,
          sharedUpdatedAt: new Date().toISOString()
        });
      }
    }

    const existing = await getDocs(collection(db, SHARED_HORSES_COLLECTION));
    const deletions = existing.docs
      .filter((docSnap) => (docSnap.data()?.ownerUid || "") === user.uid && !ownSharedIds.has(docSnap.id))
      .map((docSnap) => deleteDoc(doc(db, SHARED_HORSES_COLLECTION, docSnap.id)));
    await Promise.all(deletions);
  } catch (error) {
    console.warn("No se pudieron sincronizar las fichas compartidas:", error);
  }
}

async function loadSharedHorses() {
  try {
    const snapshot = await getDocs(collection(db, SHARED_HORSES_COLLECTION));
    const user = currentUser();
    state.sharedHorses = snapshot.docs
      .map((docSnap) => normalizeHorse({ ...docSnap.data(), id: docSnap.id, shared: true }))
      .filter((horse) => horse.ownerUid && horse.ownerUid !== user?.uid);
  } catch (error) {
    state.sharedHorses = [];
    console.warn("No se pudieron cargar las fichas compartidas:", error);
  }
}

function visibleHorses() {
  return [...state.horses, ...state.sharedHorses];
}

function updateAdminAccess() {
  state.isAdmin = isPrimaryAdmin();
  const adminBtn = $("#adminBtn");
  if (adminBtn) adminBtn.style.display = state.isAdmin ? "" : "none";
}

function loadData() {
  state.workEntries = [];
  state.tasks = [];
  state.horses = [];
  state.sharedHorses = [];
  state.calendarNotes = [];
  state.generalNotes = [];
  state.trash = [];
  state.games = normalizeGamesData();
  state.clock = {
    date: todayISO(),
    isRunning: false,
    segments: []
  };
}

function loadTheme() {
  const raw = localStorage.getItem(THEME_KEY);
  if (!raw) {
    state.theme = { ...DEFAULT_THEME };
    return;
  }
  try {
    const theme = JSON.parse(raw);
    state.theme = normalizeTheme(theme);
  } catch {
    state.theme = { ...DEFAULT_THEME };
  }
}

function saveTheme() {
  localStorage.setItem(THEME_KEY, JSON.stringify(state.theme));
}

function normalizeTheme(theme) {
  const source = theme && typeof theme === "object" ? theme : {};
  const preset = THEME_PRESETS[source.preset] ? source.preset : DEFAULT_THEME.preset;
  return {
    mode: source.mode === "dark" ? "dark" : "light",
    preset,
    primary: normalizeHexColor(source.primary, THEME_PRESETS[preset].primary),
    accent: normalizeHexColor(source.accent, THEME_PRESETS[preset].accent),
    glass: clampNumber(source.glass, 0.45, 0.95, THEME_PRESETS[preset].glass),
    bgStrength: clampNumber(source.bgStrength, 0, 100, THEME_PRESETS[preset].bgStrength)
  };
}

function normalizeGamesData(games) {
  const source = games && typeof games === "object" ? games : {};
  const flappyHorse = source.flappyHorse && typeof source.flappyHorse === "object" ? source.flappyHorse : {};
  const validFlappyColors = ["castano","negro","blanco","alazan","gris","palomino","pinto","appaloosa","isabela","tordo","moro","rosillo"];
  const legacyBirdMap = {
    "bird-tropical": "castano",
    "bird-pirata": "negro",
    "bird-nube": "blanco",
    "bird-fuego": "alazan",
    "bird-cielo": "gris"
  };
  let selectedColor = flappyHorse.selectedColor;
  if (legacyBirdMap[selectedColor]) selectedColor = legacyBirdMap[selectedColor];
  if (!validFlappyColors.includes(selectedColor)) selectedColor = DEFAULT_GAMES.flappyHorse.selectedColor;
  return {
    flappyHorse: {
      bestScore: Math.max(0, Number(flappyHorse.bestScore) || 0),
      lastScore: Math.max(0, Number(flappyHorse.lastScore) || 0),
      selectedColor,
      speedFactor: Math.min(1.7, Math.max(0.7, Number(flappyHorse.speedFactor) || 1))
    },
    pixelRunner: {
      bestScore: Math.max(0, Number(source.pixelRunner?.bestScore) || 0),
      lastScore: Math.max(0, Number(source.pixelRunner?.lastScore) || 0),
      selectedHorse: window.GAME_CHARACTERS?.horses?.some((horse) => horse.id === source.pixelRunner?.selectedHorse)
        ? source.pixelRunner.selectedHorse
        : DEFAULT_GAMES.pixelRunner.selectedHorse
    }
  };
}

function normalizeHexColor(value, fallback) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed : fallback;
}

function clampNumber(value, min, max, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
}

function hexToRgb(hex) {
  const clean = normalizeHexColor(hex, "#000000").slice(1);
  return {
    r: Number.parseInt(clean.slice(0, 2), 16),
    g: Number.parseInt(clean.slice(2, 4), 16),
    b: Number.parseInt(clean.slice(4, 6), 16)
  };
}

function rgbToHex({ r, g, b }) {
  return `#${[r, g, b].map((value) => Math.round(value).toString(16).padStart(2, "0")).join("")}`;
}

function mixHex(colorA, colorB, ratio = 0.5) {
  const a = hexToRgb(colorA);
  const b = hexToRgb(colorB);
  const weight = Math.min(1, Math.max(0, ratio));
  return rgbToHex({
    r: a.r + (b.r - a.r) * weight,
    g: a.g + (b.g - a.g) * weight,
    b: a.b + (b.b - a.b) * weight
  });
}

function rgbaFromHex(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function buildThemeBackground(theme) {
  const primaryGlow = theme.mode === "dark" ? rgbaFromHex(theme.primary, 0.16 + (theme.bgStrength / 100) * 0.12) : rgbaFromHex(theme.primary, 0.12 + (theme.bgStrength / 100) * 0.1);
  const accentGlow = theme.mode === "dark" ? rgbaFromHex(theme.accent, 0.12 + (theme.bgStrength / 100) * 0.1) : rgbaFromHex(theme.accent, 0.14 + (theme.bgStrength / 100) * 0.08);
  const baseA = theme.mode === "dark" ? mixHex("#0e1411", theme.primary, 0.12) : mixHex("#f8faf4", theme.primary, 0.08);
  const baseB = theme.mode === "dark" ? mixHex("#17241e", theme.primary, 0.18) : mixHex("#e7eee7", theme.primary, 0.11);
  const baseC = theme.mode === "dark" ? mixHex("#241b15", theme.accent, 0.14) : mixHex("#f5eee3", theme.accent, 0.14);
  return `
    radial-gradient(circle at 12% 8%, ${primaryGlow}, transparent 28rem),
    radial-gradient(circle at 86% 12%, ${accentGlow}, transparent 30rem),
    linear-gradient(135deg, ${baseA} 0%, ${baseB} 48%, ${baseC} 100%)
  `.trim();
}

function syncAppearanceControls() {
  const primaryInput = $("#themePrimaryInput");
  const accentInput = $("#themeAccentInput");
  const glassInput = $("#themeGlassInput");
  const bgStrengthInput = $("#themeBgStrengthInput");
  if (primaryInput) primaryInput.value = state.theme.primary;
  if (accentInput) accentInput.value = state.theme.accent;
  if (glassInput) glassInput.value = String(state.theme.glass);
  if (bgStrengthInput) bgStrengthInput.value = String(state.theme.bgStrength);
  $$("[data-preset]").forEach((button) => {
    button.classList.toggle("active", button.dataset.preset === state.theme.preset);
  });
}

function applyTheme() {
  document.body.dataset.mode = state.theme.mode;
  const modeButton = $("#modeToggleBtn");
  const modeIcon = $("#modeIcon");
  const isDark = state.theme.mode === "dark";
  const rootStyle = document.body.style;
  const glass = state.theme.glass;
  const strongGlass = Math.min(0.96, glass + 0.08);
  const softGlass = Math.max(0.08, glass - (isDark ? 0.58 : 0.28));
  const lineColor = isDark ? rgbaFromHex("#f3efe3", 0.14) : rgbaFromHex("#273a30", 0.14);
  const mutedColor = isDark ? mixHex("#adb9af", state.theme.primary, 0.18) : mixHex("#647269", state.theme.primary, 0.12);
  const sandColor = mixHex("#d7c4a5", state.theme.accent, 0.24);
  const primaryDark = isDark ? mixHex("#ffffff", state.theme.primary, 0.32) : mixHex("#0f211a", state.theme.primary, 0.4);
  const chartC = mixHex("#607f87", state.theme.primary, 0.35);
  const chartD = mixHex("#8d7959", state.theme.accent, 0.32);

  if (modeButton) {
    const label = isDark ? "Activar modo claro" : "Activar modo oscuro";
    modeButton.setAttribute("title", label);
    modeButton.setAttribute("aria-label", label);
  }

  if (modeIcon) {
    modeIcon.innerHTML = isDark
      ? '<path d="M12 3a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0V4a1 1 0 0 1 1-1Zm0 14a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0v-1a1 1 0 0 1 1-1Zm9-5a1 1 0 0 1-1 1h-1a1 1 0 1 1 0-2h1a1 1 0 0 1 1 1ZM6 12a1 1 0 0 1-1 1H4a1 1 0 1 1 0-2h1a1 1 0 0 1 1 1Zm11.657-6.243a1 1 0 0 1 0 1.414l-.707.707a1 1 0 1 1-1.414-1.414l.707-.707a1 1 0 0 1 1.414 0ZM8.464 14.95a1 1 0 0 1 0 1.414l-.707.707A1 1 0 0 1 6.343 15.657l.707-.707a1 1 0 0 1 1.414 0Zm8.486 1.414a1 1 0 0 1-1.414 0l-.707-.707a1 1 0 0 1 1.414-1.414l.707.707a1 1 0 0 1 0 1.414ZM8.464 9.05a1 1 0 0 1-1.414 0l-.707-.707A1 1 0 0 1 7.757 6.93l.707.707a1 1 0 0 1 0 1.414ZM12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z" fill="currentColor" stroke="none"/>'
      : '<path d="M21 12.79A9 9 0 1 1 11.21 3c0 .34.02.68.05 1.02A7 7 0 0 0 19.98 12c.34.03.68.05 1.02.05Z" fill="currentColor" stroke="none"/>';
  }

  rootStyle.setProperty("--primary", state.theme.primary);
  rootStyle.setProperty("--primary-dark", primaryDark);
  rootStyle.setProperty("--accent", state.theme.accent);
  rootStyle.setProperty("--accent-soft", rgbaFromHex(state.theme.accent, isDark ? 0.2 : 0.16));
  rootStyle.setProperty("--glass", isDark ? rgbaFromHex("#18211c", glass) : rgbaFromHex("#ffffff", Math.max(0.45, glass - 0.14)));
  rootStyle.setProperty("--glass-strong", isDark ? rgbaFromHex("#1f2a24", strongGlass) : rgbaFromHex("#ffffff", strongGlass));
  rootStyle.setProperty("--glass-soft", isDark ? rgbaFromHex("#ffffff", softGlass) : rgbaFromHex("#ffffff", Math.max(0.18, softGlass)));
  rootStyle.setProperty("--line", lineColor);
  rootStyle.setProperty("--muted", mutedColor);
  rootStyle.setProperty("--sand", sandColor);
  rootStyle.setProperty("--chart-a", state.theme.primary);
  rootStyle.setProperty("--chart-b", state.theme.accent);
  rootStyle.setProperty("--chart-c", chartC);
  rootStyle.setProperty("--chart-d", chartD);
  rootStyle.setProperty("--bg-pattern", buildThemeBackground(state.theme));
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", state.theme.primary);
  syncAppearanceControls();
  saveTheme();
  renderStats();
}

function openAppearanceModal() {
  $("#appearanceModal")?.classList.add("open");
  syncAppearanceControls();
}

function closeAppearanceModal() {
  $("#appearanceModal")?.classList.remove("open");
}

function applyThemePreset(presetName) {
  const preset = THEME_PRESETS[presetName];
  if (!preset) return;
  state.theme = normalizeTheme({ ...state.theme, preset: presetName, ...preset });
  applyTheme();
}

function resetThemeCustomization() {
  const preset = state.theme.preset || DEFAULT_THEME.preset;
  state.theme = normalizeTheme({ ...DEFAULT_THEME, preset, ...THEME_PRESETS[preset], mode: state.theme.mode });
  applyTheme();
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
  renderGames();
  renderAdminPanel();
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
    juegos: "Juegos",
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
          <button class="small-button icon-text-button" data-edit-work="${entry.id}" type="button">${buttonIcon("edit")}Editar</button>
          <button class="small-button icon-text-button danger" data-delete-work="${entry.id}" type="button">${buttonIcon("trash")}Borrar</button>
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
        <button class="small-button icon-text-button" data-edit-task="${task.id}" type="button">${buttonIcon("edit")}Editar</button>
        <button class="small-button icon-text-button danger" data-delete-task="${task.id}" type="button">${buttonIcon("trash")}Borrar</button>
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

function renderGames() {
  renderGameRecords();
}

function renderGameRecords() {
  const games = normalizeGamesData(state.games);
  const fb = $("#flappyBestValue");
  const pb = $("#pixelRunnerBestValue");
  if (fb) fb.textContent = String(Math.floor(games.flappyHorse.bestScore || 0));
  if (pb) pb.textContent = String(Math.floor(games.pixelRunner.bestScore || 0));
}

function persistGames() {
  state.games = normalizeGamesData(state.games);
  saveData();
  renderGameRecords();
}

let gamesInitialized = false;
function initFlappyHorse() {
  if (gamesInitialized) return;
  gamesInitialized = true;

  $("#flappyStartBtn")?.addEventListener("click", () => openGameInFrame("flappy"));
  $("#pixelRunnerStartBtn")?.addEventListener("click", () => openGameInFrame("runner"));
  $("#gameFullscreenClose")?.addEventListener("click", closeGameFrame);
  window.addEventListener("message", handleGameMessage);
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && document.body.classList.contains("game-fullscreen-open")) {
      closeGameFrame();
    }
  });
  renderGameRecords();
}

function openGameInFrame(which) {
  const overlay = $("#gameFullscreenOverlay");
  const frame = $("#gameFrame");
  if (!overlay || !frame) return;
  const games = normalizeGamesData(state.games);
  if (which === "flappy") {
    const color = games.flappyHorse.selectedColor || "castano";
    frame.src = `games/flappy-horse-preview.html?horse=${encodeURIComponent(color)}`;
  } else {
    const horse = games.pixelRunner.selectedHorse;
    frame.src = `games/pixel-runner.html?horse=${encodeURIComponent(horse)}`;
  }
  overlay.classList.add("open");
  document.body.classList.add("game-fullscreen-open");
}

function closeGameFrame() {
  const overlay = $("#gameFullscreenOverlay");
  const frame = $("#gameFrame");
  if (!overlay) return;
  overlay.classList.remove("open");
  document.body.classList.remove("game-fullscreen-open");
  if (frame) frame.src = "about:blank";
}

function handleGameMessage(event) {
  if (event.origin !== window.location.origin) return;
  const data = event.data && typeof event.data === "object" ? event.data : {};
  if (!data.type) return;
  state.games = normalizeGamesData(state.games);

  if (data.type === "pixel-runner-character") {
    state.games.pixelRunner.selectedHorse = data.characterId;
    persistGames();
    return;
  }
  if (data.type === "pixel-runner-score") {
    const score = Math.max(0, Number(data.score) || 0);
    const best = Math.max(score, Number(data.best) || 0, state.games.pixelRunner.bestScore || 0);
    state.games.pixelRunner.lastScore = score;
    state.games.pixelRunner.bestScore = best;
    persistGames();
    return;
  }
  if (data.type === "flappy-horse-character") {
    state.games.flappyHorse.selectedColor = data.characterId;
    persistGames();
    return;
  }
  if (data.type === "flappy-horse-score") {
    const score = Math.max(0, Number(data.score) || 0);
    const best = Math.max(score, Number(data.best) || 0, state.games.flappyHorse.bestScore || 0);
    state.games.flappyHorse.lastScore = score;
    state.games.flappyHorse.bestScore = best;
    persistGames();
    return;
  }
  if (data.type === "game-close") {
    closeGameFrame();
  }
}


function renderAdminPanel() {
  const claimBtn = $("#claimAdminBtn");
  $("#adminOwnerLabel").textContent = state.appSettings.primaryAdminEmail || "Sin configurar";
  $("#adminUserCount").textContent = state.adminProfiles.length;
  $("#adminTotalHours").textContent = `${roundHours(state.adminProfiles.reduce((sum, profile) => sum + (Number(profile.totalWorkedHours) || 0), 0))} h`;
  $("#adminSharedHorseCount").textContent = state.adminProfiles.reduce((sum, profile) => sum + (Number(profile.sharedHorseCount) || 0), 0);

  const list = $("#adminUserList");
  if (!list) return;

  if (!state.isAdmin) {
    if (claimBtn) claimBtn.style.display = state.appSettings.primaryAdminUid ? "none" : "";
    list.innerHTML = emptyState("Este panel solo esta disponible para el usuario administrador.");
    return;
  }

  list.innerHTML = state.adminProfiles.map((profile) => `
    <article class="admin-user-card">
      <div>
        <h3>${escapeHtml(profile.displayName || profile.email || "Usuario sin nombre")}</h3>
        <p>${escapeHtml(profile.email || "Sin correo")}</p>
        <div class="admin-user-stats">
          <span>${Number(profile.horseCount) || 0} fichas</span>
          <span>${Number(profile.sharedHorseCount) || 0} compartidas</span>
          <span>${roundHours(Number(profile.totalWorkedHours) || 0)} h trabajadas</span>
          <span>${Number(profile.taskCount) || 0} tareas</span>
          <span>Sesion: ${minutesSince(profile.sessionStartedAt)} min</span>
          <span>Ultima sincronizacion: ${profile.lastSyncAt ? formatDate(String(profile.lastSyncAt).slice(0, 10)) : "Sin datos"}</span>
        </div>
      </div>
      ${profile.uid === state.appSettings.primaryAdminUid ? `<span class="admin-badge">Principal</span>` : ""}
    </article>
  `).join("") || emptyState("Todavia no hay otros usuarios conectados.");

  if (claimBtn) claimBtn.style.display = state.isAdmin ? "none" : "";
}

function renderHorseList() {
  const list = $("#horseList");
  if (!list) return;
  const query = normalizeSearch($("#horseListSearch")?.value || "");
  const horses = [...visibleHorses()]
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
          <small>${escapeHtml(horse.number ? `Caballo ${horse.number}` : "Sin numero")} ? ${escapeHtml(horse.stable || "Sin cuadra")}</small>
          ${horse.shared ? `<span class="horse-shared-badge">Compartida por ${escapeHtml(horse.ownerName || horse.ownerEmail || "otro usuario")}</span>` : ""}
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
  switchCalendarModalTab("resumen");
  renderCalendarModalOverview(iso);
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

function switchCalendarModalTab(tab) {
  $$(".calendar-modal-tab").forEach((button) => {
    button.classList.toggle("active", button.dataset.calTab === tab);
  });
  $$(".calendar-modal-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === `cal-panel-${tab}`);
  });
}

function renderCalendarModalOverview(iso) {
  const work = state.workEntries.filter((entry) => entry.date === iso);
  const tasks = state.tasks.filter((task) => task.date === iso);
  const notes = state.calendarNotes.filter((note) => note.date === iso);
  const schedule = getScheduleForDate(iso);
  const workedHours = roundHours(work.reduce((sum, entry) => sum + calculateWorkHours(entry), 0));
  const overview = $("#calModalOverview");
  if (!overview) return;

  overview.innerHTML = `
    <article class="cal-overview-card">
      <h3>Horario previsto</h3>
      <strong>${scheduleTotalHours(schedule)} h</strong>
      <p>${escapeHtml(scheduleLabel(schedule))}</p>
    </article>
    <article class="cal-overview-card">
      <h3>Jornada registrada</h3>
      <strong>${workedHours} h</strong>
      <p>${work.length ? `${work.length} registro${work.length > 1 ? "s" : ""}` : "Sin jornada cargada"}</p>
    </article>
    <article class="cal-overview-card">
      <h3>Agenda del día</h3>
      <strong>${tasks.length + notes.length}</strong>
      <p>${tasks.length} tarea${tasks.length === 1 ? "" : "s"} y ${notes.length} nota${notes.length === 1 ? "" : "s"}</p>
    </article>
    <div class="cal-overview-actions">
      <button class="primary-button" type="button" data-open-day="${iso}">Ver jornada del día</button>
      <button class="ghost-button" type="button" data-switch-cal-tab="agenda">Ver agenda</button>
      <button class="ghost-button" type="button" data-switch-cal-tab="nota">Añadir nota</button>
    </div>
  `;
}

function renderCalendarModalInfo(iso) {
  const work = state.workEntries.filter((e) => e.date === iso);
  const tasks = state.tasks.filter((t) => t.date === iso);
  const schedule = getScheduleForDate(iso);
  const info = [
    `<div class="cal-info-chip schedule">${buttonIcon("schedule")} ${escapeHtml(scheduleLabel(schedule))} — ${scheduleTotalHours(schedule)} h previstas</div>`,
    ...work.map((e) => `<div class="cal-info-chip work">${buttonIcon("timer")} ${escapeHtml(e.dayType)}: ${calculateWorkHours(e)} h trabajadas</div>`),
    ...tasks.map((t) => `<div class="cal-info-chip task">${buttonIcon("tasks")} ${escapeHtml(t.name)} — ${labelStatus(t.status)}</div>`)
  ].join("");
  $("#calModalInfo").innerHTML = info || `<p class="muted">Sin jornada ni tareas este día.</p>`;
}

function renderCalendarModalNotes(iso) {
  const notes = state.calendarNotes.filter((n) => n.date === iso).sort((a, b) => (a.alarmTime || "99:99").localeCompare(b.alarmTime || "99:99") || a.createdAt.localeCompare(b.createdAt));
  const colors = { green: "notes", blue: "days", amber: "bell", red: "trash" };
  $("#calModalNotes").innerHTML = notes.map((note) => `
    <div class="cal-note-item cal-note-${note.color}">
      <span class="cal-note-dot icon-slot" data-icon="${colors[note.color] || "notes"}"></span>
      <div class="cal-note-body">
        <span>${escapeHtml(note.text)}</span>
        ${noteCountdown(note)}
      </div>
      <button class="cal-note-edit" data-edit-note="${note.id}" type="button" aria-label="Editar nota">${buttonIcon("edit")}</button>
      <button class="cal-note-delete" data-delete-note="${note.id}" type="button" aria-label="Borrar nota">${buttonIcon("trash")}</button>
    </div>
  `).join("") || `<p class="muted" style="font-size:0.85rem">Sin notas para este día. Añade una abajo.</p>`;
}

function saveCalendarNote(event) {
  event.preventDefault();
  const text = $("#calNoteText").value.trim();
  const date = $("#calNoteDate").value;
  const editId = $("#calNoteEditId").value;
  const alarmTime = $("#calNoteAlarm").value;
  if (!text || !date) return;

  if (editId) {
    const note = state.calendarNotes.find((n) => n.id === editId);
    if (note) {
      note.text = text;
      note.color = $("#calNoteColor").value;
      note.alarmTime = alarmTime || null;
      note.alarmFired = alarmTime ? false : null;
    }
    $("#calNoteEditId").value = "";
    $("#calNoteSaveBtn").textContent = "Añadir";
  } else {
    state.calendarNotes.push({
      id: uid(),
      date,
      text,
      color: $("#calNoteColor").value,
      alarmTime: alarmTime || null,
      alarmFired: alarmTime ? false : null,
      createdAt: new Date().toISOString()
    });
  }

  $("#calNoteText").value = "";
  $("#calNoteAlarm").value = "";
  saveData();
  renderCalendarModalOverview(date);
  renderCalendarModalNotes(date);
  renderCalendar();
}

function editCalendarNote(id) {
  const note = state.calendarNotes.find((n) => n.id === id);
  if (!note) return;
  $("#calNoteEditId").value = note.id;
  $("#calNoteText").value = note.text;
  $("#calNoteColor").value = note.color;
  $("#calNoteAlarm").value = note.alarmTime || "";
  $("#calNoteSaveBtn").textContent = "Guardar";
  switchCalendarModalTab("nota");
  $("#calNoteText").focus();
}

function deleteCalendarNote(id) {
  state.calendarNotes = state.calendarNotes.filter((n) => n.id !== id);
  const date = $("#calNoteDate").value;
  saveData();
  renderCalendarModalOverview(date);
  renderCalendarModalNotes(date);
  renderCalendar();
}

function requestNotificationPermission() {
  if (!("Notification" in window)) {
    alert("Tu navegador no soporta notificaciones.");
    return;
  }
  Notification.requestPermission().then((perm) => {
    updateNotifPermBtn();
    if (perm === "granted") {
      new Notification("Finca Planner", { body: "Las notificaciones están activadas ?", icon: "" });
    } else {
      alert("Permiso denegado. Actívalo en la configuración del navegador.");
    }
  });
}

function updateNotifPermBtn() {
  const btn = $("#notifPermBtn");
  if (!btn) return;
  if (!("Notification" in window)) { btn.style.display = "none"; return; }
  if (Notification.permission === "granted") {
    btn.textContent = "Notificaciones activadas ?";
    btn.disabled = true;
  } else if (Notification.permission === "denied") {
    btn.textContent = "Notificaciones bloqueadas ?";
    btn.disabled = true;
  } else {
    btn.textContent = "Activar notificaciones ??";
    btn.disabled = false;
  }
}

function checkAlarms() {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const now = new Date();
  const todayIso = todayISO();
  const nowTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  state.calendarNotes.forEach((note) => {
    if (!note.alarmTime || note.alarmFired !== false) return;
    if (note.date === todayIso && note.alarmTime === nowTime) {
      note.alarmFired = true;
      new Notification("? Finca Planner", { body: note.text, tag: note.id });
      saveData();
    }
  });

  state.generalNotes.forEach((note) => {
    if (!note.alarmTime || note.alarmFired !== false) return;
    if (note.alarmTime === nowTime) {
      note.alarmFired = true;
      const meta = GENERAL_NOTE_TYPE_META[note.type] || GENERAL_NOTE_TYPE_META.normal;
      new Notification(`${meta.emoji} Finca Planner — ${meta.label}`, { body: note.text, tag: note.id });
      saveData();
      renderGeneralNotes();
    }
  });
}

function noteCountdown(note) {
  if (!note.alarmTime || note.alarmFired) return "";
  const now = new Date();
  const alarm = new Date(`${note.date}T${note.alarmTime}:00`);
  const diff = alarm - now;
  if (diff <= 0) return `<span class="note-alarm-tag fired">Alarma pasada</span>`;
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const label = h > 0 ? `${h}h ${m}m` : `${m}m`;
  return `<span class="note-alarm-tag">?? ${note.alarmTime} — en ${label}</span>`;
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
  const horse = visibleHorses().find((h) => h.id === id);
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
  const canEdit = !horse.shared || horse.ownerUid === currentUser()?.uid;

  card.innerHTML = `
    <div class="horse-detail-header">
      <div class="horse-detail-photo">${photo}</div>
      <div>
        <div class="horse-title-block">
          <span class="horse-code">${escapeHtml(horse.number ? `Caballo ${horse.number}` : "Ficha de caballo")}</span>
          <h3>${escapeHtml(horse.name || horseLabel(horse))}</h3>
          ${horse.shared ? `<span class="horse-shared-badge">Compartida por ${escapeHtml(horse.ownerName || horse.ownerEmail || "otro usuario")}</span>` : ""}
        </div>
      </div>
      <div class="horse-detail-actions">
        ${canEdit ? `<button class="small-button icon-text-button" data-share-horse="${horse.id}" type="button">${buttonIcon("share")}Compartir</button>
        <button class="small-button icon-text-button" data-edit-horse="${horse.id}" type="button">${buttonIcon("edit")}Editar</button>
        <button class="small-button icon-text-button danger" data-delete-horse="${horse.id}" type="button">${buttonIcon("trash")}Borrar</button>` : ""}
      </div>
    </div>

    <div class="horse-detail-feed">
      <h4 class="feed-title">${buttonIcon("feed")}Alimentación</h4>
      <div class="feed-grid">
        <div class="feed-slot feed-slot-morning">
          <span class="feed-icon icon-slot" data-icon="today"></span>
          <div><label>Mañana</label><p>${escapeHtml(horse.feedMorning || "—")}</p></div>
        </div>
        <div class="feed-slot feed-slot-noon">
          <span class="feed-icon icon-slot" data-icon="today"></span>
          <div><label>Mediodía</label><p>${escapeHtml(horse.feedNoon || "—")}</p></div>
        </div>
        <div class="feed-slot feed-slot-evening">
          <span class="feed-icon icon-slot" data-icon="moon"></span>
          <div><label>Tarde</label><p>${escapeHtml(horse.feedEvening || "—")}</p></div>
        </div>
      </div>
    </div>

    <div class="horse-detail-meta">
      <div class="horse-detail-field">
        <label><span class="inline-label-icon"><span class="icon-slot" data-icon="stable"></span>Cuadra</span></label>
        <p>
          ${escapeHtml(horse.stable || "—")}
          ${horseHasLocation(horse, "stable") ? `<a class="coord-map-link" href="${googleMapsUrl(horse, "stable")}" target="_blank" rel="noopener" title="Ver en Maps">${buttonIcon("map")}</a>` : ""}
        </p>
      </div>
      ${horse.paddock ? `
      <div class="horse-detail-field">
        <label><span class="inline-label-icon"><span class="icon-slot" data-icon="map"></span>Paddock</span></label>
        <p>
          ${escapeHtml(horse.paddock)}
          ${horseHasLocation(horse, "paddock") ? `<a class="coord-map-link" href="${googleMapsUrl(horse, "paddock")}" target="_blank" rel="noopener" title="Ver en Maps">${buttonIcon("map")}</a>` : ""}
        </p>
      </div>` : ""}
    </div>

    ${horse.notes ? `<div class="horse-detail-notes"><label><span class="inline-label-icon"><span class="icon-slot" data-icon="notes"></span>Observaciones</span></label><p>${escapeHtml(horse.notes)}</p></div>` : ""}

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
        <button class="small-button icon-text-button" data-open-horse="${horse.id}" type="button">${buttonIcon("stable")}Abrir ficha</button>
        <button class="small-button icon-text-button" data-complete-horse-note="${horse.id}" type="button">${buttonIcon("check")}Hecho</button>
      </div>
    </article>
  `).join("") || emptyState("No hay observaciones pendientes.");
}

const GENERAL_NOTE_TYPE_META = {
  normal:       { icon: "notes", label: "Normal",       color: "green"  },
  recordatorio: { icon: "bell", label: "Recordatorio", color: "amber"  },
  urgente:      { icon: "trash", label: "Urgente",      color: "red"    },
  info:         { icon: "eye", label: "Informativa",  color: "blue"   },
};

function renderGeneralNotes() {
  const list = $("#generalNotesList");
  if (!list) return;
  const typeOrder = { urgente: 0, recordatorio: 1, normal: 2, info: 3 };
  const notes = [...state.generalNotes].sort((a, b) => {
    const tA = typeOrder[a.type] ?? 2;
    const tB = typeOrder[b.type] ?? 2;
    if (tA !== tB) return tA - tB;
    return b.createdAt.localeCompare(a.createdAt);
  });
  list.innerHTML = notes.map((note) => {
    const meta = GENERAL_NOTE_TYPE_META[note.type] || GENERAL_NOTE_TYPE_META.normal;
    const alarmTag = note.alarmTime && !note.alarmFired
      ? `<span class="note-alarm-tag">${buttonIcon("bell")}${note.alarmTime}</span>`
      : note.alarmFired ? `<span class="note-alarm-tag fired">${buttonIcon("check")}${note.alarmTime}</span>` : "";
    return `
    <article class="general-note-card type-${meta.color}">
      <div class="general-note-header">
        <span class="general-note-badge">${buttonIcon(meta.icon || "notes")}${meta.label}</span>
        ${alarmTag}
      </div>
      <p>${escapeHtml(note.text)}</p>
      <div class="general-note-footer">
        <span>${formatDate(note.createdAt.slice(0, 10))}</span>
        <div class="card-actions">
          <button class="small-button icon-text-button" data-edit-general-note="${note.id}" type="button">${buttonIcon("edit")}Editar</button>
          <button class="small-button icon-text-button danger" data-delete-general-note="${note.id}" type="button">${buttonIcon("trash")}Borrar</button>
        </div>
      </div>
    </article>`;
  }).join("") || emptyState("Sin anotaciones. Escribe tu primera nota arriba.");
}

function saveGeneralNote(event) {
  event.preventDefault();
  const text = $("#generalNoteText")?.value.trim();
  if (!text) return;
  const type = $("#generalNoteType")?.value || "normal";
  const alarmTime = $("#generalNoteAlarm")?.value || "";
  const editId = $("#generalNoteEditId")?.value;
  if (editId) {
    const note = state.generalNotes.find((n) => n.id === editId);
    if (note) {
      note.text = text;
      note.type = type;
      note.alarmTime = alarmTime;
      if (alarmTime !== note.alarmTime) note.alarmFired = false;
    }
  } else {
    state.generalNotes.push({ id: uid(), text, type, alarmTime, alarmFired: false, createdAt: new Date().toISOString() });
  }
  saveData();
  resetGeneralNoteForm();
  renderGeneralNotes();
}

function editGeneralNote(id) {
  const note = state.generalNotes.find((n) => n.id === id);
  if (!note) return;
  const textEl = $("#generalNoteText");
  const editIdEl = $("#generalNoteEditId");
  const typeEl = $("#generalNoteType");
  const alarmEl = $("#generalNoteAlarm");
  const cancelBtn = $("#generalNoteCancelBtn");
  if (textEl) textEl.value = note.text;
  if (editIdEl) editIdEl.value = id;
  if (typeEl) typeEl.value = note.type || "normal";
  if (alarmEl) alarmEl.value = note.alarmTime || "";
  if (cancelBtn) cancelBtn.style.display = "";
  textEl?.focus();
  textEl?.scrollIntoView({ behavior: "smooth", block: "center" });
}

function deleteGeneralNote(id) {
  const note = state.generalNotes.find((n) => n.id === id);
  if (!note) return;
  moveToTrash("generalNote", note);
  state.generalNotes = state.generalNotes.filter((n) => n.id !== id);
  saveData();
  renderGeneralNotes();
  showTrashToast();
}

function resetGeneralNoteForm() {
  const textEl = $("#generalNoteText");
  const editIdEl = $("#generalNoteEditId");
  const typeEl = $("#generalNoteType");
  const alarmEl = $("#generalNoteAlarm");
  const cancelBtn = $("#generalNoteCancelBtn");
  if (textEl) textEl.value = "";
  if (editIdEl) editIdEl.value = "";
  if (typeEl) typeEl.value = "normal";
  if (alarmEl) alarmEl.value = "";
  if (cancelBtn) cancelBtn.style.display = "none";
}

function moveToTrash(type, data) {
  state.trash.push({ id: uid(), type, deletedAt: new Date().toISOString(), data });
}

function renderTrash() {
  const list = $("#trashList");
  if (!list) return;
  const items = [...state.trash].sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
  if (!items.length) { list.innerHTML = emptyState("La papelera está vacía."); return; }
  list.innerHTML = items.map((item) => {
    let title = "", subtitle = "";
    if (item.type === "generalNote") {
      const meta = GENERAL_NOTE_TYPE_META[item.data.type] || GENERAL_NOTE_TYPE_META.normal;
      title = meta.label;
      subtitle = item.data.text;
    } else if (item.type === "horseObservation") {
      title = `?? Obs. de ${item.data.horseName || `caballo ${item.data.horseNumber}` || "caballo"}`;
      subtitle = item.data.text;
    }
    const when = new Date(item.deletedAt);
    const whenStr = when.toLocaleDateString("es-ES", { day: "numeric", month: "short" }) + " " + when.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
    return `
    <article class="trash-card">
      <div class="trash-card-info">
        <span class="trash-type">${title}</span>
        <p class="trash-text">${escapeHtml(subtitle)}</p>
        <span class="trash-date">Eliminado el ${whenStr}</span>
      </div>
      <div class="card-actions">
        <button class="small-button" data-restore-trash="${item.id}" type="button">? Restaurar</button>
        <button class="small-button danger" data-purge-trash="${item.id}" type="button">Borrar definitivo</button>
      </div>
    </article>`;
  }).join("");
}

function restoreFromTrash(id) {
  const item = state.trash.find((t) => t.id === id);
  if (!item) return;
  if (item.type === "generalNote") {
    item.data.alarmFired = false;
    state.generalNotes.push(item.data);
  } else if (item.type === "horseObservation") {
    const horse = state.horses.find((h) => h.id === item.data.horseId);
    if (horse) {
      horse.notes = item.data.text;
      horse.updatedAt = new Date().toISOString();
    }
  }
  state.trash = state.trash.filter((t) => t.id !== id);
  saveData();
  renderTrash();
  if (item.type === "generalNote" && state.currentObsTab === "generales") renderGeneralNotes();
  if (item.type === "horseObservation" && state.currentObsTab === "pendientes") renderHorseObservations();
}

function purgeFromTrash(id) {
  if (!confirm("¿Eliminar definitivamente? Esta acción no se puede deshacer.")) return;
  state.trash = state.trash.filter((t) => t.id !== id);
  saveData();
  renderTrash();
}

function emptyTrash() {
  if (!state.trash.length) return;
  if (!confirm(`¿Vaciar la papelera? Se eliminarán ${state.trash.length} elemento(s) de forma permanente.`)) return;
  state.trash = [];
  saveData();
  renderTrash();
}

let _trashToastTimeout = null;
function showTrashToast() {
  let toast = $("#trashToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "trashToast";
    toast.className = "trash-toast";
    document.body.appendChild(toast);
  }
  const count = state.trash.length;
  toast.innerHTML = `??? Movido a la papelera · <button class="toast-link" data-go-to-trash>Ver papelera</button>`;
  toast.classList.add("visible");
  clearTimeout(_trashToastTimeout);
  _trashToastTimeout = setTimeout(() => toast.classList.remove("visible"), 4000);
}

function switchHistorialTab(tab) {
  $$("[data-historial-tab]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.historialTab === tab);
  });
  $$(".historial-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === `historial-panel-${tab}`);
  });
  if (tab === "papelera") renderTrash();
}

function switchObsTab(tab) {
  state.currentObsTab = tab;
  $$(".obs-tabs .section-tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.obsTab === tab);
  });
  $$(".obs-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === `obs-panel-${tab}`);
  });
  if (tab === "generales") renderGeneralNotes();
  if (tab === "pendientes") renderHorseObservations();
  if (tab === "papelera") renderTrash();
}

function naturalHorseSort(a, b) {
  const aNum = Number(a.number);
  const bNum = Number(b.number);
  if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) return aNum - bNum;
  return String(a.number || a.name).localeCompare(String(b.number || b.name), "es", { numeric: true });
}

function horseCardHtml(horse) {
  const canEdit = !horse.shared || horse.ownerUid === currentUser()?.uid;
  return `
    <article class="horse-card">
      <div class="horse-photo-thumb">${horse.photo ? `<img src="${horse.photo}" alt="">` : `<span>${escapeHtml(horse.number || "?")}</span>`}</div>
      <div>
        <div class="horse-title-block">
          <span class="horse-code">${escapeHtml(horse.number ? `Caballo ${horse.number}` : "Ficha de caballo")}</span>
          <h3>${escapeHtml(horse.name || horseLabel(horse))}</h3>
          ${horse.shared ? `<span class="horse-shared-badge">Compartida por ${escapeHtml(horse.ownerName || horse.ownerEmail || "otro usuario")}</span>` : ""}
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
        <button class="small-button icon-text-button" data-find-horse="${horse.id}" type="button">${buttonIcon("eye")}Ver</button>
        ${canEdit ? `<button class="small-button icon-text-button" data-edit-horse="${horse.id}" type="button">${buttonIcon("edit")}Editar</button>
        <button class="small-button icon-text-button danger" data-delete-horse="${horse.id}" type="button">${buttonIcon("trash")}Borrar</button>` : ""}
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

async function uploadHorsePhoto(uid, horseId, dataUrl) {
  return await uploadHorsePhotoCloudinary(horseId, dataUrl);
}

async function saveHorse(event) {
  event.preventDefault();
  syncManualCoordinateInputsToHidden();
  const user = currentUser();

  const number = $("#horseNumber").value.trim();
  const name = $("#horseName").value.trim();
  if (!number && !name) {
    alert("Introduce al menos el código o el nombre del caballo.");
    return;
  }

  const id = $("#horseId").value || uid();
  let photoValue = $("#horsePhotoData").value;

  // Si la foto es Base64 y hay usuario conectado, súbela a Storage
  if (photoValue && photoValue.startsWith("data:") && user) {
    const btn = $("#horseSaveBtn");
    if (btn) { btn.disabled = true; btn.textContent = "Subiendo foto…"; }
    try {
      photoValue = await uploadHorsePhoto(user.uid, id, photoValue);
    } catch (err) {
      console.warn("Error subiendo foto a Storage:", err);
      // Mantiene Base64 como fallback si falla Storage
    }
    if (btn) { btn.disabled = false; btn.textContent = "Guardar"; }
  }

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
    photo: photoValue,
    notes: $("#horseNotes").value.trim(),
    feedMorning: $("#horseFeedMorning").value.trim(),
    feedNoon: $("#horseFeedNoon").value.trim(),
    feedEvening: $("#horseFeedEvening").value.trim(),
    shared: $("#horseShared").checked,
    ownerUid: user?.uid || "",
    ownerEmail: user?.email || "",
    ownerName: user?.displayName || user?.email || "",
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
  $("#horseShared").checked = false;
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
  $("#horseShared").checked = Boolean(horse.shared);
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
  if (!confirm("Marcar esta observacion como hecha? Se guardará en la papelera por si necesitas recuperarla.")) return;
  moveToTrash("horseObservation", { id: uid(), horseId: horse.id, horseName: horse.name, horseNumber: horse.number, text: horse.notes });
  horse.notes = "";
  horse.updatedAt = new Date().toISOString();
  saveData();
  render();
  showTrashToast();
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
    `?? ${horseLabel(horse)}`,
    horse.stable  ? `?? Cuadra: ${horse.stable}`  : null,
    horse.paddock ? `?? Paddock: ${horse.paddock}` : null,
    horseHasLocation(horse, "stable")  ? `??? Ubicación cuadra: ${horse.lat}, ${horse.lng}` : null,
    horseHasLocation(horse, "stable")  ? googleMapsUrl(horse, "stable")  : null,
    horseHasLocation(horse, "paddock") ? `??? Ubicación paddock: ${horse.paddockLat}, ${horse.paddockLng}` : null,
    horseHasLocation(horse, "paddock") ? googleMapsUrl(horse, "paddock") : null,
    horse.notes ? `?? Notas: ${horse.notes}` : null,
    (horse.feedMorning || horse.feedNoon || horse.feedEvening) ? `\n??? Alimentación:` : null,
    horse.feedMorning ? `  ?? Mañana: ${horse.feedMorning}` : null,
    horse.feedNoon    ? `  ?? Mediodía: ${horse.feedNoon}`   : null,
    horse.feedEvening ? `  ?? Tarde: ${horse.feedEvening}`   : null,
  ].filter(Boolean).join("\n");

  if (navigator.share) {
    navigator.share({ title: horseLabel(horse), text: lines }).catch(() => {});
  } else {
    navigator.clipboard.writeText(lines).then(() => alert("Información copiada al portapapeles.")).catch(() => alert("No se pudo compartir ni copiar."));
  }
}

function deleteHorse(id) {
  if (!confirm("Quieres borrar este caballo del registro?")) return;
  const horse = state.horses.find((item) => item.id === id);
  state.horses = state.horses.filter((item) => item.id !== id);
  if (horse?.ownerUid) {
    deleteDoc(doc(db, SHARED_HORSES_COLLECTION, sharedHorseDocId(horse.ownerUid, horse.id))).catch(() => {});
  }
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
  return visibleHorses().find((horse) => {
    const haystack = normalizeSearch(`${horse.number} ${horse.name} ${horse.stable} caballo ${horse.number}`);
    if (numberMatch && String(horse.number) === numberMatch[1]) return true;
    return haystack.includes(clean);
  }) || null;
}

function findHorseMatches(query) {
  const clean = normalizeSearch(query);
  if (!clean) return [];
  const numberMatch = clean.match(/\b(\d+)\b/);
  return visibleHorses()
    .filter((horse) => {
      const haystack = normalizeSearch(`${horse.number} ${horse.name} ${horse.stable} ${horse.paddock} caballo ${horse.number}`);
      if (numberMatch && String(horse.number) === numberMatch[1]) return true;
      return haystack.includes(clean);
    })
    .sort((a, b) => naturalHorseSort(a, b));
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
        ${horse.shared ? `<span class="horse-shared-badge">Compartida por ${escapeHtml(horse.ownerName || horse.ownerEmail || "otro usuario")}</span>` : ""}
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
        <button class="ghost-button icon-text-button" data-open-horse-list="${horse.id}" type="button">${buttonIcon("stable")}Ver ficha</button>
      </div>
    </article>
  `;
}

function showHorseMatches(query) {
  const result = $("#horseResult");
  if (!result) return;
  const clean = normalizeSearch(query);
  if (!clean) {
    result.innerHTML = emptyState("Empieza a escribir para ver las fichas que coinciden.");
    return;
  }

  const matches = findHorseMatches(query);
  if (!matches.length) {
    result.innerHTML = emptyState("No he encontrado caballos que coincidan con esa busqueda.");
    return;
  }

  result.innerHTML = matches.map((horse) => `
    <article class="horse-result-card">
      <div class="horse-title-block">
        <span class="horse-code">${escapeHtml(horse.number ? `Caballo ${horse.number}` : "Ficha de caballo")}</span>
        <h3>${escapeHtml(horse.name || horseLabel(horse))}</h3>
        ${horse.shared ? `<span class="horse-shared-badge">Compartida por ${escapeHtml(horse.ownerName || horse.ownerEmail || "otro usuario")}</span>` : ""}
      </div>
      ${horse.photo ? `<div class="horse-photo-preview"><img src="${horse.photo}" alt=""></div>` : ""}
      <div class="meta">
        <span>${escapeHtml(horse.stable || "Sin cuadra")}</span>
        <span class="location-status">${horseHasLocation(horse, "stable") ? "Cuadra guardada" : "Cuadra sin ubicacion"}</span>
        ${horse.paddock ? `<span>${escapeHtml(horse.paddock)}</span>` : ""}
        ${horse.paddock ? `<span class="location-status">${horseHasLocation(horse, "paddock") ? "Paddock guardado" : "Paddock sin ubicacion"}</span>` : ""}
      </div>
      ${horse.notes ? `<p class="muted">${escapeHtml(horse.notes)}</p>` : ""}
      <div class="map-link-row">
        ${horseHasLocation(horse, "stable") ? `<a class="map-link" href="${googleMapsUrl(horse, "stable")}" target="_blank" rel="noopener">Google Maps cuadra</a>` : ""}
        ${horseHasLocation(horse, "paddock") ? `<a class="map-link" href="${googleMapsUrl(horse, "paddock")}" target="_blank" rel="noopener">Google Maps paddock</a>` : ""}
      </div>
      <div class="card-actions">
        <button class="small-button icon-text-button" data-find-horse="${horse.id}" type="button">${buttonIcon("eye")}Ver ficha</button>
        <button class="small-button icon-text-button" data-open-horse-list="${horse.id}" type="button">${buttonIcon("horse")}Abrir en listado</button>
      </div>
    </article>
  `).join("");
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
    : `<span class="photo-placeholder">??<br><small>Añadir foto</small></span>`;
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
  const query = $("#horseSearch").value;
  showHorseMatches(query);
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
    showHorseMatches(text);
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

    const notesDots = hasNotes ? notes.slice(0, 3).map((n) => `<span class="cal-note-pip cal-note-pip-${n.color}"></span>`).join("") : "";
    const workDot = hasWork ? `<span class="cal-work-dot" title="Jornada registrada">?</span>` : "";

    cells.push(`
      <div class="calendar-day ${isToday ? "today" : ""} ${hasWork ? "has-work" : ""}" data-open-day="${iso}">
        <div class="cal-day-top">
          <span class="day-number">${day}</span>
          <div class="cal-icons">${workDot}</div>
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
  if (!confirm("Esto borrara todos los datos de tu cuenta sincronizada. Continuar?")) return;
  state.workEntries = [];
  state.tasks = [];
  state.horses = [];
  state.calendarNotes = [];
  state.generalNotes = [];
  state.trash = [];
  state.sharedHorses = [];
  state.games = normalizeGamesData();
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
      calendarNotes: state.calendarNotes,
      generalNotes: state.generalNotes,
      trash: state.trash,
      clock: normalizeClock(state.clock),
      games: normalizeGamesData(state.games),
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

let _photosZipBlob = null;

async function exportPhotosZip() {
  const horses = state.horses.filter((h) => h.photo);
  if (!horses.length) {
    alert("No hay fotos guardadas en ninguna ficha.");
    return;
  }

  const btn = $("#exportPhotosBtn");
  if (btn) { btn.disabled = true; btn.textContent = "Generando ZIP…"; }

  try {
    const zip = new JSZip();
    const folder = zip.folder("fotos-caballos");
    horses.forEach((horse, i) => {
      const label = [
        String(i + 1).padStart(2, "0"),
        horse.number ? `caballo-${horse.number}` : null,
        horse.name ? horse.name.replace(/\s+/g, "-").toLowerCase() : null
      ].filter(Boolean).join("_");
      const base64 = horse.photo.replace(/^data:image\/\w+;base64,/, "");
      const ext = horse.photo.match(/^data:image\/(\w+);/)?.[1] || "jpg";
      folder.file(`${label}.${ext}`, base64, { base64: true });
    });

    _photosZipBlob = await zip.generateAsync({ type: "blob" });

    const summary = `${horses.length} foto${horses.length > 1 ? "s" : ""} de ${horses.length} caballo${horses.length > 1 ? "s" : ""}`;
    $("#photoExportSummary").textContent = `ZIP listo — ${summary}. ¿Qué quieres hacer?`;
    $("#photoExportShareBtn").style.display = navigator.share && navigator.canShare ? "" : "none";
    $("#photoExportModal").classList.add("open");
  } catch (err) {
    alert("Error al generar el ZIP: " + err.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "?? Exportar fotos"; }
  }
}

function closePhotoExportModal() {
  $("#photoExportModal").classList.remove("open");
}

async function sharePhotosZip() {
  if (!_photosZipBlob) return;
  const file = new File([_photosZipBlob], `fotos-caballos-${todayISO()}.zip`, { type: "application/zip" });
  try {
    await navigator.share({ files: [file], title: "Fotos caballos — Finca Planner" });
    closePhotoExportModal();
  } catch (err) {
    if (err.name !== "AbortError") alert("No se pudo compartir: " + err.message);
  }
}

function downloadPhotosZip() {
  if (!_photosZipBlob) return;
  const url = URL.createObjectURL(_photosZipBlob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `fotos-caballos-${todayISO()}.zip`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  closePhotoExportModal();
}

function readBackupData(parsed) {
  if (!parsed || typeof parsed !== "object") return null;
  if (parsed.app === "Finca Planner" && parsed.version === 1 && parsed.data) return parsed.data;
  if (Array.isArray(parsed.workEntries) && Array.isArray(parsed.tasks)) return parsed;
  return null;
}

function normalizeLooseRecord(item) {
  if (!item || typeof item !== "object" || !item.id) return { id: "" };
  return { ...item, id: String(item.id) };
}

function normalizeImportedData(data) {
  if (!data || !Array.isArray(data.workEntries) || !Array.isArray(data.tasks)) return null;
  return {
    workEntries: data.workEntries.map(normalizeWorkEntry).filter((entry) => entry.id && entry.date),
    tasks: data.tasks.map(normalizeTask).filter((task) => task.id && task.name && task.date),
    horses: Array.isArray(data.horses) ? data.horses.map(normalizeHorse).filter((horse) => horse.id && (horse.number || horse.name)) : [],
    calendarNotes: Array.isArray(data.calendarNotes) ? data.calendarNotes.map(normalizeLooseRecord).filter((item) => item.id) : [],
    generalNotes: Array.isArray(data.generalNotes) ? data.generalNotes.map(normalizeLooseRecord).filter((item) => item.id) : [],
    trash: Array.isArray(data.trash) ? data.trash.map(normalizeLooseRecord).filter((item) => item.id) : [],
    clock: normalizeClock(data.clock),
    games: normalizeGamesData(data.games),
    theme: normalizeTheme(data.theme)
  };
}

function mergeById(primaryItems = [], secondaryItems = [], normalizer, isValid) {
  const merged = new Map();
  [...secondaryItems, ...primaryItems].forEach((item) => {
    const normalized = normalizer(item);
    if (isValid(normalized)) merged.set(normalized.id, normalized);
  });
  return [...merged.values()];
}

function mergeHorseRecords(primaryHorse, secondaryHorse) {
  const primary = normalizeHorse(primaryHorse);
  const secondary = normalizeHorse(secondaryHorse);
  const primaryUpdatedAt = Date.parse(primary.updatedAt || "") || 0;
  const secondaryUpdatedAt = Date.parse(secondary.updatedAt || "") || 0;
  const preferred = primaryUpdatedAt >= secondaryUpdatedAt ? primary : secondary;
  const fallback = preferred === primary ? secondary : primary;
  return normalizeHorse({
    ...fallback,
    ...preferred,
    photo: preferred.photo || fallback.photo || "",
    notes: preferred.notes || fallback.notes || "",
    feedMorning: preferred.feedMorning || fallback.feedMorning || "",
    feedNoon: preferred.feedNoon || fallback.feedNoon || "",
    feedEvening: preferred.feedEvening || fallback.feedEvening || "",
    stable: preferred.stable || fallback.stable || "",
    paddock: preferred.paddock || fallback.paddock || "",
    updatedAt: primaryUpdatedAt >= secondaryUpdatedAt ? primary.updatedAt : secondary.updatedAt
  });
}

function mergeHorses(localHorses = [], cloudHorses = []) {
  const merged = new Map();
  [...cloudHorses, ...localHorses].forEach((horse) => {
    const normalized = normalizeHorse(horse);
    if (!normalized.id || (!normalized.number && !normalized.name)) return;
    const existing = merged.get(normalized.id);
    merged.set(normalized.id, existing ? mergeHorseRecords(normalized, existing) : normalized);
  });
  return [...merged.values()];
}

function mergeDataSets(localData, cloudData) {
  const emptyData = {
    workEntries: [],
    tasks: [],
    horses: [],
    calendarNotes: [],
    generalNotes: [],
    trash: [],
    clock: normalizeClock(),
    games: normalizeGamesData(),
    theme: normalizeTheme()
  };
  const local = normalizeImportedData(localData) || emptyData;
  const cloud = normalizeImportedData(cloudData) || emptyData;

  return {
    workEntries: mergeById(local.workEntries, cloud.workEntries, normalizeWorkEntry, (entry) => entry.id && entry.date),
    tasks: mergeById(local.tasks, cloud.tasks, normalizeTask, (task) => task.id && task.name && task.date),
    horses: mergeHorses(local.horses, cloud.horses),
    calendarNotes: mergeById(local.calendarNotes, cloud.calendarNotes, normalizeLooseRecord, (item) => item.id),
    generalNotes: mergeById(local.generalNotes, cloud.generalNotes, normalizeLooseRecord, (item) => item.id),
    trash: mergeById(local.trash, cloud.trash, normalizeLooseRecord, (item) => item.id),
    clock: local.clock?.segments?.length ? local.clock : cloud.clock,
    games: normalizeGamesData({
      flappyHorse: {
        bestScore: Math.max(Number(local.games?.flappyHorse?.bestScore) || 0, Number(cloud.games?.flappyHorse?.bestScore) || 0),
        lastScore: Math.max(Number(local.games?.flappyHorse?.lastScore) || 0, Number(cloud.games?.flappyHorse?.lastScore) || 0),
        selectedColor: local.games?.flappyHorse?.selectedColor || cloud.games?.flappyHorse?.selectedColor || DEFAULT_GAMES.flappyHorse.selectedColor
      }
    }),
    theme: local.theme?.mode ? local.theme : cloud.theme
  };
}

function dataHasContent(data) {
  if (!data || typeof data !== "object") return false;
  return Boolean(
    (Array.isArray(data.workEntries) && data.workEntries.length) ||
    (Array.isArray(data.tasks) && data.tasks.length) ||
    (Array.isArray(data.horses) && data.horses.length) ||
    (Array.isArray(data.calendarNotes) && data.calendarNotes.length) ||
    (Array.isArray(data.generalNotes) && data.generalNotes.length) ||
    (Array.isArray(data.trash) && data.trash.length) ||
    ((Number(data.games?.flappyHorse?.bestScore) || 0) > 0) ||
    (data.clock && Array.isArray(data.clock.segments) && data.clock.segments.length)
  );
}

function readLegacyLocalData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return dataHasContent(parsed) ? parsed : null;
  } catch {
    return null;
  }
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
    shared: Boolean(source.shared),
    ownerUid: String(source.ownerUid || ""),
    ownerEmail: String(source.ownerEmail || ""),
    ownerName: String(source.ownerName || ""),
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
      state.calendarNotes = data.calendarNotes;
      state.generalNotes = data.generalNotes;
      state.trash = data.trash;
      state.clock = data.clock;
      state.games = data.games;
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
    if (button.dataset.obsTab) button.addEventListener("click", () => switchObsTab(button.dataset.obsTab));
    if (button.dataset.historialTab) button.addEventListener("click", () => switchHistorialTab(button.dataset.historialTab));
  });

  $("#workForm").addEventListener("submit", saveWork);
  $("#taskForm").addEventListener("submit", saveTask);
  $("#horseForm").addEventListener("submit", saveHorse);
  $("#resetWorkBtn").addEventListener("click", resetWorkForm);
  $("#resetTaskBtn").addEventListener("click", resetTaskForm);
  $("#resetHorseBtn").addEventListener("click", resetHorseForm);
  $("#findHorseBtn").addEventListener("click", findHorseFromInput);
  $("#voiceHorseBtn").addEventListener("click", startHorseVoiceSearch);
  $("#horseSearch").addEventListener("input", (event) => {
    showHorseMatches(event.target.value);
  });
  $("#horsePhotoInput").addEventListener("change", handleHorsePhoto);
  $("#horseGalleryInput").addEventListener("change", handleHorsePhoto);
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
  $("#generalNoteForm").addEventListener("submit", saveGeneralNote);
  $("#generalNoteCancelBtn").addEventListener("click", resetGeneralNoteForm);
  $("#calModalClose").addEventListener("click", closeCalendarDayModal);
  $("#calendarDayModal").addEventListener("click", (e) => { if (e.target === e.currentTarget) closeCalendarDayModal(); });
  $$(".calendar-modal-tab").forEach((button) => {
    button.addEventListener("click", () => switchCalendarModalTab(button.dataset.calTab));
  });
  $("#notifPermBtn").addEventListener("click", requestNotificationPermission);
  $("#generalNoteNotifBtn").addEventListener("click", requestNotificationPermission);

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
  $("#exportPhotosBtn").addEventListener("click", exportPhotosZip);
  $("#photoExportModalClose").addEventListener("click", closePhotoExportModal);
  $("#photoExportModal").addEventListener("click", (e) => { if (e.target === e.currentTarget) closePhotoExportModal(); });
  $("#photoExportShareBtn").addEventListener("click", sharePhotosZip);
  $("#photoExportDownloadBtn").addEventListener("click", downloadPhotosZip);
  $("#showAllWorkEntriesBtn").addEventListener("click", showAllWorkEntries);
  $("#backBtn").addEventListener("click", goBack);
  const authBtn = $("#authBtn");
  const authHoverCard = $("#authHoverCard");
  const topbarActions = document.querySelector(".topbar-actions");
  const authCardActionBtn = $("#authCardActionBtn");
  if (authBtn && authHoverCard && topbarActions) {
    const openAuthHover = () => topbarActions.classList.add("auth-hover-open");
    const closeAuthHover = () => topbarActions.classList.remove("auth-hover-open");
    authBtn.addEventListener("click", (event) => {
      if (!currentUser()) {
        loginWithGoogle();
        return;
      }
      event.stopPropagation();
      topbarActions.classList.toggle("auth-hover-open");
    });
    authCardActionBtn?.addEventListener("click", () => {
      closeAuthHover();
      currentUser() ? logout() : loginWithGoogle();
    });
    document.addEventListener("click", (event) => {
      if (!topbarActions.contains(event.target)) closeAuthHover();
    });
  }
  $("#adminBtn").addEventListener("click", openAdminModal);
  $("#adminModalClose").addEventListener("click", closeAdminModal);
  $("#adminModal").addEventListener("click", (e) => { if (e.target === e.currentTarget) closeAdminModal(); });
  $("#claimAdminBtn").addEventListener("click", async () => {
    await claimPrimaryAdmin();
    await loadAdminProfiles();
    renderAdminPanel();
  });
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
  $("#appearanceBtn")?.addEventListener("click", openAppearanceModal);
  $("#appearanceModalClose")?.addEventListener("click", closeAppearanceModal);
  $("#appearanceModal")?.addEventListener("click", (event) => {
    if (event.target === event.currentTarget) closeAppearanceModal();
  });
  $("#themePrimaryInput")?.addEventListener("input", (event) => {
    state.theme.primary = normalizeHexColor(event.target.value, state.theme.primary);
    applyTheme();
  });
  $("#themeAccentInput")?.addEventListener("input", (event) => {
    state.theme.accent = normalizeHexColor(event.target.value, state.theme.accent);
    applyTheme();
  });
  $("#themeGlassInput")?.addEventListener("input", (event) => {
    state.theme.glass = clampNumber(event.target.value, 0.45, 0.95, state.theme.glass);
    applyTheme();
  });
  $("#themeBgStrengthInput")?.addEventListener("input", (event) => {
    state.theme.bgStrength = clampNumber(event.target.value, 0, 100, state.theme.bgStrength);
    applyTheme();
  });
  $("#themeResetBtn")?.addEventListener("click", resetThemeCustomization);
  $$("[data-preset]").forEach((button) => {
    button.addEventListener("click", () => applyThemePreset(button.dataset.preset));
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeAppearanceModal();
    }
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
    if (findHorseButton) showHorseResult(visibleHorses().find((horse) => horse.id === findHorseButton.dataset.findHorse));
    if (editHorseButton) editHorse(editHorseButton.dataset.editHorse);
    if (deleteHorseButton) deleteHorse(deleteHorseButton.dataset.deleteHorse);
    if (openHorseButton) openHorseFromObservation(openHorseButton.dataset.openHorse);
    if (completeHorseNoteButton) completeHorseObservation(completeHorseNoteButton.dataset.completeHorseNote);
    const editGeneralNoteBtn = event.target.closest("[data-edit-general-note]");
    const deleteGeneralNoteBtn = event.target.closest("[data-delete-general-note]");
    if (editGeneralNoteBtn) editGeneralNote(editGeneralNoteBtn.dataset.editGeneralNote);
    if (deleteGeneralNoteBtn) deleteGeneralNote(deleteGeneralNoteBtn.dataset.deleteGeneralNote);
    const restoreTrashBtn = event.target.closest("[data-restore-trash]");
    const purgeTrashBtn = event.target.closest("[data-purge-trash]");
    const emptyTrashBtn = event.target.closest("[data-empty-trash]");
    const goToTrashBtn = event.target.closest("[data-go-to-trash]");
    if (restoreTrashBtn) restoreFromTrash(restoreTrashBtn.dataset.restoreTrash);
    if (purgeTrashBtn) purgeFromTrash(purgeTrashBtn.dataset.purgeTrash);
    if (emptyTrashBtn) emptyTrash();
    if (goToTrashBtn) { switchView("historial"); switchHistorialTab("papelera"); }
    if (removeSegmentButton) removeManualSegment(Number(removeSegmentButton.dataset.removeSegment));
    const openDayBtn = event.target.closest("[data-open-day]");
    const switchCalTabBtn = event.target.closest("[data-switch-cal-tab]");
    const editNoteBtn = event.target.closest("[data-edit-note]");
    const deleteNoteBtn = event.target.closest("[data-delete-note]");
    if (switchCalTabBtn) switchCalendarModalTab(switchCalTabBtn.dataset.switchCalTab);
    if (editNoteBtn) { event.stopPropagation(); editCalendarNote(editNoteBtn.dataset.editNote); }
    else if (deleteNoteBtn) { event.stopPropagation(); deleteCalendarNote(deleteNoteBtn.dataset.deleteNote); }
    else if (openDayBtn) openCalendarDayModal(openDayBtn.dataset.openDay);
    else if (calendarDay) openWorkDate(calendarDay.dataset.calendarDate);
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
  initFlappyHorse();
  loadManualSegmentsForDate(todayISO());
  applyTheme();
  render();
  updateBackButton();
  clockInterval = setInterval(renderClock, 1000);
  setInterval(checkAlarms, 30000);
  updateNotifPermBtn();
}

// -- Firebase auth & sync -------------------------------------

async function loadFromFirestore(user) {
  try {
    const snap = await getDoc(doc(db, "users", user.uid, "data", "main"));
    if (snap.exists()) {
      const data = snap.data();
      state.workEntries   = Array.isArray(data.workEntries)   ? data.workEntries   : [];
      state.tasks         = Array.isArray(data.tasks)         ? data.tasks         : [];
      state.horses        = Array.isArray(data.horses)        ? data.horses        : [];
      state.calendarNotes = Array.isArray(data.calendarNotes) ? data.calendarNotes : [];
      state.generalNotes  = Array.isArray(data.generalNotes)  ? data.generalNotes  : [];
      state.trash         = Array.isArray(data.trash)         ? data.trash         : [];
      state.games         = normalizeGamesData(data.games);
      if (data.clock && Array.isArray(data.clock.segments)) state.clock = data.clock;
    }
  } catch (e) {
    console.warn("No se pudo cargar desde Firestore:", e);
  }
}

function showLoginScreen() {
  const ls = $("#loginScreen");
  if (ls) ls.style.display = "flex";
}

function hideLoginScreen() {
  const ls = $("#loginScreen");
  if (ls) ls.style.display = "none";
}

function updateUserChip(user) {
  const authBtn = $("#authBtn");
  const syncBtn = $("#syncBtn");
  const iconEnter = authBtn?.querySelector(".auth-icon-enter");
  const iconExit = authBtn?.querySelector(".auth-icon-exit");
  const authBtnPhoto = $("#authBtnPhoto");
  const authBtnFallback = $("#authBtnFallback");
  const hoverTitle = $("#authHoverTitle");
  const hoverEmail = $("#authHoverEmail");
  const hoverAction = $("#authHoverAction");
  const hoverPhoto = $("#authHoverPhoto");
  const hoverInitial = $("#authHoverInitial");
  const adminBadge = $("#authAdminBadge");
  const authCardActionBtn = $("#authCardActionBtn");

  if (hoverPhoto) {
    hoverPhoto.style.display = "none";
    hoverPhoto.src = "";
  }
  if (authBtnPhoto) {
    authBtnPhoto.style.display = "none";
    authBtnPhoto.src = "";
  }
  if (authBtnFallback) {
    authBtnFallback.style.display = "";
    authBtnFallback.textContent = user?.displayName?.[0] || user?.email?.[0] || "G";
  }
  if (hoverInitial) {
    hoverInitial.style.display = "";
    hoverInitial.textContent = user?.displayName?.[0] || user?.email?.[0] || "G";
  }
  if (adminBadge) adminBadge.style.display = "none";

  if (user) {
    if (authBtn) {
      authBtn.classList.add("auth-logged-in");
      authBtn.setAttribute("title", user.displayName || user.email || "Cuenta conectada");
      authBtn.setAttribute("aria-label", "Cuenta conectada");
    }
    if (iconEnter) iconEnter.style.display = "none";
    if (iconExit) iconExit.style.display = "none";
    if (hoverTitle) hoverTitle.textContent = user.displayName || "Cuenta conectada";
    if (hoverEmail) hoverEmail.textContent = user.email || user.displayName || "Sesion iniciada";
    if (hoverAction) hoverAction.textContent = "Gestiona tu sesion";
    if (hoverPhoto && user.photoURL) {
      hoverPhoto.src = user.photoURL;
      hoverPhoto.style.display = "";
      if (hoverInitial) hoverInitial.style.display = "none";
    }
    if (authBtnPhoto && user.photoURL) {
      authBtnPhoto.src = user.photoURL;
      authBtnPhoto.style.display = "";
      if (authBtnFallback) authBtnFallback.style.display = "none";
    }
    if (adminBadge && isPrimaryAdmin(user)) adminBadge.style.display = "";
    if (authCardActionBtn) authCardActionBtn.textContent = "Cerrar sesion";
  } else {
    if (authBtn) {
      authBtn.classList.remove("auth-logged-in");
      authBtn.setAttribute("title", "Iniciar sesion con Google");
      authBtn.setAttribute("aria-label", "Iniciar sesion con Google");
    }
    if (iconEnter) iconEnter.style.display = "";
    if (iconExit) iconExit.style.display = "none";
    if (hoverTitle) hoverTitle.textContent = "Sesion no iniciada";
    if (hoverEmail) hoverEmail.textContent = "No conectado";
    if (hoverAction) hoverAction.textContent = "Pulsa para iniciar sesion con Google";
    if (authCardActionBtn) authCardActionBtn.textContent = "Iniciar sesion con Google";
  }

  if (syncBtn) syncBtn.style.display = user ? "" : "none";
}

async function loginWithGoogle() {
  if (window.location.protocol === "file:") {
    alert("El inicio de sesion con Google no funciona bien desde file://. Abre la app desde tu URL de GitHub Pages o desde un servidor local.");
    return;
  }
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    if (e.code !== "auth/popup-closed-by-user") alert("Error al iniciar sesion: " + e.message);
  }
}

async function logout() {
  if (!confirm("Cerrar sesion?")) return;
  await signOut(auth);
}

onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentSessionStartedAt = currentSessionStartedAt || new Date().toISOString();
    hideLoginScreen();
    await loadAppSettings();
    if (!state.appSettings.primaryAdminUid) {
      await claimPrimaryAdmin(user);
    }
    state.isAdmin = isPrimaryAdmin(user);
    updateUserChip(user);
    await migrateOrLoadData(user);
    await migrateHorsePhotosToStorage(user);
    await recoverCloudinaryPhotos(user);
    await loadSharedHorses();
    await syncUserProfile();
    await loadAdminProfiles();
    updateAdminAccess();
    render();
  } else {
    currentSessionStartedAt = null;
    showLoginScreen();
    loadData();
    state.isAdmin = false;
    state.sharedHorses = [];
    state.adminProfiles = [];
    closeAdminModal();
    updateUserChip(null);
    updateAdminAccess();
  }
});

function showPhotoMigrationPanel(total) {
  let panel = $("#photoMigrationPanel");
  if (!panel) {
    panel = document.createElement("div");
    panel.id = "photoMigrationPanel";
    panel.className = "photo-migration-panel";
    panel.innerHTML = `
      <div class="pmp-header">
        <span class="pmp-icon">🐴</span>
        <div class="pmp-texts">
          <strong class="pmp-title">Sincronizando fotos</strong>
          <span class="pmp-subtitle" id="pmpSubtitle">Preparando…</span>
        </div>
        <button class="pmp-close no-ripple" id="pmpClose" title="Cerrar" style="display:none">✕</button>
      </div>
      <div class="pmp-bar-track"><div class="pmp-bar-fill" id="pmpBarFill"></div></div>
      <div class="pmp-steps" id="pmpSteps"></div>
      <div id="pmpErrorLog" class="pmp-error-log" style="display:none"></div>
    `;
    document.body.appendChild(panel);
    panel.querySelector("#pmpClose").addEventListener("click", () => {
      panel.classList.remove("visible");
    });
  }
  panel.classList.add("visible");
  updatePhotoMigrationPanel(0, total, "Detectando fotos en este dispositivo…");
  return panel;
}

function updatePhotoMigrationPanel(done, total, subtitle, horseName, status) {
  const fill = $("#pmpBarFill");
  const sub = $("#pmpSubtitle");
  const steps = $("#pmpSteps");
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  if (fill) fill.style.width = pct + "%";
  if (sub) sub.textContent = subtitle;
  if (steps && horseName) {
    const item = document.createElement("div");
    item.className = `pmp-step pmp-step-${status}`;
    item.textContent = (status === "ok" ? "✓ " : "✗ ") + horseName;
    steps.appendChild(item);
    steps.scrollTop = steps.scrollHeight;
  }
}

function hidePhotoMigrationPanel(success, errorLog) {
  const panel = $("#photoMigrationPanel");
  if (!panel) return;
  const sub = $("#pmpSubtitle");
  const fill = $("#pmpBarFill");
  const closeBtn = $("#pmpClose");
  const logEl = $("#pmpErrorLog");
  if (fill) fill.style.width = "100%";
  panel.classList.add(success ? "pmp-done" : "pmp-error");
  if (success) {
    if (sub) sub.textContent = "¡Fotos sincronizadas correctamente!";
    setTimeout(() => panel.classList.remove("visible"), 4000);
  } else {
    if (sub) sub.textContent = "Finalizado con errores — pulsa ✕ para cerrar";
    if (closeBtn) closeBtn.style.display = "flex";
    if (logEl && errorLog && errorLog.length > 0) {
      logEl.style.display = "block";
      logEl.innerHTML = "<strong>Detalle de errores:</strong><br>" +
        errorLog.map((e) => `• ${escapeHtml(e)}`).join("<br>");
    }
  }
}

async function migrateHorsePhotosToStorage(user) {
  const horsesWithBase64 = state.horses.filter(
    (h) => h.photo && h.photo.startsWith("data:")
  );
  if (horsesWithBase64.length === 0) return;

  const total = horsesWithBase64.length;
  showPhotoMigrationPanel(total);
  let uploaded = 0;
  let failed = 0;
  const errorLog = [];

  for (let i = 0; i < horsesWithBase64.length; i++) {
    const horse = horsesWithBase64[i];
    const label = horse.name || horse.number || `Caballo ${i + 1}`;
    updatePhotoMigrationPanel(i, total, `Subiendo ${i + 1} de ${total}: ${label}…`);
    try {
      const url = await uploadHorsePhoto(user.uid, horse.id, horse.photo);
      const idx = state.horses.findIndex((h) => h.id === horse.id);
      if (idx !== -1) state.horses[idx] = { ...state.horses[idx], photo: url };
      uploaded++;
      updatePhotoMigrationPanel(i + 1, total, `Subiendo ${i + 1} de ${total}…`, label, "ok");
    } catch (err) {
      console.warn("Error migrando foto del caballo", horse.id, err);
      failed++;
      const errMsg = `${label}: ${err.message}`;
      errorLog.push(errMsg);
      updatePhotoMigrationPanel(i + 1, total, `Subiendo ${i + 1} de ${total}…`, errMsg, "error");
    }
  }

  if (uploaded > 0) {
    saveData();
    // Forzar escritura inmediata en Firestore sin esperar el debounce
    try {
      await setDoc(doc(db, "users", user.uid, "data", "main"), buildCloudPayload());
    } catch (e) {
      console.warn("Error guardando URLs de fotos en Firestore:", e);
    }
  }
  hidePhotoMigrationPanel(failed === 0, errorLog);
}

async function migrateOrLoadData(user) {
  const userDoc = doc(db, "users", user.uid, "data", "main");

  try {
    const snap = await getDoc(userDoc);
    const hasCloudData = snap.exists();
    const legacyLocalData = readLegacyLocalData();

    if (hasCloudData) {
      const cloudData = snap.data();
      const mergedData = legacyLocalData ? mergeDataSets(legacyLocalData, cloudData) : cloudData;
      applyDataFromObject(mergedData);

      if (legacyLocalData) {
        const cloudHasAllData = JSON.stringify(normalizeImportedData(cloudData) || {}) === JSON.stringify(normalizeImportedData(mergedData) || {});
        if (!cloudHasAllData) {
          showSyncBanner("Recuperando datos guardados en este dispositivo...");
          await setDoc(userDoc, {
            ...cloudData,
            workEntries: mergedData.workEntries,
            tasks: mergedData.tasks,
            horses: mergedData.horses.map(sanitizeHorseForCloud),
            calendarNotes: mergedData.calendarNotes,
            generalNotes: mergedData.generalNotes,
            trash: mergedData.trash,
            clock: mergedData.clock,
            games: mergedData.games,
            theme: mergedData.theme
          });
          hideSyncBanner("Datos recuperados y sincronizados");
        }
      }
    } else {
      const seedData = legacyLocalData ? mergeDataSets(legacyLocalData, {}) : {
        workEntries: [],
        tasks: [],
        horses: [],
        calendarNotes: [],
        generalNotes: [],
        trash: [],
        clock: normalizeClock(),
        games: normalizeGamesData(),
        theme: normalizeTheme(state.theme)
      };
      if (legacyLocalData) showSyncBanner("Subiendo datos guardados en este dispositivo...");
      await setDoc(userDoc, {
        workEntries: seedData.workEntries,
        tasks: seedData.tasks,
        horses: seedData.horses.map(sanitizeHorseForCloud),
        calendarNotes: seedData.calendarNotes,
        generalNotes: seedData.generalNotes,
        trash: seedData.trash,
        clock: seedData.clock,
        games: seedData.games,
        theme: seedData.theme
      });
      applyDataFromObject(seedData);
      if (legacyLocalData) hideSyncBanner("Datos antiguos subidos a tu cuenta");
    }
  } catch (e) {
    console.warn("Error en migracion/carga:", e);
    const fallbackLocalData = readLegacyLocalData();
    if (fallbackLocalData) {
      applyDataFromObject(fallbackLocalData);
      showSyncBanner("Mostrando la copia local del dispositivo");
      return;
    }
    loadData();
  }
}

function applyDataFromObject(data) {
  state.workEntries   = Array.isArray(data.workEntries)   ? data.workEntries   : [];
  state.tasks         = Array.isArray(data.tasks)         ? data.tasks         : [];
  state.horses        = Array.isArray(data.horses)        ? data.horses.map(normalizeHorse) : [];
  state.calendarNotes = Array.isArray(data.calendarNotes) ? data.calendarNotes : [];
  state.generalNotes  = Array.isArray(data.generalNotes)  ? data.generalNotes  : [];
  state.trash         = Array.isArray(data.trash)         ? data.trash         : [];
  state.games         = normalizeGamesData(data.games);
  if (data.clock && Array.isArray(data.clock.segments)) state.clock = data.clock;
  persistLocalSnapshot();
}

function showSyncBanner(msg) {
  let banner = $("#syncBanner");
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "syncBanner";
    banner.className = "sync-banner";
    document.body.appendChild(banner);
  }
  banner.textContent = msg;
  banner.classList.add("visible");
}

function hideSyncBanner(successMsg) {
  const banner = $("#syncBanner");
  if (!banner) return;
  if (successMsg) {
    banner.textContent = successMsg;
    setTimeout(() => banner.classList.remove("visible"), 3000);
  } else {
    banner.classList.remove("visible");
  }
}

function openAdminModal() {
  if (!state.isAdmin) return;
  renderAdminPanel();
  $("#adminModal")?.classList.add("open");
}

function closeAdminModal() {
  $("#adminModal")?.classList.remove("open");
}

// -- Botón auth unificado --------------------------------------
document.getElementById("googleLoginBtn")?.addEventListener("click", loginWithGoogle);

// -- Botón sincronizar -----------------------------------------
document.getElementById("syncBtn")?.addEventListener("click", manualSync);

async function manualSync() {
  const btn = $("#syncBtn");
  const icon = btn?.querySelector(".sync-icon");
  const check = btn?.querySelector(".sync-check");
  const user = currentUser();
  if (!user) return;

  icon?.classList.add("spinning");
  if (check) check.style.display = "none";
  if (icon) icon.style.display = "";

  try {
    const payload = buildCloudPayload();
    await setDoc(doc(db, "users", user.uid, "data", "main"), payload);
    await syncOptionalRemoteData();
    icon?.classList.remove("spinning");
    if (icon) icon.style.display = "none";
    if (check) check.style.display = "";
    setTimeout(() => {
      if (icon) icon.style.display = "";
      if (check) check.style.display = "none";
    }, 2500);
  } catch (e) {
    icon?.classList.remove("spinning");
    alert("Error al sincronizar: " + e.message);
  }
}

// -- PWA install -----------------------------------------------
let _installPrompt = null;
const INSTALL_DISMISSED_KEY = "fincaPlanner.installDismissed";

function updateInstallBtn() {
  const btn = $("#installBtn");
  if (!btn) return;
  btn.style.opacity = "1";
  btn.disabled = false;
  btn.title = _installPrompt ? "Instalar app" : "Cómo instalar la app";
}

function showInstallGuide() {
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isAndroid = /android/i.test(navigator.userAgent);
  let msg = "";
  if (isIOS) {
    msg = "En iPhone/iPad:\n1. Pulsa el botón compartir (□↑) en Safari\n2. Selecciona «Añadir a pantalla de inicio»\n3. Pulsa «Añadir»";
  } else if (isAndroid) {
    msg = "En Android:\n1. Abre el menú de Chrome (⋮)\n2. Selecciona «Añadir a pantalla de inicio» o «Instalar app»\n3. Confirma";
  } else {
    msg = "En ordenador:\n1. En Chrome/Edge busca el icono ⊕ en la barra de direcciones\n2. O abre el menú (⋮) → «Instalar Hípica App»";
  }
  alert(msg);
}

function showInstallBanner() {
  const banner = $("#installBanner");
  if (banner) banner.style.display = "";
}

function hideInstallBanner() {
  const banner = $("#installBanner");
  if (banner) banner.style.display = "none";
}

async function triggerInstall() {
  if (!_installPrompt) {
    showInstallGuide();
    return;
  }
  _installPrompt.prompt();
  const { outcome } = await _installPrompt.userChoice;
  if (outcome === "accepted") {
    _installPrompt = null;
    hideInstallBanner();
    updateInstallBtn();
  }
}

function handleInstallPrompt(e) {
  e.preventDefault();
  _installPrompt = e;
  updateInstallBtn();
  if (!localStorage.getItem(INSTALL_DISMISSED_KEY)) {
    setTimeout(showInstallBanner, 3000);
  }
}

// Recoger el evento si ya fue capturado por el script inline del <head>
if (window._installPromptEvent) {
  handleInstallPrompt(window._installPromptEvent);
}
window.addEventListener("beforeinstallprompt", handleInstallPrompt);

window.addEventListener("appinstalled", () => {
  _installPrompt = null;
  hideInstallBanner();
  updateInstallBtn();
  localStorage.setItem(INSTALL_DISMISSED_KEY, "installed");
});

document.getElementById("installBtn")?.addEventListener("click", triggerInstall);
document.getElementById("installBannerBtn")?.addEventListener("click", triggerInstall);
document.getElementById("installBannerDismiss")?.addEventListener("click", () => {
  hideInstallBanner();
  localStorage.setItem(INSTALL_DISMISSED_KEY, "dismissed");
});

updateInstallBtn();

// -- Service Worker --------------------------------------------
if ("serviceWorker" in navigator) {
  let refreshingFromServiceWorker = false;

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshingFromServiceWorker) return;
    refreshingFromServiceWorker = true;
    window.location.reload();
  });

  navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" })
    .then((registration) => {
      if (registration.waiting) {
        registration.waiting.postMessage({ type: "SKIP_WAITING" });
      }

      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        if (!newWorker) return;
        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            newWorker.postMessage({ type: "SKIP_WAITING" });
          }
        });
      });

      registration.update().catch(() => {});
      setInterval(() => registration.update().catch(() => {}), 60000);
    })
    .catch((e) => console.warn("SW:", e));
}

// -- Ripple effect on buttons ----------------------------------
document.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn || btn.classList.contains("no-ripple")) return;
  const rect = btn.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height) * 2;
  const x = e.clientX - rect.left - size / 2;
  const y = e.clientY - rect.top - size / 2;
  const ripple = document.createElement("span");
  ripple.className = "ripple-wave";
  ripple.style.cssText = `width:${size}px;height:${size}px;left:${x}px;top:${y}px`;
  btn.appendChild(ripple);
  ripple.addEventListener("animationend", () => ripple.remove());
});

init();























