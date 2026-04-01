/**
 * databaseService 테스트
 * 책임: 데이터베이스 조회, 레코드 처리 및 네트워크 노드/엣지 생성 검증
 */

jest.mock('../utils/notionApi');
jest.mock('../utils/propertyFormatter');

const {
    getAllDatabases,
    getDatabaseInfo,
    getAllDatabaseRecords,
    queryDatabasePages,
    buildPropertyMaps,
    createDatabaseNode,
    createDatabaseEdge
} = require('../services/databaseService');

const notionApi = require('../utils/notionApi');
const propertyFormatter = require('../utils/propertyFormatter');

describe('databaseService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ============================================
    // getAllDatabases 테스트
    // ============================================
    describe('getAllDatabases', () => {
        test('모든 데이터베이스 조회 성공', async () => {
            const mockDbs = [
                {
                    id: 'db1',
                    title: [{ plain_text: 'Database 1' }],
                    icon: '📊',
                    created_time: '2024-01-01',
                    last_edited_time: '2024-01-02'
                },
                {
                    id: 'db2',
                    title: [{ plain_text: 'Database 2' }],
                    icon: '📈',
                    created_time: '2024-01-03',
                    last_edited_time: '2024-01-04'
                }
            ];

            notionApi.searchDatabases.mockResolvedValue(mockDbs);

            const result = await getAllDatabases('mock-token');

            expect(result).toHaveLength(2);
            expect(result[0]).toHaveProperty('id', 'db1');
            expect(result[0]).toHaveProperty('title', 'Database 1');
            expect(notionApi.searchDatabases).toHaveBeenCalledWith('mock-token');
        });

        test('title이 없는 데이터베이스는 "Untitled" 반환', async () => {
            const mockDbs = [
                {
                    id: 'db1',
                    title: [],
                    icon: null,
                    created_time: '2024-01-01',
                    last_edited_time: '2024-01-02'
                }
            ];

            notionApi.searchDatabases.mockResolvedValue(mockDbs);

            const result = await getAllDatabases('mock-token');

            expect(result[0].title).toBe('Untitled');
        });

        test('API 호출 실패 시 에러 전파', async () => {
            const error = new Error('API Error');
            notionApi.searchDatabases.mockRejectedValue(error);

            await expect(getAllDatabases('mock-token')).rejects.toThrow('API Error');
        });

        test('빈 데이터베이스 목록 반환', async () => {
            notionApi.searchDatabases.mockResolvedValue([]);

            const result = await getAllDatabases('mock-token');

            expect(result).toEqual([]);
        });

        test('icon과 타임스탬프 포함', async () => {
            const mockDbs = [
                {
                    id: 'db1',
                    title: [{ plain_text: 'Test DB' }],
                    icon: '⭐',
                    created_time: '2024-01-01T00:00:00Z',
                    last_edited_time: '2024-01-02T00:00:00Z'
                }
            ];

            notionApi.searchDatabases.mockResolvedValue(mockDbs);

            const result = await getAllDatabases('mock-token');

            expect(result[0].icon).toBe('⭐');
            expect(result[0].created_time).toBe('2024-01-01T00:00:00Z');
            expect(result[0].last_edited_time).toBe('2024-01-02T00:00:00Z');
        });
    });

    // ============================================
    // getDatabaseInfo 테스트
    // ============================================
    describe('getDatabaseInfo', () => {
        test('데이터베이스 구조 조회 성공', async () => {
            const mockDbData = {
                id: 'db1',
                properties: { name: 'Title', type: 'title' }
            };

            const formattedDb = { id: 'db1', formatted: true };

            notionApi.getDatabaseStructure.mockResolvedValue(mockDbData);
            propertyFormatter.formatDatabase.mockReturnValue(formattedDb);

            const result = await getDatabaseInfo('db1', 'mock-token');

            expect(result).toEqual(formattedDb);
            expect(notionApi.getDatabaseStructure).toHaveBeenCalledWith('db1', 'mock-token');
            expect(propertyFormatter.formatDatabase).toHaveBeenCalledWith(mockDbData);
        });

        test('API 호출 실패 시 에러 전파', async () => {
            const error = new Error('Structure Error');
            notionApi.getDatabaseStructure.mockRejectedValue(error);

            await expect(getDatabaseInfo('db1', 'mock-token')).rejects.toThrow('Structure Error');
        });

        test('format 함수 에러 처리', async () => {
            const mockDbData = { id: 'db1' };
            notionApi.getDatabaseStructure.mockResolvedValue(mockDbData);
            propertyFormatter.formatDatabase.mockImplementation(() => {
                throw new Error('Format Error');
            });

            await expect(getDatabaseInfo('db1', 'mock-token')).rejects.toThrow('Format Error');
        });
    });

    // ============================================
    // getAllDatabaseRecords 테스트
    // ============================================
    describe('getAllDatabaseRecords', () => {
        test('모든 레코드 조회 (페이지네이션)', async () => {
            const mockResponse1 = {
                results: [{ id: '1' }, { id: '2' }],
                has_more: true,
                next_cursor: 'cursor1'
            };

            const mockResponse2 = {
                results: [{ id: '3' }],
                has_more: false,
                next_cursor: null
            };

            notionApi.queryDatabase
                .mockResolvedValueOnce(mockResponse1)
                .mockResolvedValueOnce(mockResponse2);

            propertyFormatter.formatDatabaseRecord
                .mockImplementation(record => ({ ...record, formatted: true }));

            const result = await getAllDatabaseRecords('db1', 'mock-token');

            expect(result).toHaveLength(3);
            expect(notionApi.queryDatabase).toHaveBeenCalledTimes(2);
        });

        test('단일 페이지 조회', async () => {
            const mockResponse = {
                results: [{ id: '1' }, { id: '2' }],
                has_more: false,
                next_cursor: null
            };

            notionApi.queryDatabase.mockResolvedValue(mockResponse);
            propertyFormatter.formatDatabaseRecord.mockImplementation(r => r);

            const result = await getAllDatabaseRecords('db1', 'mock-token');

            expect(result).toHaveLength(2);
            expect(notionApi.queryDatabase).toHaveBeenCalledTimes(1);
        });

        test('빈 데이터베이스 조회', async () => {
            const mockResponse = {
                results: [],
                has_more: false,
                next_cursor: null
            };

            notionApi.queryDatabase.mockResolvedValue(mockResponse);

            const result = await getAllDatabaseRecords('db1', 'mock-token');

            expect(result).toEqual([]);
        });

        test('많은 페이지네이션 처리', async () => {
            // 5페이지 시뮬레이션
            const responses = Array(5).fill(null).map((_, i) => ({
                results: [{ id: `record${i}` }],
                has_more: i < 4,
                next_cursor: i < 4 ? `cursor${i}` : null
            }));

            notionApi.queryDatabase
                .mockResolvedValueOnce(responses[0])
                .mockResolvedValueOnce(responses[1])
                .mockResolvedValueOnce(responses[2])
                .mockResolvedValueOnce(responses[3])
                .mockResolvedValueOnce(responses[4]);

            propertyFormatter.formatDatabaseRecord.mockImplementation(r => r);

            const result = await getAllDatabaseRecords('db1', 'mock-token');

            expect(result).toHaveLength(5);
            expect(notionApi.queryDatabase).toHaveBeenCalledTimes(5);
        });

        test('기본 페이지 크기 100', async () => {
            const mockResponse = {
                results: [],
                has_more: false,
                next_cursor: null
            };

            notionApi.queryDatabase.mockResolvedValue(mockResponse);

            await getAllDatabaseRecords('db1', 'mock-token');

            expect(notionApi.queryDatabase).toHaveBeenCalledWith('db1', 'mock-token', 100, null);
        });
    });

    // ============================================
    // queryDatabasePages 테스트
    // ============================================
    describe('queryDatabasePages', () => {
        test('페이지 쿼리 with 페이지네이션', async () => {
            const mockResponse = {
                results: [{ id: '1' }, { id: '2' }],
                has_more: true,
                next_cursor: 'next-cursor'
            };

            notionApi.queryDatabase.mockResolvedValue(mockResponse);
            propertyFormatter.formatDatabaseRecord.mockImplementation(r => ({ ...r, formatted: true }));

            const result = await queryDatabasePages('db1', 'mock-token', 10, 'cursor1');

            expect(result.records).toHaveLength(2);
            expect(result.has_more).toBe(true);
            expect(result.next_cursor).toBe('next-cursor');
            expect(notionApi.queryDatabase).toHaveBeenCalledWith('db1', 'mock-token', 10, 'cursor1');
        });

        test('기본 페이지 크기 10', async () => {
            const mockResponse = {
                results: [],
                has_more: false,
                next_cursor: null
            };

            notionApi.queryDatabase.mockResolvedValue(mockResponse);

            await queryDatabasePages('db1', 'mock-token');

            expect(notionApi.queryDatabase).toHaveBeenCalledWith('db1', 'mock-token', 10, null);
        });

        test('커스텀 페이지 크기와 커서', async () => {
            const mockResponse = {
                results: [],
                has_more: false,
                next_cursor: null
            };

            notionApi.queryDatabase.mockResolvedValue(mockResponse);

            await queryDatabasePages('db1', 'mock-token', 50, 'custom-cursor');

            expect(notionApi.queryDatabase).toHaveBeenCalledWith('db1', 'mock-token', 50, 'custom-cursor');
        });

        test('마지막 페이지 처리', async () => {
            const mockResponse = {
                results: [{ id: '1' }],
                has_more: false,
                next_cursor: null
            };

            notionApi.queryDatabase.mockResolvedValue(mockResponse);
            propertyFormatter.formatDatabaseRecord.mockImplementation(r => r);

            const result = await queryDatabasePages('db1', 'mock-token');

            expect(result.has_more).toBe(false);
            expect(result.next_cursor).toBeNull();
        });
    });

    // ============================================
    // buildPropertyMaps 테스트
    // ============================================
    describe('buildPropertyMaps', () => {
        test('속성 맵 생성', () => {
            const dbPropertiesMap = new Map([
                ['db1', {
                    databaseTitle: 'DB1',
                    properties: [
                        { id: 'id1', name: 'Name', type: 'title' },
                        { id: 'id2', name: 'Status', type: 'select' }
                    ]
                }]
            ]);

            const result = buildPropertyMaps(dbPropertiesMap);

            expect(result).toHaveProperty('propertyIdMapByDb');
            expect(result).toHaveProperty('propertyNameMapByDb');
            expect(result).toHaveProperty('globalPropertyIdMap');
        });

        test('propertyIdMapByDb 구조 검증', () => {
            const dbPropertiesMap = new Map([
                ['db1', {
                    databaseTitle: 'DB1',
                    properties: [
                        { id: 'id1', name: 'Name', type: 'title' }
                    ]
                }]
            ]);

            const result = buildPropertyMaps(dbPropertiesMap);

            expect(result.propertyIdMapByDb.get('db1')).toBeDefined();
            expect(result.propertyIdMapByDb.get('db1').id1).toBe('Name');
        });

        test('globalPropertyIdMap에 dbId, dbName 포함', () => {
            const dbPropertiesMap = new Map([
                ['db1', {
                    databaseTitle: 'Database 1',
                    properties: [
                        { id: 'id1', name: 'Name', type: 'title' }
                    ]
                }]
            ]);

            const result = buildPropertyMaps(dbPropertiesMap);

            expect(result.globalPropertyIdMap.id1).toEqual({
                dbId: 'db1',
                dbName: 'Database 1',
                fieldName: 'Name',
                fieldType: 'title'
            });
        });

        test('ID가 없는 속성도 처리', () => {
            const dbPropertiesMap = new Map([
                ['db1', {
                    databaseTitle: 'DB1',
                    properties: [
                        { name: 'NameOnly', type: 'title' }
                    ]
                }]
            ]);

            const result = buildPropertyMaps(dbPropertiesMap);

            expect(result.propertyIdMapByDb.get('db1').NameOnly).toBe('NameOnly');
        });

        test('여러 데이터베이스 처리', () => {
            const dbPropertiesMap = new Map([
                ['db1', {
                    databaseTitle: 'DB1',
                    properties: [{ id: 'id1', name: 'Name', type: 'title' }]
                }],
                ['db2', {
                    databaseTitle: 'DB2',
                    properties: [{ id: 'id2', name: 'Title', type: 'title' }]
                }]
            ]);

            const result = buildPropertyMaps(dbPropertiesMap);

            expect(result.propertyIdMapByDb.get('db1')).toBeDefined();
            expect(result.propertyIdMapByDb.get('db2')).toBeDefined();
        });

        test('빈 데이터베이스 맵 처리', () => {
            const result = buildPropertyMaps(new Map());

            expect(result.propertyIdMapByDb.size).toBe(0);
            expect(result.propertyNameMapByDb.size).toBe(0);
            expect(Object.keys(result.globalPropertyIdMap).length).toBe(0);
        });
    });

    // ============================================
    // createDatabaseNode 테스트
    // ============================================
    describe('createDatabaseNode', () => {
        test('노드 생성 기본', () => {
            const node = createDatabaseNode('db1', { title: 'DB1' });

            expect(node).toHaveProperty('id', 'db1');
            expect(node).toHaveProperty('label', 'DB1');
            expect(node).toHaveProperty('title', 'DB1');
            expect(node).toHaveProperty('color');
            expect(node).toHaveProperty('font');
            expect(node).toHaveProperty('size');
        });

        test('중심 노드 생성 (isCenter=true)', () => {
            const centerNode = createDatabaseNode('db1', { title: 'DB1' }, true);
            const regularNode = createDatabaseNode('db1', { title: 'DB1' }, false);

            expect(centerNode.color).not.toBe(regularNode.color);
            expect(centerNode.size).toBeGreaterThan(regularNode.size);
            expect(centerNode.font.size).toBeGreaterThan(regularNode.font.size);
        });

        test('노드 physics 활성화', () => {
            const node = createDatabaseNode('db1', { title: 'DB1' });

            expect(node.physics).toBe(true);
        });

        test('노드 폰트 색상', () => {
            const node = createDatabaseNode('db1', { title: 'DB1' });

            expect(node.font.color).toBe('#ffffff');
        });

        test('여러 노드 생성', () => {
            const nodes = [
                createDatabaseNode('db1', { title: 'DB1' }, true),
                createDatabaseNode('db2', { title: 'DB2' }, false),
                createDatabaseNode('db3', { title: 'DB3' }, false)
            ];

            expect(nodes).toHaveLength(3);
            expect(nodes[0].id).not.toBe(nodes[1].id);
        });
    });

    // ============================================
    // createDatabaseEdge 테스트
    // ============================================
    describe('createDatabaseEdge', () => {
        test('엣지 생성 기본', () => {
            const relationInfo = [
                { type: 'rollup', name: 'Total Sales' }
            ];

            const edge = createDatabaseEdge('db1', 'db2', 'references', relationInfo);

            expect(edge).toHaveProperty('from', 'db1');
            expect(edge).toHaveProperty('to', 'db2');
            expect(edge).toHaveProperty('label', 'references');
            expect(edge).toHaveProperty('relations', relationInfo);
        });

        test('엣지 방향 설정', () => {
            const edge = createDatabaseEdge('db1', 'db2', 'link', []);

            expect(edge.arrows).toBe('to');
        });

        test('엣지 제목 생성', () => {
            const relationInfo = [
                { type: 'rollup', name: 'Total' },
                { type: 'formula', name: 'Calculation' }
            ];

            const edge = createDatabaseEdge('db1', 'db2', 'complex', relationInfo);

            expect(edge.title).toContain('[rollup] Total');
            expect(edge.title).toContain('[formula] Calculation');
        });

        test('엣지 색상 설정', () => {
            const edge = createDatabaseEdge('db1', 'db2', 'link', []);

            expect(edge.color).toHaveProperty('color');
            expect(edge.color).toHaveProperty('highlight');
        });

        test('여러 엣지 생성', () => {
            const edges = [
                createDatabaseEdge('db1', 'db2', 'ref1', []),
                createDatabaseEdge('db2', 'db3', 'ref2', []),
                createDatabaseEdge('db1', 'db3', 'ref3', [])
            ];

            expect(edges).toHaveLength(3);
            expect(edges[0].from).not.toBe(edges[1].from);
        });

        test('엣지 폰트 설정', () => {
            const edge = createDatabaseEdge('db1', 'db2', 'label', []);

            expect(edge.font.align).toBe('middle');
            expect(typeof edge.font.size).toBe('number');
        });
    });

    // ============================================
    // 통합 시나리오 테스트
    // ============================================
    describe('통합 시나리오', () => {
        test('전체 데이터베이스 조회 및 레코드 처리 흐름', async () => {
            const mockDbs = [
                {
                    id: 'db1',
                    title: [{ plain_text: 'Database 1' }],
                    icon: '📊',
                    created_time: '2024-01-01',
                    last_edited_time: '2024-01-02'
                }
            ];

            const mockRecords = {
                results: [
                    { id: '1', properties: { name: 'Record 1' } },
                    { id: '2', properties: { name: 'Record 2' } }
                ],
                has_more: false,
                next_cursor: null
            };

            notionApi.searchDatabases.mockResolvedValue(mockDbs);
            notionApi.queryDatabase.mockResolvedValue(mockRecords);
            propertyFormatter.formatDatabaseRecord.mockImplementation(r => r);

            const databases = await getAllDatabases('token');
            const records = await getAllDatabaseRecords(databases[0].id, 'token');

            expect(databases).toHaveLength(1);
            expect(records).toHaveLength(2);
        });

        test('네트워크 시각화 노드/엣지 생성', () => {
            const nodes = [
                createDatabaseNode('sales', { title: 'Sales' }, true),
                createDatabaseNode('inventory', { title: 'Inventory' }, false),
                createDatabaseNode('reports', { title: 'Reports' }, false)
            ];

            const edges = [
                createDatabaseEdge('sales', 'inventory', 'stock check', []),
                createDatabaseEdge('inventory', 'reports', 'rollup', [])
            ];

            expect(nodes).toHaveLength(3);
            expect(edges).toHaveLength(2);
            expect(nodes[0].size).toBeGreaterThan(nodes[1].size);
        });

        test('속성 맵과 네트워크 노드 결합', () => {
            const dbPropertiesMap = new Map([
                ['db1', {
                    databaseTitle: 'DB1',
                    properties: [{ id: 'id1', name: 'Name', type: 'title' }]
                }]
            ]);

            const maps = buildPropertyMaps(dbPropertiesMap);
            const node = createDatabaseNode('db1', { title: 'DB1' });

            expect(maps.globalPropertyIdMap.id1.dbId).toBe(node.id);
        });
    });
});
