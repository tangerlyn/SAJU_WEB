// 천간 (10 Heavenly Stems)
export const HEAVENLY_STEMS = ['갑', '을', '병', '정', '무', '기', '경', '신', '임', '계'] as const
export type HeavenlyStem = typeof HEAVENLY_STEMS[number]

// 지지 (12 Earthly Branches)
export const EARTHLY_BRANCHES = ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해'] as const
export type EarthlyBranch = typeof EARTHLY_BRANCHES[number]

// 오행
export const STEM_ELEMENT: Record<HeavenlyStem, string> = {
  갑: '목', 을: '목', 병: '화', 정: '화', 무: '토',
  기: '토', 경: '금', 신: '금', 임: '수', 계: '수',
}

export const BRANCH_ELEMENT: Record<EarthlyBranch, string> = {
  자: '수', 축: '토', 인: '목', 묘: '목', 진: '토', 사: '화',
  오: '화', 미: '토', 신: '금', 유: '금', 술: '토', 해: '수',
}

// 음양
export const STEM_YIN_YANG: Record<HeavenlyStem, '양' | '음'> = {
  갑: '양', 을: '음', 병: '양', 정: '음', 무: '양',
  기: '음', 경: '양', 신: '음', 임: '양', 계: '음',
}

// 육십갑자: index i → { gan: STEMS[i%10], ji: BRANCHES[i%12] }
export const SEXAGENARY_CYCLE = Array.from({ length: 60 }, (_, i) => ({
  gan: HEAVENLY_STEMS[i % 10],
  ji: EARTHLY_BRANCHES[i % 12],
}))

// 시간(hour) → 지지 인덱스 (자=0, 축=1, ...)
export function hourToJiIndex(hour: number): number {
  if (hour === 23) return 0 // 자시
  return Math.floor((hour + 1) / 2) % 12
}

// 월주 천간 기준표: 년간 인덱스%5 → 인월(1월) 천간 인덱스
const MONTH_BASE_STEM: Record<number, number> = {
  0: 2, // 갑/기년 → 인월 = 병(2)
  1: 4, // 을/경년 → 인월 = 무(4)
  2: 6, // 병/신년 → 인월 = 경(6)
  3: 8, // 정/임년 → 인월 = 임(8)
  4: 0, // 무/계년 → 인월 = 갑(0)
}

export function getMonthStemIndex(yearStemIndex: number, sajuMonth: number): number {
  const base = MONTH_BASE_STEM[yearStemIndex % 5]
  // 인월(2월)=offset 0, 묘월(3월)=offset 1, ..., 자월(12월)=offset 10, 축월(1월)=offset 11
  const offset = sajuMonth === 1 ? 11 : sajuMonth - 2
  return (base + offset) % 10
}

// 시주 천간 기준표: 일간 인덱스%5 → 자시 천간 인덱스
const HOUR_BASE_STEM: Record<number, number> = {
  0: 0, // 갑/기일 → 자시 = 갑(0)
  1: 2, // 을/경일 → 자시 = 병(2)
  2: 4, // 병/신일 → 자시 = 무(4)
  3: 6, // 정/임일 → 자시 = 경(6)
  4: 8, // 무/계일 → 자시 = 임(8)
}

export function getHourStemIndex(dayStemIndex: number, jiIndex: number): number {
  const base = HOUR_BASE_STEM[dayStemIndex % 5]
  return (base + jiIndex) % 10
}
