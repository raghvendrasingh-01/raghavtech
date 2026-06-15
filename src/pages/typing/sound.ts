// ============ SOUND ============
// Lightweight keypress / error click sounds via the Web Audio API.
// No assets needed — tones are synthesized on the fly.

let ctx: AudioContext | null = null;

const getCtx = (): AudioContext | null => {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
};

const blip = (freq: number, duration: number, type: OscillatorType, gain: number) => {
  const audio = getCtx();
  if (!audio) return;
  if (audio.state === "suspended") audio.resume();

  const osc = audio.createOscillator();
  const g = audio.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(gain, audio.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + duration);
  osc.connect(g);
  g.connect(audio.destination);
  osc.start();
  osc.stop(audio.currentTime + duration);
};

export const playKey = () => blip(520, 0.04, "triangle", 0.06);
export const playError = () => blip(160, 0.08, "sawtooth", 0.07);
export const playUnlock = () => {
  blip(660, 0.12, "sine", 0.08);
  setTimeout(() => blip(880, 0.16, "sine", 0.08), 90);
};
