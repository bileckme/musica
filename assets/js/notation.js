// notation.js

// --- Load Bravura font ---
const bravura = new FontFace('Bravura', 'url(assets/fonts/Bravura/otf/Bravura.otf)');
bravura.load().then(font => {
  document.fonts.add(font);
  console.log("🎼 Bravura font loaded");
  initNotation();
});

// --- Global Variables ---
let audioCtx;
let player = new WebAudioFontPlayer();
let piano = _tone_0090_JCLive_sf2_file;

function initNotation() {
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  drawTrebleStaff(4);
  drawBassStaff(4);
  startPlayback();

  // Remove overlay after font + setup complete
  const overlay = document.getElementById('overlay');
  if (overlay) overlay.remove();
}

// --- Draw Treble Staff ---
function drawTrebleStaff(numMeasures = 4) {
  const canvas = document.getElementById('trebleStaffCanvas');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const spacing = 20;
  const top = 40;

  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(0, top + i * spacing);
    ctx.lineTo(canvas.width, top + i * spacing);
    ctx.strokeStyle = '#000';
    ctx.stroke();
  }

  const measureWidth = canvas.width / numMeasures;
  for (let i = 1; i < numMeasures; i++) {
    ctx.beginPath();
    ctx.moveTo(i * measureWidth, top);
    ctx.lineTo(i * measureWidth, top + 4 * spacing);
    ctx.strokeStyle = '#666';
    ctx.stroke();
  }
}

// --- Draw Bass Staff ---
function drawBassStaff(numMeasures = 4) {
  const canvas = document.getElementById('bassStaffCanvas');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const spacing = 20;
  const top = 40;

  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(0, top + i * spacing);
    ctx.lineTo(canvas.width, top + i * spacing);
    ctx.strokeStyle = '#000';
    ctx.stroke();
  }

  const measureWidth = canvas.width / numMeasures;
  for (let i = 1; i < numMeasures; i++) {
    ctx.beginPath();
    ctx.moveTo(i * measureWidth, top);
    ctx.lineTo(i * measureWidth, top + 4 * spacing);
    ctx.strokeStyle = '#666';
    ctx.stroke();
  }
}

// --- Highlight Measure ---
function highlightMeasure(measureIndex, numMeasures = 4) {
  drawTrebleStaff(numMeasures);
  drawBassStaff(numMeasures);

  const tCanvas = document.getElementById('trebleStaffCanvas');
  const bCanvas = document.getElementById('bassStaffCanvas');
  const tCtx = tCanvas.getContext('2d');
  const bCtx = bCanvas.getContext('2d');

  const tMeasureWidth = tCanvas.width / numMeasures;
  const bMeasureWidth = bCanvas.width / numMeasures;

  tCtx.fillStyle = 'rgba(180, 180, 255, 0.3)';
  bCtx.fillStyle = 'rgba(180, 180, 255, 0.3)';

  tCtx.fillRect(measureIndex * tMeasureWidth, 0, tMeasureWidth, tCanvas.height);
  bCtx.fillRect(measureIndex * bMeasureWidth, 0, bMeasureWidth, bCanvas.height);
}

// --- Convert Note to MIDI ---
function noteToMIDI(note) {
  const NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  const pitch = NOTES.indexOf(note.replace(/[0-9]/g, ''));
  const octave = parseInt(note.replace(/[A-G#]/g, '')) || 4;
  return 12 + octave * 12 + pitch;
}

// --- Play Note ---
function playNoteAt(note, time = 0) {
  const midi = noteToMIDI(note);
  player.queueWaveTable(audioCtx, audioCtx.destination, piano, audioCtx.currentTime + time, midi, 1.0, 0.8);
}

// --- Draw Chord Symbol ---
function drawChordSymbol(symbol, measureIndex, numMeasures = 4) {
  const tCanvas = document.getElementById('trebleStaffCanvas');
  const bCanvas = document.getElementById('bassStaffCanvas');
  const tCtx = tCanvas.getContext('2d');
  const bCtx = bCanvas.getContext('2d');

  const tMeasureWidth = tCanvas.width / numMeasures;
  const bMeasureWidth = bCanvas.width / numMeasures;

  tCtx.fillStyle = '#000';
  tCtx.font = '36px Bravura';
  tCtx.fillText(symbol, measureIndex * tMeasureWidth + 15, 35);

  bCtx.fillStyle = '#000';
  bCtx.font = '36px Bravura';
  bCtx.fillText(symbol, measureIndex * bMeasureWidth + 15, 35);
}

// --- Playback Sequence ---
function startPlayback() {
  const sequence = [
    { notes: ['C4', 'E4', 'G4'], measure: 0, symbol: 'C' },
    { notes: ['F4', 'A4', 'C5'], measure: 1, symbol: 'F' },
    { notes: ['G4', 'B4', 'D5'], measure: 2, symbol: 'G' },
    { notes: ['C4', 'E4', 'G4'], measure: 3, symbol: 'C' },
  ];

  sequence.forEach((chord, idx) => {
    setTimeout(() => {
      highlightMeasure(chord.measure, sequence.length);
      drawChordSymbol(chord.symbol, chord.measure, sequence.length);
      chord.notes.forEach(n => playNoteAt(n));
    }, idx * 1500);
  });
}

window.drawGrandStaff = function(midiNotes) {
  try {
    // Confirm element existence
    const element = document.getElementById('notation');
    if (!element) {
      console.warn("⚠️ drawGrandStaff: Element with ID 'notation' not found in current document.");
      return;
    }

    // Clear previous render
    element.innerHTML = '';

    let vf, score, system;

    // Wrap renderer creation separately
    try {
      vf = new Vex.Flow.Factory({
        renderer: { elementId: 'notation', width: 900, height: 400 }
      });
    } catch (rendererError) {
      console.error("❌ Renderer initialization failed:", rendererError.message || rendererError);
      return;
    }

    try {
      score = vf.EasyScore();
      system = vf.System();

      const trebleNotes = midiNotes.filter(n => n >= 60).map(midiToNoteName);
      const bassNotes = midiNotes.filter(n => n < 60).map(midiToNoteName);

      const trebleVoice = score.voice(score.notes(trebleNotes.join(','), { clef: 'treble' }));
      const bassVoice = score.voice(score.notes(bassNotes.join(','), { clef: 'bass' }));

      system.addStave({ voices: [trebleVoice] })
        .addClef('treble')
        .addTimeSignature('4/4');

      system.addStave({ voices: [bassVoice] })
        .addClef('bass')
        .addTimeSignature('4/4');

      try {
        vf.draw();
      } catch (drawError) {
        console.error("⚠️ Drawing failed (possibly a runtime renderer issue):", drawError.message || drawError);
      }

    } catch (logicError) {
      console.error("⚠️ drawGrandStaff logic error:", logicError.message || logicError);
    }

  } catch (outerError) {
    console.error("❌ Unexpected error in drawGrandStaff:", outerError.message || outerError);
  }
};

window.drawActiveNotes = drawActiveNotes;
window.clearActiveNotes = clearActiveNotes;
window.playNotesAndShowOnStaff = playNotesAndShowOnStaff;

