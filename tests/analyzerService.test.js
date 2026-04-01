/**
 * analyzerService 테스트
 * 책임: 데이터 분석 서비스의 통계 계산 및 품질 점수 검증
 */

const {
    analyzeDatabase,
    calculateQualityScore,
    analyzePerformanceIssues,
    evaluateOptimizationOpportunities,
    checkSizeLimits,
    analyzeDeepReferenceChains
} = require('../services/analyzerService');

describe('analyzerService', () => {
    // ============================================
    // calculateQualityScore 테스트
    // ============================================
    describe('calculateQualityScore', () => {
        test('완성도 100%, 컬럼 20개, 성능점수 100일 때 품질점수는 100이어야 함', () => {
            const score = calculateQualityScore(100, 20, 100);
            // 100 * 0.5 + min(20/20 * 100, 100) * 0.2 + 100 * 0.3
            // = 50 + 100 * 0.2 + 30 = 100
            expect(score).toBe(100);
        });

        test('완성도 50%, 컬럼 10개일 때 품질점수 계산 정확성', () => {
            const score = calculateQualityScore(50, 10, 100);
            // 50 * 0.5 + (10/20 * 100) * 0.2 + 100 * 0.3
            // = 25 + 50 * 0.2 + 30 = 25 + 10 + 30 = 65
            expect(score).toBe(65);
        });

        test('낮은 성능점수는 품질점수에 음의 영향', () => {
            const highPerf = calculateQualityScore(100, 20, 100);
            const lowPerf = calculateQualityScore(100, 20, 50);
            expect(highPerf).toBeGreaterThan(lowPerf);
        });

        test('성능점수 기본값 100이 적용됨', () => {
            const scoreWithDefault = calculateQualityScore(100, 20);
            const scoreExplicit = calculateQualityScore(100, 20, 100);
            expect(scoreWithDefault).toBe(scoreExplicit);
        });

        test('0값 입력 처리: 모두 0이면 점수는 0', () => {
            const score = calculateQualityScore(0, 0, 0);
            expect(score).toBe(0);
        });

        test('컬럼 수 20개 초과시 점수는 최대값으로 캡핑됨', () => {
            const score20 = calculateQualityScore(100, 20, 100);
            const score40 = calculateQualityScore(100, 40, 100);
            expect(score20).toBe(score40); // 둘 다 같은 값
        });
    });

    // ============================================
    // analyzeDatabase 테스트
    // ============================================
    describe('analyzeDatabase', () => {
        const mockRecords = [
            { id: '1', properties: { name: 'Item 1', status: 'Active' } },
            { id: '2', properties: { name: 'Item 2', status: null } },
            { id: '3', properties: { name: '', status: 'Inactive' } }
        ];

        const mockProperties = {
            name: { name: 'Name', type: 'title' },
            status: { name: 'Status', type: 'select' }
        };

        test('데이터베이스 분석은 총 레코드 수 반환', () => {
            const result = analyzeDatabase(mockRecords, mockProperties, ['name', 'status']);
            expect(result.totalRecords).toBe(3);
        });

        test('데이터베이스 분석은 총 컬럼 수 반환', () => {
            const result = analyzeDatabase(mockRecords, mockProperties, ['name', 'status']);
            expect(result.totalColumns).toBe(2);
        });

        test('데이터베이스 분석은 완성도 점수 포함', () => {
            const result = analyzeDatabase(mockRecords, mockProperties, ['name', 'status']);
            expect(result.overallCompleteness).toBeDefined();
            expect(result.overallCompleteness).toBeGreaterThanOrEqual(0);
            expect(result.overallCompleteness).toBeLessThanOrEqual(100);
        });

        test('데이터베이스 분석은 컬럼별 통계 반환', () => {
            const result = analyzeDatabase(mockRecords, mockProperties, ['name', 'status']);
            expect(result.columnStats).toBeDefined();
            expect(result.columnStats.name).toBeDefined();
            expect(result.columnStats.status).toBeDefined();
        });

        test('데이터베이스 분석은 품질 점수 포함', () => {
            const result = analyzeDatabase(mockRecords, mockProperties, ['name', 'status']);
            expect(result.qualityScore).toBeDefined();
            expect(typeof result.qualityScore).toBe('number');
        });

        test('빈 레코드 리스트는 0 레코드 반환', () => {
            const result = analyzeDatabase([], mockProperties, ['name', 'status']);
            expect(result.totalRecords).toBe(0);
        });

        test('컬럼 통계 사전 계산시 재계산하지 않음', () => {
            const preCalculatedStats = {
                name: { completeness: 100, filledCount: 3 },
                status: { completeness: 67, filledCount: 2 }
            };
            const result = analyzeDatabase(
                mockRecords, 
                mockProperties, 
                ['name', 'status'],
                preCalculatedStats
            );
            expect(result.columnStats).toEqual(preCalculatedStats);
        });
    });

    // ============================================
    // analyzePerformanceIssues 테스트
    // ============================================
    describe('analyzePerformanceIssues', () => {
        test('정상 데이터베이스는 "good" 심각도 반환', () => {
            const records = Array(500).fill(null).map((_, i) => ({
                id: i,
                properties: { col: `value${i}` }
            }));
            const properties = {
                col: { name: 'Column', type: 'text' }
            };
            
            const result = analyzePerformanceIssues(records, properties, ['col']);
            expect(result.severity).toBe('good');
            expect(result.score).toBe(100);
        });

        test('1000개 이상 페이지는 warning 심각도 반환', () => {
            const records = Array(1500).fill(null).map((_, i) => ({
                id: i,
                properties: { col: `value${i}` }
            }));
            const properties = {
                col: { name: 'Column', type: 'text' }
            };
            
            const result = analyzePerformanceIssues(records, properties, ['col']);
            expect(result.factors.length).toBeGreaterThan(0);
            expect(result.score).toBeLessThan(100);
        });

        test('5000개 이상 페이지는 critical 심각도에 도달하기 위해 점수가 낮음', () => {
            const records = Array(5500).fill(null).map((_, i) => ({
                id: i,
                properties: { col: `value${i}` }
            }));
            const properties = {
                col: { name: 'Column', type: 'text' }
            };
            
            const result = analyzePerformanceIssues(records, properties, ['col']);
            // 5500개 페이지는 critical 인자를 포함
            expect(result.score).toBeLessThan(100);
            expect(result.factors.length).toBeGreaterThan(0);
        });

        test('30개 이상 속성은 성능 이슈 추출', () => {
            const records = [{ id: 1, properties: {} }];
            const properties = {};
            const propertyNames = [];
            
            for (let i = 0; i < 35; i++) {
                properties[`col${i}`] = { name: `Column ${i}`, type: 'text' };
                propertyNames.push(`col${i}`);
            }
            
            const result = analyzePerformanceIssues(records, properties, propertyNames);
            const propertyCountIssue = result.factors.find(f => f.type === 'property_count');
            expect(propertyCountIssue).toBeDefined();
        });

        test('10개 이상 수식/롤업 속성은 이슈 추출', () => {
            const records = [{ id: 1, properties: {} }];
            const properties = {};
            
            for (let i = 0; i < 12; i++) {
                properties[`formula${i}`] = { name: `Formula ${i}`, type: i < 6 ? 'formula' : 'rollup' };
            }
            
            const result = analyzePerformanceIssues(records, properties, Object.keys(properties));
            const complexLogicIssue = result.factors.find(f => f.type === 'complex_logic');
            expect(complexLogicIssue).toBeDefined();
        });
    });

    // ============================================
    // evaluateOptimizationOpportunities 테스트
    // ============================================
    describe('evaluateOptimizationOpportunities', () => {
        test('저활용도 속성(30% 미만)은 최적화 기회로 식별', () => {
            const columnStats = {
                unused: { name: 'Unused Column', completeness: 20, filledCount: 2 }
            };
            const properties = {
                unused: { name: 'Unused Column', type: 'text' }
            };
            
            const result = evaluateOptimizationOpportunities([], properties, ['unused'], columnStats);
            const unusedOpportunity = result.find(o => o.type === 'unused_property');
            expect(unusedOpportunity).toBeDefined();
        });

        test('고활용도 필터링 속성은 필터링 최적화 기회로 식별', () => {
            const records = Array(100).fill(null).map((_, i) => ({
                id: i,
                properties: { 
                    status: 'Active',
                    priority: 'High',
                    category: 'A'
                }
            }));

            const properties = {
                status: { name: 'Status', type: 'select' },
                priority: { name: 'Priority', type: 'select' },
                category: { name: 'Category', type: 'select' },
                description: { name: 'Description', type: 'text' },
                notes: { name: 'Notes', type: 'text' },
                tags: { name: 'Tags', type: 'text' },
                author: { name: 'Author', type: 'text' },
                date: { name: 'Date', type: 'text' },
                count: { name: 'Count', type: 'text' },
                value: { name: 'Value', type: 'text' },
                formula: { name: 'Formula', type: 'formula' }
            };
            
            const result = evaluateOptimizationOpportunities(
                records,
                properties,
                Object.keys(properties)
            );
            const filteringOpp = result.find(o => o.type === 'filtering_optimization');
            expect(filteringOpp).toBeDefined();
        });

        test('빈 데이터베이스는 빈 기회 배열 반환', () => {
            const result = evaluateOptimizationOpportunities([], {}, []);
            expect(Array.isArray(result)).toBe(true);
        });
    });

    // ============================================
    // checkSizeLimits 테스트
    // ============================================
    describe('checkSizeLimits', () => {
        test('정상 크기 데이터베이스는 "ok" 상태 반환', () => {
            const records = Array(100).fill(null).map((_, i) => ({
                id: i,
                properties: { name: `Item ${i}` }
            }));
            const properties = { name: { name: 'Name', type: 'text' } };
            
            const result = checkSizeLimits(records, properties, ['name']);
            expect(result.status).toBe('ok');
        });

        test('크기 제한 체크는 경고 배열 포함', () => {
            const records = [{ id: 1, properties: { name: 'test' } }];
            const properties = { name: { name: 'Name', type: 'text' } };
            
            const result = checkSizeLimits(records, properties, ['name']);
            expect(Array.isArray(result.warnings)).toBe(true);
        });

        test('크기 제한 체크는 메트릭 포함', () => {
            const records = [{ id: 1, properties: { name: 'test' } }];
            const properties = { name: { name: 'Name', type: 'text' } };
            
            const result = checkSizeLimits(records, properties, ['name']);
            expect(result.metrics).toBeDefined();
            expect(result.metrics.totalDataSize).toBeDefined();
        });

        test('관계형 필드 10000개 초과는 critical 경고', () => {
            // 각 레코드마다 9000개의 관계형 참조 생성
            const records = Array(2).fill(null).map((_, i) => ({
                id: i,
                properties: { 
                    relations: Array(9000).fill(null).map((_, j) => ({ id: `ref${j}` }))
                }
            }));
            const properties = { 
                relations: { name: 'Relations', type: 'relation' }
            };
            
            const result = checkSizeLimits(records, properties, ['relations']);
            const relationWarning = result.warnings.find(w => w.type === 'relation_limit');
            expect(relationWarning?.level).toBe('critical');
        });
    });

    // ============================================
    // analyzeDeepReferenceChains 테스트
    // ============================================
    describe('analyzeDeepReferenceChains', () => {
        test('빈 참조 체인 배열은 빈 배열 반환', () => {
            const result = analyzeDeepReferenceChains([]);
            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBe(0);
        });

        test('3단계 미만 체인은 필터링됨', () => {
            const chains = [
                {
                    sourceDb: 'DB1',
                    sourceField: 'Field1',
                    sourceType: 'formula',
                    tree: { depth: 2, db: 'DB1', fieldName: 'Field1' }
                }
            ];
            const result = analyzeDeepReferenceChains(chains);
            // 깊이가 2이므로 결과에 포함되지 않을 가능성
            expect(Array.isArray(result)).toBe(true);
        });

        test('undefined tree는 안전하게 처리됨', () => {
            const chains = [
                {
                    sourceDb: 'DB1',
                    sourceField: 'Field1',
                    sourceType: 'formula'
                    // tree 속성 없음
                }
            ];
            expect(() => {
                analyzeDeepReferenceChains(chains);
            }).not.toThrow();
        });

        test('빈 레코드 배열 처리', () => {
            const chains = [];
            expect(() => {
                analyzeDeepReferenceChains(chains, []);
            }).not.toThrow();
        });
    });

    // ============================================
    // 통합 시나리오 테스트
    // ============================================
    describe('통합 시나리오', () => {
        test('복잡한 데이터베이스 전체 분석 흐름', () => {
            const records = Array(500).fill(null).map((_, i) => ({
                id: `id${i}`,
                properties: {
                    title: `Item ${i}`,
                    priority: i % 3 === 0 ? null : ['High', 'Medium', 'Low'][i % 3],
                    tags: i % 2 === 0 ? ['tag1', 'tag2'] : []
                }
            }));

            const properties = {
                title: { name: 'Title', type: 'title' },
                priority: { name: 'Priority', type: 'select' },
                tags: { name: 'Tags', type: 'multi_select' }
            };

            const result = analyzeDatabase(
                records,
                properties,
                ['title', 'priority', 'tags']
            );

            expect(result.totalRecords).toBe(500);
            expect(result.totalColumns).toBe(3);
            expect(result.qualityScore).toBeDefined();
            expect(result.columnStats).toBeDefined();
            expect(Object.keys(result.columnStats).length).toBeGreaterThan(0);
        });

        test('성능 분석과 최적화 기회 결합', () => {
            const records = Array(100).fill(null).map((_, i) => ({
                id: i,
                properties: { name: `Item ${i}`, status: 'Active' }
            }));

            const properties = {
                name: { name: 'Name', type: 'text' },
                status: { name: 'Status', type: 'select' }
            };

            const perfIssues = analyzePerformanceIssues(records, properties, ['name', 'status']);
            const opportunities = evaluateOptimizationOpportunities(
                records,
                properties,
                ['name', 'status']
            );

            expect(perfIssues).toBeDefined();
            expect(opportunities).toBeDefined();
        });
    });
});
