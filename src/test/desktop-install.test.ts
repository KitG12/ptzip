import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Desktop installation', () => {
  it('opens the camera workspace in a standalone app window', () => {
    const manifest = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8'));
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('/');
    expect(manifest.name).toBe('Camera Finder');
  });
});