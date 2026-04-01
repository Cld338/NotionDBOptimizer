# Services 테스트 종합 가이드

TDD 스킬에 따라 작성된 전체 테스트 코드입니다. 각 서비스의 기능을 검증합니다.

## 📋 테스트 파일 목록

### 1. analyzerService.test.js
**책임:** 데이터 분석 서비스의 통계 계산 및 품질 점수 검증

#### 주요 테스트:
- **calculateQualityScore**
  - 완성도, 컬럼 수, 성능 점수 가중치 계산
  - 기본값 처리 및 최대값 캡핑
  - 엣지 케이스 (0값)

- **analyzeDatabase**
  - 총 레코드 수 및 컬럼 수 반환
  - 완성도 점수 계산
  - 컬럼별 통계 생성
  - 사전 계산된 통계 재사용

- **analyzePerformanceIssues**
  - 정상 데이터베이스: "good" 심각도
  - 1000개+ 페이지: "warning"
  - 5000개+ 페이지: "critical"
  - 속성 수, 수식/롤업, 참조 체인 분석

- **evaluateOptimizationOpportunities**
  - 저활용도 속성(30% 미만) 식별
  - 필터링 최적화 기회 추출

- **checkSizeLimits**
  - 페이지당 2.5MB 제한 검증
  - DB당 1.5MB 구조 크기 확인
  - 관계형 필드 10000개 제한

- **analyzeDeepReferenceChains**
  - 3단계 이상 체인 식별
  - 순환 참조 방지
  - 영향받는 레코드 계산

#### 테스트 수: 33개

---

### 2. cacheService.test.js
**책임:** Redis 캐시 서비스의 CRUD 동작 및 연결 상태 관리

#### 주요 테스트:
- **initializeRedis**
  - 정상 초기화
  - 환경변수 URL 설정
  - 연결 실패 처리
  - 중복 초기화 무시

- **getCachedData**
  - 캐시 hit/miss 처리
  - 데이터 역직렬화
  - Redis 에러 처리
  - 다양한 데이터 타입 지원

- **setCachedData**
  - 기본 TTL 600초
  - 커스텀 TTL 설정
  - 데이터 직렬화

- **deleteCachedData**
  - 단일 키 삭제
  - 에러 처리

- **deleteCachedDataByPattern**
  - 패턴 매칭 삭제
  - 일치하는 키 없음 처리

- **getCacheStatus**
  - 연결 상태 정보 반환
  - URL 정보 포함

- **closeRedis**
  - 연결 종료
  - 실패 처리

#### 테스트 수: 31개

---

### 3. chainAnalyzer.test.js
**책임:** 데이터베이스 간 참조 체인 분석 및 트리 구조 검증

#### 주요 테스트:
- **buildReferenceChains**
  - Formula 필드 시작점
  - Rollup 필드 시작점
  - 참조 체인 구조 검증
  - 단순 필드 필터링
  - 중복 필드 처리
  - 순환 참조 방지

- **참조 체인 구조**
  - tree 객체 구조
  - 노드 속성 검증
  - children 배열
  - expression 저장
  - referencedProperty 정보

- **엣지 케이스**
  - undefined/null propertyMaps
  - 빈 properties
  - 깊은 참조 체인 (5+ 레벨)
  - 많은 참조 필드 (50개+)

#### 테스트 수: 28개

---

### 4. databaseService.test.js
**책임:** 데이터베이스 조회, 레코드 처리 및 네트워크 노드/엣지 생성

#### 주요 테스트:
- **getAllDatabases**
  - 모든 데이터베이스 조회
  - 제목 없음 처리 ("Untitled")
  - API 에러 전파
  - 빈 목록 반환
  - icon/타임스탬프 포함

- **getDatabaseInfo**
  - 데이터베이스 구조 조회
  - format 함수 통합
  - 에러 처리

- **getAllDatabaseRecords**
  - 페이지네이션 처리
  - 단일/다중 페이지
  - 빈 데이터베이스
  - 많은 페이지 처리

- **queryDatabasePages**
  - 페이지 쿼리
  - 기본/커스텀 페이지 크기
  - 마지막 페이지 처리

- **buildPropertyMaps**
  - propertyIdMapByDb 생성
  - globalPropertyIdMap 생성
  - ID 없는 속성 처리
  - 다중 DB 처리

- **createDatabaseNode**
  - 노드 기본 생성
  - 중심 노드 (isCenter=true)
  - physics 활성화
  - 폰트 색상

- **createDatabaseEdge**
  - 엣지 기본 생성
  - 방향성 설정
  - 제목 생성
  - 색상 설정

#### 테스트 수: 39개

---

## 🚀 테스트 실행

### 모든 테스트 실행
```bash
npm test
```

### 특정 서비스 테스트
```bash
npm run test:analyzer     # analyzerService
npm run test:cache        # cacheService
npm run test:chain        # chainAnalyzer
npm run test:database     # databaseService
```

### 전체 서비스 테스트
```bash
npm run test:services
```

### 테스트 감시 모드
```bash
npm run test:watch
```

### 커버리지 리포트
```bash
npm run test:coverage
```

---

## 📊 테스트 통계

| 서비스 | 테스트 수 | 구성 |
|--------|---------|------|
| analyzerService | 33 | 6 suites |
| cacheService | 31 | 6 suites |
| chainAnalyzer | 28 | 5 suites |
| databaseService | 39 | 7 suites |
| **전체** | **131** | **24 suites** |

---

## ✅ 테스트 다루는 영역

### 기능 검증
- ✅ 각 함수의 기본 기능
- ✅ 반환값 구조 및 타입
- ✅ 매개변수 기본값
- ✅ 다양한 입력 조합

### 예외 처리
- ✅ API 에러 처리
- ✅ 네트워크 장애
- ✅ 잘못된 데이터 형식
- ✅ null/undefined 처리

### 엣지 케이스
- ✅ 빈 데이터 ([]/{})
- ✅ null/undefined 값
- ✅ 매우 큰 데이터세트
- ✅ 특수 문자 및 인코딩

### 통합 시나리오
- ✅ 다중 함수 작업 흐름
- ✅ 데이터 변환 파이프라인
- ✅ 가상 네트워크 생성

---

## 🏗️ 프로젝트 구조

```
tests/
├── analyzerService.test.js    (33 테스트)
├── cacheService.test.js       (31 테스트)
├── chainAnalyzer.test.js      (28 테스트)
└── databaseService.test.js    (39 테스트)

jest.config.js                 (Jest 설정)
.babelrc                       (Babel 설정)
```

---

## 🔧 Mock 전략

### cacheService
- `redis` 모듈 mock
- 비동기 메서드 실행 시나리오

### chainAnalyzer
- `formulaParser` 모듈 mock

### databaseService
- `notionApi` 모듈 mock
- `propertyFormatter` 모듈 mock

---

## 📝 테스트 작성 원칙 (TDD)

1. **RED**: 실패하는 테스트 먼저 작성
2. **GREEN**: 최소한의 코드로 테스트 통과
3. **REFACTOR**: 중복 제거 및 구조 개선

각 테스트는:
- 명확한 목표 (한 가지만 검증)
- 명확한 이름 (무엇을 테스트하는지 알 수 있음)
- 실행 가능 (mock/실제 데이터 사용)

---

## 🎯 커버리지 목표

```
현재 목표: 최소 50%
- Branches: 50%
- Functions: 50%
- Lines: 50%
- Statements: 50%
```

---

## 📚 참고 자료

- [Jest 공식 문서](https://jestjs.io/)
- [테스트-주도 개발 (TDD)](https://en.wikipedia.org/wiki/Test-driven_development)
- [Mock 작성 가이드](https://jestjs.io/docs/mock-functions)

---

## ⚠️ 주의사항

### 테스트 실행 전
1. Node.js 16+ 설치 필요
2. 모든 의존성 설치: `npm install`
3. Redis (캐시 테스트): mock 사용하므로 실제 설치 불필요

### 테스트 실패 시
1. 의존성 재설치: `npm install`
2. Jest 캐시 초기화: `npm test -- --clearCache`
3. 노드 모듈 재설치: `rm -rf node_modules && npm install`

---

## 🔄 지속적 개선

테스트 코드는 서비스 코드와 함께 발전합니다:
- 새로운 기능 추가 시 테스트 먼저 작성
- 버그 발견 시 재현 테스트 작성
- 취약한 영역 강화를 위해 테스트 추가

---

**마지막 업데이트**: 2024년 4월
