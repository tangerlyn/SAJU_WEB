// 규칙 기반 운세 엔진 — 십신·합충·궁합·대운/세운·월운·택일
// LLM은 이 값을 계산하지 않고, 에이전트 도구를 통해 결과만 받아 해석한다.
import KoreanLunarCalendar from 'korean-lunar-calendar'
import {
  HEAVENLY_STEMS,
  EARTHLY_BRANCHES,
  STEM_ELEMENT,
  STEM_YIN_YANG,
  getMonthStemIndex,
  type HeavenlyStem,
  type EarthlyBranch,
} from './constants'
import {
  calculateSaju,
  getDayIndex,
  makePillar,
  SOLAR_TERM_DAY,
  MONTH_TO_BRANCH_INDEX,
  type Pillar,
  type SajuResult,
} from './pillars'

export interface BirthInput {
  name?: string
  year: number
  month: number
  day: number
  hour?: number
  gender: 'male' | 'female'
  isLunar?: boolean
  isLeapMonth?: boolean
}

// 음력 생일이면 양력으로 변환 (한국천문연구원 기준 만세력)
export function toSolarBirth(p: BirthInput): BirthInput {
  if (!p.isLunar) return p
  const cal = new KoreanLunarCalendar()
  if (!cal.setLunarDate(p.year, p.month, p.day, !!p.isLeapMonth)) {
    throw new Error(`유효하지 않은 음력 날짜입니다: ${p.year}-${p.month}-${p.day}${p.isLeapMonth ? '(윤달)' : ''}`)
  }
  const { year, month, day } = cal.getSolarCalendar()
  return { ...p, year, month, day, isLunar: false, isLeapMonth: false }
}

export function sajuOf(p: BirthInput): SajuResult {
  const b = toSolarBirth(p)
  return calculateSaju(b.year, b.month, b.day, b.hour ?? 12, b.gender)
}

// ── 십신 ────────────────────────────────────────────────

const ELEMENT_CYCLE = ['목', '화', '토', '금', '수'] // 상생 순서

// 지지의 본기(지장간 정기) — 지지 십신은 본기 천간 기준으로 본다
const BRANCH_MAIN_STEM: Record<EarthlyBranch, HeavenlyStem> = {
  자: '계', 축: '기', 인: '갑', 묘: '을', 진: '무', 사: '병',
  오: '정', 미: '기', 신: '경', 유: '신', 술: '무', 해: '임',
}

export type TenGod = '비견' | '겁재' | '식신' | '상관' | '편재' | '정재' | '편관' | '정관' | '편인' | '정인'
export type TenGodGroup = '비겁' | '식상' | '재성' | '관성' | '인성'

// diff = (대상 오행 - 일간 오행) mod 5 → [음양 같음, 음양 다름]
const TEN_GOD_TABLE: [TenGod, TenGod][] = [
  ['비견', '겁재'], // 같은 오행
  ['식신', '상관'], // 내가 생함
  ['편재', '정재'], // 내가 극함
  ['편관', '정관'], // 나를 극함
  ['편인', '정인'], // 나를 생함
]

export const TEN_GOD_GROUP: Record<TenGod, TenGodGroup> = {
  비견: '비겁', 겁재: '비겁', 식신: '식상', 상관: '식상', 편재: '재성',
  정재: '재성', 편관: '관성', 정관: '관성', 편인: '인성', 정인: '인성',
}

export function tenGodOfStem(dayGan: string, gan: string): TenGod {
  const me = ELEMENT_CYCLE.indexOf(STEM_ELEMENT[dayGan as HeavenlyStem])
  const other = ELEMENT_CYCLE.indexOf(STEM_ELEMENT[gan as HeavenlyStem])
  const diff = (other - me + 5) % 5
  const sameYinYang = STEM_YIN_YANG[dayGan as HeavenlyStem] === STEM_YIN_YANG[gan as HeavenlyStem]
  return TEN_GOD_TABLE[diff][sameYinYang ? 0 : 1]
}

export function tenGodOfBranch(dayGan: string, ji: string): TenGod {
  return tenGodOfStem(dayGan, BRANCH_MAIN_STEM[ji as EarthlyBranch])
}

// ── 합·충 ───────────────────────────────────────────────

const stemIdx = (g: string) => HEAVENLY_STEMS.indexOf(g as HeavenlyStem)
const branchIdx = (j: string) => EARTHLY_BRANCHES.indexOf(j as EarthlyBranch)

export function stemRelation(a: string, b: string): '천간합' | '천간충' | null {
  const ia = stemIdx(a)
  const ib = stemIdx(b)
  const d = Math.abs(ia - ib)
  if (d === 5) return '천간합' // 갑기·을경·병신·정임·무계
  if (d === 6 && Math.min(ia, ib) < 4) return '천간충' // 갑경·을신·병임·정계
  return null
}

const WONJIN = new Set(['자미', '축오', '인유', '묘신', '진해', '사술'])

export type BranchRelation = '육합' | '삼합' | '충' | '원진'

export function branchRelations(a: string, b: string): BranchRelation[] {
  const ia = branchIdx(a)
  const ib = branchIdx(b)
  const rel: BranchRelation[] = []
  if ((ia + ib) % 12 === 1) rel.push('육합') // 자축·인해·묘술·진유·사신·오미
  if (ia !== ib && ia % 4 === ib % 4) rel.push('삼합') // 신자진·해묘미·인오술·사유축
  if (Math.abs(ia - ib) === 6) rel.push('충')
  const [x, y] = ia < ib ? [a, b] : [b, a]
  if (WONJIN.has(x + y) || WONJIN.has(y + x)) rel.push('원진')
  return rel
}

// x 오행 기준 y 오행과의 관계
function elementFlow(x: string, y: string): '같음' | '상생(x→y)' | '상생(y→x)' | '상극(x→y)' | '상극(y→x)' {
  const diff = (ELEMENT_CYCLE.indexOf(y) - ELEMENT_CYCLE.indexOf(x) + 5) % 5
  return (['같음', '상생(x→y)', '상극(x→y)', '상극(y→x)', '상생(y→x)'] as const)[diff]
}

// ── 공통 유틸 ───────────────────────────────────────────

function pillarFromCycleIndex(i: number): Pillar {
  const idx = ((i % 60) + 60) % 60
  return makePillar(idx % 10, idx % 12)
}

function cycleIndexOf(p: Pillar): number {
  const g = stemIdx(p.gan)
  const j = branchIdx(p.ji)
  for (let i = 0; i < 60; i++) if (i % 10 === g && i % 12 === j) return i
  throw new Error(`잘못된 간지: ${p.gan}${p.ji}`)
}

export function yearPillarOf(year: number): Pillar {
  return pillarFromCycleIndex(year - 4)
}

export function dayPillarOf(year: number, month: number, day: number): Pillar {
  return pillarFromCycleIndex(getDayIndex(year, month, day))
}

function describePillar(dayGan: string, p: Pillar) {
  return {
    ganji: `${p.gan}${p.ji}`,
    element: `${p.ganElement}·${p.jiElement}`,
    stemTenGod: tenGodOfStem(dayGan, p.gan),
    branchTenGod: tenGodOfBranch(dayGan, p.ji),
  }
}

function clamp(n: number) {
  return Math.max(0, Math.min(100, n))
}

// ── 1. 사주 원국 ────────────────────────────────────────

export function describeSaju(input: BirthInput) {
  const p = toSolarBirth(input)
  const s = sajuOf(p)
  const pillar = (label: string, x: Pillar, isDay = false) => ({
    label,
    ganji: `${x.gan}${x.ji}`,
    element: `${x.ganElement}·${x.jiElement}`,
    stemTenGod: isDay ? '일간(본인)' : tenGodOfStem(s.dayGan, x.gan),
    branchTenGod: tenGodOfBranch(s.dayGan, x.ji),
  })
  return {
    name: p.name,
    gender: p.gender,
    birth: `${p.year}-${p.month}-${p.day} ${p.hour ?? 12}시 (양력)`,
    ...(input.isLunar && { lunarBirth: `${input.year}-${input.month}-${input.day}${input.isLeapMonth ? ' (윤달)' : ''}` }),
    hourKnown: p.hour !== undefined,
    pillars: [
      pillar('년주', s.year),
      pillar('월주', s.month),
      pillar('일주', s.day, true),
      pillar('시주', s.hour),
    ],
    dayGan: `${s.dayGan}(${STEM_YIN_YANG[s.dayGan as HeavenlyStem]}${STEM_ELEMENT[s.dayGan as HeavenlyStem]})`,
    ilju: s.ilju,
    fiveElements: s.fiveElements,
    dominantElement: s.dominantElement,
    lackingElement: s.lackingElement,
  }
}

// ── 2. 궁합 ─────────────────────────────────────────────

const BRANCH_SCORE: Record<BranchRelation, number> = { 육합: 12, 삼합: 8, 충: -12, 원진: -8 }

export function calcCompatibility(a: BirthInput, b: BirthInput) {
  const A = sajuOf(a)
  const B = sajuOf(b)
  const items: { item: string; result: string; score: number }[] = []

  // 일간: 두 사람의 본질
  const sr = stemRelation(A.dayGan, B.dayGan)
  const flow = elementFlow(A.day.ganElement, B.day.ganElement)
  let ganScore = 0
  let ganResult: string
  if (sr === '천간합') {
    ganScore = 15
    ganResult = `${A.dayGan}-${B.dayGan} 천간합 (서로 끌림)`
  } else if (sr === '천간충') {
    ganScore = -10
    ganResult = `${A.dayGan}-${B.dayGan} 천간충 (가치관 충돌)`
  } else if (flow.startsWith('상생')) {
    ganScore = 8
    ganResult = `${A.day.ganElement}·${B.day.ganElement} ${flow.replace('x', 'A').replace('y', 'B')}`
  } else if (flow === '같음') {
    ganScore = 4
    ganResult = `같은 ${A.day.ganElement} 오행 (동질감)`
  } else {
    ganScore = -6
    ganResult = `${A.day.ganElement}·${B.day.ganElement} ${flow.replace('x', 'A').replace('y', 'B')}`
  }
  items.push({ item: '일간 관계', result: ganResult, score: ganScore })

  // 일지: 배우자궁
  const dayRel = branchRelations(A.day.ji, B.day.ji)
  items.push({
    item: '일지(배우자궁) 관계',
    result: dayRel.length ? `${A.day.ji}-${B.day.ji} ${dayRel.join('·')}` : `${A.day.ji}-${B.day.ji} 특별한 합충 없음`,
    score: dayRel.reduce((sum, r) => sum + BRANCH_SCORE[r], 0),
  })

  // 년지: 띠
  const yearRel = branchRelations(A.year.ji, B.year.ji)
  items.push({
    item: '띠(년지) 관계',
    result: yearRel.length ? `${A.year.ji}-${B.year.ji} ${yearRel.join('·')}` : `${A.year.ji}-${B.year.ji} 무난`,
    score: Math.round(yearRel.reduce((sum, r) => sum + BRANCH_SCORE[r], 0) * 0.4),
  })

  // 오행 보완
  if (B.dominantElement === A.lackingElement) {
    items.push({ item: '오행 보완', result: `B의 강한 ${B.dominantElement}이(가) A의 부족한 기운을 채움`, score: 6 })
  }
  if (A.dominantElement === B.lackingElement) {
    items.push({ item: '오행 보완', result: `A의 강한 ${A.dominantElement}이(가) B의 부족한 기운을 채움`, score: 6 })
  }

  const score = clamp(50 + items.reduce((sum, i) => sum + i.score, 0))
  const grade = score >= 80 ? '매우 좋음' : score >= 65 ? '좋음' : score >= 50 ? '보통' : score >= 35 ? '노력 필요' : '주의'

  return {
    personA: { name: a.name, ilju: A.ilju, dayGan: A.dayGan, dominant: A.dominantElement, lacking: A.lackingElement },
    personB: { name: b.name, ilju: B.ilju, dayGan: B.dayGan, dominant: B.dominantElement, lacking: B.lackingElement },
    // 서로를 어떤 십신으로 보는지 (예: 남성에게 정재 = 배우자성)
    aSeesB: tenGodOfStem(A.dayGan, B.dayGan),
    bSeesA: tenGodOfStem(B.dayGan, A.dayGan),
    items,
    score,
    grade,
  }
}

// ── 3. 대운·세운 ────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000

function termDate(year: number, month: number): number {
  return Date.UTC(year, month - 1, SOLAR_TERM_DAY[month])
}

export function getLuckCycle(input: BirthInput, targetYear: number) {
  const p = toSolarBirth(input)
  const s = sajuOf(p)
  // 양남음녀 순행, 음남양녀 역행
  const forward = (STEM_YIN_YANG[s.year.gan as HeavenlyStem] === '양') === (p.gender === 'male')

  const birth = Date.UTC(p.year, p.month - 1, p.day)
  let term: number
  if (forward) {
    term = p.day < SOLAR_TERM_DAY[p.month]
      ? termDate(p.year, p.month)
      : p.month === 12 ? termDate(p.year + 1, 1) : termDate(p.year, p.month + 1)
  } else {
    term = p.day >= SOLAR_TERM_DAY[p.month]
      ? termDate(p.year, p.month)
      : p.month === 1 ? termDate(p.year - 1, 12) : termDate(p.year, p.month - 1)
  }
  // 절입일까지 3일 = 1년
  const startAge = Math.max(1, Math.round(Math.abs(term - birth) / DAY_MS / 3))

  const monthCycle = cycleIndexOf(s.month)
  const cycles = Array.from({ length: 10 }, (_, k) => {
    const pillar = pillarFromCycleIndex(monthCycle + (forward ? k + 1 : -(k + 1)))
    const ageFrom = startAge + k * 10
    return {
      ...describePillar(s.dayGan, pillar),
      ages: `${ageFrom}~${ageFrom + 9}세`,
      years: `${p.year + ageFrom}~${p.year + ageFrom + 9}`,
      startYear: p.year + ageFrom,
      relationWithDayBranch: branchRelations(s.day.ji, pillar.ji),
    }
  })

  const current = cycles.find(c => targetYear >= c.startYear && targetYear < c.startYear + 10) ?? null
  const yp = yearPillarOf(targetYear)

  return {
    direction: forward ? '순행' : '역행',
    startAge,
    ageInTargetYear: targetYear - p.year,
    currentDaeun: current ?? `대운 시작 전 (${startAge}세부터 시작)`,
    seun: {
      year: targetYear,
      ...describePillar(s.dayGan, yp),
      relationWithDayStem: stemRelation(s.dayGan, yp.gan),
      relationWithDayBranch: branchRelations(s.day.ji, yp.ji),
      relationWithYearBranch: branchRelations(s.year.ji, yp.ji),
    },
    allDaeun: cycles,
    note: '대운수는 절입일 근사값(±1일) 기준, 나이는 만 나이 기준입니다.',
  }
}

// ── 4. 월운·택일 공통 점수 ──────────────────────────────

export const PURPOSES = ['general', 'move', 'travel', 'love', 'career', 'money', 'contract', 'study'] as const
export type Purpose = typeof PURPOSES[number]

export const PURPOSE_LABEL: Record<Purpose, string> = {
  general: '전반', move: '이사', travel: '여행', love: '연애·결혼',
  career: '직장·면접', money: '재물·투자', contract: '계약·문서', study: '공부·시험',
}

function favoredGroups(purpose: Purpose, gender: 'male' | 'female'): TenGodGroup[] {
  switch (purpose) {
    case 'move': return ['인성']
    case 'travel': return ['식상']
    case 'love': return gender === 'male' ? ['재성', '식상'] : ['관성', '식상']
    case 'career': return ['관성', '인성']
    case 'money': return ['재성', '식상']
    case 'contract': return ['인성', '재성']
    case 'study': return ['인성', '관성']
    default: return []
  }
}

function avoidedGroups(purpose: Purpose): TenGodGroup[] {
  switch (purpose) {
    case 'money':
    case 'contract': return ['비겁'] // 군겁쟁재
    case 'career': return ['식상'] // 상관견관
    case 'study': return ['재성'] // 재극인
    default: return []
  }
}

const YEOKMA = new Set(['인', '신', '사', '해'])

function scorePillar(s: SajuResult, target: Pillar, purpose: Purpose) {
  const reasons: string[] = []
  let score = 50
  const add = (n: number, why: string) => {
    score += n
    reasons.push(`${n > 0 ? '+' : ''}${n} ${why}`)
  }

  const stemGod = tenGodOfStem(s.dayGan, target.gan)
  const branchGod = tenGodOfBranch(s.dayGan, target.ji)
  const favor = favoredGroups(purpose, s.birthInfo.gender)
  const avoid = avoidedGroups(purpose)

  if (favor.includes(TEN_GOD_GROUP[stemGod])) add(10, `천간 ${stemGod}(${TEN_GOD_GROUP[stemGod]})이 목적에 유리`)
  if (favor.includes(TEN_GOD_GROUP[branchGod])) add(8, `지지 ${branchGod}(${TEN_GOD_GROUP[branchGod]})이 목적에 유리`)
  if (avoid.includes(TEN_GOD_GROUP[stemGod])) add(-8, `천간 ${stemGod}(${TEN_GOD_GROUP[stemGod]})이 목적에 불리`)
  if (avoid.includes(TEN_GOD_GROUP[branchGod])) add(-6, `지지 ${branchGod}(${TEN_GOD_GROUP[branchGod]})이 목적에 불리`)

  if (target.ganElement === s.lackingElement) add(5, `부족한 ${s.lackingElement} 기운 보충(천간)`)
  if (target.jiElement === s.lackingElement) add(4, `부족한 ${s.lackingElement} 기운 보충(지지)`)

  const sr = stemRelation(s.dayGan, target.gan)
  if (sr === '천간합') add(6, `일간 ${s.dayGan}↔${target.gan} 천간합`)
  if (sr === '천간충') add(-8, `일간 ${s.dayGan}↔${target.gan} 천간충`)

  for (const r of branchRelations(s.day.ji, target.ji)) {
    const pts = { 육합: 10, 삼합: 6, 충: -15, 원진: -6 }[r]
    add(pts, `일지 ${s.day.ji}↔${target.ji} ${r}`)
  }

  if (purpose === 'travel' && YEOKMA.has(target.ji)) add(5, `${target.ji}는 역마(이동)의 기운`)

  return {
    ganji: `${target.gan}${target.ji}`,
    stemTenGod: stemGod,
    branchTenGod: branchGod,
    score: clamp(score),
    reasons,
  }
}

// ── 5. 월운 ─────────────────────────────────────────────

export function getMonthlyFortune(p: BirthInput, year: number, purpose: Purpose = 'general') {
  const s = sajuOf(p)
  const months = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1
    // 양력 1월(소한~입춘 전)은 전년도 축월
    const sajuYear = m === 1 ? year - 1 : year
    const yearStem = (((sajuYear - 4) % 60) + 60) % 60 % 10
    const pillar = makePillar(getMonthStemIndex(yearStem, m), MONTH_TO_BRANCH_INDEX[m])
    const nextM = m === 12 ? 1 : m + 1
    return {
      month: m,
      period: `${m}/${SOLAR_TERM_DAY[m]} ~ ${nextM}/${SOLAR_TERM_DAY[nextM] - 1}`,
      ...scorePillar(s, pillar, purpose),
    }
  })
  const ranked = [...months].sort((x, y) => y.score - x.score)
  return {
    year,
    purpose: PURPOSE_LABEL[purpose],
    bestMonths: ranked.slice(0, 3).map(m => m.month),
    worstMonths: ranked.slice(-2).map(m => m.month),
    months,
    note: '월 경계는 절기(절입일) 기준 근사값입니다. 점수는 규칙 기반 참고 지표입니다.',
  }
}

// ── 6. 택일 ─────────────────────────────────────────────

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
export const MAX_DATE_RANGE_DAYS = 92

function parseDate(s: string): { y: number; m: number; d: number; t: number } {
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s)
  if (!match) throw new Error(`날짜 형식은 YYYY-MM-DD 이어야 합니다: ${s}`)
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const t = Date.UTC(y, m - 1, d)
  const check = new Date(t)
  if (check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) throw new Error(`존재하지 않는 날짜입니다: ${s}`)
  return { y, m, d, t }
}

function lunarDayOf(y: number, m: number, d: number): number | null {
  const cal = new KoreanLunarCalendar()
  if (!cal.setSolarDate(y, m, d)) return null
  return cal.getLunarCalendar().day
}

export function findGoodDates(
  p: BirthInput,
  startDate: string,
  endDate: string,
  purpose: Purpose = 'general',
  topN = 5,
) {
  const s = sajuOf(p)
  const start = parseDate(startDate)
  const end = parseDate(endDate)
  const span = Math.round((end.t - start.t) / DAY_MS) + 1
  if (span < 1) throw new Error('종료일이 시작일보다 빠릅니다.')
  if (span > MAX_DATE_RANGE_DAYS) throw new Error(`기간은 최대 ${MAX_DATE_RANGE_DAYS}일까지 조회할 수 있습니다.`)

  const days = Array.from({ length: span }, (_, i) => {
    const date = new Date(start.t + i * DAY_MS)
    const [y, m, d] = [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()]
    const result = scorePillar(s, dayPillarOf(y, m, d), purpose)

    // 이사: 음력 9·10일로 끝나는 날(손 없는 날) 가점
    if (purpose === 'move') {
      const lunarDay = lunarDayOf(y, m, d)
      if (lunarDay !== null && (lunarDay % 10 === 9 || lunarDay % 10 === 0)) {
        result.score = clamp(result.score + 10)
        result.reasons.push(`+10 손 없는 날(음력 ${lunarDay}일)`)
      }
    }

    return {
      date: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      weekday: WEEKDAYS[date.getUTCDay()],
      ...result,
    }
  })

  const ranked = [...days].sort((x, y) => y.score - x.score || x.date.localeCompare(y.date))
  return {
    purpose: PURPOSE_LABEL[purpose],
    range: `${startDate} ~ ${endDate} (${span}일 검사)`,
    best: ranked.slice(0, Math.min(topN, 10)),
    avoid: ranked.slice(-3).reverse().filter(x => x.score < 50),
    note: '일진(日辰)과 본인 일주의 합충·십신을 규칙으로 채점한 참고 지표입니다.',
  }
}
