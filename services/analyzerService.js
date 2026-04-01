/**
 * 데이터 분석 서비스
 * 책임: 데이터베이스 분석 및 품질 점수 계산
 */

/**
 * 데이터베이스 전체 분석
 */
function analyzeDatabase(records, properties, propertyNames, columnStats = {}, referenceChains = []) {
    const totalRecords = records.length;
    const analyzeColumnStats = columnStats && Object.keys(columnStats).length > 0 ? columnStats : {};

    // 각 컬럼별 통계 계산 (columnStats가 제공되지 않은 경우만)
    if (!analyzeColumnStats || Object.keys(analyzeColumnStats).length === 0) {
        propertyNames.forEach(propKey => {
            const property = properties[propKey];
            const stats = _calculateColumnStats(property, propKey, records, totalRecords);
            analyzeColumnStats[propKey] = stats;
        });
    }

    // 전체 완성도 계산
    const overallCompleteness = _calculateOverallCompleteness(analyzeColumnStats, propertyNames);

    // 성능 분석 리포트 생성 (참조 체인 포함)
    const performanceReport = generatePerformanceReport(records, properties, propertyNames, analyzeColumnStats, referenceChains);
    const performanceScore = performanceReport.summary.performanceScore;

    return {
        totalRecords,
        totalColumns: propertyNames.length,
        overallCompleteness,
        performanceScore: performanceScore,
        qualityScore: calculateQualityScore(overallCompleteness, propertyNames.length, performanceScore),
        columnStats: analyzeColumnStats,
        performanceAnalysis: {
            issues: performanceReport.performance,
            opportunities: performanceReport.opportunities,
            limits: performanceReport.limits,
            deepReferenceChains: performanceReport.deepReferenceChains,
            deepChainsMetrics: performanceReport.deepChainsMetrics  // ★ 추가
        }
    };
}

/**
 * 컬럼별 통계 계산
 */
function _calculateColumnStats(property, propKey, records, totalRecords) {
    const propertyName = property.name || propKey;
    const propertyType = property.type;

    const stats = {
        name: propertyName,
        type: propertyType,
        totalCount: totalRecords,
        filledCount: 0,
        emptyCount: 0,
        emptyRate: 0,
        uniqueValues: new Set(),
        typeDistribution: {}
    };

    records.forEach(record => {
        const value = record.properties?.[propKey];
        const formattedValue = value;

        if (_isEmpty(formattedValue)) {
            stats.emptyCount++;
        } else {
            stats.filledCount++;
            if (typeof formattedValue === 'string') {
                stats.uniqueValues.add(formattedValue);
            } else if (Array.isArray(formattedValue) && formattedValue.length > 0) {
                stats.uniqueValues.add(formattedValue.length.toString());
            }
        }
    });

    stats.emptyRate = totalRecords > 0 ? Math.round((stats.emptyCount / totalRecords) * 100) : 0;
    stats.completeness = 100 - stats.emptyRate;
    stats.uniqueCount = stats.uniqueValues.size;
    stats.uniqueValues = Array.from(stats.uniqueValues).slice(0, 10);

    return stats;
}

/**
 * 전체 완성도 계산
 */
function _calculateOverallCompleteness(columnStats, propertyNames) {
    let totalCompleteness = 0;
    propertyNames.forEach(propKey => {
        totalCompleteness += columnStats[propKey].completeness;
    });
    return propertyNames.length > 0 ? Math.round(totalCompleteness / propertyNames.length) : 0;
}

/**
 * 값이 비어있는지 확인
 */
function _isEmpty(value) {
    return (
        value === null ||
        value === '' ||
        value === undefined ||
        (Array.isArray(value) && value.length === 0)
    );
}

/**
 * 품질 점수 계산 (완성도 50% + 컬럼 수 20% + 성능 점수 30%)
 * @param {number} completeness - 완성도 (0-100)
 * @param {number} columnCount - 컬럼 수
 * @param {number} performanceScore - 성능 점수 (0-100) - 기본값 100
 */
function calculateQualityScore(completeness, columnCount, performanceScore = 100) {
    const completenessScore = completeness * 0.5;
    const columnScore = Math.min((columnCount / 20) * 100, 100) * 0.2;
    const performanceWeightedScore = performanceScore * 0.3;
    return Math.round(completenessScore + columnScore + performanceWeightedScore);
}

/**
 * 성능 문제 분석
 * Notion 공식 문서의 성능 최적화 기준을 적용하여 성능 이슈 식별
 */
function analyzePerformanceIssues(records, properties, propertyNames, referenceChains = []) {
    console.log('[analyzePerformanceIssues] 호출됨');
    console.log('  - records:', records.length);
    console.log('  - properties:', Object.keys(properties).length);
    console.log('  - propertyNames:', propertyNames);
    
    const issues = {
        severity: 'good', // good, warning, critical
        score: 100,
        factors: [],
        recommendations: []
    };

    // 1. 페이지 수 분석
    const recordCount = records.length;
    if (recordCount > 1000) {
        issues.factors.push({
            type: 'page_count',
            severity: recordCount > 5000 ? 'critical' : 'warning',
            title: '많은 페이지 수',
            current: recordCount,
            threshold: 1000,
            impact: '페이지가 많을수록 로딩 시간이 증가합니다',
            recommendation: '오래된 페이지는 삭제하거나, 생성 일시 필터를 사용해 필터링하세요'
        });
        issues.score -= recordCount > 5000 ? 30 : 15;
    }

    // 2. 속성 수 분석
    const propertyCount = propertyNames.length;
    if (propertyCount > 30) {
        issues.factors.push({
            type: 'property_count',
            severity: propertyCount > 50 ? 'critical' : 'warning',
            title: '많은 속성 수',
            current: propertyCount,
            threshold: 30,
            impact: '표시되는 속성이 많을수록 렌더링 성능이 저하됩니다',
            recommendation: '현재 보기에서 중요하지 않은 속성은 숨기기 기능을 사용하세요'
        });
        issues.score -= propertyCount > 50 ? 25 : 15;
    }

    // 3. 복잡한 로직 분석
    const complexPropertyCount = Object.values(properties).filter(p => 
        p.type === 'formula' || p.type === 'rollup'
    ).length;

    if (complexPropertyCount > 10) {
        issues.factors.push({
            type: 'complex_logic',
            severity: complexPropertyCount > 20 ? 'critical' : 'warning',
            title: '많은 수식/롤업 속성',
            current: complexPropertyCount,
            threshold: 10,
            impact: '수식과 롤업 계산은 시스템 부하를 높입니다',
            recommendation: '필터링 시 수식/롤업보다 선택, 상태, 숫자 등 단순 속성을 우선 사용하세요'
        });
        issues.score -= complexPropertyCount > 20 ? 20 : 10;
    }

    // 4. 참조 체인 복잡성 분석
    const deepChains = referenceChains.filter(chain => chain.chainLength > 3);
    if (deepChains.length > 0) {
        const maxChainLength = Math.max(...referenceChains.map(c => c.chainLength));
        issues.factors.push({
            type: 'reference_chain',
            severity: maxChainLength > 5 ? 'critical' : 'warning',
            title: '복잡한 참조 체인',
            current: deepChains.length,
            maxDepth: maxChainLength,
            threshold: 3,
            impact: '수식이 다른 수식/롤업을 참조하는 복잡한 체인은 계산 속도를 저하시킵니다',
            recommendation: '참조 체인을 단순화하고 불필요한 중간 계산 필드를 제거하세요'
        });
        issues.score -= Math.min(20, deepChains.length * 2);
    }

    // 5. 관계형 필드 분석
    const relationCount = Object.values(properties).filter(p => p.type === 'relation').length;
    if (relationCount > 0) {
        // 실제 관계 데이터 크기 추정
        let totalRelationReferences = 0;
        records.forEach(record => {
            Object.entries(properties).forEach(([key, prop]) => {
                if (prop.type === 'relation' && record.properties?.[key]) {
                    const refCount = Array.isArray(record.properties[key]) 
                        ? record.properties[key].length 
                        : (record.properties[key] ? 1 : 0);
                    totalRelationReferences += refCount;
                }
            });
        });

        if (totalRelationReferences > 1000) {
            issues.factors.push({
                type: 'relation_count',
                severity: totalRelationReferences > 10000 ? 'critical' : 'warning',
                title: '많은 관계형 참조',
                current: totalRelationReferences,
                threshold: 10000,
                impact: '한 페이지당 최대 10,000개 참조까지만 허용됩니다',
                recommendation: '관계형 필드의 참조 수를 10,000개 이하로 유지하세요'
            });
            if (totalRelationReferences > 10000) {
                issues.score -= 30;
            }
        }
    }

    // 종합 심각도 결정
    if (issues.score <= 30) {
        issues.severity = 'critical';
    } else if (issues.score <= 60) {
        issues.severity = 'warning';
    }

    // 일반적인 최적화 권장사항 추가
    if (issues.factors.length === 0) {
        issues.recommendations.push({
            category: 'maintenance',
            title: '정기적인 데이터 정리',
            description: '데이터베이스의 성능 유지를 위해 불필요한 페이지를 주기적으로 정리하세요'
        });
    }

    console.log('[analyzePerformanceIssues] 반환:', { score: issues.score, severity: issues.severity, factors: issues.factors.length });
    return issues;
}

/**
 * 최적화 기회 평가
 * 데이터베이스 구조 분석을 통해 개선 가능한 영역 식별
 */
function evaluateOptimizationOpportunities(records, properties, propertyNames, columnStats = {}) {
    console.log('[evaluateOptimizationOpportunities] 호출됨');
    console.log('  - records:', records.length);
    console.log('  - columnStats keys:', Object.keys(columnStats).length);
    
    const opportunities = [];

    // 1. 저활용도 속성 식별
    Object.entries(columnStats).forEach(([propKey, stats]) => {
        if (stats.completeness < 30) {
            opportunities.push({
                priority: 'medium',
                difficulty: 'low',
                type: 'unused_property',
                property: stats.name || propKey,
                title: '저활용도 속성',
                current_fill_rate: stats.completeness,
                description: `이 속성은 30% 보다 적게 사용되고 있습니다`,
                benefit: '불필요한 속성을 제거하면 로딩 성능이 개선됩니다',
                action: '이 속성이 정말 필요한지 확인 후 불필요하면 제거하세요'
            });
        }
    });

    // 2. 속성 타입 최적화 기회
    Object.entries(properties).forEach(([propKey, prop]) => {
        // Formula 필드를 Template이나 Pre-calculated 값으로 전환 가능성
        if (prop.type === 'formula' && prop.expression) {
            const stats = columnStats[propKey];
            if (stats && stats.completeness > 90) {
                opportunities.push({
                    priority: 'low',
                    difficulty: 'medium',
                    type: 'formula_optimization',
                    property: prop.name || propKey,
                    title: 'Formula 최적화 기회',
                    description: '자주 사용되는 Formula 결과를 사전 계산하면 성능이 개선될 수 있습니다',
                    benefit: '실시간 계산 부하 감소',
                    action: '이 필드의 사용 패턴을 분석하고 필요시 자동화를 고려하세요'
                });
            }
        }
    });

    // 3. 데이터 정렬 및 필터링 최적화
    const selectProperties = Object.values(properties).filter(p => 
        p.type === 'select' || p.type === 'multi_select' || p.type === 'status'
    );
    
    if (selectProperties.length > 0 && selectProperties.length < Object.values(properties).length * 0.3) {
        opportunities.push({
            difficulty: 'low',
            priority: 'high',
            type: 'filtering_optimization',
            title: '필터링 성능 최적화',
            description: `현재 ${selectProperties.length}개의 단순 필터링 속성이 있습니다`,
            benefit: '선택/상태 기반 필터링이 Formula/Rollup 필터링보다 훨씬 빠릅니다',
            action: '가능한 한 Select, Status, 숫자, 날짜 등 단순 속성으로 필터링하세요'
        });
    }

    console.log('[evaluateOptimizationOpportunities] 반환:', opportunities.length, '개의 기회');
    return opportunities;
}

/**
 * 크기 제한 확인
 * Notion 공식 제한: 페이지당 2.5MB, DB당 1.5MB
 */
function checkSizeLimits(records, properties, propertyNames) {
    console.log('[checkSizeLimits] 호출됨');
    console.log('  - records:', records.length);
    console.log('  - propertyNames:', propertyNames);
    
    const limits = {
        pageLevelLimit: 2.5 * 1024 * 1024, // 2.5MB
        databaseLevelLimit: 1.5 * 1024 * 1024, // 1.5MB
        relationshipLimit: 10000,
        warnings: [],
        status: 'ok'
    };

    // 1. 페이지 레벨 크기 추정 (속성 데이터만, 파일/본문 제외)
    let totalPageSize = 0;
    records.forEach(record => {
        let recordSize = 0;
        propertyNames.forEach(propKey => {
            const value = record.properties?.[propKey];
            if (value) {
                recordSize += JSON.stringify(value).length;
            }
        });
        totalPageSize += recordSize;
    });

    const avgPageSize = records.length > 0 ? totalPageSize / records.length : 0;
    const maxPageSize = records.length > 0 
        ? Math.max(...records.map(r => {
            let size = 0;
            propertyNames.forEach(propKey => {
                const value = r.properties?.[propKey];
                if (value) size += JSON.stringify(value).length;
            });
            return size;
        }))
        : 0;

    if (maxPageSize > limits.pageLevelLimit * 0.8) {
        limits.warnings.push({
            level: 'critical',
            type: 'page_size',
            message: `최대 페이지 크기가 2.5MB 제한의 80%에 도달했습니다 (${(maxPageSize / 1024 / 1024).toFixed(2)}MB)`,
            recommendation: '큰 데이터를 여러 페이지로 분산시키는 것을 고려하세요'
        });
        limits.status = 'warning';
    }

    // 2. 데이터베이스 레벨 크기 추정 (속성 정의, 선택 옵션 등)
    let dbStructureSize = 0;
    Object.entries(properties).forEach(([key, prop]) => {
        dbStructureSize += JSON.stringify(prop).length;
        // 선택/다중선택 옵션 포함
        if ((prop.type === 'select' || prop.type === 'multi_select') && prop.options) {
            prop.options.forEach(opt => {
                dbStructureSize += JSON.stringify(opt).length;
            });
        }
    });

    if (dbStructureSize > limits.databaseLevelLimit * 0.8) {
        limits.warnings.push({
            level: 'warning',
            type: 'db_structure_size',
            message: `데이터베이스 구조 크기가 1.5MB 제한의 80%에 도달했습니다 (${(dbStructureSize / 1024).toFixed(2)}KB)`,
            recommendation: '불필요한 속성 정의나 선택 옵션을 제거하세요'
        });
        limits.status = 'warning';
    }

    // 3. 관계형 필드 제한 확인
    let totalRelations = 0;
    records.forEach(record => {
        Object.entries(properties).forEach(([key, prop]) => {
            if (prop.type === 'relation' && record.properties?.[key]) {
                const count = Array.isArray(record.properties[key]) 
                    ? record.properties[key].length 
                    : (record.properties[key] ? 1 : 0);
                totalRelations += count;
            }
        });
    });

    const maxRelationsPerPage = records.length > 0 
        ? Math.max(...records.map(r => {
            let count = 0;
            Object.entries(properties).forEach(([key, prop]) => {
                if (prop.type === 'relation' && r.properties?.[key]) {
                    count += Array.isArray(r.properties[key]) 
                        ? r.properties[key].length 
                        : (r.properties[key] ? 1 : 0);
                }
            });
            return count;
        }))
        : 0;

    if (maxRelationsPerPage > limits.relationshipLimit * 0.8) {
        limits.warnings.push({
            level: 'critical',
            type: 'relation_limit',
            message: `한 페이지의 관계형 참조가 한계(10,000개)의 80%에 도달했습니다 (${maxRelationsPerPage}개)`,
            recommendation: '관계형 참조를 여러 필드로 분산시키거나 일부 관계를 제거하세요'
        });
        limits.status = 'critical';
    }

    limits.metrics = {
        totalDataSize: totalPageSize,
        avgPageSize: avgPageSize,
        maxPageSize: maxPageSize,
        dbStructureSize: dbStructureSize,
        totalRelationReferences: totalRelations,
        maxRelationsPerPage: maxRelationsPerPage
    };

    console.log('[checkSizeLimits] 반환:', { status: limits.status, warnings: limits.warnings.length });
    return limits;
}

/**
 * 깊은 참조 체인 분석
 * 3단계 이상의 참조 경로를 추출하고 우선순위 지정
 */
function analyzeDeepReferenceChains(referenceChains = [], records = []) {
    console.log('[analyzeDeepReferenceChains] 호출됨, 체인 개수:', referenceChains.length);
    
    const deepChains = [];

    // 각 참조 체인 분석
    referenceChains.forEach((chainItem, idx) => {
        if (!chainItem.tree) {
            console.log(`  [체인 ${idx}] tree 없음 - 건너뜀`);
            return;
        }

        // 트리 깊이 계산 및 경로 추출
        const pathAnalysis = _extractChainPath(chainItem.tree, chainItem.sourceDb, chainItem.sourceField, chainItem.sourceType);
        
        console.log(`  [체인 ${idx}] ${chainItem.sourceDb}.${chainItem.sourceField} - 깊이: ${pathAnalysis?.depth || 'N/A'}`);
        
        // ★ 추출된 경로의 모든 노드 로깅
        if (pathAnalysis?.path) {
            console.log(`    📍 경로 노드 (${pathAnalysis.path.length}개):`);
            pathAnalysis.path.forEach((node, nodeIdx) => {
                console.log(`       ${nodeIdx + 1}. ${node.db} > ${node.field} (${node.type})`);
            });
        }
        
        if (!pathAnalysis || pathAnalysis.depth < 3) {
            console.log(`    → 필터링: 깊이 ${pathAnalysis?.depth || 'N/A'} < 3`);
            return; // 3단계 미만은 제외
        }

        // 영향받는 레코드 수 계산 (소스 필드 기준)
        const affectedRecords = records.filter(r => {
            // 소스 DB의 필드가 비어있지 않으면 카운트
            const record = r;
            return record && typeof record === 'object';
        }).length;

        console.log(`    → 포함: 깊이 ${pathAnalysis.depth}, 영향 ${affectedRecords}건`);

        // 심각도 계산
        const severity = _calculateChainSeverity(pathAnalysis.depth, affectedRecords);

        // 관련 데이터베이스 목록
        const relatedDatabases = _extractDatabasesFromPath(pathAnalysis.path);

        // 최적화 제안 생성
        const optimizationTips = _generateChainOptimizationTips(pathAnalysis, affectedRecords);

        deepChains.push({
            depth: pathAnalysis.depth,
            sourceDb: chainItem.sourceDb,
            sourceField: chainItem.sourceField,
            sourceDbId: chainItem.sourceDbId,
            sourceType: chainItem.sourceType,
            path: pathAnalysis.path,
            tree: chainItem.tree,  // ★ 원본 트리 정보 추가 (렌더링용)
            affectedRecords: affectedRecords,
            severity: severity,
            relatedDatabases: relatedDatabases,
            optimizationTips: optimizationTips,
            _pathDetails: pathAnalysis // 디버깅용
        });
    });

    // 정렬: 깊이 DESC → 영향도 DESC
    deepChains.sort((a, b) => {
        if (b.depth !== a.depth) {
            return b.depth - a.depth; // 깊이 내림차순
        }
        return b.affectedRecords - a.affectedRecords; // 영향도 내림차순
    });

    // ★ 하위 경로 필터링: 이미 다른 체인에 포함된 노드는 제외
    const filteredDeepChains = _filterIncludedChains(deepChains);

    console.log('[analyzeDeepReferenceChains] 반환:', filteredDeepChains.length, '개의 깊은 체인 발견 (필터링 후)');
    return filteredDeepChains;
}

/**
 * 트리에서 경로 추출 및 깊이 계산
 * ★ 개선: 첫 번째 분기를 따라 가장 깊은 경로 추출 (중복 제거)
 */
function _extractChainPath(treeNode, sourceDb, sourceField, sourceType) {
    if (!treeNode) {
        return null;
    }

    // 초기 경로: 소스 필드
    const path = [{
        db: sourceDb,
        field: sourceField,
        type: sourceType
    }];

    let currentNode = treeNode;
    let depth = 1;

    // 트리를 따라 내려가며 가장 깊은 경로 구성
    while (currentNode && currentNode.children && currentNode.children.length > 0) {
        const child = currentNode.children[0]; // 첫 번째 분기 선택
        
        path.push({
            db: child.db,
            field: child.fieldName,
            type: child.type,
            referencedProperty: child.referencedProperty
        });

        depth++;
        currentNode = child;
    }

    // ★ 마지막 노드에 referencedProperty가 있으면 최종 참조 필드도 경로에 추가
    if (currentNode && currentNode.referencedProperty && currentNode.referencedPropertyDb) {
        path.push({
            db: currentNode.referencedPropertyDb,
            field: currentNode.referencedProperty,
            type: 'referenced'  // 참조된 필드를 명시적으로 표시
        });
        depth++;
    }

    return {
        path: path,
        depth: depth,
        chainLength: depth // sourceDb 포함 개수
    };
}

/**
 * 경로에서 데이터베이스 리스트 추출 (중복 제거)
 */
function _extractDatabasesFromPath(path) {
    const dbSet = new Set();
    path.forEach(node => {
        if (node.db) {
            dbSet.add(node.db);
        }
    });
    return Array.from(dbSet);
}

/**
 * 깊은 참조 체인에서 하위 경로 필터링
 * A - B - C - D가 있으면 B - C - D는 제외
 * ★ path 배열의 시작 노드(sourceDb|sourceField)를 추적하여 필터링
 */
function _filterIncludedChains(deepChains) {
    // 1. 모든 체인의 path에서 sourceDb|sourceField를 제외한 모든 노드 수집
    const allIncludedStartNodes = new Set();
    
    deepChains.forEach(chain => {
        // path의 첫 번째 노드를 제외한 나머지 노드들을 "포함된 시작점"으로 수집
        if (chain.path && chain.path.length > 1) {
            for (let i = 1; i < chain.path.length; i++) {
                const node = chain.path[i];
                const nodeKey = `${node.db}|${node.field}`;
                allIncludedStartNodes.add(nodeKey);
            }
        }
    });

    console.log(`[_filterIncludedChains] 수집된 포함 노드: ${allIncludedStartNodes.size}개`);
    if (allIncludedStartNodes.size > 0) {
        console.log('  포함된 노드:');
        Array.from(allIncludedStartNodes).slice(0, 3).forEach(nodeKey => {
            console.log(`    - ${nodeKey}`);
        });
        if (allIncludedStartNodes.size > 3) {
            console.log(`    ... (${allIncludedStartNodes.size - 3}개 더)`);
        }
    }

    // 2. sourceField이 다른 체인의 경로에 포함된 체인은 제외
    const filteredChains = deepChains.filter(chain => {
        const nodeKey = `${chain.sourceDb}|${chain.sourceField}`;
        const isIncluded = allIncludedStartNodes.has(nodeKey);
        if (isIncluded) {
            console.log(`  ✗ 제외: ${chain.sourceDb}.${chain.sourceField} (다른 체인에 포함됨)`);
        }
        return !isIncluded;
    });

    console.log(`[_filterIncludedChains] ${deepChains.length}개 → ${filteredChains.length}개 (${deepChains.length - filteredChains.length}개 제외됨)`);

    return filteredChains;
}



/**
 * 체인 심각도 계산
 */
function _calculateChainSeverity(depth, affectedRecords) {
    // 깊이와 영향도 기반 심각도 결정
    if (depth >= 5 && affectedRecords >= 100) {
        return 'critical';
    }
    if (depth >= 5 || (depth >= 4 && affectedRecords >= 50)) {
        return 'warning';
    }
    return 'info';
}

/**
 * 체인별 최적화 제안 생성
 */
/**
 * 체인별 최적화 제안 생성 (Notion 공식 문서 성능 가이드 반영)
 */
function _generateChainOptimizationTips(pathAnalysis, affectedRecords) {
    const tips = [];
    const depth = pathAnalysis.depth;
    
    // 체인 내 특정 유형 포함 여부 확인
    const hasFormula = pathAnalysis.path.some(node => node.type === 'formula');
    const hasRollup = pathAnalysis.path.some(node => node.type === 'rollup');

    // 1. 복잡한 참조 체인 단순화 (Avoid complex reference chains)
    if (depth >= 4) {
        tips.push({
            priority: 'high',
            title: '복잡한 참조 단순화',
            description: `현재 참조는 ${depth}단계로 구성되어 있습니다. Notion은 수식이 다른 수식이나 롤업을 중첩 참조할수록 데이터베이스 로딩 속도가 현저히 느려진다고 경고합니다.`,
            action: '불필요한 중간 수식/롤업 단계를 제거하고, 참조 구조를 최대한 단순화하세요.'
        });
    }

    // 2. 수식/롤업 필터링 및 정렬 최소화 (Minimize filters and sorts on formulas/rollups)
    if (hasFormula || hasRollup) {
        tips.push({
            priority: 'high',
            title: '수식/롤업 기반 필터링 및 정렬',
            description: '수식과 롤업으로 필터링하거나 정렬하면 로딩 시간이 길어질 수 있습니다.',
            action: '필터 및 정렬 기준을 선택, 상태, 숫자, 날짜 등의 단순 속성으로 변경하세요.'
        });
    }

    // 3. 수식 길이 및 복잡도 단축 (Shorten formula lengths)
    if (hasFormula && depth >= 3) {
        tips.push({
            priority: 'medium',
            title: '수식 길이 단축 및 최적화',
            description: '깊은 참조 체인 내에 수식이 포함되어 있습니다. 다중 참조 시 수식의 텍스트 길이가 길거나 중첩된 함수가 많으면 성능에 악영향을 줍니다.',
            action: '수식 속성에 사용 중인 수식을 간결하게 재작성하고, 불필요한 연산을 제거하여 한도를 초과하지 않도록 관리하세요.'
        });
    }

    // 4. 불필요한 중간 속성 숨기기 (Hide unnecessary properties)
    if (depth >= 3) {
        tips.push({
            priority: 'medium',
            title: '중간 계산용 속성 가시성 관리',
            description: '이 체인을 완성하기 위해 생성된 중간 도우미(Helper) 속성들이 표나 보기에 노출되어 있으면 렌더링 성능이 저하됩니다.',
            action: '최종 결과 표시에 중요하지 않은 중간 참조용 롤업 및 수식 속성들은 뷰에서 숨기기(Hide) 처리하세요.'
        });
    }

    // 5. 대규모 데이터 영향도 파악 및 뷰(View) 트래픽 분산 (Avoid high-traffic pages limits)
    if (affectedRecords > 100) {
        tips.push({
            priority: 'medium',
            title: '대량 데이터 연산 부하 및 렌더링 제한',
            description: `이 참조는 ${affectedRecords}개의 레코드에 걸쳐 계산됩니다. 처리할 페이지가 많을수록 성능 저하가 뚜렷해집니다.`,
            action: '생성 일시(Created time) 등의 단순 필터를 추가하여 한 화면에 렌더링되고 계산되는 데이터(페이지) 수를 줄이세요.'
        });
    }

    return tips;
}

/**
 * 깊은 참조 체인의 요약 통계 생성
 * ★ 새로 추가: 뷰 상단에 표시할 핵심 지표들
 */
function generateDeepChainsMetrics(deepChains = []) {
    if (!deepChains || deepChains.length === 0) {
        return {
            totalChains: 0,
            maxDepth: 0,
            totalAffectedRecords: 0,
            criticalCount: 0,
            warningCount: 0,
            infoCount: 0,
            avgDepth: 0,
            affectedDatabases: []
        };
    }

    const maxDepth = Math.max(...deepChains.map(c => c.depth));
    const totalAffectedRecords = deepChains.reduce((sum, c) => sum + c.affectedRecords, 0);
    const criticalCount = deepChains.filter(c => c.severity === 'critical').length;
    const warningCount = deepChains.filter(c => c.severity === 'warning').length;
    const infoCount = deepChains.filter(c => c.severity === 'info').length;
    const avgDepth = Math.round(deepChains.reduce((sum, c) => sum + c.depth, 0) / deepChains.length * 10) / 10;

    // 영향받는 dataBase 목록 수집 (중복 제거)
    const affectedDbSet = new Set();
    deepChains.forEach(chain => {
        if (chain.relatedDatabases) {
            chain.relatedDatabases.forEach(db => affectedDbSet.add(db));
        }
    });

    return {
        totalChains: deepChains.length,
        maxDepth: maxDepth,
        totalAffectedRecords: totalAffectedRecords,
        avgDepth: avgDepth,
        criticalCount: criticalCount,
        warningCount: warningCount,
        infoCount: infoCount,
        affectedDatabases: Array.from(affectedDbSet),
        affectedDatabasesCount: affectedDbSet.size
    };
}

/**
 * 종합 성능 분석 보고서
 */
function generatePerformanceReport(records, properties, propertyNames, columnStats = {}, referenceChains = []) {
    const performanceIssues = analyzePerformanceIssues(records, properties, propertyNames, referenceChains);
    const opportunities = evaluateOptimizationOpportunities(records, properties, propertyNames, columnStats);
    const sizeLimits = checkSizeLimits(records, properties, propertyNames);
    const deepReferenceChains = analyzeDeepReferenceChains(referenceChains, records);
    const deepChainsMetrics = generateDeepChainsMetrics(deepReferenceChains);  // ★ 요약 통계 생성

    return {
        timestamp: new Date().toISOString(),
        summary: {
            performanceScore: performanceIssues.score,
            performanceSeverity: performanceIssues.severity,
            sizeStatus: sizeLimits.status,
            optimizationOpportunitiesCount: opportunities.length,
            factorsCount: performanceIssues.factors.length,
            deepChainsCount: deepReferenceChains.length
        },
        performance: performanceIssues,
        opportunities: opportunities,
        limits: sizeLimits,
        deepReferenceChains: deepReferenceChains,
        deepChainsMetrics: deepChainsMetrics 
    };
}

module.exports = {
    analyzeDatabase,
    calculateQualityScore,
    analyzePerformanceIssues,
    evaluateOptimizationOpportunities,
    checkSizeLimits,
    generatePerformanceReport,
    analyzeDeepReferenceChains,
    generateDeepChainsMetrics  // ★ 새로 추가
};
