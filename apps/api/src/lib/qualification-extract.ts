/**
 * Extração determinística de qualificação (sem LLM gravar CRM).
 * Campos vão para lead_actions.metadata.qualification
 */

export type QualificationSnapshot = {
  budget_max_brl?: number;
  payment?: "financing" | "cash" | "fgts" | "mixed";
  buying_with?: "alone" | "couple" | "family";
  timeline_hint?: string;
  visit_requested?: boolean;
  income_hint?: string;
  notes?: string[];
  last_message_excerpt?: string;
  updated_at: string;
};

function parseBudgetBrl(text: string): number | undefined {
  const normalized = text.replace(/\./g, "").toLowerCase();

  const ate = normalized.match(
    /(?:at[eé]|ate|m[aá]ximo|max)\s*(?:de\s*)?r?\$?\s*(\d[\d.,]*)\s*(mil|k|m)?/i,
  );
  const faixa = normalized.match(
    /faixa\s*(?:de\s*)?r?\$?\s*(\d[\d.,]*)\s*(mil|k|m)?/i,
  );
  const plain = normalized.match(
    /r?\$\s*(\d[\d.,]*)\s*(mil|k|m)?/i,
  );

  const pick = ate ?? faixa ?? plain;
  if (!pick?.[1]) return undefined;

  let n = Number(pick[1].replace(",", "."));
  if (!Number.isFinite(n)) return undefined;

  const unit = (pick[2] ?? "").toLowerCase();
  if (unit === "mil" || unit === "k") n *= 1000;
  if (unit === "m") n *= 1_000_000;

  if (n < 50_000) n *= 1000;

  return Math.round(n);
}

export function extractQualificationFromMessage(
  message: string,
): Partial<QualificationSnapshot> | null {
  const t = message.trim();
  if (t.length < 3) return null;

  const out: Partial<QualificationSnapshot> = {
    updated_at: new Date().toISOString(),
    last_message_excerpt: t.slice(0, 280),
  };
  const notes: string[] = [];
  let found = false;

  const budget = parseBudgetBrl(t);
  if (budget) {
    out.budget_max_brl = budget;
    found = true;
  }

  if (/\bfinanciamento\b|\bfinanciar\b|\bfinanciado\b/i.test(t)) {
    out.payment = "financing";
    found = true;
  } else if (/\b(?:à|a)\s*vista\b|\bavista\b|\bdinheiro\b/i.test(t)) {
    out.payment = "cash";
    found = true;
  } else if (/\bfgts\b/i.test(t)) {
    out.payment = "fgts";
    found = true;
  }

  if (/\bsozinho\b|\bsozinha\b|\bsó\s+eu\b/i.test(t)) {
    out.buying_with = "alone";
    found = true;
  } else if (/\bcasal\b|\bcom\s+(?:minha\s+)?esposa\b|\bcom\s+(?:meu\s+)?marido\b/i.test(t)) {
    out.buying_with = "couple";
    found = true;
  } else if (/\bfam[ií]lia\b|\bfilhos\b/i.test(t)) {
    out.buying_with = "family";
    found = true;
  }

  if (
    /\b(?:quero|posso|vamos)\s+agendar\b/i.test(t) ||
    /\bagendar\s+(?:uma\s+)?visita\b/i.test(t) ||
    /\bvisita\s+na\s+(?:imobili[aá]ria|loja)\b/i.test(t)
  ) {
    out.visit_requested = true;
    found = true;
  }

  const timeline = t.match(
    /\b(?:em|at[eé]|prazo|urgente|j[aá])\s+(\d+\s*(?:dias?|semanas?|meses?)|urgente|imediato)\b/i,
  );
  if (timeline?.[0]) {
    out.timeline_hint = timeline[0].trim().slice(0, 80);
    found = true;
  }

  const income = t.match(
    /\b(?:renda|sal[aá]rio|ganho)\s*(?:de\s*)?(?:r?\$?\s*)?(\d[\d.,]*\s*(?:mil|k)?)/i,
  );
  if (income?.[0]) {
    out.income_hint = income[0].trim().slice(0, 60);
    found = true;
  }

  if (!found) return null;

  if (notes.length > 0) out.notes = notes;
  return out;
}

export function mergeQualificationSnapshots(
  existing: QualificationSnapshot | undefined,
  incoming: Partial<QualificationSnapshot>,
): QualificationSnapshot {
  const base = existing ?? { updated_at: new Date().toISOString() };
  return {
    ...base,
    ...incoming,
    notes: [
      ...(base.notes ?? []),
      ...(incoming.notes ?? []),
    ].slice(-10),
    updated_at: incoming.updated_at ?? new Date().toISOString(),
  };
}
