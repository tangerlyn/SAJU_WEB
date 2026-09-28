// 사주 상담 에이전트 — LangGraph ReAct 루프
//
//   START → agent ──(tool_calls 있음)──→ tools ─┐
//             ↑                                 │
//             └─────────────────────────────────┘
//           agent ──(tool_calls 없음)──→ END
//
// agent 노드(LLM)는 어떤 도구를 부를지 판단하고 결과를 해석만 한다.
// 계산은 전부 tools 노드(규칙 엔진)에서 일어난다.
import { StateGraph, MessagesAnnotation, START, END, type LangGraphRunnableConfig } from '@langchain/langgraph'
import { ToolNode, toolsCondition } from '@langchain/langgraph/prebuilt'
import { ChatGoogleGenerativeAI } from '@langchain/google-genai'
import { SystemMessage } from '@langchain/core/messages'
import { sajuTools } from './tools'

const MODEL = process.env.GEMINI_AGENT_MODEL ?? 'gemini-flash-latest'

function todayKST(): string {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(new Date())
}

function systemPrompt(): string {
  return `당신은 "귤린이 사주 상담소"의 사주 상담 에이전트입니다. 오늘은 ${todayKST()}입니다.

## 절대 원칙
- 간지·오행·십신·대운·점수·날짜 등 모든 계산값은 반드시 도구 결과에서만 인용하세요. 직접 계산하거나 추정하지 마세요.
- 도구 결과에 없는 수치나 간지를 지어내지 마세요. 필요한 값이 없으면 도구를 더 호출하세요.
- 도구는 호출할 때마다 원본 생년월일을 그대로 넘기세요. 이전 도구 결과의 값을 옮겨 적지 마세요.
- 사주 계산에는 생년월일과 성별이 필요합니다. 없으면 도구를 부르지 말고 먼저 물어보세요. 태어난 시간은 모르면 생략해도 됩니다. 음력 생일인지 애매하면 확인하세요.
- "다음 달", "올해" 같은 표현은 오늘 날짜 기준으로 실제 날짜로 바꿔서 도구에 넘기세요.

## 도구 사용 가이드
- 성향·기본 사주: calc_saju
- 두 사람 관계: calc_compatibility
- 올해/특정 연도 운세, 대운: get_luck_cycle
- 월 단위로 좋은 시기 찾기: get_monthly_fortune (여러 사람이면 각자 호출 후 공통으로 좋은 달을 고르기)
- 특정 기간의 좋은 날짜: find_good_dates
- 복합 질문은 필요한 도구를 여러 번, 여러 종류 호출해 근거를 모은 뒤 종합하세요. 서로 의존하지 않는 호출은 한 번에 같이 요청하세요.

## 답변 스타일
- 첫 문단에 핵심 결론을 먼저 말하고, 이어서 도구 결과를 근거로 짧게 설명하세요.
- 점수는 규칙 기반 참고 지표라는 점을 자연스럽게 알리고, 부정적인 결과도 대처법과 함께 전하세요.
- 따뜻하고 친근한 존댓말, 한자 용어는 쉽게 풀어서. 가벼운 마크다운(굵게, 목록)만 사용하세요.
- 사주는 재미와 참고용입니다. 건강·법률·투자처럼 중요한 결정은 전문가 상담을 권하세요.`
}

// Gemini 무료 등급 한도는 모델별로 따로 잡힌다(분당 5회, 하루 20회).
// 한도(429)·과부하(503)에 걸린 모델은 잠시 쉬게 하고 다른 모델로 바로 넘어가며,
// 모두 막혀 있으면 가장 먼저 풀리는 모델을 기다렸다가 다시 부른다. 사용자에겐 로딩이 조금 길어질 뿐.
const MODELS = [MODEL, ...(process.env.GEMINI_FALLBACK_MODELS ?? 'gemini-flash-lite-latest').split(',')]
  .map(m => m.trim())
  .filter((m, i, arr) => m && arr.indexOf(m) === i)
const RETRY_BUDGET_MS = 200_000
const DAILY_COOLDOWN_MS = 60 * 60_000

// 모델별 "이 시각까지 호출하지 않음" — 요청 간에 공유해 이미 막힌 모델에 헛호출하지 않는다
const cooldownUntil = new Map<string, number>()

export class QuotaExhaustedError extends Error {
  constructor(readonly daily: boolean) {
    super(daily ? 'Gemini 일일 한도 소진' : 'Gemini 재시도 시간 초과')
  }
}

// 재시도할 오류면 쉬어야 할 시간(ms), 아니면 null
function cooldownMs(err: unknown, attempt: number): number | null {
  const e = err as { status?: number; message?: string } | undefined
  const msg = e?.message ?? ''
  const status = e?.status ?? Number(msg.match(/\[(\d{3}) [^\]]*\]/)?.[1])
  if (status !== 429 && status !== 503) return null
  if (/PerDay/.test(msg)) return DAILY_COOLDOWN_MS

  // 구글이 알려주는 대기 시간: "Please retry in 37.6s" 또는 retryDelay: "50s"
  const hinted = msg.match(/retry in ([\d.]+)s/i)?.[1] ?? msg.match(/"retryDelay":"([\d.]+)s"/)?.[1]
  return hinted ? Number(hinted) * 1000 + 1000 : Math.min(5000 * 2 ** attempt, 30_000)
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason)
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(signal.reason)
    }, { once: true })
  })
}

function createModel(model: string) {
  return new ChatGoogleGenerativeAI({
    model,
    apiKey: process.env.GEMINI_API_KEY,
    temperature: 0.4,
    maxRetries: 0, // 재시도는 callModel에서 구글이 알려준 대기 시간에 맞춰 직접 한다
  }).bindTools(sajuTools)
}

async function callModel(state: typeof MessagesAnnotation.State, config?: LangGraphRunnableConfig) {
  const input = [new SystemMessage(systemPrompt()), ...state.messages]
  const deadline = Date.now() + RETRY_BUDGET_MS

  for (let attempt = 0; ; attempt++) {
    const now = Date.now()
    const model = MODELS.find(m => (cooldownUntil.get(m) ?? 0) <= now)

    if (!model) {
      const soonest = Math.min(...MODELS.map(m => cooldownUntil.get(m)!))
      if (soonest > deadline) {
        throw new QuotaExhaustedError(MODELS.every(m => cooldownUntil.get(m)! - now > RETRY_BUDGET_MS))
      }
      console.warn(`[agent] 모든 모델 한도 — ${Math.round((soonest - now) / 1000)}초 대기`)
      await sleep(soonest - now, config?.signal)
      continue
    }

    try {
      const response = await createModel(model).invoke(input, { signal: config?.signal })
      return { messages: [response] }
    } catch (err) {
      const cooldown = cooldownMs(err, attempt)
      if (cooldown === null || config?.signal?.aborted) throw err
      cooldownUntil.set(model, Date.now() + cooldown)
      console.warn(`[agent] ${model} 한도/과부하 — ${Math.round(cooldown / 1000)}초 휴식, 다른 모델로 재시도`)
    }
  }
}

export const sajuAgent = new StateGraph(MessagesAnnotation)
  .addNode('agent', callModel)
  .addNode('tools', new ToolNode(sajuTools))
  .addEdge(START, 'agent')
  .addConditionalEdges('agent', toolsCondition, ['tools', END])
  .addEdge('tools', 'agent')
  .compile()

// agent↔tools 왕복 상한 (무한 도구 호출 방지)
export const RECURSION_LIMIT = 20
