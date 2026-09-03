import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const PORT = 3000;
const app = express();

// Enable large payloads for high-resolution images & PDFs
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Lazy initialization for Gemini API client
function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set. Please ensure an API key is configured in settings.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// API Route: Convert Score Image or PDF to ChordPro format using Gemini 3.8 Flash
app.post('/api/convert-score', async (req, res) => {
  try {
    const { base64Data, mimeType, hint } = req.body;
    if (!base64Data || !mimeType) {
      return res.status(400).json({ error: 'Missing base64Data or mimeType parameter.' });
    }

    const ai = getGeminiClient();

    const prompt = `You are an expert music transcriber, lead sheet arranger, and ChordPro notation specialist.
Analyze the provided musical score, sheet music, lead sheet, handwritten chart, or chord chart (image or PDF).
Accurately transcribe and convert it into clean, valid, standard ChordPro format (.chordpro / .cho).

Strict Rules:
1. Standard Directives:
   - Identify song title: {title: Song Title} (or {t: ...})
   - Identify artist / composer if present: {artist: Artist Name} (or {a: ...})
   - Identify key signature: {key: Key} (e.g. {key: G} or {key: Em})
   - Identify tempo if present: {tempo: 120}
   - Identify time signature if present: {time: 4/4}
   - Identify capo if noted: {capo: N}

2. Song Sections & Structural Tags:
   - Mark sections clearly using standard tags:
     {comment: Verse 1} (or {c: Verse 1})
     {start_of_chorus} (or {soc}) ... {end_of_chorus} (or {eoc})
     {comment: Chorus}
     {comment: Verse 2}
     {comment: Bridge}
     {comment: Intro}
     {comment: Outro}
     {comment: Solo}

3. Chord Placement:
   - Place chords directly in square brackets inline with lyrics right above or on the exact syllable where the chord change occurs.
     Example: [G]A-[C]ma-zing [G]grace! How [D]sweet the sound
   - For instrumental sections, tabs, or measures with no lyrics, transcribe the chords with measure bars:
     Example: [G] | [D/F#] | [Em7] | [Cadd9]
   - Use standard musical chord naming: [Am], [F#m7], [Bbsus4], [G/B], [Cmaj7], [D7], etc.

4. Output Formatting:
   - Return ONLY the clean ChordPro text without greeting, markdown commentary, or explanations.
   - Do NOT wrap in conversational text.
${hint ? `User provided hint or context: ${hint}` : ''}`;

    const contentPart = {
      inlineData: {
        mimeType: mimeType,
        data: base64Data,
      },
    };

    const textPart = {
      text: prompt,
    };

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: { parts: [contentPart, textPart] },
    });

    let chordproText = response.text || '';
    // Strip code fences if the model wraps output in ```chordpro or ```
    chordproText = chordproText
      .replace(/^```(?:chordpro|chopro|txt)?\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    return res.json({ chordpro: chordproText });
  } catch (error: any) {
    console.error('Error converting score to ChordPro:', error);
    return res.status(500).json({
      error: error?.message || 'Failed to convert score to ChordPro with Gemini AI',
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    geminiReady: Boolean(process.env.GEMINI_API_KEY),
  });
});

// Integrate Vite middleware in development, static files in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ChordPro Songbook server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
