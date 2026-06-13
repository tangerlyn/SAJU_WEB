'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('사주 분석 중...')
  const [careerLoading, setCareerLoading] = useState(false)
  const [careerMsg, setCareerMsg] = useState('직장운 분석 중...')
  const [form, setForm] = useState({
    name: '',
    year: '',
    month: '',
    day: '',
    hour: '12',
    gender: 'male',
    unknownHour: false,
  })

  const hours = Array.from({ length: 24 }, (_, i) => ({
    value: String(i),
    label: `${i}시 (${i < 12 ? '오전' : '오후'} ${i % 12 || 12}시)`,
  }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setLoadingMsg('사주 분석 중...')

    const msgTimer = setTimeout(() => setLoadingMsg('귤린이가 열심히 분석 중... (잠시만요)'), 8000)
    const msgTimer2 = setTimeout(() => setLoadingMsg('거의 다 됐어요! 조금만 더...'), 20000)

    try {
      const res = await fetch('/api/saju', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          year: Number(form.year),
          month: Number(form.month),
          day: Number(form.day),
          hour: form.unknownHour ? 12 : Number(form.hour),
          gender: form.gender,
        }),
      })

      if (!res.ok) throw new Error('API 오류')

      const data = await res.json()
      sessionStorage.setItem('sajuResult', JSON.stringify(data))
      router.push('/result')
    } catch {
      alert('오류가 발생했습니다. 잠시 후 다시 시도해주세요.')
    } finally {
      clearTimeout(msgTimer)
      clearTimeout(msgTimer2)
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-100 via-sky-50 to-white text-gray-900">
      <div className="max-w-lg mx-auto px-4 py-16">
        {/* 헤더 */}
        <div className="text-center mb-12">
          <div className="text-5xl mb-4">☯</div>
          <h1 className="text-4xl font-bold mb-3 bg-gradient-to-r from-blue-500 to-sky-400 bg-clip-text text-transparent">
            사.주.팔.자.
          </h1>
          <p className="text-blue-500 text-lg">생년월일로 알아보는 나의 운명은?!?</p>
        </div>

        {/* 폼 */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white rounded-2xl p-6 space-y-5 border border-blue-200 shadow-sm">

            {/* 이름 */}
            <div>
              <label className="block text-sm text-blue-500 mb-2 font-medium">이름</label>
              <input
                type="text"
                placeholder="이름을 입력하세요"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                required
                className="w-full bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
              />
            </div>

            {/* 성별 */}
            <div>
              <label className="block text-sm text-blue-500 mb-2 font-medium">성별</label>
              <div className="grid grid-cols-2 gap-3">
                {[{ value: 'male', label: '남성' }, { value: 'female', label: '여성' }].map(g => (
                  <button
                    key={g.value}
                    type="button"
                    onClick={() => setForm({ ...form, gender: g.value })}
                    className={`py-3 rounded-xl border transition-all font-medium ${
                      form.gender === g.value
                        ? 'bg-blue-500 border-blue-400 text-white shadow-sm'
                        : 'bg-white border-blue-200 text-gray-600 hover:border-blue-300'
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 생년 */}
            <div>
              <label className="block text-sm text-blue-500 mb-2 font-medium">태어난 해</label>
              <input
                type="number"
                placeholder="예: 1990"
                min="1900"
                max="2024"
                value={form.year}
                onChange={e => setForm({ ...form, year: e.target.value })}
                required
                className="w-full bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
              />
            </div>

            {/* 생월/일 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-blue-500 mb-2 font-medium">월</label>
                <input
                  type="number"
                  placeholder="월 (1-12)"
                  min="1"
                  max="12"
                  value={form.month}
                  onChange={e => setForm({ ...form, month: e.target.value })}
                  required
                  className="w-full bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div>
                <label className="block text-sm text-blue-500 mb-2 font-medium">일</label>
                <input
                  type="number"
                  placeholder="일 (1-31)"
                  min="1"
                  max="31"
                  value={form.day}
                  onChange={e => setForm({ ...form, day: e.target.value })}
                  required
                  className="w-full bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
                />
              </div>
            </div>

            {/* 태어난 시간 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm text-blue-500 font-medium">태어난 시간</label>
                <label className="flex items-center gap-2 text-sm text-gray-500 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.unknownHour}
                    onChange={e => setForm({ ...form, unknownHour: e.target.checked })}
                    className="rounded accent-blue-500"
                  />
                  모름
                </label>
              </div>
              <select
                value={form.hour}
                onChange={e => setForm({ ...form, hour: e.target.value })}
                disabled={form.unknownHour}
                className="w-full bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:border-blue-400 disabled:opacity-40"
              >
                {hours.map(h => (
                  <option key={h.value} value={h.value} className="bg-white text-gray-800">
                    {h.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 직장운 버튼 */}
          <button
            type="button"
            disabled={careerLoading || loading}
            onClick={async () => {
              if (!form.name || !form.year || !form.month || !form.day) {
                alert('이름, 생년월일을 모두 입력해주세요.')
                return
              }
              setCareerLoading(true)
              setCareerMsg('직장운 분석 중...')
              const t1 = setTimeout(() => setCareerMsg('언니만을 위한 직장운 분석 중입니다 🔍'), 8000)
              const t2 = setTimeout(() => setCareerMsg('돈 많이 벌었으면 좋겠다 💸'), 20000)
              try {
                const res = await fetch('/api/career', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    name: form.name,
                    year: Number(form.year),
                    month: Number(form.month),
                    day: Number(form.day),
                    hour: form.unknownHour ? 12 : Number(form.hour),
                    gender: form.gender,
                  }),
                })
                if (!res.ok) throw new Error('API 오류')
                const data = await res.json()
                sessionStorage.setItem('careerResult', JSON.stringify(data))
                router.push('/career')
              } catch {
                alert('오류가 발생했습니다. 잠시 후 다시 시도해주세요.')
              } finally {
                clearTimeout(t1)
                clearTimeout(t2)
                setCareerLoading(false)
                setCareerMsg('직장운 분석 중...')
              }
            }}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-lg text-white transition-all shadow-lg shadow-emerald-200"
          >
            {careerLoading ? (
              <span className="flex items-center justify-center gap-3">
                <span className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                {careerMsg}
              </span>
            ) : (
              '💼 직장운만 보기'
            )}
          </button>

          {/* 제출 버튼 */}
          <button
            type="submit"
            disabled={loading || careerLoading}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-400 hover:to-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-lg text-white transition-all shadow-lg shadow-blue-200"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-3">
                <span className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                {loadingMsg}
              </span>
            ) : (
              '사주 보기'
            )}
          </button>
        </form>

        <p className="text-center text-gray-400 text-xs mt-6">
          시간을 모르면 정오(12시)로 계산됩니다
        </p>
      </div>
    </main>
  )
}
