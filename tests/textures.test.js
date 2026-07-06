import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { textureUrl } from '../src/core/textures.js';

describe('textureUrl', () => {
  it('builds path under assets/textures', () => {
    const url = textureUrl('granite_albedo.png');
    assert.ok(url.endsWith('assets/textures/granite_albedo.png'));
  });
});
