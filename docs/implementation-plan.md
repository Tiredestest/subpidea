# 구현·검증 계획

## 진행 순서

1. 자료 분석: 시트/컬럼 목록, 행 수, ID 중복, FK 누락, 이미지 대응표 및 요구사항과의 차이 보고서 생성.
2. 콘텐츠 기반: DB 초안 보완 → 개발용 DB 적용 → RLS 검증 → importer dry-run → 실제 입력 → Storage 연결.
3. Phase 1: 홈, 게임 목록/상세, 편 상세, 장 상세, 동적 캐릭터 선택, 장 이동, 최근 업데이트 직접 링크, 반응형.
4. Phase 2: Google Auth, 장/장별 캐릭터 평가, 수정·집계, 소유권·비공개 대상 쓰기 차단.
5. Phase 3: 코멘트·수정·삭제·스포일러·좋아요·정렬, 통합 검색, 캐릭터 상세.
6. Phase 4: 관리자 import UI, 통계, 운영 편의 기능. 다중 게임을 수용하는 DB 구조는 첫 단계부터 적용.

## 프로젝트 구조 제안

```text
src/app/
  page.tsx
  games/page.tsx
  games/[gameSlug]/page.tsx
  games/[gameSlug]/arcs/[arcSlug]/page.tsx
  games/[gameSlug]/arcs/[arcSlug]/chapters/[chapterSlug]/page.tsx
  games/[gameSlug]/characters/page.tsx
  games/[gameSlug]/characters/[characterSlug]/page.tsx
  search/page.tsx
  login/page.tsx
  auth/callback/route.ts
  admin/page.tsx
src/components/
  content/      # 카드, breadcrumb, navigator
  chapter/      # CharacterSelector, CharacterPanel
  ratings/     # 별점 입력 및 집계
  comments/    # 작성, 수정, 목록
src/lib/
  supabase/    # 서버/브라우저 client 구분
  repositories/ # 콘텐츠 조회 및 DTO 변환
  import/excelSchema.ts
  validation/
scripts/import/
supabase/migrations/
tests/
```

게임 데이터는 repository에서 조회하고 React에는 표시할 DTO만 전달한다. 별도 시험 fixture는 테스트 데이터로 명확히 구분한다. 설정 누락 상태에서 허구의 평점/콘텐츠로 성공한 것처럼 보이게 하지 않는다.

장 상세는 부모 경로까지 함께 조회하여 다른 게임/편 URL에 동일 장 slug를 붙여도 잘못 조회되지 않게 한다. 장 이동은 공개된 동일 편의 장만 sort_order와 id를 기준으로 안정 정렬한다. 오른쪽 캐릭터 선택 상태는 client component 내부에서 바꾸며 전체 페이지를 다시 로드하지 않는다.

## Excel importer 설계

실제 파일을 받기 전 시트명·컬럼명을 추측해 매핑하지 않는다. `excelSchema.ts` 한 곳에 실제 시트와 컬럼 대응을 모으고, 나머지 코드는 내부 필드만 사용한다.

처리 흐름: 파일 읽기 → 필수 시트/컬럼 확인 → 값 정규화 → 전체 관계/중복 검증 → 이미지 대응 → 신규/변경/동일 항목 비교 보고서 → 적용.

- 원본 키는 텍스트로 보존. 숫자 셀에 선행 0이 이미 사라진 경우 추측 복구하지 않고 오류 보고.
- 필수 ID/제목, 날짜, boolean, 순번 형식을 검증. 순번은 정렬에만 사용.
- 모든 관계를 DB와 입력 집합 기준으로 검증. chapter-character 게임 불일치도 오류.
- slug는 신규 생성 때만 제안하고 재import 시 기존 slug 유지.
- 기본 실행은 dry-run. 오류는 시트/행/컬럼/원본값/원인을 제시하고 쓰기를 하지 않음.
- 적용은 DB 트랜잭션으로 처리. 개별 HTTP upsert를 연속 호출하여 부분 성공 상태를 남기는 방식은 피함.
- 같은 파일 재적용은 중복 생성 없이 동일 결과. 누락 행은 자동 삭제하지 않음.
- 운영에서 바뀐 값과 Excel 값이 충돌하면 변경 보고서에 표시. 적용 직전 updated_at 재검사.
- Storage 업로드와 DB 트랜잭션은 별개이므로 업로드 manifest와 재시도/미참조 객체 정리 절차 필요.
- Supabase 관리자 비밀값은 importer 서버 환경에만 둠. NEXT_PUBLIC 접두어 금지.

## 검증 기준

| 영역 | 필수 검증 |
|---|---|
| 데이터 | 중복 원본 ID, slug 충돌, 없는 FK, 타 게임 캐릭터 연결 실패 |
| 공개 범위 | 익명 조회, 비공개 게임/편/장/캐릭터 직접 접근 차단, 마스터 쓰기 거절 |
| 평가 | 0/0.7/5.5 거절, 0.5/5 허용, 중복 수정, 다른 사용자 수정 거절 |
| 코멘트 | 대상당 1개, 소유자만 수정/삭제, 좋아요 1개/취소, 스포일러 접기 |
| importer | 오류 시 0건 쓰기, 재실행 멱등성, 적용 도중 실패 시 롤백 |
| 화면 | 모든 탐색 링크, 장 selector/이전/다음, URL 직접 접근, 빈 데이터/이미지 누락 |
| 반응형 | 데스크톱 2열, 모바일 순서, 가로 넘침, 키보드 캐릭터 선택 |
| 운영 | Studio 수정 후 새 요청 반영, Preview DB 분리, Git 푸시 후 Preview 배포 |

콘텐츠 초안은 아직 DB에서 실행 검증하지 않았다. 앱 테스트·빌드·브라우저 검증도 프로젝트 생성 후 진행한다.
