# Notion OAuth DB 뷰어

Notion API OAuth를 사용하여 노션의 데이터베이스를 조회하는 웹 애플리케이션입니다.

## 기능

- ✅ Notion OAuth 로그인
- ✅ 사용자의 모든 데이터베이스 목록 조회
- ✅ 데이터베이스의 구조 및 레코드 조회
- ✅ 반응형 UI 디자인
- ✅ 세션 기반 인증

## 프로젝트 구조

```
NotionAPI/
├── server.js                 # Express 메인 서버
├── package.json             # 프로젝트 의존성
├── .env                     # 환경 변수 설정
├── middleware/
│   └── auth.js             # 인증 미들웨어
├── routes/
│   ├── auth.js             # OAuth 인증 라우트
│   └── notion.js           # Notion API 라우트
└── public/
    ├── index.html          # HTML 페이지
    ├── style.css           # 스타일시트
    └── script.js           # 프론트엔드 로직
```

## 설치 및 실행

### 1. Notion 통합 앱 설정

1. [Notion 개발자 포탈](https://www.notion.com/my-integrations)에 접속
2. "새 통합" 또는 기존 통합의 설정 확인
3. OAuth 정보 얻기:
   - Client ID
   - Client Secret
   - Redirect URI (개발 환경: `http://localhost:3002/auth/notion/callback`)

### 2. 환경 변수 설정

`.env` 파일에 다음 정보를 입력하세요:

```
PORT=3002
NOTION_CLIENT_ID=your_client_id_here
NOTION_CLIENT_SECRET=your_client_secret_here
REDIRECT_URI=http://localhost:3002/auth/notion/callback
SESSION_SECRET=your-secret-key-change-this-in-production
NODE_ENV=development
```

### 3. 패키지 설치

```bash
npm install
```

### 4. 서버 시작

```bash
# 개발 모드 (자동 재시작)
npm run dev

# 또는 일반 실행
npm start
```

서버가 실행되면 브라우저에서 다음 주소로 접속하세요:
```
http://localhost:3002
```

## 사용 방법

1. **로그인**: "Notion으로 로그인" 버튼을 클릭하여 OAuth 인증
2. **데이터베이스 선택**: 사용 가능한 데이터베이스 목록 확인 및 선택
3. **데이터 조회**: 선택한 데이터베이스의 레코드를 표로 확인
4. **돌아가기**: "돌아가기" 버튼으로 데이터베이스 목록으로 복귀
5. **로그아웃**: 헤더의 "로그아웃" 버튼으로 로그아웃

## API 엔드포인트

### 인증 (Auth)

- `GET /auth/notion/login` - Notion OAuth 로그인 시작
- `GET /auth/notion/callback` - OAuth 콜백 처리
- `GET /auth/user` - 현재 로그인한 사용자 정보
- `GET /logout` - 로그아웃

### Notion API

- `GET /api/databases` - 사용자의 모든 데이터베이스 조회
- `GET /api/database/:databaseId` - 특정 데이터베이스 구조 조회
- `POST /api/database/:databaseId/query` - 데이터베이스 레코드 조회
- `GET /api/page/:pageId/blocks` - 페이지 내용 조회

## 기술 스택

- **백엔드**: Node.js, Express.js
- **인증**: Notion OAuth, Express Session
- **API**: Notion API v1
- **프론트엔드**: HTML5, CSS3, Vanilla JavaScript

## 의존성

```json
{
  "express": "^4.18.2",
  "express-session": "^1.17.3",
  "axios": "^1.4.0",
  "dotenv": "^16.3.1",
  "body-parser": "^1.20.2",
  "cors": "^2.8.5"
}
```

## 에러 처리

- OAuth 콜백 에러: State 검증, 토큰 발급 실패 등
- 데이터베이스 접근 에러: 권한 부족, 존재하지 않는 DB 등
- 레코드 조회 에러: API 한도, 네트워크 에러 등

모든 에러는 브라우저의 개발자 도구 콘솔에서 확인할 수 있습니다.

## 프로덕션 배포 시 주의사항

1. **환경 변수**
   - `SESSION_SECRET`을 복잡한 문자열로 변경
   - `NODE_ENV`를 `production`으로 설정
   - `cookie.secure: true`로 설정

2. **보안**
   - HTTPS 사용
   - CORS 설정 재검토
   - REDIRECT_URI를 실제 도메인으로 변경

3. **성능**
   - 데이터베이스 쿼리 페이지네이션 구현
   - 캐싱 추가 (Redis 등)
   - 요청 속도 제한(Rate Limiting) 구현

## 라이선스

MIT

## 지원

문제가 발생하면 Notion API 문서를 참조하세요:
https://developers.notion.com/reference/intro
