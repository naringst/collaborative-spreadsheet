/**
 * Web Locks로 비정상 종료를 감지한다 (C6).
 *
 * 각 탭은 자기 clientID 이름의 잠금을 계속 보유한다. 피어는 그 잠금을 요청해 두는데,
 * 요청이 승인되는 순간 = 소유 탭이 죽어 브라우저가 잠금을 해제한 순간이다.
 * heartbeat와 달리 백그라운드 탭 타이머 스로틀링의 영향을 받지 않아
 * 절전된 탭이 잘못 제거되지 않는다 (C6 P1).
 */
export interface PeerLocks {
  /** 이 clientId의 탭이 죽으면 onDead를 한 번 호출한다. 중복 watch는 무시. */
  watch(clientId: number, onDead: () => void): void;
  destroy(): void;
}

function lockName(sheetId: string, clientId: number): string {
  return `sheet:${sheetId}:peer:${clientId}`;
}

/** Web Locks 미지원 환경이면 null — 호출자는 awareness 타임아웃 폴백에 맡긴다. */
export function createPeerLocks(
  sheetId: string,
  ownClientId: number,
): PeerLocks | null {
  if (typeof navigator === "undefined" || !("locks" in navigator)) return null;

  const abort = new AbortController();
  const watching = new Set<number>();
  let releaseOwn: (() => void) | null = null;

  // 내 잠금은 destroy까지 보유한다. 탭이 죽으면 브라우저가 즉시 해제한다.
  navigator.locks
    .request(lockName(sheetId, ownClientId), { signal: abort.signal }, () => {
      return new Promise<void>((resolve) => {
        releaseOwn = resolve;
      });
    })
    .catch(() => {
      // abort된 경우 — 정리 중이므로 무시
    });

  return {
    watch(clientId, onDead) {
      if (clientId === ownClientId || watching.has(clientId)) return;
      watching.add(clientId);
      navigator.locks
        .request(lockName(sheetId, clientId), { signal: abort.signal }, () => {
          // 획득 = 소유 탭 사망. 즉시 반환해 잠금을 되돌려 준다.
          watching.delete(clientId);
          onDead();
        })
        .catch(() => {
          // abort된 경우
        });
    },
    destroy() {
      releaseOwn?.();
      abort.abort();
    },
  };
}
