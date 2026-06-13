import { GoogleGenerativeAI } from '@google/generative-ai'
import type { SajuResult } from '../saju/pillars'
import type { CheonganData } from '../../data/cheongan'
import type { IljuData } from '../../data/ilju'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export async function generateSajuReading(
  saju: SajuResult,
  name: string,
  cheonganData: CheonganData,
  iljuData: IljuData | undefined,
): Promise<string> {
  // 모델 우선순위: 사용 가능한 첫 번째 모델을 사용
  const MODEL_CANDIDATES = [
    'gemini-flash-lite-latest',
    'gemini-2.0-flash-exp',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-1.5-flash-8b',
  ]

  const elementStr = Object.entries(saju.fiveElements)
    .map(([el, cnt]) => `${el}(${cnt}개)`)
    .join(', ')

  const prompt = `당신은 30년 경력의 한국 사주 전문가입니다. 아래 사주 데이터를 바탕으로 정확하고 따뜻하며 구체적인 사주 풀이를 작성해주세요.

=== 기본 정보 ===
이름: ${name}
성별: ${saju.birthInfo.gender === 'male' ? '남성' : '여성'}
생년월일: ${saju.birthInfo.year}년 ${saju.birthInfo.month}월 ${saju.birthInfo.day}일 ${saju.birthInfo.hour}시

=== 사주팔자 ===
년주: ${saju.year.gan}${saju.year.ji} (${saju.year.ganElement}·${saju.year.jiElement})
월주: ${saju.month.gan}${saju.month.ji} (${saju.month.ganElement}·${saju.month.jiElement})
일주: ${saju.day.gan}${saju.day.ji} (${saju.day.ganElement}·${saju.day.jiElement})
시주: ${saju.hour.gan}${saju.hour.ji} (${saju.hour.ganElement}·${saju.hour.jiElement})
일간(나를 대표하는 글자): ${saju.dayGan}

=== 오행 분포 ===
${elementStr}
가장 강한 오행: ${saju.dominantElement}
부족한 오행(용신 후보): ${saju.lackingElement}

=== 일간(${saju.dayGan}) 특성 데이터 ===
상징: ${cheonganData.symbol}
성격: ${cheonganData.personality}
장점: ${cheonganData.strengths.join(', ')}
단점: ${cheonganData.weaknesses.join(', ')}
추천 직업: ${cheonganData.careers.join(', ')}
재물운: ${cheonganData.wealth}
연애운: ${cheonganData.love}
건강: ${cheonganData.health}

=== 일주(${saju.ilju}) 데이터 ===
${iljuData ? `
핵심 특성: ${iljuData.core}
성격: ${iljuData.personality}
장점: ${iljuData.strengths}
단점: ${iljuData.weaknesses}
직업: ${iljuData.career}
재물: ${iljuData.wealth}
연애: ${iljuData.love}
가족: ${iljuData.family}
인맥: ${iljuData.network}
` : '(해당 일주 데이터 없음 - 위 데이터 기반으로 유추하세요)'}

=== 출력 규칙 (반드시 준수) ===
- 각 항목은 반드시 **최소 6~8문장 이상** 작성할 것
- 단순 나열이 아닌 스토리텔링 방식으로 흐름 있게 서술할 것
- ${name} 님이라고 이름을 자주 불러주며 개인화된 느낌을 줄 것
- 구체적인 상황 예시, 비유, 실용적인 조언을 포함할 것
- 부정적인 내용도 "이렇게 하면 극복할 수 있다"는 해결책과 함께 서술할 것
- 현대적이고 따뜻한 언어를 사용하되, 어렵거나 딱딱한 한자 용어는 풀어서 설명할 것

=== 출력 형식 ===
아래 14개 항목을 순서대로 작성하세요.

**1. 오행 분석**
오행(목·화·토·금·수) 각각의 개수를 먼저 언급하고, 강한 기운과 부족한 기운이 성격·삶·습관에 구체적으로 어떤 영향을 미치는지 서술하세요. 오행 불균형을 보완하는 실용적인 방법(색깔, 방향, 음식, 활동 등)도 알려주세요.

**2. 천간의 장점**
${saju.dayGan}이 가진 타고난 강점, 능력, 재능을 구체적인 상황 예시와 함께 서술하세요. 이 강점이 인생에서 어떤 방식으로 빛을 발하는지도 설명하세요.

**3. 천간의 단점**
${saju.dayGan}의 약점과 무의식적으로 반복되는 패턴을 솔직하게 서술하세요. 각 단점을 어떻게 인식하고 극복할 수 있는지 실용적인 조언과 함께 작성하세요.

**4. ${saju.ilju}의 의미**
60개 일주 중 이 일주를 타고난 것의 운명적 의미, 전생과 연결되는 카르마적 특성, 이 일주를 가진 사람들의 공통적인 인생 패턴을 서술하세요. 유명인이나 구체적 예시를 들어도 좋습니다.

**5. 성격 상세 분석**
사람들이 처음 만났을 때 느끼는 ${name} 님의 인상, 가까워진 후에야 보이는 내면, 혼자 있을 때의 모습까지 입체적으로 분석하세요. 스트레스를 받을 때 나오는 행동 패턴과 행복할 때의 모습도 서술하세요.

**6. 숨겨진 재능과 적성**
${name} 님이 스스로 인식하지 못하는 숨겨진 재능, 특별히 타고난 감각, 다른 사람보다 월등히 뛰어난 능력이 무엇인지 서술하세요. 이 재능을 발굴하고 키울 수 있는 방법도 알려주세요.

**7. 직업 & 미래 방향**
가장 잘 맞는 직업군과 그 이유를 구체적으로 서술하세요. 20대·30대·40대 각 시기별로 집중해야 할 방향도 제시하세요. 피해야 할 직업이나 환경도 함께 알려주세요.

**8. 재물운**
재물이 들어오는 시기와 방식, 어떤 방법으로 돈을 버는 게 유리한지 서술하세요. 돈을 모으는 습관, 투자 방향, 반드시 조심해야 할 재물 손실 패턴도 구체적으로 알려주세요.

**9. 연애/결혼운**
연애할 때 나오는 패턴과 습관, 이상적인 파트너의 특성(사주 오행 기준으로도 설명), 연애에서 반복되는 문제와 해결책을 서술하세요. 결혼 시기의 흐름, 배우자복, 결혼 후 가정의 모습도 그려주세요.

**10. 건강운**
${saju.dayGan}과 오행 분포를 기반으로 선천적으로 취약한 신체 부위와 장기를 서술하세요. 나이대별로 주의해야 할 건강 이슈, 건강을 지키는 생활 습관과 음식, 피해야 할 것들도 구체적으로 알려주세요.

**11. 가족운**
부모님과의 관계 특성, 형제자매와의 관계, 자녀와의 인연을 서술하세요. 가족 관계에서 반복되는 패턴과 가정을 화목하게 만드는 방법도 알려주세요.

**12. 인맥/인복**
${name} 님 인생에 나타나는 귀인의 특징(어떤 사람이 귀인인지), 인간관계를 맺는 패턴, 조심해야 할 사람의 유형도 서술하세요. 인복을 최대한 활용하는 방법과 넓혀가는 방법도 알려주세요.

**13. 올해(2026년) 운세**
2026년의 연간 천간지지 기운이 ${name} 님의 사주와 어떻게 작용하는지 분석하세요. 올해 특히 좋은 분야(재물·직업·연애·건강 중), 조심해야 할 시기, 올해를 잘 보내기 위한 핵심 조언을 서술하세요.

**14. 종합 조언 — 어떻게 살아야 하는가**
${name} 님의 사주 전체를 아우르는 인생의 핵심 테마와 이번 생의 과제를 서술하세요. 어떤 마음가짐과 방향으로 살아갈 때 가장 빛날 수 있는지, 마지막으로 진심 어린 응원의 말로 마무리해 주세요.

전문적이면서도 친근하고 따뜻한 톤으로 작성하되, 지나치게 어렵거나 딱딱한 한자 용어는 피하고 현대적인 언어로 풀어서 설명하세요. 부정적인 내용도 성장과 극복의 관점에서 긍정적으로 마무리하세요.`

  const MAX_RETRIES = 5
  const BASE_DELAY_MS = 7000

  for (const modelName of MODEL_CANDIDATES) {
    const model = genAI.getGenerativeModel({ model: modelName })
    console.log(`[Gemini] 모델 시도: ${modelName}`)

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const result = await model.generateContent(prompt)
        console.log(`[Gemini] 성공: ${modelName}`)
        return result.response.text()
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        const is404 = msg.includes('404') || msg.includes('not found')
        const is429 = msg.includes('429') || msg.includes('quota') || msg.includes('Too Many Requests')

        if (is404) {
          console.log(`[Gemini] ${modelName} 사용 불가 (404), 다음 모델 시도`)
          break // 다음 모델로
        }

        if (is429 && attempt < MAX_RETRIES) {
          const retryMatch = msg.match(/(\d+)s/)
          const waitMs = retryMatch ? (parseInt(retryMatch[1]) + 2) * 1000 : BASE_DELAY_MS * attempt
          console.log(`[Gemini] ${modelName} 쿼터 초과, ${waitMs / 1000}초 후 재시도 (${attempt}/${MAX_RETRIES})`)
          await new Promise(res => setTimeout(res, waitMs))
          continue
        }

        if (is429) {
          console.log(`[Gemini] ${modelName} 쿼터 초과 재시도 한계, 다음 모델 시도`)
          break // 다음 모델로
        }

        throw err // 예상치 못한 오류는 즉시 throw
      }
    }
  }

  throw new Error('사용 가능한 Gemini 모델이 없습니다. API 키와 계정 상태를 확인하세요.')
}
