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

function appendTags(parent, tags = []) {
  for (const t of tags) {
    const span = document.createElement('span');
    span.className = 'tag';
    span.textContent = t;
    parent.appendChild(span);
  }
}

function createCard(example) {
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

  const a = document.createElement('a');
  a.className = 'card';
  a.href = href;
  a.style.setProperty('--accent', accent);

  const swatch = document.createElement('div');
  swatch.className = 'swatch';
  swatch.setAttribute('aria-hidden', 'true');
  a.appendChild(swatch);

  const body = document.createElement('div');
  body.className = 'body';

  const title = document.createElement('h2');
  title.textContent = example.title;
  body.appendChild(title);

  const metaEl = document.createElement('p');
  metaEl.className = 'meta';
  metaEl.textContent = meta;
  body.appendChild(metaEl);

  const desc = document.createElement('p');
  desc.className = 'desc';
  desc.textContent = example.description;
  body.appendChild(desc);

  const tags = document.createElement('div');
  tags.className = 'tags';
  appendTags(tags, example.tags);
  body.appendChild(tags);

  a.appendChild(body);

  const cta = document.createElement('span');
  cta.className = 'cta';
  cta.textContent = 'Open in viewer →';
  a.appendChild(cta);

  return a;
}

if (grid) {
  grid.replaceChildren(...EXAMPLES.map(createCard));
}
