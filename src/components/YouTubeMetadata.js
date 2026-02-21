import React, { useState, useEffect } from 'react';
import { IMAGE_MODELS } from '../services/gemini';
import AnimatedDots from './AnimatedDots';

export default function YouTubeMetadata({
    ytTitle,
    ytDescription,
    ytThumbnail,
    onGenerateTitle,
    onGenerateDescription,
    onGenerateThumbnail,
    thumbnailModel,
    onThumbnailModelChange,
    loading,
}) {
    const [thumbnailUrl, setThumbnailUrl] = useState(null);

    useEffect(() => {
        if (ytThumbnail) {
            const url = URL.createObjectURL(ytThumbnail);
            setThumbnailUrl(url);
            return () => URL.revokeObjectURL(url);
        }
        setThumbnailUrl(null);
    }, [ytThumbnail]);

    return (
        <div className="space-y-6">
            {/* Title */}
            <div>
                <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-sm font-medium text-slate-300">YouTube Title</h3>
                    <button
                        onClick={onGenerateTitle}
                        disabled={loading}
                        className="text-xs px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium transition-colors"
                    >
                        {loading === 'title' ? <AnimatedDots prefix="Generating" /> : '✨ Generate Title'}
                    </button>
                </div>
                {ytTitle ? (
                    <div className="p-3 rounded-lg bg-slate-700/50 border border-slate-600 text-slate-200 text-sm">
                        {ytTitle}
                    </div>
                ) : (
                    <p className="text-slate-500 text-xs italic">No title generated yet. Click "Generate Title" or ask the chat assistant.</p>
                )}
            </div>

            {/* Description */}
            <div>
                <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-sm font-medium text-slate-300">YouTube Description</h3>
                    <button
                        onClick={onGenerateDescription}
                        disabled={loading}
                        className="text-xs px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium transition-colors"
                    >
                        {loading === 'description' ? <AnimatedDots prefix="Generating" /> : '✨ Generate Description'}
                    </button>
                </div>
                {ytDescription ? (
                    <div className="p-3 rounded-lg bg-slate-700/50 border border-slate-600 text-slate-200 text-sm whitespace-pre-wrap max-h-[200px] overflow-y-auto">
                        {ytDescription}
                    </div>
                ) : (
                    <p className="text-slate-500 text-xs italic">No description generated yet. Click "Generate Description" or ask the chat assistant.</p>
                )}
            </div>

            {/* Thumbnail */}
            <div>
                <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-sm font-medium text-slate-300">YouTube Thumbnail</h3>
                    <div className="flex items-center gap-2">
                        <select
                            value={thumbnailModel}
                            onChange={(e) => onThumbnailModelChange(e.target.value)}
                            className="px-2 py-1 rounded bg-slate-700 border border-slate-600 text-slate-200 text-xs"
                        >
                            {IMAGE_MODELS.map((m) => (
                                <option key={m.id} value={m.id}>{m.label}</option>
                            ))}
                        </select>
                        <button
                            onClick={onGenerateThumbnail}
                            disabled={loading}
                            className="text-xs px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium transition-colors"
                        >
                            {loading === 'thumbnail' ? <AnimatedDots prefix="Generating" /> : '🖼️ Generate Thumbnail'}
                        </button>
                    </div>
                </div>
                {thumbnailUrl ? (
                    <div className="mt-2">
                        <img src={thumbnailUrl} alt="YouTube Thumbnail" className="max-w-md rounded-lg border border-slate-600 shadow-lg" />
                    </div>
                ) : (
                    <p className="text-slate-500 text-xs italic">No thumbnail generated yet. Click "Generate Thumbnail" or ask the chat assistant.</p>
                )}
            </div>
        </div>
    );
}
