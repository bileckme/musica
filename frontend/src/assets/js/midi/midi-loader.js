// midi-loader.js
(function(global){
    const MidiLoader = {
      midiObj: null,
      timers: [],
      async loadFromUrl(url){
        const resp = await fetch(url);
        if (!resp.ok) throw new Error('MIDI fetch failed');
        const arrayBuffer = await resp.arrayBuffer();
        const midi = new Midi(arrayBuffer);
        this.midiObj = midi;
        return { name: midi.name || 'Unnamed', duration: midi.duration, tracks: midi.tracks.length };
      },
  
      play(url, { tempoMul = 1, noteCallback = ()=>{}, endCallback = ()=>{} } = {}) {
        // clear previous timers
        this.stop();
        (async ()=>{
          if (!this.midiObj || this.lastUrl !== url) {
            await this.loadFromUrl(url);
            this.lastUrl = url;
          }
          const startTime = performance.now();
          const baseTempo = this.midiObj.header.tempos && this.midiObj.header.tempos.length ? this.midiObj.header.tempos[0].bpm : 120;
          const factor = 1 / tempoMul;
  
          // collect all notes across tracks
          const notes = [];
          this.midiObj.tracks.forEach(tr => {
            tr.notes.forEach(n => {
              notes.push({ time: n.time * factor, duration: n.duration * factor, velocity: n.velocity, name: n.name });
            });
          });
  
          // schedule
          notes.forEach(n=>{
            const t = Math.max(0, Math.round((n.time)*1000));
            const id = setTimeout(()=> {
              noteCallback(n);
            }, t);
            this.timers.push(id);
          });
  
          // schedule end callback
          const endMs = Math.round(this.midiObj.duration * 1000 * factor);
          const endTimer = setTimeout(()=> {
            endCallback();
          }, endMs + 100);
          this.timers.push(endTimer);
        })().catch(e=>console.error(e));
      },
  
      stop() {
        this.timers.forEach(id => clearTimeout(id));
        this.timers = [];
      }
    };
  
    global.MidiLoader = MidiLoader;
  })(window);
   

  noteCallback: (note) => {
    AudioLayer.play(note.name, note.velocity, note.duration);
    ui.flashKey(note.name);
    SheetDisplay.showNote(note.name);
  }
  