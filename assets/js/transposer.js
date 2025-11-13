let transposeSteps = 0; // in semitones

// --- Core Utilities ---
function normalize(note) {
  if (!note) return note;
  return note.replace('Db', 'C#')
             .replace('Eb', 'D#')
             .replace('Gb', 'F#')
             .replace('Ab', 'G#')
             .replace('Bb', 'A#');
}

function transposeNote(note, steps) {
  const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  if (!note) return note;
  note = normalize(note);
  const root = note.match(/[A-G]#?/)[0];
  const suffix = note.slice(root.length);
  const idx = NOTES.indexOf(root);
  if (idx === -1) return note;
  return NOTES[(idx + steps + NOTES.length) % NOTES.length] + suffix;
}

function transposeChord(chord, steps) {
  const notes = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
  const match = chord.match(/^([A-G#b]+)(.*)$/);
  if (!match) return chord;

  let [, root, suffix] = match;
  const rootIndex = notes.findIndex(n => n === root.replace("b", "#"));
  if (rootIndex === -1) return chord;

  return notes[(rootIndex + steps + 12) % 12] + suffix;
}

function transposeChordProgression(prog, steps) {
  return prog.map(row => row.map(ch => transposeNote(ch, steps)));
}

function transposeLyrics(html, steps) {
  return html.replace(/<span class="chord">(.*?)<\/span>/g, (_, chord) => 
    `<span class="chord">${transposeNote(chord, steps)}</span>`
  );
}

function detectQuality(chord) {
  if (chord.includes("dim")) return "dim";
  if (chord.includes("aug")) return "aug";
  if (chord.includes("m")) return "min";
  return "maj";
}

// --- DOM Updates ---
function updateAllChords() {
  document.querySelectorAll(".chord-label").forEach(el => {
    const base = el.getAttribute("data-original") || el.textContent.trim();
    el.setAttribute("data-original", base);
    el.textContent = transposeChord(base, transposeSteps);
  });

  document.querySelectorAll(".piano-preview").forEach(canvas => {
    const chord = canvas.getAttribute("data-chord");
    if (!chord) return;
    const transposed = transposeChord(chord, transposeSteps);
    drawKeyboardOnCanvas(canvas, {
      root: transposed.replace(/m|7|dim|aug/g, ''),
      quality: detectQuality(transposed)
    });
  });
}

function updateChordChartAndPreviews() {
  const song = window.currentSong;
  if (!song) return;

  const div = document.getElementById("chordChart");
  if (!div) return;

  const progression = song.transposedProgression || song.progression;
  div.innerHTML = `<div style="margin-bottom:6px;font-weight:bold;">Key of ${transposeChord(song.key, transposeSteps)}</div><table>` +
    progression.map(row => "<tr>" + row.map(ch => `<td>${transposeChord(ch, transposeSteps) || "&nbsp;"}</td>`).join('') + "</tr>").join('') +
    "</table>";

  const chordPreviewsDiv = document.getElementById("chordPreviews");
  if (!chordPreviewsDiv) return;

  chordPreviewsDiv.querySelectorAll("canvas").forEach(canvas => {
    const chordText = canvas.previousSibling?.textContent.trim();
    if (!chordText) return;
    const transposed = transposeChord(chordText, transposeSteps);
    const chordData = parseChord(transposed);
    drawKeyboardOnCanvas(canvas, {
      root: chordData.root,
      quality: chordData.quality,
      slash: !!chordData.slashRoot
    });
    canvas.previousSibling.textContent = transposed;
  });
}

// --- Unified Transpose Handler ---
function applyTranspose(steps) {
  transposeSteps = (transposeSteps + steps + 12) % 12;

  if (window.currentSong?.progression) {
    window.currentSong.transposedProgression = transposeChordProgression(window.currentSong.progression, transposeSteps);
  }

  updateAllChords();
  updateChordChartAndPreviews();

  // Also update lyrics if needed
  const lyricsDiv = document.querySelector(".lyrics div");
  if (lyricsDiv && window.currentSong?.lyrics) {
    lyricsDiv.innerHTML = transposeLyrics(window.currentSong.lyrics, transposeSteps);
  }
}

// --- Event Binding ---
document.addEventListener("click", (e) => {
  if (e.target.matches("#transpose-up")) applyTranspose(1);
  if (e.target.matches("#transpose-down")) applyTranspose(-1);
  if (e.target.matches("#transposeBtn")) {
    const semitones = parseInt(document.getElementById("transposeSelect")?.value, 10) || 0;
    transposeSteps = semitones;
    applyTranspose(0); // reapply all updates based on selected semitones
  }
});

document.addEventListener('DOMContentLoaded', () => {
    const songSelect = document.getElementById('songSelect');
    if(songSelect) {
      songSelect.addEventListener('change', e => {
        const song = songs[e.target.value];
        if(song) renderSong(e.target.value);
      });
    }
});

// --- Expose API ---
window.Transposer = { transposeNote, transposeChordProgression, transposeLyrics };
