// previewer.js

// Track currently active MIDI notes
let activeMidiNotes = new Set();
let infoTimeout = null;
let musicInfoHideTimeout;
const canvas = document.getElementById('kbd');
const ctx = canvas.getContext('2d');

const semitones = {
  'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
  'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8,
  'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
};

// --- Audio Setup ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const QUALITIES = { 
  maj: [0,4,7],
  min: [0,3,7],
  dom7: [0,4,7,10],
  maj7: [0,4,7,11],
  m7: [0,3,7,10],
  dim: [0,3,6],
  sus2: [0,2,7],
  sus4: [0,5,7],
  add9: [0,4,7,14],
  add11: [0,4,7,17],
  add13: [0,4,7,21],
  '9th': [0,4,7,10,14],
  '11th': [0,4,7,10,14,17],
  '13th': [0,4,7,10,14,17,21]
};
const WHITE_KEYS = 14;

// --- Canvas & Keyboard setup ---
const canvasMain = document.getElementById('kbd');
const W = canvasMain.width, H = canvasMain.height;
const WK_W = W/WHITE_KEYS, WK_H = H*0.9;
const BK_W = WK_W*0.65, BK_H = H*0.55;

const whiteCycle = ['C','D','E','F','G','A','B'];
const visible = [];
for(let i=0;i<WHITE_KEYS;i++){
  const base = whiteCycle[i%7];
  visible.push({name:base, kind:'white', x:i*WK_W+WK_W/2});
  if (![2,6,9,13].includes(i)) visible.push({name:base+'#', kind:'black', x:i*WK_W+WK_W*0.65+BK_W/2});
}

window.whiteKeys = visible.filter(k => k.kind === 'white').map(k => ({
  note: k.name,
  x: k.x - WK_W/2,
  width: WK_W,
  height: WK_H,
  kind: 'white'
}));

window.blackKeys = visible.filter(k => k.kind === 'black').map(k => ({
  note: k.name,
  x: k.x - BK_W/2,
  width: BK_W,
  height: BK_H,
  kind: 'black'
}));

let sustain = false;

// --- Frequency & Playback ---
function noteFreq(note, oct=4){
  const a4 = 440;
  const n = NOTES.indexOf(note)-NOTES.indexOf('A')+(oct-4)*12;
  return a4*Math.pow(2,n/12);
}

function chordNotesToMidi(notes) {
  const NOTE_TO_MIDI = {
    "C": 60, "C#": 61, "Db": 61, "D": 62, "D#": 63, "Eb": 63,
    "E": 64, "F": 65, "F#": 66, "Gb": 66, "G": 67, "G#": 68, "Ab": 68,
    "A": 69, "A#": 70, "Bb": 70, "B": 71
  };
  return notes.map(n => NOTE_TO_MIDI[n.replace(/[0-9]/g, '')] || 60);
}

function midiToNoteName(midi) {
  const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(midi / 12) - 1;
  const note = NOTES[midi % 12];
  return `${note}${octave}`;
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


function renderNotes(midiNotes, options = {}) {
  // Update global state
  activeMidiNotes = midiNotes;

  // Redraw the staves with current notes
  drawGrandStaff(activeMidiNotes);

  // Optional: play or mute
  if (options.play) {
    playMidiNotes(activeMidiNotes);
  }

  // Optional: update chord/scale info
  if (options.updateInfo) {
    updateMusicInfoFromActiveNotes(activeMidiNotes);
  }
}

function drawGrandStaff(midiNotes = []) {
   try {
    if (!Array.isArray(midiNotes)) {
      if (midiNotes instanceof Set) midiNotes = Array.from(midiNotes);
      else if (midiNotes == null) midiNotes = [];
      else midiNotes = [midiNotes];
    }

    // Filter out nulls or NaN just in case
    midiNotes = midiNotes.filter(n => typeof n === 'number' && !isNaN(n));

    // Skip if nothing usable — silently ignore (no console spam)
    if (midiNotes.length === 0) return;

    // Try to locate the notation element (main or iframe)
    let element = document.getElementById('notation');
    if (!element) {
      const iframe = document.getElementById('grandStaffFrame');
      if (iframe?.contentDocument) {
        element = iframe.contentDocument.getElementById('notation');
      }
    }

    if (!element) {
      console.error('❌ drawGrandStaff: Cannot find element with id="notation" in document or iframe.');
      return;
    }

    // Clear any previous notation
    element.innerHTML = '';

    // Initialize VexFlow safely
    const vf = new Vex.Flow.Factory({
      renderer: {
        elementId: element.id || 'notation',
        width: 700,  // smaller width for better fit
        height: 250  // reduced height to avoid taking too much space
      }
    });

    const score = vf.EasyScore();
    const system = vf.System({ x: 10, y: 30, width: 650, spaceBetweenStaves: 8 });

    // Separate notes into treble and bass
    const trebleNotes = midiNotes.filter(n => n >= 60).map(midiToNoteName);
    const bassNotes = midiNotes.filter(n => n < 60).map(midiToNoteName);

    // If still empty, skip rendering
    if (trebleNotes.length === 0 && bassNotes.length === 0) {
      console.warn('⚠️ drawGrandStaff: No playable notes after filtering.');
      return;
    }

    // Try creating VexFlow voices safely
    try {
      const trebleVoice = trebleNotes.length
        ? score.voice(score.notes(trebleNotes.join(','), { clef: 'treble' }))
        : null;
      const bassVoice = bassNotes.length
        ? score.voice(score.notes(bassNotes.join(','), { clef: 'bass' }))
        : null;

      if (trebleVoice) system.addStave({ voices: [trebleVoice] }).addClef('treble').addTimeSignature('4/4');
      if (bassVoice) system.addStave({ voices: [bassVoice] }).addClef('bass').addTimeSignature('4/4');

      vf.draw();
    } catch (vfErr) {
      console.error('❌ VexFlow rendering error:', vfErr);
    }

  } catch (err) {
    console.error('❌ drawGrandStaff runtime error:', err);
  }
}

function setActiveNotes(midiNumbers) {
  activeMidiNotes = midiNumbers;
  drawActiveNotes(activeMidiNotes);
  updateMusicInfoFromActiveNotes();
}

function drawActiveNotes(notes) {
  if (typeof drawNotesOnStaff === 'function') {
    drawNotesOnStaff(notes);
  } else if (typeof renderActiveNotes === 'function') {
    renderActiveNotes(notes);
  } else {
    console.warn("drawActiveNotes: no compatible render function found.");
  }
}

function playNote(noteName, velocity=0.5, duration=1.2){
  const noteMatch = noteName.match(/^([A-G]#?)(\d)$/);
  if(!noteMatch) return;
  const [_, note, octave] = noteMatch;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(noteFreq(note, parseInt(octave)), audioCtx.currentTime);
  gain.gain.setValueAtTime(0.001,audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(velocity,audioCtx.currentTime+0.05);
  gain.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+duration);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime+duration);
  
  window.pressedKeys.add(noteName);
  drawKeyboard();
  updateMusicInfoFromActiveNotes(); // ✅ update on manual or program play

  
  setTimeout(() => { 
    window.pressedKeys.delete(noteName);
    drawKeyboard();
  }, duration*1000);
}


function playNotes(notes, velocity=0.5){
  notes.forEach(n => playNote(n, velocity, 1.2));
}

function playNotesUnified(notes, velocity = 0.7, duration = 1.2) {
  if (!Array.isArray(notes) || notes.length === 0) return;
  
  // Stop any currently ringing oscillators (optional, if you track them)
  if (window.currentOscillators) {
    window.currentOscillators.forEach(o => o.stop());
  }
  window.currentOscillators = [];

  const parent = window.parent || window;
  notes.forEach(n => {
    const noteName = /\d/.test(n) ? n : n + '4'; // ensure octave
    if (parent.playNote) parent.playNote(noteName, velocity, duration);
  });
}

function playNotesAndShowOnStaff(notes, velocity = 0.7, duration = 1.2) {
  if (!Array.isArray(notes) || notes.length === 0) return;
  playNotesUnified(notes, velocity, duration);

  // Convert to MIDI numbers and update staff
  const midiNumbers = notes.map(noteName => noteNameToMidi(noteName));
  window.activeMidiNotes = new Set(midiNumbers);

  setActiveNotes(midiNumbers);

  const staffFrame = document.getElementById('grandStaffFrame');
  if (staffFrame?.contentWindow?.drawNotes) {
    staffFrame.contentWindow.drawNotes(midiNumbers);
  }

  setTimeout(() => {
    if (staffFrame?.contentWindow?.clearNotes) {
      staffFrame.contentWindow.clearNotes();
    }
  }, duration * 1000);

}


// --- Chord Notes ---
function chordNotes(root, quality){
  const rIndex = NOTES.indexOf(root);
  const intervals = QUALITIES[quality] || QUALITIES.maj;
  return intervals.map(i => NOTES[(rIndex+i)%12]);
}

// --- Draw Keyboard ---
function drawKeyboardOnCanvas(canvas, chord){
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,canvas.width,canvas.height);
  const WK_W = canvas.width/WHITE_KEYS;
  const WK_H = canvas.height*0.9;
  const BK_W = WK_W*0.65;
  const BK_H = canvas.height*0.55;

  // Draw white keys
  for(let i=0;i<WHITE_KEYS;i++){
    ctx.fillStyle='#fff';
    ctx.fillRect(i*WK_W,0,WK_W,WK_H);
    ctx.strokeStyle='#000';
    ctx.strokeRect(i*WK_W,0,WK_W,WK_H);
  }

  // Draw black keys
  for(let i=0;i<WHITE_KEYS;i++){
    if([2,6,9,13].includes(i)) continue;
    const bx = i*WK_W+WK_W*0.65;
    ctx.fillStyle='#000';
    ctx.fillRect(bx,0,BK_W,BK_H);
  }

  // Highlight chord notes
  const notes = chordNotes(chord.root, chord.quality);
  notes.forEach(n=>{
    const pos = visible.find(k=>k.name===n);
    if(!pos) return;
    const x = pos.x*(canvas.width/W);
    const y = pos.kind==='black'?BK_H-5:WK_H-8;
    ctx.beginPath();
    if(chord.slash) ctx.fillStyle = '#0077ff'; // Slash chord color
    else ctx.fillStyle = pos.kind==='black'?'#fff':'#000';
    ctx.arc(x,y,3,0,Math.PI*2);
    ctx.fill();
  });
}

// --- Parse chord ---
function parseChord(chordText){
  let root='', quality='maj', slashRoot=null;
  if(chordText.includes('/')){
    [chordText, slashRoot] = chordText.split('/');
  }
  const match = chordText.match(/^[A-G](#|b)?/);
  if(match) root=match[0];
  quality = chordText.slice(root.length);
  if(!QUALITIES[quality]){
    if(quality==='') quality='maj';
    else if(quality==='m') quality='min';
    else if(quality==='7') quality='dom7';
    else if(quality==='m7') quality='m7';
    else if(quality==='maj7') quality='maj7';
    else if(quality==='dim') quality='dim';
    else if(quality==='sus2') quality='sus2';
    else if(quality==='sus4') quality='sus4';
    else if(quality.startsWith('add')) quality=quality;
    else if(['9th','11th','13th'].includes(quality)) quality=quality;
    else quality='maj';
  }
  return {root, quality, slashRoot};
}

// --- Root & Quality selectors ---
const rootSel = document.getElementById('root');
const qualitySel = document.getElementById('quality');

function populateRootQualitySelectors(defaultChord = { root:'C', quality:'maj' }){
  rootSel.innerHTML=''; NOTES.forEach(n=>{
    const opt=document.createElement('option'); opt.value=n; opt.textContent=n; rootSel.appendChild(opt);
  }); rootSel.value=defaultChord.root;

  qualitySel.innerHTML=''; 
  ['maj','min','dom7','maj7','m7','dim','sus2','sus4','add9','add11','add13','9th','11th','13th'].forEach(q=>{
    const opt=document.createElement('option'); opt.value=q; opt.textContent=q; qualitySel.appendChild(opt);
  }); qualitySel.value=defaultChord.quality;
}

// --- Load songs JSON ---
let songs = {};
fetch('./assets/json/songs.json')
.then(r=>r.json())
.then(data=>{
  songs = data;
  const firstSong = Object.keys(songs)[0];
  const firstChord = parseChord(songs[firstSong].progression[0][0] || 'C');
  populateRootQualitySelectors(firstChord);
  renderSong(firstSong);

  // Populate song selector
  const songSelect = document.getElementById('songSelect');
  Object.keys(songs).forEach(name=>{
    const opt=document.createElement('option'); opt.value=name; opt.textContent=name; songSelect.appendChild(opt);
  });
  songSelect.value=firstSong;
  songSelect.addEventListener('change', e=>{
    const song = songs[e.target.value];
    const firstChord = parseChord(song.progression[0][0] || 'C');
    populateRootQualitySelectors(firstChord);
    renderSong(e.target.value);
  });
})
.catch(err=>console.error('Failed to load songs JSON:', err));

// --- Highlight notes on the parent main keyboard safely ---
function highlightNotesOnMainKeyboard(notes, duration = 1000) {
  try {
    const parentWindow = window.parent;
    if (!parentWindow) return;

    // Ensure the parent has these arrays
    const whiteKeys = parentWindow.whiteKeys || [];
    const blackKeys = parentWindow.blackKeys || [];

    if (!whiteKeys.length && !blackKeys.length) return; // nothing to highlight

    const allKeys = whiteKeys.concat(blackKeys);

    const canvasMain = parentWindow.document.getElementById('pianoCanvas');
    if (!canvasMain) return;

    const ctx = canvasMain.getContext('2d');

    notes.forEach(noteName => {
      const key = allKeys.find(k => k.note === noteName);
      if (!key) return;
      ctx.fillStyle = '#00aaff88';
      ctx.fillRect(key.x, 0, key.width, key.height || parentWindow.height * (key.note.includes('#') ? 0.6 : 1));
    });

    setTimeout(() => {
      if (typeof parentWindow.drawKeyboard === 'function') {
        parentWindow.drawKeyboard();
      }
    }, duration);

  } catch (err) {
    console.warn('Highlight failed safely:', err);
  }
}


// --- Draw chord on main keyboard ---
function drawChord(root, quality, slash=false){
  drawKeyboardOnCanvas(canvasMain, { root, quality, slash });
  document.getElementById('chordLabel').textContent = root + (quality==='maj'?'':quality);
}

function getMidiFromChord(root, quality) {
  const notes = chordNotes(root, quality).map(n => n + '4');
  return notes.map(noteNameToMidi);
}

function playChord({ root, quality }) {
  const notes = chordNotes(root, quality).map(n => n + '4');
  playNotesUnified(notes);
}

function highlightNotes(notes, duration = 1000) {
  highlightNotesOnMainKeyboard(notes, duration);
  if (typeof drawKeyboard === 'function') drawKeyboard();
}

// --- Render song ---
function renderSong(songName){
  const song = songs[songName]; if(!song) return;

  // Embed iframe
  const iframe = document.querySelector('.left iframe'); iframe.src=song.embed_url;

  // Lyrics
  const lyricsDiv = document.querySelector('.lyrics div'); lyricsDiv.innerHTML = song.lyrics;

  // Transposer
  document.getElementById('transposeBtn').addEventListener('click', () => {
    const semitones = parseInt(document.getElementById('transposeSelect').value);
    const root = rootSel.value;
    const quality = qualitySel.value;

    // Compute new root after transpose
    const rootIndex = NOTES.indexOf(root);
    const newRoot = NOTES[(rootIndex + semitones + 12) % 12];

    rootSel.value = newRoot;
    drawChord(newRoot, quality);
    const notes = chordNotes(newRoot, quality);
    playNotesAndShowOnStaff(notes);
    updateMusicInfo({ notes, chord: `${newRoot}${quality}`, scale: identifyScale(newRoot, 'major') });
    highlightNotesOnMainKeyboard(notes);
    if (typeof drawKeyboard === 'function') drawKeyboard();

    // Update Grand Staff iframe
    const staffFrame = document.getElementById('grandStaffFrame');
    if (staffFrame) {
      staffFrame.addEventListener('load', () => {
        const firstChord = parseChord(song.progression[0][0] || 'C');
        const midi = getMidiFromChord(firstChord.root, firstChord.quality);
        if (staffFrame.contentWindow?.drawNotes) {
          staffFrame.contentWindow.drawNotes(midi);
        }
      }, { once: true });
    }

  });

  const staffFrame = document.getElementById('grandStaffFrame');

  // Function to send a chord (array of MIDI numbers) to the iframe
  function showChordOnStaff(midiNumbers) {
      if (staffFrame.contentWindow && staffFrame.contentWindow.drawNotes) {
          staffFrame.contentWindow.drawNotes(midiNumbers);
      }
  }

  // Function to clear staff
  function clearStaff() {
      if (staffFrame.contentWindow && staffFrame.contentWindow.clearNotes) {
          staffFrame.contentWindow.clearNotes();
      }
  }

  // Chord Previews
  const chordPreviewsDiv = document.getElementById('chordPreviews');

  chordPreviewsDiv.addEventListener('click', (e) => {
      // Find the clicked canvas
      const canvas = e.target.closest('canvas');
      if (!canvas) return;

      // Get the chord data stored on the canvas
      const chordData = canvas.chordData;
      if (!chordData) return;

      // chordData should include root, quality, and optionally notes array
      const { root, quality, notes } = chordData;

      // Determine notes to play: use notes array if available, otherwise compute
      const chordNotesArray = notes || chordNotes(root, quality).map(n => n + '4');

      drawChord(chordData.root, chordData.quality);

      // Play the chord
      playChord(chordData);
      
      playNotesAndShowOnStaff(chordNotesArray);

      updateMusicInfo({ notes, chord: `${root}${quality}`, scale: identifyScale(root, 'major') });

      highlightNotesOnMainKeyboard(notes);
      if (typeof drawKeyboard === 'function') drawKeyboard();
  
      // Update root & quality selectors
      updateSelectors({ root, quality });
      const midiNumbers = getMidiFromChord(root, quality);

      // Update Grand Staff iframe
      const staffFrame = document.getElementById('grandStaffFrame');
      if (staffFrame?.contentWindow?.drawNotes) {
          staffFrame.contentWindow.drawNotes(Array.from(window.activeMidiNotes));
      }
  });


  chordPreviewsDiv.innerHTML='';
  const chordEls = lyricsDiv.querySelectorAll('.chord');
  const uniqueChords = [...new Set(Array.from(chordEls).map(c=>c.textContent))];

  uniqueChords.forEach(ch => {
    const container = document.createElement('div');
    container.className = 'chord-piano';
    
    const title = document.createElement('div'); 
    title.textContent = ch; 
    title.style.fontWeight = 'bold'; 
    title.style.marginBottom = '4px';
    container.appendChild(title);
    
    const canvas = document.createElement('canvas'); 
    canvas.width = 120; 
    canvas.height = 40;
    container.appendChild(canvas);
    
    // Parse chord once
    const chordData = parseChord(ch);
    drawKeyboardOnCanvas(canvas, { root: chordData.root, quality: chordData.quality, slash: !!chordData.slashRoot });
    
    // Bind click with closure to preserve chordData
    canvas.onclick = () => {
        const notes = chordNotes(chordData.root, chordData.quality);
        const chordNotesArray = chordNotes(chordData.root, chordData.quality)
          .map(n => n + "4"); // ensure octave for pianoCanvas

        drawChord(chordData.root, chordData.quality);
        highlightNotes(chordNotesArray, 1000);
        playNotesAndShowOnStaff(notes);
        //playNotesAndShowOnStaff(chordNotesArray);
        updateMusicInfoFromActiveNotes();
        updateMusicInfo({ notes, chord: `${chordData.root}${chordData.quality}`, scale: identifyScale(root, 'major') });

        // Highlight parent keyboard
        drawKeyboardOnCanvas(canvasMain, { root: chordData.root, quality: chordData.quality, slash: !!chordData.slashRoot });
        highlightNotesOnMainKeyboard(notes);
        if (typeof drawKeyboard === 'function') drawKeyboard();
        
        // Update main chord label
        document.getElementById('chordLabel').textContent = chordData.root + (chordData.quality === 'maj' ? '' : chordData.quality);
        
        // Update root/quality selectors
        rootSel.value = chordData.root;
        qualitySel.value = chordData.quality;

        const midiNumbers = getMidiFromChord(chordData.root, chordData.quality).map(n => n + semitones);
        showChordOnStaff(midiNumbers);

        // Update Grand Staff iframe
        const staffFrame = document.getElementById('grandStaffFrame');
        if (staffFrame?.contentWindow?.drawNotes) {
            staffFrame.contentWindow.drawNotes(Array.from(window.activeMidiNotes));
        }

        canvas.onmouseenter = () => {
          updateMusicInfo({ notes: chordNotes(chordData.root, chordData.quality), chord: `${chordData.root}${chordData.quality}`, scale: identifyScale(chordData.root, 'major') });
        };

    };
    
    chordPreviewsDiv.appendChild(container);
});
	

  // Chord chart
  const div = document.getElementById('chordChart');
  let html=`<div style="margin-bottom:6px;font-weight:bold;">Key of ${song.key}</div><table>`;
  song.progression.forEach(row=>{
    html+="<tr>"; row.forEach(ch=>html+=`<td>${ch||"&nbsp;"}</td>`); html+="</tr>";
  }); html+="</table>"; div.innerHTML=html;

  // Highlight first chord
  const firstChord = parseChord(song.progression[0][0] || 'C');
  drawChord(firstChord.root, firstChord.quality, !!firstChord.slashRoot);
}

// --- Play button ---
document.getElementById('showBtn').addEventListener('click', ()=>{
  const root = rootSel.value;
  const quality = qualitySel.value;
  const notes = chordNotes(root, quality);

  drawChord(root, quality);
  playNotesAndShowOnStaff(notes);
  updateMusicInfo({ notes, chord: `${root}${quality}`, scale: identifyScale(root, 'major') });
  highlightNotesOnMainKeyboard(notes);
  if (typeof drawKeyboard === 'function') drawKeyboard();
  drawChord(root, quality);

  // Use your transposer/midi logic to get MIDI numbers
  const midiNumbers = getMidiFromChord(root, quality);
  showChordOnStaff(midiNumbers);

  window.drawNote
  window.parent.postMessage({ type:'PLAY_CHORD', notes }, '*');
});


// --- Optional: Auto Play Song Progression ---
let isPlaying = false;
let playInterval = null;

// --- Keyboard Interactions (optional) ---
window.addEventListener('keydown', e => {
  if (e.repeat) return;
  const keyMap = {
    a: 'C', w: 'C#', s: 'D', e: 'D#', d: 'E', f: 'F', t: 'F#',
    g: 'G', y: 'G#', h: 'A', u: 'A#', j: 'B'
  };
  const note = keyMap[e.key];
  if (note) playNote(note);
});

// --- Responsive Canvas Resize ---
window.addEventListener('resize', () => {
  canvasMain.width = canvasMain.clientWidth;
  canvasMain.height = 120;
  const root = rootSel.value;
  const quality = qualitySel.value;
  drawChord(root, quality);
});

// --- DOM Ready fallback ---
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const firstSong = document.getElementById('songSelect')?.value;
    if (firstSong && songs[firstSong]) renderSong(firstSong);
  });
} else {
  const firstSong = document.getElementById('songSelect')?.value;
  if (firstSong && songs[firstSong]) renderSong(firstSong);
}

let playLyricsTimer = null;
let isAutoPlayingLyrics = false;

async function playSong(sequence) {
  for (const chord of sequence) {
    const midiNotes = chordNotesToMidi(chord);
    playMidiNotes(midiNotes);
    setActiveNotes(midiNotes);
    await sleep(800);
  }
  setActiveNotes([]); // clear staff after playback
}

function playFullSong(songName) {
  const song = songs[songName];
  if (!song) return console.warn("Song not found:", songName);

  // Flatten the song's chord progression into a single sequence
  const sequence = song.progression.flat().filter(Boolean);

  // Convert all chords to playable data
  const playableSequence = sequence.map(chordText => {
    const chordData = parseChord(chordText);
    const notes = chordNotes(chordData.root, chordData.quality).map(n => n + '4');
    return notes;
  });

  // Sequentially play each chord using playSong()
  playSong(playableSequence);
}


function playSongProgressionFromLyrics() {
  const playBtn = document.getElementById('playSongBtn');

  // --- STOP mode ---
  if (isAutoPlayingLyrics) {
    clearInterval(playLyricsTimer);
    isAutoPlayingLyrics = false;
    playBtn.textContent = 'Play Song 🎼';
    return;
  }

  // --- START mode ---
  const songName = document.getElementById('songSelect')?.value;
  const song = songs[songName];
  if (!song) return;

  const lyricsDiv = document.querySelector('.lyrics div');
  const chordEls = lyricsDiv?.querySelectorAll('.chord');
  if (!chordEls || chordEls.length === 0) return;

  let index = 0;
  isAutoPlayingLyrics = true;
  playBtn.textContent = 'Stop Song';

  // clear any existing highlights
  chordEls.forEach(el => (el.style.color = ''));

  const playNextChord = () => {
    if (index >= chordEls.length) {
      clearInterval(playLyricsTimer);
      isAutoPlayingLyrics = false;
      playBtn.textContent = 'Play Song 🎼';
      return;
    }

    const el = chordEls[index];
    const chordText = el.textContent.trim();
    const chordData = parseChord(chordText);
    const notes = chordNotes(chordData.root, chordData.quality).map(n => n + '4'); // add octave

    // --- Play chord ---
    playNotesUnified(notes, 0.7, 1.5); // use duration 1.5s

    // --- Highlight chord in lyrics ---
    chordEls.forEach(c => c.style.color = '');
    el.style.color = '#0077ff';
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // --- Update visuals ---
    drawChord(chordData.root, chordData.quality, !!chordData.slashRoot);
    highlightNotesOnMainKeyboard(notes);
    if (typeof drawKeyboard === 'function') drawKeyboard();
    updateMusicInfo({ notes, chord: `${chordData.root}${chordData.quality}`, scale: identifyScale(chordData.root, 'major') });

    index++;
  };

  // Play first chord immediately
  playNextChord();

  // Then schedule remaining chords
  playLyricsTimer = setInterval(playNextChord, 2000); // adjust interval to match tempo
}

function openPracticeUI()
{
  window.parent.location.href = 'prototype.html';
}

document.getElementById('practiceBtn')?.addEventListener('click',openPracticeUI);

document.getElementById('playSongBtn')?.addEventListener('click', playSongProgressionFromLyrics);

document.getElementById('playSongBtn')?.addEventListener('click', () => {
  const songName = document.getElementById('songSelect')?.value;
  if (!songName) return;
  playFullSong(songName);
});


// --- MIDI Input Support ---
let midiEnabled = false;
let midiInputs = []; // store all MIDI inputs
let midiAccess = null;
let midiInput = null;

navigator.requestMIDIAccess()
  .then((access) => {
    midiAccess = access;

    // Grab first MIDI input if available
    const inputs = Array.from(midiAccess.inputs.values());
    if (inputs.length === 0) {
      console.warn('No MIDI devices found.');
      return;
    }

    midiInput = inputs[0];
    console.log('MIDI input ready:', midiInput.name);

    // ✅ Safe to assign handler now
    midiInput.onmidimessage = handleMIDIMessage;
  })
  .catch(err => console.error('MIDI access failed:', err));

navigator.requestMIDIAccess().then(midiAccess => {
  console.log('🎹 Available MIDI Inputs:');
  for (const input of midiAccess.inputs.values()) {
    console.log(`- ${input.name} (id: ${input.id})`);
  }
});

navigator.requestMIDIAccess().then(midiAccess => {
  for (const input of midiAccess.inputs.values()) {
    if (!/Midi Through/i.test(input.name)) { // skip virtual device
      console.log(`✅ Using MIDI device: ${input.name}`);
      input.onmidimessage = handleMIDIMessage;
      break;
    }
  }
});

function enableMIDI() {
  if (!navigator.requestMIDIAccess) {
    alert('Your browser does not support Web MIDI API.');
    return;
  }

  navigator.requestMIDIAccess()
    .then(midi => {
      midiAccess = midi;
      midiEnabled = true;

      midiInputs = Array.from(midiAccess.inputs.values()); // store inputs

      if (midiInputs.length === 0) {
        alert('No MIDI devices detected.');
        return;
      }

      midiInputs.forEach(input => {
        input.onmidimessage = handleMIDIMessage;
      });

      alert('🎹 MIDI Input Enabled. Play your keyboard to trigger chords.');
    })
    .catch(() => alert('Failed to access MIDI devices.'));
}

// MIDI message handler
function handleMIDIMessage(message) {
  try {
    if (!message?.data || message.data.length < 3) {
      console.warn('⚠️ Invalid MIDI message:', message);
      return;
    }

    const [status, note, velocity] = message.data;
    const command = status & 0xf0;
    const isNoteOn = command === 0x90 && velocity > 0;
    const isNoteOff = command === 0x80 || (command === 0x90 && velocity === 0);
    const noteName = midiToNoteName(note);
    const parent = window.parent || window;
    const staffFrame = document.getElementById('grandStaffFrame');
    const hasStaff = staffFrame?.contentWindow?.drawNotes;

    if (isNoteOn) {
      window.activeMidiNotes.add(note);
      window.pressedKeys.add(noteName);

      // Play note sound if parent has handler
      if (parent.playNote) {
        try {
          parent.playNote(noteName, velocity / 127);
        } catch (err) {
          console.warn('⚠️ playNote failed:', err);
        }
      }

      highlightNotes([noteName], 500);

      // Update Grand Staff
      if (hasStaff) {
        try {
          staffFrame.contentWindow.drawNotes([...window.activeMidiNotes]);
        } catch (err) {
          console.warn('⚠️ drawNotes failed in iframe:', err);
        }
      }

      updateMusicInfoFromActiveNotes();
    }

    else if (isNoteOff) {
      window.activeMidiNotes.delete(note);
      window.pressedKeys.delete(noteName);

      // Redraw keyboard (for release)
      if (parent.drawKeyboard) {
        try {
          parent.drawKeyboard();
        } catch (err) {
          console.warn('⚠️ drawKeyboard failed:', err);
        }
      }

      // Update Grand Staff
      if (hasStaff) {
        try {
          staffFrame.contentWindow.drawNotes([...window.activeMidiNotes]);
        } catch (err) {
          console.warn('⚠️ drawNotes failed in iframe:', err);
        }
      }

      const activeArray = [...window.activeMidiNotes];
      const chordStr = activeArray.length ? identifyChord(activeArray) : '–';

      updateMusicInfo({
        note: '–',
        chord: chordStr,
        notes: activeArray.map(midiToNoteName),
      });

      showMusicInfoThrottled(chordStr, activeArray.map(midiToNoteName));

      renderNotes(window.activeMidiNotes, { play: false, updateInfo: true });
    }

  } catch (err) {
    console.error('❌ handleMIDIMessage failed:', err);
  }
}

function onMIDISuccess(midi) {
  midiAccess = midi;
  midiEnabled = true;
  alert('🎹 MIDI Input Enabled. Play your keyboard to trigger chords.');
  midiAccess.inputs.forEach((input) => {
    input.onmidimessage = handleMIDIMessage;
  });
}

function onMIDIFailure() {
  alert('Failed to access MIDI devices.');
}

// Auto-prompt MIDI enable on load
window.addEventListener('load', () => {
  setTimeout(() => { if (confirm('Enable MIDI keyboard support?')) enableMIDI(); }, 1000);
});

// Keep active MIDI notes globally for chord recognition

// Keep track of active MIDI notes globally
window.activeMidiNotes = window.activeMidiNotes || new Set();
window.pressedKeys = window.pressedKeys || new Set();

// Convert MIDI number → note name (e.g., 60 → "C4")
function midiToNoteName(midi) {
  const NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  if (typeof midi !== 'number' || midi < 0) return null;
  const octave = Math.floor(midi / 12) - 1;
  return NOTES[midi % 12] + octave;
}

// Highlight notes on canvas and parent keyboard
function highlightNotes(notes, duration = 500) {
  const parent = window.parent || window;
  parent.pressedKeys = parent.pressedKeys || new Set();

  const noteNames = notes.map(n => typeof n === 'number' ? midiToNoteName(n) : n);
  noteNames.forEach(n => parent.pressedKeys.add(n));

  if (parent.drawKeyboard) parent.drawKeyboard();
  updateMusicInfoFromActiveNotes();

  setTimeout(() => {
    noteNames.forEach(n => parent.pressedKeys.delete(n));
    if (parent.drawKeyboard) parent.drawKeyboard();
  }, duration);
}

function updateMusicInfo({ notes = [], chord = '–', scale = null } = {}) {
  const info = document.getElementById('musicInfo');
  if (!info) return;

  if (infoTimeout) clearTimeout(infoTimeout);

  if (notes.length === 0 && (!chord || chord === '–')) {
    info.style.display = 'none';
    info.innerHTML = '';
    return;
  }

  // Shorten chord
  //const shortChord = shortenChordName(chord);

  info.innerHTML = `${chord}`;

  info.style.display = 'block';
  info.style.opacity = '1';
  info.style.transition = 'opacity 0.3s ease';

  // Fade out faster
  infoTimeout = setTimeout(() => {
    info.style.opacity = '0';
    setTimeout(() => info.style.display = 'none', 300);
  }, 1500); // visible for 1.5s instead of 5s
}

function highlightNotesOnParent(notes, duration = 500) {
  const parent = window.parent || window;
  parent.pressedKeys = parent.pressedKeys || new Set();

  const noteNames = notes.map(n => typeof n === 'number' ? midiToNoteName(n) : n);
  noteNames.forEach(n => parent.pressedKeys.add(n));

  if (parent.drawKeyboard) parent.drawKeyboard();
  updateMusicInfoFromActiveNotes();

  setTimeout(() => {
    noteNames.forEach(n => parent.pressedKeys.delete(n));
    if (parent.drawKeyboard) parent.drawKeyboard();
  }, duration);
}

function highlightNotesOnCanvas(notes, canvas, duration = 500, chordContext = { root: 'C', quality: 'maj' }) {
    if (!canvas || !notes || notes.length === 0) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    const WK_W = W / WHITE_KEYS;
    const WK_H = H * 0.9;
    const BK_W = WK_W * 0.65;
    const BK_H = H * 0.55;

    // Redraw base keyboard using chord context
    drawKeyboardOnCanvas(canvas, chordContext);

    // Highlight each note
    notes.forEach(n => {
        const noteName = typeof n === 'number' ? midiToNoteName(n) : midiToNoteName(n);
        const pos = visible.find(k => k.name === noteName);
        if (!pos) return;

        const x = pos.x * (canvas.width / W);
        const y = pos.kind === 'black' ? BK_H - 5 : WK_H - 8;
        ctx.beginPath();
        ctx.fillStyle = '#00aaff';
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
    });

    // Fade out highlight after duration
    setTimeout(() => drawKeyboardOnCanvas(canvas, chordContext), duration);
}



// Reference to visualizer container
const musicInfoDiv = document.getElementById('musicInfo');

// On messages from iframe (e.g., chord highlight)
window.addEventListener('message', e => {
  const msg = e.data;
  if(msg?.type === 'HIGHLIGHT_CHORD' && Array.isArray(msg.notes)) {
    updateMusicInfo({notes: msg.notes, chord: identifyChord(msg.notes)});
  }
});


const chordName = identifyChord(Array.from(activeMidiNotes));
if (chordName && chordName !== '') {
  const root = chordName.split(' ')[0];
  highlightChord(ctx, [root], whiteKeys, blackKeys);
}

canvas.addEventListener('mousedown', e => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  for (let k of blackKeys) {
    if (x >= k.x && x <= k.x + k.width && y < canvas.height * 0.6) {
      const noteName = k.note;
      const midi = nameToMidi(noteName);
      activeMidiNotes.add(midi);
      playNote(noteName);
      const chord = identifyChord(Array.from(activeMidiNotes));
      updateMusicInfo({ note: noteName, chord, notes: Array.from(activeMidiNotes).map(midiToNoteName) });
      return;
    }
  }
  for (let k of whiteKeys) {
    if (x >= k.x && x <= k.x + k.width) {
      const noteName = k.note;
      const midi = nameToMidi(noteName);
      activeMidiNotes.add(midi);
      playNote(noteName);
      const chord = identifyChord(Array.from(activeMidiNotes));
      updateMusicInfo({ note: noteName, chord, notes: Array.from(activeMidiNotes).map(midiToNoteName) });
      return;
    }
  }
});

canvas.addEventListener('mouseup', () => {
  activeMidiNotes.clear();
  drawKeyboardOnCanvas(canvas, { root: rootSel.value, quality: qualitySel.value });
  updateMusicInfo({ note: '–', chord: '–', notes: [] });
});

// Refresh Button
document.addEventListener("DOMContentLoaded", () => {
  const refreshBtn = document.getElementById("refreshBtn");

  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      try {
        // If previewer.html is inside an iframe, reload the parent page (index.html)
        if (window.top !== window.self) {
          window.top.location.reload();
        } else {
          // If not inside an iframe, reload the current page
          window.location.reload();
        }
      } catch (err) {
        console.error("❌ Failed to reload parent page:", err);
        window.location.reload();
      }
    });
  }
});

function getScaleNameFromChord(chordStr) {
  if (!chordStr) return '';

  // Extract root and type
  const match = chordStr.match(/^([A-G][b#]?)(.*)$/);
  if (!match) return '';

  const root = match[1];
  const type = match[2];

  // Simple mapping
  if (type.includes('maj') || type === '') return `${root} major scale`;
  if (type.includes('min')) return `${root} minor scale`;
  if (type.includes('7')) return `${root} dominant scale`;
  if (type.includes('dim')) return `${root} diminished scale`;
  if (type.includes('aug')) return `${root} augmented scale`;
  if (type.includes('sus2') || type.includes('sus4')) return `${root} suspended scale`;
  
  return `${root} scale`; // fallback
}

function shortenChordName(chordStr) {
  if (!chordStr || chordStr === '–') return '–';

  // Remove redundant text like "major scale", "minor scale", etc.
  chordStr = chordStr.replace(/\s?(major|minor|scale)/gi, '');

  // Optional: abbreviate common chord types
  chordStr = chordStr.replace('maj7', 'M7')
                     .replace('dom7', '7')
                     .replace('min7', 'm7')
                     .replace('min', 'm')
                     .replace('maj', '')
                     .replace('sus2', 'sus2')
                     .replace('sus4', 'sus4')
                     .replace('add9', 'add9')
                     .replace('add11', 'add11')
                     .replace('add13', 'add13')
                     .replace('dim', 'dim')
                     .replace('9th', '9')
                     .replace('11th', '11')
                     .replace('13th', '13');

  return chordStr.trim();
}

function identifyNoteName(midiNumber) {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  return noteNames[midiNumber % 12];
}

// Helper: Map MIDI number to octave
function identifyOctave(midiNumber) {
  return Math.floor(midiNumber / 12) - 1; // MIDI 0 = C-1
}

// Main function: Identify note and octave from frequency
function identifyNoteFromFrequency(frequency) {
  const A4 = 440;
  const semitoneRatio = 12 * (Math.log2(frequency / A4));
  const midiNumber = Math.round(semitoneRatio) + 69; // A4 = MIDI 69

  const note = identifyNoteName(midiNumber);
  const octave = identifyOctave(midiNumber);

  return { note, octave, perfect: isPerfectNote(note) };
}

// Helper: Determine if note is "perfect" (natural)
function isPerfectNote(note) {
  const perfectNotes = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  return perfectNotes.includes(note);
}

const intervalNames = [
  "Unison",        // 0
  "Minor 2nd",     // 1
  "Major 2nd",     // 2
  "Minor 3rd",     // 3
  "Major 3rd",     // 4
  "Perfect 4th",   // 5
  "Tritone",       // 6
  "Perfect 5th",   // 7
  "Minor 6th",     // 8
  "Major 6th",     // 9
  "Minor 7th",     // 10
  "Major 7th",     // 11
  "Octave"         // 12
];

function getIntervalName(rootNote, note) {
  // rootNote and note are assumed to be MIDI numbers or semitone indices
  let semitoneDistance = (note - rootNote + 12) % 12;
  return intervalNames[semitoneDistance] || "Complex Interval";
}

function identifyChord(notes) {
  if (!notes || notes.length === 0) return '–';

  const NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  const ENHARMONICS = { Db:'C#', Eb:'D#', Gb:'F#', Ab:'G#', Bb:'A#' };

  // Converts note name or MIDI number → {name:'C#', octave:4, midi:61}
  function toNoteObj(n) {
    if (typeof n === 'number') {
      const name = NOTES[n % 12];
      const octave = Math.floor(n / 12) - 1;
      return { name, octave, midi:n };
    }
    const m = String(n).match(/^([A-G](?:#|b)?)(-?\d+)?$/);
    if (!m) return null;
    const name = ENHARMONICS[m[1]] || m[1];
    const octave = m[2] ? parseInt(m[2],10) : null;
    const midi = octave != null ? NOTES.indexOf(name)+(octave+1)*12 : null;
    return { name, octave, midi };
  }

  const noteObjs = notes.map(toNoteObj).filter(Boolean);
  if (noteObjs.length === 0) return '–';

  const classes = [...new Set(noteObjs.map(n => n.name))];
  const semitones = classes.map(c => NOTES.indexOf(c)).sort((a,b)=>a-b);

  const CHORD_PATTERNS = {
    '0,4,7':'maj', '0,3,7':'m', '0,3,6':'dim',
    '0,4,7,11':'maj7', '0,4,7,10':'7', '0,3,7,10':'m7',
    '0,3,6,9':'dim7', '0,2,7':'sus2', '0,5,7':'sus4',
    '0,4,7,14':'add9', '0,4,7,17':'add11', '0,4,7,21':'add13',
    '0,4,7,10,14':'9', '0,4,7,10,14,17':'11', '0,4,7,10,14,17,21':'13'
  };

  const INTERVALS = {
    0:'Unison',1:'Minor 2nd',2:'Major 2nd',3:'Minor 3rd',4:'Major 3rd',
    5:'Perfect 4th',6:'Tritone',7:'Perfect 5th',8:'Minor 6th',9:'Major 6th',
    10:'Minor 7th',11:'Major 7th',12:'Octave'
  };

  function intervalsFromRoot(rootIdx){
    return semitones.map(s=>(s-rootIdx+12)%12).sort((a,b)=>a-b);
  }

  let chordName='', rootNote=classes[0];

  // --- 1. Try known chord shapes
  for(const r of classes){
    const rootIdx=NOTES.indexOf(r);
    const ivs=intervalsFromRoot(rootIdx);
    const key=ivs.join(',');
    if(CHORD_PATTERNS[key]){chordName=CHORD_PATTERNS[key];rootNote=r;break;}
  }

  // --- 2. Handle single or double notes (intervals/octaves)
  if(!chordName){
    if(classes.length===1){
      const single=noteObjs.find(n=>n.name===classes[0]);
      const oct=single?.octave!=null?single.octave:'';
      rootNote=`${classes[0]}${oct}`;
      chordName='Note';
    }
    else if(classes.length===2){
      const n1=noteObjs[0], n2=noteObjs[1];
      let diff=null;
      if(n1.midi!=null && n2.midi!=null) diff=Math.abs(n2.midi-n1.midi);
      if(diff && diff%12===0){
        const octs=Math.round(diff/12);
        const lower=n1.midi<n2.midi?n1:n2;
        rootNote=`${lower.name}${lower.octave??''}`;
        chordName=octs===1?'Octave':`${octs} Octaves`;
      }else{
        const int=(Math.abs((NOTES.indexOf(n2.name)-NOTES.indexOf(n1.name)+12)%12));
        chordName=INTERVALS[int]||`${int} semitones`;
        rootNote=`${n1.name}${n1.octave??''}`;
      }
    }else{
      chordName=semitones.length===3? 'Triad' :
                semitones.length===4? 'Seventh' : 'Complex';

      if (chordName === 'Complex') {
        //chordName = notes.join('-');
      }
    }
  }

  // --- 3. Append scale/mode if available
  let mode='–';
  try{ mode=identifyChordOrScale(classes); }catch(e){ mode='–'; }
  const modeSuffix=(mode && mode!=='–')?` ${mode}`:'';

  return `${rootNote} ${chordName}${modeSuffix}`.trim();
}

// Identify chord or scale (mode)
function identifyChordOrScale(notes) {
  if (!notes || notes.length < 3) return '–';

  const SCALE_PATTERNS = {
    '0,2,4,5,7,9,11':'Ionian (Major)',
    '0,2,3,5,7,9,10':'Dorian',
    '0,1,3,5,7,8,10':'Phrygian',
    '0,2,4,6,7,9,11':'Lydian',
    '0,2,4,5,7,9,10':'Mixolydian',
    '0,2,3,5,7,8,10':'Aeolian (Minor)',
    '0,1,3,5,6,8,10':'Locrian'
  };

  const NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  const semitones = notes.map(n => NOTES.indexOf(n)).sort((a,b)=>a-b);

  for (let i = 0; i < semitones.length; i++) {
    const root = semitones[i];
    const pattern = semitones.map(s => (s - root + 12) % 12).sort((a,b)=>a-b).join(',');
    if (SCALE_PATTERNS[pattern]) return SCALE_PATTERNS[pattern];
  }

  return '–';
}

function identifyScale(root, type = 'major') {
  const NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  const start = NOTES.indexOf(root);
  if (start === -1) return [];
  
  // Define scale patterns
  const patterns = {
    major: [2, 2, 1, 2, 2, 2, 1],
    minor: [2, 1, 2, 2, 1, 2, 2],
    dorian: [2, 1, 2, 2, 2, 1, 2],
    mixolydian: [2, 2, 1, 2, 2, 1, 2]
  };
  
  const pattern = patterns[type] || patterns.major;
  let scale = [root];
  let idx = start;
  
  for (let step of pattern) {
    idx = (idx + step) % 12;
    scale.push(NOTES[idx]);
  }
  return scale;
}

function noteToSemitone(name) {
  const NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  return NOTES.indexOf(name);
}

function updateMusicInfoFromActiveNotes() {
  const notesArray = Array.from(window.activeMidiNotes);
  if (notesArray.length === 0) {
    updateMusicInfo({ notes: [], chord: '–', scale: '' });
    return;
  }

  const noteNames = notesArray.map(n => typeof n === 'number' ? midiToNoteName(n) : n).filter(Boolean);
  const chordStr = identifyChord(noteNames);
  const scaleName = getScaleNameFromChord(chordStr);
  updateMusicInfo({ notes: noteNames, chord: chordStr, scale: scaleName });
}

// --- Throttled Music Info Update ---
let musicInfoTimer = null;

function showMusicInfoThrottled(chordData, notes) {
  clearTimeout(musicInfoTimer);
  musicInfoTimer = setTimeout(() => {
    if (!notes || notes.length === 0) return;

    // Determine root safely
    let root;
    if (chordData?.root) {
      root = chordData.root;
    } else if (typeof notes[0] === 'number') {
      root = midiToNoteName(notes[0]);
    } else {
      root = notes[0].replace(/\d+/g,''); // strip octave if present
    }

    const quality = chordData?.quality || '';
    const chordName = quality ? `${root}${quality}` : root;
    const scale = identifyScale(root, 'major') || `${root} Major`;

    const info = { notes, chord: chordName, scale };
    updateMusicInfo(info);
  }, 1000);
}

function nameToMidi(noteName) {
  const NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  const match = noteName.match(/^([A-G]#?)(\d)$/);
  if (!match) return null;
  const [, note, octaveStr] = match;
  const octave = parseInt(octaveStr, 10);
  return NOTES.indexOf(note) + (octave + 1) * 12;
}

function getMidiFromChord(root, quality) {
    const midiMap = {
        C: 60, 'C#':61, Db:61, D:62, 'D#':63, Eb:63, E:64, F:65,
        'F#':66, Gb:66, G:67, 'G#':68, Ab:68, A:69, 'A#':70, Bb:70, B:71
    };

    const intervals = {
        maj: [0,4,7],
        min: [0,3,7],
        dom7: [0,4,7,10],
        maj7: [0,4,7,11],
        m7: [0,3,7,10],
        dim: [0,3,6],
        sus2: [0,2,7],
        sus4: [0,5,7],
        add9: [0,4,7,14],
        add11: [0,4,7,17],
        add13: [0,4,7,21],
        '9th':[0,4,7,14],
        '11th':[0,4,7,17],
        '13th':[0,4,7,21]
    };

    const rootMidi = midiMap[root];
    return intervals[quality].map(i => rootMidi + i);
}

function getNotationElement() {
  // Try to find element normally first
  let el = document.getElementById("notation");
  if (el) return el;

  // If not found, check if we're in an iframe and get it from the iframe’s document
  const iframe = document.getElementById("grandStaffFrame");
  if (iframe && iframe.contentDocument) {
    el = iframe.contentDocument.getElementById("notation");
    if (el) return el;
  }

  console.warn("⚠️ Unable to find notation element in parent or iframe.");
  return null;
}