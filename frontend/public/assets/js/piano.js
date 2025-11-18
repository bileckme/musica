// piano.js

/* ----------------------------------------
   Font & Initialization
---------------------------------------- */
async function loadBravuraFont() {
    await document.fonts.load("40px Bravura");
    console.log("✅ Bravura font loaded");
}
  
let pianoReady = false;

window.addEventListener("message", e => {
  const msg = e.data;
  if (!msg || typeof msg !== "object") return;

  switch (msg.type) {
    case "PLAY_CHORD":
    case "HIGHLIGHT_CHORD":
      if (Array.isArray(msg.notes)) {
        msg.notes.forEach(n => noteQueue.push(n));
      }
      break;
  }
});

// After initialization, flush the queue
function flushNoteQueue() {
  while (noteQueue.length) {
    const note = noteQueue.shift();
    const fullNote = /\d/.test(note) ? note : note + "4";
    playNote(fullNote);
  }
}

function waitForRealPianoLocal() {
  return new Promise(resolve => {
    const check = () => {
      if (window.RealPianoLocal) resolve();
      else setTimeout(check, 50);
    };
    check();
  });
}

let isPianoReady = false;

async function initializeApp() {
    console.log('🎹 Initializing Real Piano...');
    await RealPianoLocal.init();  // Wait for all samples to load
    console.log('✅ Real Piano Local initialized');
    
    isPianoReady = true;
    document.querySelector('#overlay').style.display = 'none'; // Hide splash screen
    enableKeyboard(); // Only enable UI interaction now
}


  /* ----------------------------------------
     Piano Setup & Drawing
  ---------------------------------------- */
  const canvas = document.getElementById("pianoCanvas");
  const ctx = canvas.getContext("2d");
  window.canvasMain = canvas;
  window.ctxMain = ctx;
  window.playNote = playNote;
  window.drawKeyboard = drawKeyboard;
  
  let width, height;
  const whiteKeys = [];
  const blackKeys = [];
  const pressedKeys = new Set();
  
  const AudioContextFunc = window.AudioContext || window.webkitAudioContext;
  const audioContext = new AudioContextFunc();
  const player = new WebAudioFontPlayer();
  const pianoPreset = _tone_0090_JCLive_sf2_file;
  
  const NOTES = [
    "A0","A#0","B0","C1","C#1","D1","D#1","E1","F1","F#1","G1","G#1","A1","A#1","B1",
    "C2","C#2","D2","D#2","E2","F2","F#2","G2","G#2","A2","A#2","B2",
    "C3","C#3","D3","D#3","E3","F3","F#3","G3","G#3","A3","A#3","B3",
    "C4","C#4","D4","D#4","E4","F4","F#4","G4","G#4","A4","A#4","B4",
    "C5","C#5","D5","D#5","E5","F5","F#5","G5","G#5","A5","A#5","B5",
    "C6","C#6","D6","D#6","E6","F6","F#6","G6","G#6","A6","A#6","B6",
    "C7","C#7","D7","D#7","E7","F7","F#7","G7","G#7","A7","A#7","B7",
    "C8"
  ];
  
  window.NOTE_NAMES = NOTES;
  window.WHITE_KEYS = 52;
  
  function nameToMidi(note) {
    const octave = parseInt(note.slice(-1));
    const key = note.slice(0, -1);
    const semitones = {C:0,"C#":1,D:2,"D#":3,E:4,F:5,"F#":6,G:7,"G#":8,A:9,"A#":10,B:11};
    return 12 * (octave + 1) + semitones[key];
  }
  
  function drawKeyboard() {
    ctx.clearRect(0, 0, width, height);
    const whiteKeyCount = 52;
    const whiteKeyWidth = width / whiteKeyCount;
    const whiteKeyHeight = height;
  
    whiteKeys.length = 0;
    blackKeys.length = 0;
    let x = 0;
  
    for (let note of NOTES) {
      if (!note.includes("#")) {
        ctx.fillStyle = pressedKeys.has(note) ? "#ffd54f" : "white";
        ctx.fillRect(x, 0, whiteKeyWidth, whiteKeyHeight);
        ctx.strokeStyle = "#000";
        ctx.strokeRect(x, 0, whiteKeyWidth, whiteKeyHeight);
        whiteKeys.push({ note, x, width: whiteKeyWidth });
        x += whiteKeyWidth;
      }
    }
  
    x = 0;
    const blackWidth = whiteKeyWidth * 0.6;
    const blackHeight = height * 0.6;
  
    for (let i = 0; i < NOTES.length; i++) {
      const note = NOTES[i];
      if (note.includes("#")) {
        const prevWhiteIndex = NOTES.slice(0, i).filter(n => !n.includes("#")).length - 1;
        const blackX = (prevWhiteIndex + 1) * whiteKeyWidth - blackWidth / 2;
        ctx.fillStyle = pressedKeys.has(note) ? "#ff9800" : "#000";
        ctx.fillRect(blackX, 0, blackWidth, blackHeight);
        blackKeys.push({ note, x: blackX, width: blackWidth });
      }
    }
    
  }
  
  const noteQueue = [];
  function playNoteSafe(note) {
    if (!isPianoReady) {
        console.log('🎹 Piano still loading, wait...');
        return; // Ignore until ready
    }
    RealPianoLocal.playNote(note);
  }

  function playNote(noteName, velocity = 0.8, duration = 1.2) {
    const info = document.getElementById("musicInfo");
    if (info) info.textContent = `🎶 Playing: ${noteName}`;
    if (!RealPianoLocal.isReady()) {
      console.warn("RealPiano still loading:", noteName);
      return;
    }

    pressedKeys.add(noteName);
    drawKeyboard();

    try {
      RealPianoLocal.playNote(noteName, velocity, duration);
    } catch (e) {
      console.error("Failed to play note:", noteName, e);
    }

    const visualHold = Math.max(duration * 1000, 400);
    setTimeout(() => {
      pressedKeys.delete(noteName);
      drawKeyboard();
    }, visualHold);
  }

  // After RealPiano is ready
  async function flushQueue() {
      for (const n of noteQueue) {
          playNote(n.noteName, n.velocity, n.duration);
      }
      noteQueue.length = 0;
  }

  const mapKeyToNote = {
    'a': 'C4',
    'w': 'C#4',
    's': 'D4',
    'e': 'D#4',
    'd': 'E4',
    'f': 'F4',
    't': 'F#4',
    'g': 'G4',
    'y': 'G#4',
    'h': 'A4',
    'u': 'A#4',
    'j': 'B4',
    'k': 'C5',
    'o': 'C#5',
    'l': 'D5',
    'p': 'D#5',
    ';': 'E5',
    "'": 'F5'
  };

  function enableKeyboard() {
    window.addEventListener('keydown', e => {
      const note = mapKeyToNote[e.key];
      if(note) RealPiano.playNote(note, 0.88, 1.5);
    });
  }

  function resizeCanvas() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight * 0.12;
    drawKeyboard();
  }
  window.addEventListener("resize", resizeCanvas);
  
  /* ----------------------------------------
     Piano Interaction + Iframe Sync
  ---------------------------------------- */
  function setupPiano() {
    resizeCanvas();
    drawKeyboard();
  
    canvas.addEventListener("mousedown", e => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
  
      for (let k of blackKeys) {
        if (x >= k.x && x <= k.x + k.width && y < height * 0.6) {
          playNote(k.note);
          return;
        }
      }
      for (let k of whiteKeys) {
        if (x >= k.x && x <= k.x + k.width) {
          playNote(k.note);
          return;
        }
      }
    });
  
    window.addEventListener("message", e => {
      const msg = e.data;
      if (!msg || typeof msg !== "object") return;
  
      switch (msg.type) {
        case "PLAY_CHORD":
        case "HIGHLIGHT_CHORD": {
          if (Array.isArray(msg.notes)) {
            msg.notes.forEach(n => {
              const note = /\d/.test(n) ? n : n + "4";
              if (NOTES.includes(note)) playNote(note, 0.7);
            });
          }
          break;
        }
        default:
          break;
      }
    });
  
    console.log("🎹 Piano ready — click any key to play");
  }
  
  /* ----------------------------------------
     Run Initialization
  ---------------------------------------- */
  window.addEventListener("load", initializeApp);
  
  window.canvasMain = canvas;
  window.drawKeyboardOnCanvas = drawKeyboard; // or create wrapper
  
  window.pressedKeys = new Set();
  window.visible = []; // initialize before drawing
  window.playNote = playNote;
  
  window.pressedKeys = window.pressedKeys || new Set();
  
  window.addEventListener('click', () => {
    if (audioContext.state === 'suspended') audioContext.resume();
  });
  
  if(audioContext.state === 'suspended') audioContext.resume();


  function resizeOverlay() {
    const splash = document.getElementById("overlay");
    splash.style.width = window.innerWidth + "px";
    splash.style.height = window.innerHeight + "px";
  }
  
  window.addEventListener("resize", resizeOverlay);
  resizeOverlay();  

  document.addEventListener('click', () => {
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().then(() => {
        console.log('✅ AudioContext resumed after user gesture');
      }).catch(err => console.error('Audio resume failed:', err));
    }
  }, { once: true });

  window.addEventListener("load", async () => {
    const splash = document.getElementById("overlay");
    const canvas = document.getElementById("pianoCanvas");
    resizeCanvas();
    drawKeyboard();
  
    splash.innerHTML = `
      <div id="overlay-content" style="text-align:center;">
        <img src="assets/images/logo.png" style="width:192px; height:192px;" alt="logo"/><br/>
        <div id="loading-text" style="color:white; font-size:1.2em; margin-top:20px;">
          🎹 Loading piano samples...
        </div>
        <div id="progress-bar" style="margin:20px auto; width:60%; height:10px; background:#333; border-radius:6px; overflow:hidden;">
          <div id="progress-fill" style="width:0%; height:100%; background:#ffd54f; transition:width 0.3s ease;"></div>
        </div>
      </div>
    `;
  
    const loadingText = document.getElementById("loading-text");
    const progressFill = document.getElementById("progress-fill");
  
    let percent = 0;
  
    // Simulated smooth progress
    const smoothTimer = setInterval(() => {
      if (percent < 95) { // stop before 100%
        percent += Math.random() * 3 + 1; // random increment
        percent = Math.min(percent, 95);
        progressFill.style.width = `${Math.round(percent)}%`;
        loadingText.textContent = `🎹 Loading samples... ${Math.round(percent)}%`;
      }
    }, 200);
  
    try {
      await RealPianoLocal.init({
        basePath: "./assets/samples",
        ext: ".mp3",
        useReverb: true
      });
  
      clearInterval(smoothTimer);
  
      // Animate remaining to 100%
      percent = 100;
      progressFill.style.width = "100%";
      loadingText.textContent = "✅ Loading complete — preparing piano...";
  
      await new Promise(r => setTimeout(r, 800)); // small buffer before fade
  
    } catch (err) {
      clearInterval(smoothTimer);
      console.error("❌ Error loading RealPianoLocal", err);
      loadingText.textContent = "⚠️ Failed to load samples!";
      progressFill.style.background = "#f44336";
      return; // do not hide splash if failed
    }
  
    // Fade-out splash only after progress reaches 100%
    splash.style.transition = "opacity 1.5s ease";
    splash.style.opacity = "0.8";
    await new Promise(r => setTimeout(r, 1600));
    splash.style.display = "none";
  
    setupPiano();
    enableKeyboard();
    isPianoReady = true;
    console.log("🎹 Piano fully ready");
  });
    
  
  console.log("🎹 Piano initialized and listening for PLAY_CHORD messages from previewer.");