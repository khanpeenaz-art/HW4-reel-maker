import { GoogleGenAI } from '@google/genai';

const API_KEY = (process.env.REACT_APP_GEMINI_API_KEY || '').trim();
const OPENAI_API_KEY = (process.env.REACT_APP_OPENAI_API_KEY || '').trim();

const ai = API_KEY ? new GoogleGenAI({ apiKey: API_KEY }) : null;

const MODELS = {
  text: 'gemini-2.5-flash',
  image: 'gemini-2.5-flash-image',
  tts: 'gemini-2.5-flash-preview-tts',
};

export const IMAGE_MODELS = [
  { id: 'dall-e-3', label: 'DALL-E 3 (OpenAI)' },
  { id: 'dall-e-2', label: 'DALL-E 2 (OpenAI)' },
  { id: 'gemini-2.5-flash-image', label: 'Gemini 2.5 Flash Image' },
  { id: 'gemini-3-pro-image-preview', label: 'Gemini 3 Pro Image' },
];

export const GEMINI_TTS_VOICES = [
  { id: 'Aoede', name: 'Aoede', tone: 'Breezy, conversational, and intelligent', gender: 'Female' },
  { id: 'Callirrhoe', name: 'Callirrhoe', tone: 'Easy-going, clear, and articulate', gender: 'Female' },
  { id: 'Charon', name: 'Charon', tone: 'Informative, calm, and assured', gender: 'Male' },
  { id: 'Fenrir', name: 'Fenrir', tone: 'Excitable, warm, and approachable', gender: 'Male' },
  { id: 'Kore', name: 'Kore', tone: 'Firm, neutral, and professional', gender: 'Female' },
  { id: 'Leda', name: 'Leda', tone: 'Youthful, professional, and composed', gender: 'Female' },
  { id: 'Orus', name: 'Orus', tone: 'Firm, mature, and resonant', gender: 'Male' },
  { id: 'Puck', name: 'Puck', tone: 'Upbeat, friendly, and energetic (Default)', gender: 'Male' },
  { id: 'Zephyr', name: 'Zephyr', tone: 'Bright, perky, and enthusiastic', gender: 'Female' },
];

export const OPENAI_TTS_VOICES = [
  { id: 'alloy', name: 'Alloy', tone: 'Neutral, balanced, and versatile', gender: 'Neutral' },
  { id: 'ash', name: 'Ash', tone: 'Clear, composed, and direct', gender: 'Male' },
  { id: 'coral', name: 'Coral', tone: 'Warm, engaging, and natural', gender: 'Female' },
  { id: 'echo', name: 'Echo', tone: 'Smooth, steady, and resonant', gender: 'Male' },
  { id: 'fable', name: 'Fable', tone: 'Expressive, warm, and storytelling', gender: 'Male' },
  { id: 'nova', name: 'Nova', tone: 'Friendly, upbeat, and youthful', gender: 'Female' },
  { id: 'onyx', name: 'Onyx', tone: 'Deep, authoritative, and confident', gender: 'Male' },
  { id: 'sage', name: 'Sage', tone: 'Calm, thoughtful, and measured', gender: 'Female' },
  { id: 'shimmer', name: 'Shimmer', tone: 'Bright, energetic, and expressive', gender: 'Female' },
];

/**
 * Load the script-generation prompt from public/prompt_script.txt.
 * The file should contain {{MOVIE_IDEA}} as a placeholder for the user's idea.
 */
async function loadPromptTemplate() {
  const res = await fetch('/prompt_script.txt');
  if (!res.ok) throw new Error('Failed to load prompt_script.txt');
  return res.text();
}

/**
 * Generate a JSON array of scenes from a movie idea.
 * Tries OpenAI first (to avoid Gemini free-tier rate limits), then falls back to Gemini.
 * @param {string} movieIdea - The user's movie idea/script idea
 * @returns {Promise<Array<{sceneNumber: number, description: string, narration: string}>>}
 */
export async function generateScenes(movieIdea) {
  const template = await loadPromptTemplate();
  const prompt = template.replace(/\{\{MOVIE_IDEA\}\}/g, movieIdea.trim());

  // Try OpenAI first (avoids Gemini free-tier 429 errors)
  if (OPENAI_API_KEY) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You are a movie script generator. Always respond with valid JSON — a JSON array of scene objects. No markdown, no code fences, just the JSON array.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.8,
        }),
      });
      if (!res.ok) {
        const errBody = await res.text().catch(() => 'Unknown');
        console.warn('[generateScenes] OpenAI failed, falling back to Gemini:', res.status, errBody);
      } else {
        const data = await res.json();
        const text = data?.choices?.[0]?.message?.content?.trim();
        if (text) {
          const parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim());
          return Array.isArray(parsed) ? parsed : [parsed];
        }
      }
    } catch (err) {
      console.warn('[generateScenes] OpenAI error, falling back to Gemini:', err.message);
    }
  }

  // Fallback to Gemini
  if (!ai) throw new Error('API key not configured. Add REACT_APP_OPENAI_API_KEY or REACT_APP_GEMINI_API_KEY to .env');
  const response = await ai.models.generateContent({
    model: MODELS.text,
    contents: [{ parts: [{ text: prompt }] }],
  });
  const text = response?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) throw new Error('No response from Gemini');
  const parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim());
  return Array.isArray(parsed) ? parsed : [parsed];
}

/**
 * Generate an image from a description using Imagen/Gemini image model.
 *
 * PROMPT CONSTRUCTION:
 * 1. Text prompt: We instruct the model that reference images may be provided (image 1, 2, 3).
 * 2. If the description references "image 1", "image 2", or "image 3", we include the corresponding
 *    anchor images in the API call, in that order (1, 2, 3).
 * 3. Content parts order: [textPrompt, image1Data, image2Data, image3Data] — only images that are
 *    both referenced and provided are included.
 * 4. The text tells the model: "Generate an image based on: {description}. Reference images are
 *    provided below in order: image 1, image 2, image 3. Use them as specified."
 *
 * @param {string} description - Visual description (may reference "image 1", "image 2", "image 3")
 * @param {Array<Blob|null>} anchorImages - Optional [image1, image2, image3] blobs
 * @param {string} modelId - Image model (e.g. gemini-2.5-flash-image, gemini-3-pro-image-preview)
 * @returns {Promise<Blob>} - PNG image blob
 */
export async function generateImage(description, anchorImages = [], modelId = MODELS.image) {
  // Dispatch to OpenAI DALL-E if selected
  if (modelId.startsWith('dall-e')) {
    return generateImageOpenAI(description, modelId);
  }

  if (!ai) throw new Error('Gemini API key not configured');

  const refs = [];
  const desc = (description || '').toLowerCase();
  if (desc.includes('image 1') && anchorImages[0]) refs.push(1);
  if (desc.includes('image 2') && anchorImages[1]) refs.push(2);
  if (desc.includes('image 3') && anchorImages[2]) refs.push(3);

  const parts = [];
  const promptPrefix = refs.length > 0
    ? `Generate an image based on this description. Reference images are provided below in order as image 1, image 2, image 3. Use them according to the description.\n\nDescription: `
    : '';
  parts.push({ text: promptPrefix + description });

  for (const n of refs) {
    const blob = anchorImages[n - 1];
    if (!blob) continue;
    const base64 = await blobToBase64(blob);
    const mime = blob.type || 'image/png';
    parts.push({ inlineData: { mimeType: mime, data: base64 } });
  }

  let response;
  try {
    response = await ai.models.generateContent({
      model: modelId,
      contents: [{ parts }],
      config: { responseModalities: ['TEXT', 'IMAGE'] },
    });
  } catch (apiErr) {
    const msg = apiErr?.message || String(apiErr);
    if (msg.includes('429') || msg.toLowerCase().includes('resource exhausted') || msg.toLowerCase().includes('rate limit')) {
      throw new Error(`Image generation rate limit exceeded (429). Your API key has hit its quota for the ${modelId} model. Wait a few minutes or check your quota at https://aistudio.google.com.`);
    }
    if (msg.includes('400')) {
      throw new Error(`Image generation request rejected (400): ${msg}`);
    }
    if (msg.includes('403')) {
      throw new Error(`Image generation forbidden (403). The model "${modelId}" may not be available for your API key.`);
    }
    throw new Error(`Image generation failed: ${msg}`);
  }
  const outParts = response?.candidates?.[0]?.content?.parts || [];
  for (const part of outParts) {
    if (part.inlineData?.data) {
      const bytes = Uint8Array.from(atob(part.inlineData.data), c => c.charCodeAt(0));
      return new Blob([bytes], { type: part.inlineData.mimeType || 'image/png' });
    }
  }
  throw new Error('No image returned by the API. The model may not support image generation for this prompt.');
}

async function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result.split(',')[1]);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

/**
 * Generate an image using OpenAI DALL-E API.
 * @param {string} description - Visual description for the image
 * @param {string} modelId - 'dall-e-3' or 'dall-e-2'
 * @returns {Promise<Blob>} - PNG image blob
 */
async function generateImageOpenAI(description, modelId = 'dall-e-3') {
  if (!OPENAI_API_KEY) throw new Error('OpenAI API key not configured. Add REACT_APP_OPENAI_API_KEY to your .env file and restart the server.');

  const size = modelId === 'dall-e-3' ? '1024x1024' : '512x512';

  let res;
  try {
    res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: modelId,
        prompt: description,
        n: 1,
        size,
        response_format: 'b64_json',
      }),
    });
  } catch (networkErr) {
    throw new Error(`OpenAI API request failed: ${networkErr.message}`);
  }

  if (!res.ok) {
    const errBody = await res.text().catch(() => 'Unknown error');
    let errMsg;
    try {
      const parsed = JSON.parse(errBody);
      errMsg = parsed?.error?.message || errBody;
    } catch {
      errMsg = errBody;
    }
    if (res.status === 429) {
      throw new Error(`OpenAI rate limit exceeded (429). ${errMsg}`);
    }
    if (res.status === 401) {
      throw new Error(`OpenAI authentication failed (401). Check your REACT_APP_OPENAI_API_KEY in .env. ${errMsg}`);
    }
    if (res.status === 400) {
      throw new Error(`OpenAI rejected the request (400): ${errMsg}`);
    }
    throw new Error(`OpenAI error (${res.status}): ${errMsg}`);
  }

  const data = await res.json();
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) throw new Error('No image data in OpenAI response');

  const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  return new Blob([bytes], { type: 'image/png' });
}

/**
 * Generate audio from text using Gemini TTS.
 * @param {string} text - Narration text
 * @param {string} voice - One of Kore, Aoede, Callirrhoe
 * @returns {Promise<Blob>} - WAV audio blob
 */
export async function generateTTSGemini(text, voice = 'Kore') {
  if (!ai) throw new Error('API key not configured');
  const validIds = GEMINI_TTS_VOICES.map((v) => v.id);
  const voiceName = validIds.includes(voice) ? voice : 'Kore';
  const response = await ai.models.generateContent({
    model: MODELS.tts,
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName },
        },
      },
    },
  });
  const data = response?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!data) throw new Error('No audio in response');
  const pcm = Uint8Array.from(atob(data), c => c.charCodeAt(0));
  return pcmToWav(pcm, 24000, 1);
}

/**
 * Fetch all available voices from ElevenLabs.
 * @returns {Promise<Array<{id: string, name: string}>>}
 */
export async function fetchElevenLabsVoices() {
  const apiKey = (process.env.REACT_APP_ELEVENLABS_API_KEY || '').trim();
  if (!apiKey) throw new Error('ElevenLabs API key required');

  const res = await fetch('https://api.elevenlabs.io/v1/voices', {
    method: 'GET',
    headers: { 'xi-api-key': apiKey },
  });

  if (!res.ok) throw new Error('Failed to fetch ElevenLabs voices');

  const data = await res.json();
  return data.voices
    .map((v) => ({ id: v.voice_id, name: v.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Generate audio from text using ElevenLabs TTS.
 * @param {string} text - Narration text
 * @param {string} voiceId - ElevenLabs voice ID
 * @returns {Promise<Blob>} - MP3 audio blob
 */
export async function generateTTSElevenLabs(text, voiceId) {
  const apiKey = (process.env.REACT_APP_ELEVENLABS_API_KEY || '').trim();
  if (!apiKey) throw new Error('ElevenLabs API key required in .env');
  if (!voiceId) throw new Error('Select an ElevenLabs voice');
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': apiKey,
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({ text, model_id: 'eleven_v3' }),
  });
  if (!res.ok) {
    const err = await res.text();
    const msg = res.status === 401
      ? `ElevenLabs 401: Invalid API key or voice. Check your .env (REACT_APP_ELEVENLABS_API_KEY) and restart the dev server. Response: ${err}`
      : `ElevenLabs error: ${res.status} ${err}`;
    throw new Error(msg);
  }
  return await res.blob();
}

/**
 * Generate audio from text using OpenAI TTS.
 * @param {string} text - Narration text
 * @param {string} voice - One of alloy, ash, coral, echo, fable, nova, onyx, sage, shimmer
 * @returns {Promise<Blob>} - MP3 audio blob
 */
export async function generateTTSOpenAI(text, voice = 'alloy') {
  if (!OPENAI_API_KEY) throw new Error('OpenAI API key not configured. Add REACT_APP_OPENAI_API_KEY to your .env file and restart the server.');

  const validIds = OPENAI_TTS_VOICES.map((v) => v.id);
  const voiceName = validIds.includes(voice) ? voice : 'alloy';

  let res;
  try {
    res = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: text,
        voice: voiceName,
        response_format: 'mp3',
      }),
    });
  } catch (networkErr) {
    throw new Error(`OpenAI TTS request failed: ${networkErr.message}`);
  }

  if (!res.ok) {
    const errBody = await res.text().catch(() => 'Unknown error');
    let errMsg;
    try {
      const parsed = JSON.parse(errBody);
      errMsg = parsed?.error?.message || errBody;
    } catch {
      errMsg = errBody;
    }
    if (res.status === 429) throw new Error(`OpenAI TTS rate limit exceeded (429). ${errMsg}`);
    if (res.status === 401) throw new Error(`OpenAI TTS authentication failed (401). Check your REACT_APP_OPENAI_API_KEY. ${errMsg}`);
    throw new Error(`OpenAI TTS error (${res.status}): ${errMsg}`);
  }

  return await res.blob();
}

/**
 * Generate TTS - dispatches to Gemini, OpenAI, or ElevenLabs based on provider.
 * @param {string} text - Narration text
 * @param {string} provider - 'gemini', 'openai', or 'elevenlabs'
 * @param {string} voice - Voice ID for the chosen provider
 */
export async function generateTTS(text, provider = 'openai', voice = 'alloy') {
  if (provider === 'elevenlabs') return generateTTSElevenLabs(text, voice);
  if (provider === 'openai') return generateTTSOpenAI(text, voice);
  return generateTTSGemini(text, voice);
}

function pcmToWav(pcm, sampleRate = 24000, numChannels = 1) {
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcm.length;
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const writeStr = (offset, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);
  return new Blob([header, pcm], { type: 'audio/wav' });
}

