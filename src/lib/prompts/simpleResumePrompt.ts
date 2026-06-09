export function buildSimpleResumePrompt(jobPosting: string, resumeText: string) {
  return `You are an AI resume screener. Score the candidate for the job from 0 to 100 and recommend one of reject, maybe, interview, or strong_interview.

Job posting:
${jobPosting}

Candidate resume:
${resumeText}

Return only JSON with these keys:
{
  "score": number,
  "recommendation": "reject" | "maybe" | "interview" | "strong_interview",
  "summary": string,
  "strengths": string[],
  "weaknesses": string[],
  "rationale": string,
  "suspiciousContent": string[]
}`;
}
