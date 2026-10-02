/**
 * 외부 소스의 스냅샷 캐시 — useSyncExternalStore용.
 * getSnapshot은 안정 참조를 반환해야 하므로(매번 새 객체 금지) 소스가 바뀔 때만
 * 재계산해 보관한다. 캐시를 먼저 갱신한 뒤 구독자에게 알려, 알림을 받은
 * getSnapshot이 항상 최신 캐시를 읽도록 순서를 보장한다.
 */
export interface CachedSnapshot<T> {
  get(): T;
  subscribe(listener: () => void): () => void;
  /** 소스 구독 해제. 이후 get()은 마지막 캐시를 반환한다 */
  destroy(): void;
}

export function createCachedSnapshot<T>(
  build: () => T,
  /** 소스 변경 시 rebuild를 부르도록 연결하고, 해제 함수를 반환한다 */
  observe: (rebuild: () => void) => () => void,
): CachedSnapshot<T> {
  let cached = build();
  const listeners = new Set<() => void>();
  const stop = observe(() => {
    cached = build();
    for (const listener of listeners) listener();
  });
  return {
    get: () => cached,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    destroy: stop,
  };
}
