import type { Finding, FindingType } from "../types";

export type ActionDomain = "ledger" | "album" | "milestone" | "reminder";

export type ParsedActionTarget = {
  domain: ActionDomain;
  id: string;
} | null;

const VALID_DOMAINS: readonly ActionDomain[] = ["ledger", "album", "milestone", "reminder"];

export function parseActionTarget(target: string): ParsedActionTarget {
  if (!target) return null;
  const sep = target.indexOf(":");
  if (sep <= 0) return null;
  const domain = target.slice(0, sep);
  const id = target.slice(sep + 1);
  if (!id) return null;
  if (!(VALID_DOMAINS as readonly string[]).includes(domain)) return null;
  return { domain: domain as ActionDomain, id };
}

export const FINDING_TYPE_LABEL: Record<FindingType, string> = {
  family_action_continuity: "家庭接力",
  cross_domain_link: "跨域关联",
  expense_price_compare: "价格对比",
  trend_anomaly: "趋势观察",
  media_milestone_candidate: "里程碑候选",
  memory_recall: "记忆触发",
};

export const FINDING_TYPE_COLOR: Record<FindingType, string> = {
  family_action_continuity: "#7eafd8",
  cross_domain_link: "#e8a45e",
  expense_price_compare: "#b08868",
  trend_anomaly: "#d88276",
  media_milestone_candidate: "#b894d4",
  memory_recall: "#8ac4a8",
};

export function findingsByType(findings: Finding[]): Map<FindingType, Finding[]> {
  const map = new Map<FindingType, Finding[]>();
  for (const f of findings) {
    if (!map.has(f.type)) map.set(f.type, []);
    map.get(f.type)!.push(f);
  }
  return map;
}
