// 에이전트 도구 — 규칙 엔진(lib/saju)을 LLM이 호출할 수 있는 형태로 감싼다.
// 설계 원칙: LLM은 생년월일 같은 "원본 입력"만 넘기고, 파생값(간지·십신·점수)은
// 매번 도구 안에서 재계산한다. LLM이 계산 결과를 옮겨 적다 틀리는 일을 원천 차단.
import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import {
  describeSaju,
  calcCompatibility,
  getLuckCycle,
  getMonthlyFortune,
  findGoodDates,
  PURPOSES,
  MAX_DATE_RANGE_DAYS,
} from '../saju/fortune'

const person = z.object({
  name: z.string().optional().describe('이름 또는 호칭 (예: 나, 친구)'),
  year: z.number().int().min(1900).max(2050).describe('출생 연도'),
  month: z.number().int().min(1).max(12).describe('출생 월'),
  day: z.number().int().min(1).max(31).describe('출생 일'),
  hour: z.number().int().min(0).max(23).optional().describe('출생 시각(0~23시). 모르면 생략'),
  gender: z.enum(['male', 'female']).describe('성별'),
  isLunar: z.boolean().optional().describe('음력 생일이면 true'),
  isLeapMonth: z.boolean().optional().describe('음력 윤달 생일이면 true'),
})

const purpose = z
  .enum(PURPOSES)
  .describe('목적: general(전반) move(이사) travel(여행) love(연애·결혼) career(직장·면접) money(재물·투자) contract(계약·문서) study(공부·시험)')

const json = (v: unknown) => JSON.stringify(v)

export const calcSajuTool = tool(
  async ({ person }) => json(describeSaju(person)),
  {
    name: 'calc_saju',
    description: '생년월일시로 사주팔자(4주), 각 기둥의 십신, 오행 분포, 강한/부족한 오행을 계산한다. 한 사람의 기본 성향을 볼 때 먼저 호출.',
    schema: z.object({ person }),
  },
)

export const calcCompatibilityTool = tool(
  async ({ personA, personB }) => json(calcCompatibility(personA, personB)),
  {
    name: 'calc_compatibility',
    description: '두 사람의 궁합을 일간 관계, 일지(배우자궁) 합충, 띠 관계, 오행 보완으로 채점한다. 연인·친구·동료 궁합 모두 사용.',
    schema: z.object({ personA: person, personB: person }),
  },
)

export const getLuckCycleTool = tool(
  async ({ person, year }) => json(getLuckCycle(person, year)),
  {
    name: 'get_luck_cycle',
    description: '10년 단위 대운 목록, 해당 연도가 속한 현재 대운, 그 해의 세운(연운)과 본인 사주와의 합충을 조회한다. "올해 운세", "몇 살에 운이 트이나" 같은 질문에 사용.',
    schema: z.object({
      person,
      year: z.number().int().min(1900).max(2100).describe('조회할 연도'),
    }),
  },
)

export const getMonthlyFortuneTool = tool(
  async ({ person, year, purpose }) => json(getMonthlyFortune(person, year, purpose)),
  {
    name: 'get_monthly_fortune',
    description: '특정 연도 12개월의 월운을 목적별로 채점한다. "올해 여행 가기 좋은 달", "이직하기 좋은 달"처럼 월 단위 질문에 사용. 여러 사람이면 사람마다 호출해 비교한다.',
    schema: z.object({
      person,
      year: z.number().int().min(1900).max(2100),
      purpose,
    }),
  },
)

export const findGoodDatesTool = tool(
  async ({ person, startDate, endDate, purpose, topN }) =>
    json(findGoodDates(person, startDate, endDate, purpose, topN ?? 5)),
  {
    name: 'find_good_dates',
    description: `기간 내 모든 날짜의 일진을 본인 사주와 대조해 목적에 맞는 좋은 날(택일)과 피할 날을 고른다. 최대 ${MAX_DATE_RANGE_DAYS}일. "다음 달 이사하기 좋은 날" 같은 질문에 사용.`,
    schema: z.object({
      person,
      startDate: z.string().describe('시작일 YYYY-MM-DD'),
      endDate: z.string().describe('종료일 YYYY-MM-DD'),
      purpose,
      topN: z.number().int().min(1).max(10).optional().describe('추천 날짜 개수 (기본 5)'),
    }),
  },
)

export const sajuTools = [
  calcSajuTool,
  calcCompatibilityTool,
  getLuckCycleTool,
  getMonthlyFortuneTool,
  findGoodDatesTool,
]
