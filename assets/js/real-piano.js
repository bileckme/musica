// real-piano.js
// =====================
// Handles loading and playback of high-quality sampled piano (SF2/SF3)
// using WebAudioFontPlayer or compatible SoundFont player.
// =====================

window.RealPiano = (function() {
    let audioCtx;
    let player;
    let piano;
  
    async function loadInstrument() {
      return new Promise((resolve, reject) => {
        try {
          console.log('🎼 Loading Piano SoundFont...');
          audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          player = new WebAudioFontPlayer();
  
          // Load local SoundFont
          const script = document.createElement('script');
          script.src = 'assets/js/webaudiofont/0090_JCLive_sf2_file.js'; // or your Piano.sf2 JS wrapper
          script.onload = () => {
            console.log('🎹 Piano SoundFont JS loaded');
            resolve();
          };
          script.onerror = reject;
          document.body.appendChild(script);
        } catch (err) {
          reject(err);
        }
      });
    }
  
    async function init() {
      try {
        await loadInstrument();
        console.log('🎹 Real Piano initialized successfully.');
      } catch (err) {
        console.error('❌ Failed to initialize Real Piano:', err);
        throw err;
      }
    }
  
    function playNote(midi, velocity = 100, duration = 1.2) {
      if (!player || !audioCtx) {
        console.warn('⚠️ Piano not initialized.');
        return;
      }
      const preset = _tone_0090_JCLive_sf2_file; // reference from the JS SF2 loader
      const when = audioCtx.currentTime;
      player.queueWaveTable(audioCtx, audioCtx.destination, preset, when, midi, duration, velocity / 127);
    }
  
    // Allow downloading played chord as MIDI
    function exportChordAsMIDI(chordNotes = []) {
      const header = new Uint8Array([
        0x4d, 0x54, 0x68, 0x64, // MThd
        0x00, 0x00, 0x00, 0x06, // header length
        0x00, 0x00, // format type 0
        0x00, 0x01, // one track
        0x00, 0x60  // 96 ticks per beat
      ]);
  
      const events = [];
      let time = 0;
  
      chordNotes.forEach(note => {
        events.push(0x90, note, 0x64); // Note on
      });
      chordNotes.forEach(note => {
        events.push(0x80, note, 0x40); // Note off
      });
  
      const trackLength = events.length + 4;
      const track = new Uint8Array([
        0x4d, 0x54, 0x72, 0x6b,
        (trackLength >> 24) & 0xff,
        (trackLength >> 16) & 0xff,
        (trackLength >> 8) & 0xff,
        trackLength & 0xff,
        ...events,
        0xff, 0x2f, 0x00
      ]);
  
      const blob = new Blob([header, track], { type: 'audio/midi' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'chord.mid';
      link.click();
    }
  
    // Expose public API
    return {
      init,
      playNote,
      exportChordAsMIDI
    };
  })();
  