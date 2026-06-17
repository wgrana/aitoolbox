# AI Pen Testing Workbench

Work-in-progress demo app for AI security testing.

Current tool:

- **AI Resume Screener**: grades a submitted resume against a job description and gives hiring guidance.

The demo is used to show prompt injection techniques, where system prompt hardening helps, where it is not enough, and how a third-party guardrails provider can inspect prompts and responses outside the model.

## Run With Docker Compose

Create `.env`:

```env
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4.1-mini

AI_GUARD_API_BASE_URL=https://api.zseclipse.net
AI_GUARD_API_KEY=
AI_GUARD_POLICY_ID=
```

Create `docker-compose.yml`:

```yaml
services:
  aitoolbox:
    image: ghcr.io/wgrana/aitoolbox:latest
    container_name: aitoolbox
    ports:
      - "3002:3000"
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
http://localhost:3002
```

## Local Development

```bash
cp .env.example .env
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

## Notes

- `OPENAI_BASE_URL` can point to OpenAI, LiteLLM, or another OpenAI-compatible endpoint.
- The app does not generate fake AI evaluation results if the provider is not configured.
- Do not commit `.env`.
- This is not a real hiring system.

## Tests

```bash
npm test
```
