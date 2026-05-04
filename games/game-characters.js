(function () {
  const PIXEL_HORSE_SPRITE = [
    "....................",
    "..............MM....",
    ".............MBBM...",
    "............MBBBBM..",
    "...........MBBBBBB..",
    "....MMMMMM..BBEBBB..",
    "...MBBBBBBBBBBBBBB..",
    "...MBBBBBBBBBBBBB...",
    "...MBBBBSSBBBBBBB...",
    "....BBBBBBBBBBBBD...",
    "TT..DBBBBBBBBBBD....",
    ".T..DDBBBBBBDD......",
    "....DD..DD..DD......",
    "....HH..HH..HH......"
  ];

  const PIXEL_HEAD_ICON_RUNNER = [
    "...........",
    "......MM...",
    ".....MBBM..",
    "....MBBBBM.",
    "...MBBBBBB.",
    "..MBBBBEBB.",
    "..BBBBBBBB.",
    "..DBBBBBDD.",
    "...DBBBDD..",
    "....DHH...."
  ];

  const PIXEL_HEAD_ICON_FLAPPY = [
    ".............",
    ".......MM....",
    "......MBBM...",
    ".....MBBBBM..",
    "....MBBBBBB..",
    "...MBBBBEBBM.",
    "...BBBBBBBBM.",
    "...DBBBBBBD..",
    "..MMDBBBDD...",
    ".MWWWDHH....."
  ];

  const PIXEL_HORSE_THEMES = [
    { id: "castano", label: "Bayo oscuro", coat: "#6d4228", dark: "#47291a", mane: "#d8c1a0", saddle: "#d7c9b3", hoof: "#24150f", mark: "#f4efe7" },
    { id: "gris", label: "Gris claro", coat: "#e5e5e3", dark: "#bfc2c4", mane: "#767d84", saddle: "#cfd5d9", hoof: "#36393d", mark: "#ffffff" },
    { id: "palomino", label: "Palomino", coat: "#f1d39e", dark: "#d2b27d", mane: "#fff2d0", saddle: "#e6d7b2", hoof: "#46301f", mark: "#fff7e8" },
    { id: "alazan", label: "Alazan", coat: "#b5622e", dark: "#87441e", mane: "#5c2d16", saddle: "#8d5b37", hoof: "#22130d", mark: "#ffd2b4" },
    { id: "negro", label: "Negro", coat: "#2d2f34", dark: "#16181b", mane: "#5c6168", saddle: "#b83939", hoof: "#090a0c", mark: "#545963" },
    { id: "tordo", label: "Tordo", coat: "#d9dce0", dark: "#9fa5aa", mane: "#3f454b", saddle: "#7a8288", hoof: "#282d31", mark: "#f6f7f8" },
    { id: "pinto", label: "Pinto negro", coat: "#f2f1ee", dark: "#202226", mane: "#7f5d48", saddle: "#d9d6cc", hoof: "#1a120f", mark: "#8a5d40" },
    { id: "overo", label: "Pinto canela", coat: "#f3efe8", dark: "#b46430", mane: "#8c4c24", saddle: "#e0ddd4", hoof: "#23160f", mark: "#b96d33" },
    { id: "appaloosa", label: "Appaloosa", coat: "#9a6337", dark: "#6a4024", mane: "#4d2d1a", saddle: "#b78555", hoof: "#23160f", mark: "#f3e0c4" },
    { id: "crema", label: "Crema", coat: "#f2ead6", dark: "#d5c9aa", mane: "#f6f1e2", saddle: "#c63e3e", hoof: "#5f4833", mark: "#ffffff" },
    { id: "rosillo", label: "Rosillo", coat: "#c75d55", dark: "#963f38", mane: "#16181b", saddle: "#cf7f77", hoof: "#1c1110", mark: "#e79d98" }
  ];

  const LEGACY_HORSE_MAP = {
    "horse-caramelo": "castano",
    "horse-arcoiris": "palomino",
    "horse-deportivo": "negro",
    "horse-princesa": "crema",
    "horse-vaquero": "alazan",
    "horse-fantasia-azul": "gris",
    "horse-fuego": "rosillo",
    "horse-bosque": "appaloosa",
    "horse-nieve": "tordo",
    "horse-neon": "negro"
  };

  const COLOR_MAP_KEYS = {
    B: "coat",
    M: "mane",
    T: "mane",
    S: "saddle",
    D: "dark",
    H: "hoof",
    E: "eye",
    W: "mark"
  };

  function normalizeThemeId(id) {
    const next = LEGACY_HORSE_MAP[id] || id;
    return PIXEL_HORSE_THEMES.some((theme) => theme.id === next) ? next : PIXEL_HORSE_THEMES[0].id;
  }

  function themeById(id) {
    const normalized = normalizeThemeId(id);
    return PIXEL_HORSE_THEMES.find((theme) => theme.id === normalized) || PIXEL_HORSE_THEMES[0];
  }

  function drawFromSprite(ctx, sprite, ox, oy, px, palette) {
    ctx.imageSmoothingEnabled = false;
    sprite.forEach((row, ry) => {
      for (let cx = 0; cx < row.length; cx += 1) {
        const key = row[cx];
        if (key === ".") continue;
        const paletteKey = COLOR_MAP_KEYS[key];
        const fill = palette[paletteKey];
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
        const paletteKey = COLOR_MAP_KEYS[key];
        const fill = palette[paletteKey];
        if (!fill) continue;
        rects += `<rect x="${cx * px}" y="${ry * px}" width="${px}" height="${px}" fill="${fill}"/>`;
      }
    });
    const attr = className ? ` class="${className}"` : "";
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" shape-rendering="crispEdges"${attr}>${rects}</svg>`;
  }

  function drawPixelHorse(ctx, ox, oy, px, theme) {
    drawFromSprite(ctx, PIXEL_HORSE_SPRITE, ox, oy, px, themeById(theme?.id || theme));
  }

  function pixelHorseSvg(px, theme) {
    return buildSvgFromSprite(PIXEL_HORSE_SPRITE, px, themeById(theme?.id || theme));
  }

  function drawHorseGameIcon(ctx, variant, theme) {
    const palette = themeById(theme?.id || theme);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.fillStyle = variant === "flappy" ? "#dff5ff" : "#f6efe1";
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    if (variant === "flappy") {
      drawFromSprite(ctx, PIXEL_HEAD_ICON_FLAPPY, 8, 6, 6, { ...palette, mark: "#ffffff" });
    } else {
      drawFromSprite(ctx, PIXEL_HEAD_ICON_RUNNER, 14, 6, 6, { ...palette, mark: "#ffffff" });
    }
  }

  function horseHeadIconSvg(variant, theme) {
    const sprite = variant === "flappy" ? PIXEL_HEAD_ICON_FLAPPY : PIXEL_HEAD_ICON_RUNNER;
    return buildSvgFromSprite(sprite, 6, { ...themeById(theme?.id || theme), mark: "#ffffff" });
  }

  window.GAME_CHARACTERS = {
    PIXEL_HORSE_THEMES,
    LEGACY_HORSE_MAP,
    normalizeThemeId,
    themeById,
    drawPixelHorse,
    pixelHorseSvg,
    drawHorseGameIcon,
    horseHeadIconSvg
  };
})();
