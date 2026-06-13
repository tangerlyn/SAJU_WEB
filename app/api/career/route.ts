import { NextRequest, NextResponse } from 'next/server'
import { calculateSaju } from '../../../lib/saju/pillars'
import { generateCareerReading } from '../../../lib/ai/gemini'
import { CHEONGAN_DATA } from '../../../data/cheongan'
import { getIljuData } from '../../../data/ilju'

export async function POST(req: NextRequest) {
  try {
    const { name, year, month, day, hour, gender } = await req.json()

    if (!name || !year || !month || !day || gender === undefined) {
      return NextResponse.json({ error: '필수 입력값이 없습니다.' }, { status: 400 })
    }

    const saju = calculateSaju(
      Number(year),
      Number(month),
      Number(day),
      Number(hour ?? 12),
      gender as 'male' | 'female',
    )

    const cheonganData = CHEONGAN_DATA[saju.dayGan]
    const iljuData = getIljuData(saju.day.gan, saju.day.ji)

    const reading = await generateCareerReading(saju, name, cheonganData, iljuData)

    return NextResponse.json({ saju, reading })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: '직장운 분석 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
