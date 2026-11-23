import 'dotenv/config';
import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);

function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
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

function sanitizeText(val: unknown, maxLen = 600): string {
  if (typeof val !== 'string') return '';
  return val.trim().slice(0, maxLen);
}

const app = express();
app.use(express.json({ limit: '4mb' }));

// Health check for live online validation
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    ok: true,
    service: 'BASA Radio AI Studio',
    geminiConfigured: Boolean(getAiClient()),
    timestamp: Date.now(),
  });
});

// 1. Autonomous Cultural & Music Trend Radar (Google Search Grounding via gemini-4-hydrogen)
app.post('/api/ai/trends', async (req: Request, res: Response) => {
  const ai = getAiClient();
  if (!ai) {
    res.status(503).json({
      error: 'El servicio Gemini aún no tiene una clave configurada en Secrets.',
    });
    return;
  }

  const region = sanitizeText(req.body?.region, 80) || 'Latinoamérica y Global';
  const focus = sanitizeText(req.body?.focus, 200) || 'música viral, cultura pop, YouTube, TikTok y noticias actuales';

  try {
    const prompt = `Investiga las tendencias actuales de hoy en ${region} enfocadas en: ${focus}.
Analiza lo que es tendencia ahora mismo en YouTube Music, TikTok sonidos virales, redes sociales y noticias culturales o musicales.
Devuelve EXCLUSIVAMENTE un bloque JSON válido con este formato exacto:
\`\`\`json
{
  "pulseSummary": "Resumen breve de 1-2 frases del pulso cultural y musical de hoy",
  "trends": [
    {
      "id": "trend-1",
      "topic": "Nombre corto de la tendencia o suceso viral",
      "sourcePlatform": "YouTube · TikTok · Noticias",
      "suggestedGenre": "Género musical ideal (ej. Reggaetón Melódico, Synthwave, Afrobeats, Corrido Tumbado, Pop Urbano)",
      "mood": "Emoción o vibra (ej. Energético, Nostálgico, Festivo)",
      "bpm": 108,
      "angle": "Explicación breve de por qué es tendencia hoy y cómo convertirlo en canción",
      "musicPrompt": "Prompt detallado listo para generar esta canción con IA"
    }
  ]
}
\`\`\`
Incluye 6 tendencias diversas, reales y actuales.`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    });

    const rawText = response.text || '';
    let parsed: { pulseSummary?: string; trends?: unknown[] } | null = null;
    const jsonMatch =
      rawText.match(/```json\s*([\s\S]*?)\s*```/) ||
      rawText.match(/(\{[\s\S]*\})/);

    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[1]);
      } catch {
        parsed = null;
      }
    }

    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const sources = groundingChunks
      .map((c: { web?: { uri?: string; title?: string } }) => c.web)
      .filter((w): w is { uri: string; title?: string } => Boolean(w?.uri))
      .slice(0, 8)
      .map((w) => ({
        title: w.title || w.uri,
        uri: w.uri,
      }));

    if (!parsed || !Array.isArray(parsed.trends) || parsed.trends.length === 0) {
      res.status(502).json({
        error: 'No se pudieron estructurar las tendencias en tiempo real. Intenta actualizar nuevamente.',
      });
      return;
    }

    res.json({
      pulseSummary: parsed.pulseSummary || 'Radar cultural y musical actualizado en tiempo real.',
      trends: parsed.trends,
      sources,
      updatedAt: Date.now(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error consultando tendencias con Gemini.';
    res.status(500).json({ error: message });
  }
});

// 2. Autonomous AI Song Composer (Lyrics, Genre, Suno/Mureka Prompt, MIDI Chords & Melody, Social/YouTube Metadata)
app.post('/api/ai/compose', async (req: Request, res: Response) => {
  const ai = getAiClient();
  if (!ai) {
    res.status(503).json({
      error: 'El servicio Gemini aún no tiene una clave configurada en Secrets.',
    });
    return;
  }

  const promptInput = sanitizeText(req.body?.prompt, 600);
  const genreHint = sanitizeText(req.body?.genre, 80);
  const language = sanitizeText(req.body?.language, 40) || 'Español';
  const trendContext = sanitizeText(req.body?.trendContext, 300);

  if (!promptInput && !trendContext) {
    res.status(400).json({ error: 'Debes indicar un tema, tendencia o prompt musical.' });
    return;
  }

  try {
    const userInstruction = `Eres un productor musical ganador del Grammy y compositor autónomo para BASA Radio.
Crea una canción original completa lista para radio y redes sociales en idioma ${language}.
Tema / Prompt del usuario: "${promptInput || trendContext}"
${genreHint ? `Género solicitado: "${genreHint}"` : 'Elige automáticamente el género musical más viral y coherente.'}
${trendContext ? `Contexto de tendencia cultural/musical: "${trendContext}"` : ''}

Reglas estrictas para la parte musical:
- "bpm": entero entre 72 y 155 acorde al género.
- "drumStyle": debe ser EXACTAMENTE uno de: "reggaeton", "trap", "house", "lofi", "pop", "rock", "afrobeat", "synthwave".
- "chordProgression": exactamente 4 acordes, cada acorde es un arreglo de 3 o 4 notas MIDI enteras entre 48 y 76 que suenen armónicas juntas en la tonalidad elegida.
- "bassNotes": exactamente 8 notas MIDI enteras entre 31 y 52 siguiendo las fundamentales de los acordes.
- "melodyNotes": exactamente 16 notas MIDI enteras entre 60 y 84 formando un gancho melódico pegajoso en la misma tonalidad.
- "lyrics": letra completa estructurada con [Intro], [Verso 1], [Coro], [Verso 2], [Puente], [Coro], [Outro].
- "vocalHookText": 2 a 4 líneas cortas del coro listas para ser cantadas/interpretadas por el sintetizador vocal.
- "sunoPrompt": prompt maestro en inglés y español estilo Suno AI / Mureka / Gemini Music / ChatGPT Music con descripción sónica detallada.`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: userInstruction,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            artist: { type: Type.STRING },
            genre: { type: Type.STRING },
            bpm: { type: Type.INTEGER },
            musicalKey: { type: Type.STRING },
            mood: { type: Type.STRING },
            drumStyle: { type: Type.STRING },
            sunoPrompt: { type: Type.STRING },
            lyrics: { type: Type.STRING },
            vocalHookText: { type: Type.STRING },
            vocalStyle: { type: Type.STRING },
            youtubeTitle: { type: Type.STRING },
            youtubeDescription: { type: Type.STRING },
            youtubeTags: { type: Type.ARRAY, items: { type: Type.STRING } },
            socialCaption: { type: Type.STRING },
            chordProgression: {
              type: Type.ARRAY,
              items: {
                type: Type.ARRAY,
                items: { type: Type.INTEGER },
              },
            },
            bassNotes: {
              type: Type.ARRAY,
              items: { type: Type.INTEGER },
            },
            melodyNotes: {
              type: Type.ARRAY,
              items: { type: Type.INTEGER },
            },
          },
          required: [
            'title',
            'artist',
            'genre',
            'bpm',
            'musicalKey',
            'mood',
            'drumStyle',
            'sunoPrompt',
            'lyrics',
            'vocalHookText',
            'vocalStyle',
            'youtubeTitle',
            'youtubeDescription',
            'youtubeTags',
            'socialCaption',
            'chordProgression',
            'bassNotes',
            'melodyNotes',
          ],
        },
      },
    });

    const data = JSON.parse((response.text || '{}').trim());
    res.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error componiendo canción con IA.';
    res.status(500).json({ error: message });
  }
});

// 3. AI Vocal Performance Hook (gemini-3.8-flash-lite-tts returning WAV)
app.post('/api/ai/vocal', async (req: Request, res: Response) => {
  const ai = getAiClient();
  if (!ai) {
    res.status(503).json({
      error: 'El servicio Gemini aún no tiene una clave configurada en Secrets.',
    });
    return;
  }

  const text = sanitizeText(req.body?.text, 500);
  const style = sanitizeText(req.body?.style, 160) || 'Rhythmic, melodic modern radio vocalist';
  const voiceNameRaw = sanitizeText(req.body?.voiceName, 20);
  const allowedVoices = new Set(['Kore', 'Puck', 'Charon', 'Fenrir', 'Zephyr']);
  const voiceName = allowedVoices.has(voiceNameRaw) ? voiceNameRaw : 'Kore';

  if (!text) {
    res.status(400).json({ error: 'Texto vocal requerido.' });
    return;
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash-lite-tts',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text,
              speechMetadata: {
                style,
              },
            },
          ],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      res.status(502).json({ error: 'No se recibió audio vocal desde el modelo.' });
      return;
    }

    res.json({
      audioBase64: base64Audio,
      mimeType: 'audio/wav',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error generando voz IA.';
    res.status(500).json({ error: message });
  }
});

// 4. GitHub Repository Sync Proxy (pushes station catalog & AI tracks JSON cleanly via GitHub REST API)
app.post('/api/github/sync', async (req: Request, res: Response) => {
  const token = sanitizeText(req.body?.token, 300);
  const owner = sanitizeText(req.body?.owner, 100);
  const repo = sanitizeText(req.body?.repo, 100);
  const branch = sanitizeText(req.body?.branch, 80) || 'main';
  const filePath = sanitizeText(req.body?.filePath, 160) || 'basa-radio-catalog.json';
  const commitMessage = sanitizeText(req.body?.commitMessage, 160) || 'Actualizar catálogo BASA Radio IA';
  const payload = req.body?.catalog;

  const slugPattern = /^[a-zA-Z0-9_.-]+$/;
  const pathPattern = /^[a-zA-Z0-9_.\-/]+$/;

  if (!token || !owner || !repo || !slugPattern.test(owner) || !slugPattern.test(repo) || !slugPattern.test(branch) || !pathPattern.test(filePath) || filePath.includes('..')) {
    res.status(400).json({
      error: 'Parámetros de repositorio GitHub inválidos. Verifica usuario, repositorio, rama y ruta.',
    });
    return;
  }

  if (!payload || typeof payload !== 'object') {
    res.status(400).json({ error: 'El catálogo a sincronizar es inválido.' });
    return;
  }

  const ghApiUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${filePath.split('/').map(encodeURIComponent).join('/')}`;

  try {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'basa-radio-studio',
      'Content-Type': 'application/json',
    };

    // Check existing SHA if file already exists
    let existingSha: string | undefined;
    const getResp = await fetch(`${ghApiUrl}?ref=${encodeURIComponent(branch)}`, { headers });
    if (getResp.ok) {
      const existingData = (await getResp.json()) as { sha?: string };
      existingSha = existingData.sha;
    }

    const contentBase64 = Buffer.from(JSON.stringify(payload, null, 2), 'utf8').toString('base64');
    const putResp = await fetch(ghApiUrl, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        message: commitMessage,
        content: contentBase64,
        branch,
        ...(existingSha ? { sha: existingSha } : {}),
      }),
    });

    const putData = (await putResp.json()) as {
      message?: string;
      commit?: { sha?: string; html_url?: string };
      content?: { html_url?: string };
    };

    if (!putResp.ok) {
      res.status(putResp.status).json({
        error: putData.message || 'GitHub rechazó la actualización. Verifica permisos del token (Contents: Read & Write).',
      });
      return;
    }

    res.json({
      ok: true,
      commitSha: putData.commit?.sha || '',
      commitUrl: putData.commit?.html_url || putData.content?.html_url || '',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error conectando con la API de GitHub.';
    res.status(500).json({ error: message });
  }
});

// 5. Autonomous Creative Studio (Music, Video, Series, Movie from 1 word, sentence, or full topic)
app.post('/api/ai/create-production', async (req: Request, res: Response) => {
  const ai = getAiClient();
  if (!ai) {
    res.status(503).json({
      error: 'El servicio Gemini aún no tiene una clave configurada en Secrets.',
    });
    return;
  }

  const promptInput = sanitizeText(req.body?.promptInput, 1400);
  const formatRaw = sanitizeText(req.body?.format, 20);
  const sourceBasisRaw = sanitizeText(req.body?.sourceBasis, 30);
  const studioStyle = sanitizeText(req.body?.studioStyle, 100) || 'Walt Disney / Sony & Columbia Pictures';
  const targetPlatform = sanitizeText(req.body?.targetPlatform, 60) || 'Netflix & YouTube 5K';
  const resolutionRaw = sanitizeText(req.body?.resolution, 20);
  const language = sanitizeText(req.body?.language, 40) || 'Español';

  const format = ['music', 'video', 'series', 'movie'].includes(formatRaw) ? formatRaw : 'series';
  const sourceBasis = ['original', 'myth', 'real_history'].includes(sourceBasisRaw)
    ? sourceBasisRaw
    : 'original';
  const resolution = ['1080p', '4K', '5K'].includes(resolutionRaw) ? resolutionRaw : '5K';

  if (!promptInput) {
    res.status(400).json({ error: 'Escribe al menos una palabra, oración o tema para crear tu obra.' });
    return;
  }

  try {
    const basisNote =
      sourceBasis === 'myth'
        ? 'Basada profundamente en mitología, leyendas ancestrales o relatos épicos.'
        : sourceBasis === 'real_history'
        ? 'Basada en hechos históricos reales o crónicas documentadas con rigor dramático.'
        : 'Historia 100% original con construcción de mundo propia.';

    const prompt = `Eres Showrunner, Director de Cine de Estudio (${studioStyle}) y Productor Musical para ${targetPlatform} en calidad ${resolution}.
El usuario ingresó esta semilla creativa (puede ser una sola palabra, una frase o un tema completo):
"${promptInput}"

Formato solicitado: ${format.toUpperCase()}
Enfoque narrativo: ${basisNote}
Idioma: ${language}

Genera una producción cinematográfica y musical COMPLETA en JSON estricto:
- "title": título impactante de película/serie/video/canción.
- "genre": género cinematográfico y musical combinado.
- "rating": clasificación ("ATP", "+13", "+16").
- "logline": gancho comercial de 1 frase estilo Netflix/Disney.
- "synopsis": sinopsis narrativa rica de 2 a 3 párrafos digna de gran estudio.
- "characters": exactamente 4 personajes principales con "name", "role" y "description".
- "scenes": exactamente 6 escenas clave o episodios de temporada (si es serie), cada uno con "index" (1..6), "title", "durationLabel" (ej. "48 min" o "04:20"), "visualDescription" (descripción visual cinematográfica rica), "cameraAndLighting" (ej. "IMAX 65mm · Iluminación dorada anamórfica"), "dialogue" (línea dramática memorable) y "accentColor" (color hex válido como "#E11D48", "#F59E0B", "#3B82F6", "#10B981").
- "soundtrackPrompt": prompt para banda sonora épica estilo Hans Zimmer / Suno / Gemini Music.
- "lyrics": canción tema principal completa con [Intro], [Verso 1], [Coro], [Outro].
- "bpm": entero entre 74 y 148.
- "drumStyle": exactamente uno de "reggaeton", "trap", "house", "lofi", "pop", "rock", "afrobeat", "synthwave".
- "chordProgression": 4 acordes de 3-4 notas MIDI enteras (48..76).
- "bassNotes": 8 notas MIDI enteras (31..52).
- "melodyNotes": 16 notas MIDI enteras (60..84).`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            genre: { type: Type.STRING },
            rating: { type: Type.STRING },
            logline: { type: Type.STRING },
            synopsis: { type: Type.STRING },
            soundtrackPrompt: { type: Type.STRING },
            lyrics: { type: Type.STRING },
            bpm: { type: Type.INTEGER },
            drumStyle: { type: Type.STRING },
            characters: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  role: { type: Type.STRING },
                  description: { type: Type.STRING },
                },
                required: ['name', 'role', 'description'],
              },
            },
            scenes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  index: { type: Type.INTEGER },
                  title: { type: Type.STRING },
                  durationLabel: { type: Type.STRING },
                  visualDescription: { type: Type.STRING },
                  cameraAndLighting: { type: Type.STRING },
                  dialogue: { type: Type.STRING },
                  accentColor: { type: Type.STRING },
                },
                required: [
                  'index',
                  'title',
                  'durationLabel',
                  'visualDescription',
                  'cameraAndLighting',
                  'dialogue',
                  'accentColor',
                ],
              },
            },
            chordProgression: {
              type: Type.ARRAY,
              items: {
                type: Type.ARRAY,
                items: { type: Type.INTEGER },
              },
            },
            bassNotes: {
              type: Type.ARRAY,
              items: { type: Type.INTEGER },
            },
            melodyNotes: {
              type: Type.ARRAY,
              items: { type: Type.INTEGER },
            },
          },
          required: [
            'title',
            'genre',
            'rating',
            'logline',
            'synopsis',
            'soundtrackPrompt',
            'lyrics',
            'bpm',
            'drumStyle',
            'characters',
            'scenes',
            'chordProgression',
            'bassNotes',
            'melodyNotes',
          ],
        },
      },
    });

    const parsed = JSON.parse((response.text || '{}').trim());
    res.json({
      ...parsed,
      format,
      sourceBasis,
      studioStyle,
      targetPlatform,
      resolution,
      promptInput,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error generando la producción creativa.';
    res.status(500).json({ error: message });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`BASA Radio Studio server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
