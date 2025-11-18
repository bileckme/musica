/* music-theory.js
   Clean, fixed, and improved music theory helpers
   Exports: identifyNote, identifyChord, identifyChordDetail,
            identifyScale, highlightKeys, highlightChord, highlightScale
*/
(function(){
    const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  
    const SCALES = {
      major: [0,2,4,5,7,9,11],
      minor: [0,2,3,5,7,8,10],
      dorian: [0,2,3,5,7,9,10],
      lydian: [0,2,4,6,7,9,11],
      mixolydian: [0,2,4,5,7,9,10],
    };
  
    // chord patterns keyed by interval pattern relative to root
    const CHORD_PATTERNS = {
      '0,4,7': 'Major',
      '0,3,7': 'Minor',
      '0,3,6': 'Diminished',
      '0,4,8': 'Augmented',
      '0,4,7,10': 'Dominant 7th',
      '0,4,7,11': 'Major 7th',
      '0,3,7,10': 'Minor 7th',
      '0,3,6,10': 'Half Diminished 7th',
      '0,3,6,9': 'Diminished 7th',
      '0,5,7': 'Sus4',
      '0,2,7': 'Sus2',
      '0,4,7,9': '6th',
      '0,3,7,9': 'm6',
      '0,2,4,7': 'Add9',
      '0,4,7,10,2': '9th',
      '0,4,7,10,2,5': '11th',
      '0,4,7,10,2,5,9': '13th'
    };
  
    function mod12(n){ return ((n%12)+12)%12; }
  
    function uniquePitchClasses(midiNotes){
      const s = new Set(midiNotes.map(n => mod12(n)));
      return Array.from(s).sort((a,b)=>a-b);
    }

    function noteNameToMidi(noteName) {
      // Example input: "C4", "F#3"
      const match = noteName.match(/^([A-G])(#|b)?(\d)$/);
      if (!match) return null;

      const [, letter, accidental, octaveStr] = match;
      const baseNotes = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
      let midi = baseNotes[letter] + (parseInt(octaveStr) + 1) * 12;

      if (accidental === "#") midi += 1;
      if (accidental === "b") midi -= 1;

      return midi;
    }
  
    // --- public utilities ---
    window.identifyNote = function(midi){
      if (typeof midi !== 'number') return null;
      const name = NOTE_NAMES[midi % 12];
      const octave = Math.floor(midi / 12) - 1;
      return `${name}${octave}`;
    };
  
    // returns detailed object with root, type, pattern, inversion, function (if any)
    window.identifyChordDetail = function(midiNotes){
      if (!Array.isArray(midiNotes) || midiNotes.length === 0) return null;
  
      // normalize
      const uniquePCs = uniquePitchClasses(midiNotes);
  
      // For recognition try each pitch-class as possible root (this handles inversions)
      for (let rootPC of uniquePCs){
        // compute intervals relative to rootPC, sorted ascending
        const intervals = uniquePCs.map(pc => mod12(pc - rootPC));
        intervals.sort((a,b)=>a-b);
        // ensure root (0) present
        if (intervals[0] !== 0) continue;
        const patternKey = intervals.join(',');
        const type = CHORD_PATTERNS[patternKey] || 'Unknown';
  
        // determine inversion (lowest pitch of the original midiNotes)
        const lowest = Math.min(...midiNotes);
        const bassPC = mod12(lowest);
        const inversion = bassPC === rootPC ? '' : NOTE_NAMES[bassPC];
  
        const rootName = NOTE_NAMES[rootPC];
  
        // attempt to detect diatonic function
        const func = detectDiatonicFunction(rootName, type);
  
        return {
          rootPC,
          rootName,
          type,
          pattern: patternKey,
          inversion: inversion ? `/${inversion}` : '',
          diatonicFunction: func || null
        };
      }
  
      // if nothing matched return a best-effort generic
      const noteNames = midiNotes
        .map(n => window.identifyNote(n))
        .filter(Boolean)
        .join('-');

      return {
        rootPC: uniquePCs[0],
        rootName: NOTE_NAMES[uniquePCs[0]],
        type: `Complex (${noteNames})`,
        pattern: uniquePCs.join(','),
        inversion: '',
        diatonicFunction: null
      };
    };
  
    // backward-compatible string formatter
    (function() {

        function identifyChord(notes) {
            if (!notes || notes.length === 0) return '–';
        
            // Convert MIDI numbers to note names without octave
            const names = notes.map(n => midiToNoteName(n).replace(/\d/, ''));
            // Remove duplicates and sort
            const uniqNames = [...new Set(names)];
        
            const semitones = uniqNames.map(n => noteToSemitone(n));
            if (semitones.includes(-1)) return '?';
        
            // Single note
            if (uniqNames.length === 1) return `${uniqNames[0]} Note`;
        
            // Diad
            if (uniqNames.length === 2) return `${uniqNames[0]} Diad (${uniqNames.join('-')})`;
        
            // Triads (3 notes)
            if (uniqNames.length === 3) {
                const root = uniqNames[0];
                const intervals = semitones.map(s => (s - semitones[0] + 12) % 12);
                const pattern = `${intervals[1]},${intervals[2]}`;
        
                switch (pattern) {
                    case '4,3': return `${root} Major Triad (${uniqNames.join('-')})`;
                    case '3,4': return `${root} Minor Triad (${uniqNames.join('-')})`;
                    case '3,3': return `${root} Diminished Triad (${uniqNames.join('-')})`;
                    case '4,4': return `${root} Augmented Triad (${uniqNames.join('-')})`;
                    case '2,5': return `${root} Suspended 2nd Triad (${uniqNames.join('-')})`;
                    case '5,2': return `${root} Suspended 4th Triad (${uniqNames.join('-')})`;
                    default: return `${root} Triad Cluster (${uniqNames.join('-')})`;
                }
            }
        
            // 7th chords (4 notes)
            if (uniqNames.length === 4) {
                const root = uniqNames[0];
                const intervals = semitones.map(s => (s - semitones[0] + 12) % 12);
                const pattern = `${intervals[1]},${intervals[2]},${intervals[3]}`;
        
                switch (pattern) {
                    case '4,3,3': return `${root}7 (Dominant Seventh)`;
                    case '3,4,3': return `${root}m7 (Minor Seventh)`;
                    case '4,3,4': return `${root}M7 (Major Seventh)`;
                    case '3,3,4': return `${root}m7♭5 (Half-Diminished)`;
                    default: return `${root} Seventh/Complex (${uniqNames.join('-')})`;
                }
            }
        
            // Larger clusters
            return `${uniqNames.join('-')}`;
        }
        
        // Utility: convert note name to semitone index
        function noteToSemitone(note) {
            const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 
                           'F#', 'G', 'G#', 'A', 'A#', 'B'];
            const n = note.replace(/\d/, '');
            return NOTES.indexOf(n);
        }               
        
        // Attach globally
        window.identifyChord = identifyChord;
      
      })();      
  
    // scale helper
    window.identifyScale = function(rootName, scaleType){
      if (!NOTE_NAMES.includes(rootName)) return [];
      const pattern = SCALES[scaleType];
      if (!pattern) return [];
      const rootIndex = NOTE_NAMES.indexOf(rootName);
      return pattern.map(i => NOTE_NAMES[ mod12(rootIndex + i) ]);
    };

    // ---- diatonic function detection (major, natural minor, harmonic minor)
    function detectDiatonicFunction(rootNote, chordType){
      if (!NOTE_NAMES.includes(rootNote)) return '';
      const ROOT_INDEX = NOTE_NAMES.indexOf(rootNote);
      const KEYS = NOTE_NAMES.slice(0);
  
      const MAJOR_DEGREES = [
        {roman:'I', type:'Major'},
        {roman:'ii', type:'Minor'},
        {roman:'iii', type:'Minor'},
        {roman:'IV', type:'Major'},
        {roman:'V', type:'Major'},
        {roman:'vi', type:'Minor'},
        {roman:'vii°', type:'Diminished'}
      ];
      const MINOR_DEGREES = [
        {roman:'i', type:'Minor'},
        {roman:'ii°', type:'Diminished'},
        {roman:'III', type:'Major'},
        {roman:'iv', type:'Minor'},
        {roman:'v', type:'Minor'},
        {roman:'VI', type:'Major'},
        {roman:'VII', type:'Major'}
      ];
  
      const matches = [];
  
      for (const key of KEYS){
        const keyIndex = NOTE_NAMES.indexOf(key);
  
        const majorScale = [
          keyIndex,
          (keyIndex+2)%12,
          (keyIndex+4)%12,
          (keyIndex+5)%12,
          (keyIndex+7)%12,
          (keyIndex+9)%12,
          (keyIndex+11)%12
        ];
        const naturalMinor = [
          keyIndex,
          (keyIndex+2)%12,
          (keyIndex+3)%12,
          (keyIndex+5)%12,
          (keyIndex+7)%12,
          (keyIndex+8)%12,
          (keyIndex+10)%12
        ];
        const harmonicMinor = [
          keyIndex,
          (keyIndex+2)%12,
          (keyIndex+3)%12,
          (keyIndex+5)%12,
          (keyIndex+7)%12,
          (keyIndex+8)%12,
          (keyIndex+11)%12
        ];
  
        const majDeg = majorScale.indexOf(ROOT_INDEX);
        if (majDeg !== -1){
          const deg = MAJOR_DEGREES[majDeg];
          if (chordType.includes(deg.type) || chordType === 'Unknown') matches.push(`${deg.roman} in ${key} Major`);
        }
        const minDeg = naturalMinor.indexOf(ROOT_INDEX);
        if (minDeg !== -1){
          const deg = MINOR_DEGREES[minDeg];
          if (chordType.includes(deg.type) || chordType === 'Unknown') matches.push(`${deg.roman} in ${key} minor`);
        }
        const harmDeg = harmonicMinor.indexOf(ROOT_INDEX);
        if (harmDeg !== -1){
          const deg = MINOR_DEGREES[harmDeg];
          if (chordType.includes(deg.type) || chordType === 'Unknown') matches.push(`${deg.roman} in ${key} harmonic minor`);
        }
      }
  
      if (matches.length === 0) return '';
      if (matches.length === 1) return matches[0];
      return matches.join(' / ');
    }
  
    /* ---------------- Visualization helpers ----------------
       whiteKeys and blackKeys that your piano draws are expected
       to be arrays like in your previewer:
         whiteKeys: [{note:'C1', x:..., width:...}, ...]
         blackKeys: [{note:'C#1', x:..., width:...}, ...]
       highlightChord/Scale accept note names (no octave): 'C', 'D#', ...
    ----------------------------------------------------- */
  
    window.highlightKeys = function(ctx, keys, color='lightblue'){
      if (!ctx || !Array.isArray(keys)) return;
      ctx.save();
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = color;
      keys.forEach(k => {
        if (k && typeof k.x === 'number' && typeof k.width === 'number'){
          ctx.fillRect(k.x, 0, k.width, ctx.canvas.height);
        }
      });
      ctx.restore();
    };
  
    // chordNotes: array of note names like ['C','E','G']
    window.highlightChord = function(ctx, chordNotes, whiteKeys=[], blackKeys=[]){
      if (!ctx || !Array.isArray(chordNotes)) return;
      const color = '#80deea';
      chordNotes.forEach(n => {
        if (!n) return;
        const matchW = whiteKeys.find(k=>k.note && k.note.startsWith(n));
        const matchB = blackKeys.find(k=>k.note && k.note.startsWith(n));
        if (matchW){
          ctx.fillStyle = color;
          ctx.fillRect(matchW.x, 0, matchW.width, ctx.canvas.height);
        }
        if (matchB){
          ctx.fillStyle = color;
          ctx.fillRect(matchB.x, 0, matchB.width, ctx.canvas.height * 0.6);
        }
      });
    };
  
    window.highlightScale = function(ctx, root, scaleType, whiteKeys=[], blackKeys=[]){
      if (!ctx) return;
      const notes = window.identifyScale(root, scaleType);
      if (!notes || notes.length === 0) return;
      const color = '#81c784';
      notes.forEach(n => {
        const matchW = whiteKeys.find(k=>k.note && k.note.startsWith(n));
        const matchB = blackKeys.find(k=>k.note && k.note.startsWith(n));
        if (matchW){
          ctx.fillStyle = color;
          ctx.fillRect(matchW.x, 0, matchW.width, ctx.canvas.height);
        }
        if (matchB){
          ctx.fillStyle = color;
          ctx.fillRect(matchB.x, 0, matchB.width, ctx.canvas.height * 0.6);
        }
      });
    };
  
    console.log('🎵 music-theory.js loaded');
  })();
  