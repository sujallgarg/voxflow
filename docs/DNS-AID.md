# DNS for AI Discovery (DNS-AID) Configuration

This document specifies the DNS-AID records to publish in your DNS management console (e.g., Cloudflare, Route53, Namecheap) for `voxflowai.devs.surf`.

## 1. HTTPS / SVCB Service Records (RFC 9460 / DNS-AID Draft)

Add the following records under your domain zone:

### Primary Agent Index Record
- **Name:** `_index._agents.voxflowai.devs.surf`
- **Type:** `HTTPS` (or `SVCB`)
- **Priority / SvcPriority:** `1`
- **Target / TargetName:** `.` (or `voxflowai.devs.surf.`)
- **Parameters:**
  ```text
  alpn="h2,h3" port="443" uri="/.well-known/ai-catalog.json"
  ```

### Agent-to-Agent (A2A) / MCP Discovery Record
- **Name:** `_a2a._agents.voxflowai.devs.surf`
- **Type:** `HTTPS` (or `SVCB`)
- **Priority / SvcPriority:** `1`
- **Target / TargetName:** `.` (or `voxflowai.devs.surf.`)
- **Parameters:**
  ```text
  alpn="h2,h3" port="443" uri="/.well-known/mcp/server-card.json"
  ```

### Legacy TXT Fallback Record
For resolvers that do not yet query HTTPS/SVCB resource records:
- **Name:** `_agents.voxflowai.devs.surf`
- **Type:** `TXT`
- **Value:**
  ```text
  v=dnsaid1; catalog=https://voxflowai.devs.surf/.well-known/ai-catalog.json; mcp=https://voxflowai.devs.surf/.well-known/mcp/server-card.json
  ```

## 2. DNSSEC
Ensure **DNSSEC** is enabled in your DNS provider's dashboard so validating recursive resolvers return authenticated DNS data (`AD` flag).
