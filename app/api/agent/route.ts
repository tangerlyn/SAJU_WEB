import { NextRequest } from 'next/server'
import { AIMessage, HumanMessage, ToolMessage, type BaseMessage } from '@langchain/core/messages'
import { GraphRecursionError } from '@langchain/langgraph'
import { sajuAgent, RECURSION_LIMIT } from '../../../lib/agent/graph'

export const maxDuration = 60

const MAX_HISTORY = 20
const MAX_CONTENT_LENGTH = 2000

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

// 클라이언트로 보내는 NDJSON 이벤트
export type AgentEvent =
  | { type: 'tool_call'; id: string; name: string; args: Record<string, unknown> }
  | { type: 'tool_result'; id: string; name: string; ok: boolean; result: unknown }
  | { type: 'answer'; content: string }
  | { type: 'error'; message: string }
  | { type: 'done' }

function isValidHistory(v: unknown): v is ChatMessage[] {
  return (
    Array.isArray(v) &&
    v.length > 0 &&
    v.every(
      m =>
        m &&
        (m.role === 'user' || m.role === 'assistant') &&
        typeof m.content === 'string' &&
        m.content.length <= MAX_CONTENT_LENGTH,
    ) &&
    v[v.length - 1].role === 'user'
  )
}

function parseToolContent(content: unknown): unknown {
  if (typeof content !== 'string') return content
  try {
    return JSON.parse(content)
  } catch {
    return content
  }
}

export async function POST(req: NextRequest) {
  const { messages } = await req.json()

  if (!isValidHistory(messages)) {
    return Response.json({ error: '대화 형식이 올바르지 않습니다.' }, { status: 400 })
  }

  // 대화 이력은 클라이언트가 보관 (서버리스 환경에서 상태 없이 동작)
  const history: BaseMessage[] = messages
    .slice(-MAX_HISTORY)
    .map(m => (m.role === 'user' ? new HumanMessage(m.content) : new AIMessage(m.content)))

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: AgentEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + '\n'))

      try {
        const updates = await sajuAgent.stream(
          { messages: history },
          { streamMode: 'updates', recursionLimit: RECURSION_LIMIT, signal: req.signal },
        )

        for await (const update of updates) {
          for (const [node, value] of Object.entries(update as Record<string, { messages?: BaseMessage[] }>)) {
            for (const msg of value?.messages ?? []) {
              if (node === 'agent' && AIMessage.isInstance(msg)) {
                if (msg.tool_calls?.length) {
                  for (const call of msg.tool_calls) {
                    send({ type: 'tool_call', id: call.id ?? call.name, name: call.name, args: call.args })
                  }
                } else if (msg.text) {
                  send({ type: 'answer', content: msg.text })
                }
              } else if (node === 'tools' && ToolMessage.isInstance(msg)) {
                send({
                  type: 'tool_result',
                  id: msg.tool_call_id,
                  name: msg.name ?? '',
                  ok: msg.status !== 'error',
                  result: parseToolContent(msg.content),
                })
              }
            }
          }
        }
      } catch (err) {
        console.error('[agent]', err)
        send({
          type: 'error',
          message:
            err instanceof GraphRecursionError
              ? '질문이 너무 복잡해서 중간에 멈췄어요. 조금 나눠서 물어봐 주세요.'
              : '상담 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.',
        })
      } finally {
        send({ type: 'done' })
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
    },
  })
}
