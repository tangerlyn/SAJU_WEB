import {
  HEAVENLY_STEMS,
  EARTHLY_BRANCHES,
  SEXAGENARY_CYCLE,
  STEM_ELEMENT,
  BRANCH_ELEMENT,
  STEM_YIN_YANG,
  hourToJiIndex,
  getMonthStemIndex,
  getHourStemIndex,
} from './constants'

export interface Pillar {
  gan: string
  ji: string
  ganElement: string
  jiElement: string
}

export interface SajuResult {
  year: Pillar
  month: Pillar
  day: Pillar
  hour: Pillar
  dayGan: string          // 일간 (나를 나타내는 글자)
  ilju: string            // 일주 이름 (예: 갑자일주)
  fiveElements: Record<string, number>  // 오행 개수
  dominantElement: string
  lackingElement: string
  birthInfo: {
    year: number
    month: number
    day: number
    hour: number
    gender: 'male' | 'female'
  }
}

// 절기 기준 사주 월 계산 (근사값 - 대부분 정확, 절기 당일 ±1일 오차 가능)
const SOLAR_TERM_DAY: Record<number, number> = {
  1: 6,   // 소한 → 축월 시작
  2: 4,   // 입춘 → 인월 시작
  3: 6,   // 경칩 → 묘월 시작
  4: 5,   // 청명 → 진월 시작
  5: 6,   // 입하 → 사월 시작
  6: 6,   // 망종 → 오월 시작
  7: 7,   // 소서 → 미월 시작
  8: 7,   // 입추 → 신월 시작
  9: 8,   // 백로 → 유월 시작
  10: 8,  // 한로 → 술월 시작
  11: 7,  // 입동 → 해월 시작
  12: 7,  // 대설 → 자월 시작
}

// 월 → 사주 월지 인덱스 (인월=인(2), 묘월=묘(3), ...)
const MONTH_TO_BRANCH_INDEX: Record<number, number> = {
  1: 1,   // 축 (12지지 index 1)
  2: 2,   // 인 (index 2)
  3: 3,   // 묘 (index 3)
  4: 4,   // 진 (index 4)
  5: 5,   // 사 (index 5)
  6: 6,   // 오 (index 6)
  7: 7,   // 미 (index 7)
  8: 8,   // 신 (index 8)
  9: 9,   // 유 (index 9)
  10: 10, // 술 (index 10)
  11: 11, // 해 (index 11)
  12: 0,  // 자 (index 0)
}

function getSajuMonth(month: number, day: number): number {
  // 절기일 이전이면 이전 사주월
  if (day < SOLAR_TERM_DAY[month]) {
    return month === 1 ? 12 : month - 1
  }
  return month
}

// 기준일: 1900-01-01 = 갑술일 (index 10)
const REF_DATE = new Date(Date.UTC(1900, 0, 1))
const REF_DAY_INDEX = 10

function getDayIndex(year: number, month: number, day: number): number {
  const target = new Date(Date.UTC(year, month - 1, day))
  const diffMs = target.getTime() - REF_DATE.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  return ((diffDays + REF_DAY_INDEX) % 60 + 60) % 60
}

function makePillar(ganIndex: number, jiIndex: number): Pillar {
  const gan = HEAVENLY_STEMS[ganIndex]
  const ji = EARTHLY_BRANCHES[jiIndex]
  return {
    gan,
    ji,
    ganElement: STEM_ELEMENT[gan],
    jiElement: BRANCH_ELEMENT[ji],
  }
}

export function calculateSaju(
  year: number,
  month: number,
  day: number,
  hour: number,
  gender: 'male' | 'female'
): SajuResult {
  // 1. 년주: 입춘(2월4일) 이전이면 전년도
  let sajuYear = year
  if (month < 2 || (month === 2 && day < 4)) {
    sajuYear = year - 1
  }
  const yearIndex = ((sajuYear - 4) % 60 + 60) % 60
  const yearGanIndex = yearIndex % 10
  const yearJiIndex = yearIndex % 12
  const yearPillar = makePillar(yearGanIndex, yearJiIndex)

  // 2. 월주
  const sajuMonth = getSajuMonth(month, day)
  const monthStemIndex = getMonthStemIndex(yearGanIndex, sajuMonth)
  const monthBranchIndex = MONTH_TO_BRANCH_INDEX[sajuMonth]
  const monthPillar = makePillar(monthStemIndex, monthBranchIndex)

  // 3. 일주
  const dayIndex = getDayIndex(year, month, day)
  const dayGanIndex = dayIndex % 10
  const dayJiIndex = dayIndex % 12
  const dayPillar = makePillar(dayGanIndex, dayJiIndex)

  // 4. 시주
  const hourJiIndex = hourToJiIndex(hour)
  const hourStemIndex = getHourStemIndex(dayGanIndex, hourJiIndex)
  const hourPillar = makePillar(hourStemIndex, hourJiIndex)

  // 5. 오행 분포 계산
  const allGans = [yearPillar.gan, monthPillar.gan, dayPillar.gan, hourPillar.gan]
  const allJis = [yearPillar.ji, monthPillar.ji, dayPillar.ji, hourPillar.ji]

  const fiveElements: Record<string, number> = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 }
  allGans.forEach(g => fiveElements[STEM_ELEMENT[g as keyof typeof STEM_ELEMENT]]++)
  allJis.forEach(j => fiveElements[BRANCH_ELEMENT[j as keyof typeof BRANCH_ELEMENT]]++)

  const sorted = Object.entries(fiveElements).sort((a, b) => b[1] - a[1])
  const dominantElement = sorted[0][0]
  const lackingElement = sorted[sorted.length - 1][0]

  return {
    year: yearPillar,
    month: monthPillar,
    day: dayPillar,
    hour: hourPillar,
    dayGan: dayPillar.gan,
    ilju: `${dayPillar.gan}${dayPillar.ji}일주`,
    fiveElements,
    dominantElement,
    lackingElement,
    birthInfo: { year, month, day, hour, gender },
  }
}
