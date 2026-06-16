"use client";

import {
  AlertTriangle,
  BadgeCheck,
  Ban,
  CheckCircle2,
  CircleDot,
  Clock,
  Gauge,
  RotateCcw,
  ShieldCheck,
  Upload,
  XCircle
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { cleanResume } from "@/data/cleanResume";
import { defaultJobPosting } from "@/data/defaultJobPosting";
import { hiddenStyleInjectionResume } from "@/data/hiddenStyleInjectionResume";
import { maliciousUrlResume } from "@/data/maliciousUrlResume";
import { obviousInjectionResume } from "@/data/obviousInjectionResume";
import { subtleInjectionResume } from "@/data/subtleInjectionResume";
import type { EvaluateResponse, EvaluationMode } from "@/lib/types";
import { WorkbenchLogo } from "@/components/WorkbenchLogo";

const tabs = [
  "AI Resume Screener",
  "Public Support Bot",
  "Data Loss Simulator",
  "RAG Poisoning Lab",
  "Multimodal Lab",
  "Guardrails Sandbox"
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
    description: "Reduces obvious failures, but detection and enforcement still depend on the model.",
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
    warn: "border-yellow-300 bg-yellow-100 text-yellow-900",
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

function LinkifiedText({ text }: { text: string }) {
  const urlPattern = /(https?:\/\/[^\s<>"'`)\]]+)/g;
  const parts = text.split(urlPattern);

  return (
    <>
      {parts.map((part, index) => {
        if (!/^https?:\/\//.test(part)) return <span key={`${part}-${index}`}>{part}</span>;

        const trailingPunctuation = part.match(/[.,;:!?]+$/)?.[0] ?? "";
        const href = trailingPunctuation ? part.slice(0, -trailingPunctuation.length) : part;

        return (
          <span key={`${part}-${index}`}>
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-teal underline decoration-teal/30 underline-offset-2 hover:text-ink hover:decoration-ink"
            >
              {href}
            </a>
            {trailingPunctuation}
          </span>
        );
      })}
    </>
  );
}

function toneForAction(action?: string) {
  if (action === "blocked") return "bad";
  if (action === "flagged") return "warn";
  if (action === "allowed") return "good";
  return "neutral";
}

function toneForRecommendation(recommendation?: string): "good" | "warn" | "bad" {
  if (recommendation === "reject" || recommendation === "blocked") return "bad";
  if (recommendation === "maybe" || recommendation === "manual_review") return "warn";
  if (recommendation === "interview" || recommendation === "strong_interview") return "good";
  return "warn";
}

function formatLatency(value?: number) {
  if (value === undefined) return "n/a";
  if (value < 1000) return `${value} ms`;
  return `${(value / 1000).toFixed(2)} s`;
}

function formatTime(value?: string) {
  if (!value) return "n/a";
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit"
  }).format(new Date(value));
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
  const resumeTextareaRef = useRef<HTMLTextAreaElement>(null);

  const guardLabel = useMemo(() => {
    if (!result?.guardrailResult || result.guardrailResult.provider === "none") return "Provider: none";
    return "Zscaler AI Guard - API mode";
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
    setResult(null);

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
      setPdfMeta(`${data.metadata?.fileName ?? "PDF"} loaded into resume input · ${data.metadata?.pageCount ?? "?"} pages · ${Math.round((data.metadata?.sizeBytes ?? 0) / 1024)} KB`);
      window.requestAnimationFrame(() => {
        if (!resumeTextareaRef.current) return;
        resumeTextareaRef.current.focus();
        resumeTextareaRef.current.scrollTop = 0;
      });
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
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center">
                <WorkbenchLogo size={40} className="h-10 w-10" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-normal text-ink">AI Pen Testing Workbench</h1>
                <p className="mt-1 text-sm text-muted">Security testing labs for real-world AI workflows</p>
              </div>
            </div>
            <div className="flex flex-col items-start gap-2 sm:items-end">
              <div className="text-xs font-semibold text-muted">
                Created by{" "}
                <a
                  href="https://willgrana.com"
                  target="_blank"
                  rel="noreferrer"
                  className="text-teal underline-offset-2 hover:underline"
                >
                  Will Grana
                </a>
              </div>
            </div>
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
              <span>{tab}</span>
              {index !== 0 ? <span className="block text-[11px] font-bold uppercase tracking-normal text-slate-400">Coming soon</span> : null}
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
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold text-ink">ML Infrastructure Engineer, Safeguards</div>
                    <div className="mt-1 text-xs font-semibold text-slate-500">ClosedAI</div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Pill>San Francisco, CA</Pill>
                    <Pill>Remote-friendly</Pill>
                    <Pill>Full-time</Pill>
                  </div>
                </div>
                <p className="mt-3 text-xs leading-5 text-muted">Own evaluation pipelines, policy enforcement services, and observability for safety-critical model launches.</p>
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
                  {uploading ? "Extracting PDF..." : "Upload PDF into resume text"}
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    className="hidden"
                    onChange={(event) => {
                      uploadPdf(event.target.files?.[0]);
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
                {pdfMeta ? <Pill>{pdfMeta}</Pill> : null}
              </div>
              <textarea
                ref={resumeTextareaRef}
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
                <button className="rounded-md border border-line px-3 py-2 text-sm font-semibold hover:bg-slate-50" onClick={() => setResumeText(maliciousUrlResume)}>Load malicious URL resume</button>
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
                {mode === "enhanced" ? "Enhanced Prompt Mode: The model may spot suspicious instructions, but the app has no independent detector or enforcement point." : null}
                {mode === "ai_guard" ? "AI Guard Mode: Requires external AI Guard API configuration and enforces outside the model prompt." : null}
              </div>

              <button
                onClick={runEvaluation}
                disabled={loading || !resumeText.trim()}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-ink px-4 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Gauge className="h-4 w-4" />
                {loading ? "Running Evaluation..." : "Run Evaluation"}
              </button>
              {loading ? <EvaluationLoading mode={mode} /> : null}
              {error ? <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">{error}</div> : null}
            </Section>

            {result ? (
              <div className="space-y-4">
                <RunMetadataStrip result={result} />

                <ResultPanel title="Model Recommendation">
                  {result.modelOutput ? (
                    <div className="space-y-3 text-sm">
                      <div className="flex flex-wrap gap-2">
                        <Pill tone={result.modelOutput.score >= 85 ? "good" : result.modelOutput.score >= 50 ? "warn" : "bad"}>Score: {result.modelOutput.score}/100</Pill>
                        <Pill tone={toneForRecommendation(result.modelOutput.recommendation)}>{result.modelOutput.recommendation}</Pill>
                      </div>
                      <p className="text-slate-700"><LinkifiedText text={result.modelOutput.summary} /></p>
                      <div className="grid gap-3 md:grid-cols-2">
                        <List title="Strengths" items={result.modelOutput.strengths} />
                        <List title="Weaknesses" items={result.modelOutput.weaknesses} />
                      </div>
                      <p className="rounded-md bg-slate-50 p-3 text-slate-700"><LinkifiedText text={result.modelOutput.rationale} /></p>
                      {result.modelOutput.suspiciousContent?.length ? (
                        <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
                          <div className="mb-2 text-xs font-bold uppercase tracking-normal text-amber-900">Model-reported suspicious content</div>
                          <ul className="space-y-1 text-amber-900">
                            {result.modelOutput.suspiciousContent.map((item) => (
                              <li key={item}>- <LinkifiedText text={item} /></li>
                            ))}
                          </ul>
                          <p className="mt-2 text-xs font-semibold text-amber-900">
                            This is model self-reporting, not an external security enforcement decision.
                          </p>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Ban className="h-4 w-4 text-danger" />
                      No model recommendation was trusted or generated.
                    </div>
                  )}
                </ResultPanel>

                <ResultPanel title="Guardrail Result">
                  <div className="space-y-3 text-sm">
                    <div className="flex flex-wrap gap-2">
                      <Pill>{guardLabel}</Pill>
                      {result.mode === "enhanced" ? <Pill tone="warn">Protection: prompt-only</Pill> : null}
                      <Pill tone={toneForAction(result.guardrailResult?.promptAction)}>Prompt action: {result.guardrailResult?.promptAction ?? "not_inspected"}</Pill>
                      <Pill tone={toneForAction(result.guardrailResult?.responseAction)}>Response action: {result.guardrailResult?.responseAction ?? "not_inspected"}</Pill>
                    </div>
                    <p className="text-muted">
                      {result.guardrailResult?.provider === "none"
                        ? "No runtime guardrail inspected this run. The app is showing model output separately from the final decision so the trust boundary is visible."
                        : "Runtime inspection results are shown here separately from the model recommendation."}
                    </p>
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
                          <p className="mt-2 text-amber-900"><LinkifiedText text={detection.explanation} /></p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted">
                      No external guardrail detections reported. In Simple and Enhanced modes, suspiciousContent is only a model output field.
                    </p>
                  )}
                </ResultPanel>

                <ResultPanel title="Final App Decision">
                  <div className="space-y-3 text-sm">
                    <div className="flex flex-wrap gap-2">
                      <Pill tone={result.finalDecision.scoreTrusted ? "good" : "bad"}>Score trusted: {result.finalDecision.scoreTrusted ? "yes" : "no"}</Pill>
                      {result.finalDecision.finalScore !== undefined ? <Pill>Final score: {result.finalDecision.finalScore}/100</Pill> : null}
                      <Pill tone={toneForRecommendation(result.finalDecision.finalRecommendation)}>
                        {result.finalDecision.finalRecommendation}
                      </Pill>
                    </div>
                    <p className="text-slate-700"><LinkifiedText text={result.finalDecision.explanation} /></p>
                  </div>
                </ResultPanel>

                <ResultPanel title="Audit Trail">
                  <AuditTimeline result={result} />
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
        {items.length ? items.map((item) => <li key={item}>- <LinkifiedText text={item} /></li>) : <li>- None listed</li>}
      </ul>
    </div>
  );
}

function EvaluationLoading({ mode }: { mode: EvaluationMode }) {
  const guardrailsEnabled = mode === "ai_guard";
  const steps: Array<{
    label: string;
    detail: string;
    status: "success" | "active" | "queued" | "disabled";
  }> = [
    {
      label: "Submitted",
      detail: "Resume and job posting sent to the server.",
      status: "success"
    },
    {
      label: "Evaluator",
      detail: "Waiting for the server-side evaluation response.",
      status: "active"
    },
    {
      label: "Guardrails",
      detail: guardrailsEnabled ? "Prompt and response inspection will be reported when complete." : "Disabled in this mode.",
      status: guardrailsEnabled ? "queued" : "disabled"
    },
    {
      label: "Decision",
      detail: "Generated only after model and guardrail results return.",
      status: "queued"
    }
  ];

  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-line bg-white px-3 py-2 shadow-soft" role="status" aria-live="polite">
      <div className="flex min-w-0 items-center gap-2 text-[11px]">
        <div className="inline-flex shrink-0 items-center gap-1.5 font-bold uppercase tracking-normal text-slate-500">
          <Clock className="h-3.5 w-3.5 animate-pulse text-teal" />
          Evaluating
        </div>
        {steps.map((step) => (
          <EvaluationLoadingStep key={step.label} {...step} />
        ))}
      </div>
    </div>
  );
}

function EvaluationLoadingStep({
  label,
  detail,
  status
}: {
  label: string;
  detail: string;
  status: "success" | "active" | "queued" | "disabled";
}) {
  const Icon = status === "success" ? CheckCircle2 : status === "active" ? Clock : status === "disabled" ? Ban : CircleDot;
  const styles = {
    success: {
      card: "border-emerald-200 bg-emerald-50",
      icon: "text-emerald-700",
      state: "text-emerald-800",
      label: "ok"
    },
    active: {
      card: "border-teal/30 bg-teal/5 loading-status-pulse",
      icon: "text-teal",
      state: "text-teal",
      label: "running"
    },
    queued: {
      card: "border-line bg-slate-50",
      icon: "text-slate-500",
      state: "text-slate-500",
      label: "queued"
    },
    disabled: {
      card: "border-slate-200 bg-slate-50 opacity-60",
      icon: "text-slate-400",
      state: "text-slate-500",
      label: "off"
    }
  }[status];

  return (
    <div className={`inline-flex min-w-0 flex-1 items-center justify-center gap-1 rounded-md border px-1.5 py-1 ${styles.card}`} title={detail}>
      <Icon className={`h-3 w-3 shrink-0 ${status === "active" ? "animate-pulse" : ""} ${styles.icon}`} />
      <span className="truncate font-semibold text-slate-700">{label}</span>
      <span className={`shrink-0 font-bold uppercase tracking-normal ${styles.state}`}>{styles.label}</span>
    </div>
  );
}

function RunMetadataStrip({ result }: { result: EvaluateResponse }) {
  const metadata = result.runMetadata;
  const items = [
    ["Model", metadata?.model ?? "n/a"],
    ["Provider", metadata?.provider ?? "openai_compatible"],
    ["Endpoint", metadata?.baseUrlHost ?? "n/a"],
    ["LLM", formatLatency(metadata?.llmLatencyMs)],
    ["Guardrail", metadata?.guardrailLatencyMs !== undefined ? formatLatency(metadata.guardrailLatencyMs) : "not run"],
    ["Total", formatLatency(metadata?.totalLatencyMs)]
  ];

  return (
    <div className="rounded-lg border border-line bg-white px-4 py-3 shadow-soft">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
        <div className="inline-flex items-center gap-2 font-bold uppercase tracking-normal text-slate-500">
          <Clock className="h-4 w-4 text-slate-500" />
          Run facts
        </div>
        {items.map(([label, value]) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className="font-bold uppercase tracking-normal text-slate-400">{label}</span>
            <span className="font-semibold text-slate-700">{value}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <span className="font-bold uppercase tracking-normal text-slate-400">Completed</span>
          <span className="font-semibold text-slate-700">{formatTime(metadata?.completedAt)}</span>
        </div>
      </div>
    </div>
  );
}

function AuditTimeline({ result }: { result: EvaluateResponse }) {
  const auditItems = [...result.auditTrail];
  const finalRecommendation = result.finalDecision.finalRecommendation;

  if (finalRecommendation === "reject" && result.finalDecision.scoreTrusted) {
    auditItems.push("Native evaluator rejected candidate based on low role-fit score");
  }

  if (finalRecommendation === "blocked") {
    auditItems.push("Application blocked final decision from proceeding");
  }

  const stages = auditItems.map((item) => {
    const lower = item.toLowerCase();
    const isBad =
      lower.includes("blocked") ||
      lower.includes("failed") ||
      lower.includes("rejected") ||
      lower.includes("low role-fit") ||
      lower.includes("not trust");
    const isWarn =
      !isBad && (
        lower.includes("flagged") ||
        lower.includes("manual review") ||
        lower.includes("skipped") ||
        lower.includes("not_inspected")
      );
    const isGood =
      !isBad && !isWarn && (
        lower.includes("completed") ||
        lower.includes("allowed") ||
        lower.includes("accepted") ||
        lower.includes("generated")
      );
    const isGuardrail = lower.includes("guardrail") || lower.includes("blocked") || lower.includes("allowed") || lower.includes("flagged") || lower.includes("inspection");
    const isDecision = lower.includes("final decision") || lower.includes("model recommendation accepted");
    const isModel = lower.includes("llm") || lower.includes("prompt built");

    return {
      item,
      label: isGuardrail ? "Runtime boundary" : isDecision ? "App decision" : isModel ? "Model step" : "Input",
      tone: isBad ? "bad" : isWarn ? "warn" : isGood ? "good" : "neutral"
    };
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <AuditSummary
          label="Model trust"
          value={result.finalDecision.scoreTrusted ? "Trusted" : "Not trusted"}
          tone={result.finalDecision.scoreTrusted ? "good" : "bad"}
        />
        <AuditSummary
          label="Runtime inspection"
          value={result.guardrailResult?.provider === "none" ? "None" : result.guardrailResult?.provider ?? "None"}
          tone={result.guardrailResult?.provider === "none" ? "warn" : "good"}
        />
        <AuditSummary
          label="Final outcome"
          value={result.finalDecision.finalRecommendation}
          tone={toneForRecommendation(result.finalDecision.finalRecommendation)}
        />
      </div>

      <ol className="relative space-y-3 border-l border-line pl-5">
        {stages.map((stage, index) => {
          const Icon =
            stage.tone === "bad"
              ? XCircle
              : stage.tone === "good"
                ? CheckCircle2
                : stage.tone === "warn"
                  ? AlertTriangle
                  : CircleDot;
          const iconToneClass = {
            bad: "text-red-700",
            good: "text-emerald-700",
            warn: "text-amber-700",
            neutral: "text-slate-500"
          }[stage.tone];
          const cardToneClass = {
            bad: "border-red-200 bg-red-50",
            good: "border-emerald-200 bg-emerald-50",
            warn: "border-amber-200 bg-amber-50",
            neutral: "border-line bg-slate-50"
          }[stage.tone];

          return (
            <li key={`${stage.item}-${index}`} className="relative">
              <span className={`absolute -left-[29px] flex h-5 w-5 items-center justify-center rounded-full border bg-white ${stage.tone === "bad" ? "border-red-200" : stage.tone === "warn" ? "border-amber-200" : stage.tone === "good" ? "border-emerald-200" : "border-line"}`}>
                <Icon className={`h-3.5 w-3.5 ${iconToneClass}`} />
              </span>
              <div className={`rounded-md border p-3 ${cardToneClass}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-normal text-slate-500">{stage.label}</span>
                  <span className="text-xs text-muted">Step {index + 1}</span>
                </div>
                <div className="mt-1 text-sm font-semibold text-ink">{stage.item}</div>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="flex items-center gap-2 rounded-md border border-line bg-white p-3 text-xs text-muted">
        <Clock className="h-4 w-4 text-slate-500" />
        <span>
          This trace shows application control flow, not model reasoning. It is useful for explaining where enforcement happened outside the prompt.
        </span>
      </div>
    </div>
  );
}

function AuditSummary({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone: "good" | "warn" | "bad";
}) {
  const toneClass = {
    good: "border-emerald-200 bg-emerald-50 text-emerald-900",
    warn: "border-yellow-300 bg-yellow-100 text-yellow-900",
    bad: "border-red-200 bg-red-50 text-red-900"
  }[tone];

  return (
    <div className={`rounded-md border p-3 ${toneClass}`}>
      <div className="text-xs font-bold uppercase tracking-normal opacity-75">{label}</div>
      <div className="mt-1 text-sm font-bold">{value}</div>
    </div>
  );
}
