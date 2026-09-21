/**
 * chainAnalyzer 테스트
 * 책임: 데이터베이스 간 참조 체인 추적 및 트리 구조 검증
 * 핵심 회귀 테스트: (1) 다이아몬드 패턴이 순환 참조로 오판되지 않는지,
 *                   (2) 진짜 순환 참조가 정확히 감지되는지
 */

const mockExtractFieldReferencesFromFormula = jest.fn(() => []);
jest.mock('../utils/formulaParser', () => ({
    extractFieldReferencesFromFormula: (...args) => mockExtractFieldReferencesFromFormula(...args)
}));

const { buildReferenceChains, _collectCycles } = require('../services/chainAnalyzer');

describe('chainAnalyzer', () => {
    beforeEach(() => {
        mockExtractFieldReferencesFromFormula.mockReset();
        mockExtractFieldReferencesFromFormula.mockReturnValue([]);
    });

    const mockDbPropertiesMap = new Map([
        ['db1', {
            databaseTitle: 'Database 1',
            properties: [
                { name: 'Title', type: 'title', id: 'prop1' },
                { name: 'Formula Field', type: 'formula', id: 'prop2', expression: 'prop1 + 1' }
            ]
        }],
        ['db2', {
            databaseTitle: 'Database 2',
            properties: [
                { name: 'Name', type: 'title', id: 'prop3' },
                { name: 'Rollup Field', type: 'rollup', id: 'prop4',
                  referencedDatabaseId: 'db1', referencedProperty: 'Formula Field' }
            ]
        }]
    ]);

    const mockPropertyIdMapByDb = new Map([
        ['db1', { prop1: 'Title', prop2: 'Formula Field' }],
        ['db2', { prop3: 'Name', prop4: 'Rollup Field' }]
    ]);

    const mockPropertyNameMapByDb = new Map([
        ['db1', { Title: 'Title', 'Formula Field': 'Formula Field' }],
        ['db2', { Name: 'Name', 'Rollup Field': 'Rollup Field' }]
    ]);

    const mockGlobalPropertyIdMap = {
        prop1: { dbId: 'db1', dbName: 'Database 1', fieldName: 'Title', fieldType: 'title' },
        prop2: { dbId: 'db1', dbName: 'Database 1', fieldName: 'Formula Field', fieldType: 'formula' },
        prop3: { dbId: 'db2', dbName: 'Database 2', fieldName: 'Name', fieldType: 'title' },
        prop4: { dbId: 'db2', dbName: 'Database 2', fieldName: 'Rollup Field', fieldType: 'rollup' }
    };

    // ============================================
    // 핵심 회귀 테스트: 다이아몬드 패턴 / 순환 참조
    // ============================================
    describe('다이아몬드 패턴과 순환 참조 (ancestorPath 경로-지역 방식)', () => {
        test('A가 B,C를 참조하고 B,C가 각각 D를 참조하는 다이아몬드는 양쪽 가지 모두 D를 포함해야 함 (순환 오판 방지)', () => {
            mockExtractFieldReferencesFromFormula.mockImplementation((expression) => {
                if (expression === 'A_EXPR') return ['B', 'C'];
                if (expression === 'B_EXPR') return ['D'];
                if (expression === 'C_EXPR') return ['D'];
                return [];
            });

            const dbMap = new Map([
                ['db1', {
                    databaseTitle: 'DB1',
                    properties: [
                        { name: 'A', type: 'formula', id: 'a', expression: 'A_EXPR' },
                        { name: 'B', type: 'formula', id: 'b', expression: 'B_EXPR' },
                        { name: 'C', type: 'formula', id: 'c', expression: 'C_EXPR' },
                        { name: 'D', type: 'title', id: 'd' }
                    ]
                }]
            ]);

            const result = buildReferenceChains(dbMap, new Map(), new Map(), {}, false);
            const aChain = result.find(r => r.sourceField === 'A');

            expect(aChain).toBeDefined();
            expect(aChain.hasCycle).toBe(false);
            expect(aChain.tree.children.map(c => c.fieldName).sort()).toEqual(['B', 'C']);

            const bNode = aChain.tree.children.find(c => c.fieldName === 'B');
            const cNode = aChain.tree.children.find(c => c.fieldName === 'C');

            // ★ 회귀 포인트: 이전 버그(전역 공유 visited)라면 둘 중 하나만 D를 갖고 나머지는 누락됨
            expect(bNode.children.map(c => c.fieldName)).toEqual(['D']);
            expect(cNode.children.map(c => c.fieldName)).toEqual(['D']);
            expect(bNode.children[0].cycle).toBeFalsy();
            expect(cNode.children[0].cycle).toBeFalsy();
        });

        test('A가 B를 참조하고 B가 다시 A를 참조하는 진짜 순환은 cycle:true로 정확히 감지되고 무한루프 없이 종료됨', () => {
            mockExtractFieldReferencesFromFormula.mockImplementation((expression) => {
                if (expression === 'A_EXPR') return ['B'];
                if (expression === 'B_EXPR') return ['A'];
                return [];
            });

            const dbMap = new Map([
                ['db1', {
                    databaseTitle: 'DB1',
                    properties: [
                        { name: 'A', type: 'formula', id: 'a', expression: 'A_EXPR' },
                        { name: 'B', type: 'formula', id: 'b', expression: 'B_EXPR' }
                    ]
                }]
            ]);

            const result = buildReferenceChains(dbMap, new Map(), new Map(), {}, false);
            const aChain = result.find(r => r.sourceField === 'A');

            expect(aChain).toBeDefined();
            expect(aChain.hasCycle).toBe(true);
            expect(aChain.cyclePaths.length).toBeGreaterThan(0);

            const bNode = aChain.tree.children.find(c => c.fieldName === 'B');
            const cycleNode = bNode.children.find(c => c.fieldName === 'A');
            expect(cycleNode.cycle).toBe(true);
            expect(cycleNode.cyclePath).toEqual(['db1|A', 'db1|B', 'db1|A']);
        });

        test('_collectCycles는 트리 내 모든 순환 노드를 수집한다', () => {
            const tree = {
                db: 'DB1', fieldName: 'Root', children: [
                    { db: 'DB1', fieldName: 'Normal', children: [] },
                    { db: 'DB1', fieldName: 'Cyclic', cycle: true, cyclePath: ['DB1|Root', 'DB1|Cyclic'], children: [] }
                ]
            };
            const { hasCycle, cyclePaths } = _collectCycles(tree);
            expect(hasCycle).toBe(true);
            expect(cyclePaths).toEqual([['DB1|Root', 'DB1|Cyclic']]);
        });

        test('순환이 없는 트리는 hasCycle: false', () => {
            const tree = { db: 'DB1', fieldName: 'Root', children: [{ db: 'DB1', fieldName: 'Leaf', children: [] }] };
            const { hasCycle, cyclePaths } = _collectCycles(tree);
            expect(hasCycle).toBe(false);
            expect(cyclePaths).toEqual([]);
        });
    });

    // ============================================
    // buildReferenceChains 기본 동작
    // ============================================
    describe('buildReferenceChains', () => {
        test('Rollup 필드를 시작점으로 하는 참조 체인 생성', () => {
            const result = buildReferenceChains(
                mockDbPropertiesMap,
                mockPropertyIdMapByDb,
                mockPropertyNameMapByDb,
                mockGlobalPropertyIdMap,
                false
            );

            const rollupChain = result.find(r => r.sourceType === 'rollup');
            expect(rollupChain).toBeDefined();
            expect(rollupChain.tree.fieldType).toBe('rollup');
        });

        test('참조 체인은 sourceDb, sourceField, sourceDbId, sourceType, hasCycle 포함', () => {
            const result = buildReferenceChains(
                mockDbPropertiesMap,
                mockPropertyIdMapByDb,
                mockPropertyNameMapByDb,
                mockGlobalPropertyIdMap,
                false
            );

            expect(result.length).toBeGreaterThan(0);
            const chain = result[0];
            expect(chain).toHaveProperty('sourceDb');
            expect(chain).toHaveProperty('sourceField');
            expect(chain).toHaveProperty('sourceDbId');
            expect(chain).toHaveProperty('sourceType');
            expect(chain).toHaveProperty('tree');
            expect(chain).toHaveProperty('hasCycle');
            expect(chain).toHaveProperty('cyclePaths');
        });

        test('빈 데이터베이스 맵은 빈 배열 반환', () => {
            const result = buildReferenceChains(new Map(), new Map(), new Map(), {});
            expect(result).toEqual([]);
        });

        test('Title, Checkbox 같은 단순 필드는 시작점이 아님', () => {
            const dbMap = new Map([
                ['db1', {
                    databaseTitle: 'DB1',
                    properties: [
                        { name: 'Title', type: 'title', id: 'prop1' },
                        { name: 'Checkbox', type: 'checkbox', id: 'prop2' },
                        { name: 'Formula', type: 'formula', id: 'prop3', expression: '' }
                    ]
                }]
            ]);

            const result = buildReferenceChains(dbMap, new Map(), new Map(), {});
            expect(result.every(r => r.sourceType === 'formula' || r.sourceType === 'rollup')).toBe(true);
        });

        test('참조가 전혀 없는 formula는 트리가 저장되지 않음', () => {
            mockExtractFieldReferencesFromFormula.mockReturnValue([]);
            const dbMap = new Map([
                ['db1', {
                    databaseTitle: 'DB1',
                    properties: [
                        { name: 'Formula', type: 'formula', id: 'prop1', expression: 'CONST_ONLY' }
                    ]
                }]
            ]);

            const result = buildReferenceChains(dbMap, new Map(), new Map(), {});
            expect(result.length).toBe(0);
        });

        test('null properties는 에러를 던짐 (안전하게 처리되지 않는 기존 동작 유지)', () => {
            const dbMap = new Map([
                ['db1', { databaseTitle: 'DB1', properties: null }]
            ]);
            expect(() => buildReferenceChains(dbMap, new Map(), new Map(), {})).toThrow();
        });

        test('많은 참조 필드 처리 시 에러 없이 완료됨', () => {
            const properties = [];
            for (let i = 0; i < 50; i++) {
                properties.push({ name: `Field${i}`, type: i % 2 === 0 ? 'formula' : 'rollup', id: `prop${i}`, expression: '' });
            }
            const dbMap = new Map([['db1', { databaseTitle: 'DB1', properties }]]);
            expect(() => buildReferenceChains(dbMap, new Map(), new Map(), {})).not.toThrow();
        });
    });

    // ============================================
    // 참조 체인 구조 검증
    // ============================================
    describe('참조 체인 구조', () => {
        test('tree 노드는 db, dbId, fieldName, fieldType, children 포함', () => {
            const result = buildReferenceChains(
                mockDbPropertiesMap,
                mockPropertyIdMapByDb,
                mockPropertyNameMapByDb,
                mockGlobalPropertyIdMap
            );

            expect(result.length).toBeGreaterThan(0);
            const node = result[0].tree;
            expect(node).toHaveProperty('db');
            expect(node).toHaveProperty('dbId');
            expect(node).toHaveProperty('fieldName');
            expect(node).toHaveProperty('fieldType');
            expect(Array.isArray(node.children)).toBe(true);
        });

        test('rollup 노드는 referencedProperty 정보 포함', () => {
            const result = buildReferenceChains(
                mockDbPropertiesMap,
                mockPropertyIdMapByDb,
                mockPropertyNameMapByDb,
                mockGlobalPropertyIdMap
            );

            const rollupChain = result.find(r => r.sourceType === 'rollup');
            expect(rollupChain.tree).toHaveProperty('referencedProperty', 'Formula Field');
            expect(rollupChain.tree).toHaveProperty('referencedPropertyDb', 'Database 1');
        });
    });

    // ============================================
    // 엣지 케이스
    // ============================================
    describe('엣지 케이스', () => {
        test('undefined propertyIdMapByDb 처리', () => {
            expect(() => {
                buildReferenceChains(mockDbPropertiesMap, undefined, mockPropertyNameMapByDb, mockGlobalPropertyIdMap);
            }).not.toThrow();
        });

        test('empty propertyNames 처리', () => {
            const dbMap = new Map([['db1', { databaseTitle: 'DB1', properties: [] }]]);
            const result = buildReferenceChains(dbMap, new Map(), new Map(), {});
            expect(result).toEqual([]);
        });
    });
});
