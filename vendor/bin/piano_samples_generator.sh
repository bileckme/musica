#!/bin/bash
# ================================================================
# 🎹 Render 88 piano notes (A0–C8, MIDI 21–108) using FluidSynth
# Works with FluidSynth 2.3.x (requires -f script before .sf2)
# ================================================================

SF2_FILE="$1"
OUTPUT_DIR="assets/samples"
SAMPLE_RATE=44100
GAIN=0.8
DURATION=2   # seconds per note

if [ -z "$SF2_FILE" ]; then
  echo "❌ Usage: $0 /path/to/Piano.sf2"
  exit 1
fi

if [ ! -f "$SF2_FILE" ]; then
  echo "❌ SoundFont not found: $SF2_FILE"
  exit 1
fi

mkdir -p "$OUTPUT_DIR"

# Map MIDI → Note name (e.g. 60 → C4)
midi_to_note() {
  local MIDI=$1
  local NOTES=(C C# D D# E F F# G G# A A# B)
  local NOTE_INDEX=$(( MIDI % 12 ))
  local OCTAVE=$(( MIDI / 12 - 1 ))
  echo "${NOTES[$NOTE_INDEX]}$OCTAVE"
}

echo "🎼 Rendering samples from: $SF2_FILE"
echo "---------------------------------------------------------------"

for MIDI in $(seq 21 108); do
  NOTE_NAME=$(midi_to_note "$MIDI")
  SAFE_NOTE_NAME=$(echo "$NOTE_NAME" | sed 's/#/s/g')   # Replace '#' with 's' for filenames
  OUT_FILE="$OUTPUT_DIR/${SAFE_NOTE_NAME}_${MIDI}.wav"

  echo "🎵 Rendering $NOTE_NAME ($MIDI)..."

  TMP_CMD=$(mktemp)
  cat > "$TMP_CMD" <<EOF
select 0 0 0 0
noteon 0 $MIDI 120
sleep $DURATION
noteoff 0 $MIDI
quit
EOF

  # Main render
  fluidsynth -a file -F "$OUT_FILE" -T wav -r $SAMPLE_RATE -g $GAIN -f "$TMP_CMD" "$SF2_FILE" >/dev/null 2>&1
  rm -f "$TMP_CMD"

  if [ -f "$OUT_FILE" ]; then
    echo "✅ Saved: $OUT_FILE"
  else
    echo "⚠️ Failed: $NOTE_NAME ($MIDI)"
  fi
done

echo "---------------------------------------------------------------"
echo "✅ All WAV samples saved in: $OUTPUT_DIR/"
echo

# Optional MP3 conversion
read -p "Convert all WAVs to MP3? (y/n): " CONVERT
if [[ "$CONVERT" =~ ^[Yy]$ ]]; then
  echo "🎶 Converting to MP3..."
  for WAV in "$OUTPUT_DIR"/*.wav; do
    MP3="${WAV%.wav}.mp3"
    ffmpeg -loglevel error -y -i "$WAV" -codec:a libmp3lame -qscale:a 2 "$MP3"
    echo "🎵 $(basename "$WAV") → $(basename "$MP3")"
  done
  echo "✅ MP3 conversion complete."
fi

echo "🎹 Done!"
