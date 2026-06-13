'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toPng } from 'html-to-image'
import type { SajuResult } from '../../lib/saju/pillars'

interface StoredResult {
  saju: SajuResult
  reading: string
}

const ELEMENT_COLORS: Record<string, string> = {
  목: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
  화: 'text-rose-400 bg-rose-400/10 border-rose-400/30',
  토: 'text-amber-400 bg-amber-400/10 border-amber-400/30',
  금: 'text-slate-300 bg-slate-300/10 border-slate-300/30',
  수: 'text-sky-400 bg-sky-400/10 border-sky-400/30',
}

const ELEMENT_EMOJI: Record<string, string> = {
  목: '🌿', 화: '🔥', 토: '🪨', 금: '✨', 수: '💧',
}

const SECTION_META = [
  { icon: '🌊', label: '오행 분석',    gradient: 'from-sky-500/20 to-blue-600/20',       border: 'border-sky-500/30',    accent: 'text-sky-300' },
  { icon: '⚡', label: '천간의 장점',  gradient: 'from-yellow-500/20 to-amber-600/20',   border: 'border-yellow-500/30', accent: 'text-yellow-300' },
  { icon: '🔮', label: '천간의 단점',  gradient: 'from-purple-500/20 to-violet-600/20',  border: 'border-purple-500/30', accent: 'text-purple-300' },
  { icon: '🌟', label: '일주의 의미',  gradient: 'from-amber-500/20 to-orange-600/20',   border: 'border-amber-500/30',  accent: 'text-amber-300' },
  { icon: '🧬', label: '성격 분석',    gradient: 'from-indigo-500/20 to-purple-600/20',  border: 'border-indigo-500/30', accent: 'text-indigo-300' },
  { icon: '💎', label: '숨겨진 재능',  gradient: 'from-teal-500/20 to-cyan-600/20',      border: 'border-teal-500/30',   accent: 'text-teal-300' },
  { icon: '🚀', label: '직업 & 미래',  gradient: 'from-emerald-500/20 to-teal-600/20',   border: 'border-emerald-500/30',accent: 'text-emerald-300' },
  { icon: '💰', label: '재물운',        gradient: 'from-green-500/20 to-emerald-600/20',  border: 'border-green-500/30',  accent: 'text-green-300' },
  { icon: '💕', label: '연애/결혼운',  gradient: 'from-pink-500/20 to-rose-600/20',      border: 'border-pink-500/30',   accent: 'text-pink-300' },
  { icon: '🌿', label: '건강운',        gradient: 'from-lime-500/20 to-green-600/20',     border: 'border-lime-500/30',   accent: 'text-lime-300' },
  { icon: '🏡', label: '가족운',        gradient: 'from-orange-500/20 to-amber-600/20',   border: 'border-orange-500/30', accent: 'text-orange-300' },
  { icon: '🤝', label: '인맥/인복',    gradient: 'from-cyan-500/20 to-sky-600/20',       border: 'border-cyan-500/30',   accent: 'text-cyan-300' },
  { icon: '📅', label: '올해 운세',    gradient: 'from-rose-500/20 to-pink-600/20',      border: 'border-rose-500/30',   accent: 'text-rose-300' },
  { icon: '🌈', label: '종합 조언',    gradient: 'from-violet-500/20 to-fuchsia-600/20', border: 'border-violet-500/30', accent: 'text-violet-300' },
]

// 3개 이미지로 나누는 구간 [시작, 끝) — 섹션 배열 인덱스 기준
const ZONES = [
  { label: '1', range: [0, 4] as [number, number] },   // 섹션 1~4  (차트 포함)
  { label: '2', range: [4, 9] as [number, number] },   // 섹션 5~9
  { label: '3', range: [9, 14] as [number, number] },  // 섹션 10~14
]

function parseSections(reading: string): { title: string; body: string }[] {
  const parts = reading.split(/(?=\*\*\d+\.|###\s*\d+\.)/)
  const sections: { title: string; body: string }[] = []
  for (const part of parts) {
    const titleMatch = part.match(/^\*\*(\d+\.\s*.+?)\*\*|^###\s*(\d+\.\s*.+?)(?:\*\*)?$/m)
    if (!titleMatch) continue
    const title = (titleMatch[1] || titleMatch[2]).trim()
    const body = part
      .replace(/^\*\*\d+\.\s*.+?\*\*/m, '')
      .replace(/^###\s*\d+\.\s*.+/m, '')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/^#+\s/gm, '')
      .trim()
    if (body) sections.push({ title, body })
  }
  return sections
}

function SectionBody({ text }: { text: string }) {
  const lines = text.split('\n').filter(l => l.trim())
  return (
    <div className="space-y-2">
      {lines.map((line, i) => {
        const parts = line.split(/(\*\*.+?\*\*)/)
        return (
          <p key={i} className="text-white/80 leading-relaxed text-[15px]">
            {parts.map((p, j) =>
              p.startsWith('**') && p.endsWith('**')
                ? <strong key={j} className="text-white font-semibold">{p.slice(2, -2)}</strong>
                : p
            )}
          </p>
        )
      })}
    </div>
  )
}

function SectionCard({ sec, i }: { sec: { title: string; body: string }; i: number }) {
  const meta = SECTION_META[i] ?? SECTION_META[SECTION_META.length - 1]
  return (
    <div className={`rounded-3xl border bg-gradient-to-br ${meta.gradient} ${meta.border} overflow-hidden`}>
      <div className="flex items-center gap-3 px-5 pt-5 pb-3">
        <span className="text-2xl">{meta.icon}</span>
        <p className={`font-bold text-base ${meta.accent}`}>{sec.title}</p>
      </div>
      <div className="h-px mx-5 bg-gradient-to-r from-transparent via-white/10 to-transparent mb-4" />
      <div className="px-5 pb-5">
        <SectionBody text={sec.body} />
      </div>
    </div>
  )
}

export default function ResultPage() {
  const router = useRouter()
  const [result, setResult] = useState<StoredResult | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  // 3구역 ref
  const zoneRefs = [
    useRef<HTMLDivElement>(null),
    useRef<HTMLDivElement>(null),
    useRef<HTMLDivElement>(null),
  ]

  useEffect(() => {
    const stored = sessionStorage.getItem('sajuResult')
    if (!stored) { router.push('/'); return }
    setResult(JSON.parse(stored))
  }, [router])

  async function captureZone(ref: React.RefObject<HTMLDivElement | null>, filename: string) {
    if (!ref.current) return
    const dataUrl = await toPng(ref.current, {
      cacheBust: true,
      backgroundColor: '#0a0a0f',
      pixelRatio: 2,
    })
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    if (isIOS) {
      window.open(dataUrl, '_blank')
    } else {
      const link = document.createElement('a')
      link.download = filename
      link.href = dataUrl
      link.click()
    }
  }

  async function handleSaveImages() {
    if (!result) return
    setSaving(true)
    setSaveMsg('')
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    try {
      const ilju = result.saju.ilju
      const date = new Date().toLocaleDateString('ko-KR').replace(/\. /g, '-').replace('.', '')
      for (let i = 0; i < zoneRefs.length; i++) {
        await captureZone(zoneRefs[i], `사주_${ilju}_${i + 1}of3_${date}.png`)
        // 이미지 사이 짧은 간격
        if (i < zoneRefs.length - 1) await new Promise(r => setTimeout(r, 400))
      }
      setSaveMsg(isIOS
        ? '새 탭 3개에서 이미지를 길게 눌러 저장하세요 📱'
        : '이미지 3장이 저장됐어요 ✓'
      )
    } catch {
      setSaveMsg('저장 중 오류가 발생했어요')
    } finally {
      setSaving(false)
      setTimeout(() => setSaveMsg(''), 5000)
    }
  }

  if (!result) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
      </div>
    )
  }

  const { saju, reading } = result
  const sections = parseSections(reading)
  const pillars = [
    { label: '년주', gan: saju.year.gan, ji: saju.year.ji, ganEl: saju.year.ganElement, jiEl: saju.year.jiElement },
    { label: '월주', gan: saju.month.gan, ji: saju.month.ji, ganEl: saju.month.ganElement, jiEl: saju.month.jiElement },
    { label: '일주', gan: saju.day.gan, ji: saju.day.ji, ganEl: saju.day.ganElement, jiEl: saju.day.jiElement },
    { label: '시주', gan: saju.hour.gan, ji: saju.hour.ji, ganEl: saju.hour.ganElement, jiEl: saju.hour.jiElement },
  ]

  return (
    <main className="min-h-screen bg-[#0a0a0f] text-white">

      {/* ───── 구역 1: 차트 + 섹션 1~4 ───── */}
      <div ref={zoneRefs[0]} className="bg-[#0a0a0f]">
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-purple-950/60 via-indigo-950/40 to-transparent pointer-events-none" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative max-w-2xl mx-auto px-4 pt-10 pb-6">
            <button
              onClick={() => router.push('/')}
              className="mb-6 text-white/40 hover:text-white/70 flex items-center gap-2 text-sm transition-colors"
            >
              ← 다시 보기
            </button>

            <div className="text-center mb-8">
              <p className="text-white/40 text-sm mb-1">
                {saju.birthInfo.year}.{saju.birthInfo.month}.{saju.birthInfo.day} ·{' '}
                {saju.birthInfo.gender === 'male' ? '남' : '여'}
              </p>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-300 via-pink-300 to-amber-300 bg-clip-text text-transparent">
                {saju.ilju}
              </h1>
              <p className="text-white/40 text-sm mt-1">일간 {saju.dayGan} · {saju.day.ganElement}의 기운</p>
            </div>

            {/* 사주팔자 카드 */}
            <div className="bg-white/[0.04] backdrop-blur-xl rounded-3xl p-5 border border-white/10 mb-4">
              <p className="text-center text-xs text-white/30 mb-4 tracking-widest uppercase">四柱八字</p>
              <div className="grid grid-cols-4 gap-2 mb-5">
                {pillars.map((p) => (
                  <div key={p.label} className="text-center">
                    <p className="text-[10px] text-white/30 mb-2 tracking-wider">{p.label}</p>
                    <div className={`rounded-2xl border py-3 mb-1.5 ${ELEMENT_COLORS[p.ganEl]}`}>
                      <div className="text-2xl font-bold">{p.gan}</div>
                      <div className="text-[10px] opacity-60 mt-0.5">{p.ganEl}</div>
                    </div>
                    <div className={`rounded-2xl border py-3 ${ELEMENT_COLORS[p.jiEl]}`}>
                      <div className="text-2xl font-bold">{p.ji}</div>
                      <div className="text-[10px] opacity-60 mt-0.5">{p.jiEl}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t border-white/10 pt-4">
                <p className="text-[10px] text-white/30 text-center mb-3 tracking-widest">오행 분포</p>
                <div className="flex gap-1.5 justify-center flex-wrap">
                  {Object.entries(saju.fiveElements).map(([el, cnt]) => (
                    <div key={el} className={`flex items-center gap-1 rounded-full px-3 py-1 border text-xs font-medium ${ELEMENT_COLORS[el]}`}>
                      <span>{ELEMENT_EMOJI[el]}</span>
                      <span>{el}</span>
                      <span className="opacity-60">{cnt}</span>
                    </div>
                  ))}
                </div>
                <p className="text-center text-[11px] text-white/25 mt-2.5">
                  강한 기운 {saju.dominantElement} · 필요한 기운 {saju.lackingElement}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 섹션 1~4 */}
        <div className="max-w-2xl mx-auto px-4 pb-6 space-y-3">
          {sections.slice(ZONES[0].range[0], ZONES[0].range[1]).map((sec, i) => (
            <SectionCard key={i} sec={sec} i={ZONES[0].range[0] + i} />
          ))}
        </div>
      </div>

      {/* ───── 구역 2: 섹션 5~9 ───── */}
      <div ref={zoneRefs[1]} className="bg-[#0a0a0f]">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-3">
          {/* 구역 상단 워터마크 */}
          <p className="text-center text-xs text-white/15 pb-1">✦ 사주팔자 풀이 2/3 ✦</p>
          {sections.slice(ZONES[1].range[0], ZONES[1].range[1]).map((sec, i) => (
            <SectionCard key={i} sec={sec} i={ZONES[1].range[0] + i} />
          ))}
        </div>
      </div>

      {/* ───── 구역 3: 섹션 10~14 ───── */}
      <div ref={zoneRefs[2]} className="bg-[#0a0a0f]">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-3">
          <p className="text-center text-xs text-white/15 pb-1">✦ 사주팔자 풀이 3/3 ✦</p>
          {sections.slice(ZONES[2].range[0], ZONES[2].range[1]).map((sec, i) => (
            <SectionCard key={i} sec={sec} i={ZONES[2].range[0] + i} />
          ))}
        </div>
      </div>

      {/* ───── 하단 버튼 (캡처 제외) ───── */}
      <div className="max-w-2xl mx-auto px-4 pb-20 space-y-3">
        <button
          onClick={handleSaveImages}
          disabled={saving}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-purple-600/40 to-indigo-600/40 border border-purple-500/40 text-white font-semibold hover:from-purple-600/60 hover:to-indigo-600/60 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
        >
          {saving ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              이미지 생성 중... (3장)
            </>
          ) : (
            '📸 이미지 3장으로 저장하기'
          )}
        </button>

        {saveMsg && (
          <p className="text-center text-sm text-white/50">{saveMsg}</p>
        )}

        <button
          onClick={() => router.push('/')}
          className="w-full py-3.5 rounded-2xl bg-white/[0.03] border border-white/10 text-white/40 hover:bg-white/[0.07] hover:text-white/60 transition-all text-sm"
        >
          다른 사람 사주 보기
        </button>
      </div>
    </main>
  )
}
