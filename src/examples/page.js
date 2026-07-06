import { EXAMPLES } from './catalog.js';
import { buildViewerUrl } from '../ui/url-state.js';
import { SPECIES } from '../species/index.js';

const BIOME_ACCENT = {
  temperate: '#6b8f71',
  desert: '#b8956a',
  volcanic: '#9a5c4e',
  alpine: '#7a9eb8',
};

const grid = document.getElementById('gallery');
const base = import.meta.env?.BASE_URL ?? '/';

function accentFor(example) {
  const biome = SPECIES[example.speciesKey]?.biome ?? 'temperate';
  return BIOME_ACCENT[biome] ?? '#8a919c';
}

function tagHtml(tags = []) {
  return tags.map((t) => `<span class="tag">${t}</span>`).join('');
}

function cardHtml(example) {
  const href = buildViewerUrl(example, base);
  const species = SPECIES[example.speciesKey];
  const accent = accentFor(example);
  const meta = [
    species?.name ?? example.speciesKey,
    `seed ${example.seed}`,
    example.sceneMode === 'living' ? 'living scene' : null,
    example.overlay?.snow ? `snow ${Math.round(example.overlay.snow * 100)}%` : null,
    example.overlay?.moss ? `moss ${Math.round(example.overlay.moss * 100)}%` : null,
  ].filter(Boolean).join(' · ');

  return `
    <a class="card" href="${href}" style="--accent:${accent}">
      <div class="swatch" aria-hidden="true"></div>
      <div class="body">
        <h2>${example.title}</h2>
        <p class="meta">${meta}</p>
        <p class="desc">${example.description}</p>
        <div class="tags">${tagHtml(example.tags)}</div>
      </div>
      <span class="cta">Open in viewer →</span>
    </a>
  `;
}

if (grid) {
  grid.innerHTML = EXAMPLES.map(cardHtml).join('');
}
