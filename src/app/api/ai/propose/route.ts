import { createProposalResponse } from "@/features/ai";

/**
 * AI 편집 제안 엔드포인트 (A1). Next 바인딩만 둔다 — 비밀키를 env에서 읽어
 * feature의 서버 로직에 넘기고, 로직은 전부 features/ai/server에 있다.
 */
export function POST(request: Request): Promise<Response> {
  return createProposalResponse(request, {
    apiKey: process.env.OPENROUTER_API_KEY,
    model: process.env.OPENROUTER_MODEL,
  });
}
