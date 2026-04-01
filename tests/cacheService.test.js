/**
 * cacheService 테스트
 * 책임: Redis 캐시 서비스의 CRUD 동작 및 연결 상태 관리 검증
 */

jest.mock('redis');

describe('cacheService', () => {
    let mockRedisClient;
    let redis;
    let cacheService;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.resetModules();
        
        // 각 테스트마다 redis mock 재설정
        redis = require('redis');
        
        // 모의 Redis 클라이언트 설정
        mockRedisClient = {
            connect: jest.fn().mockResolvedValue(true),
            get: jest.fn(),
            setEx: jest.fn().mockResolvedValue(true),
            del: jest.fn(),
            keys: jest.fn(),
            quit: jest.fn().mockResolvedValue(true),
            on: jest.fn()
        };
        
        redis.createClient.mockReturnValue(mockRedisClient);
        cacheService = require('../services/cacheService');
    });

    // ============================================
    // initializeRedis 테스트
    // ============================================
    describe('initializeRedis', () => {
        test('정상 초기화시 Redis 클라이언트 생성', async () => {
            mockRedisClient.connect.mockResolvedValue(true);
            
            await cacheService.initializeRedis();
            
            expect(redis.createClient).toHaveBeenCalled();
            expect(mockRedisClient.connect).toHaveBeenCalled();
        });

        test('Redis URL은 환경변수에서 읽음', async () => {
            process.env.REDIS_URL = 'redis://custom:6380';
            
            await cacheService.initializeRedis();
            
            expect(redis.createClient).toHaveBeenCalledWith(
                expect.objectContaining({
                    url: 'redis://custom:6380'
                })
            );
        });

        test('기본 Redis URL 사용', async () => {
            delete process.env.REDIS_URL;
            
            await cacheService.initializeRedis();
            
            expect(redis.createClient).toHaveBeenCalledWith(
                expect.objectContaining({
                    url: 'redis://localhost:6379'
                })
            );
        });

        test('Redis 연결 실패 시 graceful 처리', async () => {
            const connectError = new Error('Connection failed');
            mockRedisClient.connect.mockRejectedValue(connectError);
            
            await cacheService.initializeRedis();
            
            expect(cacheService.getCacheStatus().enabled).toBe(false);
        });

        test('연결 시도 횟수 추적', async () => {
            // 첫 번째 호출
            await cacheService.initializeRedis();
            
            // 두 번째 호출 시도 (내부적으로 connectionAttempted 체크)
            jest.resetModules();
            redis = require('redis');
            redis.createClient.mockReturnValue(mockRedisClient);
            cacheService = require('../services/cacheService');
            
            await cacheService.initializeRedis();
            
            // 모듈이 재로드되어 다시 시도 가능
            expect(redis.createClient).toHaveBeenCalled();
        });
    });

    // ============================================
    // getCachedData 테스트
    // ============================================
    describe('getCachedData', () => {
        test('연결되지 않은 상태에서는 null 반환', async () => {
            const result = await cacheService.getCachedData('test-key');
            expect(result).toBeNull();
        });

        test('캐시 hit 시 데이터 반환', async () => {
            const testData = { id: 1, name: 'test' };
            mockRedisClient.get.mockResolvedValue(JSON.stringify(testData));

            await cacheService.initializeRedis();
            const result = await cacheService.getCachedData('test-key');

            expect(result).toEqual(testData);
            expect(mockRedisClient.get).toHaveBeenCalledWith('test-key');
        });

        test('캐시 miss 시 null 반환', async () => {
            mockRedisClient.get.mockResolvedValue(null);

            await cacheService.initializeRedis();
            const result = await cacheService.getCachedData('non-existent-key');

            expect(result).toBeNull();
        });

        test('Redis 에러 시 null 반환', async () => {
            mockRedisClient.get.mockRejectedValue(new Error('Redis error'));

            await cacheService.initializeRedis();
            const result = await cacheService.getCachedData('test-key');

            expect(result).toBeNull();
        });

        test('객체 데이터 역직렬화', async () => {
            const testData = { user: 'john', age: 30, email: 'john@example.com' };
            mockRedisClient.get.mockResolvedValue(JSON.stringify(testData));

            await cacheService.initializeRedis();
            const result = await cacheService.getCachedData('user:123');

            expect(typeof result).toBe('object');
            expect(result.user).toBe('john');
            expect(result.age).toBe(30);
        });

        test('배열 데이터 역직렬화', async () => {
            const testData = [1, 2, 3, 4, 5];
            mockRedisClient.get.mockResolvedValue(JSON.stringify(testData));

            await cacheService.initializeRedis();
            const result = await cacheService.getCachedData('array:key');

            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBe(5);
        });

        test('중첩된 객체 역직렬화', async () => {
            const testData = { nested: { data: { deep: true } }, arr: [1, 2, 3] };
            mockRedisClient.get.mockResolvedValue(JSON.stringify(testData));

            await cacheService.initializeRedis();
            const result = await cacheService.getCachedData('nested:key');

            expect(result.nested.data.deep).toBe(true);
            expect(result.arr[0]).toBe(1);
        });
    });

    // ============================================
    // setCachedData 테스트
    // ============================================
    describe('setCachedData', () => {
        test('연결되지 않은 상태에서는 무시됨', async () => {
            await cacheService.setCachedData('key', { data: 'value' });
            expect(mockRedisClient.setEx).not.toHaveBeenCalled();
        });

        test('정상 저장 시 setEx 호출', async () => {
            await cacheService.initializeRedis();
            await cacheService.setCachedData('test-key', { data: 'value' }, 600);

            expect(mockRedisClient.setEx).toHaveBeenCalledWith(
                'test-key',
                600,
                JSON.stringify({ data: 'value' })
            );
        });

        test('기본 TTL은 600초', async () => {
            await cacheService.initializeRedis();
            await cacheService.setCachedData('test-key', { data: 'value' });

            expect(mockRedisClient.setEx).toHaveBeenCalledWith(
                'test-key',
                600,
                expect.any(String)
            );
        });

        test('커스텀 TTL 설정 가능', async () => {
            await cacheService.initializeRedis();
            await cacheService.setCachedData('test-key', { data: 'value' }, 3600);

            expect(mockRedisClient.setEx).toHaveBeenCalledWith(
                'test-key',
                3600,
                expect.any(String)
            );
        });

        test('복잡한 데이터 직렬화', async () => {
            const complexData = {
                user: { name: 'john', email: 'john@example.com' },
                tags: ['tag1', 'tag2', 'tag3'],
                score: 95.5
            };

            await cacheService.initializeRedis();
            await cacheService.setCachedData('complex:key', complexData, 1200);

            expect(mockRedisClient.setEx).toHaveBeenCalledWith(
                'complex:key',
                1200,
                JSON.stringify(complexData)
            );
        });

        test('Redis 에러 처리', async () => {
            mockRedisClient.setEx.mockRejectedValue(new Error('Redis error'));
            
            await cacheService.initializeRedis();
            await cacheService.setCachedData('test-key', { data: 'value' });

            expect(mockRedisClient.setEx).toHaveBeenCalled();
        });
    });

    // ============================================
    // deleteCachedData 테스트
    // ============================================
    describe('deleteCachedData', () => {
        test('연결되지 않은 상태에서는 무시됨', async () => {
            await cacheService.deleteCachedData('key');
            expect(mockRedisClient.del).not.toHaveBeenCalled();
        });

        test('정상 삭제 시 del 호출', async () => {
            mockRedisClient.del.mockResolvedValue(1);

            await cacheService.initializeRedis();
            await cacheService.deleteCachedData('test-key');

            expect(mockRedisClient.del).toHaveBeenCalledWith('test-key');
        });

        test('키가 없는 경우도 에러 없이 처리', async () => {
            mockRedisClient.del.mockResolvedValue(0);

            await cacheService.initializeRedis();
            await cacheService.deleteCachedData('non-existent-key');

            expect(mockRedisClient.del).toHaveBeenCalled();
        });

        test('여러 번 삭제', async () => {
            mockRedisClient.del.mockResolvedValue(1);

            await cacheService.initializeRedis();
            await cacheService.deleteCachedData('key1');
            await cacheService.deleteCachedData('key2');
            await cacheService.deleteCachedData('key3');

            expect(mockRedisClient.del).toHaveBeenCalledTimes(3);
        });
    });

    // ============================================
    // deleteCachedDataByPattern 테스트
    // ============================================
    describe('deleteCachedDataByPattern', () => {
        test('연결되지 않은 상태에서는 0 반환', async () => {
            const result = await cacheService.deleteCachedDataByPattern('pattern:*');
            expect(result).toBe(0);
        });

        test('패턴 매칭 키 삭제', async () => {
            const matchedKeys = ['pattern:1', 'pattern:2', 'pattern:3'];
            mockRedisClient.keys.mockResolvedValue(matchedKeys);
            mockRedisClient.del.mockResolvedValue(3);

            await cacheService.initializeRedis();
            const result = await cacheService.deleteCachedDataByPattern('pattern:*');

            expect(result).toBe(3);
            expect(mockRedisClient.keys).toHaveBeenCalledWith('pattern:*');
            expect(mockRedisClient.del).toHaveBeenCalledWith(matchedKeys);
        });

        test('일치하는 키 없으면 0 반환', async () => {
            mockRedisClient.keys.mockResolvedValue([]);

            await cacheService.initializeRedis();
            const result = await cacheService.deleteCachedDataByPattern('nomatch:*');

            expect(result).toBe(0);
            expect(mockRedisClient.del).not.toHaveBeenCalled();
        });

        test('다양한 패턴 처리', async () => {
            mockRedisClient.keys.mockResolvedValue(['cache:db:1', 'cache:db:2']);
            mockRedisClient.del.mockResolvedValue(2);

            await cacheService.initializeRedis();
            const result = await cacheService.deleteCachedDataByPattern('cache:db:*');

            expect(result).toBe(2);
        });
    });

    // ============================================
    // getCacheStatus 테스트
    // ============================================
    describe('getCacheStatus', () => {
        test('연결 상태 정보 반환', async () => {
            const status = cacheService.getCacheStatus();

            expect(status).toBeDefined();
            expect(status).toHaveProperty('connected');
            expect(status).toHaveProperty('enabled');
            expect(status).toHaveProperty('url');
        });

        test('환경변수로 설정된 URL 포함', async () => {
            process.env.REDIS_URL = 'redis://custom:6380';

            // 모듈 리셋하여 환경변수 다시 읽음
            jest.resetModules();
            redis = require('redis');
            redis.createClient.mockReturnValue(mockRedisClient);
            cacheService = require('../services/cacheService');

            const status = cacheService.getCacheStatus();
            expect(status.url).toBe('redis://custom:6380');
        });

        test('기본 URL 사용', async () => {
            delete process.env.REDIS_URL;

            const status = cacheService.getCacheStatus();
            expect(status.url).toBe('redis://localhost:6379');
        });

        test('미연결 상태', async () => {
            const status = cacheService.getCacheStatus();

            expect(status.connected).toBe(false);
            expect(status.enabled).toBe(false);
        });

        test('연결 후 상태 변경', async () => {
            await cacheService.initializeRedis();
            const status = cacheService.getCacheStatus();

            expect(status.enabled).toBe(true);
        });
    });

    // ============================================
    // closeRedis 테스트
    // ============================================
    describe('closeRedis', () => {
        test('연결 종료 호출', async () => {
            await cacheService.initializeRedis();
            await cacheService.closeRedis();

            expect(mockRedisClient.quit).toHaveBeenCalled();
        });

        test('종료 실패 시 에러 처리', async () => {
            mockRedisClient.quit.mockRejectedValue(new Error('Close failed'));

            await cacheService.initializeRedis();
            await cacheService.closeRedis();

            expect(mockRedisClient.quit).toHaveBeenCalled();
        });

        test('미연결 상태에서 종료 시도', async () => {
            const result = await cacheService.closeRedis();

            // 에러 없이 완료되어야 함
            expect(result).toBeUndefined();
        });

        test('종료 후 상태 변경', async () => {
            mockRedisClient.quit.mockResolvedValue(true);

            await cacheService.initializeRedis();
            await cacheService.closeRedis();

            expect(mockRedisClient.quit).toHaveBeenCalled();
        });
    });

    // ============================================
    // 통합 시나리오 테스트
    // ============================================
    describe('통합 시나리오', () => {
        test('캐시 워크플로우: 저장 -> 조회 -> 삭제', async () => {
            const testKey = 'integration-test-key';
            const testData = { user: 'john', age: 30 };

            mockRedisClient.setEx.mockResolvedValue(true);
            mockRedisClient.get.mockResolvedValue(JSON.stringify(testData));
            mockRedisClient.del.mockResolvedValue(1);

            await cacheService.initializeRedis();

            // 저장
            await cacheService.setCachedData(testKey, testData, 600);
            expect(mockRedisClient.setEx).toHaveBeenCalled();

            // 조회
            const retrieved = await cacheService.getCachedData(testKey);
            expect(retrieved).toEqual(testData);

            // 삭제
            await cacheService.deleteCachedData(testKey);
            expect(mockRedisClient.del).toHaveBeenCalled();
        });

        test('여러 패턴 삭제', async () => {
            mockRedisClient.keys
                .mockResolvedValueOnce(['cache:db:1', 'cache:db:2'])
                .mockResolvedValueOnce(['cache:record:1', 'cache:record:2']);
            mockRedisClient.del.mockResolvedValue(2);

            await cacheService.initializeRedis();

            const result1 = await cacheService.deleteCachedDataByPattern('cache:db:*');
            const result2 = await cacheService.deleteCachedDataByPattern('cache:record:*');

            expect(result1).toBe(2);
            expect(result2).toBe(2);
            expect(mockRedisClient.keys).toHaveBeenCalledTimes(2);
        });

        test('생명 주기: 초기화 -> 사용 -> 종료', async () => {
            mockRedisClient.setEx.mockResolvedValue(true);
            mockRedisClient.get.mockResolvedValue(JSON.stringify({ data: 'test' }));

            // 초기화
            await cacheService.initializeRedis();
            expect(mockRedisClient.connect).toHaveBeenCalled();

            // 사용
            await cacheService.setCachedData('key', { data: 'test' });
            const result = await cacheService.getCachedData('key');
            expect(result).toBeDefined();

            // 종료
            await cacheService.closeRedis();
            expect(mockRedisClient.quit).toHaveBeenCalled();
        });

        test('에러 발생 시에도 서비스 정상 동작', async () => {
            mockRedisClient.setEx.mockRejectedValue(new Error('Redis error'));
            mockRedisClient.get.mockResolvedValue(null);

            await cacheService.initializeRedis();

            // set 실패해도 진행
            await cacheService.setCachedData('key', { data: 'test' });

            // get 계속 사용 가능
            const result = await cacheService.getCachedData('key');
            expect(result).toBeNull();
        });
    });
});
