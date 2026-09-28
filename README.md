# 사.주.팔.자.

생년월일로 사주를 풀어주는 Next.js 서비스. 단발성 풀이(`/`, `/career`, `/love`)와 대화형 **사주 상담 에이전트**(`/chat`)가 있다.

## 사주 상담 에이전트 (`/chat`)

"나랑 친구 궁합 보고, 올해 같이 여행 가기 좋은 달도 알려줘" 같은 복합 질문을 받으면, LLM이 필요한 계산 도구를 골라 여러 번 호출하고 그 결과만으로 답한다.

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

할루시네이션을 줄이려고 둔 장치:

- **원본 입력만 전달**: 도구는 생년월일만 받고 파생값은 매번 다시 계산한다. LLM이 앞 도구의 결과값을 옮겨 적다가 틀릴 여지가 없다.
- **스키마 검증 + 에러 피드백**: zod로 입력을 검증한다. 잘못된 날짜나 범위 초과는 에러 메시지로 LLM에 돌려보내 스스로 고쳐서 다시 호출하게 한다.
- **근거 공개**: 모든 점수에 `reasons`(예: `-15 일지 해↔사 충`)가 붙고, UI에서 도구 호출 입력과 결과를 펼쳐 볼 수 있다.
- **루프 상한**: `recursionLimit`으로 도구 호출이 끝없이 반복되지 않게 막는다.
- **무상태 서버**: 대화 이력은 클라이언트가 보관하고, 서버리스 환경에서도 체크포인터 없이 동작한다.

구현 위치: `lib/saju/fortune.ts`(규칙 엔진), `lib/agent/tools.ts`(도구), `lib/agent/graph.ts`(LangGraph), `app/api/agent/route.ts`(NDJSON 스트리밍), `app/chat/page.tsx`(UI)

## 실행

Node.js 20.9 이상이 필요하다.

```bash
echo "GEMINI_API_KEY=..." > .env.local   # 선택: GEMINI_AGENT_MODEL (기본 gemini-flash-latest)
npm install
npm run dev
```

[http://localhost:3000/chat](http://localhost:3000/chat)에서 에이전트를 사용할 수 있다.
