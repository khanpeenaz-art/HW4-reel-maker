import React from 'react';
import AnimatedDots from './AnimatedDots';

// Languages from all human-inhabited continents
const LANGUAGES = [
    // North America
    { value: 'English', label: 'English', continent: 'North America' },
    { value: 'Spanish', label: 'Spanish (Latin America)', continent: 'North America' },
    { value: 'French', label: 'French (Canada)', continent: 'North America' },
    { value: 'Nahuatl', label: 'Nahuatl', continent: 'North America' },
    // South America
    { value: 'Portuguese', label: 'Portuguese (Brazil)', continent: 'South America' },
    { value: 'Quechua', label: 'Quechua', continent: 'South America' },
    { value: 'Guarani', label: 'Guaraní', continent: 'South America' },
    // Europe
    { value: 'French', label: 'French', continent: 'Europe' },
    { value: 'German', label: 'German', continent: 'Europe' },
    { value: 'Italian', label: 'Italian', continent: 'Europe' },
    { value: 'Russian', label: 'Russian', continent: 'Europe' },
    { value: 'Polish', label: 'Polish', continent: 'Europe' },
    { value: 'Dutch', label: 'Dutch', continent: 'Europe' },
    { value: 'Greek', label: 'Greek', continent: 'Europe' },
    // Africa
    { value: 'Swahili', label: 'Swahili', continent: 'Africa' },
    { value: 'Amharic', label: 'Amharic', continent: 'Africa' },
    { value: 'Yoruba', label: 'Yoruba', continent: 'Africa' },
    { value: 'Zulu', label: 'Zulu', continent: 'Africa' },
    { value: 'Arabic', label: 'Arabic', continent: 'Africa' },
    { value: 'Hausa', label: 'Hausa', continent: 'Africa' },
    // Asia
    { value: 'Hindi', label: 'Hindi', continent: 'Asia' },
    { value: 'Mandarin Chinese', label: 'Mandarin Chinese', continent: 'Asia' },
    { value: 'Japanese', label: 'Japanese', continent: 'Asia' },
    { value: 'Korean', label: 'Korean', continent: 'Asia' },
    { value: 'Thai', label: 'Thai', continent: 'Asia' },
    { value: 'Vietnamese', label: 'Vietnamese', continent: 'Asia' },
    { value: 'Indonesian', label: 'Indonesian', continent: 'Asia' },
    { value: 'Turkish', label: 'Turkish', continent: 'Asia' },
    { value: 'Tamil', label: 'Tamil', continent: 'Asia' },
    { value: 'Urdu', label: 'Urdu', continent: 'Asia' },
    // Oceania / Australia
    { value: 'Maori', label: 'Māori', continent: 'Oceania' },
    { value: 'Samoan', label: 'Samoan', continent: 'Oceania' },
    { value: 'Fijian', label: 'Fijian', continent: 'Oceania' },
    { value: 'Tongan', label: 'Tongan', continent: 'Oceania' },
];

// Deduplicate by value (French appears twice)
const uniqueLanguages = [];
const seen = new Set();
for (const lang of LANGUAGES) {
    if (!seen.has(lang.value)) {
        seen.add(lang.value);
        uniqueLanguages.push(lang);
    }
}

// Group by continent for optgroup display
const continentOrder = ['North America', 'South America', 'Europe', 'Africa', 'Asia', 'Oceania'];
const grouped = {};
for (const lang of LANGUAGES) {
    if (!grouped[lang.continent]) grouped[lang.continent] = [];
    // Avoid duplicate within the same continent
    if (!grouped[lang.continent].find(l => l.value === lang.value)) {
        grouped[lang.continent].push(lang);
    }
}

export default function TranslationSuite({
    targetLanguage,
    onTargetLanguageChange,
    onTranslate,
    translating,
    showTranslated,
    onToggleTranslation,
    hasTranslation,
}) {
    return (
        <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-slate-700">
            <span className="text-slate-400 text-sm">🌐 Translate:</span>
            <select
                value={targetLanguage}
                onChange={(e) => onTargetLanguageChange(e.target.value)}
                className="px-2 py-1 rounded bg-slate-700 border border-slate-600 text-slate-200 text-sm min-w-[160px]"
            >
                {continentOrder.map((continent) => (
                    <optgroup key={continent} label={`── ${continent} ──`}>
                        {(grouped[continent] || []).map((lang) => (
                            <option key={`${continent}-${lang.value}`} value={lang.value}>
                                {lang.label}
                            </option>
                        ))}
                    </optgroup>
                ))}
            </select>
            <button
                onClick={onTranslate}
                disabled={translating}
                className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium transition-colors"
            >
                {translating ? <AnimatedDots prefix="Translating" /> : 'Translate All'}
            </button>
            {hasTranslation && (
                <button
                    onClick={onToggleTranslation}
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${showTranslated
                            ? 'bg-blue-500 text-white hover:bg-blue-400'
                            : 'bg-slate-600 text-slate-200 hover:bg-slate-500'
                        }`}
                >
                    {showTranslated ? '🔄 Show Original' : '🌐 Show Translated'}
                </button>
            )}
        </div>
    );
}
