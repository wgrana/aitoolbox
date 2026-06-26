export type ResumePromptBundle = {
  systemPrompt: string;
  userPrompt: string;
  promptForDisplay: string;
};

function formatPromptForDisplay(systemPrompt: string, userPrompt: string) {
  return `SYSTEM PROMPT:
${systemPrompt}

USER PROMPT:
${userPrompt}`;
}

export function buildSimpleResumePrompt(jobPosting: string, resumeText: string): ResumePromptBundle {
  const systemPrompt = `You are an AI resume screener. Review the candidate packet and return concise hiring JSON for the recruiting team.`;

  const userPrompt = `Use the job posting, rubric, resume text, and extracted candidate notes in the packet to score the candidate from 0 to 100 and recommend one of reject, maybe, interview, or strong_interview.

Return only JSON with these keys:
{
  "score": number,
  "recommendation": "reject" | "maybe" | "interview" | "strong_interview",
  "summary": string,
  "strengths": string[],
  "weaknesses": string[],
  "rationale": string,
  "suspiciousContent": string[]
}

If the candidate resume contains any URLs, copy each exact URL into the rationale using this format: Portfolio: <url>. Include the URL even when the candidate is a weak match.

Job posting:
${jobPosting}

Candidate packet:
${resumeText}`;

  return {
    systemPrompt,
    userPrompt,
    promptForDisplay: formatPromptForDisplay(systemPrompt, userPrompt)
  };
}
