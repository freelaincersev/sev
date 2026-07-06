# CLAUDE.md 효과 비교표 (A-01-O3)

- 작성일: 2026-07-06
- 목적: 동일 요청을 CLAUDE.md 없는 조건 / 있는 조건에서 실행해 차이를 기록 — CLAUDE.md 효과의 증거.
- 다음 사용처: Day07 CLAUDE.md 정식판 작성 시 참고.
- 방법: 동일 요청 **"사용자 프로필 컴포넌트 만들어줘"** 를 두 조건에서 실행(에이전트 격리).
  🅰 기준 없음 = 빈 폴더(레포·CLAUDE.md 없음) / 🅱 CLAUDE.md 있음 = 레포 규칙 준수. 결과물은 레포 밖 scratchpad에만 생성.

## 5항목 비교

| 항목 | 🅰 기준 없음 | 🅱 CLAUDE.md 있음 | 차이 |
|---|---|---|---|
| 파일 위치 | 단일 파일 `UserProfile.tsx`를 폴더 루트에 생성 | `components/user-profile.tsx` + 읽기 쿼리 `lib/data/profiles.ts`로 분리 (kebab-case, 레이어 규칙) | ✅ **폴더/레이어 규칙 준수** (data ↔ UI 분리) |
| 타입 안정성 | 명시 타입, `any` 0 (직접 만든 interface) | 명시 타입, `any` 0 — **생성된 `Database` 타입(`lib/database.types.ts`)에서 파생**, 실제 컬럼과 일치 | ✅ 스키마를 소스오브트루스로 사용 |
| 서버/클라이언트 경계 | Server Component (props 기반) | Server Component (규칙 "서버 우선", `app-sidebar` 패턴 근거) | ~ 둘 다 서버 (🅱는 근거 명시) |
| 보안 (service role) | **없음** — 데이터를 props로 받음, DB·auth 처리 안 함 | 서버 client(`lib/supabase/server.ts`)로 조회 + RLS + `.eq("id", user.id)`, service_role/`NEXT_PUBLIC_` 미사용 | ✅ **서버 전용 DB 접근·RLS 스코핑 자동 적용** |
| 검증 명령 포함 | **없음** (언급조차 안 함) | `build`/`lint`/`typecheck` 필요 명시(typecheck 먼저) + 변경파일 보고 + 새 패키지 설치 전 확인 | ✅ 검증·보고 규칙 포함 |

## 결론 (명확한 차이 ≥1 확보)

가장 큰 차이는 **보안**과 **파일 배치**다. 기준 없음은 도메인·보안 맥락이 없어 "props로 데이터를 받는 장식용 컴포넌트"를 폴더 루트에 툭 만들었고 검증도 안 했다. CLAUDE.md가 있으면 같은 한 줄 요청에도 (1) `lib/data` + `components` 분리, (2) 생성 타입 재사용, (3) 서버 client + RLS 스코핑, (4) build/lint/typecheck 검증 보고까지 자동으로 따랐다.

> 방법 주의: 이 비교는 별도 `claude` CLI 세션 2개가 아니라 격리된 서브에이전트 2개로 수행함. 전역 `~/.claude` 규칙은 양쪽 동일하므로, 관찰된 차이는 이 프로젝트의 `CLAUDE.md`에서 기인함.
