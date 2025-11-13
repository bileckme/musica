#!/bin/bash
# ---------------------------------------------------------------
# render_piano_samples_pro.sh
# Generate 88 piano note WAVs (A0–C8) in 3 velocity layers
# using FluidSynth and a SoundFont (.sf2)
# ---------------------------------------------------------------
# Requirements:
#   - fluidsynth installed (`sudo apt install fluidsynth`)
#   - ffmpeg (optional for MP3 conversion)
# Usage:
#   ./render_piano_samples_pro.sh /path/to/Piano.sf2
# ---------------------------------------------------------------

SF2_FILE="$1"
OUTPUT_DIR="assets/samples"
SAMPLE_RATE=44100
GAIN=0.8

if [ -z "$SF2_FILE" ]; then
  echo "❌ Usage: $0 /path/to/Piano.sf2"
  exit 1
fi

if [ ! -f "$SF2_FILE" ]; then
  echo "❌ SoundFont not found: $SF2_FILE"
  exit 1
fi

mkdir -p "$OUTPUT_DIR"
META_FILE="$OUTPUT_DIR/samples.json"
echo "{" > "$META_FILE"

echo "🎹 Rendering 88 notes (A0–C8) with 3 velocity layers..."
echo "Output → $OUTPUT_DIR"
echo "---------------------------------------------------------------"

for MIDI in $(seq 21 108); do
  NOTE_DIR="$OUTPUT_DIR/$MIDI"
  mkdir -p "$NOTE_DIR"

  for VELOCITY in 30 80 120; do
    OUT_FILE="$NOTE_DIR/${MIDI}_v${VELOCITY}.wav"
    echo "🎵 Rendering MIDI:$MIDI Velocity:$VELOCITY → $OUT_FILE"

    # Render single note to WAV
    fluidsynth -ni "$SF2_FILE" -r $SAMPLE_RATE -g $GAIN -F "$OUT_FILE" -T wav <<EOF
select 0 0
noteon 0 $MIDI $VELOCITY
sleep 1.2
noteoff 0 $MIDI
quit
EOF
  done

  # Append metadata entry
  echo "  \"$MIDI\": {" >> "$META_FILE"
  echo "    \"soft\": \"samples/$MIDI/${MIDI}_v30.wav\"," >> "$META_FILE"
  echo "    \"medium\": \"samples/$MIDI/${MIDI}_v80.wav\"," >> "$META_FILE"
  echo "    \"loud\": \"samples/$MIDI/${MIDI}_v120.wav\"" >> "$META_FILE"
  echo "  }," >> "$META_FILE"
done

# Remove trailing comma
sed -i '' -e '$ s/,$//' "$META_FILE" 2>/dev/null || sed -i '$ s/,$//' "$META_FILE"
echo "}" >> "$META_FILE"

echo "---------------------------------------------------------------"
echo "✅ Done! All samples rendered and metadata written to $META_FILE"

# Optional: Convert WAVs to MP3 for faster loading
read -p "Convert all WAV files to MP3 (y/N)? " CHOICE
if [[ "$CHOICE" =~ ^[Yy]$ ]]; then
  for f in $(find "$OUTPUT_DIR" -name "*.wav"); do
    ffmpeg -y -i "$f" -codec:a libmp3lame -qscale:a 3 "${f%.wav}.mp3" >/dev/null 2>&1
    rm "$f"
  done
  echo "🎧 MP3 conversion complete!"
fi
