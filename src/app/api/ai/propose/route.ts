import {
  PROPOSAL_JSON_SCHEMA,
  createChangesExtractor,
  type AiContext,
  type AiErrorKind,
} from "@/features/ai";

/**
 * AI 편집 제안 Route Handler (A1·A4·A6·A7).
 *
 * OpenRouter(OpenAI 호환)에 구조화 출력 스트림을 요청하고, 완성된 셀 제안을
 * 하나씩 NDJSON으로 중계한다. API 키는 서버에만 둔다(A1). 클라이언트가 연결을
 * 끊으면 request.signal이 업스트림 fetch로 전파돼 LLM 호출도 끊긴다(A4).
 */

const DEFAULT_MODEL = "openai/gpt-4o-mini-2024-07-18"; // 버전 고정 (D11)
const MAX_TOKENS = 4096; // 요청당 출력 상한 (A7 P1)
const TIMEOUT_MS = 60_000; // 첫 바이트가 아니라 전체 스트림 상한

interface ProposeBody {
  prompt: string;
  context: AiContext;
  /** 범위 지정 요청이면 "B2:D10", 시트 전체면 null (A2/D8) */
  targetLabel: string | null;
}

function systemPrompt(context: AiContext, targetLabel: string | null): string {
  const cells = context.cells
    .map((c) => `${c.cell}=${JSON.stringify(c.value)}`)
    .join(", ");
  const scope = targetLabel
    ? `편집 대상은 ${targetLabel} 범위다. 그 범위 안 셀만 바꿔라.`
    : "시트 전체를 대상으로 한다.";
  return [
    "너는 스프레드시트 편집 도우미다. 100행(1~100) × 26열(A~Z) 그리드다.",
    "사용자 지시에 따라 바꿔야 할 셀만 changes 배열로 제안한다.",
    "row는 0부터 시작하는 행 인덱스, col은 0부터 시작하는 열 인덱스(A=0)다.",
    "바뀌지 않는 셀은 넣지 마라. 값만 제안하고 서식은 건드리지 않는다.",
    // 모델이 한 셀 값을 글자 단위로 쪼개 여러 셀에 흩뿌리는 오해를 막는다
    '사용자가 한 셀에 넣을 값을 주면 그 값을 통째로 그 셀 하나에 넣어라. 값을 글자 단위로 쪼개 여러 셀·행에 나누지 마라. 여러 셀에 나눠 넣는 것은 사용자가 "각 행에", "한 글자씩", 목록 등으로 명시했을 때만 한다.',
    "지시에 셀·범위 위치가 불명확하면 활성 셀 하나만 바꾼다.",
    scope,
    `현재 선택: ${context.selection}, 활성 셀: ${context.activeCell}.`,
    cells ? `값이 있는 셀: ${cells}` : "값이 있는 셀이 없다(빈 시트).",
  ].join("\n");
}

function errorLine(kind: AiErrorKind): string {
  return JSON.stringify({ type: "error", kind }) + "\n";
}

/** 업스트림 상태코드를 A6 실패 종류로 분류한다 */
function classifyStatus(status: number): AiErrorKind {
  if (status === 402) return "credit"; // 크레딧 소진 (A7/D11)
  if (status === 429) return "rate-limit";
  return "server"; // 401·403(키 문제) 포함 서버측 설정 오류로 안내
}

export async function POST(request: Request): Promise<Response> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return ndjsonError("server", 500);
  }

  let body: ProposeBody;
  try {
    body = (await request.json()) as ProposeBody;
  } catch {
    return ndjsonError("schema", 400);
  }
  if (typeof body?.prompt !== "string" || typeof body?.context !== "object") {
    return ndjsonError("schema", 400);
  }

  const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;

  // 클라이언트 취소(A4)와 타임아웃(A6)을 하나의 컨트롤러로 업스트림에 전달한다
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  request.signal.addEventListener("abort", onAbort);
  // 문자열 reason으로 abort하면 undici가 unhandledRejection을 던진다. 기본
  // AbortError로 끊고, 타임아웃 여부는 isTimedOut(=controller만 aborted)로 가른다.
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const cleanup = () => {
    clearTimeout(timer);
    request.signal.removeEventListener("abort", onAbort);
  };

  let upstream: Response;
  try {
    upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        stream: true,
        max_tokens: MAX_TOKENS,
        // require_parameters: 구조화 출력을 지원하는 업체로만 라우팅,
        // data_collection: deny — 로그 수집 업체 제외 (D11)
        provider: { require_parameters: true, data_collection: "deny" },
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "proposal",
            strict: true,
            schema: PROPOSAL_JSON_SCHEMA,
          },
        },
        messages: [
          {
            role: "system",
            content: systemPrompt(body.context, body.targetLabel),
          },
          { role: "user", content: body.prompt },
        ],
      }),
    });
  } catch (err) {
    cleanup();
    // 클라이언트가 끊은 abort면 보낼 곳이 없다
    if (request.signal.aborted) return new Response(null, { status: 499 });
    const kind: AiErrorKind =
      controller.signal.aborted &&
      err instanceof Error &&
      err.name === "AbortError"
        ? "timeout"
        : "network";
    return ndjsonError(kind, 502);
  }

  if (!upstream.ok || !upstream.body) {
    cleanup();
    // 읽지 않을 본문은 취소해 커넥션을 반납한다 (undici 누수 방지)
    void upstream.body?.cancel();
    return ndjsonError(classifyStatus(upstream.status), 502);
  }

  const stream = relayStream(upstream.body, {
    onSettled: cleanup,
    isClientAborted: () => request.signal.aborted,
    isTimedOut: () => controller.signal.aborted && !request.signal.aborted,
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

/**
 * OpenRouter SSE(`data: {...choices[].delta.content}`)를 읽어 구조화 JSON을
 * 재조립하고, 완성된 제안 객체를 NDJSON item으로 흘려보낸다. 스트림이 끝나면
 * done, 중간에 끊기면 error를 보낸다(A6).
 */
function relayStream(
  upstreamBody: ReadableStream<Uint8Array>,
  hooks: {
    onSettled: () => void;
    isClientAborted: () => boolean;
    isTimedOut: () => boolean;
  },
): ReadableStream<Uint8Array> {
  const extractor = createChangesExtractor();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const reader = upstreamBody.getReader();
  let sseBuffer = "";
  let sawContent = false; // 모델이 내용 토큰을 하나라도 보냈는가 (A6 schema 판정)
  let truncated = false; // max_tokens로 응답이 잘렸는가 (불완전 → 적용 불가)

  const emitItems = (
    controller: ReadableStreamDefaultController<Uint8Array>,
    delta: string,
  ) => {
    for (const item of extractor.push(delta)) {
      controller.enqueue(
        encoder.encode(JSON.stringify({ type: "item", item }) + "\n"),
      );
    }
  };

  // upstream을 루프로 끝까지 읽어 내보낸다. pull 단건 방식은 객체가 아직 안
  // 닫혀 enqueue할 게 없는 chunk에서 소비자가 더 당기지 않아 교착한다.
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) {
            sseBuffer += decoder.decode(); // 멀티바이트 꼬리 플러시
            // strict json_schema라 정상 응답은 최소 `{"changes":[]}`를 보낸다.
            // 내용이 전무하거나 잘렸으면 형식·불완전 오류로 안내한다 (A6).
            const tail =
              !sawContent || truncated
                ? errorLine("schema")
                : `{"type":"done"}\n`;
            controller.enqueue(encoder.encode(tail));
            hooks.onSettled();
            controller.close();
            return;
          }
          sseBuffer += decoder.decode(value, { stream: true });
          // SSE 이벤트는 개행으로 구분된다. 완성된 라인만 처리하고 나머지는 보관.
          const lines = sseBuffer.split("\n");
          sseBuffer = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const data = trimmed.slice(5).trim();
            if (data === "[DONE]") continue;
            try {
              const chunk = JSON.parse(data) as {
                choices?: {
                  delta?: { content?: string };
                  finish_reason?: string;
                }[];
              };
              const content = chunk.choices?.[0]?.delta?.content;
              if (content) {
                sawContent = true;
                emitItems(controller, content);
              }
              if (chunk.choices?.[0]?.finish_reason === "length")
                truncated = true;
            } catch {
              // SSE 코멘트(": OPENROUTER PROCESSING")나 부분 라인은 건너뛴다
            }
          }
        }
      } catch {
        // 업스트림이 끊겼다. 클라이언트 취소면 조용히 닫고, 아니면 분류해 알린다.
        hooks.onSettled();
        if (hooks.isClientAborted()) {
          controller.close();
          return;
        }
        controller.enqueue(
          encoder.encode(errorLine(hooks.isTimedOut() ? "timeout" : "network")),
        );
        controller.close();
      }
    },
    cancel() {
      void reader.cancel();
      hooks.onSettled();
    },
  });
}

/** 스트림을 시작하기 전 실패를 NDJSON error 한 줄로 응답한다 (A6) */
function ndjsonError(kind: AiErrorKind, status: number): Response {
  return new Response(errorLine(kind), {
    status,
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
