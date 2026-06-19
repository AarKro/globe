// Procedural ambience for the entrance — no audio assets. Sound is tied to
// WHERE the player is:
//   - street : silent (you hear nothing outside)
//   - tunnel : enter from the street and the door closes behind -> ~1.6 s of
//              silence, then the music fades in very low and grows louder as
//              you approach the café door (and back down as you return)
//   - café   : the music plays at a steady, present level
//
// A low oscillator pad through a feedback delay gives the space; a gentle
// pentatonic arpeggio over it reads as music; soft thumps mark footsteps.
// Tone is tinted per city theme.
//
// The AudioContext is created lazily in resume() from a user gesture; a
// missing/blocked Web Audio API is a silent no-op. The host calls update(dt)
// every frame to drive the swell, the silence timer, and the arpeggio.

const TONES = {
  tokyo: { root: 196, intervals: [1, 1.5, 2, 3], cutoff: 1100, detune: 6, delay: 0.3, feedback: 0.34 },
  newyork: { root: 130.8, intervals: [1, 1.2, 1.5, 1.78], cutoff: 760, detune: 9, delay: 0.4, feedback: 0.4 },
};
const SILENCE_SEC = 1.6;
const CAFE_LEVEL = 0.4;
const PENTA = [0, 3, 5, 7, 10]; // minor pentatonic, gentle

export function createEntranceAudio() {
  let ctx = null;
  let master = null;
  let padGain = null;
  let padFilter = null;
  let melodyGain = null;
  let delay = null;
  let feedback = null;
  let oscillators = [];
  let noiseBuf = null;
  let started = false;

  let muted = false;
  let toneId = 'tokyo';
  let place = 'street';
  let intensity = 0; // tunnel progress 0..1
  let silence = 0; // remaining forced-silence seconds
  let nextNote = 0;
  let noteIdx = 0;

  const tone = () => TONES[toneId] || TONES.tokyo;
  const clamp01 = (v) => Math.max(0, Math.min(1, v));

  function targetVol() {
    if (place === 'cafe') return CAFE_LEVEL;
    if (place === 'tunnel') return silence > 0 ? 0 : 0.03 + 0.5 * intensity;
    return 0; // street
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
    wet.gain.value = 0.28;
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(wet);
    wet.connect(master);

    padGain = ctx.createGain();
    padGain.gain.value = 0;
    padGain.connect(master);
    padGain.connect(delay);

    padFilter = ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = tone().cutoff * 0.5;
    padFilter.Q.value = 0.7;
    padFilter.connect(padGain);

    oscillators = tone().intervals.map((mult, i) => {
      const osc = ctx.createOscillator();
      osc.type = i === 0 ? 'sine' : 'triangle';
      osc.frequency.value = tone().root * mult;
      osc.detune.value = (i - 1) * tone().detune;
      const g = ctx.createGain();
      g.gain.value = i === 0 ? 0.5 : 0.3;
      osc.connect(g);
      g.connect(padFilter);
      osc.start();
      return osc;
    });

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.08;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 120;
    lfo.connect(lfoGain);
    lfoGain.connect(padFilter.frequency);
    lfo.start();

    melodyGain = ctx.createGain();
    melodyGain.gain.value = 0;
    melodyGain.connect(master);
    melodyGain.connect(delay);

    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  }

  function playNote(t) {
    const octave = Math.floor(noteIdx / PENTA.length) % 2;
    const semis = PENTA[noteIdx % PENTA.length] + 12 * (1 + octave);
    const freq = tone().root * Math.pow(2, semis / 12);
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    osc.connect(g);
    g.connect(melodyGain);
    osc.start(t);
    osc.stop(t + 0.6);
  }

  function scheduleNotes() {
    const ahead = ctx.currentTime + 0.25;
    const interval = 0.42;
    while (nextNote < ahead) {
      playNote(nextNote);
      nextNote += interval;
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
        }
        ctx.resume?.();
        master.gain.setTargetAtTime(muted ? 0 : 0.85, ctx.currentTime, 0.6);
      } catch {
        /* no audio — silent */
      }
    },
    // Drives the swell, silence timer, and arpeggio. Call every frame.
    update(dt) {
      if (!ctx) return;
      if (silence > 0) silence = Math.max(0, silence - dt);
      const tv = targetVol();
      const tc = ctx.currentTime;
      padGain.gain.setTargetAtTime(tv, tc, 0.4);
      melodyGain.gain.setTargetAtTime(tv * 0.7, tc, 0.4);
      padFilter.frequency.setTargetAtTime(tone().cutoff * (0.5 + 0.8 * Math.min(1, tv * 2)), tc, 0.4);
      if (tv > 0.02 && !muted) scheduleNotes();
      else nextNote = tc; // stay aligned so notes don't burst on resume
    },
    setPlace(p) {
      place = p;
      if (p !== 'tunnel') silence = 0;
    },
    // Stay fully silent (used between entering the tunnel and the door shutting).
    hold() {
      silence = 1e9;
    },
    // Begin the timed hush, after which the music swells in.
    armHush(sec = SILENCE_SEC) {
      silence = sec;
    },
    // A meaty door-close clunk — a one-shot SFX heard even during the hush,
    // so you feel the tunnel seal behind you.
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
        // Wooden knock.
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
        // Latch click.
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
    setIntensity(v) {
      intensity = clamp01(v);
    },
    setTheme(id) {
      toneId = TONES[id] ? id : toneId;
      retune();
    },
    footstep() {
      // Footsteps are diegetic sound — silent outside and during the hush.
      if (!ctx || !started || muted || place === 'street' || silence > 0) return;
      try {
        const t = ctx.currentTime;
        const env = ctx.createGain();
        env.gain.setValueAtTime(0.0001, t);
        env.gain.exponentialRampToValueAtTime(0.07, t + 0.008);
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
        /* ignore transient audio errors */
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
