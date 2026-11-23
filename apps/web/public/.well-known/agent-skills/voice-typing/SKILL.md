---
name: voice-typing
description: Convert speech or recorded audio into clean, punctuated text with automatic language detection and context styling.
---

# VoxFlow Voice Typing Skill

Exposes speech-to-text transcription and context-aware voice transformations.

## Endpoint
- POST `https://voxflow-u7h3.onrender.com/transcribe`
- Content-Type: `multipart/form-data`
- Field: `file` (audio/webm, audio/mp4, audio/wav, max 25MB)

## Response
Returns JSON with `{ "text": "Transcribed text...", "durationSeconds": 15 }`.
