# AI Pen Testing Workbench

Work-in-progress demo app for AI security testing.

Current tools:

- **AI Resume Screener**: grades a submitted resume against a job description and gives hiring guidance.
- **Public Support Bot**: bank-style support chat used to demo risky customer-facing AI behavior and guardrail inspection.

The demo is used to show prompt injection techniques, where system prompt hardening helps, where it is not enough, and how a third-party guardrails provider can inspect prompts and responses outside the model.

## Screenshot

![AI Pen Testing Workbench screenshot](public/ai-pen-testing-workbench-screenshot.png)

## Run With Docker Compose

Create `.env`:

```env
OPENAI_API_KEY=<openai-or-compatible-api-key>
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4.1-mini

AI_GUARD_API_BASE_URL=https://api.zseclipse.net
AI_GUARD_API_KEY=<zscaler-ai-guard-api-key>
AI_GUARD_POLICY_ID=<zscaler-ai-guard-policy-id>
```

Create `docker-compose.yml`:

```yaml
services:
  aitoolbox:
    image: ghcr.io/wgrana/aitoolbox:latest
    container_name: aitoolbox
    ports:
      - "80:3000"
    env_file:
      - .env
    restart: unless-stopped
```

Start or update:

```bash
docker compose pull
docker compose up -d
```

Open:

```text
http://localhost
```

## Tests

```bash
npm test
```
