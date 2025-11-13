// assets/js/audio/webaudio-layer.js
(function(global){
    const AudioLayer = {
      engine: null,
      useLocal: false,
      inited: false,
  
      // opts: { local: true/false, useReverb: true/false, basePath, ext }
      async init(opts = {}) {
        opts = opts || {};
        this.useLocal = !!opts.local;
        // Choose engine object references (must exist on window)
        const localEngine = global.RealPianoLocal;
        const sfEngine = global.RealPiano;
  
        if (this.useLocal && !localEngine) {
          throw new Error('AudioLayer: RealPianoLocal not found on window');
        }
        if (!this.useLocal && !sfEngine) {
          throw new Error('AudioLayer: RealPiano (SoundFont) not found on window');
        }
  
        this.engine = this.useLocal ? localEngine : sfEngine;
        // If sample engine supports init options, pass them
        const initOpts = {
          useReverb: !!opts.useReverb,
          basePath: opts.basePath,
          ext: opts.ext,
          loadAll: opts.loadAll !== false
        };
  
        // Some engines return promises, handle both sync/async
        if (typeof this.engine.init === 'function') {
          await this.engine.init(initOpts);
        }
        this.inited = true;
        console.log('AudioLayer: initialized ->', this.useLocal ? 'Local Samples' : 'SoundFont');
      },
  
      play(note, velocity = 0.9, duration = 1.6) {
        if (!this.inited) {
          console.warn('AudioLayer: not initialized. Call AudioLayer.init() first.');
          return;
        }
        if (!this.engine || typeof this.engine.playNote !== 'function') {
          console.warn('AudioLayer: engine does not implement playNote');
          return;
        }
        return this.engine.playNote(note, velocity, duration);
      },
  
      stop(note) {
        if (!this.inited) return;
        if (this.engine && typeof this.engine.stopNote === 'function') {
          return this.engine.stopNote(note);
        }
      },
  
      playChord(notesArray, velocity = 0.9, duration = 2.0) {
        if (!this.inited) return;
        if (this.engine && typeof this.engine.playChord === 'function') {
          return this.engine.playChord(notesArray, velocity, duration);
        }
        // fallback
        notesArray.forEach(n => this.play(n, velocity, duration));
      },
  
      setSustain(enabled) {
        if (this.engine && typeof this.engine.setSustainEnabled === 'function') {
          return this.engine.setSustainEnabled(enabled);
        }
        if (this.engine && typeof this.engine.setSustainEnabled === 'undefined' && typeof this.engine.setSustain === 'function') {
          return this.engine.setSustain(enabled);
        }
      },
  
      isLocal() { return !!this.useLocal; }
    };
  
    global.AudioLayer = AudioLayer;
  })(window);
  