// transpose.js

// Chromatic scale
const NOTES_SHARP = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const NOTES_FLAT  = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];

/**
 * Normalize a note to sharp for internal calculation
 * Keeps original flats for display if needed
 */
function normalizeNote(note) {
    if (note.includes('b')) {
        const idx = NOTES_FLAT.indexOf(note);
        return NOTES_SHARP[idx] || note;
    }
    return note;
}

/**
 * Transpose a single note by steps
 * @param {string} note - e.g. "C", "Bb", "F#"
 * @param {number} steps - +ve up, -ve down
 * @param {boolean} useFlats - optional, default false
 */
function transposeNote(note, steps, useFlats=false) {
    const normalized = normalizeNote(note);
    const scale = useFlats ? NOTES_FLAT : NOTES_SHARP;
    const idx = scale.indexOf(normalized);
    if (idx === -1) return note; // unknown note
    return scale[(idx + steps + 12) % 12];
}

/**
 * Transpose a chord (including extended and slash chords)
 * @param {string} chord - e.g. "F#m7b5", "Bbmaj7", "D/F#"
 * @param {number} steps - number of semitones to transpose
 */
function transposeChord(chord, steps) {
    // Match root, chord type, and optional bass note
    const regex = /^([A-G][#b]?)(.*?)(\/([A-G][#b]?))?$/;
    const match = chord.match(regex);
    if (!match) return chord;

    const root = match[1];
    const suffix = match[2] || '';
    const bass = match[4]; // optional bass note

    const transposedRoot = transposeNote(root, steps);
    const transposedBass = bass ? '/' + transposeNote(bass, steps) : '';

    return transposedRoot + suffix + transposedBass;
}

/**
 * Transpose an array of chords
 * @param {string[]} chords
 * @param {number} steps
 */
function transposeChordsArray(chords, steps) {
    return chords.map(c => transposeChord(c, steps));
}

/**
 * Example usage:
 */
if (import.meta.url === undefined || typeof window !== 'undefined') {
    console.log(transposeChord('F#m7b5', 2));  // G#m7b5
    console.log(transposeChord('Bbmaj7', -1)); // Amaj7
    console.log(transposeChord('D/F#', 3));    // F/G
    console.log(transposeChordsArray(['C', 'Am', 'F', 'G'], 2)); // ['D','Bm','G','A']
}

// Export for Node or ES modules
export { transposeChord, transposeNote, transposeChordsArray };
