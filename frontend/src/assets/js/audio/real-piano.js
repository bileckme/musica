// real-piano.js
// Lightweight Real Piano module using Soundfont-player.
// Exposes window.RealPiano with init/play/stop/export functions.

(function(global){
    const RealPiano = {
      audioCtx: null,
      instrument: null,
      sustain: false,
      reverb: null,
      loaded: false,
  
      async init({ useReverb = true } = {}) {
        if (this.loaded) return;
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  
        // Optionally create a small reverb using Convolver (placeholder impulse)
        if (useReverb) {
          // create short impulse (simple reverb)
          const irLen = this.audioCtx.sampleRate * 1.2;
          const impulse = this.audioCtx.createBuffer(2, irLen, this.audioCtx.sampleRate);
          for (let c=0;c<2;c++){
            const channel = impulse.getChannelData(c);
            for (let i=0;i<irLen;i++){
              channel[i] = (Math.random()*2-1) * Math.pow(1 - i/irLen, 2.2) * 0.25;
            }
          }
          const convolver = this.audioCtx.createConvolver();
          convolver.buffer = impulse;
          convolver.connect(this.audioCtx.destination);
          this.reverb = convolver;
        }
  
        // Load instrument from Soundfont-player (MusyngKite)
        // For production replace 'acoustic_grand_piano' with your local converted soundfont wrapper
        this.instrument = await Soundfont.instrument(this.audioCtx, 'acoustic_grand_piano', {soundfont: 'MusyngKite'});
        this.loaded = true;
        console.log('RealPiano: instrument loaded');
      },
  
      playNote(noteName, velocity = 0.9, duration = 1.5) {
        if (!this.loaded) {
          console.warn('RealPiano: not initialized');
          return;
        }
        // Soundfont-player returns AudioNode so we can manage it if needed
        const gain = velocity;
        const when = this.audioCtx.currentTime;
        const node = this.instrument.play(noteName, when, { gain, duration });
        // If sustain enabled, let note ring (don't stop early)
        if (this.sustain) {
          // don't set a timer to stop; node will stop after large duration
        } else {
          // ensure node ends after duration (soundfont player's internal stopping)
        }
        return node;
      },
  
      stopNote(noteName) {
        // Soundfont-player doesn't expose direct stop by note name reliably.
        // This is kept simple; for advanced control, track returned nodes and stop them.
        // Placeholder: no-op
      },
  
      setSustainEnabled(enabled) {
        this.sustain = !!enabled;
      },
  
      exportChordAsMIDI(noteNames = []) {
        // Use jsmidgen to produce a simple one-track MIDI.
        try {
          const file = new JSMIDGEN.File();
          const track = new JSMIDGEN.Track();
          file.addTrack(track);
          // Add note ons at time 0 and offs at 128 ticks later
          noteNames.forEach(n => {
            track.addNoteOn(0, n, 0);
          });
          noteNames.forEach(n => {
            track.addNoteOff(0, n, 128);
          });
          const bytes = file.toBytes();
          const blob = new Blob([bytes], {type: 'audio/midi'});
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'chord.mid';
          a.click();
        } catch (e) {
          console.error('MIDI export failed', e);
        }
      }
    };
  
    global.RealPiano = RealPiano;
  })(window);
  