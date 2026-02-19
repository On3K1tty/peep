let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

type SoundName = 'jump' | 'hit' | 'pickup' | 'explode' | 'win' | 'lose' | 'click' | 'place';

export function playSound(name: SoundName) {
  try {
    const c = getCtx();
    const now = c.currentTime;

    switch (name) {
      case 'jump': {
        const o = c.createOscillator();
        const g = c.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(250, now);
        o.frequency.linearRampToValueAtTime(600, now + 0.12);
        g.gain.setValueAtTime(0.15, now);
        g.gain.linearRampToValueAtTime(0, now + 0.15);
        o.connect(g).connect(c.destination);
        o.start(now); o.stop(now + 0.15);
        break;
      }
      case 'hit': {
        const buf = c.createBuffer(1, c.sampleRate * 0.2 | 0, c.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
        const s = c.createBufferSource();
        const g = c.createGain();
        s.buffer = buf;
        g.gain.setValueAtTime(0.2, now);
        g.gain.linearRampToValueAtTime(0, now + 0.2);
        s.connect(g).connect(c.destination);
        s.start(now);
        break;
      }
      case 'pickup': {
        const o1 = c.createOscillator();
        const o2 = c.createOscillator();
        const g = c.createGain();
        o1.type = 'square'; o1.frequency.value = 523;
        o2.type = 'square'; o2.frequency.value = 659;
        g.gain.setValueAtTime(0.08, now);
        g.gain.linearRampToValueAtTime(0, now + 0.2);
        o1.connect(g); o2.connect(g); g.connect(c.destination);
        o1.start(now); o1.stop(now + 0.1);
        o2.start(now + 0.08); o2.stop(now + 0.2);
        break;
      }
      case 'explode': {
        const buf = c.createBuffer(1, c.sampleRate * 0.4 | 0, c.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 0.5;
        const s = c.createBufferSource();
        const g = c.createGain();
        const f = c.createBiquadFilter();
        f.type = 'lowpass'; f.frequency.value = 400;
        s.buffer = buf;
        g.gain.setValueAtTime(0.3, now);
        g.gain.linearRampToValueAtTime(0, now + 0.4);
        s.connect(f).connect(g).connect(c.destination);
        s.start(now);
        break;
      }
      case 'win': {
        const notes = [523, 659, 784, 1047];
        notes.forEach((freq, i) => {
          const o = c.createOscillator();
          const g = c.createGain();
          o.type = 'square';
          o.frequency.value = freq;
          g.gain.setValueAtTime(0.08, now + i * 0.12);
          g.gain.linearRampToValueAtTime(0, now + i * 0.12 + 0.15);
          o.connect(g).connect(c.destination);
          o.start(now + i * 0.12);
          o.stop(now + i * 0.12 + 0.15);
        });
        break;
      }
      case 'lose': {
        const o = c.createOscillator();
        const g = c.createGain();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(400, now);
        o.frequency.linearRampToValueAtTime(100, now + 0.4);
        g.gain.setValueAtTime(0.12, now);
        g.gain.linearRampToValueAtTime(0, now + 0.5);
        o.connect(g).connect(c.destination);
        o.start(now); o.stop(now + 0.5);
        break;
      }
      case 'click': {
        const o = c.createOscillator();
        const g = c.createGain();
        o.type = 'sine'; o.frequency.value = 800;
        g.gain.setValueAtTime(0.05, now);
        g.gain.linearRampToValueAtTime(0, now + 0.05);
        o.connect(g).connect(c.destination);
        o.start(now); o.stop(now + 0.05);
        break;
      }
      case 'place': {
        const o = c.createOscillator();
        const g = c.createGain();
        o.type = 'sine'; o.frequency.value = 180;
        g.gain.setValueAtTime(0.04, now);
        g.gain.linearRampToValueAtTime(0, now + 0.14);
        o.connect(g).connect(c.destination);
        o.start(now); o.stop(now + 0.14);
        break;
      }
    }
  } catch { /* AudioContext might not be available */ }
}
