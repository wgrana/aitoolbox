# AI Pen Testing Workbench

Security testing labs for real-world AI workflows.

AI Pen Testing Workbench is a local-first demo application for showing how modern AI features can fail when untrusted content is allowed to influence privileged model workflows. The project is designed for live demos, screen recordings, and customer-facing conversations about AI security controls.

The first implemented lab is **AI Resume Screener**, a prompt injection and guardrail enforcement demo. Additional labs are represented in the UI as future work:

- Public Support Bot
- Data Loss Simulator
- RAG Poisoning Lab
- Multimodal Lab
- Guardrails Sandbox

## Main Thesis

The security boundary is not the prompt. The model can evaluate, summarize, classify, and recommend, but the application and runtime guardrails must authorize and enforce.

## Current Lab: AI Resume Screener

The Resume Screener lab demonstrates how untrusted candidate-controlled resume content can manipulate or contaminate an AI-assisted evaluation workflow.

It includes three maturity levels:

- **Simple Mode**: intentionally vulnerable. It trusts model output without runtime guardrail inspection.
- **Enhanced Prompt Mode**: separates trusted job/rubric instructions from untrusted resume content. It improves behavior but remains prompt-only protection.
- **AI Guard Mode**: sends untrusted content and model responses through an external guardrail provider before trusting the result.

The lab supports:

- pasted resume text
- server-side PDF text extraction
- synthetic clean and malicious resume samples
- prompt injection score manipulation
- malicious URL/reference material demos
- model output vs final application decision separation
- raw prompt/model/guardrail visibility for demo narration

This is a synthetic security demo. It is not a real hiring system or production HR workflow.

## Architecture

```text
Browser UI
  |
  | POST /api/evaluate
  v
Next.js API route
  |
  +--> Prompt builders
  |      - Simple Mode
  |      - Enhanced Prompt Mode
  |      - AI Guard Mode
  |
  +--> AI Guard Mode
  |      - prompt stage inspects untrusted resume content
  |      - response stage inspects raw model output when configured
  |      - Zscaler AI Guard DAS/API adapter normalizes policy results
  |
  +--> OpenAI-compatible LLM adapter
  |      - OPENAI_BASE_URL
  |      - OPENAI_API_KEY
  |      - OPENAI_MODEL
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
Server-side PDF text extraction
```

## Local Setup

Create a local environment file:

```bash
cp .env.example .env
```

Set an OpenAI or OpenAI-compatible key before running evaluations. If `OPENAI_API_KEY` is empty, the app refuses to run an evaluation instead of creating fake results.

## Required Env Vars

```env
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4.1-mini

AI_GUARD_API_BASE_URL=https://api.zseclipse.net
AI_GUARD_API_KEY=
AI_GUARD_POLICY_ID=
AI_GUARD_PROMPT_DIRECTION=IN
AI_GUARD_RESPONSE_DIRECTION=OUT

APP_MODE=local
```

Secrets belong in `.env` or deployment environment variables. Do not commit `.env`.

## Run Locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

For the local demo port used during development:

```bash
npm run dev -- -H 0.0.0.0 -p 3002
```

Open http://localhost:3002.

## Demo Script

1. Load the clean resume.
2. Run Simple Mode.
3. Observe a realistic medium/low match.
4. Load an obvious injection resume.
5. Run Simple Mode.
6. Observe the model being steered into an inflated or max score.
7. Switch to Enhanced Prompt Mode.
8. Run again.
9. Observe better prompt behavior, while noting it is still prompt-only defense.
10. Load the malicious URL resume.
11. Run Simple or Enhanced Mode.
12. Observe the candidate-supplied URL surfaced in model output as reference material.
13. Switch to AI Guard Mode.
14. Run malicious samples with a real guardrail policy configured.
15. Observe whether enforcement happens before the LLM call, after the LLM response, or not at all depending on configured detectors.

## LiteLLM Migration

No code change should be required. Change only environment variables:

```env
OPENAI_BASE_URL=http://localhost:4000/v1
OPENAI_MODEL=openai/gpt-4.1-mini
OPENAI_API_KEY=<litellm-key>
```

## Zscaler AI Guard Integration

AI Guard Mode routes through:

```text
src/lib/guardrails/zscalerAiGuard.ts
```

The adapter uses DAS/API `execute-policy` with `policyId`, `direction`, and `content`. It reads:

- `AI_GUARD_API_BASE_URL`
- `AI_GUARD_API_KEY`
- `AI_GUARD_POLICY_ID`
- `AI_GUARD_PROMPT_DIRECTION`
- `AI_GUARD_RESPONSE_DIRECTION`

Default direction mapping:

- `IN`: request/prompt inspection
- `OUT`: response/output inspection

If no detectors are configured for a direction, the app reports that direction as `not_inspected` instead of pretending enforcement occurred.

## Deployment Direction

The intended deployment model is:

```text
GitHub repo
  |
  v
Docker image build
  |
  v
Container registry
  |
  v
docker compose pull && docker compose up -d
```

Secrets should be supplied by Docker Compose `.env` files, host environment variables, or a secret manager. They should not be baked into the image.

Docker files are not currently included. That is a planned next step.

## Non-Goals

- No real hiring use
- No authentication
- No database
- No production HR workflow
- No real resume decisioning
- No job URL scraping
- No Docker image yet

## Tests

```bash
npm test
```

Covered areas:

- Simple Mode final decision pass-through
- AI Guard behavior with configured and missing detectors
- Zod model output validation
- PDF upload rejection for non-PDF files
- PDF extraction error handling
