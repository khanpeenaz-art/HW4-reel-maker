const OPENAI_API_KEY = (process.env.REACT_APP_OPENAI_API_KEY || '').trim();

async function loadChatPrompt() {
  const res = await fetch('/chat_prompt.txt');
  if (!res.ok) throw new Error('Failed to load chat_prompt.txt');
  return res.text();
}

/**
 * Tool definitions for OpenAI function calling.
 */
const toolDefinitions = [
  {
    type: 'function',
    function: {
      name: 'generateMovieScript',
      description: 'Writes the generated movie script with scenes into the scene editor. Call this ONLY when the user wants to create a brand new script from scratch. Do NOT call this to edit a single scene — use updateScene instead.',
      parameters: {
        type: 'object',
        properties: {
          scenes: {
            type: 'array',
            description: 'Array of scene objects for the video reel',
            items: {
              type: 'object',
              properties: {
                sceneNumber: { type: 'integer', description: 'Scene number (1-based index)' },
                description: { type: 'string', description: 'Vivid visual description for image generation' },
                narration: { type: 'string', description: 'Narration text with optional TTS tags like [excited] or [whispering]' },
              },
              required: ['sceneNumber', 'description', 'narration'],
            },
          },
        },
        required: ['scenes'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'updateScene',
      description: 'Updates a single existing scene by its 0-based index. Use this when the user wants to change the description or narration of one specific scene. Only the fields you provide will be updated; the other field and any generated images/audio for unchanged fields are preserved.',
      parameters: {
        type: 'object',
        properties: {
          sceneIndex: { type: 'integer', description: 'The 0-based index of the scene to update (e.g. 0 for Scene 1, 1 for Scene 2)' },
          description: { type: 'string', description: 'New visual description for image generation (omit to keep current)' },
          narration: { type: 'string', description: 'New narration text (omit to keep current)' },
        },
        required: ['sceneIndex'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'translateNarrations',
      description: 'Translates all scene narrations to a target language. You MUST read the full script context (all scene narrations) provided in the conversation. Translate each narration faithfully while preserving emotional TTS tags like [excited], [whispering], etc. in their original English form. The translations should sound natural and culturally appropriate in the target language, not word-for-word literal. Call this when the user asks to translate narrations to another language.',
      parameters: {
        type: 'object',
        properties: {
          targetLanguage: { type: 'string', description: 'The full name of the target language (e.g. "Spanish", "French", "Japanese")' },
          translatedNarrations: {
            type: 'array',
            description: 'Array of translated narration strings, exactly one per scene in the same order. Each string should be the full translated narration for that scene, preserving any [emotion] tags in English.',
            items: { type: 'string' },
          },
        },
        required: ['targetLanguage', 'translatedNarrations'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generateYouTubeTitle',
      description: 'Generates ONE catchy, SEO-optimized YouTube title based on the full movie script and any anchor images mentioned. The title must: (1) Be max 100 characters, (2) Use power words that drive clicks (e.g. "Insane", "You Won\'t Believe", "Must-Watch"), (3) Reflect the genre, mood, and main theme of the script, (4) Include relevant keywords for search discoverability, (5) Consider the visual style from anchor images if provided. Analyze the script context carefully before generating.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'A catchy, SEO-friendly YouTube title (max 100 characters) that reflects the script content, genre, and mood' },
        },
        required: ['title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generateYouTubeDescription',
      description: 'Generates ONE fully optimized YouTube video description based on the full movie script and anchor images. The description MUST include: (1) A strong hook in the first 2 lines (this shows before "Show more"), (2) A compelling 2-3 paragraph summary reflecting the video content, (3) Timestamps section mapping to each scene if the script has 3+ scenes (e.g. "0:00 - Scene Title"), (4) SEO keywords naturally woven throughout, (5) A call-to-action (subscribe, like, comment), (6) 5-10 relevant hashtags at the end. Analyze the script context carefully before generating.',
      parameters: {
        type: 'object',
        properties: {
          description: { type: 'string', description: 'A fully optimized YouTube description with hook, summary, timestamps, keywords, CTA, and hashtags' },
        },
        required: ['description'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generateYouTubeThumbnail',
      description: 'Generates a YouTube thumbnail image by producing a detailed, specific image generation prompt. This prompt must NOT be generic—it MUST reflect: (1) The main character or subject from the script, (2) The tone of the video (dramatic, funny, mysterious, etc.), (3) The genre (documentary, action, comedy, horror, etc.), (4) The mood and atmosphere (dark, bright, tense, whimsical, etc.), (5) Eye-catching composition with bold colors, close-ups or dramatic angles, (6) Any anchor image style references if the user provided anchor images. The prompt should describe a single striking thumbnail image that would make someone click on YouTube.',
      parameters: {
        type: 'object',
        properties: {
          prompt: { type: 'string', description: 'A detailed, specific image prompt for thumbnail generation that reflects the main character, tone, genre, and mood of the script. NOT generic—must be tailored to this specific video content.' },
        },
        required: ['prompt'],
      },
    },
  },
];

/**
 * Build a context string from the current scenes to include in chat messages.
 */
export function buildScriptContext(scenes) {
  if (!scenes || scenes.length === 0) return '';
  const lines = scenes.map((s, i) =>
    `Scene ${s.sceneNumber || i + 1}:\n  Description: ${s.description}\n  Narration: ${s.narration}`
  );
  return `\n\n--- CURRENT MOVIE SCRIPT ---\n${lines.join('\n\n')}\n--- END SCRIPT ---`;
}

/**
 * Create a chat session object that stores conversation history.
 * Uses OpenAI API to avoid Gemini free-tier rate limits.
 * @returns {Promise<Object>} Chat session object
 */
export async function createAssistantChat() {
  if (!OPENAI_API_KEY) return null;
  const systemInstruction = await loadChatPrompt();
  // Return a chat session object that tracks message history
  return {
    messages: [{ role: 'system', content: systemInstruction }],
  };
}

/**
 * Send a message to the assistant and process the response.
 * Uses OpenAI's chat completions API with function calling.
 */
export async function sendAssistantMessage(chat, message, callbacks, anchorImages = [], onChunk, scenes = []) {
  if (!chat) throw new Error('API key not configured. Add REACT_APP_OPENAI_API_KEY to .env');
  console.log('[AI Reel Maker] sendAssistantMessage called (OpenAI)');

  // Build message with script context
  const scriptContext = buildScriptContext(scenes);
  const fullMessage = scriptContext ? `${message}${scriptContext}` : message;

  // Add user message to history
  chat.messages.push({ role: 'user', content: fullMessage });

  // Call OpenAI Chat Completions API
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: chat.messages,
      tools: toolDefinitions,
      tool_choice: 'auto',
      temperature: 0.8,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => `HTTP ${res.status}`);
    throw new Error(`OpenAI API error: ${errText}`);
  }

  const data = await res.json();
  const choice = data?.choices?.[0];
  const responseMessage = choice?.message;

  if (!responseMessage) throw new Error('No response from OpenAI');

  // Add assistant response to history
  chat.messages.push(responseMessage);

  // Check for tool calls
  const toolCalls = responseMessage.tool_calls;

  if (toolCalls && toolCalls.length > 0) {
    console.log('[AI Reel Maker] Tool calls:', toolCalls.map((tc) => tc.function.name));
    let confirmText = '';

    for (const tc of toolCalls) {
      const fnName = tc.function.name;
      let args;
      try {
        args = JSON.parse(tc.function.arguments);
      } catch {
        console.warn('[AI Reel Maker] Failed to parse tool args:', tc.function.arguments);
        continue;
      }

      if (fnName === 'generateMovieScript' && args) {
        console.log('[AI Reel Maker] Executing generateMovieScript, scenes count:', args.scenes?.length);
        callbacks.onScript?.(args);
        confirmText += 'I\'ve added the script to your scene editor. You can review and edit it there, then generate images and audio for each scene.\n';
      }
      if (fnName === 'updateScene' && args) {
        console.log('[AI Reel Maker] Executing updateScene, index:', args.sceneIndex);
        callbacks.onUpdateScene?.(args);
        confirmText += `I've updated Scene ${(args.sceneIndex ?? 0) + 1}. Only the changed fields were modified — your existing images and audio for unchanged fields are preserved.\n`;
      }
      if (fnName === 'translateNarrations' && args) {
        console.log('[AI Reel Maker] Executing translateNarrations, language:', args.targetLanguage);
        callbacks.onTranslate?.(args);
        confirmText += `I've translated all narrations to ${args.targetLanguage}. You can toggle between Original and Translated text in the scene editor.\n`;
      }
      if (fnName === 'generateYouTubeTitle' && args) {
        console.log('[AI Reel Maker] Executing generateYouTubeTitle:', args.title);
        callbacks.onYouTubeTitle?.(args.title);
        confirmText += `I've generated a YouTube title: "${args.title}"\n`;
      }
      if (fnName === 'generateYouTubeDescription' && args) {
        console.log('[AI Reel Maker] Executing generateYouTubeDescription');
        callbacks.onYouTubeDescription?.(args.description);
        confirmText += `I've generated a YouTube description for your video.\n`;
      }
      if (fnName === 'generateYouTubeThumbnail' && args) {
        console.log('[AI Reel Maker] Executing generateYouTubeThumbnail, prompt:', args.prompt);
        callbacks.onYouTubeThumbnail?.(args.prompt);
        confirmText += `I'm generating a YouTube thumbnail based on your script.\n`;
      }

      // Add tool result to history for context
      chat.messages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: JSON.stringify({ success: true }),
      });
    }

    if (!confirmText) confirmText = responseMessage.content || 'Done!';
    onChunk?.(confirmText.trim());
    return { text: confirmText.trim(), functionCalled: true };
  }

  // Plain text response
  const text = responseMessage.content || '';
  console.log('[AI Reel Maker] Text response (no tool call), length:', text.length);

  // Fallback: model sometimes outputs JSON as text instead of calling the tool
  const parsed = tryParseScriptFromText(text);
  if (parsed) {
    console.log('[AI Reel Maker] Parsed script from text fallback, scenes count:', parsed.scenes?.length);
    callbacks.onScript?.(parsed);
    const confirmText = 'I\'ve added the script to your scene editor. You can review and edit it there, then generate images and audio for each scene.';
    onChunk?.(confirmText);
    return { text: confirmText, functionCalled: true };
  }

  onChunk?.(text);
  return { text, functionCalled: false };
}

/** Try to extract and parse a scenes array from model text */
function tryParseScriptFromText(text) {
  if (!text?.trim()) return null;
  try {
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();
    const match = cleaned.match(/[\s\S]*]/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]);
    const arr = Array.isArray(parsed) ? parsed : [parsed];
    const scenes = arr.filter((s) => s && (s.description || s.narration));
    if (scenes.length === 0) return null;
    return { scenes };
  } catch {
    return null;
  }
}
