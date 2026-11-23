---
name: meeting-summarization
description: Extract structured meeting intelligence: executive summary, key discussion points, decisions, and action items from transcripts.
---

# VoxFlow Meeting Summarization Skill

Extracts structured executive meeting overviews from multi-speaker transcripts.

## Endpoint
- POST `https://voxflow-u7h3.onrender.com/meeting-notes`
- Content-Type: `application/json`
- Body: `{ "transcript": "...", "title": "Optional Title" }`

## Response
Returns JSON with `{ "title": "...", "summary": "...", "keyPoints": [...], "decisions": [...], "actionItems": [...], "topics": [...] }`.
