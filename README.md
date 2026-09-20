# 섭차피디아

게임 스토리와 장별 등장 캐릭터 평가 서비스.

현재 단계: 실제 데이터 입력·이미지 업로드·웹앱 구현 완료. 홈, 게임·편·장, 캐릭터, 검색, 평가·한줄평·좋아요 기능을 구현했다. Google OAuth 공급자 설정과 Vercel 배포는 남아 있다. 관리자 웹 편집·Excel 업로드 UI는 후속 범위이며 현재 콘텐츠 관리는 Supabase Studio에서 수행한다.

Node.js 22.14 이상에서 `npm ci` 실행 후 `.env.example`을 `.env.local`로 복사하고 값을 설정한다. `npm run dev` 또는 `npm run build` 후 `npm start`로 실행한다.

검증: `npm run typecheck`, `npm run build`, `python -m unittest discover -s tests -p "test_*.py"`. DB 권한 테스트는 `tests/rls.sql`이며 전체 트랜잭션을 rollback한다.

- [운영 및 남은 설정](docs/operations.md)

Supabase: [subpidea · 서울](https://supabase.com/dashboard/project/lbeoipqedkjmekfntcdn). 생성 비용 월 $0을 확인하고 생성했으며 ACTIVE_HEALTHY 상태를 재조회해 확인했다.

- [검토 결과·필요 자료·예상 문제](docs/review.md)
- [구현 및 검증 계획](docs/implementation-plan.md)
- [콘텐츠 DB SQL 초안](docs/schema-draft.sql)
- [실제 자료 분석·공개 정책·최적화 결과](docs/source-analysis.md)
- [데이터 준비 도구 실행](docs/data-pipeline.md)

`docs/schema-draft.sql`은 최초 검토 초안으로 실행 대상이 아니다. 현재 적용된 DB 이력은 `supabase/migrations/`이며 원격 버전과 일치한다. 이미 적용된 프로젝트에 다시 실행하지 않는다. `schema.sql`, `aggregates.sql`, `reviews.sql`은 참조본이며 `features.sql`은 초기 스키마에 포함된 부분이다. 원본 Excel·이미지·변환 결과·환경 파일은 Git에 포함하지 않는다.
