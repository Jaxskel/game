"use client";

import type { BookAnalysis } from "@/lib/types";

const ROLE_BADGE: Record<string, string> = {
  protagonist: "bg-amber-100 text-amber-900",
  antagonist: "bg-red-100 text-red-900",
  supporting: "bg-blue-100 text-blue-900",
  minor: "bg-stone-100 text-stone-700",
};

const STAGE_LABEL: Record<string, string> = {
  exposition: "Exposition",
  rising_action: "Rising action",
  climax: "Climax",
  falling_action: "Falling action",
  resolution: "Resolution",
};

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-stone-500">
        {title}
      </h3>
      {children}
    </section>
  );
}

export default function AnalysisDashboard({ analysis }: { analysis: BookAnalysis }) {
  return (
    <div className="flex flex-col gap-4" data-testid="analysis-dashboard">
      <Card title="Summary">
        <p className="whitespace-pre-line leading-relaxed text-stone-800">
          {analysis.summary}
        </p>
      </Card>

      <Card title="Setting">
        <p className="font-semibold">
          {analysis.setting.place}{" "}
          <span className="font-normal text-stone-500">· {analysis.setting.time}</span>
        </p>
        <p className="mt-1 text-stone-700">{analysis.setting.description}</p>
      </Card>

      <Card title="Main characters">
        <ul className="flex flex-col gap-3">
          {analysis.characters.map((c) => (
            <li key={c.name}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{c.name}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_BADGE[c.role] ?? ROLE_BADGE.minor}`}
                >
                  {c.role}
                </span>
              </div>
              <p className="text-sm text-stone-700">{c.description}</p>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Main events (plot arc)">
        <ol className="relative flex flex-col gap-3 border-l-2 border-stone-200 pl-4">
          {analysis.plotPoints.map((p, i) => (
            <li key={i}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{p.label}</span>
                <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600">
                  {STAGE_LABEL[p.stage] ?? p.stage}
                </span>
              </div>
              <p className="text-sm text-stone-700">{p.description}</p>
            </li>
          ))}
        </ol>
      </Card>

      <Card title="Conflict">
        <p className="font-semibold capitalize">{analysis.conflict.type}</p>
        <p className="mt-1 text-stone-700">{analysis.conflict.description}</p>
      </Card>

      <Card title="Themes">
        <ul className="flex flex-col gap-2">
          {analysis.themes.map((t) => (
            <li key={t.theme}>
              <span className="font-semibold">{t.theme}.</span>{" "}
              <span className="text-stone-700">{t.explanation}</span>
            </li>
          ))}
        </ul>
      </Card>

      {analysis.figurativeLanguage.length > 0 && (
        <Card title="Figurative language">
          <ul className="flex flex-col gap-3">
            {analysis.figurativeLanguage.map((f, i) => (
              <li key={i} className="rounded-lg bg-pink-50 p-3">
                <div className="text-xs font-bold uppercase tracking-wide text-pink-700">
                  {f.device}
                </div>
                <blockquote className="mt-1 italic text-stone-800">
                  “{f.example}”
                </blockquote>
                <p className="mt-1 text-sm text-stone-600">{f.explanation}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
