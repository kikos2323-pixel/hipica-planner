(function () {
  const RUNNER_BASE_SPRITE = [
    "............................",
    "................MM..........",
    "..............MMCCM.........",
    ".............MCCCCCM........",
    ".......OOOO..CCCCCCO........",
    ".....OOCCCCOOCCCCCCCO.......",
    "....OCCCCCCCCCCCCCCCCO......",
    "....OCCCCCCCCCCCCCCCO.......",
    "....OCCCCPPCCCCCCCCCO.......",
    ".....OCCCCCCCCCCCCCDO.......",
    "TT...ODCCCCCCCCCCCDO........",
    ".T...ODDCCCCCCDDDDO.........",
    ".....OD..DD..DD............",
    ".....HH..HH..HH............",
    "............................",
    "............................"
  ];

  const RUNNER_PINTO_MASK = [
    "............................",
    "............................",
    "............................",
    "............................",
    "............................",
    "............................",
    "........PP......PP..........",
    ".........PPP..PPP...........",
    "...........PPPP.............",
    "............................",
    "............................",
    "............................",
    "............................",
    "............................",
    "............................",
    "............................"
  ];

  const RUNNER_OVERO_MASK = [
    "............................",
    "............................",
    "............................",
    "............................",
    "............................",
    "............................",
    "..........PPPP..............",
    "........PP....PP............",
    ".............PPP............",
    "..........PP................",
    "............................",
    "............................",
    "............................",
    "............................",
    "............................",
    "............................"
  ];

  const RUNNER_APPALOOSA_MASK = [
    "............................",
    "............................",
    "............................",
    "............................",
    "............................",
    "............................",
    "........P.P.P.P.............",
    ".........P.P.P..............",
    "........P.P.P.P.............",
    ".........P.P.P..............",
    "............................",
    "............................",
    "............................",
    "............................",
    "............................",
    "............................"
  ];

  const FLAPPY_HORSE_THEMES = [
    { id: "castano", label: "Sombra", coat: "#23242a", shade: "#111319", mane: "#08090d", wing: "#eef2ff", wingShade: "#bbc8e6", accent: "#8a79ff", mark: "#f7f8ff", eye: "#fafbff", iconBg: "#dff2ff" },
    { id: "gris", label: "Plata", coat: "#d2d7df", shade: "#9aa3b3", mane: "#555e6f", wing: "#f8fbff", wingShade: "#d7e4f2", accent: "#55cdf6", mark: "#ffffff", eye: "#1a2230", iconBg: "#edf8ff" },
    { id: "palomino", label: "Brasa", coat: "#f2ddae", shade: "#d7b97c", mane: "#fff4d4", wing: "#fff7df", wingShade: "#eed8a2", accent: "#ffae3d", mark: "#fffdf3", eye: "#2c2417", iconBg: "#fff2d8" },
    { id: "alazan", label: "Viento", coat: "#94452c", shade: "#6d2e1c", mane: "#1f1410", wing: "#f2f2f2", wingShade: "#d5d5d5", accent: "#78d4ff", mark: "#fff1ea", eye: "#fff6ef", iconBg: "#eceff5" },
    { id: "negro", label: "Obsidiana", coat: "#101116", shade: "#050608", mane: "#1a1c23", wing: "#cfd6df", wingShade: "#8f98a7", accent: "#f0c34a", mark: "#b6bcc8", eye: "#f7fbff", iconBg: "#e8edf6" },
    { id: "pinto", label: "Tormenta", coat: "#21242a", shade: "#111319", mane: "#050608", wing: "#dfeaff", wingShade: "#9cc3ff", accent: "#4b86ff", mark: "#ffffff", eye: "#fdfefe", iconBg: "#e7f0ff" },
    { id: "overo", label: "Carmesi", coat: "#5a2e2b", shade: "#351919", mane: "#161113", wing: "#ffe6ef", wingShade: "#ffb6ca", accent: "#ff4da2", mark: "#fff3f6", eye: "#fff8fb", iconBg: "#fff0f5" },
    { id: "appaloosa", label: "Eclipse", coat: "#47382f", shade: "#2d221c", mane: "#09090b", wing: "#fff2cc", wingShade: "#e3bc57", accent: "#f8d24a", mark: "#f7ead8", eye: "#fffdf9", iconBg: "#fff4da" }
  ];

  const RUNNER_HORSE_THEMES = [
    { id: "castano", label: "Castano", C: "#654029", D: "#412719", M: "#d8c0a0", H: "#24160f", E: "#111111", W: "#f8efe1", P: "#7f5336", S: "#7c5738", O: "#140d09", iconBg: "#f5e7d5" },
    { id: "gris", label: "Tordo", C: "#dde1e4", D: "#a7afb5", M: "#727b84", H: "#2f3337", E: "#171b1e", W: "#ffffff", P: "#ced3d7", S: "#b6bec4", O: "#1e2327", iconBg: "#edf4f8" },
    { id: "palomino", label: "Crema", C: "#f1d7a2", D: "#c9a56b", M: "#fff1d2", H: "#49311f", E: "#211810", W: "#fffaf0", P: "#ebc882", S: "#d0ae78", O: "#27170d", iconBg: "#fff0d0" },
    { id: "alazan", label: "Alazan", C: "#a8562f", D: "#76361d", M: "#1e1410", H: "#1f120d", E: "#fff5ee", W: "#fce0d1", P: "#c56d40", S: "#92603b", O: "#20110c", iconBg: "#ffe7dc" },
    { id: "negro", label: "Negro", C: "#23252a", D: "#111216", M: "#0a0b0d", H: "#070809", E: "#f3f6ff", W: "#b4bdca", P: "#3a3d45", S: "#b53935", O: "#050607", iconBg: "#eceff3" },
    { id: "pinto", label: "Pinto N.", C: "#efebe2", D: "#161718", M: "#7f5b43", H: "#17100d", E: "#141414", W: "#ffffff", P: "#212328", S: "#dad1c0", O: "#14110f", iconBg: "#f5f0e7" },
    { id: "overo", label: "Pinto C.", C: "#f0e9de", D: "#b2602d", M: "#8b4722", H: "#23150f", E: "#16100c", W: "#fffdf9", P: "#bb6a35", S: "#d4c2aa", O: "#1b120d", iconBg: "#fff2e3" },
    { id: "appaloosa", label: "Appaloosa", C: "#936139", D: "#683f25", M: "#3d2517", H: "#20120c", E: "#14110d", W: "#f3e1c5", P: "#e8d5b5", S: "#b9895b", O: "#1a100b", iconBg: "#f7ead8" }
  ];

  const PIXEL_HORSE_THEMES = RUNNER_HORSE_THEMES;

  const LEGACY_HORSE_MAP = {
    "horse-caramelo": "castano",
    "horse-arcoiris": "palomino",
    "horse-deportivo": "negro",
    "horse-princesa": "palomino",
    "horse-vaquero": "alazan",
    "horse-fantasia-azul": "gris",
    "horse-fuego": "alazan",
    "horse-bosque": "appaloosa",
    "horse-nieve": "gris",
    "horse-neon": "negro",
    "bird-tropical": "castano",
    "bird-pirata": "negro",
    "bird-nube": "palomino",
    "bird-fuego": "alazan",
    "bird-cielo": "gris",
    tordo: "gris",
    crema: "palomino",
    rosillo: "alazan"
  };

  const FLAPPY_ID_SET = new Set(FLAPPY_HORSE_THEMES.map((theme) => theme.id));
  const RUNNER_ID_SET = new Set(RUNNER_HORSE_THEMES.map((theme) => theme.id));

  function normalizeRunnerThemeId(id) {
    const next = LEGACY_HORSE_MAP[id] || id;
    return RUNNER_ID_SET.has(next) ? next : RUNNER_HORSE_THEMES[0].id;
  }

  function normalizeFlappyThemeId(id) {
    const next = LEGACY_HORSE_MAP[id] || id;
    return FLAPPY_ID_SET.has(next) ? next : FLAPPY_HORSE_THEMES[0].id;
  }

  function normalizeThemeId(id) {
    return normalizeRunnerThemeId(id);
  }

  function runnerThemeById(id) {
    const normalized = normalizeRunnerThemeId(id);
    return RUNNER_HORSE_THEMES.find((theme) => theme.id === normalized) || RUNNER_HORSE_THEMES[0];
  }

  function flappyThemeById(id) {
    const normalized = normalizeFlappyThemeId(id);
    return FLAPPY_HORSE_THEMES.find((theme) => theme.id === normalized) || FLAPPY_HORSE_THEMES[0];
  }

  function themeById(id) {
    return runnerThemeById(id);
  }

  function drawSprite(ctx, sprite, ox, oy, px, palette) {
    ctx.imageSmoothingEnabled = false;
    sprite.forEach((row, ry) => {
      for (let cx = 0; cx < row.length; cx += 1) {
        const key = row[cx];
        if (key === ".") continue;
        const fill = palette[key];
        if (!fill) continue;
        ctx.fillStyle = fill;
        ctx.fillRect(ox + cx * px, oy + ry * px, px, px);
      }
    });
  }

  function buildSvgFromSprite(sprite, px, palette, className = "") {
    const width = sprite[0].length * px;
    const height = sprite.length * px;
    let rects = "";
    sprite.forEach((row, ry) => {
      for (let cx = 0; cx < row.length; cx += 1) {
        const key = row[cx];
        if (key === ".") continue;
        const fill = palette[key];
        if (!fill) continue;
        rects += `<rect x="${cx * px}" y="${ry * px}" width="${px}" height="${px}" fill="${fill}"/>`;
      }
    });
    const attr = className ? ` class="${className}"` : "";
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" shape-rendering="crispEdges"${attr}>${rects}</svg>`;
  }

  function patchMaskForTheme(theme) {
    if (theme.id === "pinto") return RUNNER_PINTO_MASK;
    if (theme.id === "overo") return RUNNER_OVERO_MASK;
    if (theme.id === "appaloosa") return RUNNER_APPALOOSA_MASK;
    return null;
  }

  function drawRunnerHorse(ctx, ox, oy, px, theme) {
    const palette = runnerThemeById(theme?.id || theme);
    drawSprite(ctx, RUNNER_BASE_SPRITE, ox, oy, px, palette);
    const patchMask = patchMaskForTheme(palette);
    if (patchMask) {
      drawSprite(ctx, patchMask, ox, oy, px, { P: palette.P });
    }
  }

  function pixelHorseSvg(px, theme) {
    const palette = runnerThemeById(theme?.id || theme);
    let rects = buildSvgFromSprite(RUNNER_BASE_SPRITE, px, palette).replace("</svg>", "");
    const patchMask = patchMaskForTheme(palette);
    if (patchMask) {
      rects += buildSvgFromSprite(patchMask, px, { P: palette.P }).replace(/^<svg[^>]*>|<\/svg>$/g, "");
    }
    return `${rects}</svg>`;
  }

  function drawPixelHorse(ctx, ox, oy, px, theme) {
    drawRunnerHorse(ctx, ox, oy, px, theme);
  }

  function drawFlappyHorse(ctx, x, y, scale, theme, options = {}) {
    const palette = flappyThemeById(theme?.id || theme);
    const wingLift = Math.max(-1, Math.min(1, Number(options.wingLift) || 0));
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.fillStyle = palette.wingShade;
    ctx.beginPath();
    ctx.moveTo(-6, -3);
    ctx.quadraticCurveTo(-18, -26 - wingLift * 8, -3, -34 - wingLift * 4);
    ctx.quadraticCurveTo(7, -18 - wingLift * 6, 1, -5);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = palette.wing;
    ctx.beginPath();
    ctx.moveTo(2, -5);
    ctx.quadraticCurveTo(20, -30 - wingLift * 11, 7, -44 - wingLift * 3);
    ctx.quadraticCurveTo(-5, -24 - wingLift * 4, 6, -2);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = palette.outline || palette.shade;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-22, 8);
    ctx.lineTo(-28, 26);
    ctx.moveTo(-4, 9);
    ctx.lineTo(-10, 28);
    ctx.moveTo(16, 8);
    ctx.lineTo(20, 28);
    ctx.moveTo(28, 6);
    ctx.lineTo(30, 24);
    ctx.stroke();

    ctx.strokeStyle = palette.mane;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-28, -4);
    ctx.quadraticCurveTo(-40, 0, -42, 12);
    ctx.stroke();

    ctx.fillStyle = palette.coat;
    ctx.beginPath();
    ctx.ellipse(0, 0, 30, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = palette.shade;
    ctx.beginPath();
    ctx.ellipse(6, 3, 22, 9, 0.08, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = palette.coat;
    ctx.beginPath();
    ctx.moveTo(12, -8);
    ctx.quadraticCurveTo(26, -22, 38, -16);
    ctx.quadraticCurveTo(46, -13, 44, -6);
    ctx.quadraticCurveTo(40, -2, 30, 0);
    ctx.lineTo(16, 2);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = palette.shade;
    ctx.beginPath();
    ctx.moveTo(18, -6);
    ctx.quadraticCurveTo(26, -16, 36, -12);
    ctx.quadraticCurveTo(31, -4, 22, -1);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = palette.mane;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(8, -11);
    ctx.lineTo(16, -20);
    ctx.lineTo(21, -8);
    ctx.stroke();

    ctx.fillStyle = palette.mane;
    ctx.beginPath();
    ctx.moveTo(36, -18);
    ctx.lineTo(39, -25);
    ctx.lineTo(41, -17);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = palette.mark;
    ctx.beginPath();
    ctx.ellipse(34, -11, 3.6, 2.6, -0.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = palette.eye;
    ctx.beginPath();
    ctx.arc(38, -11, 1.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = palette.accent;
    ctx.fillRect(-4, -5, 12, 6);
    ctx.fillRect(5, -4, 8, 4);

    ctx.restore();
  }

  function drawFlappyHorsePreview(ctx, theme) {
    const palette = flappyThemeById(theme?.id || theme);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.fillStyle = palette.iconBg || "#eef5ff";
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    drawFlappyHorse(ctx, 34, 33, 0.78, palette, { wingLift: -0.3 });
  }

  function drawHorseGameIcon(ctx, variant, theme) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    if (variant === "flappy") {
      const palette = flappyThemeById(theme?.id || theme);
      ctx.fillStyle = "#dff5ff";
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.fillStyle = "rgba(92, 170, 255, 0.20)";
      ctx.beginPath();
      ctx.arc(73, 16, 14, 0, Math.PI * 2);
      ctx.fill();
      drawFlappyHorse(ctx, 43, 42, 0.72, palette, { wingLift: 0.55 });
      ctx.strokeStyle = "rgba(78, 148, 255, 0.45)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(8, 56);
      ctx.lineTo(24, 50);
      ctx.lineTo(40, 56);
      ctx.stroke();
      return;
    }

    const palette = runnerThemeById(theme?.id || theme);
    ctx.fillStyle = palette.iconBg || "#f6efe1";
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    drawRunnerHorse(ctx, 8, 8, 3, palette);
    ctx.fillStyle = "rgba(63, 44, 30, 0.18)";
    ctx.fillRect(8, 58, 76, 3);
    ctx.fillStyle = "rgba(96, 70, 46, 0.22)";
    ctx.fillRect(66, 13, 14, 2);
    ctx.fillRect(70, 19, 10, 2);
    ctx.fillRect(74, 25, 6, 2);
  }

  window.GAME_CHARACTERS = {
    PIXEL_HORSE_THEMES,
    RUNNER_HORSE_THEMES,
    FLAPPY_HORSE_THEMES,
    LEGACY_HORSE_MAP,
    normalizeThemeId,
    normalizeRunnerThemeId,
    normalizeFlappyThemeId,
    themeById,
    runnerThemeById,
    flappyThemeById,
    drawPixelHorse,
    drawRunnerHorse,
    pixelHorseSvg,
    drawFlappyHorse,
    drawFlappyHorsePreview,
    drawHorseGameIcon
  };
})();
