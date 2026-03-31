# Emergency Handover

심사용 공개 배포를 전제로 만든 `Next.js` 프로젝트입니다.  
외부 API 키 없이 확인할 수 있고, 주요 동작은 더미 데이터와 브라우저 `localStorage`를 사용합니다.

## 배포/심사 전제

- 공개 URL로 접속 가능해야 합니다.
- 심사 기간 동안 같은 프로덕션 URL을 유지해야 합니다.
- 별도 백엔드, DB, API 키 없이 동작해야 합니다.
- 로그인, 팀 생성, 메시지, 제출 이력 등 사용자 상태는 브라우저 `localStorage`에 저장됩니다.

## 기술 스택

- `Next.js 16`
- `React 19`
- `App Router`
- 정적 JSON 데이터 + 브라우저 `localStorage`

## 로컬 실행

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000`을 열어 확인합니다.

## 프로덕션 빌드 테스트

배포 전에 아래 명령으로 빌드가 실제로 통과하는지 확인합니다.

```bash
npm run build
```

로컬 프로덕션 서버 확인이 필요하면:

```bash
npm run start
```

## 심사자 관점의 테스트 포인트

별도 계정이나 키 발급 없이 브라우저에서 바로 확인할 수 있습니다.

1. 메인 페이지 접속
2. 해커톤 목록 확인
3. 팀 모집 페이지에서 팀 생성/수정
4. 로그인/회원가입 테스트
5. 메시지/참가 요청/제출 이력 확인
6. 새로고침 후 `localStorage` 기반 상태 유지 확인

주의:

- `localStorage` 기반이므로 브라우저나 디바이스가 바뀌면 데이터는 공유되지 않습니다.
- 시크릿 모드, 브라우저 저장소 초기화, 다른 기기 접속 시 기존 로컬 상태는 보이지 않습니다.

## 데이터 동작 방식

- 기본 목록 데이터는 `data/*.json`에서 읽습니다.
- 사용자 행동 데이터는 브라우저 `localStorage`에 저장합니다.
- 서버 DB를 사용하지 않으므로 심사자가 별도 환경변수를 넣을 필요가 없습니다.

## Vercel 배포 설정

이 프로젝트는 Vercel에서 `Next.js`로 배포합니다.

- Framework Preset: `Next.js`
- Build Command: `npm run build`
- Output Directory: 비워둠
- Environment Variables: 없음
- Node.js: Vercel 기본 LTS 권장

저장소 루트가 아니라 이 폴더가 실제 앱 루트라면 Vercel에서 아래를 맞춰야 합니다.

- Root Directory: `emergency-handover`

## vercel.json 필요 여부

현재 프로젝트는 일반 SPA 정적 호스팅이 아니라 `Next.js App Router` 프로젝트입니다.  
따라서 새로고침 404 방지용 SPA rewrite 목적의 `vercel.json`은 현재 기준으로 필요하지 않습니다.

## 배포 절차

이 폴더에서 실행합니다.

```bash
npm install
npm run build
npx vercel
```

프로덕션 반영:

```bash
npx vercel --prod
```

## 심사용 운영 권장사항

1. 제출 링크는 Preview URL이 아니라 Production URL로 제출합니다.
2. 심사 중 URL이 바뀌지 않도록 같은 Vercel 프로젝트를 유지합니다.
3. 테스트 계정 안내가 필요하면 README나 제출 문서에 함께 적습니다.
4. 브라우저 저장소 기반 앱이므로 심사자에게 "같은 브라우저에서 이어서 확인하면 상태가 유지된다"는 점을 안내하는 것이 좋습니다.

## 품질 점검 체크리스트

배포 전 아래 항목을 확인합니다.

- `npm run build` 성공
- 메인 페이지 정상 렌더링
- `/auth` 로그인/회원가입 동작
- `/camp` 팀 생성/수정 동작
- `/messages` 메시지 화면 진입
- `/hackathons/[slug]` 상세 페이지 진입
- 새로고침 시 주요 페이지 정상 동작
- 별도 환경변수 없이 서비스 확인 가능

## 참고

- 더미 데이터 위치: `data/`
- 인증/세션 저장: `lib/local-auth.ts`
- 메시지 저장: `lib/direct-messages.ts`
