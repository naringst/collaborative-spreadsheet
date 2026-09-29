/**
 * collab — 탭 간 동기화와 저장
 *
 * - persistence.ts        : y-indexeddb 연결 (1단계)
 * - broadcast-provider.ts : BroadcastChannel로 Yjs update 송수신 (2단계)
 * - presence.ts           : awareness, 참여자 이름·색, 탭 종료 처리 (2단계)
 * - ui/                   : 참여자 목록, 다른 참여자의 선택 범위 오버레이
 *
 * 의존 규칙: 코어는 Y.Doc만 다루며 sheet·ai·session을 import하지 않는다.
 * (ui/는 그리드 위에 그리기 위해 sheet의 공개 API만 사용할 수 있다.)
 */
export {};
