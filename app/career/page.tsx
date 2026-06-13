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
  목: 'text-emerald-600 bg-emerald-50 border-emerald-300',
  화: 'text-rose-600 bg-rose-50 border-rose-300',
  토: 'text-amber-600 bg-amber-50 border-amber-300',
  금: 'text-slate-600 bg-slate-50 border-slate-300',
  수: 'text-sky-600 bg-sky-50 border-sky-300',
}

const ELEMENT_EMOJI: Record<string, string> = {
  목: '🌿', 화: '🔥', 토: '🪨', 금: '✨', 수: '💧',
}

const SECTION_META = [
  { icon: '🌊', label: '오행 직업 기질',   gradient: 'from-sky-50 to-blue-50',       border: 'border-sky-200',     accent: 'text-sky-600' },
  { icon: '🏢', label: '잘 맞는 직장',      gradient: 'from-emerald-50 to-teal-50',   border: 'border-emerald-200', accent: 'text-emerald-600' },
  { icon: '🚀', label: '직장에서 빛나는 법', gradient: 'from-violet-50 to-indigo-50',  border: 'border-violet-200',  accent: 'text-violet-600' },
  { icon: '🤝', label: '직장 인간관계',      gradient: 'from-amber-50 to-orange-50',   border: 'border-amber-200',   accent: 'text-amber-600' },
  { icon: '⏰', label: '취업·이직·승진 적기', gradient: 'from-rose-50 to-pink-50',     border: 'border-rose-200',    accent: 'text-rose-600' },
  { icon: '📅', label: '2026 직장운 월별',   gradient: 'from-blue-50 to-indigo-50',    border: 'border-blue-200',    accent: 'text-blue-600' },
  { icon: '🗺️', label: '평생 커리어 로드맵', gradient: 'from-teal-50 to-cyan-50',      border: 'border-teal-200',    accent: 'text-teal-600' },
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
          <p key={i} className="text-gray-700 leading-relaxed text-[15px]">
            {parts.map((p, j) =>
              p.startsWith('**') && p.endsWith('**')
                ? <strong key={j} className="text-gray-900 font-semibold">{p.slice(2, -2)}</strong>
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
      <div className={`h-px mx-5 ${meta.border} opacity-50 mb-4`} />
      <div className="px-5 pb-5">
        <SectionBody text={sec.body} />
      </div>
    </div>
  )
}

export default function CareerPage() {
  const router = useRouter()
  const [result, setResult] = useState<StoredResult | null>(null)
  const [saving, setSaving] = useState(false)
  const [modalImages, setModalImages] = useState<string[]>([])

  const captureRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const stored = sessionStorage.getItem('careerResult')
    if (!stored) { router.push('/'); return }
    setResult(JSON.parse(stored))
  }, [router])

  async function handleSave() {
    if (!result || !captureRef.current) return
    setSaving(true)
    try {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
      const dataUrl = await toPng(captureRef.current, {
        cacheBust: true,
        backgroundColor: '#f0fdf4',
        pixelRatio: isIOS ? 1.5 : 2,
      })
      if (isIOS) {
        setModalImages([dataUrl])
      } else {
        const date = new Date().toLocaleDateString('ko-KR').replace(/\. /g, '-').replace('.', '')
        const link = document.createElement('a')
        link.download = `직장운_${result.saju.ilju}_${date}.png`
        link.href = dataUrl
        link.click()
      }
    } catch (err) {
      console.error(err)
      alert('이미지 생성 중 오류가 발생했어요.')
    } finally {
      setSaving(false)
    }
  }

  if (!result) {
    return (
      <div className="min-h-screen bg-emerald-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-300 border-t-emerald-500 rounded-full animate-spin" />
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
    <main className="min-h-screen bg-gradient-to-b from-emerald-50 via-teal-50 to-white text-gray-900">

      {/* iOS 저장 모달 */}
      {modalImages.length > 0 && (
        <div className="fixed inset-0 bg-white/98 z-50 overflow-y-auto">
          <div className="max-w-lg mx-auto px-4 py-8">
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-gray-800 font-bold text-lg">이미지 저장</p>
                <p className="text-gray-500 text-sm mt-0.5">이미지를 길게 눌러 사진 저장 📱</p>
              </div>
              <button
                onClick={() => setModalImages([])}
                className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 hover:bg-emerald-200"
              >
                ✕
              </button>
            </div>
            {modalImages.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={src} alt="직장운 풀이" className="w-full rounded-2xl border border-emerald-100" />
            ))}
            <button
              onClick={() => setModalImages([])}
              className="w-full mt-6 py-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-gray-500 text-sm hover:bg-emerald-100"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* ───── 캡처 영역 ───── */}
      <div ref={captureRef} className="bg-gradient-to-b from-emerald-50 via-teal-50 to-white">
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-emerald-200/40 via-teal-100/30 to-transparent pointer-events-none" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-emerald-300/20 rounded-full blur-3xl pointer-events-none" />

          <div className="relative max-w-2xl mx-auto px-4 pt-10 pb-6">
            <button
              onClick={() => router.push('/')}
              className="mb-6 text-gray-400 hover:text-gray-600 flex items-center gap-2 text-sm transition-colors"
            >
              ← 다시 보기
            </button>

            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 bg-emerald-100 text-emerald-700 text-xs font-semibold px-3 py-1 rounded-full mb-3">
                💼 직장운 집중 분석
              </div>
              <p className="text-gray-500 text-sm mb-1">
                {saju.birthInfo.year}.{saju.birthInfo.month}.{saju.birthInfo.day} ·{' '}
                {saju.birthInfo.gender === 'male' ? '남' : '여'}
              </p>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 via-teal-500 to-sky-500 bg-clip-text text-transparent">
                {saju.ilju}
              </h1>
              <p className="text-gray-500 text-sm mt-1">일간 {saju.dayGan} · {saju.day.ganElement}의 기운</p>
            </div>

            {/* 사주팔자 + 오행 분포 */}
            <div className="bg-white rounded-3xl p-5 border border-emerald-200 shadow-sm mb-4">
              <p className="text-center text-xs text-gray-400 mb-4 tracking-widest uppercase">四柱八字</p>
              <div className="grid grid-cols-4 gap-2 mb-5">
                {pillars.map((p) => (
                  <div key={p.label} className="text-center">
                    <p className="text-[10px] text-gray-400 mb-2 tracking-wider">{p.label}</p>
                    <div className={`rounded-2xl border py-3 mb-1.5 ${ELEMENT_COLORS[p.ganEl]}`}>
                      <div className="text-2xl font-bold">{p.gan}</div>
                      <div className="text-[10px] opacity-70 mt-0.5">{p.ganEl}</div>
                    </div>
                    <div className={`rounded-2xl border py-3 ${ELEMENT_COLORS[p.jiEl]}`}>
                      <div className="text-2xl font-bold">{p.ji}</div>
                      <div className="text-[10px] opacity-70 mt-0.5">{p.jiEl}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t border-emerald-100 pt-4">
                <p className="text-[10px] text-gray-400 text-center mb-3 tracking-widest">오행 분포</p>
                <div className="flex gap-1.5 justify-center flex-wrap">
                  {Object.entries(saju.fiveElements).map(([el, cnt]) => (
                    <div key={el} className={`flex items-center gap-1 rounded-full px-3 py-1 border text-xs font-medium ${ELEMENT_COLORS[el]}`}>
                      <span>{ELEMENT_EMOJI[el]}</span>
                      <span>{el}</span>
                      <span className="opacity-60">{cnt}</span>
                    </div>
                  ))}
                </div>
                <p className="text-center text-[11px] text-gray-400 mt-2.5">
                  강한 기운 {saju.dominantElement} · 필요한 기운 {saju.lackingElement}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 직장운 섹션 */}
        <div className="max-w-2xl mx-auto px-4 pb-10 space-y-3">
          {sections.map((sec, i) => (
            <SectionCard key={i} sec={sec} i={i} />
          ))}
        </div>
      </div>

      {/* 하단 버튼 */}
      <div className="max-w-2xl mx-auto px-4 pb-20 space-y-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 border border-emerald-300 text-white font-semibold disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-sm shadow-emerald-200"
        >
          {saving ? (
            <>
              <span className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
              이미지 생성 중...
            </>
          ) : (
            '📸 이미지로 저장하기'
          )}
        </button>

        <button
          onClick={() => router.push('/')}
          className="w-full py-3.5 rounded-2xl bg-white border border-emerald-200 text-gray-500 hover:bg-emerald-50 hover:text-gray-700 transition-all text-sm"
        >
          처음으로 돌아가기
        </button>
      </div>
    </main>
  )
}
