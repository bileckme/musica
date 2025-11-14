![Version](https://img.shields.io/badge/version-0.1.2-stable-blue)
![Status](https://img.shields.io/badge/status-active-success)
![Build](https://img.shields.io/badge/build-passing-brightgreen)
![Platform](https://img.shields.io/badge/platform-web-orange)
![MIDI](https://img.shields.io/badge/MIDI-supported-yellow)
![License](https://img.shields.io/badge/license-MIT-lightgrey)

# 🎵 Musica App

**Musica** is a modern piano and sheet music web application that bridges classical performance and digital innovation. It allows musicians, composers, and students to explore, compose, visualize, and share their musical ideas interactively.

---

## 🌟 Overview

Musica combines the elegance of traditional music notation with cutting-edge web technology. It provides a seamless interface for generating, editing, and playing sheet music — whether you’re practicing piano, composing jazz, or teaching music theory.

---

## ✨ Features

### 🎹 **Interactive Piano Interface**
- Virtual piano that can be played via keyboard or mouse.
- Real-time visual feedback for notes played.
- MIDI input support (if connected via browser API).

### 🎼 **Sheet Music Viewer & Generator**
- Displays music sheets using **MusicXML** format for cross-platform compatibility.
- Auto-generates notation for melodies, chords, and rhythms.
- Supports **Jazz notation**, **classical**, and **modern chord symbols**.
- Built-in key signature handling (e.g., G Major, C Minor, etc.).

### 🧠 **Music Intelligence**
- Smart detection of chords and scales from input melodies.
- Automatic transcription of played or input notes into readable sheet music.
- Experimental AI harmonization (beta feature).

### 💾 **Import & Export**
- Import or export files in `.musicxml`, `.midi`, `.json`, and `.wav` formats.
- Seamless integration with **MuseScore**, **Finale**, and **Sibelius** through MusicXML.

### 🎧 **Playback Engine**
- Play scores using web-based synthesizers.
- Adjustable tempo, metronome, and instrument soundbanks.
- Loop and practice mode for rehearsal.

### 🖋️ **Composer’s Workspace**
- Notation editing tools for adding chords, rests, dynamics, and articulations.
- Chord chart mode for lead sheet creation.
- Custom templates for jazz, orchestral, or piano solo arrangements.

### 🧑‍🏫 **Educational Tools**
- Scale and chord identification for students.
- Interval and ear training modules (optional add-ons).
- Guided exercises and visual note tracking.

### ☁️ **Cloud Integration**
- Sync compositions and projects with your GitHub repository.
- Share MusicXML or MIDI files directly online.
- Collaborative editing mode (planned feature).

---

## 🧩 Tech Stack

- **Frontend:** React.js + TailwindCSS  
- **Backend:** Node.js (Express)  
- **Music Engine:** VexFlow, Tone.js, and MusicXML Parser  
- **Storage:** IndexedDB + GitHub Repository Sync  
- **File Formats:** MusicXML, MIDI, JSON  

---

## 🚀 Getting Started

### 1. Clone the Repository
```bash
git clone https://github.com/bileckme/musica.git
cd musica
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Run Locally
```bash
npm start
```

Then visit **http://localhost:3000** to explore Musica.

---

## 📦 Build for Production
```bash
npm run build
```

---

## 🧪 Experimental Features
- **Jazz Improviser:** Generates chord progressions and melodies in real time.
- **AI Notation Assistant:** Suggests harmonies for your input melody.
- **Cloud Sync (Beta):** Save and sync your compositions to your GitHub or MuseScore account.

---

## 💡 Vision

Musica aims to make music composition and learning accessible to everyone — merging artistry, technology, and education. It stands as a digital studio for musicians, creators, and teachers alike.

---

## 🖋️ Author

**Developed by:** Biyi Akinpelu  
**Location:** Centurion, South Africa  
**GitHub:** [github.com/bileckme](https://github.com/bileckme)  
**Podcast:** [Spin Disc Podcast](https://spindisc.co/podcast/)  

---

## 📜 License
This project is licensed under the **MIT License** — feel free to use, modify, and distribute.
