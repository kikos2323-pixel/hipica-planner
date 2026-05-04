(function () {
  const RUNNER_HORSE_THEMES = [
    { id: "castano", label: "Castano clasico", coat: "#5a3a27", shade: "#3a2418", mane: "#22150f", tack: "#8a5a36", mark: "#f5f0ea", bg: "#f6ece0" },
    { id: "gris", label: "Tordo claro", coat: "#d7dce1", shade: "#a4adb8", mane: "#5b6570", tack: "#7f8b97", mark: "#ffffff", bg: "#edf3f7" },
    { id: "palomino", label: "Palomino", coat: "#e8d1a1", shade: "#c5a777", mane: "#f7eed7", tack: "#b98a4e", mark: "#fff8ec", bg: "#fff1d8" },
    { id: "alazan", label: "Alazan", coat: "#a95531", shade: "#73361d", mane: "#1f1410", tack: "#7e4a27", mark: "#ffe7dc", bg: "#ffebe1" },
    { id: "negro", label: "Negro", coat: "#26272c", shade: "#131418", mane: "#08090b", tack: "#a63737", mark: "#ccd2dc", bg: "#edf0f4" },
    { id: "pinto", label: "Pinto", coat: "#efe8df", shade: "#23252a", mane: "#7d5b45", tack: "#d8ccb9", mark: "#ffffff", bg: "#f7f1ea" },
    { id: "overo", label: "Overo", coat: "#f0e8dd", shade: "#b2612f", mane: "#7f4322", tack: "#cfb79b", mark: "#fffdf8", bg: "#fff1e2" },
    { id: "appaloosa", label: "Appaloosa", coat: "#8a5d38", shade: "#613e26", mane: "#2f1d13", tack: "#c89a63", mark: "#ead7bb", bg: "#f7e8d6" }
  ];

  const FLAPPY_HORSE_THEMES = [
    { id: "castano", label: "Sombra alada", coat: "#1f2127", shade: "#0e1014", mane: "#06070a", wing: "#f0f4ff", wingShade: "#cfd8ea", accent: "#7c8cff", mark: "#fafcff", bg: "#e8f3ff" },
    { id: "gris", label: "Plata alada", coat: "#d3d8de", shade: "#a1aab6", mane: "#616a75", wing: "#fbfdff", wingShade: "#dce5f1", accent: "#55cdf6", mark: "#ffffff", bg: "#eef8ff" },
    { id: "palomino", label: "Aurora", coat: "#ecd8af", shade: "#cfb07d", mane: "#fff3d8", wing: "#fffaf0", wingShade: "#f0dfb0", accent: "#ffc04d", mark: "#fffdf6", bg: "#fff4de" },
    { id: "alazan", label: "Brasa", coat: "#8d4730", shade: "#642d1d", mane: "#181011", wing: "#f6f6f6", wingShade: "#dbdbdb", accent: "#72d0ff", mark: "#fff3ee", bg: "#eef4fb" },
    { id: "negro", label: "Obsidiana", coat: "#111217", shade: "#05060a", mane: "#181a20", wing: "#d5dbe3", wingShade: "#99a3b1", accent: "#f2c84c", mark: "#bec7d3", bg: "#e9eef5" },
    { id: "pinto", label: "Tormenta", coat: "#1f2328", shade: "#0e1014", mane: "#05070a", wing: "#e7f0ff", wingShade: "#a4c3ff", accent: "#4a84ff", mark: "#ffffff", bg: "#e9f1ff" },
    { id: "overo", label: "Carmesi", coat: "#5b302e", shade: "#361a19", mane: "#120d10", wing: "#ffe8ef", wingShade: "#ffc1d2", accent: "#ff56a7", mark: "#fff5f7", bg: "#fff0f5" },
    { id: "appaloosa", label: "Eclipse", coat: "#47372f", shade: "#2b211d", mane: "#09090c", wing: "#fff4d5", wingShade: "#ebc86f", accent: "#f7d24f", mark: "#f8eddf", bg: "#fff5dd" }
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
    crema: "palomino",
    tordo: "gris",
    rosillo: "alazan"
  };

  const RUNNER_IDS = new Set(RUNNER_HORSE_THEMES.map((theme) => theme.id));
  const FLAPPY_IDS = new Set(FLAPPY_HORSE_THEMES.map((theme) => theme.id));

  const RUNNER_PATHS = {
    body: "M34 74 C43 57 69 47 103 47 C131 47 160 58 174 75 C162 82 143 88 121 90 C87 94 55 89 34 74 Z",
    barrel: "M58 58 C79 51 118 52 145 66 C133 74 103 78 76 75 C64 73 55 68 58 58 Z",
    neck: "M119 50 C128 32 144 20 164 17 C178 15 191 21 194 31 C197 41 190 49 176 54 C161 59 146 63 132 68 C129 61 125 55 119 50 Z",
    muzzle: "M176 32 C186 31 196 35 196 42 C196 48 188 51 175 49 Z",
    mane: "M118 50 C125 34 139 22 157 16 C148 26 143 37 141 49 C132 45 125 46 118 50 Z",
    tail: "M34 70 C17 62 9 69 11 80 C13 91 20 94 29 91 C20 86 19 78 23 71 C26 66 30 64 34 65 Z",
    earFront: "M165 17 L170 7 L175 18 Z",
    earBack: "M175 18 L181 8 L185 20 Z",
    legBackRear: "M50 81 C56 88 57 100 55 118 L47 118 C48 104 47 90 43 84 Z",
    legBackFront: "M73 82 C77 89 77 102 74 120 L66 120 C67 106 66 92 61 85 Z",
    legFrontRear: "M119 84 C126 92 127 103 123 118 L115 118 C116 104 114 91 109 84 Z",
    legFrontFront: "M144 82 C151 89 154 102 150 120 L142 120 C144 106 141 91 136 84 Z",
    blaze: "M172 22 C177 26 179 31 177 38 C173 34 171 29 172 22 Z",
    sockBack: "M46 112 L56 112 L56 120 L46 120 Z",
    sockFront: "M141 114 L151 114 L151 120 L141 120 Z"
  };

  const FLAPPY_PATHS = {
    body: "M30 68 C39 54 62 45 90 45 C114 45 138 54 149 68 C139 75 123 80 103 82 C73 86 48 81 30 68 Z",
    barrel: "M51 56 C69 50 99 50 122 60 C113 67 87 71 63 69 C54 68 47 63 51 56 Z",
    neck: "M100 48 C107 33 120 23 137 20 C149 18 160 23 162 31 C165 39 159 46 147 50 C135 54 123 58 111 63 C109 57 105 52 100 48 Z",
    muzzle: "M146 30 C154 29 161 33 161 39 C161 44 154 47 144 45 Z",
    mane: "M100 48 C106 35 118 25 132 20 C126 28 123 37 121 46 C114 43 106 44 100 48 Z",
    tail: "M30 65 C16 59 10 64 11 73 C12 81 17 85 25 84 C18 79 18 72 21 66 C24 62 27 60 30 61 Z",
    wingBack: "M71 44 C47 24 42 4 57 -10 C74 3 83 20 88 40 C82 38 76 39 71 44 Z",
    wingFront: "M83 39 C67 10 78 -12 103 -21 C113 3 112 22 101 44 C95 41 89 39 83 39 Z",
    earFront: "M139 20 L143 11 L147 21 Z",
    earBack: "M147 21 L152 12 L156 23 Z",
    legRear: "M52 75 C57 81 57 90 55 102 L48 102 C49 91 47 82 44 77 Z",
    legFront: "M111 76 C117 83 118 91 115 103 L108 103 C109 92 107 83 103 77 Z",
    blaze: "M143 24 C147 27 148 31 147 36 C143 33 141 29 143 24 Z"
  };

  function normalizeRunnerThemeId(id) {
    const next = LEGACY_HORSE_MAP[id] || id;
    return RUNNER_IDS.has(next) ? next : RUNNER_HORSE_THEMES[0].id;
  }

  function normalizeFlappyThemeId(id) {
    const next = LEGACY_HORSE_MAP[id] || id;
    return FLAPPY_IDS.has(next) ? next : FLAPPY_HORSE_THEMES[0].id;
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

  function fillSvg(path, color, opacity = 1) {
    return `<path d="${path}" fill="${color}" opacity="${opacity}"/>`;
  }

  function outlineSvg(path, color, width = 2, opacity = 0.22) {
    return `<path d="${path}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}"/>`;
  }

  function runnerHorseSvg(scale, theme, className = "") {
    const palette = runnerThemeById(theme?.id || theme);
    const spots = [];
    if (palette.id === "pinto") {
      spots.push('<path d="M78 56 C90 50 102 50 112 58 C103 64 92 65 82 62 Z" fill="#202227"/>');
      spots.push('<path d="M120 66 C128 61 137 61 143 67 C136 72 128 73 121 71 Z" fill="#202227"/>');
    }
    if (palette.id === "overo") {
      spots.push(`<path d="M84 57 C95 52 106 53 115 60 C103 66 91 67 83 63 Z" fill="${palette.shade}"/>`);
      spots.push(`<path d="M124 68 C131 64 140 64 147 69 C139 74 129 75 123 73 Z" fill="${palette.shade}"/>`);
    }
    if (palette.id === "appaloosa") {
      spots.push('<circle cx="83" cy="58" r="2.6" fill="#ead7bb"/><circle cx="95" cy="63" r="2.2" fill="#ead7bb"/><circle cx="109" cy="58" r="2.5" fill="#ead7bb"/><circle cx="122" cy="65" r="2.4" fill="#ead7bb"/>');
    }
    const classes = className ? ` class="${className}"` : "";
    const svg = [
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 210 126" width="${210 * scale}" height="${126 * scale}"${classes}>`,
      fillSvg(RUNNER_PATHS.tail, palette.mane),
      fillSvg(RUNNER_PATHS.body, palette.coat),
      fillSvg(RUNNER_PATHS.barrel, palette.shade, 0.88),
      ...spots,
      fillSvg(RUNNER_PATHS.neck, palette.coat),
      fillSvg(RUNNER_PATHS.muzzle, palette.shade),
      fillSvg(RUNNER_PATHS.mane, palette.mane),
      fillSvg(RUNNER_PATHS.earBack, palette.mane),
      fillSvg(RUNNER_PATHS.earFront, palette.mane),
      fillSvg("M88 55 C95 52 108 52 116 56 L112 64 C103 62 93 62 85 65 Z", palette.tack, 0.92),
      fillSvg(RUNNER_PATHS.legBackRear, palette.shade),
      fillSvg(RUNNER_PATHS.legBackFront, palette.coat),
      fillSvg(RUNNER_PATHS.legFrontRear, palette.shade),
      fillSvg(RUNNER_PATHS.legFrontFront, palette.coat),
      palette.id === "pinto" || palette.id === "overo" ? fillSvg(RUNNER_PATHS.sockBack, palette.mark) : "",
      palette.id === "gris" || palette.id === "palomino" ? fillSvg(RUNNER_PATHS.sockFront, palette.mark) : "",
      palette.id === "castano" || palette.id === "palomino" || palette.id === "gris" ? fillSvg(RUNNER_PATHS.blaze, palette.mark, 0.95) : "",
      `<circle cx="178" cy="33" r="2.1" fill="#111318"/>`,
      outlineSvg(RUNNER_PATHS.body, "#1f1511", 2.2, 0.22),
      outlineSvg(RUNNER_PATHS.neck, "#1f1511", 2, 0.2),
      `</svg>`
    ].join("");
    return svg;
  }

  function pixelHorseSvg(scale, theme) {
    return runnerHorseSvg(scale, theme);
  }

  function applyPath(ctx, path, fill) {
    ctx.fillStyle = fill;
    ctx.fill(new Path2D(path));
  }

  function applyStroke(ctx, path, stroke, width, opacity) {
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke(new Path2D(path));
    ctx.restore();
  }

  function drawRunnerHorse(ctx, ox, oy, scale, theme) {
    const palette = runnerThemeById(theme?.id || theme);
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(scale, scale);
    applyPath(ctx, RUNNER_PATHS.tail, palette.mane);
    applyPath(ctx, RUNNER_PATHS.body, palette.coat);
    ctx.save();
    ctx.globalAlpha = 0.88;
    applyPath(ctx, RUNNER_PATHS.barrel, palette.shade);
    ctx.restore();
    if (palette.id === "pinto") {
      applyPath(ctx, "M78 56 C90 50 102 50 112 58 C103 64 92 65 82 62 Z", "#202227");
      applyPath(ctx, "M120 66 C128 61 137 61 143 67 C136 72 128 73 121 71 Z", "#202227");
    }
    if (palette.id === "overo") {
      applyPath(ctx, "M84 57 C95 52 106 53 115 60 C103 66 91 67 83 63 Z", palette.shade);
      applyPath(ctx, "M124 68 C131 64 140 64 147 69 C139 74 129 75 123 73 Z", palette.shade);
    }
    if (palette.id === "appaloosa") {
      ctx.fillStyle = "#ead7bb";
      [[83, 58, 2.6], [95, 63, 2.2], [109, 58, 2.5], [122, 65, 2.4]].forEach(([x, y, r]) => {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    applyPath(ctx, RUNNER_PATHS.neck, palette.coat);
    applyPath(ctx, RUNNER_PATHS.muzzle, palette.shade);
    applyPath(ctx, RUNNER_PATHS.mane, palette.mane);
    applyPath(ctx, RUNNER_PATHS.earBack, palette.mane);
    applyPath(ctx, RUNNER_PATHS.earFront, palette.mane);
    applyPath(ctx, "M88 55 C95 52 108 52 116 56 L112 64 C103 62 93 62 85 65 Z", palette.tack);
    applyPath(ctx, RUNNER_PATHS.legBackRear, palette.shade);
    applyPath(ctx, RUNNER_PATHS.legBackFront, palette.coat);
    applyPath(ctx, RUNNER_PATHS.legFrontRear, palette.shade);
    applyPath(ctx, RUNNER_PATHS.legFrontFront, palette.coat);
    if (palette.id === "pinto" || palette.id === "overo") applyPath(ctx, RUNNER_PATHS.sockBack, palette.mark);
    if (palette.id === "gris" || palette.id === "palomino") applyPath(ctx, RUNNER_PATHS.sockFront, palette.mark);
    if (palette.id === "castano" || palette.id === "palomino" || palette.id === "gris") applyPath(ctx, RUNNER_PATHS.blaze, palette.mark);
    ctx.fillStyle = "#121317";
    ctx.beginPath();
    ctx.arc(178, 33, 2.1, 0, Math.PI * 2);
    ctx.fill();
    applyStroke(ctx, RUNNER_PATHS.body, "#1f1511", 2.2, 0.22);
    applyStroke(ctx, RUNNER_PATHS.neck, "#1f1511", 2, 0.2);
    ctx.restore();
  }

  function drawFlappyHorse(ctx, x, y, scale, theme, options = {}) {
    const palette = flappyThemeById(theme?.id || theme);
    const wingLift = Math.max(-1, Math.min(1, Number(options.wingLift) || 0));
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.translate(-86, -56);

    ctx.save();
    ctx.translate(-wingLift * 6, -wingLift * 10);
    applyPath(ctx, FLAPPY_PATHS.wingBack, palette.wingShade);
    ctx.restore();

    ctx.save();
    ctx.translate(wingLift * 4, -wingLift * 16);
    applyPath(ctx, FLAPPY_PATHS.wingFront, palette.wing);
    ctx.restore();

    applyPath(ctx, FLAPPY_PATHS.tail, palette.mane);
    applyPath(ctx, FLAPPY_PATHS.body, palette.coat);
    ctx.save();
    ctx.globalAlpha = 0.86;
    applyPath(ctx, FLAPPY_PATHS.barrel, palette.shade);
    ctx.restore();
    applyPath(ctx, FLAPPY_PATHS.neck, palette.coat);
    applyPath(ctx, FLAPPY_PATHS.muzzle, palette.shade);
    applyPath(ctx, FLAPPY_PATHS.mane, palette.mane);
    applyPath(ctx, FLAPPY_PATHS.earBack, palette.mane);
    applyPath(ctx, FLAPPY_PATHS.earFront, palette.mane);
    applyPath(ctx, FLAPPY_PATHS.legRear, palette.shade);
    applyPath(ctx, FLAPPY_PATHS.legFront, palette.coat);
    applyPath(ctx, "M75 54 C82 51 93 51 101 55 L98 61 C91 60 83 60 76 62 Z", palette.accent);
    applyPath(ctx, FLAPPY_PATHS.blaze, palette.mark);
    ctx.fillStyle = "#111318";
    ctx.beginPath();
    ctx.arc(149, 31, 1.9, 0, Math.PI * 2);
    ctx.fill();
    applyStroke(ctx, FLAPPY_PATHS.body, "#171012", 1.8, 0.18);
    applyStroke(ctx, FLAPPY_PATHS.neck, "#171012", 1.8, 0.18);
    ctx.restore();
  }

  function drawFlappyHorsePreview(ctx, theme) {
    const palette = flappyThemeById(theme?.id || theme);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.fillStyle = palette.bg;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    drawFlappyHorse(ctx, 43, 34, 0.62, palette, { wingLift: 0.2 });
  }

  function drawHorseGameIcon(ctx, variant, theme) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    if (variant === "flappy") {
      const palette = flappyThemeById(theme?.id || theme);
      ctx.fillStyle = palette.bg;
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.fillStyle = "rgba(116, 153, 255, 0.18)";
      ctx.beginPath();
      ctx.arc(76, 17, 13, 0, Math.PI * 2);
      ctx.fill();
      drawFlappyHorse(ctx, 48, 42, 0.56, palette, { wingLift: 0.55 });
      return;
    }
    const palette = runnerThemeById(theme?.id || theme);
    ctx.fillStyle = palette.bg;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    drawRunnerHorse(ctx, 4, 6, 0.42, palette);
    ctx.fillStyle = "rgba(85, 62, 42, 0.18)";
    ctx.fillRect(10, 58, 76, 3);
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
    pixelHorseSvg,
    runnerHorseSvg,
    drawPixelHorse: drawRunnerHorse,
    drawRunnerHorse,
    drawFlappyHorse,
    drawFlappyHorsePreview,
    drawHorseGameIcon
  };
})();
