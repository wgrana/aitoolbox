"use client";

import {
  AlertTriangle,
  BadgeCheck,
  Ban,
  FileText,
  Gauge,
  RotateCcw,
  ShieldCheck,
  Upload,
  XCircle
} from "lucide-react";
import { useMemo, useState } from "react";
import { cleanResume } from "@/data/cleanResume";
import { defaultJobPosting } from "@/data/defaultJobPosting";
import { hiddenStyleInjectionResume } from "@/data/hiddenStyleInjectionResume";
import { obviousInjectionResume } from "@/data/obviousInjectionResume";
import { subtleInjectionResume } from "@/data/subtleInjectionResume";
import type { EvaluateResponse, EvaluationMode } from "@/lib/types";

const tabs = [
  "Resume Screener",
  "Vendor Risk Review",
  "RAG Document Poisoning",
  "AI Agent Tool Abuse"
];

const modes: Array<{
  id: EvaluationMode;
  title: string;
  badge: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    id: "simple",
    title: "Simple Mode",
    badge: "Vulnerable",
    description: "Basic LLM evaluator. Vulnerable by design.",
    icon: AlertTriangle
  },
  {
    id: "enhanced",
    title: "Enhanced Prompt Mode",
    badge: "Prompt-hardened",
    description: "Uses stronger system instructions, but still relies on the model following them.",
    icon: BadgeCheck
  },
  {
    id: "ai_guard",
    title: "AI Guard Mode",
    badge: "Runtime enforcement",
    description: "Adds prompt/response inspection outside the model prompt.",
    icon: ShieldCheck
  }
];

function Pill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "good" | "warn" | "bad" }) {
  const toneClass = {
    neutral: "border-slate-200 bg-slate-50 text-slate-700",
    good: "border-emerald-200 bg-emerald-50 text-emerald-800",
    warn: "border-amber-200 bg-amber-50 text-amber-800",
    bad: "border-red-200 bg-red-50 text-red-800"
  }[tone];

  return <span className={`inline-flex items-center rounded border px-2 py-1 text-xs font-semibold ${toneClass}`}>{children}</span>;
}

function Section({
  title,
  children,
  action
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-line bg-panel shadow-soft">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="text-sm font-bold text-ink">{title}</h2>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function ResultPanel({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="rounded-lg border border-line bg-white">
      <summary className="cursor-pointer select-none px-4 py-3 text-sm font-bold text-ink">{title}</summary>
      <div className="border-t border-line p-4">{children}</div>
    </details>
  );
}

function toneForAction(action?: string) {
  if (action === "blocked") return "bad";
  if (action === "flagged") return "warn";
  if (action === "allowed") return "good";
  return "neutral";
}

export function ResumeScreenerApp() {
  const [jobPosting, setJobPosting] = useState(defaultJobPosting);
  const [jobOpen, setJobOpen] = useState(false);
  const [resumeText, setResumeText] = useState(cleanResume);
  const [mode, setMode] = useState<EvaluationMode>("simple");
  const [result, setResult] = useState<EvaluateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfMeta, setPdfMeta] = useState<string | null>(null);

  const guardLabel = useMemo(() => {
    if (!result?.guardrailResult || result.guardrailResult.provider === "none") return "Provider: none";
    return result.guardrailResult.provider === "mock"
      ? "Mock AI Guard - local simulation"
      : "Zscaler AI Guard - API mode";
  }, [result]);

  async function runEvaluation() {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobPosting, resumeText, mode })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Evaluation failed.");
      }

      setResult(data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Evaluation failed.");
    } finally {
      setLoading(false);
    }
  }

  async function uploadPdf(file?: File) {
    if (!file) return;
    setUploading(true);
    setError(null);
    setPdfMeta(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/extract-pdf", {
        method: "POST",
        body: formData
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "PDF extraction failed.");
      }

      setResumeText(data.text);
      setPdfMeta(`${data.metadata?.fileName ?? "PDF"} · ${data.metadata?.pageCount ?? "?"} pages · ${Math.round((data.metadata?.sizeBytes ?? 0) / 1024)} KB`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "PDF extraction failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <main className="min-h-screen bg-wash">
      <header className="border-b border-line bg-white">
        <div className="mx-auto max-w-[1440px] px-6 py-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-normal text-ink">AI Resume Screener</h1>
              <p className="mt-1 text-sm text-muted">Prompt injection demo: untrusted content influencing privileged decisions</p>
            </div>
            <Pill tone="warn">Synthetic demo only. Not a real hiring system.</Pill>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1440px] px-6 py-4">
        <nav className="flex gap-2 border-b border-line">
          {tabs.map((tab, index) => (
            <button
              key={tab}
              disabled={index !== 0}
              className={`px-4 py-3 text-sm font-semibold ${
                index === 0
                  ? "border-b-2 border-teal text-teal"
                  : "cursor-not-allowed text-slate-400"
              }`}
              title={index === 0 ? tab : "Coming soon"}
            >
              {tab}
            </button>
          ))}
        </nav>

        <div className="grid grid-cols-1 gap-5 py-5 xl:grid-cols-[minmax(420px,0.9fr)_minmax(620px,1.1fr)]">
          <div className="space-y-5">
            <Section
              title="Job Posting"
              action={
                <button
                  className="inline-flex items-center gap-2 rounded-md border border-line px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  onClick={() => setJobPosting(defaultJobPosting)}
                >
                  <RotateCcw className="h-4 w-4" />
                  Reset job posting
                </button>
              }
            >
              <div className="rounded-md border border-line bg-slate-50 p-3">
                <div className="text-sm font-bold text-ink">ML Infrastructure Engineer, Safeguards</div>
                <a
                  href="https://job-boards.greenhouse.io/anthropic/jobs/4778843008"
                  className="mt-1 block text-xs font-semibold text-teal underline-offset-2 hover:underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  Reference posting
                </a>
              </div>
              <button
                className="mt-3 text-sm font-semibold text-teal"
                onClick={() => setJobOpen((value) => !value)}
              >
                {jobOpen ? "Hide job posting editor" : "Edit job posting"}
              </button>
              {jobOpen ? (
                <textarea
                  className="mt-3 min-h-[260px] w-full rounded-md border border-line bg-white p-3 text-sm leading-6 outline-none focus:border-teal"
                  value={jobPosting}
                  onChange={(event) => setJobPosting(event.target.value)}
                />
              ) : null}
            </Section>

            <Section title="Resume Input">
              <div className="flex flex-wrap gap-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                  <Upload className="h-4 w-4" />
                  {uploading ? "Extracting PDF..." : "Upload PDF"}
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    className="hidden"
                    onChange={(event) => uploadPdf(event.target.files?.[0])}
                  />
                </label>
                {pdfMeta ? <Pill>{pdfMeta}</Pill> : null}
              </div>
              <textarea
                className="mt-3 min-h-[420px] w-full rounded-md border border-line bg-white p-3 text-sm leading-6 outline-none focus:border-teal"
                value={resumeText}
                onChange={(event) => setResumeText(event.target.value)}
                placeholder="Paste resume text here"
              />
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button className="rounded-md border border-line px-3 py-2 text-sm font-semibold hover:bg-slate-50" onClick={() => setResumeText(cleanResume)}>Load clean resume</button>
                <button className="rounded-md border border-line px-3 py-2 text-sm font-semibold hover:bg-slate-50" onClick={() => setResumeText(obviousInjectionResume)}>Load obvious injection resume</button>
                <button className="rounded-md border border-line px-3 py-2 text-sm font-semibold hover:bg-slate-50" onClick={() => setResumeText(subtleInjectionResume)}>Load subtle injection resume</button>
                <button className="rounded-md border border-line px-3 py-2 text-sm font-semibold hover:bg-slate-50" onClick={() => setResumeText(hiddenStyleInjectionResume)}>Load hidden-style injection resume</button>
                <button className="col-span-2 inline-flex items-center justify-center gap-2 rounded-md border border-line px-3 py-2 text-sm font-semibold hover:bg-slate-50" onClick={() => setResumeText("")}>
                  <XCircle className="h-4 w-4" />
                  Clear
                </button>
              </div>
            </Section>
          </div>

          <div className="space-y-5">
            <Section title="Evaluation">
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                {modes.map((item) => {
                  const Icon = item.icon;
                  const selected = mode === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setMode(item.id)}
                      className={`rounded-lg border p-4 text-left transition ${
                        selected ? "border-teal bg-teal/5 ring-2 ring-teal/15" : "border-line bg-white hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <Icon className={`h-5 w-5 ${selected ? "text-teal" : "text-slate-500"}`} />
                        <Pill tone={item.id === "simple" ? "bad" : item.id === "enhanced" ? "warn" : "good"}>{item.badge}</Pill>
                      </div>
                      <div className="mt-3 text-sm font-bold text-ink">{item.title}</div>
                      <p className="mt-2 text-xs leading-5 text-muted">{item.description}</p>
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 rounded-lg border border-line bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                {mode === "simple" ? "Simple Mode: The resume injection can manipulate the model into giving a 100/100." : null}
                {mode === "enhanced" ? "Enhanced Prompt Mode: A stronger prompt helps, but the model is still being asked to defend itself from malicious input." : null}
                {mode === "ai_guard" ? "AI Guard Mode: A separate runtime layer inspects the prompt/response and can block or force manual review." : null}
              </div>

              <button
                onClick={runEvaluation}
                disabled={loading || !resumeText.trim()}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-ink px-4 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Gauge className="h-4 w-4" />
                {loading ? "Running Evaluation..." : "Run Evaluation"}
              </button>
              {error ? <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">{error}</div> : null}
            </Section>

            {result ? (
              <div className="space-y-4">
                <ResultPanel title="Model Recommendation">
                  {result.modelOutput ? (
                    <div className="space-y-3 text-sm">
                      <div className="flex flex-wrap gap-2">
                        <Pill tone={result.modelOutput.score >= 85 ? "good" : result.modelOutput.score >= 50 ? "warn" : "bad"}>Score: {result.modelOutput.score}/100</Pill>
                        <Pill>{result.modelOutput.recommendation}</Pill>
                      </div>
                      <p className="text-slate-700">{result.modelOutput.summary}</p>
                      <div className="grid gap-3 md:grid-cols-2">
                        <List title="Strengths" items={result.modelOutput.strengths} />
                        <List title="Weaknesses" items={result.modelOutput.weaknesses} />
                      </div>
                      <p className="rounded-md bg-slate-50 p-3 text-slate-700">{result.modelOutput.rationale}</p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Ban className="h-4 w-4 text-danger" />
                      No model recommendation was trusted or generated.
                    </div>
                  )}
                </ResultPanel>

                <ResultPanel title="Final App Decision">
                  <div className="space-y-3 text-sm">
                    <div className="flex flex-wrap gap-2">
                      <Pill tone={result.finalDecision.scoreTrusted ? "good" : "bad"}>Score trusted: {result.finalDecision.scoreTrusted ? "yes" : "no"}</Pill>
                      {result.finalDecision.finalScore !== undefined ? <Pill>Final score: {result.finalDecision.finalScore}/100</Pill> : null}
                      <Pill tone={result.finalDecision.finalRecommendation === "blocked" ? "bad" : result.finalDecision.finalRecommendation === "manual_review" ? "warn" : "good"}>
                        {result.finalDecision.finalRecommendation}
                      </Pill>
                    </div>
                    <p className="text-slate-700">{result.finalDecision.explanation}</p>
                  </div>
                </ResultPanel>

                <ResultPanel title="Guardrail Result">
                  <div className="flex flex-wrap gap-2 text-sm">
                    <Pill>{guardLabel}</Pill>
                    {result.mode === "enhanced" ? <Pill tone="warn">Protection: prompt-only</Pill> : null}
                    <Pill tone={toneForAction(result.guardrailResult?.promptAction)}>Prompt action: {result.guardrailResult?.promptAction ?? "not_inspected"}</Pill>
                    <Pill tone={toneForAction(result.guardrailResult?.responseAction)}>Response action: {result.guardrailResult?.responseAction ?? "not_inspected"}</Pill>
                  </div>
                </ResultPanel>

                <ResultPanel title="Security Detections" defaultOpen={Boolean(result.guardrailResult?.detections.length)}>
                  {result.guardrailResult?.detections.length ? (
                    <div className="grid gap-3">
                      {result.guardrailResult.detections.map((detection, index) => (
                        <div key={`${detection.type}-${index}`} className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
                          <div className="flex flex-wrap gap-2">
                            <Pill tone="warn">{detection.type}</Pill>
                            <Pill tone={detection.severity === "critical" || detection.severity === "high" ? "bad" : "warn"}>{detection.severity}</Pill>
                            <Pill>{detection.location}</Pill>
                          </div>
                          <p className="mt-2 text-amber-900">{detection.explanation}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted">No detections reported.</p>
                  )}
                </ResultPanel>

                <ResultPanel title="Audit Trail">
                  <ol className="space-y-2 text-sm text-slate-700">
                    {result.auditTrail.map((item, index) => (
                      <li key={`${item}-${index}`} className="grid grid-cols-[32px_1fr] items-start gap-2">
                        <span className="rounded bg-slate-100 px-2 py-1 text-xs font-bold text-slate-500">{index + 1}</span>
                        <span className="py-1">{item}</span>
                      </li>
                    ))}
                  </ol>
                </ResultPanel>

                <ResultPanel title="What the Model Saw" defaultOpen={false}>
                  <pre className="max-h-[460px] overflow-auto rounded-md bg-slate-950 p-4 text-xs leading-5 text-slate-100">{result.raw?.promptSentToModel ?? "No prompt was sent to the model."}</pre>
                </ResultPanel>

                <ResultPanel title="Raw Model Output" defaultOpen={false}>
                  <pre className="max-h-[360px] overflow-auto rounded-md bg-slate-950 p-4 text-xs leading-5 text-slate-100">{result.raw?.rawModelResponse ?? "No raw model output."}</pre>
                </ResultPanel>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-md border border-line p-3">
      <div className="mb-2 text-xs font-bold uppercase tracking-normal text-slate-500">{title}</div>
      <ul className="space-y-1 text-slate-700">
        {items.length ? items.map((item) => <li key={item}>- {item}</li>) : <li>- None listed</li>}
      </ul>
    </div>
  );
}
