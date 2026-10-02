import { AiError, type AiErrorKind } from "../model/proposal";
import type { ProposalSource } from "./proposal-store";

/** 라우트가 보내는 NDJSON 한 줄 (item: 셀 제안 / error: 실패 / done: 종료) */
type StreamLine = { type?: string; item?: unknown; kind?: AiErrorKind };

/**
 * 응답 본문을 NDJSON 한 줄씩 흘려보낸다. 스트림 청크 경계에서 줄이 잘릴 수 있어
 * 개행 전까지 버퍼링하고, 끝에서 멀티바이트 꼬리를 플러시한다.
 */
async function* readNdjsonLines(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? ""; // 마지막 조각은 다음 청크와 이어질 수 있다
    yield* lines;
  }
  buffer += decoder.decode(); // 꼬리 플러시
  if (buffer.trim() !== "") yield buffer;
}

/**
 * 실제 LLM에 연결하는 ProposalSource (A1). Route Handler(/api/ai/propose)가
 * 보내는 NDJSON 스트림을 읽어 완성된 셀 제안을 하나씩 onItem으로 넘긴다(A4).
 * 실패는 AiError(kind)로 throw해 store가 세션 error로 표면화한다(A6).
 *
 * 키·LLM 호출은 전부 Route Handler 뒤에 있다 — 이 소스는 브라우저에서 동작한다.
 */
export function createOpenRouterSource(): ProposalSource {
  return async ({ prompt, context, targetLabel }, onItem, signal) => {
    // 1) 요청 — 로직은 라우트 뒤에 있고 여기선 POST만 한다
    let res: Response;
    try {
      res = await fetch("/api/ai/propose", {
        method: "POST",
        signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, context, targetLabel }),
      });
    } catch {
      if (signal.aborted) return; // 사용자 취소 — store가 처리
      throw new AiError("network");
    }
    if (!res.body) throw new AiError("network");

    // 2) 라인별 해석 — item→onItem, error→throw, done은 루프가 끝나며 자연 종료
    try {
      for await (const line of readNdjsonLines(res.body)) {
        if (line.trim() === "") continue;
        let msg: StreamLine;
        try {
          msg = JSON.parse(line);
        } catch {
          // 라우트는 항상 NDJSON을 보낸다. 파싱이 깨졌는데 응답도 비정상이면
          // 프레임워크의 비-NDJSON 오류 본문이므로 상태코드로 분류한다.
          if (!res.ok) throw new AiError(res.status >= 500 ? "server" : "network");
          throw new AiError("schema");
        }
        if (msg.type === "item") onItem(msg.item);
        else if (msg.type === "error") throw new AiError(msg.kind ?? "server");
      }
    } catch (err) {
      if (signal.aborted) return; // 사용자 취소 — 부분 제안은 store가 보존
      if (err instanceof AiError) throw err;
      throw new AiError("network"); // 스트림 중간 끊김 (A6)
    }
  };
}
