import React, { useState, useCallback, useRef } from 'react';
import { generateScenes, generateImage, generateTTS, fetchElevenLabsVoices } from './services/gemini';
import { assembleVideo } from './services/ffmpegService';
import { createAssistantChat, sendAssistantMessage } from './services/apiService';
import MovieInput from './components/MovieInput';
import AnchorImages from './components/AnchorImages';
import AnimatedDots from './components/AnimatedDots';
import SceneEditor from './components/SceneEditor';
import VideoAssembly from './components/VideoAssembly';
import ChatAssistant from './components/ChatAssistant';
import YouTubeMetadata from './components/YouTubeMetadata';

function getProjectName() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `video_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

const initialScene = (item) => ({
  sceneNumber: item.sceneNumber ?? 0,
  description: item.description ?? '',
  narration: item.narration ?? '',
  imageBlob: null,
  audioBlob: null,
});

function App() {
  const [projectName, setProjectName] = useState(null);
  const [movieIdea, setMovieIdea] = useState('');
  const [anchorImages, setAnchorImages] = useState([null, null, null]);
  const [scenes, setScenes] = useState([]);
  const [imageModel, setImageModel] = useState('dall-e-3');
  const [voiceProvider, setVoiceProvider] = useState('openai');
  const [voice, setVoice] = useState('Kore');
  const [openaiVoice, setOpenaiVoice] = useState('alloy');
  const [elevenLabsVoices, setElevenLabsVoices] = useState([]);
  const [elevenLabsVoiceId, setElevenLabsVoiceId] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatingIndex, setGeneratingIndex] = useState(null);
  const [assembleProgress, setAssembleProgress] = useState(null);
  const [assembleStatus, setAssembleStatus] = useState({ currentScene: null, totalScenes: 0 });
  const [includeSubtitles, setIncludeSubtitles] = useState(true);
  const [outputBlob, setOutputBlob] = useState(null);
  const [error, setError] = useState(null);
  const [sceneError, setSceneError] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const assistantChatRef = useRef(null);

  // Translation state
  const [targetLanguage, setTargetLanguage] = useState('Spanish');
  const [translatedNarrations, setTranslatedNarrations] = useState([]);
  const [showTranslated, setShowTranslated] = useState(false);
  const [translating, setTranslating] = useState(false);

  // YouTube Metadata state
  const [ytTitle, setYtTitle] = useState('');
  const [ytDescription, setYtDescription] = useState('');
  const [ytThumbnail, setYtThumbnail] = useState(null);
  const [thumbnailModel, setThumbnailModel] = useState('dall-e-3');
  const [ytLoading, setYtLoading] = useState(null); // 'title' | 'description' | 'thumbnail' | null

  // Batch generation state
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0, phase: '' });
  const batchCancelRef = useRef(false);

  const handleGenerateScenes = useCallback(async () => {
    if (!movieIdea.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const generated = await generateScenes(movieIdea.trim());
      setScenes(generated.map(initialScene));
      setProjectName(getProjectName());
      // Clear translation when new scenes are generated
      setTranslatedNarrations([]);
      setShowTranslated(false);
    } catch (err) {
      setError(err?.message || 'Failed to generate scenes');
    } finally {
      setLoading(false);
    }
  }, [movieIdea]);

  const handleUpdateScene = useCallback((index, field, value) => {
    setScenes((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s))
    );
  }, []);

  const handleGenerateImage = useCallback(async (index) => {
    const scene = scenes[index];
    if (!scene?.description) return;
    setGeneratingIndex(index);
    setError(null);
    setSceneError(null);
    try {
      const blob = await generateImage(scene.description, anchorImages, imageModel);
      setScenes((prev) =>
        prev.map((s, i) => (i === index ? { ...s, imageBlob: blob } : s))
      );
    } catch (err) {
      const message = err?.message || 'Failed to generate image';
      setError(message);
      setSceneError({ index, type: 'image', message });
    } finally {
      setGeneratingIndex(null);
    }
  }, [scenes, anchorImages, imageModel]);

  React.useEffect(() => {
    if (voiceProvider === 'elevenlabs') {
      fetchElevenLabsVoices()
        .then((voices) => {
          setElevenLabsVoices(voices);
          if (voices.length > 0 && !elevenLabsVoiceId) setElevenLabsVoiceId(voices[0].id);
        })
        .catch((err) => console.error('Error loading ElevenLabs voices:', err));
    }
  }, [voiceProvider]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAnchorChange = useCallback((index, file) => {
    setAnchorImages((prev) => {
      const next = [...prev];
      next[index] = file;
      return next;
    });
  }, []);

  const handleGenerateAudio = useCallback(async (index) => {
    const scene = scenes[index];
    if (!scene?.narration) return;
    setGeneratingIndex(index);
    setError(null);
    setSceneError(null);
    try {
      let voiceToUse;
      if (voiceProvider === 'elevenlabs') voiceToUse = elevenLabsVoiceId;
      else if (voiceProvider === 'openai') voiceToUse = openaiVoice;
      else voiceToUse = voice;
      const blob = await generateTTS(scene.narration, voiceProvider, voiceToUse);
      setScenes((prev) =>
        prev.map((s, i) => (i === index ? { ...s, audioBlob: blob } : s))
      );
    } catch (err) {
      const message = err?.message || 'Failed to generate audio';
      setError(message);
      setSceneError({ index, type: 'audio', message });
    } finally {
      setGeneratingIndex(null);
    }
  }, [scenes, voice, voiceProvider, elevenLabsVoiceId, openaiVoice]);

  // --- Generate All (images + audio) scene-by-scene ---
  const handleGenerateAll = useCallback(async () => {
    if (scenes.length === 0 || batchGenerating) return;
    setBatchGenerating(true);
    batchCancelRef.current = false;
    setError(null);
    setSceneError(null);

    // Figure out which scenes need work
    const scenesToProcess = scenes
      .map((s, i) => {
        const needsImage = !s.imageBlob && s.description?.trim();
        const needsAudio = !s.audioBlob && s.narration?.trim();
        if (needsImage || needsAudio) return { index: i, needsImage, needsAudio };
        return null;
      })
      .filter(Boolean);

    const totalSteps = scenesToProcess.reduce((sum, s) => sum + (s.needsImage ? 1 : 0) + (s.needsAudio ? 1 : 0), 0);

    if (totalSteps === 0) {
      setBatchGenerating(false);
      return;
    }

    let completed = 0;

    // Process scene-by-scene: image then audio for each scene
    for (const { index: idx, needsImage, needsAudio } of scenesToProcess) {
      // Check if cancelled
      if (batchCancelRef.current) break;

      const scene = scenes[idx];

      // Generate image for this scene
      if (needsImage) {
        if (batchCancelRef.current) break;
        setBatchProgress({ current: completed, total: totalSteps, phase: `Scene ${idx + 1}: generating image...` });
        setGeneratingIndex(idx);
        try {
          const blob = await generateImage(scene.description, anchorImages, imageModel);
          setScenes((prev) =>
            prev.map((s, i) => (i === idx ? { ...s, imageBlob: blob } : s))
          );
        } catch (err) {
          console.error(`[Generate All] Image ${idx + 1} failed:`, err?.message);
        }
        completed++;
        setGeneratingIndex(null);
      }

      // Generate audio for this scene
      if (needsAudio) {
        if (batchCancelRef.current) break;
        setBatchProgress({ current: completed, total: totalSteps, phase: `Scene ${idx + 1}: generating audio...` });
        setGeneratingIndex(idx);
        try {
          let voiceToUse;
          if (voiceProvider === 'elevenlabs') voiceToUse = elevenLabsVoiceId;
          else if (voiceProvider === 'openai') voiceToUse = openaiVoice;
          else voiceToUse = voice;
          const blob = await generateTTS(scene.narration, voiceProvider, voiceToUse);
          setScenes((prev) =>
            prev.map((s, i) => (i === idx ? { ...s, audioBlob: blob } : s))
          );
        } catch (err) {
          console.error(`[Generate All] Audio ${idx + 1} failed:`, err?.message);
        }
        completed++;
        setGeneratingIndex(null);
      }
    }

    const wasCancelled = batchCancelRef.current;
    setBatchProgress({ current: completed, total: totalSteps, phase: wasCancelled ? 'Stopped' : 'Done!' });
    setBatchGenerating(false);
    batchCancelRef.current = false;
  }, [scenes, anchorImages, imageModel, voice, voiceProvider, elevenLabsVoiceId, openaiVoice, batchGenerating]);

  const handleStopGenerateAll = useCallback(() => {
    batchCancelRef.current = true;
  }, []);

  // --- Translation handler (direct button) ---
  const handleTranslate = useCallback(async () => {
    if (scenes.length === 0) return;
    setTranslating(true);
    setError(null);
    try {
      const openaiKey = (process.env.REACT_APP_OPENAI_API_KEY || '').trim();
      if (!openaiKey) throw new Error('OpenAI API key required for translation. Add REACT_APP_OPENAI_API_KEY to .env');
      const narrations = scenes.map((s) => s.narration);
      const prompt = `Translate each of the following narrations to ${targetLanguage}. Keep the emotional tags like [excited], [whispering] etc. in their original English form. Return ONLY a JSON array of translated strings, nothing else.\n\nNarrations:\n${JSON.stringify(narrations)}`;
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You are a translator. Return ONLY a JSON array of translated strings. No markdown, no code fences.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.3,
        }),
      });
      if (!res.ok) throw new Error(`OpenAI translation failed (${res.status})`);
      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content?.trim() || '';
      const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();
      const translated = JSON.parse(cleaned);
      if (Array.isArray(translated)) {
        setTranslatedNarrations(translated);
        setShowTranslated(true);
      }
    } catch (err) {
      setError(err?.message || 'Failed to translate narrations');
    } finally {
      setTranslating(false);
    }
  }, [scenes, targetLanguage]);

  // --- Script handler for chat callbacks (smart merge) ---
  const handleAssistantScript = useCallback((args) => {
    if (!args?.scenes || !Array.isArray(args.scenes)) return;

    setScenes((prevScenes) => {
      // If no previous scenes, just set fresh ones
      if (prevScenes.length === 0) {
        return args.scenes.map((s) => initialScene(s));
      }

      // Smart merge: preserve blobs for scenes that didn't change
      const newScenes = args.scenes.map((newScene, i) => {
        const existing = prevScenes[i];
        if (!existing) return initialScene(newScene);

        const descChanged = (newScene.description || '').trim() !== (existing.description || '').trim();
        const narrChanged = (newScene.narration || '').trim() !== (existing.narration || '').trim();

        return {
          sceneNumber: newScene.sceneNumber ?? i + 1,
          description: newScene.description ?? existing.description,
          narration: newScene.narration ?? existing.narration,
          imageBlob: descChanged ? null : existing.imageBlob,   // only reset if description changed
          audioBlob: narrChanged ? null : existing.audioBlob,   // only reset if narration changed
        };
      });

      return newScenes;
    });

    if (!projectName) setProjectName(getProjectName());
    setTranslatedNarrations([]);
    setShowTranslated(false);
  }, [projectName]);

  // --- Single scene update handler from chat tool ---
  const handleChatUpdateScene = useCallback((args) => {
    if (args?.sceneIndex == null) return;
    const idx = args.sceneIndex;

    setScenes((prevScenes) => {
      if (idx < 0 || idx >= prevScenes.length) return prevScenes;
      const existing = prevScenes[idx];
      const updated = { ...existing };

      if (args.description != null && args.description.trim() !== existing.description.trim()) {
        updated.description = args.description;
        updated.imageBlob = null; // reset image since description changed
      }
      if (args.narration != null && args.narration.trim() !== existing.narration.trim()) {
        updated.narration = args.narration;
        updated.audioBlob = null; // reset audio since narration changed
      }

      return prevScenes.map((s, i) => (i === idx ? updated : s));
    });
  }, []);

  // --- Translation handler from chat tool ---
  const handleChatTranslate = useCallback((args) => {
    if (!args?.translatedNarrations || !Array.isArray(args.translatedNarrations)) return;
    setTranslatedNarrations(args.translatedNarrations);
    setShowTranslated(true);
    if (args.targetLanguage) setTargetLanguage(args.targetLanguage);
  }, []);

  // --- YouTube handlers from chat tools ---
  const handleChatYouTubeTitle = useCallback((title) => {
    if (title) setYtTitle(title);
  }, []);

  const handleChatYouTubeDescription = useCallback((desc) => {
    if (desc) setYtDescription(desc);
  }, []);

  const handleChatYouTubeThumbnail = useCallback(async (prompt) => {
    if (!prompt) return;
    setYtLoading('thumbnail');
    try {
      const blob = await generateImage(prompt, anchorImages, thumbnailModel);
      setYtThumbnail(blob);
    } catch (err) {
      setError(err?.message || 'Failed to generate thumbnail');
    } finally {
      setYtLoading(null);
    }
  }, [anchorImages, thumbnailModel]);

  // --- YouTube direct button handlers ---
  const handleGenerateYTTitle = useCallback(async () => {
    if (scenes.length === 0) return;
    setYtLoading('title');
    setError(null);
    try {
      const openaiKey = (process.env.REACT_APP_OPENAI_API_KEY || '').trim();
      if (!openaiKey) throw new Error('OpenAI API key required');
      const scriptSummary = scenes.map((s, i) => `Scene ${i + 1}: ${s.description} | Narration: ${s.narration}`).join('\n');
      const prompt = `You are a YouTube SEO expert. Based on this movie script, generate ONE catchy, SEO-optimized YouTube title.

Rules:
- Max 100 characters
- Use power words that drive clicks (e.g. "Insane", "You Won't Believe", "Must-Watch")
- Reflect the genre, mood, and main theme of the script
- Include relevant search keywords
- Return ONLY the title text, nothing else

Script:
${scriptSummary}`;
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.8,
        }),
      });
      if (!res.ok) throw new Error(`OpenAI title generation failed (${res.status})`);
      const data = await res.json();
      const title = data?.choices?.[0]?.message?.content?.trim() || '';
      if (title) setYtTitle(title.replace(/^["']|["']$/g, ''));
    } catch (err) {
      setError(err?.message || 'Failed to generate title');
    } finally {
      setYtLoading(null);
    }
  }, [scenes]);

  const handleGenerateYTDescription = useCallback(async () => {
    if (scenes.length === 0) return;
    setYtLoading('description');
    setError(null);
    try {
      const openaiKey = (process.env.REACT_APP_OPENAI_API_KEY || '').trim();
      if (!openaiKey) throw new Error('OpenAI API key required');
      const scriptSummary = scenes.map((s, i) => `Scene ${i + 1}: ${s.description} | Narration: ${s.narration}`).join('\n');
      const prompt = `You are a YouTube SEO expert. Based on this movie script, generate ONE fully optimized YouTube video description.

The description MUST include ALL of the following:
1. A strong hook in the first 2 lines (this is what shows before "Show more")
2. A compelling 2-3 paragraph summary of the ACTUAL video content — be specific, not generic
3. A Timestamps section mapping to each scene (e.g. "0:00 - Introduction", "0:15 - The Discovery")
4. SEO keywords naturally woven throughout
5. A call-to-action (e.g. "Subscribe for more!", "Like and comment below!")
6. 5-10 relevant hashtags at the end

Return ONLY the description text.

Script:
${scriptSummary}`;
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
        }),
      });
      if (!res.ok) throw new Error(`OpenAI description generation failed (${res.status})`);
      const data = await res.json();
      const desc = data?.choices?.[0]?.message?.content?.trim() || '';
      if (desc) setYtDescription(desc);
    } catch (err) {
      setError(err?.message || 'Failed to generate description');
    } finally {
      setYtLoading(null);
    }
  }, [scenes]);

  const handleGenerateYTThumbnail = useCallback(async () => {
    if (scenes.length === 0) return;
    setYtLoading('thumbnail');
    setError(null);
    try {
      // Generate a thumbnail prompt from the script using OpenAI
      const openaiKey = (process.env.REACT_APP_OPENAI_API_KEY || '').trim();
      if (!openaiKey) throw new Error('OpenAI API key required');
      const scriptSummary = scenes.map((s, i) => `Scene ${i + 1}: ${s.description} | Narration: ${s.narration}`).join('\n');
      const promptReq = `You are a YouTube thumbnail expert and visual designer. Based on this movie script, generate a detailed, SPECIFIC image generation prompt for a YouTube thumbnail.

The prompt must NOT be generic. It MUST reflect:
1. The main character or subject from the script — describe their appearance, expression, pose
2. The tone of the video (dramatic, funny, mysterious, exciting, etc.)
3. The genre (documentary, action, comedy, horror, sci-fi, etc.)
4. The mood and atmosphere (dark and moody, bright and vibrant, tense, whimsical, etc.)
5. Eye-catching composition — bold colors, dramatic angles, close-ups
6. YouTube-optimized style — should make someone WANT to click

Return ONLY the image generation prompt, nothing else.

Script:
${scriptSummary}`;
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: promptReq }],
          temperature: 0.8,
        }),
      });
      if (!res.ok) throw new Error(`OpenAI thumbnail prompt generation failed (${res.status})`);
      const data = await res.json();
      const thumbnailPrompt = data?.choices?.[0]?.message?.content?.trim() || '';
      if (!thumbnailPrompt) throw new Error('Failed to generate thumbnail prompt');
      const blob = await generateImage(thumbnailPrompt, anchorImages, thumbnailModel);
      setYtThumbnail(blob);
    } catch (err) {
      setError(err?.message || 'Failed to generate thumbnail');
    } finally {
      setYtLoading(null);
    }
  }, [scenes, anchorImages, thumbnailModel]);

  // --- Chat send handler ---
  const handleChatSend = useCallback(
    async (message) => {
      if (!message.trim()) return;
      setChatMessages((prev) => [...prev, { role: 'user', content: message }]);
      setChatLoading(true);
      setError(null);
      try {
        console.log('[AI Reel Maker] Sending message...');
        if (!assistantChatRef.current) {
          assistantChatRef.current = await createAssistantChat();
          console.log('[AI Reel Maker] Chat created');
        }
        const chat = assistantChatRef.current;
        if (!chat) {
          setChatMessages((prev) => [...prev, { role: 'assistant', content: 'API key not configured. Add REACT_APP_GEMINI_API_KEY to .env' }]);
          return;
        }
        setChatMessages((prev) => [...prev, { role: 'assistant', content: '' }]);
        const onChunk = (text) => {
          setChatMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last?.role === 'assistant') next[next.length - 1] = { ...last, content: text };
            return next;
          });
        };
        const callbacks = {
          onScript: handleAssistantScript,
          onUpdateScene: handleChatUpdateScene,
          onTranslate: handleChatTranslate,
          onYouTubeTitle: handleChatYouTubeTitle,
          onYouTubeDescription: handleChatYouTubeDescription,
          onYouTubeThumbnail: handleChatYouTubeThumbnail,
        };
        await sendAssistantMessage(chat, message, callbacks, anchorImages, onChunk, scenes);
      } catch (err) {
        console.error('[AI Reel Maker] Error:', err);
        setChatMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.role === 'assistant' && last?.content === '') {
            next[next.length - 1] = { ...last, content: err?.message || 'Failed to get response' };
          } else {
            next.push({ role: 'assistant', content: err?.message || 'Failed to get response' });
          }
          return next;
        });
        setError(err?.message || 'Assistant error');
      } finally {
        setChatLoading(false);
      }
    },
    [handleAssistantScript, handleChatUpdateScene, handleChatTranslate, handleChatYouTubeTitle, handleChatYouTubeDescription, handleChatYouTubeThumbnail, anchorImages, scenes]
  );

  const handleAssemble = useCallback(async () => {
    const ready = scenes.filter((s) => s.imageBlob && s.audioBlob);
    if (ready.length !== scenes.length) {
      setError('Generate images and audio for all scenes first');
      return;
    }
    setAssembleProgress(0);
    setAssembleStatus({ currentScene: null, totalScenes: scenes.length });
    setError(null);
    try {
      const blob = await assembleVideo(
        scenes,
        (p, status) => {
          setAssembleProgress(p);
          if (status) setAssembleStatus(status);
        },
        { includeSubtitles }
      );
      setOutputBlob(blob);
      setAssembleProgress(1);
      setAssembleStatus({ currentScene: null, totalScenes: scenes.length });
    } catch (err) {
      setError(err?.message || 'Failed to assemble video');
      setAssembleProgress(null);
      setAssembleStatus({ currentScene: null, totalScenes: 0 });
    }
  }, [scenes, includeSubtitles]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-slate-100">AI Reel Maker</h1>
          <p className="text-slate-400 mt-1">Create videos from ideas with AI-generated scenes, images, and narration</p>
        </header>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-900/30 border border-red-700 text-red-200 text-sm">
            {error}
          </div>
        )}

        <section className="mb-8 p-6 rounded-xl bg-slate-800/50 border border-slate-700">
          <h2 className="text-lg font-semibold text-slate-200 mb-4">1. Movie Idea</h2>
          <MovieInput
            value={movieIdea}
            onChange={setMovieIdea}
            disabled={loading}
          />
          <div className="mt-6 pt-6 border-t border-slate-600">
            <h3 className="text-sm font-medium text-slate-300 mb-3">Anchor Images (optional)</h3>
            <AnchorImages anchorImages={anchorImages} onAnchorChange={handleAnchorChange} />
          </div>
          <div className="mt-6 pt-6 border-t border-slate-600">
            <button
              onClick={handleGenerateScenes}
              disabled={loading || !movieIdea.trim()}
              className="px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium transition-colors"
            >
              {loading ? <AnimatedDots prefix="Generating" /> : 'Generate Scenes'}
            </button>
          </div>
        </section>

        {scenes.length > 0 && (
          <>
            <section className="mb-8 p-6 rounded-xl bg-slate-800/50 border border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-200">2. Edit Scenes</h2>
                <div className="flex items-center gap-3">
                  {batchGenerating && (
                    <span className="text-sm text-slate-400">
                      {batchProgress.phase} ({batchProgress.current}/{batchProgress.total})
                    </span>
                  )}
                  {batchGenerating && (
                    <button
                      onClick={handleStopGenerateAll}
                      className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium transition-colors flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 0 11-18 0 9 9 0 0118 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                      </svg>
                      Stop
                    </button>
                  )}
                  <button
                    onClick={handleGenerateAll}
                    disabled={batchGenerating || generatingIndex != null}
                    className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:from-slate-600 disabled:to-slate-600 disabled:cursor-not-allowed text-white text-sm font-medium transition-all flex items-center gap-2 shadow-lg shadow-purple-500/20"
                  >
                    <svg className={`w-4 h-4 ${batchGenerating ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {batchGenerating ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      )}
                    </svg>
                    {batchGenerating ? 'Generating...' : '⚡ Generate All Images & Audio'}
                  </button>
                </div>
              </div>
              <SceneEditor
                scenes={scenes}
                onUpdate={handleUpdateScene}
                imageModel={imageModel}
                onImageModelChange={setImageModel}
                voiceProvider={voiceProvider}
                onVoiceProviderChange={setVoiceProvider}
                voice={voice}
                onVoiceChange={setVoice}
                elevenLabsVoices={elevenLabsVoices}
                elevenLabsVoiceId={elevenLabsVoiceId}
                onElevenLabsVoiceChange={setElevenLabsVoiceId}
                onGenerateImage={handleGenerateImage}
                onGenerateAudio={handleGenerateAudio}
                generating={generatingIndex}
                sceneError={sceneError}
                openaiVoice={openaiVoice}
                onOpenaiVoiceChange={setOpenaiVoice}
                targetLanguage={targetLanguage}
                onTargetLanguageChange={setTargetLanguage}
                onTranslate={handleTranslate}
                translating={translating}
                showTranslated={showTranslated}
                onToggleTranslation={() => setShowTranslated(!showTranslated)}
                translatedNarrations={translatedNarrations}
              />
            </section>

            <section className="mb-8 p-6 rounded-xl bg-slate-800/50 border border-slate-700">
              <h2 className="text-lg font-semibold text-slate-200 mb-4">3. Video Generation</h2>
              <VideoAssembly
                onAssemble={handleAssemble}
                assembleProgress={assembleProgress}
                assembleStatus={assembleStatus}
                includeSubtitles={includeSubtitles}
                onIncludeSubtitlesChange={setIncludeSubtitles}
                outputBlob={outputBlob}
                projectName={projectName}
              />
            </section>

            <section className="mb-8 p-6 rounded-xl bg-slate-800/50 border border-slate-700">
              <h2 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
                <span className="text-red-500">▶</span> 4. YouTube Metadata
              </h2>
              <YouTubeMetadata
                ytTitle={ytTitle}
                ytDescription={ytDescription}
                ytThumbnail={ytThumbnail}
                onGenerateTitle={handleGenerateYTTitle}
                onGenerateDescription={handleGenerateYTDescription}
                onGenerateThumbnail={handleGenerateYTThumbnail}
                thumbnailModel={thumbnailModel}
                onThumbnailModelChange={setThumbnailModel}
                loading={ytLoading}
              />
            </section>
          </>
        )}
      </div>

      {chatOpen ? (
        <ChatAssistant
          messages={chatMessages}
          onSend={handleChatSend}
          loading={chatLoading}
          onClose={() => setChatOpen(false)}
          isOpen={true}
        />
      ) : (
        <button
          type="button"
          onClick={() => setChatOpen(true)}
          className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg flex items-center justify-center z-40 transition-colors"
          aria-label="Open assistant"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </button>
      )}
    </div>
  );
}

export default App;
