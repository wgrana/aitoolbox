# AI Resume Screener: Prompt Injection Demo

Local-first security demo showing how prompt injection inside an untrusted resume can manipulate an AI-assisted screening workflow.

## Main Thesis

The security boundary is not the prompt. The model can evaluate, but the application and runtime guardrails must authorize and enforce.

## Project Overview

The app demonstrates three maturity levels:

- Simple Mode: intentionally vulnerable, accepts model output without runtime guardrail inspection.
- Enhanced Prompt Mode: separates trusted instructions from untrusted resume content and reduces obvious failures, but remains prompt-only protection with no independent enforcement.
- AI Guard Mode: uses an external guardrail provider outside the model prompt. It requires AI Guard API environment variables and has no local simulation fallback.

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
  |      - external AI Guard API/proxy configuration is required
  |      - zscaler adapter placeholder is ready for real request/response mapping
  |
  +--> LLM adapter
  |      - OpenAI-compatible client
  |      - OPENAI_BASE_URL, OPENAI_API_KEY, OPENAI_MODEL
  |      - requires a configured API key
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

Set an OpenAI or OpenAI-compatible key before running evaluations. If `OPENAI_API_KEY` is empty, the app refuses to run the evaluation instead of creating simulated model results.

## Required Env Vars

```env
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4.1-mini
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

The UI may load without an API key, but `Run Evaluation` requires a connected OpenAI-compatible API. This keeps the results panels limited to real LLM output and guardrail decisions from the configured runtime.

## Demo Script

1. Load clean resume.
2. Run Simple Mode.
3. Observe a reasonable score and interview-style recommendation.
4. Load obvious injection resume.
5. Run Simple Mode.
6. Observe inflated or max score and strong interview behavior.
7. Switch to Enhanced Prompt Mode.
8. Run again.
9. Observe improved but prompt-only behavior. The model may report suspicious content, but the app has no external detector or enforcement point in this mode.
10. Switch to AI Guard Mode.
11. Run again.
12. If AI Guard env vars are missing, observe a controlled configuration block. With a real AI Guard API/proxy configured, observe external enforcement outside the model prompt.

## LiteLLM Migration

No code change should be required. Change only:

```env
OPENAI_BASE_URL=http://localhost:4000/v1
OPENAI_MODEL=openai/gpt-4.1-mini
OPENAI_API_KEY=<litellm-key>
```

## Zscaler AI Guard Integration Note

AI Guard Mode requires external API/proxy configuration and currently routes through:

```text
src/lib/guardrails/zscalerAiGuard.ts
```

The adapter uses DAS/API `execute-policy` with `policyId`, `direction`, and `content`. It reads `AI_GUARD_API_BASE_URL`, `AI_GUARD_API_KEY`, and `AI_GUARD_POLICY_ID`, blocks with a controlled configuration error when missing, and normalizes the AI Guard response for the UI.

The default DAS direction mapping is `IN` for request/prompt inspection and `OUT` for response/output inspection, matching the observed `execute-policy` enum behavior. If a tenant or future API contract differs, set `AI_GUARD_PROMPT_DIRECTION` and `AI_GUARD_RESPONSE_DIRECTION` in `.env`.

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

- Simple Mode final decision pass-through
- AI Guard configuration block/manual-review behavior
- Zod model output validation
- PDF upload rejection for non-PDF files
- PDF extraction error handling
