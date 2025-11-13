// real-piano-local.js

(function (global) {
  const RealPianoLocal = {
    audioCtx: null,
    basePath: './assets/samples',
    ext: '.mp3',       // default extension
    buffers: {},       // noteName -> AudioBuffer
    activeNodes: {},
    loaded: false,
    loading: false,
    sustain: false,
    reverbNode: null,
    onprogress: null,

    noteNames: [
      "A0","A#0","B0",
      "C1","C#1","D1","D#1","E1","F1","F#1","G1","G#1",
      "A1","A#1","B1",
      "C2","C#2","D2","D#2","E2","F2","F#2","G2","G#2",
      "A2","A#2","B2",
      "C3","C#3","D3","D#3","E3","F3","F#3","G3","G#3",
      "A3","A#3","B3",
      "C4","C#4","D4","D#4","E4","F4","F#4","G4","G#4",
      "A4","A#4","B4",
      "C5","C#5","D5","D#5","E5","F5","F#5","G5","G#5",
      "A5","A#5","B5",
      "C6","C#6","D6","D#6","E6","F6","F#6","G6","G#6",
      "A6","A#6","B6",
      "C7","C#7","D7","D#7","E7","F7","F#7","G7","G#7",
      "A7","A#7","B7",
      "C8"
    ],

    async init(options = {}) {
      if (this.loading) return this._initPromise;
      this.loading = true;
      if (options.basePath) this.basePath = options.basePath;
      if (options.ext) this.ext = options.ext;
      const useReverb = !!options.useReverb;

      // AudioContext
      if (!this.audioCtx) {
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (this.audioCtx.state === 'suspended') {
        const resume = () => {
          this.audioCtx.resume().catch(()=>{});
          window.removeEventListener('pointerdown', resume);
        };
        window.addEventListener('pointerdown', resume, { once: true });
      }

      // optional simple reverb
      if (useReverb && !this.reverbNode) {
        const convolver = this.audioCtx.createConvolver();
        const len = this.audioCtx.sampleRate * 1.2;
        const buf = this.audioCtx.createBuffer(2, len, this.audioCtx.sampleRate);
        for (let c=0;c<2;c++){
          const d = buf.getChannelData(c);
          for (let i=0;i<len;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/len,2)*0.25;
        }
        convolver.buffer = buf;
        this.reverbNode = convolver;
      }

      const self = this;
      const total = self.noteNames.length;
      let loadedCount = 0;

      const loadOne = async (noteName) => {
        const url = `${self.basePath}/${encodeURIComponent(noteName)}${self.ext}`;
        try {
          const resp = await fetch(url);
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          const arrayBuffer = await resp.arrayBuffer();
          const audioBuffer = await self.audioCtx.decodeAudioData(arrayBuffer);
          self.buffers[noteName] = audioBuffer;
        } catch (err) {
          console.warn(`RealPianoLocal: failed to load sample ${url}`, err);
          self.buffers[noteName] = null;
        }
        loadedCount++;
        if (typeof self.onprogress === 'function') self.onprogress(loadedCount, total);
      };

      // concurrency loader
      const concurrency = 8;
      const queue = self.noteNames.slice();
      const workers = [];
      for (let i=0; i<concurrency; i++) {
        workers.push((async () => {
          while (queue.length) {
            const note = queue.shift();
            if (!note) break;
            await loadOne(note);
          }
        })());
      }

      this._initPromise = Promise.all(workers).then(() => {
        self.loaded = true;
        self.loading = false;
        return true;
      });

      return this._initPromise;
    },

    playNote(noteName, velocity=0.9, duration=1.6) {
      if (!this.audioCtx) return console.warn('RealPianoLocal: not initialized');
      const buffer = this.buffers[noteName];
      if (!buffer) return console.warn('RealPianoLocal: sample missing', noteName);

      const src = this.audioCtx.createBufferSource();
      src.buffer = buffer;
      const gain = this.audioCtx.createGain();
      gain.gain.value = Math.max(0.0001, Math.min(1, velocity));

      const now = this.audioCtx.currentTime;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(velocity, now + 0.01);

      if (this.reverbNode) {
        src.connect(gain);
        gain.connect(this.audioCtx.destination);
        gain.connect(this.reverbNode);
        this.reverbNode.connect(this.audioCtx.destination);
      } else {
        src.connect(gain);
        gain.connect(this.audioCtx.destination);
      }

      src.start(now);
      if (!this.sustain) {
        src.stop(now + duration);
        gain.gain.setTargetAtTime(0.0001, now + duration - 0.06, 0.02);
      }

      this.activeNodes[noteName] = this.activeNodes[noteName] || [];
      this.activeNodes[noteName].push({ src, gain });

      src.onended = () => {
        const arr = this.activeNodes[noteName] || [];
        this.activeNodes[noteName] = arr.filter(o => o.src !== src);
        if (!this.activeNodes[noteName].length) delete this.activeNodes[noteName];
      };
    },

    stopNote(noteName) {
      if (!noteName) {
        Object.keys(this.activeNodes).forEach(k => this.stopNote(k));
        return;
      }
      (this.activeNodes[noteName] || []).forEach(o => {
        try {
          o.gain.gain.cancelScheduledValues(this.audioCtx.currentTime);
          o.gain.gain.setTargetAtTime(0.0001, this.audioCtx.currentTime, 0.02);
          o.src.stop(this.audioCtx.currentTime + 0.03);
        } catch {}
      });
      delete this.activeNodes[noteName];
    },

    playChord(arr = [], vel=0.9, dur=2.0) {
      arr.forEach(n => this.playNote(n, vel, dur));
    },

    setSustainEnabled(enabled) {
      const prev = this.sustain;
      this.sustain = !!enabled;
      if (prev && !this.sustain) this.stopNote();
    },

    isReady() { return this.loaded; }
  };

  global.RealPianoLocal = RealPianoLocal;
})(window);

window.RealPiano = {
  _ready: false,
  init: async function() {
    if (this._ready) return;
    // load SoundFont / setup audio
    await RealPianoLocal.init({ basePath:'./assets/samples', ext:'.mp3', useReverb:true });
    this._ready = true;
  },
  isReady: function() {
    return this._ready;
  },
  playNote: function(note, velocity=0.9, duration=1.5) {
    if(!this._ready) return console.warn("RealPiano not ready yet");
    RealPianoLocal.playNote(note, velocity, duration);
  }
};