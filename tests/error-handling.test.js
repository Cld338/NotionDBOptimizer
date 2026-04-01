/**
 * error-handling.test.js
 * 에러 처리 및 복구 테스트: 다양한 에러 상황에서의 동작
 */

jest.mock('../utils/notionApi');
jest.mock('../services/cacheService');

const notionApi = require('../utils/notionApi');
const cacheService = require('../services/cacheService');

describe('Error Handling Tests - 에러 처리 및 복구', () => {

    beforeEach(() => {
        jest.useFakeTimers();
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
    });

    // ============================================
    // 인증 에러 처리
    // ============================================
    describe('인증 관련 에러', () => {
        test('401 Unauthorized - 잘못된 토큰', async () => {
            const error = {
                status: 401,
                message: 'Unauthorized'
            };

            notionApi.searchDatabases.mockRejectedValue(error);

            await expect(notionApi.searchDatabases('invalid-token'))
                .rejects.toEqual(error);

            expect(notionApi.searchDatabases).toHaveBeenCalledWith('invalid-token');
        });

        test('403 Forbidden - 권한 없음', async () => {
            const error = {
                status: 403,
                message: 'Access denied'
            };

            notionApi.getDatabaseStructure.mockRejectedValue(error);

            await expect(notionApi.getDatabaseStructure('restricted-db', 'token'))
                .rejects.toEqual(error);
        });

        test('토큰 만료 시 새로운 토큰으로 재시도', async () => {
            const expiredError = {
                status: 401,
                message: 'Token expired'
            };

            notionApi.searchDatabases
                .mockRejectedValueOnce(expiredError)
                .mockResolvedValueOnce([{ id: 'db-1', title: 'Database 1' }]);

            let result;
            try {
                result = await notionApi.searchDatabases('expired-token');
            } catch (error) {
                if (error.status === 401) {
                    // 새로운 토큰으로 재시도
                    result = await notionApi.searchDatabases('new-token');
                }
            }

            expect(result).toEqual([{ id: 'db-1', title: 'Database 1' }]);
            expect(notionApi.searchDatabases).toHaveBeenCalledTimes(2);
        });
    });

    // ============================================
    // 네트워크 에러 처리
    // ============================================
    describe('네트워크 관련 에러', () => {
        test('ECONNREFUSED - 연결 거부', async () => {
            const error = {
                code: 'ECONNREFUSED',
                message: 'Connection refused'
            };

            notionApi.queryDatabase.mockRejectedValue(error);

            await expect(notionApi.queryDatabase('db-1', 'token'))
                .rejects.toEqual(error);
        });

        test('ENOTFOUND - DNS 조회 실패', async () => {
            const error = {
                code: 'ENOTFOUND',
                message: 'getaddrinfo ENOTFOUND api.notion.com'
            };

            notionApi.searchDatabases.mockRejectedValue(error);

            await expect(notionApi.searchDatabases('token'))
                .rejects.toEqual(error);
        });

        test('ETIMEDOUT - 연결 타임아웃', async () => {
            const error = {
                code: 'ETIMEDOUT',
                message: 'Connection timeout'
            };

            notionApi.getDatabaseStructure.mockRejectedValue(error);

            await expect(notionApi.getDatabaseStructure('db-1', 'token'))
                .rejects.toEqual(error);
        });

        test('EHOSTUNREACH - 호스트도달 불가', async () => {
            const error = {
                code: 'EHOSTUNREACH',
                message: 'No route to host'
            };

            notionApi.queryDatabase.mockRejectedValue(error);

            await expect(notionApi.queryDatabase('db-1', 'token'))
                .rejects.toEqual(error);
        });

        test('네트워크 에러 발생 시 폴백 전략', async () => {
            const networkError = new Error('Network error');
            const fallbackData = [{ id: 'cached-db', title: 'Cached' }];

            notionApi.searchDatabases.mockRejectedValue(networkError);
            cacheService.getCachedData.mockResolvedValue(fallbackData);

            let result;
            try {
                result = await notionApi.searchDatabases('token');
            } catch (error) {
                // 네트워크 에러 시 캐시에서 폴백
                result = await cacheService.getCachedData('cached-databases');
            }

            expect(result).toEqual(fallbackData);
        });
    });

    // ============================================
    // API 응답 에러
    // ============================================
    describe('API 응답 관련 에러', () => {
        test('500 Internal Server Error', async () => {
            const error = {
                status: 500,
                message: 'Internal Server Error'
            };

            notionApi.queryDatabase.mockRejectedValue(error);

            await expect(notionApi.queryDatabase('db-1', 'token'))
                .rejects.toEqual(error);
        });

        test('429 Too Many Requests - 속도 제한', async () => {
            const error = {
                status: 429,
                message: 'Too Many Requests',
                retryAfter: 60
            };

            notionApi.searchDatabases.mockRejectedValue(error);

            await expect(notionApi.searchDatabases('token'))
                .rejects.toEqual(error);
        });

        test('429 에러 시 대기 후 재시도', async () => {
            const rateLimitError = {
                status: 429,
                retryAfter: 1 // 1초 대기
            };

            notionApi.searchDatabases
                .mockRejectedValueOnce(rateLimitError)
                .mockResolvedValueOnce([{ id: 'db-1' }]);

            let result;
            try {
                result = await notionApi.searchDatabases('token');
            } catch (error) {
                if (error.status === 429) {
                    // 재시도 대기 - Jest fake timers 사용
                    const promise = new Promise(resolve => 
                        setTimeout(resolve, error.retryAfter * 1000)
                    );
                    jest.advanceTimersByTime(error.retryAfter * 1000);
                    await promise;
                    result = await notionApi.searchDatabases('token');
                }
            }

            expect(result).toEqual([{ id: 'db-1' }]);
        });

        test('502 Bad Gateway', async () => {
            const error = {
                status: 502,
                message: 'Bad Gateway'
            };

            notionApi.queryDatabase.mockRejectedValue(error);

            await expect(notionApi.queryDatabase('db-1', 'token'))
                .rejects.toEqual(error);
        });

        test('503 Service Unavailable', async () => {
            const error = {
                status: 503,
                message: 'Service Unavailable'
            };

            notionApi.getDatabaseStructure.mockRejectedValue(error);

            await expect(notionApi.getDatabaseStructure('db-1', 'token'))
                .rejects.toEqual(error);
        });
    });

    // ============================================
    // 404 및 리소스 에러
    // ============================================
    describe('리소스 관련 에러', () => {
        test('404 Not Found - 데이터베이스 찾을 수 없음', async () => {
            const error = {
                status: 404,
                message: 'Database not found'
            };

            notionApi.getDatabaseStructure.mockRejectedValue(error);

            await expect(notionApi.getDatabaseStructure('non-existent-db', 'token'))
                .rejects.toEqual(error);
        });

        test('404 에러 시 다른 데이터베이스로 폴백', async () => {
            const notFoundError = {
                status: 404,
                message: 'Not found'
            };

            notionApi.getDatabaseStructure
                .mockRejectedValueOnce(notFoundError)
                .mockResolvedValueOnce({ id: 'db-2', properties: {} });

            let result;
            try {
                result = await notionApi.getDatabaseStructure('db-1', 'token');
            } catch (error) {
                if (error.status === 404) {
                    // 다른 DB 시도
                    result = await notionApi.getDatabaseStructure('db-2', 'token');
                }
            }

            expect(result).toEqual({ id: 'db-2', properties: {} });
        });

        test('410 Gone - 더 이상 사용 불가능한 리소스', async () => {
            const error = {
                status: 410,
                message: 'Resource gone'
            };

            notionApi.queryDatabase.mockRejectedValue(error);

            await expect(notionApi.queryDatabase('deleted-db', 'token'))
                .rejects.toEqual(error);
        });
    });

    // ============================================
    // 캐시 에러 처리
    // ============================================
    describe('캐시 서비스 에러', () => {
        test('Redis 연결 실패 - 캐시 없이 진행', async () => {
            const redisError = new Error('Redis connection failed');

            cacheService.getCachedData.mockRejectedValue(redisError);
            notionApi.searchDatabases.mockResolvedValue([{ id: 'db-1' }]);

            let result;
            try {
                result = await cacheService.getCachedData('databases');
            } catch (error) {
                // 캐시 실패 시 API에서 직접 조회
                result = await notionApi.searchDatabases('token');
            }

            expect(result).toEqual([{ id: 'db-1' }]);
        });

        test('캐시 저장 실패 - 에러 로深하고 계속 진행', async () => {
            const cacheWriteError = new Error('Cache write failed');

            cacheService.setCachedData.mockRejectedValue(cacheWriteError);

            try {
                await cacheService.setCachedData('key', { data: 'value' });
            } catch (error) {
                // 캐시 쓰기 실패는 무시하고 계속 진행
                expect(error).toEqual(cacheWriteError);
            }
        });

        test('Redis 타임아웃', async () => {
            const timeoutError = new Error('Redis timeout');

            cacheService.getCachedData.mockRejectedValue(timeoutError);

            await expect(cacheService.getCachedData('key'))
                .rejects.toEqual(timeoutError);
        });

        test('캐시 데이터 손상 - JSON 파싱 실패', () => {
            const corruptedData = '{invalid json}';

            expect(() => {
                JSON.parse(corruptedData);
            }).toThrow();

            // 손상된 데이터는 무시하고 null 반환하도록 처리
            const result = (() => {
                try {
                    return JSON.parse(corruptedData);
                } catch {
                    return null;
                }
            })();

            expect(result).toBeNull();
        });
    });

    // ============================================
    // 데이터 처리 에러
    // ============================================
    describe('데이터 처리 관련 에러', () => {
        test('유효하지 않은 JSON 응답 처리', () => {
            const invalidJson = '{unclosed';

            expect(() => {
                JSON.parse(invalidJson);
            }).toThrow();
        });

        test('예상하지 못한 응답 구조', () => {
            const unexpectedResponse = 'string response instead of object';

            const isValid = (response) => {
                return typeof response === 'object' && response !== null;
            };

            expect(isValid(unexpectedResponse)).toBe(false);
        });

        test('null 응답 처리', () => {
            const nullResponse = null;

            const handleResponse = (response) => {
                if (response === null) {
                    return { error: 'Null response' };
                }
                return response;
            };

            expect(handleResponse(nullResponse)).toEqual({ error: 'Null response' });
        });

        test('undefined 필드 처리', () => {
            const response = {
                id: 'db-1',
                title: undefined,
                properties: undefined
            };

            const safeAccess = (obj, path, defaultValue = null) => {
                return obj[path] ?? defaultValue;
            };

            expect(safeAccess(response, 'title')).toBeNull();
            expect(safeAccess(response, 'properties', {})).toEqual({});
        });
    });

    // ============================================
    // 재시도 메커니즘
    // ============================================
    describe('재시도 메커니즘', () => {
        test('선형 재시도: 3번 시도', async () => {
            let attempts = 0;

            notionApi.queryDatabase.mockImplementation(() => {
                attempts++;
                if (attempts < 3) {
                    return Promise.reject(new Error('Temporary failure'));
                }
                return Promise.resolve({ results: [] });
            });

            const executeWithRetry = async (fn, maxRetries = 3) => {
                for (let i = 1; i <= maxRetries; i++) {
                    try {
                        return await fn();
                    } catch (error) {
                        if (i === maxRetries) throw error;
                    }
                }
            };

            const result = await executeWithRetry(
                () => notionApi.queryDatabase('db-1', 'token')
            );

            expect(result.results).toEqual([]);
            expect(attempts).toBe(3);
        });

        test('지수 백오프 재시도', async () => {
            let attempts = 0;
            const delays = [];

            notionApi.queryDatabase.mockImplementation(() => {
                attempts++;
                if (attempts < 3) {
                    return Promise.reject(new Error('Temporary failure'));
                }
                return Promise.resolve({ results: [] });
            });

            const executeWithBackoff = async (fn, maxRetries = 3) => {
                for (let i = 1; i <= maxRetries; i++) {
                    try {
                        return await fn();
                    } catch (error) {
                        if (i === maxRetries) throw error;
                        // i=1: 2^2 * 100 = 400, i=2: 2^3 * 100 = 800
                        const delay = Math.pow(2, i + 1) * 100;
                        delays.push(delay);
                        const promise = new Promise(resolve => setTimeout(resolve, delay));
                        jest.advanceTimersByTime(delay);
                        await promise;
                    }
                }
            };

            const result = await executeWithBackoff(
                () => notionApi.queryDatabase('db-1', 'token')
            );

            expect(result.results).toEqual([]);
            expect(delays.length).toBe(2);
            expect(delays[0]).toBe(400); // 2^2 * 100
            expect(delays[1]).toBe(800); // 2^3 * 100
        });

        test('조건부 재시도: 특정 에러만 재시도', async () => {
            let attempts = 0;

            notionApi.queryDatabase.mockImplementation(() => {
                attempts++;
                if (attempts === 1) {
                    return Promise.reject({ status: 503, message: 'Service Unavailable' });
                }
                if (attempts === 2) {
                    return Promise.reject({ status: 500, message: 'Server Error' });
                }
                return Promise.resolve({ results: [] });
            });

            const isRetryableError = (error) => {
                return [429, 500, 502, 503].includes(error.status);
            };

            const executeWithConditionalRetry = async (fn, maxRetries = 3) => {
                for (let i = 1; i <= maxRetries; i++) {
                    try {
                        return await fn();
                    } catch (error) {
                        if (!isRetryableError(error) || i === maxRetries) throw error;
                    }
                }
            };

            const result = await executeWithConditionalRetry(
                () => notionApi.queryDatabase('db-1', 'token')
            );

            expect(result.results).toEqual([]);
            expect(attempts).toBe(3);
        });
    });

    // ============================================
    // 타임아웃 처리
    // ============================================
    describe('타임아웃 처리', () => {
        test('요청 타임아웃 설정', async () => {
            const timeoutError = new Error('Request timeout');

            notionApi.queryDatabase.mockRejectedValue(timeoutError);

            const executeWithTimeout = async (fn, timeoutMs = 5000) => {
                return Promise.race([
                    fn(),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Timeout')), timeoutMs)
                    )
                ]);
            };

            const promise = executeWithTimeout(
                () => notionApi.queryDatabase('db-1', 'token'),
                100 // 100ms 타임아웃
            );
            jest.advanceTimersByTime(100);
            await expect(promise).rejects.toThrow();
        });

        test('타임아웃 후 폴백', async () => {
            const fallbackData = [{ id: 'cached-db' }];

            notionApi.searchDatabases.mockImplementation(
                () => new Promise(resolve => {
                    const timeoutId = setTimeout(() => resolve([{ id: 'api-db' }]), 2000);
                    // Store timeout ID for potential cleanup if needed
                })
            );
            cacheService.getCachedData.mockResolvedValue(fallbackData);

            const executeWithTimeoutFallback = async (fn, fallback, timeoutMs = 500) => {
                try {
                    return await Promise.race([
                        fn(),
                        new Promise((_, reject) =>
                            setTimeout(() => reject(new Error('Timeout')), timeoutMs)
                        )
                    ]);
                } catch (error) {
                    return fallback;
                }
            };

            const promise = executeWithTimeoutFallback(
                () => notionApi.searchDatabases('token'),
                fallbackData,
                100
            );
            jest.advanceTimersByTime(100);
            const result = await promise;

            expect(result).toEqual(fallbackData);
        });
    });

    // ============================================
    // 부분 실패 처리
    // ============================================
    describe('부분 실패 처리', () => {
        test('배치 작업 중 일부 실패 처리', async () => {
            const dbIds = ['db-1', 'db-2', 'db-3', 'db-4', 'db-5'];

            notionApi.getDatabaseStructure
                .mockResolvedValueOnce({ id: 'db-1' })
                .mockRejectedValueOnce(new Error('Access denied'))
                .mockResolvedValueOnce({ id: 'db-3' })
                .mockRejectedValueOnce(new Error('Not found'))
                .mockResolvedValueOnce({ id: 'db-5' });

            const results = [];
            for (const dbId of dbIds) {
                try {
                    const result = await notionApi.getDatabaseStructure(dbId, 'token');
                    results.push({ status: 'success', data: result });
                } catch (error) {
                    results.push({ status: 'failed', error: error.message });
                }
            }

            expect(results.filter(r => r.status === 'success')).toHaveLength(3);
            expect(results.filter(r => r.status === 'failed')).toHaveLength(2);
        });

        test('Promise.allSettled를 이용한 모든 결과 수집', async () => {
            const dbIds = ['db-1', 'db-2', 'db-3'];

            notionApi.queryDatabase
                .mockResolvedValueOnce({ results: [1, 2, 3] })
                .mockRejectedValueOnce(new Error('Error'))
                .mockResolvedValueOnce({ results: [4, 5, 6] });

            const promises = dbIds.map(dbId =>
                notionApi.queryDatabase(dbId, 'token')
            );

            const results = await Promise.allSettled(promises);

            expect(results).toHaveLength(3);
            expect(results[0].status).toBe('fulfilled');
            expect(results[1].status).toBe('rejected');
            expect(results[2].status).toBe('fulfilled');
        });
    });
});
