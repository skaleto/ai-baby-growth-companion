// Pure helpers for the custom preview video player's progress bar / seeking.
// Kept React-free so they can be unit-tested via scripts/test-preview-video-math.mjs.

export const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

// Fraction (0..1) of playback completed. Returns 0 when duration is unknown/invalid.
export const progressFraction = (currentTime: number, duration: number): number => {
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  return clamp01(currentTime / duration);
};

// Target currentTime (seconds) for a 0..1 fraction. Returns 0 when duration is invalid.
export const seekTimeFromFraction = (fraction: number, duration: number): number => {
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  return clamp01(fraction) * duration;
};

// Convert a pointer x-coordinate over a bar (given its left/width) to a 0..1 fraction.
export const fractionFromPointer = (clientX: number, left: number, width: number): number => {
  if (!Number.isFinite(width) || width <= 0) return 0;
  return clamp01((clientX - left) / width);
};
