/**
 * analyzerService 테스트
 * 책임: 공식 Notion 리밋 대비 사용률, IQR 기반 최적화 기회, 참조 체인 통계 검증
 * (calculateQualityScore/analyzePerformanceIssues처럼 근거 없는 매직넘버 기반 점수를
 *  산출하던 함수들은 재설계로 제거되었으므로 더 이상 테스트하지 않는다.)
 */

const {
    analyzeDatabase,
    checkSizeLimits,
    getInformationalMetrics,
    evaluateOptimizationOpportunities,
    analyzeDeepReferenceChains,
    _extractChainPath
} = require('../services/analyzerService');

describe('analyzerService', () => {
    // ============================================
    // analyzeDatabase 테스트
    // ============================================
    describe('analyzeDatabase', () => {
        const mockRecords = [
            { id: '1', last_edited_time: '2024-01-01T00:00:00Z', properties: { name: 'Item 1', status: 'Active' } },
            { id: '2', last_edited_time: '2024-01-02T00:00:00Z', properties: { name: 'Item 2', status: null } },
            { id: '3', last_edited_time: '2024-01-03T00:00:00Z', properties: { name: '', status: 'Inactive' } }
        ];

        const mockProperties = {
            name: { name: 'Name', type: 'title' },
            status: { name: 'Status', type: 'select', select: { options: [{ name: 'Active' }, { name: 'Inactive' }] } }
        };

        test('데이터베이스 분석은 총 레코드 수 반환', () => {
            const result = analyzeDatabase(mockRecords, mockProperties, ['name', 'status']);
            expect(result.totalRecords).toBe(3);
        });

        test('데이터베이스 분석은 총 컬럼 수 반환', () => {
            const result = analyzeDatabase(mockRecords, mockProperties, ['name', 'status']);
            expect(result.totalColumns).toBe(2);
        });

        test('데이터베이스 분석은 DAMA 데이터 품질 차원을 포함', () => {
            const result = analyzeDatabase(mockRecords, mockProperties, ['name', 'status']);
            expect(result.dataQuality).toBeDefined();
            expect(result.dataQuality.completeness.overall).toBeGreaterThanOrEqual(0);
            expect(result.dataQuality.completeness.overall).toBeLessThanOrEqual(100);
            expect(result.dataQuality.accuracy.applicable).toBe(false);
            expect(result.dataQuality.consistency.applicable).toBe(false);
        });

        test('데이터베이스 분석은 컬럼별 통계 반환', () => {
            const result = analyzeDatabase(mockRecords, mockProperties, ['name', 'status']);
            expect(result.columnStats).toBeDefined();
            expect(result.columnStats.name).toBeDefined();
            expect(result.columnStats.status).toBeDefined();
        });

        test('데이터베이스 분석은 성능 분석 결과에 hardLimits를 포함하고 qualityScore는 더 이상 존재하지 않음', () => {
            const result = analyzeDatabase(mockRecords, mockProperties, ['name', 'status']);
            expect(result.qualityScore).toBeUndefined();
            expect(result.performanceAnalysis.hardLimits).toBeDefined();
        });

        test('빈 레코드 리스트는 0 레코드 반환', () => {
            const result = analyzeDatabase([], mockProperties, ['name', 'status']);
            expect(result.totalRecords).toBe(0);
        });

        test('컬럼 통계 사전 계산시 재계산하지 않음', () => {
            const preCalculatedStats = {
                name: { name: 'Name', type: 'title', completeness: 100, filledCount: 3, uniqueCount: 3 },
                status: { name: 'Status', type: 'select', completeness: 67, filledCount: 2, uniqueCount: 2 }
            };
            const result = analyzeDatabase(
                mockRecords,
                mockProperties,
                ['name', 'status'],
                preCalculatedStats
            );
            expect(result.columnStats).toEqual(preCalculatedStats);
        });

        test('4-인자 호출과 5-인자(참조 체인 포함) 호출의 최상위 응답 shape이 동일함 (라우트 정합성 회귀 테스트)', () => {
            const withoutChains = analyzeDatabase(mockRecords, mockProperties, ['name', 'status']);
            const withChains = analyzeDatabase(mockRecords, mockProperties, ['name', 'status'], {}, []);
            expect(Object.keys(withoutChains).sort()).toEqual(Object.keys(withChains).sort());
            expect(Object.keys(withoutChains.performanceAnalysis).sort())
                .toEqual(Object.keys(withChains.performanceAnalysis).sort());
        });
    });

    // ============================================
    // checkSizeLimits 테스트
    // ============================================
    describe('checkSizeLimits', () => {
        test('정상 크기 데이터베이스는 모든 항목이 ok 레벨', () => {
            const records = Array(100).fill(null).map((_, i) => ({
                id: i,
                properties: { name: `Item ${i}` }
            }));
            const properties = { name: { name: 'Name', type: 'title' } };

            const result = checkSizeLimits(records, properties, ['name']);
            expect(result.hardLimits.properties.level).toBe('ok');
            expect(result.hardLimits.rows.level).toBe('ok');
            expect(result.warnings.length).toBe(0);
        });

        test('hardLimits는 공식 문서에 실재하는 6개 리밋만 포함', () => {
            const records = [{ id: 1, properties: { name: 'test' } }];
            const properties = { name: { name: 'Name', type: 'title' } };

            const result = checkSizeLimits(records, properties, ['name']);
            expect(Object.keys(result.hardLimits).sort()).toEqual(
                ['dbStructure', 'pageSize', 'properties', 'relationRefs', 'rows', 'schemaSize'].sort()
            );
            expect(result.hardLimits.properties.limit).toBe(500);
            expect(result.hardLimits.rows.limit).toBe(250000);
            expect(result.hardLimits.relationRefs.limit).toBe(10000);
        });

        test('관계형 필드 참조가 10000개를 초과하면 relationRefs가 critical', () => {
            const records = Array(2).fill(null).map((_, i) => ({
                id: i,
                properties: {
                    relations: Array(10001).fill(null).map((_, j) => `ref${j}`)
                }
            }));
            const properties = {
                relations: { name: 'Relations', type: 'relation' }
            };

            const result = checkSizeLimits(records, properties, ['relations']);
            expect(result.hardLimits.relationRefs.level).toBe('critical');
            expect(result.warnings.some(w => w.type === 'relationRefs')).toBe(true);
        });

        test('버그 수정 확인: select 속성의 options가 prop.select.options 경로에서 읽혀 구조 크기에 반영됨', () => {
            const records = [{ id: 1, properties: { status: 'A' } }];
            const propertiesWithoutOptions = {
                status: { name: 'Status', type: 'select', select: { options: [] } }
            };
            const propertiesWithManyOptions = {
                status: {
                    name: 'Status',
                    type: 'select',
                    select: { options: Array(50).fill(null).map((_, i) => ({ id: `id${i}`, name: `Option ${i}`, color: 'blue' })) }
                }
            };

            const small = checkSizeLimits(records, propertiesWithoutOptions, ['status']);
            const large = checkSizeLimits(records, propertiesWithManyOptions, ['status']);

            expect(large.hardLimits.dbStructure.current).toBeGreaterThan(small.hardLimits.dbStructure.current);
        });
    });

    // ============================================
    // getInformationalMetrics 테스트
    // ============================================
    describe('getInformationalMetrics', () => {
        test('severity/score 없이 순수 수치만 반환', () => {
            const records = Array(10).fill(null).map((_, i) => ({ id: i, properties: {} }));
            const properties = {
                a: { name: 'A', type: 'formula' },
                b: { name: 'B', type: 'rollup' },
                c: { name: 'C', type: 'relation' }
            };

            const result = getInformationalMetrics(records, properties, ['a', 'b', 'c'], []);
            expect(result.recordCount).toBe(10);
            expect(result.formulaRollupCount).toBe(2);
            expect(result.relationCount).toBe(1);
            expect(result.score).toBeUndefined();
            expect(result.severity).toBeUndefined();
        });

        test('체인 깊이 배열로 chainDepthStats 계산', () => {
            const result = getInformationalMetrics([], {}, [], [2, 3, 4, 4, 3]);
            expect(result.chainDepthStats.max).toBe(4);
            expect(result.chainDepthStats.median).toBe(3);
        });
    });

    // ============================================
    // evaluateOptimizationOpportunities 테스트 (IQR 기반)
    // ============================================
    describe('evaluateOptimizationOpportunities', () => {
        test('다른 속성들과 비교해 통계적으로 이상치인 저활용 속성을 식별', () => {
            // 9개는 완성도가 90%대로 고르게 분포, 1개만 5%로 뚝 떨어짐(이상치)
            const columnStats = {};
            const properties = {};
            for (let i = 0; i < 9; i++) {
                columnStats[`col${i}`] = { name: `Col ${i}`, completeness: 90 + i };
                properties[`col${i}`] = { name: `Col ${i}`, type: 'text' };
            }
            columnStats.outlier = { name: 'Outlier', completeness: 5 };
            properties.outlier = { name: 'Outlier', type: 'text' };

            const result = evaluateOptimizationOpportunities([], properties, Object.keys(properties), columnStats);
            const unusedOpportunity = result.find(o => o.type === 'unused_property' && o.property === 'Outlier');
            expect(unusedOpportunity).toBeDefined();
        });

        test('완성도가 고르게 분포되어 있으면(이상치 없음) 저활용 속성을 만들어내지 않음', () => {
            const columnStats = {
                a: { name: 'A', completeness: 88 },
                b: { name: 'B', completeness: 90 },
                c: { name: 'C', completeness: 85 },
                d: { name: 'D', completeness: 92 }
            };
            const properties = {
                a: { name: 'A', type: 'text' }, b: { name: 'B', type: 'text' },
                c: { name: 'C', type: 'text' }, d: { name: 'D', type: 'text' }
            };

            const result = evaluateOptimizationOpportunities([], properties, Object.keys(properties), columnStats);
            expect(result.find(o => o.type === 'unused_property')).toBeUndefined();
        });

        test('필터링 비용이 높은 속성(relation/formula/rollup)이 단순 속성보다 많으면 필터링 최적화 기회 식별', () => {
            const properties = {
                status: { name: 'Status', type: 'select' },
                rel1: { name: 'Rel1', type: 'relation' },
                rel2: { name: 'Rel2', type: 'relation' },
                formula1: { name: 'Formula1', type: 'formula' }
            };

            const result = evaluateOptimizationOpportunities([], properties, Object.keys(properties), {});
            const filteringOpp = result.find(o => o.type === 'filtering_optimization');
            expect(filteringOpp).toBeDefined();
        });

        test('빈 데이터베이스는 빈 기회 배열 반환', () => {
            const result = evaluateOptimizationOpportunities([], {}, [], {});
            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBe(0);
        });
    });

    // ============================================
    // _extractChainPath 테스트 (첫 자식만 따라가던 버그의 회귀 테스트)
    // ============================================
    describe('_extractChainPath', () => {
        test('첫 자식은 얕고 둘째 자식이 깊은 트리에서 실제 최장 경로(둘째 자식 쪽)를 선택함', () => {
            const shallowFirstChild = { db: 'DB1', fieldName: 'Shallow', type: 'formula', children: [] };
            const deepGrandchild = { db: 'DB1', fieldName: 'Grandchild', type: 'formula', children: [] };
            const deepSecondChild = { db: 'DB1', fieldName: 'Deep', type: 'formula', children: [deepGrandchild] };

            const tree = {
                db: 'DB1',
                fieldName: 'Root',
                type: 'formula',
                children: [shallowFirstChild, deepSecondChild] // 첫 자식이 얕음 — 이전 버그라면 이 가지를 선택해 depth=2로 잘못 보고
            };

            const result = _extractChainPath(tree, 'DB1', 'Root', 'formula');

            expect(result.depth).toBe(3); // Root -> Deep -> Grandchild
            expect(result.path.map(p => p.field)).toEqual(['Root', 'Deep', 'Grandchild']);
        });

        test('순환(cycle) 노드가 있는 가지는 탐색을 중단하고 다른 가지를 선택함', () => {
            const cyclicChild = { db: 'DB1', fieldName: 'Cyclic', type: 'formula', cycle: true, cyclePath: ['DB1|Root', 'DB1|Cyclic'], children: [] };
            const normalGrandchild = { db: 'DB1', fieldName: 'End', type: 'formula', children: [] };
            const normalChild = { db: 'DB1', fieldName: 'Normal', type: 'formula', children: [normalGrandchild] };

            const tree = {
                db: 'DB1', fieldName: 'Root', type: 'formula',
                children: [cyclicChild, normalChild]
            };

            const result = _extractChainPath(tree, 'DB1', 'Root', 'formula');
            expect(result.path.map(p => p.field)).toEqual(['Root', 'Normal', 'End']);
        });
    });

    // ============================================
    // analyzeDeepReferenceChains 테스트
    // ============================================
    describe('analyzeDeepReferenceChains', () => {
        test('빈 참조 체인 배열은 빈 deepReferenceChains/cyclicChains 반환', () => {
            const result = analyzeDeepReferenceChains([]);
            expect(result.deepReferenceChains).toEqual([]);
            expect(result.cyclicChains).toEqual([]);
        });

        test('undefined tree는 안전하게 처리됨', () => {
            const chains = [
                { sourceDb: 'DB1', sourceField: 'Field1', sourceType: 'formula' }
            ];
            expect(() => analyzeDeepReferenceChains(chains)).not.toThrow();
        });

        test('참조가 없는(자식 없는) 트리는 결과에서 제외', () => {
            const chains = [
                {
                    sourceDb: 'DB1', sourceField: 'Field1', sourceType: 'formula',
                    tree: { db: 'DB1', fieldName: 'Field1', type: 'formula', children: [] }
                }
            ];
            const result = analyzeDeepReferenceChains(chains, []);
            expect(result.deepReferenceChains.length).toBe(0);
        });

        test('상호 순환(A↔B)에서 양쪽 다 사라지지 않고 하나로 병합되어 살아남음 (필터-순환 상호작용 버그 회귀 테스트)', () => {
            // A→B, B→A로 서로를 참조하는 진짜 순환. buildReferenceChains는 A와 B 각각을
            // 별도의 시작점으로 처리하므로 두 개의 referenceChains 항목이 생기고,
            // A의 경로에는 B가, B의 경로에는 A가 포함된다. DAG 전제의 _filterIncludedChains를
            // 그대로 적용하면 "서로가 서로에게 포함됨"으로 오판해 둘 다 사라지는 버그가 있었다.
            const chains = [
                {
                    sourceDb: 'DB1', sourceField: 'A', sourceType: 'formula',
                    hasCycle: true, cyclePaths: [['DB1|A', 'DB1|B', 'DB1|A']],
                    tree: {
                        db: 'DB1', fieldName: 'A', type: 'formula',
                        children: [{
                            db: 'DB1', fieldName: 'B', type: 'formula',
                            children: [{ db: 'DB1', fieldName: 'A', type: 'formula', cycle: true, cyclePath: ['DB1|A', 'DB1|B', 'DB1|A'], children: [] }]
                        }]
                    }
                },
                {
                    sourceDb: 'DB1', sourceField: 'B', sourceType: 'formula',
                    hasCycle: true, cyclePaths: [['DB1|B', 'DB1|A', 'DB1|B']],
                    tree: {
                        db: 'DB1', fieldName: 'B', type: 'formula',
                        children: [{
                            db: 'DB1', fieldName: 'A', type: 'formula',
                            children: [{ db: 'DB1', fieldName: 'B', type: 'formula', cycle: true, cyclePath: ['DB1|B', 'DB1|A', 'DB1|B'], children: [] }]
                        }]
                    }
                }
            ];

            const result = analyzeDeepReferenceChains(chains, [{ id: 1 }]);
            // 두 시작점 모두 사라지지 않고, 동일 순환이므로 하나로 병합되어 최소 1건은 남아야 한다
            expect(result.cyclicChains.length).toBe(1);
            expect(result.deepReferenceChains.length).toBe(0);
        });

        test('hasCycle이 true인 체인은 cyclicChains로 분리됨', () => {
            const chains = [{
                sourceDb: 'DB1', sourceField: 'A', sourceType: 'formula',
                hasCycle: true,
                cyclePaths: [['DB1|A', 'DB1|B', 'DB1|A']],
                tree: {
                    db: 'DB1', fieldName: 'A', type: 'formula',
                    children: [{ db: 'DB1', fieldName: 'B', type: 'formula', children: [] }]
                }
            }];
            const result = analyzeDeepReferenceChains(chains, [{ id: 1 }]);
            expect(result.cyclicChains.length).toBe(1);
            expect(result.deepReferenceChains.length).toBe(0);
            expect(result.cyclicChains[0].optimizationTips.some(t => t.title.includes('순환'))).toBe(true);
        });
    });
});
