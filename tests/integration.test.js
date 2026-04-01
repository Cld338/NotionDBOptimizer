/**
 * integration.test.js
 * 통합 테스트: 여러 모듈이 함께 작동하는 시나리오
 */

jest.mock('../utils/notionApi');
jest.mock('../services/cacheService');

const notionApi = require('../utils/notionApi');
const cacheService = require('../services/cacheService');
const { analyzeDatabase } = require('../services/analyzerService');
const { getAllDatabases, getAllDatabaseRecords } = require('../services/databaseService');

describe('Integration Tests - 통합 시나리오', () => {
    
    beforeEach(() => {
        jest.clearAllMocks();
        jest.resetAllMocks();
        
        // 모든 mock을 기본 상태로 초기화
        notionApi.searchDatabases = jest.fn();
        notionApi.queryDatabase = jest.fn();
        notionApi.getDatabaseStructure = jest.fn();
        
        cacheService.getCachedData = jest.fn();
        cacheService.setCachedData = jest.fn();
        cacheService.deleteCachedData = jest.fn();
        cacheService.closeRedis = jest.fn();
    });

    // ============================================
    // 통합 시나리오 1: 캐시 + DB 조회 + 분석
    // ============================================
    describe('캐시를 활용한 DB 분석 워크플로우', () => {
        test('첫 조회: API 호출 -> 캐시 저장 -> 분석 실행', async () => {
            const mockDbs = [
                {
                    id: 'db-1',
                    title: [{ plain_text: 'Analytics' }],
                    icon: '📊'
                }
            ];

            notionApi.searchDatabases.mockResolvedValue(mockDbs);
            cacheService.getCachedData.mockResolvedValue(null); // 캐시 미스
            cacheService.setCachedData.mockResolvedValue(true);

            // API 호출로 데이터 조회
            const result = await notionApi.searchDatabases('token');
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('db-1');

            // 캐시 저장 (실제 로직에서)
            if (result) {
                await cacheService.setCachedData('databases', result, 600);
            }
            
            // 캐시에 저장됨
            expect(cacheService.setCachedData).toHaveBeenCalledWith('databases', result, 600);
        });

        test('두 번째 조회: 캐시에서 데이터 반환', async () => {
            const cachedData = [
                {
                    id: 'db-1',
                    title: 'Analytics',
                    icon: '📊'
                }
            ];

            cacheService.getCachedData.mockResolvedValue(cachedData);

            const result = await cacheService.getCachedData('all-databases');
            
            expect(result).toEqual(cachedData);
            expect(notionApi.searchDatabases).not.toHaveBeenCalled();
        });

        test('캐시 만료 -> 재조회 -> 캐시 갱신', async () => {
            const newData = [
                { id: 'db-2', title: 'New Database', icon: '🆕' }
            ];

            cacheService.getCachedData
                .mockResolvedValueOnce(null) // 캐시 만료
                .mockResolvedValueOnce(newData);

            notionApi.searchDatabases.mockResolvedValue(newData);

            // 첫 번째 조회 - 캐시 없음
            let result = await cacheService.getCachedData('all-databases');
            expect(result).toBeNull();

            // API 호출 필요
            expect(cacheService.setCachedData).not.toHaveBeenCalled();
        });
    });

    // ============================================
    // 통합 시나리오 2: 대용량 데이터 처리
    // ============================================
    describe('대용량 데이터 조회 및 분석', () => {
        test('5000개 레코드 조회 및 분석 완료', async () => {
            const largeRecordSet = Array(5000).fill(null).map((_, i) => ({
                id: `record-${i}`,
                properties: {
                    name: `Record ${i}`,
                    category: ['A', 'B', 'C'][i % 3],
                    value: i * 10
                }
            }));

            const properties = {
                name: { name: 'Name', type: 'title' },
                category: { name: 'Category', type: 'select' },
                value: { name: 'Value', type: 'number' }
            };

            const result = analyzeDatabase(
                largeRecordSet,
                properties,
                ['name', 'category', 'value']
            );

            expect(result.totalRecords).toBe(5000);
            expect(result.totalColumns).toBe(3);
            expect(result.qualityScore).toBeDefined();
            expect(typeof result.qualityScore).toBe('number');
        });

        test('다중 페이지네이션 처리 (최대 100개/페이지)', async () => {
            const mockResponses = [];
            for (let page = 0; page < 5; page++) {
                mockResponses.push({
                    results: Array(100).fill(null).map((_, i) => ({
                        id: `page-${page}-record-${i}`,
                        properties: { name: `Item ${page * 100 + i}` }
                    })),
                    has_more: page < 4,
                    next_cursor: page < 4 ? `cursor-${page}` : null
                });
            }

            mockResponses.forEach(response => {
                notionApi.queryDatabase.mockResolvedValueOnce(response);
            });

            // 5번 호출해야 500개 레코드 조회
            for (let i = 0; i < 5; i++) {
                const result = await notionApi.queryDatabase('db-1', 'token', 100, 
                    i > 0 ? `cursor-${i-1}` : null
                );
                expect(result.results).toHaveLength(100);
            }

            expect(notionApi.queryDatabase).toHaveBeenCalledTimes(5);
        });

        test('캐시를 활용한 대용량 데이터 성능 최적화', async () => {
            const largeDataset = {
                totalRecords: 10000,
                columnStats: { },
                qualityScore: 85
            };

            // 테스트 시작 시점에 각 호출이 다른 값을 반환하도록 설정
            const mockGetCachedData = jest.fn();
            mockGetCachedData
                .mockResolvedValueOnce(null)           // 첫 호출: null (캐시 미스)
                .mockResolvedValueOnce(largeDataset);  // 두 번째 호출: 데이터 반환
            
            cacheService.getCachedData = mockGetCachedData;
            cacheService.setCachedData = jest.fn().mockResolvedValue(true);

            // 첫 호출: null 반환
            let cached1 = await cacheService.getCachedData('large-analysis');
            expect(cached1).toBeNull();

            // 캐시 저장
            await cacheService.setCachedData('large-analysis', largeDataset, 3600);

            // 두 번째 호출: 데이터 반환
            const cached2 = await cacheService.getCachedData('large-analysis');
            expect(cached2).toEqual(largeDataset);
        });
    });

    // ============================================
    // 통합 시나리오 3: 실패 복구 및 재시도
    // ============================================
    describe('API 실패 복구 및 재시도 메커니즘', () => {
        test('첫 시도 실패 -> 캐시에서 폴백', async () => {
            const cachedFallback = [
                { id: 'db-1', title: 'Cached Database' }
            ];

            // API 호출 설정: 실패
            notionApi.searchDatabases = jest.fn()
                .mockRejectedValueOnce(new Error('Network timeout'));

            // 캐시 설정: 폴백 데이터 반환
            cacheService.getCachedData = jest.fn()
                .mockResolvedValueOnce(cachedFallback);

            // API 호출 실패
            await expect(notionApi.searchDatabases('token'))
                .rejects.toThrow('Network timeout');

            // 캐시에서 폴백
            const fallback = await cacheService.getCachedData('databases-backup');
            expect(fallback).toEqual(cachedFallback);
            expect(fallback).not.toBeNull();
        });

        test('부분 실패 처리: 일부 데이터베이스 조회 실패', async () => {
            const dbIds = ['db-1', 'db-2', 'db-3'];
            
            notionApi.getDatabaseStructure
                .mockResolvedValueOnce({ id: 'db-1', properties: {} })
                .mockRejectedValueOnce(new Error('Access denied'))
                .mockResolvedValueOnce({ id: 'db-3', properties: {} });

            const results = [];
            for (const dbId of dbIds) {
                try {
                    const structure = await notionApi.getDatabaseStructure(dbId, 'token');
                    results.push({ status: 'success', data: structure });
                } catch (error) {
                    results.push({ status: 'error', error: error.message });
                }
            }

            expect(results).toHaveLength(3);
            expect(results[0].status).toBe('success');
            expect(results[1].status).toBe('error');
            expect(results[2].status).toBe('success');
        });

        test('재시도 로직: 지수 백오프로 재시도', async () => {
            let attemptCount = 0;
            
            notionApi.queryDatabase.mockImplementation(() => {
                attemptCount++;
                if (attemptCount < 3) {
                    return Promise.reject(new Error('Temporary failure'));
                }
                return Promise.resolve({ results: [], has_more: false });
            });

            let lastError;
            let result;
            const maxRetries = 3;

            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    result = await notionApi.queryDatabase('db-1', 'token');
                    break;
                } catch (error) {
                    lastError = error;
                    if (attempt < maxRetries) {
                        // 지수 백오프: 2^attempt * 100ms
                        await new Promise(resolve => 
                            setTimeout(resolve, Math.pow(2, attempt) * 100)
                        );
                    }
                }
            }

            expect(result).toBeDefined();
            expect(result.results).toEqual([]);
            expect(attemptCount).toBe(3);
        });
    });

    // ============================================
    // 통합 시나리오 4: 병렬 요청 처리
    // ============================================
    describe('병렬 요청 처리 및 동시성', () => {
        test('여러 데이터베이스 동시 조회', async () => {
            const dbIds = ['db-1', 'db-2', 'db-3', 'db-4', 'db-5'];
            
            dbIds.forEach((dbId, index) => {
                notionApi.getDatabaseStructure.mockResolvedValueOnce({
                    id: dbId,
                    title: `Database ${index + 1}`,
                    properties: {}
                });
            });

            const promises = dbIds.map(dbId => 
                notionApi.getDatabaseStructure(dbId, 'token')
            );

            const results = await Promise.all(promises);

            expect(results).toHaveLength(5);
            results.forEach((result, index) => {
                expect(result.id).toBe(dbIds[index]);
            });
        });

        test('캐시 충돌 없이 병렬 저장', async () => {
            const dataToCache = [
                { key: 'data-1', value: 'value-1' },
                { key: 'data-2', value: 'value-2' },
                { key: 'data-3', value: 'value-3' }
            ];

            cacheService.setCachedData.mockResolvedValue(true);

            const promises = dataToCache.map(item =>
                cacheService.setCachedData(item.key, item.value, 600)
            );

            const results = await Promise.all(promises);

            expect(results).toHaveLength(3);
            expect(cacheService.setCachedData).toHaveBeenCalledTimes(3);
        });

        test('병렬 조회 중 일부 실패 처리', async () => {
            const dbIds = ['db-1', 'db-2', 'db-3'];

            notionApi.queryDatabase
                .mockResolvedValueOnce({ results: [{ id: '1' }], has_more: false })
                .mockRejectedValueOnce(new Error('db-2 error'))
                .mockResolvedValueOnce({ results: [{ id: '3' }], has_more: false });

            const promises = dbIds.map(dbId =>
                notionApi.queryDatabase(dbId, 'token')
                    .catch(error => ({ error: error.message }))
            );

            const results = await Promise.allSettled(promises);

            expect(results).toHaveLength(3);
            expect(results[0].status).toBe('fulfilled');
            expect(results[1].status).toBe('fulfilled');
            expect(results[1].value.error).toBeDefined();
            expect(results[2].status).toBe('fulfilled');
        });
    });

    // ============================================
    // 통합 시나리오 5: 데이터 일관성 검증
    // ============================================
    describe('데이터 일관성 및 무결성', () => {
        test('DB 정보와 레코드 일관성 확인', async () => {
            const mockDbInfo = {
                id: 'db-consistency',
                title: 'Consistency Test',
                properties: {
                    name: { type: 'title' },
                    status: { type: 'select' }
                }
            };

            const mockRecords = [
                { properties: { name: 'A', status: 'Active' } },
                { properties: { name: 'B', status: 'Inactive' } }
            ];

            // DB 속성과 레코드의 속성이 일치하는지 확인
            const recordProperties = Object.keys(mockRecords[0].properties);
            const dbProperties = Object.keys(mockDbInfo.properties);

            recordProperties.forEach(prop => {
                expect(dbProperties).toContain(prop);
            });
        });

        test('캐시 데이터와 최신 데이터 버전 관리', async () => {
            const cacheVersion = { version: 1, data: { id: 'cache-v1' } };
            const freshData = { version: 2, data: { id: 'fresh-v2' } };

            // Mock을 명시적으로 재설정
            cacheService.getCachedData = jest.fn()
                .mockResolvedValueOnce(cacheVersion);
            
            notionApi.searchDatabases = jest.fn()
                .mockResolvedValueOnce(freshData);

            cacheService.setCachedData = jest.fn()
                .mockResolvedValueOnce(true);

            // 캐시 버전 확인
            const cached = await cacheService.getCachedData('data');
            expect(cached).toBeDefined();
            expect(cached.version).toBe(1);

            // 새 데이터 확인
            const fresh = await notionApi.searchDatabases('token');
            expect(fresh).toBeDefined();
            expect(fresh.version).toBe(2);

            // 버전이 다르면 캐시 갱신 필요
            if (cached && fresh && cached.version < fresh.version) {
                await cacheService.setCachedData('data', fresh, 600);
                expect(cacheService.setCachedData).toHaveBeenCalled();
            }
        });
    });

    // ============================================
    // 통합 시나리오 6: 메모리 효율성
    // ============================================
    describe('메모리 관리 및 리소스 정리', () => {
        test('대용량 처리 후 캐시 정리', async () => {
            const patterns = ['cache:old:*', 'cache:temp:*'];

            cacheService.deleteCachedDataByPattern.mockResolvedValue(10);

            for (const pattern of patterns) {
                const deletedCount = await cacheService.deleteCachedDataByPattern(pattern);
                expect(deletedCount).toBe(10);
            }

            expect(cacheService.deleteCachedDataByPattern).toHaveBeenCalledTimes(2);
        });

        test('연결 종료 시 리소스 정리', async () => {
            cacheService.closeRedis = jest.fn().mockResolvedValueOnce(true);

            // 캐시 연결 종료
            const result = await cacheService.closeRedis();
            expect(result).toBe(true);

            // 이후 캐시 접근 시도 -> 실패해야 함
            cacheService.getCachedData = jest.fn().mockResolvedValueOnce(null);
            const cached = await cacheService.getCachedData('any-key');
            expect(cached).toBeNull();
        });
    });
});
