/**
 * 데이터 분석 서비스
 * 책임: 데이터베이스 분석 및 품질 점수 계산
 */

/**
 * 데이터베이스 전체 분석
 */
function analyzeDatabase(records, properties, propertyNames) {
    const totalRecords = records.length;
    const columnStats = {};

    // 각 컬럼별 통계 계산
    propertyNames.forEach(propKey => {
        const property = properties[propKey];
        const stats = _calculateColumnStats(property, propKey, records, totalRecords);
        columnStats[propKey] = stats;
    });

    // 전체 완성도 계산
    const overallCompleteness = _calculateOverallCompleteness(columnStats, propertyNames);

    // 성능 분석 리포트 생성
    const performanceReport = generatePerformanceReport(records, properties, propertyNames, columnStats);
    const performanceScore = performanceReport.summary.performanceScore;

    return {
        totalRecords,
        totalColumns: propertyNames.length,
        overallCompleteness,
        performanceScore: performanceScore,
        qualityScore: calculateQualityScore(overallCompleteness, propertyNames.length, performanceScore),
        columnStats,
        performanceAnalysis: {
            issues: performanceReport.performance,
            opportunities: performanceReport.opportunities,
            limits: performanceReport.limits
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
 * 종합 성능 분석 보고서
 */
function generatePerformanceReport(records, properties, propertyNames, columnStats = {}, referenceChains = []) {
    const performanceIssues = analyzePerformanceIssues(records, properties, propertyNames, referenceChains);
    const opportunities = evaluateOptimizationOpportunities(records, properties, propertyNames, columnStats);
    const sizeLimits = checkSizeLimits(records, properties, propertyNames);

    return {
        timestamp: new Date().toISOString(),
        summary: {
            performanceScore: performanceIssues.score,
            performanceSeverity: performanceIssues.severity,
            sizeStatus: sizeLimits.status,
            optimizationOpportunitiesCount: opportunities.length,
            factorsCount: performanceIssues.factors.length
        },
        performance: performanceIssues,
        opportunities: opportunities,
        limits: sizeLimits
    };
}

module.exports = {
    analyzeDatabase,
    calculateQualityScore,
    analyzePerformanceIssues,
    evaluateOptimizationOpportunities,
    checkSizeLimits,
    generatePerformanceReport
};
