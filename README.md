# 사.주.팔.자.

**🔗 서비스 바로가기: [gyul-saju.vercel.app](https://gyul-saju.vercel.app/)**

생년월일로 사주를 풀어주는 Next.js 서비스. 생년월일을 넣으면 한 번에 풀이해주는 **단발성 풀이**와, 대화로 묻고 답하는 **사주 상담 에이전트**가 있다.

| 페이지 | 기능 |
| --- | --- |
| `/` → `/result` | 기본 사주 풀이 (사주팔자, 오행, 일주 해석) |
| `/career` | 직장운 전용 분석 |
| `/love` | 연애·결혼운 전용 분석 |
| [`/chat`](https://gyul-saju.vercel.app/chat) | 사주 상담 에이전트 (궁합, 대운·세운, 월운, 택일) |

풀이 결과는 이미지로 저장할 수 있다.

## 사주 상담 에이전트 (`/chat`)

"나랑 친구 궁합 보고, 올해 같이 여행 가기 좋은 달도 알려줘" 같은 복합 질문을 받으면, LLM이 필요한 계산 도구를 골라 여러 번 호출하고 그 결과만으로 답한다. 위 질문이라면 궁합 계산 1번, 두 사람의 월운 조회 2번을 한 번에 요청한 뒤, 둘 다 좋은 달을 골라 종합한다.

**핵심 설계: 계산과 해석의 분리.** LLM은 간지·십신·점수를 직접 계산하지 않는다. 어떤 도구를 부를지 판단하고 결과를 해석하는 역할만 맡고, 수치는 전부 규칙 엔진(`lib/saju`)이 만든다. 금융 서비스에서 수익률·금리를 LLM이 아니라 계산 엔진이 산출하는 것과 같은 구조다.

```
START → agent(Gemini) ──tool_calls──→ tools(규칙 엔진) ─┐
          ↑                                            │
          └────────────────────────────────────────────┘
        agent ──답변──→ END
```

| 도구 | 역할 |
| --- | --- |
| `calc_saju` | 사주팔자, 십신, 오행 분포 |
| `calc_compatibility` | 두 사람 궁합 (일간 합충, 배우자궁, 띠, 오행 보완 → 점수) |
| `get_luck_cycle` | 대운 10개, 해당 연도 세운과 원국의 합충 |
| `get_monthly_fortune` | 12개월 월운을 목적별(이사·여행·연애·직장·재물 등)로 채점 |
| `find_good_dates` | 기간 내 모든 날의 일진을 채점해 택일 (이사는 손 없는 날 반영) |

### 할루시네이션을 줄이는 장치

- **원본 입력만 전달**: 도구는 생년월일만 받고 파생값은 매번 다시 계산한다. LLM이 앞 도구의 결과값을 옮겨 적다가 틀릴 여지가 없다.
- **스키마 검증 + 에러 피드백**: zod로 입력을 검증한다. 잘못된 날짜나 범위 초과는 에러 메시지로 LLM에 돌려보내 스스로 고쳐서 다시 호출하게 한다.
- **정보 부족 시 되묻기**: 생년월일·성별이 없으면 도구를 부르지 않고 먼저 물어본다. "다음 달", "올해" 같은 표현은 오늘 날짜 기준 실제 날짜로 바꿔 넘긴다.
- **근거 공개**: 모든 점수에 `reasons`(예: `-15 일지 해↔사 충`)가 붙고, UI에서 도구 호출 입력과 결과를 펼쳐 볼 수 있다.
- **루프 상한**: `recursionLimit`으로 도구 호출이 끝없이 반복되지 않게 막는다.

### 안정성

- **무상태 서버**: 대화 이력은 클라이언트가 보관하고, 서버리스 환경에서도 체크포인터 없이 동작한다.
- **실시간 진행 표시**: 도구 호출·결과·답변을 NDJSON으로 스트리밍해, 어떤 계산을 하고 있는지 화면에 바로 보여준다.
- **API 한도 대응**: Gemini 무료 등급은 모델별로 분당 5회·하루 20회 한도가 있고, 질문 하나에 LLM 호출이 2~4번 필요하다. 한도(429)나 과부하(503)에 걸리면
  1. 예비 모델(`gemini-flash-lite-latest`)로 바로 전환하고,
  2. 모든 모델이 막혔으면 구글이 알려준 대기 시간만큼 기다렸다가 다시 호출한다.

  막힌 모델은 요청 간에 공유해서 건너뛰고, 대기 중에는 ping 이벤트로 연결을 유지하며 로딩 문구를 바꿔 사용자에겐 조금 오래 걸리는 것처럼만 보인다.

## 기술 스택

- **Next.js 16** (App Router, Route Handlers), React 19, Tailwind CSS 4, TypeScript
- **LangGraph.js** + `@langchain/google-genai`: 에이전트 루프, 도구 호출
- **Gemini API**: 단발성 풀이는 `@google/generative-ai`, 에이전트는 LangChain 경유
- **zod**: 도구 입력 스키마
- `korean-lunar-calendar`: 음력 → 양력 변환, `html-to-image`: 결과 이미지 저장
- **Vercel** 배포

## 프로젝트 구조

```
app/
  page.tsx, result/, career/, love/   단발성 풀이 화면
  chat/page.tsx                       에이전트 채팅 UI
  api/saju, api/career, api/love      단발성 풀이 API (계산 → Gemini 해석)
  api/agent/route.ts                  에이전트 API (NDJSON 스트리밍)
lib/
  saju/pillars.ts, constants.ts       사주팔자 계산
  saju/fortune.ts                     궁합·대운·월운·택일 규칙 엔진
  agent/tools.ts                      규칙 엔진을 감싼 LangChain 도구
  agent/graph.ts                      LangGraph 에이전트, 모델 전환·재시도
  ai/gemini.ts                        단발성 풀이 프롬프트
data/                                 천간·일주 해석 데이터
```

## 실행

Node.js 20.9 이상이 필요하다.

```bash
echo "GEMINI_API_KEY=..." > .env.local
npm install
npm run dev
```

[http://localhost:3000](http://localhost:3000)에서 단발성 풀이를, [http://localhost:3000/chat](http://localhost:3000/chat)에서 에이전트를 사용할 수 있다.

| 환경 변수 | 설명 |
| --- | --- |
| `GEMINI_API_KEY` | 필수. [Google AI Studio](https://aistudio.google.com/apikey)에서 발급 |
| `GEMINI_AGENT_MODEL` | 선택. 에이전트 기본 모델 (기본 `gemini-flash-latest`) |
| `GEMINI_FALLBACK_MODELS` | 선택. 한도 초과 시 넘어갈 모델, 쉼표로 구분 (기본 `gemini-flash-lite-latest`) |
