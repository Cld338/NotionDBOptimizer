/**
 * notionApi.test.js
 * TDD 테스트: Notion API 유틸리티
 */

const axios = require('axios');
jest.mock('axios');

const {
    getNotionHeaders,
    searchDatabases,
    getDatabaseStructure,
    queryDatabase,
    getPageBlocks,
    NOTION_API_URL
} = require('../utils/notionApi');

describe('getNotionHeaders', () => {
    test('액세스 토큰으로 인증 헤더 생성', () => {
        const token = 'my-secret-token';
        const headers = getNotionHeaders(token);

        expect(headers.Authorization).toBe(`Bearer ${token}`);
        expect(headers['Notion-Version']).toBe('2022-06-28');
        expect(headers['Content-Type']).toBe('application/json');
    });

    test('헤더에 필수 필드 포함', () => {
        const headers = getNotionHeaders('token-123');

        expect(headers).toHaveProperty('Authorization');
        expect(headers).toHaveProperty('Notion-Version');
        expect(headers).toHaveProperty('Content-Type');
    });

    test('다양한 토큰 형식 처리', () => {
        const complexToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.token';
        const headers = getNotionHeaders(complexToken);

        expect(headers.Authorization).toBe(`Bearer ${complexToken}`);
    });

    test('빈 토큰 처리', () => {
        const headers = getNotionHeaders('');

        expect(headers.Authorization).toBe('Bearer ');
    });
});

describe('searchDatabases', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('모든 데이터베이스 검색 성공', async () => {
        const mockResponse = {
            data: {
                results: [
                    { id: 'db-1', title: 'Database 1' },
                    { id: 'db-2', title: 'Database 2' }
                ]
            }
        };

        axios.post.mockResolvedValueOnce(mockResponse);

        const token = 'test-token';
        const result = await searchDatabases(token);

        expect(result).toEqual([
            { id: 'db-1', title: 'Database 1' },
            { id: 'db-2', title: 'Database 2' }
        ]);
    });

    test('올바른 API 엔드포인트에 요청', async () => {
        axios.post.mockResolvedValueOnce({ data: { results: [] } });

        const token = 'test-token';
        await searchDatabases(token);

        expect(axios.post).toHaveBeenCalledWith(
            `${NOTION_API_URL}/search`,
            expect.any(Object),
            expect.any(Object)
        );
    });

    test('요청 본문에 필터 포함', async () => {
        axios.post.mockResolvedValueOnce({ data: { results: [] } });

        await searchDatabases('token');

        const callArgs = axios.post.mock.calls[0];
        expect(callArgs[1]).toEqual({
            filter: {
                value: 'database',
                property: 'object'
            }
        });
    });

    test('요청에 올바른 헤더 포함', async () => {
        axios.post.mockResolvedValueOnce({ data: { results: [] } });

        const token = 'my-token';
        await searchDatabases(token);

        const callArgs = axios.post.mock.calls[0];
        const headers = callArgs[2].headers;

        expect(headers.Authorization).toBe(`Bearer ${token}`);
        expect(headers['Notion-Version']).toBe('2022-06-28');
    });

    test('빈 결과 처리', async () => {
        axios.post.mockResolvedValueOnce({ data: { results: [] } });

        const result = await searchDatabases('token');

        expect(result).toEqual([]);
    });

    test('API 에러 전파', async () => {
        const mockError = new Error('API Error');
        axios.post.mockRejectedValueOnce(mockError);

        await expect(searchDatabases('token')).rejects.toThrow('API Error');
    });
});

describe('getDatabaseStructure', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('데이터베이스 구조 조회 성공', async () => {
        const mockDbStructure = {
            id: 'db-123',
            title: 'My Database',
            properties: {
                'Name': { type: 'title' },
                'Email': { type: 'email' }
            }
        };

        axios.get.mockResolvedValueOnce({ data: mockDbStructure });

        const result = await getDatabaseStructure('db-123', 'token');

        expect(result).toEqual(mockDbStructure);
    });

    test('올바른 API 엔드포인트에 요청', async () => {
        axios.get.mockResolvedValueOnce({ data: {} });

        await getDatabaseStructure('db-123', 'token');

        expect(axios.get).toHaveBeenCalledWith(
            `${NOTION_API_URL}/databases/db-123`,
            expect.any(Object)
        );
    });

    test('요청에 올바른 헤더 포함', async () => {
        axios.get.mockResolvedValueOnce({ data: {} });

        const token = 'secure-token';
        await getDatabaseStructure('db-123', token);

        const callArgs = axios.get.mock.calls[0];
        const headers = callArgs[1].headers;

        expect(headers.Authorization).toBe(`Bearer ${secure-token}`);
    });

    test('다양한 데이터베이스 ID 지원', async () => {
        axios.get.mockResolvedValueOnce({ data: {} });

        const dbIds = ['db-uuid-001', 'database-123', 'a1b2c3d4'];

        for (const dbId of dbIds) {
            await getDatabaseStructure(dbId, 'token');
        }

        dbIds.forEach((dbId, index) => {
            expect(axios.get).toHaveBeenNthCalledWith(
                index + 1,
                `${NOTION_API_URL}/databases/${dbId}`,
                expect.any(Object)
            );
        });
    });

    test('API 에러 전파', async () => {
        const mockError = new Error('Database not found');
        axios.get.mockRejectedValueOnce(mockError);

        await expect(getDatabaseStructure('invalid-db', 'token'))
            .rejects.toThrow('Database not found');
    });
});

describe('queryDatabase', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('데이터베이스 쿼리 성공', async () => {
        const mockResults = {
            results: [
                { id: 'page-1', properties: {} },
                { id: 'page-2', properties: {} }
            ],
            has_more: false,
            next_cursor: null
        };

        axios.post.mockResolvedValueOnce({ data: mockResults });

        const result = await queryDatabase('db-123', 'token');

        expect(result).toEqual(mockResults);
    });

    test('올바른 API 엔드포인트에 요청', async () => {
        axios.post.mockResolvedValueOnce({ data: { results: [] } });

        await queryDatabase('db-123', 'token');

        expect(axios.post).toHaveBeenCalledWith(
            `${NOTION_API_URL}/databases/db-123/query`,
            expect.any(Object),
            expect.any(Object)
        );
    });

    test('기본 page_size 100으로 설정', async () => {
        axios.post.mockResolvedValueOnce({ data: { results: [] } });

        await queryDatabase('db-123', 'token');

        const callArgs = axios.post.mock.calls[0];
        expect(callArgs[1].page_size).toBe(100);
    });

    test('page_size 100 제한', async () => {
        axios.post.mockResolvedValueOnce({ data: { results: [] } });

        await queryDatabase('db-123', 'token', 200);

        const callArgs = axios.post.mock.calls[0];
        expect(callArgs[1].page_size).toBe(100); // 최대값으로 제한
    });

    test('커스텀 page_size 지원', async () => {
        axios.post.mockResolvedValueOnce({ data: { results: [] } });

        await queryDatabase('db-123', 'token', 50);

        const callArgs = axios.post.mock.calls[0];
        expect(callArgs[1].page_size).toBe(50);
    });

    test('startCursor 없이 첫 페이지 쿼리', async () => {
        axios.post.mockResolvedValueOnce({ data: { results: [] } });

        await queryDatabase('db-123', 'token', 100, null);

        const callArgs = axios.post.mock.calls[0];
        expect(callArgs[1].start_cursor).toBeUndefined();
    });

    test('startCursor가 있을 때 pagination 지원', async () => {
        axios.post.mockResolvedValueOnce({ data: { results: [] } });

        const cursor = 'cursor-token-123';
        await queryDatabase('db-123', 'token', 50, cursor);

        const callArgs = axios.post.mock.calls[0];
        expect(callArgs[1].start_cursor).toBe(cursor);
    });

    test('요청에 올바른 헤더 포함', async () => {
        axios.post.mockResolvedValueOnce({ data: { results: [] } });

        const token = 'query-token';
        await queryDatabase('db-123', token);

        const callArgs = axios.post.mock.calls[0];
        const headers = callArgs[2].headers;

        expect(headers.Authorization).toBe(`Bearer ${query-token}`);
    });

    test('pagination 응답 처리', async () => {
        const mockResponse = {
            results: [{ id: 'page-1' }],
            has_more: true,
            next_cursor: 'next-cursor-456'
        };

        axios.post.mockResolvedValueOnce({ data: mockResponse });

        const result = await queryDatabase('db-123', 'token');

        expect(result.has_more).toBe(true);
        expect(result.next_cursor).toBe('next-cursor-456');
    });

    test('API 에러 전파', async () => {
        const mockError = new Error('Query failed');
        axios.post.mockRejectedValueOnce(mockError);

        await expect(queryDatabase('db-123', 'token'))
            .rejects.toThrow('Query failed');
    });
});

describe('getPageBlocks', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('페이지 블록 조회 성공', async () => {
        const mockBlocks = [
            { id: 'block-1', type: 'heading_1', heading_1: { rich_text: [] } },
            { id: 'block-2', type: 'paragraph', paragraph: { rich_text: [] } }
        ];

        axios.get.mockResolvedValueOnce({ data: { results: mockBlocks } });

        const result = await getPageBlocks('page-123', 'token');

        expect(result).toEqual(mockBlocks);
    });

    test('올바른 API 엔드포인트에 요청', async () => {
        axios.get.mockResolvedValueOnce({ data: { results: [] } });

        await getPageBlocks('page-123', 'token');

        expect(axios.get).toHaveBeenCalledWith(
            `${NOTION_API_URL}/blocks/page-123/children`,
            expect.any(Object)
        );
    });

    test('요청에 올바른 헤더 포함', async () => {
        axios.get.mockResolvedValueOnce({ data: { results: [] } });

        const token = 'block-token';
        await getPageBlocks('page-123', token);

        const callArgs = axios.get.mock.calls[0];
        const headers = callArgs[1].headers;

        expect(headers.Authorization).toBe(`Bearer ${block-token}`);
    });

    test('빈 블록 목록 처리', async () => {
        axios.get.mockResolvedValueOnce({ data: { results: [] } });

        const result = await getPageBlocks('page-123', 'token');

        expect(result).toEqual([]);
    });

    test('다양한 블록 타입 포함', async () => {
        const mockBlocks = [
            { id: 'b1', type: 'paragraph' },
            { id: 'b2', type: 'heading_1' },
            { id: 'b3', type: 'image' },
            { id: 'b4', type: 'table' },
            { id: 'b5', type: 'code' }
        ];

        axios.get.mockResolvedValueOnce({ data: { results: mockBlocks } });

        const result = await getPageBlocks('page-123', 'token');

        expect(result.length).toBe(5);
        expect(result).toEqual(mockBlocks);
    });

    test('다양한 페이지 ID 지원', async () => {
        axios.get.mockResolvedValueOnce({ data: { results: [] } });

        const pageIds = ['page-uuid-001', 'p-123', 'a1b2c3d4e5f6'];

        for (const pageId of pageIds) {
            axios.get.mockResolvedValueOnce({ data: { results: [] } });
            await getPageBlocks(pageId, 'token');
        }

        pageIds.forEach((pageId, index) => {
            expect(axios.get).toHaveBeenNthCalledWith(
                index + 1,
                `${NOTION_API_URL}/blocks/${pageId}/children`,
                expect.any(Object)
            );
        });
    });

    test('API 에러 전파', async () => {
        const mockError = new Error('Page not found');
        axios.get.mockRejectedValueOnce(mockError);

        await expect(getPageBlocks('invalid-page', 'token'))
            .rejects.toThrow('Page not found');
    });

    test('복잡한 중첩 블록 구조 처리', async () => {
        const mockBlocks = [
            {
                id: 'parent',
                type: 'heading_2',
                has_children: true
            },
            {
                id: 'child-1',
                type: 'paragraph',
                parent: { type: 'block_id', block_id: 'parent' }
            }
        ];

        axios.get.mockResolvedValueOnce({ data: { results: mockBlocks } });

        const result = await getPageBlocks('page-123', 'token');

        expect(result.some(b => b.has_children === true)).toBe(true);
    });
});

describe('NOTION_API_URL', () => {
    test('올바른 API URL 상수', () => {
        expect(NOTION_API_URL).toBe('https://api.notion.com/v1');
    });

    test('모든 함수에서 일관된 URL 사용', async () => {
        axios.get.mockResolvedValue({ data: {} });
        axios.post.mockResolvedValue({ data: { results: [] } });

        await searchDatabases('token');
        await getDatabaseStructure('db-123', 'token');
        await queryDatabase('db-123', 'token');
        await getPageBlocks('page-123', 'token');

        // 모든 호출이 NOTION_API_URL을 사용하는지 확인
        const allCalls = [...axios.post.mock.calls, ...axios.get.mock.calls];
        allCalls.forEach(call => {
            expect(call[0]).toMatch(/^https:\/\/api\.notion\.com\/v1/);
        });
    });
});
