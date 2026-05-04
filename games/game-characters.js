(function () {
  const horseCss = `
    .horse-run .front-leg-a,.horse-run .back-leg-a{animation:horseLegA .32s steps(2,end) infinite;transform-origin:top center}
    .horse-run .front-leg-b,.horse-run .back-leg-b{animation:horseLegB .32s steps(2,end) infinite;transform-origin:top center}
    .horse-run .tail{animation:tailWave .55s ease-in-out infinite alternate;transform-origin:36px 52px}
    .horse-run .mane{animation:maneWave .5s ease-in-out infinite alternate;transform-origin:82px 30px}
    @keyframes horseLegA{0%{transform:rotate(13deg)}100%{transform:rotate(-16deg)}}
    @keyframes horseLegB{0%{transform:rotate(-16deg)}100%{transform:rotate(13deg)}}
    @keyframes tailWave{from{transform:rotate(-6deg)}to{transform:rotate(9deg)}}
    @keyframes maneWave{from{transform:skewX(-4deg)}to{transform:skewX(6deg)}}
  `;

  const sprite = `
    <svg width="0" height="0" style="position:absolute;left:-9999px;top:-9999px;overflow:hidden" aria-hidden="true">
      <defs>
        <g id="horse-shape"><path class="tail" d="M30 52 C14 42 11 59 5 47 C15 64 22 67 35 58 Z" fill="var(--tail)"/><ellipse cx="61" cy="57" rx="36" ry="22" fill="var(--body)"/><path d="M86 47 C88 30 98 24 108 23 C115 23 121 29 122 36 C124 47 116 54 105 52 C97 51 91 51 86 57 Z" fill="var(--body)"/><path d="M91 37 C96 27 101 20 110 15 C113 20 112 25 106 29 Z" fill="var(--body)"/><path class="mane" d="M87 31 C78 34 80 48 86 58 C94 48 99 37 96 27 Z" fill="var(--mane)"/><ellipse cx="113" cy="36" rx="3" ry="3" fill="#222"/><path d="M119 43 C126 43 130 45 132 49 C126 52 120 51 116 48 Z" fill="var(--muzzle)"/><rect x="57" y="37" width="38" height="15" rx="4" fill="var(--saddle)"/><rect x="65" y="38" width="22" height="4" rx="2" fill="rgba(255,255,255,.45)"/><path class="back-leg-a" d="M41 72 L34 100 L45 100 L51 72 Z" fill="var(--leg)"/><path class="back-leg-b" d="M57 73 L59 101 L70 101 L68 73 Z" fill="var(--leg)"/><path class="front-leg-a" d="M78 72 L73 101 L84 101 L88 72 Z" fill="var(--leg)"/><path class="front-leg-b" d="M94 69 L101 99 L112 99 L104 68 Z" fill="var(--leg)"/><ellipse cx="40" cy="101" rx="8" ry="4" fill="var(--hoof)"/><ellipse cx="65" cy="101" rx="8" ry="4" fill="var(--hoof)"/><ellipse cx="79" cy="101" rx="8" ry="4" fill="var(--hoof)"/><ellipse cx="107" cy="100" rx="8" ry="4" fill="var(--hoof)"/></g>
        <g id="horse-caramelo" style="--body:#c77d3f;--mane:#ff8fc7;--tail:#ff8fc7;--muzzle:#f2c29b;--saddle:#48b8ff;--leg:#a9612f;--hoof:#5a331f"><use href="#horse-shape"/><circle cx="51" cy="45" r="4" fill="#fff3"/><circle cx="38" cy="61" r="3" fill="#fff3"/></g>
        <g id="horse-arcoiris" style="--body:#fff7ef;--mane:#ff4fa3;--tail:#ff4fa3;--muzzle:#ffd7bd;--saddle:#75d5ff;--leg:#f2e5d9;--hoof:#5d5d5d"><use href="#horse-shape"/><path d="M82 23 C88 16 94 16 100 22" fill="none" stroke="#ff4444" stroke-width="4"/><path d="M82 29 C89 21 96 21 103 29" fill="none" stroke="#ffd447" stroke-width="4"/><path d="M83 35 C91 27 99 27 106 35" fill="none" stroke="#57d66b" stroke-width="4"/><circle cx="40" cy="39" r="4" fill="#ffd447"/><circle cx="50" cy="70" r="4" fill="#8e6bff"/></g>
        <g id="horse-deportivo" style="--body:#24262d;--mane:#111;--tail:#111;--muzzle:#3b3d46;--saddle:#ff3c3c;--leg:#202127;--hoof:#000"><use href="#horse-shape"/><path d="M47 51 L76 42 L95 51" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/><rect x="62" y="36" width="16" height="6" rx="2" fill="#ffd447"/></g>
        <g id="horse-princesa" style="--body:#f4d3a1;--mane:#ba7bff;--tail:#ba7bff;--muzzle:#ffe2bd;--saddle:#ff8fd3;--leg:#e8be83;--hoof:#8b5e39"><use href="#horse-shape"/><path d="M99 18 L104 6 L109 18 L114 6 L119 18 Z" fill="#ffd84f"/><circle cx="104" cy="6" r="2" fill="#ff6bd6"/><circle cx="114" cy="6" r="2" fill="#55c8ff"/></g>
        <g id="horse-vaquero" style="--body:#8b542e;--mane:#3c2415;--tail:#3c2415;--muzzle:#b67a4c;--saddle:#6b3f22;--leg:#704121;--hoof:#2b180d"><use href="#horse-shape"/><path d="M94 17 C102 8 116 9 124 18 C118 21 101 22 94 17 Z" fill="#9a632f"/><rect x="104" y="7" width="13" height="9" rx="3" fill="#9a632f"/><path d="M98 54 C106 59 112 59 119 54" fill="none" stroke="#d71920" stroke-width="5"/></g>
        <g id="horse-fantasia-azul" style="--body:#7fdcff;--mane:#236dff;--tail:#236dff;--muzzle:#b8f0ff;--saddle:#7f6bff;--leg:#53b7de;--hoof:#1d4f77"><use href="#horse-shape"/><circle cx="38" cy="43" r="6" fill="#fff8"/><circle cx="47" cy="39" r="4" fill="#fff8"/><circle cx="92" cy="64" r="5" fill="#fff8"/></g>
        <g id="horse-fuego" style="--body:#ff8a1f;--mane:#e82020;--tail:#e82020;--muzzle:#ffc170;--saddle:#252525;--leg:#db6415;--hoof:#351c10"><use href="#horse-shape"/><path d="M84 31 C84 17 95 18 93 6 C104 18 105 28 96 37 Z" fill="#ffd33d"/><path d="M21 49 C8 35 18 28 16 17 C31 30 38 43 32 60 Z" fill="#ffd33d"/></g>
        <g id="horse-bosque" style="--body:#78c26d;--mane:#6a4324;--tail:#6a4324;--muzzle:#aae39b;--saddle:#2f7d46;--leg:#5ca850;--hoof:#33512b"><use href="#horse-shape"/><path d="M51 36 C46 26 57 23 60 32 C66 24 75 31 68 39 Z" fill="#2f9d45"/><path d="M89 21 C84 14 91 9 97 16 C104 9 111 16 104 23 Z" fill="#3fc45d"/></g>
        <g id="horse-nieve" style="--body:#eaf8ff;--mane:#a8b8ca;--tail:#a8b8ca;--muzzle:#ffffff;--saddle:#4aa8ff;--leg:#d4ecf6;--hoof:#78909c"><use href="#horse-shape"/><path d="M91 55 C103 62 111 61 120 55" fill="none" stroke="#4aa8ff" stroke-width="6"/><circle cx="39" cy="38" r="3" fill="#9fdcff"/><circle cx="69" cy="69" r="3" fill="#9fdcff"/><circle cx="102" cy="31" r="3" fill="#9fdcff"/></g>
        <g id="horse-neon" style="--body:#30313a;--mane:#39ff88;--tail:#00e5ff;--muzzle:#4c4d58;--saddle:#ff2fd6;--leg:#25262d;--hoof:#00e5ff"><use href="#horse-shape"/><path d="M34 57 C52 35 80 35 101 52" fill="none" stroke="#39ff88" stroke-width="3" opacity=".9"/><path d="M24 47 C14 39 10 55 5 47" fill="none" stroke="#00e5ff" stroke-width="4"/></g>
      </defs>
    </svg>
  `;

  const horses = [
    { id: "horse-caramelo", name: "Caramelo" },
    { id: "horse-arcoiris", name: "Arcoiris" },
    { id: "horse-deportivo", name: "Deportivo" },
    { id: "horse-princesa", name: "Princesa" },
    { id: "horse-vaquero", name: "Vaquero" },
    { id: "horse-fantasia-azul", name: "Fantasia azul" },
    { id: "horse-fuego", name: "Fuego" },
    { id: "horse-bosque", name: "Bosque" },
    { id: "horse-nieve", name: "Nieve" },
    { id: "horse-neon", name: "Neon" }
  ];

  const birds = [
    { id: "bird-tropical", name: "Tropical", body: "#ffd447", belly: "#fff29e", wing: "#22b573", beak: "#ff8a1f", cheek: "#ff6b9f", feet: "#d78b00", accent: "#22b573", decal: "crest" },
    { id: "bird-cielo", name: "Azul cielo", body: "#66c7ff", belly: "#e4f7ff", wing: "#ffffff", beak: "#ffd447", cheek: "#ff9fb8", feet: "#ffb000", accent: "#ffffff", decal: "bubbles" },
    { id: "bird-sandia", name: "Sandia", body: "#52c75b", belly: "#ff5364", wing: "#2d9d44", beak: "#ffcf33", cheek: "#ff8f9d", feet: "#267d39", accent: "#222", decal: "seeds" },
    { id: "bird-nube", name: "Nube", body: "#ffffff", belly: "#e7f7ff", wing: "#9adeff", beak: "#ffd166", cheek: "#ffc2d4", feet: "#8bc8e8", accent: "#ffffff", decal: "cloud" },
    { id: "bird-robot", name: "Robot", body: "#6d8cff", belly: "#cbd7ff", wing: "#9aa5b1", beak: "#ffb703", cheek: "#59f2ff", feet: "#4b5563", accent: "#dbeafe", decal: "visor" },
    { id: "bird-pirata", name: "Pirata", body: "#e63946", belly: "#ffd6d6", wing: "#111827", beak: "#ffca3a", cheek: "#ff9f1c", feet: "#8d1b22", accent: "#111827", decal: "patch" },
    { id: "bird-unicornio", name: "Unicornio", body: "#ff9de2", belly: "#ffe2f4", wing: "#b98cff", beak: "#ffd447", cheek: "#ff6fcf", feet: "#c96bff", accent: "#ffd84f", decal: "horn" },
    { id: "bird-fuego", name: "Fuego", body: "#ff8c22", belly: "#ffd166", wing: "#e82020", beak: "#ffe45e", cheek: "#ff3c3c", feet: "#b23a00", accent: "#ff3333", decal: "flame" },
    { id: "bird-galaxia", name: "Galaxia", body: "#41246d", belly: "#6b43b8", wing: "#315dff", beak: "#ffcf33", cheek: "#ff6bd6", feet: "#9d7cff", accent: "#ff6bd6", decal: "stars" },
    { id: "bird-payaso", name: "Payaso", body: "#ffd447", belly: "#ffffff", wing: "#ff3b3b", beak: "#3fb5ff", cheek: "#ff4fa3", feet: "#ff8a1f", accent: "#3fb5ff", decal: "clown" }
  ];

  function injectHorseSprite(doc = document) {
    if (doc.getElementById("horse-caramelo")) return;
    const style = doc.createElement("style");
    style.textContent = horseCss;
    doc.head.appendChild(style);
    doc.body.insertAdjacentHTML("afterbegin", sprite);
  }

  function horseSvg(id, className = "horse-run") {
    return `<svg viewBox="0 0 140 110" class="${className}" aria-hidden="true"><use href="#${id}"></use></svg>`;
  }

  // ── Pixel Art Horse System ──────────────────────────────────
  const PIXEL_SPRITE = [
    "................",
    "...........MM...",
    "..........MMMM..",
    ".........MBBBB..",
    "........MMEBBB..",
    "....MMMMMBBBBBB.",
    "....MBBBBBBBBB..",
    "....MBBBSSBBBB..",
    ".....BBBBBBBBD..",
    "TT...DBBBBBBD...",
    ".T...DD...DD....",
    ".....HH...HH....",
  ];

  const PIXEL_HORSE_THEMES = [
    { id: "castano",   label: "Castaño",   coat: "#9b5f33", mane: "#4d2c1a", dark: "#6b3f22", saddle: "#5590d4", hoof: "#2a1810" },
    { id: "negro",     label: "Negro",     coat: "#34363c", mane: "#101114", dark: "#1e2024", saddle: "#cc2244", hoof: "#08090c" },
    { id: "blanco",    label: "Blanco",    coat: "#f0ede3", mane: "#c0b8a8", dark: "#b8b0a0", saddle: "#55aaff", hoof: "#807870" },
    { id: "alazan",    label: "Alazán",    coat: "#c47030", mane: "#6a3818", dark: "#8a4e20", saddle: "#2d9a4a", hoof: "#3a1c0e" },
    { id: "gris",      label: "Gris",      coat: "#a8b0b8", mane: "#6a7278", dark: "#606870", saddle: "#ff8833", hoof: "#3a4048" },
    { id: "palomino",  label: "Palomino",  coat: "#e8c870", mane: "#fff5d0", dark: "#b89840", saddle: "#dd4488", hoof: "#6a4820" },
    { id: "pinto",     label: "Pinto",     coat: "#f0ede3", mane: "#3a2010", dark: "#9a9080", saddle: "#dd3344", hoof: "#2a1810" },
    { id: "appaloosa", label: "Appaloosa", coat: "#d0c0a8", mane: "#3a2818", dark: "#907060", saddle: "#3388cc", hoof: "#2a1e14" },
    { id: "isabela",   label: "Isabela",   coat: "#f0d8a0", mane: "#7a4820", dark: "#b09060", saddle: "#9944cc", hoof: "#5a3818" },
    { id: "tordo",     label: "Tordo",     coat: "#b8b8b4", mane: "#2a2a28", dark: "#787874", saddle: "#22bb66", hoof: "#383838" },
    { id: "moro",      label: "Moro",      coat: "#382818", mane: "#0c0a06", dark: "#201810", saddle: "#ddaa00", hoof: "#100a04" },
    { id: "rosillo",   label: "Rosillo",   coat: "#c09888", mane: "#8a6050", dark: "#907060", saddle: "#cc8822", hoof: "#4a3020" },
  ];

  function drawPixelHorse(ctx, ox, oy, px, theme) {
    const map = {
      B: theme.coat, M: theme.mane, T: theme.mane,
      S: theme.saddle, D: theme.dark, H: theme.hoof, E: "#111"
    };
    ctx.imageSmoothingEnabled = false;
    PIXEL_SPRITE.forEach((row, ry) => {
      for (let cx = 0; cx < row.length; cx++) {
        const c = row[cx];
        if (c === "." || !map[c]) continue;
        ctx.fillStyle = map[c];
        ctx.fillRect(ox + cx * px, oy + ry * px, px, px);
      }
    });
  }

  function pixelHorseSvg(px, theme) {
    const map = {
      B: theme.coat, M: theme.mane, T: theme.mane,
      S: theme.saddle, D: theme.dark, H: theme.hoof, E: "#111"
    };
    const W = 16 * px, H = 12 * px;
    let rects = "";
    PIXEL_SPRITE.forEach((row, ry) => {
      for (let cx = 0; cx < row.length; cx++) {
        const c = row[cx];
        if (c === "." || !map[c]) continue;
        rects += `<rect x="${cx * px}" y="${ry * px}" width="${px}" height="${px}" fill="${map[c]}"/>`;
      }
    });
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" shape-rendering="crispEdges">${rects}</svg>`;
  }

  window.GAME_CHARACTERS = {
    horses, birds, injectHorseSprite, horseSvg,
    PIXEL_HORSE_THEMES, PIXEL_SPRITE, drawPixelHorse, pixelHorseSvg
  };
})();
