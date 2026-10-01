import { AiError, type AiErrorKind } from "../model/proposal";
import type { ProposalSource } from "./proposal-store";

/**
 * 실제 LLM에 연결하는 ProposalSource (A1). Route Handler(/api/ai/propose)가
 * 보내는 NDJSON 스트림을 읽어 완성된 셀 제안을 하나씩 onItem으로 넘긴다(A4).
 * 실패는 AiError(kind)로 throw해 store가 세션 error로 표면화한다(A6).
 *
 * 키·LLM 호출은 전부 Route Handler 뒤에 있다 — 이 소스는 브라우저에서 동작한다.
 */
export function createOpenRouterSource(): ProposalSource {
  return async ({ prompt, context, targetLabel }, onItem, signal) => {
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

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    const handleLine = (line: string) => {
      const trimmed = line.trim();
      if (trimmed === "") return;
      let msg: { type?: string; item?: unknown; kind?: AiErrorKind };
      try {
        msg = JSON.parse(trimmed);
      } catch {
        // 라우트는 항상 NDJSON을 보낸다. 파싱이 깨졌는데 응답도 비정상이면
        // 프레임워크의 비-NDJSON 오류 본문이므로 상태코드로 분류한다.
        if (!res.ok)
          throw new AiError(res.status >= 500 ? "server" : "network");
        throw new AiError("schema");
      }
      if (msg.type === "item") onItem(msg.item);
      else if (msg.type === "error") throw new AiError(msg.kind ?? "server");
      // type === "done"은 루프가 자연 종료된다
    };

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) handleLine(line);
      }
      buffer += decoder.decode(); // 멀티바이트 꼬리 플러시
      if (buffer.trim() !== "") handleLine(buffer);
    } catch (err) {
      if (signal.aborted) return; // 사용자 취소 — 부분 제안은 store가 보존
      if (err instanceof AiError) throw err;
      throw new AiError("network"); // 스트림 중간 끊김 (A6)
    }
  };
}
