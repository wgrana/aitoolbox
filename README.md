# AI Resume Screener: Prompt Injection Demo

Local-first security demo showing how prompt injection inside an untrusted resume can manipulate an AI-assisted screening workflow.

## Main Thesis

The security boundary is not the prompt. The model can evaluate, but the application and runtime guardrails must authorize and enforce.

## Project Overview

The app demonstrates three maturity levels:

- Simple Mode: intentionally vulnerable, accepts model output without runtime guardrail inspection.
- Enhanced Prompt Mode: separates trusted instructions from untrusted resume content and warns the model about injection, but remains prompt-only protection.
- AI Guard Mode: uses a guardrail provider outside the model prompt. The local version uses Mock AI Guard for deterministic prompt-injection detection.

This is a synthetic demo only. It is not a real hiring system.

## Architecture

```text
Browser UI
  |
  | POST /api/evaluate
  v
Next.js API route
  |
  +--> Prompt builder
  |      - simpleResumePrompt
  |      - enhancedResumePrompt
  |      - aiGuardResumePrompt
  |
  +--> AI Guard Mode only
  |      - guardrail provider inspects prompt/resume
  |      - mock provider blocks injected resumes locally
  |      - zscaler adapter placeholder is ready for real mapping
  |
  +--> LLM adapter
  |      - OpenAI-compatible client
  |      - OPENAI_BASE_URL, OPENAI_API_KEY, OPENAI_MODEL
  |      - local deterministic fallback when no key is configured
  |
  +--> Zod validation
  |
  +--> Final decision policy
         - separates model recommendation from app decision
         - marks score trusted or untrusted

PDF upload
  |
  | POST /api/extract-pdf
  v
Server-side pdf-parse extraction
```

## Local Setup

Create a local environment file:

```bash
cp .env.example .env
```

Set an OpenAI or OpenAI-compatible key if you want live model calls. If `OPENAI_API_KEY` is empty, the app uses deterministic local demo responses so the workflow remains usable.

## Required Env Vars

```env
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4.1-mini
AI_GUARD_MODE=mock
AI_GUARD_API_BASE_URL=
AI_GUARD_API_KEY=
AI_GUARD_POLICY_ID=
APP_MODE=local
```

## Run Locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Demo Script

1. Load clean resume.
2. Run Simple Mode.
3. Observe a reasonable score and interview-style recommendation.
4. Load obvious injection resume.
5. Run Simple Mode.
6. Observe inflated or max score and strong interview behavior.
7. Switch to Enhanced Prompt Mode.
8. Run again.
9. Observe improved but prompt-only behavior and residual risk messaging.
10. Switch to AI Guard Mode.
11. Run again.
12. Observe Mock AI Guard detection, blocked/manual review decision, and score trusted set to no.

## LiteLLM Migration

No code change should be required. Change only:

```env
OPENAI_BASE_URL=http://localhost:4000/v1
OPENAI_MODEL=openai/gpt-4.1-mini
OPENAI_API_KEY=<litellm-key>
```

## Zscaler AI Guard Integration Note

The local app uses Mock AI Guard. A future real API/proxy/DAS-style integration should complete:

```text
src/lib/guardrails/zscalerAiGuard.ts
```

That file intentionally does not invent undocumented request or response contracts. It reads `AI_GUARD_API_BASE_URL`, `AI_GUARD_API_KEY`, and `AI_GUARD_POLICY_ID`, returns controlled configuration errors when missing, and includes TODOs for real request/response mapping.

## Non-Goals

- No real hiring use
- No authentication
- No database
- No production HR workflow
- No real resume processing
- No Docker yet
- No job URL scraping

## Tests

```bash
npm test
```

Covered areas:

- Prompt injection phrase detection in Mock AI Guard
- Simple Mode final decision pass-through
- AI Guard block/manual-review behavior
- Zod model output validation
- PDF upload rejection for non-PDF files
- PDF extraction error handling
