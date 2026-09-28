'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import type { AgentEvent } from '../api/agent/route'

interface Step {
  id: string
  name: string
  args: Record<string, unknown>
  status: 'running' | 'ok' | 'error'
  result?: unknown
}

type Turn =
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string; steps: Step[]; pending: boolean; error?: string }

const TOOL_META: Record<string, { icon: string; label: string }> = {
  calc_saju: { icon: '☯', label: '사주 계산' },
  calc_compatibility: { icon: '💞', label: '궁합 계산' },
  get_luck_cycle: { icon: '🌊', label: '대운·세운 조회' },
  get_monthly_fortune: { icon: '📅', label: '월운 조회' },
  find_good_dates: { icon: '🗓️', label: '좋은 날 찾기' },
}

const EXAMPLES = [
  '나는 1998년 7월 15일 오후 2시생 여자야. 올해 운세 어때?',
  '나(1998.7.15 여)랑 친구(1997.3.2 남) 궁합 보고, 올해 같이 여행 가기 좋은 달도 알려줘',
  '1995년 음력 3월 3일생 남자인데 다음 달에 이사하기 좋은 날 골라줘',
]

type Person = { name?: string; year?: number; month?: number; day?: number }

function personLabel(p: unknown): string {
  const x = p as Person | undefined
  if (!x) return ''
  return x.name ?? `${x.year}.${x.month}.${x.day}`
}

function summarizeArgs(name: string, args: Record<string, unknown>): string {
  const parts: string[] = []
  if (args.person) parts.push(personLabel(args.person))
  if (args.personA) parts.push(`${personLabel(args.personA)} × ${personLabel(args.personB)}`)
  if (args.year) parts.push(`${args.year}년`)
  if (args.startDate) parts.push(`${args.startDate} ~ ${args.endDate}`)
  if (args.purpose && args.purpose !== 'general' && name !== 'calc_saju') parts.push(String(args.purpose))
  return parts.join(' · ')
}

// 도구 결과 중 요약 표시에 쓰는 필드만
interface ToolSummary {
  ilju?: string
  dominantElement?: string
  lackingElement?: string
  score?: number
  grade?: string
  seun?: { ganji: string }
  currentDaeun?: { ganji: string } | string
  bestMonths?: number[]
  best?: { date: string }[]
}

function summarizeResult(name: string, result: unknown): string {
  if (typeof result === 'string') return result.replace(/^Error:\s*/, '').split('\n')[0]
  const r = result as ToolSummary
  switch (name) {
    case 'calc_saju':
      return `${r.ilju} · 강한 ${r.dominantElement} / 부족한 ${r.lackingElement}`
    case 'calc_compatibility':
      return `${r.score}점 (${r.grade})`
    case 'get_luck_cycle':
      return `세운 ${r.seun?.ganji}${typeof r.currentDaeun === 'object' ? ` · 대운 ${r.currentDaeun.ganji}` : ''}`
    case 'get_monthly_fortune':
      return `좋은 달 ${r.bestMonths?.join(', ')}월`
    case 'find_good_dates':
      return `추천 ${r.best?.slice(0, 3).map(d => d.date.slice(5)).join(', ')}`
    default:
      return ''
  }
}

function StepCard({ step }: { step: Step }) {
  const [open, setOpen] = useState(false)
  const meta = TOOL_META[step.name] ?? { icon: '🔧', label: step.name }
  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50/60 text-xs">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left"
      >
        {step.status === 'running' ? (
          <span className="w-3.5 h-3.5 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin shrink-0" />
        ) : (
          <span className="shrink-0">{step.status === 'ok' ? meta.icon : '⚠️'}</span>
        )}
        <span className="font-semibold text-blue-700 shrink-0">{meta.label}</span>
        <span className="text-gray-500 truncate">{summarizeArgs(step.name, step.args)}</span>
        {step.status !== 'running' && (
          <span className={`ml-auto shrink-0 ${step.status === 'ok' ? 'text-emerald-600' : 'text-rose-500'}`}>
            {summarizeResult(step.name, step.result)}
          </span>
        )}
      </button>
      {open && (
        <pre className="px-3 pb-3 max-h-64 overflow-auto text-[11px] text-gray-600 whitespace-pre-wrap break-all">
          <span className="font-semibold text-gray-700">입력</span>
          {'\n' + JSON.stringify(step.args, null, 2)}
          {step.result !== undefined && (
            <>
              {'\n\n'}
              <span className="font-semibold text-gray-700">결과 (규칙 엔진)</span>
              {'\n' + (typeof step.result === 'string' ? step.result : JSON.stringify(step.result, null, 2))}
            </>
          )}
        </pre>
      )}
    </div>
  )
}

function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*.+?\*\*)/)
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('**') && p.endsWith('**')
          ? <strong key={i} className="text-gray-900 font-semibold">{p.slice(2, -2)}</strong>
          : p
      )}
    </>
  )
}

function Markdown({ text }: { text: string }) {
  const lines = text.split('\n').filter(l => l.trim())
  return (
    <div className="space-y-2">
      {lines.map((line, i) => {
        const heading = line.match(/^#{1,6}\s+(.*)$/)
        if (heading) return <p key={i} className="font-bold text-blue-700 pt-1"><Inline text={heading[1]} /></p>
        const bullet = line.match(/^\s*(?:[-*•]|\d+\.)\s+(.*)$/)
        if (bullet) {
          return (
            <p key={i} className="pl-4 relative text-gray-700 leading-relaxed">
              <span className="absolute left-0 text-blue-400">•</span>
              <Inline text={bullet[1]} />
            </p>
          )
        }
        return <p key={i} className="text-gray-700 leading-relaxed"><Inline text={line} /></p>
      })}
    </div>
  )
}

export default function ChatPage() {
  const [turns, setTurns] = useState<Turn[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [turns])

  function updateLast(fn: (t: Extract<Turn, { role: 'assistant' }>) => Extract<Turn, { role: 'assistant' }>) {
    setTurns(prev => {
      const last = prev[prev.length - 1]
      if (!last || last.role !== 'assistant') return prev
      return [...prev.slice(0, -1), fn(last)]
    })
  }

  function handleEvent(e: AgentEvent) {
    switch (e.type) {
      case 'tool_call':
        updateLast(t => ({ ...t, steps: [...t.steps, { id: e.id, name: e.name, args: e.args, status: 'running' }] }))
        break
      case 'tool_result':
        updateLast(t => ({
          ...t,
          steps: t.steps.map(s => (s.id === e.id ? { ...s, status: e.ok ? 'ok' : 'error', result: e.result } : s)),
        }))
        break
      case 'answer':
        updateLast(t => ({ ...t, content: t.content ? `${t.content}\n\n${e.content}` : e.content }))
        break
      case 'error':
        updateLast(t => ({ ...t, error: e.message }))
        break
      case 'done':
        updateLast(t => ({ ...t, pending: false }))
        break
    }
  }

  async function send(text: string) {
    const content = text.trim()
    if (!content || busy) return

    // 서버로는 완료된 텍스트 대화만 보낸다 (도구 기록은 매 턴 재계산)
    const history = [
      ...turns
        .filter(t => t.role === 'user' || (t.content && !t.error))
        .map(t => ({ role: t.role, content: t.content })),
      { role: 'user' as const, content },
    ]

    setTurns(prev => [...prev, { role: 'user', content }, { role: 'assistant', content: '', steps: [], pending: true }])
    setInput('')
    setBusy(true)

    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
      })
      if (!res.ok || !res.body) throw new Error('API 오류')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) if (line.trim()) handleEvent(JSON.parse(line))
      }
    } catch {
      updateLast(t => ({ ...t, error: '연결에 실패했어요. 잠시 후 다시 시도해주세요.' }))
    } finally {
      updateLast(t => ({ ...t, pending: false }))
      setBusy(false)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-100 via-sky-50 to-white text-gray-900 flex flex-col">
      <div className="max-w-2xl w-full mx-auto px-4 pt-8 pb-4 flex-1 flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <Link href="/" className="text-sm text-blue-500 hover:text-blue-700">← 홈</Link>
          <div className="text-center">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-500 to-indigo-500 bg-clip-text text-transparent">
              ☯ 사주 상담 에이전트
            </h1>
            <p className="text-xs text-gray-500 mt-1">계산은 규칙 엔진이, 해석은 AI가 해요</p>
          </div>
          <span className="w-8" />
        </div>

        {/* 대화 */}
        <div className="flex-1 space-y-4">
          {turns.length === 0 && (
            <div className="bg-white rounded-2xl border border-blue-200 p-5 shadow-sm">
              <p className="text-sm text-gray-600 mb-3">
                생년월일과 성별을 알려주시면 사주·궁합·대운·좋은 달·좋은 날까지 필요한 계산을 알아서 해서 답해드려요.
              </p>
              <div className="space-y-2">
                {EXAMPLES.map(ex => (
                  <button
                    key={ex}
                    type="button"
                    onClick={() => send(ex)}
                    className="w-full text-left text-sm px-4 py-3 rounded-xl bg-blue-50 border border-blue-100 text-blue-700 hover:bg-blue-100 transition-colors"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          )}

          {turns.map((t, i) =>
            t.role === 'user' ? (
              <div key={i} className="flex justify-end">
                <div className="max-w-[85%] bg-blue-500 text-white rounded-2xl rounded-br-md px-4 py-3 text-[15px] whitespace-pre-wrap">
                  {t.content}
                </div>
              </div>
            ) : (
              <div key={i} className="bg-white rounded-2xl rounded-bl-md border border-blue-100 shadow-sm px-4 py-4 space-y-3">
                {t.steps.length > 0 && (
                  <div className="space-y-1.5">
                    {t.steps.map(s => <StepCard key={s.id} step={s} />)}
                  </div>
                )}
                {t.content && <div className="text-[15px]"><Markdown text={t.content} /></div>}
                {t.pending && !t.content && (
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <span className="w-4 h-4 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
                    {t.steps.length === 0 ? '질문을 살펴보는 중...' : '결과를 종합하는 중...'}
                  </div>
                )}
                {t.error && <p className="text-sm text-rose-500">{t.error}</p>}
              </div>
            )
          )}
          <div ref={bottomRef} />
        </div>

        {/* 입력 */}
        <form
          onSubmit={e => {
            e.preventDefault()
            send(input)
          }}
          className="sticky bottom-0 pt-4 pb-2 bg-gradient-to-t from-white via-white to-transparent"
        >
          <div className="flex gap-2 bg-white border border-blue-200 rounded-2xl p-2 shadow-sm focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault()
                  send(input)
                }
              }}
              rows={1}
              maxLength={2000}
              placeholder="예: 1998년 7월 15일생 여자인데 다음 달 면접 보기 좋은 날 알려줘"
              className="flex-1 resize-none bg-transparent px-2 py-2 text-[15px] text-gray-800 placeholder-gray-400 focus:outline-none"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="px-4 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-semibold disabled:opacity-40 transition-opacity"
            >
              {busy ? '...' : '보내기'}
            </button>
          </div>
        </form>
      </div>
    </main>
  )
}
