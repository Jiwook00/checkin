import type { SupabaseClient } from "@supabase/supabase-js";
import {
  extractFromNode,
  prepareDocument,
  validateSelector,
  type ExtractCheck,
} from "./llm-fallback.ts";

// LLM이 찾고 검증을 통과한 본문 셀렉터를 hostname 단위로 저장해 둔다. 기존 규칙(셀렉터·Readability)이
// 실패한 페이지에서 LLM 직전에만 적용한다. 저장소의 어떤 메서드도 예외를 던지지 않는다 (recordAttempt와 같은 원칙).

/** 연속 실패가 이 횟수에 닿으면 규칙을 비활성화한다 */
export const RULE_DISABLE_AFTER = 2;
/** 규칙 조회가 이보다 오래 걸리면 규칙 없음으로 보고 LLM으로 넘어간다 */
export const RULE_LOOKUP_TIMEOUT_MS = 1_500;

export interface DomainRule {
  hostname: string;
  selector: string;
  source: "llm" | "manual";
  hit_count: number;
  consecutive_failures: number;
}

export interface RuleStore {
  /** 활성 규칙만 돌려준다. 비활성화됐거나 조회에 실패하면 null */
  get(hostname: string): Promise<DomainRule | null>;
  recordHit(rule: DomainRule): Promise<void>;
  /** disabled는 계산값이다. 쓰기가 실패해도 그대로 돌려준다 */
  recordFailure(rule: DomainRule): Promise<{ disabled: boolean }>;
  /** 호출 조건(활성 규칙 없음)은 파이프라인이 보장한다. 비활성 행은 덮어써서 다시 활성화한다 */
  saveFromLlm(
    hostname: string,
    selector: string,
    seedUrl: string,
  ): Promise<void>;
}

/** 저장된 셀렉터로 본문을 뽑고 LLM 경로와 같은 검증(매칭 1개, 영역, 품질)을 거친다 */
export function applyRule(html: string, selector: string): ExtractCheck {
  const doc = prepareDocument(html);
  if (!doc) return { ok: false, reason: "html_parse_failed" };
  const check = validateSelector(doc, selector);
  if (!check.ok) return check;
  return extractFromNode(doc, check.node, "domain_rule");
}

function nextFailure(rule: DomainRule): {
  failures: number;
  disabled: boolean;
} {
  const failures = rule.consecutive_failures + 1;
  return { failures, disabled: failures >= RULE_DISABLE_AFTER };
}

/**
 * 프로덕션 저장소. 갱신은 읽은 값에 더하는 read-modify-write다
 * (같은 호스트의 동시 요청이 드물어 경합은 무시한다)
 */
export function createSupabaseRules(admin: SupabaseClient): RuleStore {
  const update = async (
    hostname: string,
    fields: Record<string, unknown>,
  ): Promise<void> => {
    try {
      const { error } = await admin
        .from("checkin_parse_rules")
        .update({ ...fields, updated_at: new Date().toISOString() })
        .eq("hostname", hostname);
      if (error) console.error(`도메인 규칙 갱신 실패: ${error.message}`);
    } catch (err) {
      console.error(`도메인 규칙 갱신 실패: ${String(err)}`);
    }
  };

  return {
    async get(hostname) {
      try {
        const { data, error } = await admin
          .from("checkin_parse_rules")
          .select("hostname,selector,source,hit_count,consecutive_failures")
          .eq("hostname", hostname)
          .is("disabled_at", null)
          .abortSignal(AbortSignal.timeout(RULE_LOOKUP_TIMEOUT_MS))
          .maybeSingle();
        if (error) {
          console.error(`도메인 규칙 조회 실패: ${error.message}`);
          return null;
        }
        return (data as DomainRule | null) ?? null;
      } catch (err) {
        console.error(`도메인 규칙 조회 실패: ${String(err)}`);
        return null;
      }
    },

    async recordHit(rule) {
      await update(rule.hostname, {
        hit_count: rule.hit_count + 1,
        consecutive_failures: 0,
      });
    },

    async recordFailure(rule) {
      const { failures, disabled } = nextFailure(rule);
      await update(rule.hostname, {
        consecutive_failures: failures,
        ...(disabled ? { disabled_at: new Date().toISOString() } : {}),
      });
      return { disabled };
    },

    async saveFromLlm(hostname, selector, seedUrl) {
      try {
        const { error } = await admin.from("checkin_parse_rules").upsert(
          {
            hostname,
            selector,
            source: "llm",
            seed_url: seedUrl,
            hit_count: 0,
            consecutive_failures: 0,
            disabled_at: null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "hostname" },
        );
        if (error) console.error(`도메인 규칙 저장 실패: ${error.message}`);
      } catch (err) {
        console.error(`도메인 규칙 저장 실패: ${String(err)}`);
      }
    },
  };
}

interface MemoryRule extends DomainRule {
  seed_url: string | null;
  disabled: boolean;
}

/** 벤치마크용 메모리 저장소. Supabase 구현과 같은 의미론이다 */
export function createMemoryRules(
  seed: { hostname: string; selector: string }[] = [],
): RuleStore & { all(): MemoryRule[] } {
  const rules = new Map<string, MemoryRule>();
  for (const s of seed) {
    rules.set(s.hostname, {
      hostname: s.hostname,
      selector: s.selector,
      source: "manual",
      hit_count: 0,
      consecutive_failures: 0,
      seed_url: null,
      disabled: false,
    });
  }

  return {
    get(hostname) {
      const rule = rules.get(hostname);
      if (!rule || rule.disabled) return Promise.resolve(null);
      return Promise.resolve({
        hostname: rule.hostname,
        selector: rule.selector,
        source: rule.source,
        hit_count: rule.hit_count,
        consecutive_failures: rule.consecutive_failures,
      });
    },

    recordHit(rule) {
      const stored = rules.get(rule.hostname);
      if (stored) {
        stored.hit_count = rule.hit_count + 1;
        stored.consecutive_failures = 0;
      }
      return Promise.resolve();
    },

    recordFailure(rule) {
      const { failures, disabled } = nextFailure(rule);
      const stored = rules.get(rule.hostname);
      if (stored) {
        stored.consecutive_failures = failures;
        if (disabled) stored.disabled = true;
      }
      return Promise.resolve({ disabled });
    },

    saveFromLlm(hostname, selector, seedUrl) {
      rules.set(hostname, {
        hostname,
        selector,
        source: "llm",
        hit_count: 0,
        consecutive_failures: 0,
        seed_url: seedUrl,
        disabled: false,
      });
      return Promise.resolve();
    },

    all() {
      return [...rules.values()].map((r) => ({ ...r }));
    },
  };
}
