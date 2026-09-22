# 운영 인수 사항

## 2026-09-20 구현 및 검증

Supabase 프로젝트: `lbeoipqedkjmekfntcdn`, 서울, 생성 당시 무료 월 $0 확인. 전체 데이터는 12개 편·29개 장·214명 캐릭터·703개 등장 관계이며 한국 공개일 기준 10개 편·24개 장·173명 캐릭터를 공개합니다.

510개 WebP 파생본을 비공개 content 버킷에 업로드했습니다. 공개 콘텐츠에 연결된 객체만 익명 조회를 허용합니다. 일회성 업로드 Edge Function은 작업 완료 후 410 응답만 반환하도록 닫았습니다. 업로드 스크립트만 실행해도 이 기능이 다시 열리지는 않습니다.

DB 테스트에서는 비공개 대상 차단, 타인 평가·한줄평 수정 차단, 사용자별 중복 방지, 0.49점 거절, 자기 한줄평 좋아요 및 중복 좋아요 차단을 확인했습니다. 보안 진단에 경고가 없었습니다. Google 공급자가 미설정이므로 실제 Google 로그인 후 브라우저 작성 흐름은 아직 검증하지 못했습니다.

Windows Turbopack 자식 Node 실행 오류로 배포 빌드는 공식 Webpack 옵션을 사용합니다. TypeScript 검사와 배포 빌드가 통과했습니다. CLI 도구는 앱 의존성에서 제거했고 npm audit 0건을 확인했습니다.

## Google 로그인

Google Cloud 웹용 OAuth 클라이언트를 만든 후 Supabase Authentication의 Google 공급자에 client ID와 secret을 직접 입력합니다. secret을 채팅이나 GitHub에 올리지 마세요.

- Google 리디렉션 URI: `https://lbeoipqedkjmekfntcdn.supabase.co/auth/v1/callback`
- Supabase URL Configuration: 실제 사이트 URL과 `http://localhost:3000/auth/callback`, 배포 도메인의 `/auth/callback`을 허용
- Google 동의 화면이 테스트 모드면 테스트 사용자를 등록

활성화 이후 로그인·평가 생성/수정·한줄평 생성/수정/삭제·좋아요·로그아웃을 브라우저에서 최종 확인해야 합니다.

## Vercel

`tiredestest's projects` 팀의 무료 Hobby 요금제를 확인하고 `subpidea` 프로젝트에 Preview 배포했습니다. 사용자가 목적지와 미리보기 공개를 승인했고 공식 CLI 로그인도 완료했습니다.

- 미리보기: https://subpidea-preview-tiredestests-projects.vercel.app
- 프로젝트 ID: `prj_2OkgSjTE63cBu1i2CEOPxkywF8Fy`
- 배포 ID: `dpl_C2c4tYym9FCEeAho8YLf67M7t5ZF`, READY
- 배포 보호가 켜져 있어 브라우저에서 Vercel 로그인이 필요합니다. 공식 `vercel curl`로 홈의 실제 카탈로그와 캐릭터 이미지 HTTP 200을 확인했습니다.
- GitHub 소스는 저장됐지만 Vercel GitHub 자동 배포 연결은 실패했습니다. Vercel 프로젝트 Settings → Git에서 저장소 접근 권한을 연결해야 합니다. 현재는 CLI 수동 배포입니다.
- 재배포 명령: `./scripts/deploy-preview.ps1` (성공한 배포에 고정 주소 연결)

첫 기본 대상 빌드는 파일 제외 규칙 문제로 실패했고 공개 앱으로 완성되지 않았습니다. `/supabase/` 제외 경로를 최상위로 한정한 뒤 Preview 대상을 명시한 재배포가 성공했습니다. `.vercelignore` 변경 시 `vercel deploy --dry --json`으로 앱 소스 포함과 자료·환경 파일 제외를 확인합니다.

Preview 환경에 Supabase URL과 publishable key를 설정했습니다. 서비스 역할 키는 웹앱에 필요하지 않습니다. OAuth 활성화 시 실제 배포 URL의 `/auth/callback`을 Supabase 허용 목록에 추가해야 합니다. `NEXT_PUBLIC_APP_URL`은 사이트 주소용 예약 설정이며 현재 로그인 리디렉션은 브라우저 origin을 사용합니다. 유료 전환은 하지 않았습니다.

## 남은 범위와 제약

- 관리자 웹 편집·Excel 검토/확정·설정·변경 기록과 게임별 통계를 구현했습니다. [관리자 운영 안내](admin-guide.md)를 참고하세요. Google 설정과 운영자 계정 지정 후 실제 로그인 화면의 저장 검증이 남아 있습니다.
- 카탈로그는 500건씩 나누어 읽어 기본 API 한도 누락을 방지합니다. 전체 카탈로그를 읽는 구조이므로 대규모 운영 시 목적별 조회와 검색 인덱스가 필요합니다.
- 이미지 원본은 보존하고 비율을 유지해 크기를 맞췄습니다. 서로 다른 종횡비에는 여백이 있습니다.
- 이미지 응답은 비공개 전환을 즉시 반영하도록 no-store입니다. 트래픽 증가 시 대역폭과 권한을 함께 고려한 캐시가 필요합니다.
- 공개 저장소에 원본 자료·비밀 값은 포함하지 않습니다. 이미지 사용 권한, 운영 정책, 개인정보 안내는 서비스 공개 전에 확정해야 합니다.
- 추가 플러그인은 필수가 아닙니다. GitHub·Supabase·Vercel 연결로 진행 가능하며 Figma는 디자인 협업 시 선택 사항입니다.

## 후속 배포 검증

2026-09-21 관리자 기능과 Excel 변경 검토·일괄 반영, 게임별 평가 통계를 Preview에 배포했습니다. 배포 빌드가 통과했고 실제 통계 페이지의 HTTP 200 및 콘텐츠, 비로그인 관리자 import 요청의 HTTP 403을 확인했습니다. 관리자 실제 로그인·저장 검증은 Google OAuth와 관리자 계정 지정 후 진행합니다.

## 로그인 보안 기준 (2026-09-21)

- 사용자의 요청에 따라 로그인 보안 검증을 기능 완료 조건으로 유지합니다.
- Supabase SSR의 PKCE 코드 교환을 사용하고, 서버 권한 판정은 getUser로 검증합니다. 관리자 권한은 사용자 수정이 가능한 user_metadata에서 읽지 않습니다.
- 세션 갱신 시 SDK가 제공하는 캐시 방지 헤더를 전달합니다. 세션 쿠키가 있거나 로그인·인증·관리자 경로인 응답은 private, no-store 처리합니다. 인증 경로에는 no-referrer를 적용합니다.
- 로컬 프로덕션 빌드에서 콜백의 외부 next 무시 및 내부 오류 페이지 이동, 출처 없는 로그아웃 403, 비로그인 관리자 import 403과 캐시 방지 헤더를 확인했습니다. 빌드와 타입 검사 통과.
- Google 활성화 시 허용 리디렉션 주소를 운영 주소로 제한하고 실제 로그인·로그아웃·만료 세션·타인 데이터 수정 거절을 검증해야 합니다. 비밀 키와 토큰은 저장소나 로그에 남기지 않습니다.
- 관리자 권한 회수 시 기존 JWT의 역할 정보는 만료 전까지 남을 수 있습니다. 즉시 회수가 필요한 운영에는 DB의 최신 권한 조회 방식과 세션 폐기 검증을 추가해야 합니다. 현재 이를 즉시 회수 보장으로 간주하지 않습니다.
- 기준 문서: https://supabase.com/docs/guides/auth/server-side/advanced-guide

보안 보완 Preview 배포 완료: 인증 콜백 HTTP 307, 사이트 내부 오류 페이지 이동, Cache-Control: private, no-store 및 Referrer-Policy: no-referrer를 실제 배포에서 확인했습니다. Google 공급자는 아직 비활성 상태입니다. 최초 설정은 [Google 로그인 설정 안내](google-login-setup.md)를 따릅니다.

## 후속 기능

마이페이지·닉네임 수정·게임 팔로우, 등장 캐릭터 추가/제외/복원/교체, 게임 헤더 업로드와 Excel GAMES 연결을 구현했습니다. [사용 안내](member-and-admin-followups.md)를 참고하세요. 재배포 시 scripts/deploy-preview.ps1을 사용해 고정 Preview 주소를 갱신합니다.

## 2026-09-22 이벤트 지원

메인·이벤트 필터와 Event Excel 가져오기를 배포했습니다. [업데이트 및 적용 안내](events-20260922.md)를 참고하세요. 이미지 102개 변환본 업로드 완료, 실제 Excel 일괄 적용은 사용자 관리자 단계로 남아 있습니다.

## 2026-09-22 관리자 이미지 일괄 업로드

관리자 → 이미지 관리에 스토리·캐릭터 이미지 일괄 검사/변환/연결 기능을 배포했습니다. [파일명과 사용 안내](bulk-images.md)를 참고하세요. 기존 게임 헤더 기능은 같은 페이지 아래에 유지합니다.
