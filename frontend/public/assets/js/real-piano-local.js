// real-piano-local.js - Enhanced with better error handling

(function (global) {
  const RealPianoLocal = {
    audioCtx: null,
    basePath: './assets/samples',
    ext: '.mp3',
    buffers: {},
    activeNodes: {},
    loaded: false,
    loading: false,
    sustain: false,
    reverbNode: null,
    onprogress: null,

    noteNames: [
      "A0","A#0","B0",
      "C1","C#1","D1","D#1","E1","F1","F#1","G1","G#1","A1","A#1","B1",
      "C2","C#2","D2","D#2","E2","F2","F#2","G2","G#2","A2","A#2","B2",
      "C3","C#3","D3","D#3","E3","F3","F#3","G3","G#3","A3","A#3","B3",
      "C4","C#4","D4","D#4","E4","F4","F#4","G4","G#4","A4","A#4","B4",
      "C5","C#5","D5","D#5","E5","F5","F#5","G5","G#5","A5","A#5","B5",
      "C6","C#6","D6","D#6","E6","F6","F#6","G6","G#6","A6","A#6","B6",
      "C7","C#7","D7","D#7","E7","F7","F#7","G7","G#7","A7","A#7","B7",
      "C8"
    ],

    async init(options = {}) {
      if (this.loading) return this._initPromise;
      this.loading = true;
      
      console.log('RealPianoLocal: Starting initialization...');
      
      if (options.basePath) this.basePath = options.basePath;
      if (options.ext) this.ext = options.ext;
      const useReverb = !!options.useReverb;
      
      if (options.onprogress) this.onprogress = options.onprogress;

      // AudioContext with better error handling
      try {
        if (!this.audioCtx) {
          this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          console.log('RealPianoLocal: AudioContext created, state:', this.audioCtx.state);
        }

        // Handle suspended audio context
        if (this.audioCtx.state === 'suspended') {
          console.log('RealPianoLocal: AudioContext suspended, waiting for user interaction...');
          // Don't wait for user interaction here - let the main app handle it
        }
      } catch (error) {
        console.error('RealPianoLocal: Failed to create AudioContext:', error);
        this.loading = false;
        throw error;
      }

      // Reverb setup (simplified - don't block on this)
      if (useReverb && !this.reverbNode) {
        try {
          setTimeout(() => {
            try {
              const convolver = this.audioCtx.createConvolver();
              const len = this.audioCtx.sampleRate * 1.5;
              const buf = this.audioCtx.createBuffer(2, len, this.audioCtx.sampleRate);
              
              for (let c = 0; c < 2; c++) {
                const d = buf.getChannelData(c);
                for (let i = 0; i < len; i++) {
                  d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2) * 0.3;
                }
              }
              convolver.buffer = buf;
              this.reverbNode = convolver;
              console.log('RealPianoLocal: Reverb initialized');
            } catch (error) {
              console.warn('RealPianoLocal: Reverb initialization failed:', error);
            }
          }, 100);
        } catch (error) {
          console.warn('RealPianoLocal: Reverb setup error:', error);
        }
      }

      const self = this;
      const total = self.noteNames.length;
      let loadedCount = 0;

      const loadOne = async (noteName) => {
        const url = `${self.basePath}/${encodeURIComponent(noteName)}${self.ext}`;
        
        try {
          console.log(`RealPianoLocal: Loading sample ${noteName}`);
          const resp = await fetch(url);
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          
          const arrayBuffer = await resp.arrayBuffer();
          const audioBuffer = await self.audioCtx.decodeAudioData(arrayBuffer);
          self.buffers[noteName] = audioBuffer;
          
        } catch (err) {
          console.warn(`RealPianoLocal: Failed to load sample ${url}`, err);
          self.buffers[noteName] = null;
        }
        
        loadedCount++;
        if (typeof self.onprogress === 'function') {
          self.onprogress(loadedCount, total);
        }
      };

      // Load samples with concurrency
      const queue = self.noteNames.slice();
      const concurrency = 4; // Reduced for stability
      const workers = [];
      
      console.log(`RealPianoLocal: Loading ${total} samples...`);

      for (let i = 0; i < concurrency; i++) {
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
        
        // Count successful loads
        const successfulLoads = Object.values(self.buffers).filter(b => b !== null).length;
        console.log(`RealPianoLocal: Initialization complete. ${successfulLoads}/${total} samples loaded`);
        
        return true;
      }).catch(error => {
        self.loading = false;
        console.error('RealPianoLocal: Initialization failed:', error);
        throw error;
      });

      return this._initPromise;
    },

    playNote(noteName, velocity = 0.9, duration = 1.6) {
      if (!this.audioCtx) {
        console.warn('RealPianoLocal: AudioContext not available');
        return;
      }
      
      // Ensure audio context is running
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(console.warn);
      }
      
      const buffer = this.buffers[noteName];
      if (!buffer) {
        console.warn(`RealPianoLocal: Sample missing for ${noteName}`);
        return;
      }

      try {
        const src = this.audioCtx.createBufferSource();
        src.buffer = buffer;
        const gain = this.audioCtx.createGain();
        
        // Set initial gain to avoid clicks
        const now = this.audioCtx.currentTime;
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.001, velocity), now + 0.02);

        // Connect nodes
        src.connect(gain);
        
        if (this.reverbNode) {
          gain.connect(this.reverbNode);
          this.reverbNode.connect(this.audioCtx.destination);
        } else {
          gain.connect(this.audioCtx.destination);
        }

        // Start playback
        src.start(now);
        
        // Stop if not sustained
        if (!this.sustain) {
          const stopTime = now + duration;
          gain.gain.exponentialRampToValueAtTime(0.001, stopTime - 0.05);
          src.stop(stopTime);
        }

        // Track active nodes
        this.activeNodes[noteName] = this.activeNodes[noteName] || [];
        this.activeNodes[noteName].push({ src, gain });

        src.onended = () => {
          const arr = this.activeNodes[noteName] || [];
          this.activeNodes[noteName] = arr.filter(o => o.src !== src);
          if (!this.activeNodes[noteName].length) delete this.activeNodes[noteName];
        };

      } catch (error) {
        console.error('RealPianoLocal: Error playing note:', error);
      }
    },

    stopNote(noteName) {
      if (!noteName) {
        // Stop all notes
        Object.keys(this.activeNodes).forEach(k => this.stopNote(k));
        return;
      }
      
      (this.activeNodes[noteName] || []).forEach(o => {
        try {
          const now = this.audioCtx.currentTime;
          o.gain.gain.cancelScheduledValues(now);
          o.gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
          o.src.stop(now + 0.04);
        } catch (error) {
          console.warn('RealPianoLocal: Error stopping note:', error);
        }
      });
      delete this.activeNodes[noteName];
    },

    setSustainEnabled(enabled) {
      this.sustain = !!enabled;
      if (!this.sustain) {
        // Release all sustained notes
        this.stopNote();
      }
    },

    isReady() { 
      return this.loaded && this.audioCtx;
    }
  };

  global.RealPianoLocal = RealPianoLocal;
  console.log('RealPianoLocal script loaded');
})(window);