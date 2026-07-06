const BASE = `${import.meta.env?.BASE_URL ?? '/'}assets/textures`;

/** @param {string} filename */
export function textureUrl(filename) {
  return `${BASE}/${filename}`;
}

/** @param {string} filename */
export function overlayTextureUrl(filename) {
  return `${BASE}/overlays/${filename}`;
}
