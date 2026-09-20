# 개발 의뢰서 검토 — 2026-09-20

후속 진행: 실제 자료를 전달받아 분석·변환·이미지 최적화를 완료했다. 아래는 최초 검토 기록이며 최신 결과는 [실제 자료 분석](source-analysis.md)을 따른다.

## 검토 결론

Next.js / TypeScript / Tailwind / Supabase / GitHub / Vercel 구성은 요청한 탐색·평가·외부 운영 흐름에 적합하다. 첫 단계는 실제 원본 자료의 ID와 관계를 확정한 뒤 콘텐츠 탐색 기능을 구축하는 것이다.

현재 확인한 입력은 `섭차피디아_Codex_개발의뢰서_v0.1.md` 한 파일이다. 작업 폴더에는 .git만 있었으며 기존 앱은 없었다. Excel, 이미지, UI 레퍼런스 및 서비스 프로젝트는 아직 확인하지 않았다. 실제 시트·컬럼·파일명 분석을 완료했다고 간주하면 안 된다.

문서 35절의 작업 지시와 36절의 최초 요청 예시는 요구사항 참고 자료로 읽었다. 사용자의 실제 요청인 검토·작업·추가 사항·문제 공유를 기준으로 이번 산출물을 작성했다.

## 이번에 만든 산출물과 한계

- 콘텐츠 관계 및 공개 범위 RLS를 포함한 SQL 초안.
- 평가·코멘트·좋아요의 추가 설계와 단계별 구현·검증 계획.
- Excel importer 처리 흐름, 필요한 자료와 결정 사항.
- 플러그인 확인 결과 및 서비스 설정 목록.

앱 실행, SQL 적용, 데이터 import, 이미지 업로드, 로그인, 배포는 아직 수행하지 않았다. SQL은 콘텐츠 5개 테이블만 다루며 평가·코멘트 기능까지 완성한 마이그레이션이 아니다.

## 요구사항 간 차이와 해결안

| 항목 | 발견한 차이·누락 | 제안 |
|---|---|---|
| 1차 완료 기준 | Phase 1에는 검색이 없지만 완료 기준에는 검색 또는 최근 업데이트의 직접 이동이 있음 | Phase 1은 최근 업데이트의 직접 링크로 충족. 검색은 Phase 3 유지 |
| 보안 순서 | 구현 순서에서 RLS가 인증 이후 | 공개 API를 만들기 전부터 RLS 적용. 평가 목업에도 허위 저장 성공 표시 금지 |
| 게임·편 평점 | 장만 직접 평가하지만 게임·편에 평균 및 평가자 수 표시 | 장 평가 원본의 가중 평균 제안. 평가 건수와 중복 제거한 평가자 수를 구분 |
| 캐릭터 전체 평균 | 장별 평균을 다시 평균 낼지, 전체 평가를 평균 낼지 미정 | 장별 캐릭터 평가 원본 전체의 평균 제안. 다수 장을 평가한 계정의 영향은 별도 명시 |
| 코멘트·좋아요 | 테이블 이름만 있고 실제 컬럼/대상 참조 방식 미정 | 아래 별도 설계에 따라 FK 및 UNIQUE로 강제 |
| 비공개 | 테이블별 is_published만 있음 | 부모 게임·편 중 하나라도 비공개면 하위 항목·검색·통계도 비공개 |
| 외부 데이터 수정 | 재배포 없이 반영 요구 | 최초 버전은 요청 시 조회. 이미 열린 화면은 새로고침 반영으로 정의하고 실시간 반영은 별도 기능 |
| 사이트 설정 | registration_enabled를 단순 JSON으로 정의 | 가입 차단은 Auth 설정/가입 훅 수준에서 구현 필요. UI만 숨기는 방식 불가 |
| 관리자 | /admin 요구와 권한 부여 방식 미정 | 초기에는 Supabase Studio. 앱 관리자 역할은 사용자 수정 가능 metadata와 분리 |

## DB 초안에서 제안한 선택

내부 FK는 UUID로 연결하고 기존 Excel ID는 `source_id` 텍스트로 보존한다. 실제 `character_id`는 `(game_id, source_id)` 기준으로 UUID와 매핑하며 작업용 순번을 식별자로 사용하지 않는다. 이 방식은 제안이며 원본의 ID 유일성 범위를 확인한 뒤 확정한다.

장에 `game_id`를 추가하고 복합 FK를 적용해 편과 게임이 어긋나는 입력을 차단한다. appearances에도 `game_id`를 포함해 다른 게임의 캐릭터 연결을 DB에서 거절한다. slug는 게임은 전역, 편·캐릭터는 게임별, 장은 편별로 유일하다. slug 변경 시 공유 링크 보존을 위한 redirect 정책은 후속 결정 사항이다.

이미지는 binary 대신 Storage 객체 경로를 저장한다. 공개 콘텐츠 테이블에는 읽기 정책만 만들고 일반 사용자 쓰기는 허용하지 않는다. 비공개 데이터 수정은 관리자용 서버 경로 또는 Studio에서만 수행한다.

## 추가 기능 테이블 설계

- `profiles`: auth.users의 UUID와 1:1. 공개 닉네임·아바타만 저장하고 이메일·OAuth 토큰은 공개 프로필에 복제하지 않는다.
- `chapter_ratings`: user_id + chapter_id 유일. score는 numeric(2,1), 0.5~5, score * 2가 정수인지 CHECK.
- `character_ratings`: user_id + chapter_id + character_id 유일. chapter_id + character_id는 appearances FK. 캐릭터 자체에 단독 별점을 쓰지 않는다.
- 두 평가 테이블: 본인 행만 쓰기 허용, 대상은 공개 상태여야 함. 공개 집계용 API와 본인 평가 조회를 분리하여 개인별 평가 내역 공개 범위 확정.
- `chapter_comments`: user_id + chapter_id 유일. body, is_spoiler, created_at, updated_at, 운영 숨김 상태 포함.
- `character_comments`: user_id + chapter_id + character_id 유일. appearances 참조. 여기서 동일 대상은 ‘이번 장의 해당 캐릭터’로 해석.
- `comment_likes`: chapter_comment_id와 character_comment_id 중 정확히 하나만 존재하도록 CHECK. 각 FK별 user_id와 UNIQUE. 자기 코멘트 좋아요 허용, 본인 좋아요만 삭제.
- `site_settings`: 공개 가능한 설정만 저장. ratings_enabled/comments_enabled는 쓰기 API 및 DB 정책에도 반영. 비밀 설정과 관리자 권한 정보는 별도 비공개 구조.

모든 사용자 쓰기는 서버에서도 입력 검사하고, DB에서도 소유권·FK·점수 범위·중복을 강제한다. 집계 view는 호출자 권한/RLS 적용 여부를 확인해야 한다. [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Views](https://supabase.com/docs/guides/database/views).

## 추가로 필요한 자료·결정

| 우선순위 | 필요한 내용 | 이유 |
|---|---|---|
| 지금 | 원본 Excel 경로와 최신본 여부 | 시트·키·장/캐릭터 매핑과 누락 검사 |
| 지금 | 캐릭터·스토리 이미지 폴더, UI 레퍼런스 | 파일명-ID 연결과 화면 방향 확인 |
| 지금 | 기존 GitHub/Supabase/Vercel 프로젝트 유무 및 URL | 기존 자산 재사용과 대상 환경 식별 |
| 데이터 분석 후 | ID 유일 범위, 동명·의상별 캐릭터 처리, 장 순서 | 중복·덮어쓰기·이전/다음 장 오류 방지 |
| 데이터 분석 후 | 원본 날짜가 게임 출시일인지 사이트 공개일인지 | 최근 업데이트 기준과 시간대 확정 |
| 평가 구현 전 | 게임·편·캐릭터 평균 산식, 평가자 수 정의 | 사용자에게 일관된 통계 제공 |
| 공개 전 | 이미지 사용 가능 범위·출처, 사용자 신고/숨김·탈퇴 처리 정책 | 실제 서비스 운영에 필요한 기준 |
| 공개 전 | 운영 담당 계정, 월 예산, 도메인, 예상 데이터·방문 규모 | 환경·비용·백업 계획 수립 |

비밀 API 키나 비밀번호는 대화나 Git에 넣지 않는다. 프로젝트가 정해지면 서비스의 환경 변수/비밀 저장소에 설정한다.

## 플러그인 및 서비스 준비

| 항목 | 확인 상태 | 필요한 작업 |
|---|---|---|
| GitHub | 도구가 제공됨. 대상 저장소 접근은 아직 미확인 | 저장소 지정 및 접근 확인. 중복 플러그인 설치 불필요 |
| Vercel | 도구·스킬 제공됨. 대상 프로젝트 권한은 아직 미확인 | 프로젝트 지정, Git 연동, Preview/Production 환경 설정 |
| Supabase | 설치·연결 완료. 프로젝트 목록 조회 성공 | SubCollano, Collabo tracker 모두 INACTIVE. 섭차피디아 대상 프로젝트 선택 또는 신규 프로젝트 준비 필요 |
| Excel/스프레드시트 | 분석 스킬 제공됨 | 파일만 있으면 분석 시작 가능. 별도 Excel 플러그인은 필수 아님 |
| Figma | 현재 입력은 이미지 레퍼런스로 예정 | Figma 원본 작업을 요청할 때만 선택. 현재 필수 아님 |
| Google Drive/Dropbox | 로컬 자료 경로로 진행 가능 | 원본을 해당 서비스에서 직접 관리할 때만 선택 |

Supabase 플러그인은 개발 편의를 위한 선택 사항이며 웹앱 실행에 필수 설치되는 구성요소가 아니다. Supabase 프로젝트 자체는 필요하다. 연결 없이도 SQL을 Studio에서 적용하는 방법이 있다.

설치 후 확인: 기존 프로젝트 `SubCollano`(ap-south-1), `Collabo tracker`(ap-northeast-1)는 모두 INACTIVE 상태다. 프로젝트 이름만으로 이 서비스의 대상이라고 판단할 수 없어 재개·생성·SQL 적용은 수행하지 않았다.

Google 로그인에는 Supabase 외에 Google OAuth 설정과 허용 리디렉션 URL 구성이 필요하다. [Google 로그인](https://supabase.com/docs/guides/auth/social-login/auth-google), [Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls).

Vercel은 Git 연동 배포와 환경별 변수를 지원한다. Preview를 만들더라도 DB까지 자동 격리되는 것은 아니므로 개발·운영 Supabase 대상을 별도로 지정한다. [Git 배포](https://vercel.com/docs/git), [환경 변수](https://vercel.com/docs/environment-variables).

## 예상 문제와 예방책

1. Excel ID의 앞자리 0 손실, 중복, 참조 누락: 원본 셀 형식을 점검하고 전체 검증 실패 시 적용하지 않는다.
2. 다른 게임의 등장 인물 연결: 복합 FK로 차단한다.
3. 재import가 운영 수정값을 덮어씀: 변경 미리보기와 필드별 덮어쓰기 범위를 둔다. 누락 행을 자동 삭제하지 않는다.
4. 공개 부모를 숨겨도 장/검색에서 노출됨: RLS로 상위 공개 상태까지 검사하고 직접 URL·통계도 함께 테스트한다.
5. 이미지 URL을 알고 있으면 비공개 이미지 접근 가능: DB 비공개와 파일 접근권은 별개다. 비공개 원본이 필요하면 private bucket과 접근 검증을 사용한다. [Storage 접근 제어](https://supabase.com/docs/guides/storage/security/access-control).
6. 좋아요·평가 중복 클릭/동시 요청: UNIQUE 및 원자적 upsert/delete로 처리한다.
7. 평점 집계 비용과 N+1 조회: 첫 버전은 페이지 단위 묶음 조회, 이후 실제 규모에 맞춰 인덱스·집계 최적화.
8. 스포일러가 검색·메타데이터·캐릭터 목록에서 노출: 코멘트 접기만으로 해결되지 않는다. 캐릭터 등장 자체를 가릴지 별도 결정.
9. 모바일 캐릭터 영역 접근성과 가로 스크롤: 키보드 선택·포커스·터치·세로 스크롤 충돌을 검증.
10. Preview가 운영 DB에 쓰기: 환경별 프로젝트/비밀값 분리와 배포 전 연결 확인.

정확한 일정·운영비는 원본 규모와 화면 레퍼런스 확인 후 산정한다. 현재 단계에서 전체 구현 완료일을 확약할 근거는 없다.
