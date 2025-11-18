// piano-ui.js
(function(global){
    // Mapping helpers
    const NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
    function midiToName(m) {
      const octave = Math.floor(m/12) - 1;
      return NOTES[m % 12] + octave;
    }
    function nameToMidi(name) {
      const m = name.match(/^([A-G]#?)(-?\d+)$/);
      if(!m) return null;
      const note = m[1], octave = parseInt(m[2],10);
      const idx = NOTES.indexOf(note);
      return (octave + 1) * 12 + idx;
    }
  
    const PianoUI = {
      canvas: null,
      ctx: null,
      whiteKeys: [],
      blackKeys: [],
      keyMap: {}, // midi -> key rect
      onKeyDown: null,
      onKeyUp: null,
      pressed: new Set(),
  
      init(canvas, { onKeyDown, onKeyUp } = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.onKeyDown = onKeyDown;
        this.onKeyUp = onKeyUp;
        this._buildKeys();
        this._bindEvents();
        this.draw();
        window.addEventListener('resize', ()=> this.draw());
      },
  
      _buildKeys() {
        // Build 88 keys A0 (21) .. C8 (108)
        const start = 21, end = 108;
        const width = this.canvas.width;
        const height = this.canvas.height;
        const whiteCount = 52;
        const wk = width / whiteCount;
        this.whiteKeys = []; this.blackKeys = []; this.keyMap = {};
        // create white positions
        let whiteIndex = 0;
        for (let midi = start; midi <= end; midi++) {
          const pc = midi % 12;
          const noteName = NOTES[pc];
          const isBlack = noteName.includes('#');
          if (!isBlack) {
            const x = Math.round(whiteIndex * wk);
            const key = { midi, note: midiToName(midi), x, y:0, w: Math.ceil(wk), h: height, color:'#fff' };
            this.whiteKeys.push(key);
            this.keyMap[midi] = key;
            whiteIndex++;
          }
        }
        // black keys: iterate again using white positions
        const skipMap = {2:true,6:true,9:true,13:true}; // pattern per 14-window fallback not needed here
        // simpler method: compute center of each white and place black between them where appropriate
        for (let i=0;i<this.whiteKeys.length-1;i++){
          const left = this.whiteKeys[i];
          const right = this.whiteKeys[i+1];
          const midiLeft = left.midi;
          // black exists between if semitone distance is 2
          if ((right.midi - left.midi) === 2) {
            // no black (E-F or B-C)
            continue;
          } else {
            // find black midi
            const blackMidi = left.midi + 1;
            const bx = left.x + Math.floor(left.w * 0.66);
            const bw = Math.floor(left.w * 0.66);
            const bh = Math.floor(height * 0.62);
            const key = { midi: blackMidi, note: midiToName(blackMidi), x: bx, y:0, w: bw, h: bh, color:'#000', isBlack:true };
            this.blackKeys.push(key);
            this.keyMap[blackMidi] = key;
          }
        }
      },
  
      draw() {
        const ctx = this.ctx;
        const w = this.canvas.width = this.canvas.clientWidth * devicePixelRatio;
        const h = this.canvas.height = this.canvas.clientHeight * devicePixelRatio;
        ctx.clearRect(0,0,w,h);
        ctx.save();
        ctx.scale(devicePixelRatio, devicePixelRatio);
  
        // draw white keys
        for (const k of this.whiteKeys) {
          ctx.fillStyle = this.pressed.has(k.note) ? '#ffd54f' : '#fff';
          ctx.fillRect(k.x / devicePixelRatio, k.y, k.w / devicePixelRatio, k.h / devicePixelRatio);
          ctx.strokeStyle = '#111';
          ctx.strokeRect(k.x / devicePixelRatio, k.y, k.w / devicePixelRatio, k.h / devicePixelRatio);
        }
        // draw black keys
        for (const k of this.blackKeys) {
          ctx.fillStyle = this.pressed.has(k.note) ? '#ff9800' : '#000';
          ctx.fillRect(k.x / devicePixelRatio, k.y, k.w / devicePixelRatio, k.h / devicePixelRatio);
        }
        ctx.restore();
      },
  
      _bindEvents() {
        const c = this.canvas;
        const toDevice = (ev) => {
          const r = c.getBoundingClientRect();
          const x = (ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left;
          const y = (ev.touches ? ev.touches[0].clientY : ev.clientY) - r.top;
          return { x, y };
        };
  
        const hitTest = (x,y) => {
          // check black keys first
          for (let k of this.blackKeys) {
            const rx = k.x / devicePixelRatio, rw = k.w / devicePixelRatio, rh = k.h / devicePixelRatio;
            if (x >= rx && x <= rx+rw && y >= k.y && y <= k.y+rh) return k;
          }
          for (let k of this.whiteKeys) {
            const rx = k.x / devicePixelRatio, rw = k.w / devicePixelRatio, rh = k.h / devicePixelRatio;
            if (x >= rx && x <= rx+rw && y >= k.y && y <= k.y+rh) return k;
          }
          return null;
        };
  
        c.addEventListener('mousedown', (e)=>{
          const {x,y} = toDevice(e);
          const k = hitTest(x,y);
          if (!k) return;
          const note = k.note;
          this.pressed.add(note);
          this.draw();
          this.onKeyDown && this.onKeyDown(note);
        });
  
        c.addEventListener('mouseup', (e)=>{
          // clear all pressed (simple behaviour)
          this.pressed.clear();
          this.draw();
          this.onKeyUp && this.onKeyUp();
        });
  
        // touch support
        c.addEventListener('touchstart',(e)=>{
          e.preventDefault();
          const {x,y} = toDevice(e);
          const k = hitTest(x,y);
          if (!k) return;
          const note = k.note;
          this.pressed.add(note);
          this.draw();
          this.onKeyDown && this.onKeyDown(note);
        }, {passive:false});
  
        c.addEventListener('touchend',(e)=>{
          e.preventDefault();
          this.pressed.clear();
          this.draw();
          this.onKeyUp && this.onKeyUp();
        }, {passive:false});
      },
  
      // programmatic highlight
      flashKey(noteName, velocity=1){
        this.pressed.add(noteName);
        this.draw();
        setTimeout(()=>{ this.pressed.delete(noteName); this.draw(); }, Math.max(150, Math.round(600*velocity)));
      }
    };
  
    global.PianoUI = PianoUI;
  })(window);
  