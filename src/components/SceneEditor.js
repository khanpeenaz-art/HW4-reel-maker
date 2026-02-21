import React, { useState, useEffect } from 'react';
import { IMAGE_MODELS, GEMINI_TTS_VOICES, OPENAI_TTS_VOICES } from '../services/gemini';
import AnimatedDots from './AnimatedDots';
import TranslationSuite from './TranslationSuite';

function AudioPlayer({ blob }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    if (blob) {
      const u = URL.createObjectURL(blob);
      setUrl(u);
      return () => URL.revokeObjectURL(u);
    }
    setUrl(null);
  }, [blob]);
  if (!blob) return <span className="text-slate-500 text-xs">No audio</span>;
  if (!url) return <span className="text-slate-500 text-xs">Loading...</span>;
  return <audio src={url} controls className="w-48 h-8" />;
}

export default function SceneEditor({
  scenes,
  onUpdate,
  imageModel,
  onImageModelChange,
  voiceProvider,
  onVoiceProviderChange,
  voice,
  onVoiceChange,
  elevenLabsVoices,
  elevenLabsVoiceId,
  onElevenLabsVoiceChange,
  onGenerateImage,
  onGenerateAudio,
  generating,
  sceneError,
  openaiVoice,
  onOpenaiVoiceChange,
  // Translation props
  targetLanguage,
  onTargetLanguageChange,
  onTranslate,
  translating,
  showTranslated,
  onToggleTranslation,
  translatedNarrations,
}) {
  const isGenerating = generating !== null;
  const [enlargedImage, setEnlargedImage] = useState(null);
  const [enlargedUrl, setEnlargedUrl] = useState(null);
  const hasTranslation = translatedNarrations && translatedNarrations.length > 0;

  useEffect(() => {
    if (enlargedImage) {
      const url = URL.createObjectURL(enlargedImage);
      setEnlargedUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setEnlargedUrl(null);
  }, [enlargedImage]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead>
          <tr className="border-b border-slate-600 text-slate-400">
            <th className="py-3 px-2">#</th>
            <th className="py-3 px-2">Description</th>
            <th className="py-3 px-2">
              Narration
              {showTranslated && hasTranslation && (
                <span className="ml-2 text-xs text-blue-400 font-normal">🌐 Translated</span>
              )}
            </th>
            <th className="py-3 px-2">Image</th>
            <th className="py-3 px-2">Audio</th>
          </tr>
        </thead>
        <tbody>
          {scenes.map((scene, i) => {
            const narrationValue = showTranslated && hasTranslation && translatedNarrations[i]
              ? translatedNarrations[i]
              : scene.narration;
            return (
              <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-800/30">
                <td className="py-2 px-2 text-slate-500">{scene.sceneNumber}</td>
                <td className="py-2 px-2">
                  <textarea
                    value={scene.description}
                    onChange={(e) => onUpdate(i, 'description', e.target.value)}
                    className="w-full min-w-[200px] px-2 py-1 rounded bg-slate-800 border border-slate-600 text-slate-200 text-xs resize-y min-h-[80px]"
                    rows={4}
                  />
                </td>
                <td className="py-2 px-2">
                  <textarea
                    value={narrationValue}
                    onChange={(e) => onUpdate(i, 'narration', e.target.value)}
                    className={`w-full min-w-[200px] px-2 py-1 rounded border text-xs resize-y min-h-[80px] ${showTranslated && hasTranslation
                        ? 'bg-blue-900/30 border-blue-600/50 text-blue-200'
                        : 'bg-slate-800 border-slate-600 text-slate-200'
                      }`}
                    rows={4}
                    readOnly={showTranslated && hasTranslation}
                  />
                </td>
                <td className="py-2 px-2">
                  <div className="space-y-1">
                    {scene.imageBlob ? (
                      <button
                        type="button"
                        onClick={() => setEnlargedImage(scene.imageBlob)}
                        className="block w-full text-left"
                      >
                        <img src={URL.createObjectURL(scene.imageBlob)} alt="" className="w-32 h-32 object-cover rounded cursor-pointer hover:opacity-90 transition-opacity" />
                      </button>
                    ) : (
                      <div className="w-32 h-32 rounded bg-slate-700 flex items-center justify-center text-slate-500 text-xs">No image</div>
                    )}
                    <button
                      onClick={() => onGenerateImage(i)}
                      disabled={isGenerating}
                      className="text-xs px-2 py-1 rounded bg-slate-600 hover:bg-slate-500 disabled:opacity-50"
                    >
                      {generating === i ? <AnimatedDots prefix="Generating" /> : 'Generate'}
                    </button>
                    {sceneError?.index === i && sceneError?.type === 'image' && (
                      <div className="mt-1 p-1.5 rounded bg-red-900/40 border border-red-700/50 text-red-300 text-xs max-w-[200px] break-words">
                        ⚠️ {sceneError.message}
                      </div>
                    )}
                  </div>
                </td>
                <td className="py-2 px-2">
                  <div className="space-y-1">
                    <AudioPlayer blob={scene.audioBlob} />
                    <button
                      onClick={() => onGenerateAudio(i)}
                      disabled={isGenerating}
                      className="text-xs px-2 py-1 rounded bg-slate-600 hover:bg-slate-500 disabled:opacity-50 block"
                    >
                      {generating === i ? <AnimatedDots prefix="Generating" /> : 'Generate'}
                    </button>
                    {sceneError?.index === i && sceneError?.type === 'audio' && (
                      <div className="mt-1 p-1.5 rounded bg-red-900/40 border border-red-700/50 text-red-300 text-xs max-w-[200px] break-words">
                        ⚠️ {sceneError.message}
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {enlargedImage && enlargedUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setEnlargedImage(null)}
        >
          <button type="button" className="absolute top-4 right-4 text-white text-2xl hover:opacity-80" onClick={() => setEnlargedImage(null)} aria-label="Close">
            ×
          </button>
          <img src={enlargedUrl} alt="" className="max-w-[90vw] max-h-[90vh] object-contain rounded" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 text-sm">Image model:</span>
          <select
            value={imageModel}
            onChange={(e) => onImageModelChange(e.target.value)}
            className="px-2 py-1 rounded bg-slate-700 border border-slate-600 text-slate-200 text-sm"
          >
            {IMAGE_MODELS.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-400 text-sm">Voice model:</span>
          <select
            value={voiceProvider}
            onChange={(e) => onVoiceProviderChange(e.target.value)}
            className="px-2 py-1 rounded bg-slate-700 border border-slate-600 text-slate-200 text-sm"
          >
            <option value="gemini">Gemini</option>
            <option value="openai">OpenAI</option>
            <option value="elevenlabs">ElevenLabs</option>
          </select>
          {voiceProvider === 'gemini' && (
            <select
              value={voice}
              onChange={(e) => onVoiceChange(e.target.value)}
              className="px-2 py-1 rounded bg-slate-700 border border-slate-600 text-slate-200 text-sm min-w-[220px]"
              title={GEMINI_TTS_VOICES.find((v) => v.id === voice)?.tone}
            >
              {GEMINI_TTS_VOICES.map((v) => (
                <option key={v.id} value={v.id} title={`${v.tone} (${v.gender})`}>
                  {v.name} — {v.tone} ({v.gender})
                </option>
              ))}
            </select>
          )}
          {voiceProvider === 'openai' && (
            <select
              value={openaiVoice}
              onChange={(e) => onOpenaiVoiceChange?.(e.target.value)}
              className="px-2 py-1 rounded bg-slate-700 border border-slate-600 text-slate-200 text-sm min-w-[220px]"
              title={OPENAI_TTS_VOICES.find((v) => v.id === openaiVoice)?.tone}
            >
              {OPENAI_TTS_VOICES.map((v) => (
                <option key={v.id} value={v.id} title={`${v.tone} (${v.gender})`}>
                  {v.name} — {v.tone} ({v.gender})
                </option>
              ))}
            </select>
          )}
          {voiceProvider === 'elevenlabs' && (
            <select
              value={elevenLabsVoiceId}
              onChange={(e) => onElevenLabsVoiceChange?.(e.target.value)}
              className="px-2 py-1 rounded bg-slate-700 border border-slate-600 text-slate-200 text-sm min-w-[200px]"
              disabled={!elevenLabsVoices?.length}
            >
              {!elevenLabsVoices?.length ? (
                <option value="">Loading voices...</option>
              ) : (
                elevenLabsVoices.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))
              )}
            </select>
          )}
        </div>
      </div>
      {/* Translation Suite */}
      <TranslationSuite
        targetLanguage={targetLanguage}
        onTargetLanguageChange={onTargetLanguageChange}
        onTranslate={onTranslate}
        translating={translating}
        showTranslated={showTranslated}
        onToggleTranslation={onToggleTranslation}
        hasTranslation={hasTranslation}
      />
    </div>
  );
}
