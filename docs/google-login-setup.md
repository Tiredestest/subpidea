# Google 로그인 최초 설정

현재 로그인 코드는 구현됐으며 Google OAuth 클라이언트 등록이 남아 있습니다. Google 계정 로그인과 Client secret 입력은 운영자가 직접 처리합니다.

## 1. Google Cloud 프로젝트와 동의 화면

1. https://console.cloud.google.com/ 에서 프로젝트 선택 → 새 프로젝트를 열고 `subpidea`라는 프로젝트를 만듭니다. 같은 이름의 기존 프로젝트가 있다면 먼저 용도를 확인합니다.
2. https://console.cloud.google.com/auth/overview 에서 해당 프로젝트를 선택하고 Google Auth Platform 설정을 시작합니다.
3. 앱 이름은 `섭차피디아`, 사용자 지원 이메일과 개발자 연락처는 본인이 확인할 수 있는 이메일로 설정합니다.
4. Audience는 외부(External), 게시 상태는 테스트(Testing)로 준비하고 로그인 검증에 사용할 본인 Google 이메일을 테스트 사용자로 추가합니다.
5. Data Access에는 기본 로그인 정보인 `openid`, `https://www.googleapis.com/auth/userinfo.email`, `https://www.googleapis.com/auth/userinfo.profile`만 사용합니다. Gmail·Drive 권한은 필요하지 않습니다.

## 2. 웹 OAuth 클라이언트

Google Auth Platform → Clients → Create client에서 유형을 Web application으로 선택합니다. 이름은 `subpidea-web-preview`로 지정합니다.

Authorized JavaScript origins:

```text
https://subpidea-pav5hwgw7-tiredestests-projects.vercel.app
```

Authorized redirect URIs (Google에서 Supabase로 돌아오는 주소):

```text
https://lbeoipqedkjmekfntcdn.supabase.co/auth/v1/callback
```

생성된 Client ID와 Client secret을 다음 단계의 Supabase 대시보드에 직접 입력합니다. 채팅·소스·스크린샷에 secret을 공유하지 않습니다. 이 값은 Vercel 환경 변수에 넣지 않습니다.

## 3. Supabase 연결

https://supabase.com/dashboard/project/lbeoipqedkjmekfntcdn/auth/providers 에서 Google을 열고 Client ID와 Client secret을 입력한 뒤 활성화하여 저장합니다. nonce 검사 우회 및 이메일 없는 사용자 허용 옵션은 켜지 않습니다.

https://supabase.com/dashboard/project/lbeoipqedkjmekfntcdn/auth/url-configuration 에서 다음과 같이 설정합니다.

Site URL:

```text
https://subpidea-pav5hwgw7-tiredestests-projects.vercel.app
```

Redirect URLs (Supabase에서 사이트로 돌아오는 주소):

```text
https://subpidea-pav5hwgw7-tiredestests-projects.vercel.app/auth/callback
```

미리보기 주소는 재배포 시 달라질 수 있습니다. 변경된 주소는 정확히 추가하고 불필요한 과거 주소는 제거합니다. 광범위한 `*.vercel.app` 허용은 사용하지 않습니다. Vercel 배포 보호는 별개이므로 미리보기 접근에 Vercel 로그인이 필요할 수 있습니다.

## 4. 설정 후 검증

설정을 저장하면 사이트 로그인 페이지를 새로고침하여 Google 버튼을 사용할 수 있습니다. 본인 Google 계정으로 첫 로그인을 완료한 뒤 알려 주세요. 비밀번호·인증 코드·secret은 보내지 않습니다.

다음 작업은 실제 로그인과 로그아웃, 평가·한줄평 저장 및 타인 데이터 수정 차단 검증입니다. 관리자는 계정 확인 후 별도로 지정하며 첫 가입자에게 자동으로 권한을 부여하지 않습니다. 사용자 확인 전 임의 계정을 승격하지 않습니다.

## 공식 안내

https://supabase.com/docs/guides/auth/social-login/auth-google
