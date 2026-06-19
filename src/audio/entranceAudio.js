// Entrance ambience, gated by WHERE the player is:
//   - street : silent (you hear nothing outside)
//   - tunnel : enter from the street, the door shuts, ~1.6 s of silence, then
//              the music fades in low and swells louder toward the café
//   - café   : the music plays at a steady, present level
//
// The music itself is an audio FILE when one is available, falling back to a
// quiet synth pad + arpeggio when it isn't. Drop files into `public/audio/`
// (see MUSIC_FILES below) and they replace the synth automatically — no code
// change, and a missing file just 404s and falls back. Either source runs
// through the same `musicGain` swell, so the place/intensity behaviour is
// identical. Footsteps and the door clunk stay procedural SFX over the top.
//
// The AudioContext is created lazily in resume() from a user gesture.

// Candidate files per theme, tried in order; first that decodes wins. Resolved
// against the Vite base URL so it works locally and on GitHub Pages.
const MUSIC_FILES = {
  tokyo: ['audio/ambient-tokyo.mp3', 'audio/ambient.mp3'],
  newyork: ['audio/ambient-newyork.mp3', 'audio/ambient.mp3'],
};

// Quiet synth fallback, tinted per theme (kept gentle — not the old loud hum).
const TONES = {
  tokyo: { root: 196, intervals: [1, 1.5, 2, 3], cutoff: 1100, detune: 6, delay: 0.3, feedback: 0.32 },
  newyork: { root: 130.8, intervals: [1, 1.2, 1.5, 1.78], cutoff: 760, detune: 9, delay: 0.4, feedback: 0.38 },
};
const SILENCE_SEC = 1.6;
const PENTA = [0, 3, 5, 7, 10];

export function createEntranceAudio() {
  let ctx = null;
  let master = null;
  let musicGain = null; // the swell (place/intensity) gain — shared by file + synth
  let fallbackGain = null; // pad+arp bus; muted to 0 once a file is playing
  let padFilter = null;
  let melodyGain = null;
  let delay = null;
  let feedback = null;
  let oscillators = [];
  let noiseBuf = null;
  let started = false;

  let usingFile = false;
  let fileSource = null;
  let fileKey = null; // which file URL is currently playing
  const buffers = new Map(); // url -> AudioBuffer (or 'fail')

  let muted = false;
  let toneId = 'tokyo';
  let place = 'street';
  let intensity = 0;
  let silence = 0;
  let nextNote = 0;
  let noteIdx = 0;

  const tone = () => TONES[toneId] || TONES.tokyo;
  const clamp01 = (v) => Math.max(0, Math.min(1, v));

  // Swell shape in 0..~0.5 (kept modest so nothing blares).
  function swell() {
    if (place === 'cafe') return 0.5;
    if (place === 'tunnel') return silence > 0 ? 0 : 0.04 + 0.46 * intensity;
    return 0;
  }

  function buildGraph() {
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    delay = ctx.createDelay(1.0);
    delay.delayTime.value = tone().delay;
    feedback = ctx.createGain();
    feedback.gain.value = tone().feedback;
    const wet = ctx.createGain();
    wet.gain.value = 0.25;
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(wet);
    wet.connect(master);

    musicGain = ctx.createGain();
    musicGain.gain.value = 0;
    musicGain.connect(master);
    musicGain.connect(delay);

    // --- Quiet synth fallback (pad + arpeggio) -> fallbackGain -> musicGain ---
    fallbackGain = ctx.createGain();
    fallbackGain.gain.value = 1;
    fallbackGain.connect(musicGain);

    padFilter = ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = tone().cutoff * 0.5;
    padFilter.Q.value = 0.7;
    padFilter.connect(fallbackGain);

    oscillators = tone().intervals.map((mult, i) => {
      const osc = ctx.createOscillator();
      osc.type = i === 0 ? 'sine' : 'triangle';
      osc.frequency.value = tone().root * mult;
      osc.detune.value = (i - 1) * tone().detune;
      const g = ctx.createGain();
      g.gain.value = i === 0 ? 0.16 : 0.1; // gentle, not the old loud drone
      osc.connect(g);
      g.connect(padFilter);
      osc.start();
      return osc;
    });

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.08;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 90;
    lfo.connect(lfoGain);
    lfoGain.connect(padFilter.frequency);
    lfo.start();

    melodyGain = ctx.createGain();
    melodyGain.gain.value = 0;
    melodyGain.connect(fallbackGain);

    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  }

  // --- File loading ---------------------------------------------------------
  async function loadBuffer(url) {
    if (buffers.has(url)) return buffers.get(url) === 'fail' ? null : buffers.get(url);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(String(res.status));
      const buf = await ctx.decodeAudioData(await res.arrayBuffer());
      buffers.set(url, buf);
      return buf;
    } catch {
      buffers.set(url, 'fail'); // remember the miss; fall back silently
      return null;
    }
  }

  function playFile(buf, key) {
    if (fileKey === key && usingFile) return;
    try {
      fileSource?.stop();
    } catch {
      /* already stopped */
    }
    fileSource = ctx.createBufferSource();
    fileSource.buffer = buf;
    fileSource.loop = true;
    fileSource.connect(musicGain);
    fileSource.start();
    fileKey = key;
    usingFile = true;
    fallbackGain.gain.setTargetAtTime(0, ctx.currentTime, 0.4); // hush the synth
  }

  // Try the current theme's candidate files; first that decodes plays.
  async function ensureMusic() {
    if (!ctx) return;
    const base = import.meta.env.BASE_URL || './';
    const candidates = (MUSIC_FILES[toneId] || []).map((p) => base + p);
    for (const url of candidates) {
      const buf = await loadBuffer(url);
      if (buf) {
        playFile(buf, url);
        return;
      }
    }
    // No file for this theme — keep the synth fallback audible.
    if (!usingFile) fallbackGain.gain.setTargetAtTime(1, ctx.currentTime, 0.4);
  }

  // --- Synth arpeggio (fallback only) --------------------------------------
  function playNote(t) {
    const octave = Math.floor(noteIdx / PENTA.length) % 2;
    const semis = PENTA[noteIdx % PENTA.length] + 12 * (1 + octave);
    const freq = tone().root * Math.pow(2, semis / 12);
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    osc.connect(g);
    g.connect(melodyGain);
    osc.start(t);
    osc.stop(t + 0.6);
  }
  function scheduleNotes() {
    const ahead = ctx.currentTime + 0.25;
    while (nextNote < ahead) {
      playNote(nextNote);
      nextNote += 0.42;
      noteIdx++;
    }
  }

  function retune() {
    if (!ctx) return;
    const t = tone();
    oscillators.forEach((osc, i) => {
      const mult = t.intervals[i % t.intervals.length];
      osc.frequency.setTargetAtTime(t.root * mult, ctx.currentTime, 0.3);
      osc.detune.setTargetAtTime((i - 1) * t.detune, ctx.currentTime, 0.3);
    });
    delay.delayTime.setTargetAtTime(t.delay, ctx.currentTime, 0.3);
    feedback.gain.setTargetAtTime(t.feedback, ctx.currentTime, 0.3);
  }

  return {
    resume() {
      try {
        if (!ctx) {
          const AC = window.AudioContext || window.webkitAudioContext;
          if (!AC) return;
          ctx = new AC();
          buildGraph();
          started = true;
          nextNote = ctx.currentTime;
          ensureMusic();
        }
        ctx.resume?.();
        master.gain.setTargetAtTime(muted ? 0 : 0.85, ctx.currentTime, 0.6);
      } catch {
        /* no audio — silent */
      }
    },
    update(dt) {
      if (!ctx) return;
      if (silence > 0) silence = Math.max(0, silence - dt);
      const tv = swell();
      const tc = ctx.currentTime;
      musicGain.gain.setTargetAtTime(tv, tc, 0.4);
      if (!usingFile) {
        padFilter.frequency.setTargetAtTime(tone().cutoff * (0.5 + 0.8 * Math.min(1, tv * 2.5)), tc, 0.4);
        melodyGain.gain.setTargetAtTime(tv > 0.02 && !muted ? 0.85 : 0, tc, 0.4);
        if (tv > 0.02 && !muted) scheduleNotes();
        else nextNote = tc;
      }
    },
    setPlace(p) {
      place = p;
      if (p !== 'tunnel') silence = 0;
    },
    hold() {
      silence = 1e9;
    },
    armHush(sec = SILENCE_SEC) {
      silence = sec;
    },
    setIntensity(v) {
      intensity = clamp01(v);
    },
    setTheme(id) {
      toneId = TONES[id] ? id : toneId;
      retune();
      ensureMusic(); // swap to a theme-specific file if one exists
    },
    doorClose() {
      if (!ctx || !started || muted) return;
      try {
        const t = ctx.currentTime;
        const env = ctx.createGain();
        env.gain.setValueAtTime(0.0001, t);
        env.gain.exponentialRampToValueAtTime(0.3, t + 0.006);
        env.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
        env.connect(master);
        env.connect(delay);
        const body = ctx.createOscillator();
        body.type = 'sine';
        body.frequency.setValueAtTime(80, t);
        body.frequency.exponentialRampToValueAtTime(38, t + 0.22);
        body.connect(env);
        body.start(t);
        body.stop(t + 0.36);
        const kn = ctx.createBufferSource();
        kn.buffer = noiseBuf;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 190;
        bp.Q.value = 1.2;
        const kg = ctx.createGain();
        kg.gain.setValueAtTime(0.0001, t);
        kg.gain.exponentialRampToValueAtTime(0.22, t + 0.004);
        kg.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
        kn.connect(bp);
        bp.connect(kg);
        kg.connect(master);
        kg.connect(delay);
        kn.start(t);
        const cl = ctx.createBufferSource();
        cl.buffer = noiseBuf;
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 2200;
        const cg = ctx.createGain();
        cg.gain.setValueAtTime(0.0001, t + 0.02);
        cg.gain.exponentialRampToValueAtTime(0.1, t + 0.026);
        cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
        cl.connect(hp);
        hp.connect(cg);
        cg.connect(master);
        cl.start(t + 0.02);
      } catch {
        /* ignore */
      }
    },
    footstep() {
      if (!ctx || !started || muted || place === 'street' || silence > 0) return;
      try {
        const t = ctx.currentTime;
        const env = ctx.createGain();
        env.gain.setValueAtTime(0.0001, t);
        env.gain.exponentialRampToValueAtTime(0.06, t + 0.008);
        env.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
        env.connect(master);
        const thump = ctx.createOscillator();
        thump.type = 'sine';
        thump.frequency.setValueAtTime(95, t);
        thump.frequency.exponentialRampToValueAtTime(52, t + 0.18);
        thump.connect(env);
        thump.start(t);
        thump.stop(t + 0.24);
      } catch {
        /* ignore */
      }
    },
    setMuted(v) {
      muted = v;
      if (ctx && master) master.gain.setTargetAtTime(v ? 0 : 0.85, ctx.currentTime, 0.2);
    },
    get muted() {
      return muted;
    },
    dispose() {
      try {
        ctx?.close?.();
      } catch {
        /* ignore */
      }
    },
  };
}
