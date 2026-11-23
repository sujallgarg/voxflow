# VoxFlow Agent Authentication & API Guide

Welcome to the VoxFlow agent access guide. AI agents and automated clients can authenticate with VoxFlow APIs using standard OAuth 2.0 / OpenID Connect Bearer tokens.

## 1. Authentication Endpoints
- **Issuer / Authorization Server**: `https://tpiipkjfebudtdxitigx.supabase.co/auth/v1`
- **Protected Resource**: `https://voxflowai.devs.surf/api`
- **OIDC Discovery**: `https://voxflowai.devs.surf/.well-known/openid-configuration`
- **OAuth Authorization Server**: `https://voxflowai.devs.surf/.well-known/oauth-authorization-server`
- **OAuth Protected Resource**: `https://voxflowai.devs.surf/.well-known/oauth-protected-resource`

## 2. Obtaining Tokens
Agents obtain a Bearer token by registering or authenticating via the standard Supabase Auth endpoints:
```http
POST https://tpiipkjfebudtdxitigx.supabase.co/auth/v1/token?grant_type=password
Content-Type: application/json
apikey: <SUPABASE_ANON_KEY>

{
  "email": "agent@example.com",
  "password": "<SECRET>"
}
```

## 3. Invoking Protected APIs
Pass the resulting JWT in the `Authorization` header:
```http
POST https://voxflow-u7h3.onrender.com/meeting-notes
Authorization: Bearer <ACCESS_TOKEN>
Content-Type: application/json

{
  "transcript": "Meeting discussion text...",
  "title": "Sprint Planning"
}
```

## 4. Supported Scopes
- `voice:transcribe`: Transcribe audio recordings to text
- `voice:type`: Run real-time voice typing transformations
- `meetings:read`: Access historical meeting notes and summaries
- `meetings:write`: Save or update meeting records
- `meetings:summarize`: Generate AI summaries and action items
