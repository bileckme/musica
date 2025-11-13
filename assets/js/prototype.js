(async () => {
    // Prefer local samples when available — toggle with UI checkbox if you want
    const preferLocal = true; // or read from settings
    try {
      await AudioLayer.init({
        local: preferLocal,
        useReverb: true,
        basePath: './assets/samples', // optional override
        ext: '.mp3',               // or '.wav'
        loadAll: true
      });
    } catch (err) {
      console.error('AudioLayer init failed, falling back to SoundFont:', err);
      // try fallback to SoundFont if available
      try {
        await AudioLayer.init({ local: false, useReverb: true });
      } catch (err2) {
        console.error('Fallback failed:', err2);
      }
    }
  
    // Initialize UI
    const keyboardCanvas = document.getElementById('keyboard');
    PianoUI.init(keyboardCanvas, {
      onKeyDown: (note) => {
        AudioLayer.play(note, 0.95, 2.0);
        SheetDisplay && SheetDisplay.showNote && SheetDisplay.showNote(note);
      },
      onKeyUp: (note) => {
        if (!document.getElementById('useSustain').checked) {
          AudioLayer.stop(note);
        }
      }
    });
  
    // Hook MIDI playback
    document.getElementById('playMidi').addEventListener('click', () => {
      const url = document.getElementById('midiUrl').value.trim();
      MidiLoader.play(url, {
        tempoMul: parseFloat(document.getElementById('tempoMul').value) || 1,
        noteCallback: (note) => {
          AudioLayer.play(note.name, Math.min(1, note.velocity || 0.9), note.duration);
          PianoUI.flashKey(note.name, Math.min(1, note.velocity || 0.9));
          SheetDisplay && SheetDisplay.showNote && SheetDisplay.showNote(note.name);
        },
        endCallback: () => { document.getElementById('nowPlaying').textContent = 'Stopped'; }
      });
    });
  })();