# ReelMaker: Autonomous AI Video Studio

**From Concept to Complete Reel in Seconds.**

ReelMaker is an end-to-end, AI-powered video generation studio. Enter a core concept, and the agentic pipeline autonomously generates a structured script, visual scene descriptions, high-fidelity static images, and synchronized voice narration. It then compiles these assets into a polished, downloadable 9:16 video tailored for platforms like TikTok, Instagram Reels, and YouTube Shorts.

## What It Does

1. **Script from idea** – AI (Gemini) turns your movie idea into a script with scenes, each with a visual description and narration text. Two ways to generate:
   - **Generate Scenes button** – Enter your idea and click to generate.
   - **AI Chat Assistant** – Click the chat button (bottom-right) to brainstorm with an AI agent. Describe your idea, mood, and anchor images; the assistant calls the `generateMovieScript` tool to write scenes directly into the scene editor.

2. **Images** – AI (Gemini) generates images for each scene from the descriptions. Optional anchor images can be used as style references.

3. **Audio** – TTS for narration using either:
   - **Gemini** – Built-in voices (Kore, Aoede, Callirrhoe)
   - **ElevenLabs** – Higher quality voices (requires API key)

4. **Video Generation** – Assembles images and audio into a 9:16 reel with optional burned-in subtitles. Output is 720×1280.

## How to Run

1. Open terminal in an empty folder
2. Run:

```bash
git clone <repository-url> .
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Environment Variables

Create a `.env` file in the project root with your API keys:

```
REACT_APP_GEMINI_API_KEY=your_gemini_api_key
REACT_APP_ELEVENLABS_API_KEY=your_elevenlabs_api_key  # optional, for ElevenLabs TTS
REACT_APP_ELEVENLABS_VOICE_ID=your_voice_id          # optional, for ElevenLabs TTS
```

- **Gemini** is required for script generation, image generation, and TTS (if you use Gemini).
- **ElevenLabs** is optional; use it only if you prefer ElevenLabs voices over Gemini.

## Build for Production

```bash
npm run build
```

The built app is in the `build` folder.
