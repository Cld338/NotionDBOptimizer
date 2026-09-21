/**
 * 데이터 분석 서비스
 * 책임: 데이터베이스 통계 계산, 공식 Notion 리밋 대비 사용률 산출, 참조 체인 통계 집계
 *
 * 설계 원칙(재설계 시 적용):
 * - 근거 없는 매직넘버를 사용한 "점수"/"심각도"를 만들지 않는다.
 * - 남기는 기준은 두 가지뿐이다: (a) Notion 공식 문서에 실재하는 하드 리밋 대비 사용률,
 *   (b) 이 데이터베이스 자신의 분포에서 유도되는 통계적 기준(Tukey IQR).
 * - 데이터 품질(완전성/고유성/유효성/적시성)은 services/dataQualityService.js가 전담한다.
 */

const { iqrBounds, iqrOutliers } = require('../utils/statistics');
const { calculateDataQualityDimensions } = require('./dataQualityService');

// Notion 공식 문서에 실재하는 하드 리밋
// 출처: https://developers.notion.com/docs/working-with-databases ,
//       https://www.notion.com/help/optimize-database-load-times-and-performance
const OFFICIAL_LIMITS = {
    properties: 500,
    rows: 250000,
    pageSizeBytes: 2.5 * 1024 * 1024,
    dbStructureBytes: 1.5 * 1024 * 1024,
    relationRefs: 10000,
    schemaSizeBytes: 50 * 1024
};

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

    const dataQuality = calculateDataQualityDimensions(records, properties, propertyNames, analyzeColumnStats);
    const performanceReport = generatePerformanceReport(records, properties, propertyNames, analyzeColumnStats, referenceChains);

    return {
        totalRecords,
        totalColumns: propertyNames.length,
        columnStats: analyzeColumnStats,
        dataQuality,
        performanceAnalysis: performanceReport
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
 * select/multi_select/status 속성의 옵션 배열을 스키마에서 읽어온다.
 * ★ 버그 수정: 기존 코드는 prop.options를 직접 읽었으나, Notion 속성 스키마에서
 *   옵션은 prop.select.options / prop.multi_select.options / prop.status.options 에 있다.
 *   기존 방식으로는 select/multi_select 옵션 크기가 구조 크기 계산에 전혀 반영되지 않았다.
 */
function _getPropertyOptions(prop) {
    return prop?.select?.options || prop?.multi_select?.options || prop?.status?.options || null;
}

/**
 * 공식 하드 리밋 대비 사용률 계산
 * usagePercent >= 80/95 는 "일반적인 자원 사용률 관행"으로 warning/critical 표시하는 것이지,
 * Notion이 실제로 80%/95% 지점에서 무언가를 경고한다는 공식 근거는 아니다(주석으로 명시).
 */
function checkSizeLimits(records, properties, propertyNames) {
    // 1. 페이지 레벨 크기 추정 (속성 데이터만, 파일/본문 제외)
    let totalPageSize = 0;
    let maxPageSize = 0;
    records.forEach(record => {
        let recordSize = 0;
        propertyNames.forEach(propKey => {
            const value = record.properties?.[propKey];
            if (value) {
                recordSize += JSON.stringify(value).length;
            }
        });
        totalPageSize += recordSize;
        if (recordSize > maxPageSize) maxPageSize = recordSize;
    });
    const avgPageSize = records.length > 0 ? totalPageSize / records.length : 0;

    // 2. 데이터베이스 구조(스키마) 크기 추정 (속성 정의 + 선택 옵션 포함)
    let dbStructureSize = 0;
    Object.values(properties).forEach(prop => {
        dbStructureSize += JSON.stringify(prop).length;
        const options = _getPropertyOptions(prop);
        if (options) {
            options.forEach(opt => {
                dbStructureSize += JSON.stringify(opt).length;
            });
        }
    });

    // 3. 관계형 필드 참조 수
    let totalRelations = 0;
    let maxRelationsPerPage = 0;
    records.forEach(record => {
        let recordRelationCount = 0;
        Object.entries(properties).forEach(([key, prop]) => {
            if (prop.type === 'relation' && record.properties?.[key]) {
                const count = Array.isArray(record.properties[key])
                    ? record.properties[key].length
                    : (record.properties[key] ? 1 : 0);
                totalRelations += count;
                recordRelationCount += count;
            }
        });
        if (recordRelationCount > maxRelationsPerPage) maxRelationsPerPage = recordRelationCount;
    });

    const hardLimits = {
        properties: _usage(propertyNames.length, OFFICIAL_LIMITS.properties),
        rows: _usage(records.length, OFFICIAL_LIMITS.rows),
        pageSize: _usage(maxPageSize, OFFICIAL_LIMITS.pageSizeBytes, { avg: avgPageSize, max: maxPageSize }),
        dbStructure: _usage(dbStructureSize, OFFICIAL_LIMITS.dbStructureBytes),
        relationRefs: _usage(maxRelationsPerPage, OFFICIAL_LIMITS.relationRefs, { totalReferences: totalRelations }),
        schemaSize: _usage(dbStructureSize, OFFICIAL_LIMITS.schemaSizeBytes)
    };

    const warnings = [];
    Object.entries(hardLimits).forEach(([key, limitInfo]) => {
        if (limitInfo.level !== 'ok') {
            warnings.push({ type: key, level: limitInfo.level, current: limitInfo.current, limit: limitInfo.limit, usagePercent: limitInfo.usagePercent });
        }
    });

    return { hardLimits, warnings };
}

function _usage(current, limit, extra = {}) {
    const usagePercent = limit > 0 ? Math.round((current / limit) * 1000) / 10 : 0;
    let level = 'ok';
    if (usagePercent >= 95) level = 'critical';
    else if (usagePercent >= 80) level = 'warning';
    return { current, limit, usagePercent, level, ...extra };
}

/**
 * 공식 리밋이 없는 지표는 severity/score 없이 순수 수치로만 제공한다.
 * chainDepths는 analyzeDeepReferenceChains가 이미 계산한 실제 최장 경로 깊이 목록이다
 * (referenceChains 원본 항목에는 깊이 정보가 없으므로 재계산하지 않고 그대로 전달받는다).
 */
function getInformationalMetrics(records, properties, propertyNames, chainDepths = []) {
    const recordCount = records.length;
    const propertyCount = propertyNames.length;
    const formulaRollupCount = Object.values(properties).filter(p => p.type === 'formula' || p.type === 'rollup').length;
    const relationCount = Object.values(properties).filter(p => p.type === 'relation').length;

    const outlierChains = iqrOutliers(chainDepths);

    return {
        recordCount,
        propertyCount,
        formulaRollupCount,
        relationCount,
        chainDepthStats: {
            max: chainDepths.length > 0 ? Math.max(...chainDepths) : 0,
            median: chainDepths.length > 0 ? _median(chainDepths) : 0,
            outlierChainCount: outlierChains.length
        },
        note: 'Notion 공식 성능 임계값이 존재하지 않는 지표이므로 참고용으로만 제공됩니다.'
    };
}

function _median(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * 최적화 기회 평가
 * 절대 기준(예: "완성도 30% 미만") 대신, 이 데이터베이스 자신의 컬럼 완성도 분포에서
 * Tukey IQR로 유도되는 하한(lowerFence)을 밑도는 컬럼만 "저활용"으로 식별한다.
 * 컬럼 수가 적어 IQR이 통계적으로 불안정한 경우(iqrOutliers가 빈 배열)에는 플래그를 만들지 않는다.
 */
function evaluateOptimizationOpportunities(records, properties, propertyNames, columnStats = {}) {
    const opportunities = [];

    const entries = Object.entries(columnStats);
    const completenessValues = entries.map(([, stats]) => stats.completeness);
    const outlierIndices = new Set(iqrOutliers(completenessValues));

    entries.forEach(([propKey, stats], idx) => {
        if (outlierIndices.has(idx) && stats.completeness < iqrBounds(completenessValues).q1) {
            opportunities.push({
                priority: 'medium',
                difficulty: 'low',
                type: 'unused_property',
                property: stats.name || propKey,
                title: '저활용도 속성',
                current_fill_rate: stats.completeness,
                description: `이 속성의 채움률(${stats.completeness}%)은 이 데이터베이스의 다른 속성들과 비교했을 때 통계적으로 이상치에 해당합니다.`,
                benefit: '불필요한 속성을 제거하면 로딩 성능이 개선됩니다',
                action: '이 속성이 정말 필요한지 확인 후 불필요하면 제거하세요'
            });
        }
    });

    // Formula 필드 사전 계산 기회: 이 DB 자신의 완성도 분포에서 상위 25%(Q3 이상)에 속하는 formula만 대상
    const { q3 } = iqrBounds(completenessValues);
    Object.entries(properties).forEach(([propKey, prop]) => {
        if (prop.type === 'formula' && prop.formula?.expression) {
            const stats = columnStats[propKey];
            if (stats && stats.completeness >= q3 && completenessValues.length >= 4) {
                opportunities.push({
                    priority: 'low',
                    difficulty: 'medium',
                    type: 'formula_optimization',
                    property: prop.name || propKey,
                    title: 'Formula 최적화 기회',
                    description: '이 Formula 속성의 채움률은 이 데이터베이스 내 상위 25%에 해당합니다. 자주 사용되는 값을 사전 계산하면 성능이 개선될 수 있습니다.',
                    benefit: '실시간 계산 부하 감소',
                    action: '이 필드의 사용 패턴을 분석하고 필요시 자동화를 고려하세요'
                });
            }
        }
    });

    // 필터링 최적화: select/status/multi_select(필터 비용이 낮은 타입) 수보다
    // relation/formula/rollup(필터 비용이 높은 타입) 수가 많은지 비교(자기 자신과의 상대 비교, 절대 비율 아님)
    const simpleFilterCount = Object.values(properties).filter(p =>
        p.type === 'select' || p.type === 'multi_select' || p.type === 'status'
    ).length;
    const expensiveFilterCount = Object.values(properties).filter(p =>
        p.type === 'relation' || p.type === 'formula' || p.type === 'rollup'
    ).length;

    if (expensiveFilterCount > simpleFilterCount) {
        opportunities.push({
            difficulty: 'low',
            priority: 'high',
            type: 'filtering_optimization',
            title: '필터링 성능 최적화',
            description: `현재 필터링 비용이 높은 속성(관계/수식/롤업, ${expensiveFilterCount}개)이 비용이 낮은 속성(선택/상태, ${simpleFilterCount}개)보다 많습니다.`,
            benefit: '선택/상태 기반 필터링이 Formula/Rollup/Relation 필터링보다 훨씬 빠릅니다',
            action: '가능한 한 Select, Status, 숫자, 날짜 등 단순 속성으로 필터링하세요'
        });
    }

    return opportunities;
}

/**
 * 깊은 참조 체인 분석
 * 트리의 실제 최장 경로를 계산하고, 순환 참조는 별도(cyclicChains)로 분리한다.
 */
function analyzeDeepReferenceChains(referenceChains = [], records = []) {
    const rawChains = [];

    referenceChains.forEach(chainItem => {
        if (!chainItem.tree) return;

        const pathAnalysis = _extractChainPath(chainItem.tree, chainItem.sourceDb, chainItem.sourceField, chainItem.sourceType);
        // depth < 2는 "참조가 전혀 없는" 소스 필드 자신뿐인 경우 — buildReferenceChains가
        // 이미 children이 있는 트리만 넘기므로 구조적으로 거의 발생하지 않지만 방어적으로 제외한다.
        if (!pathAnalysis || pathAnalysis.depth < 2) return;

        const relatedDatabases = _extractDatabasesFromPath(pathAnalysis.path);

        rawChains.push({
            depth: pathAnalysis.depth,
            sourceDb: chainItem.sourceDb,
            sourceField: chainItem.sourceField,
            sourceDbId: chainItem.sourceDbId,
            sourceType: chainItem.sourceType,
            path: pathAnalysis.path,
            tree: chainItem.tree,
            // 이 체인이 통과하는 소스 DB의 전체 레코드 수(상한 추정치).
            // 경로상의 각 레코드가 실제로 값을 가지는지까지는 계산하지 않는다.
            affectedRecords: records.length,
            hasCycle: !!chainItem.hasCycle,
            cyclePaths: chainItem.cyclePaths || [],
            relatedDatabases,
            _pathDetails: pathAnalysis
        });
    });

    rawChains.sort((a, b) => (b.depth - a.depth) || (b.affectedRecords - a.affectedRecords));

    // ★ 버그 수정: _filterIncludedChains는 "A-B-C-D가 있으면 B-C-D는 제외"하는 DAG 전제의
    // 중복 제거 로직이다. 순환 참조(A↔B)에 이를 그대로 적용하면 A의 경로에 B가 포함되고
    // B의 경로에도 A가 포함되어, 서로가 서로를 "포함된 하위 경로"로 오인해 둘 다 사라져버린다
    // (순환 참조 탐지 기능 자체가 무력화됨). 따라서 순환 체인은 이 필터에서 제외하고,
    // 대신 동일한 순환을 가리키는 여러 시작점을 하나로만 병합해서 보여준다.
    const cyclicRaw = rawChains.filter(c => c.hasCycle);
    const nonCyclicRaw = rawChains.filter(c => !c.hasCycle);

    const deepReferenceChains = _filterIncludedChains(nonCyclicRaw);
    const cyclicChains = _dedupeCyclicChains(cyclicRaw);

    const depths = deepReferenceChains.map(c => c.depth);
    const outlierIndexSet = new Set(iqrOutliers(depths));
    deepReferenceChains.forEach((chain, idx) => {
        chain.isDepthOutlier = outlierIndexSet.has(idx);
        chain.optimizationTips = _generateChainOptimizationTips(chain._pathDetails, chain.affectedRecords, false, chain.isDepthOutlier);
        delete chain._pathDetails;
    });
    cyclicChains.forEach(chain => {
        chain.optimizationTips = _generateChainOptimizationTips(chain._pathDetails, chain.affectedRecords, true, true);
        delete chain._pathDetails;
    });

    return { deepReferenceChains, cyclicChains };
}

/**
 * 트리에서 실제 최장 경로와 깊이를 계산한다 (post-order).
 * ★ 버그 수정: 기존에는 currentNode.children[0](첫 자식)만 따라가며 "깊이"를 계산해
 *   실제 최장 경로가 아니라 트리 구성 순서상 우연히 먼저 온 가지를 보고했다.
 *   이제 모든 자식을 재귀 탐색해 depth가 최대인 가지를 선택한다.
 *   순환(cycle) 또는 깊이 제한(truncated) 노드는 그 지점에서 경로가 끊긴 것으로 처리하고,
 *   더 깊이 진행하지 않되 해당 사실은 경로에 남긴다.
 */
function _extractChainPath(treeNode, sourceDb, sourceField, sourceType) {
    if (!treeNode) return null;

    // treeNode 자신은 이미 sourceField를 나타내므로(트리 루트 = 소스 노드),
    // 경로에 중복 포함하지 않고 treeNode의 자식들부터 최장 가지를 탐색한다.
    function longestBranch(node) {
        const children = (node.children || []).filter(c => !c.cycle);
        if (children.length === 0) {
            return { depth: 0, path: [] };
        }

        let best = { depth: 0, path: [] };
        for (const child of children) {
            const childEntry = {
                db: child.db,
                field: child.fieldName,
                type: child.type,
                referencedProperty: child.referencedProperty || undefined,
                truncated: child.truncated || undefined
            };
            const childSub = longestBranch(child);
            const candidateDepth = 1 + childSub.depth;
            if (candidateDepth > best.depth) {
                best = { depth: candidateDepth, path: [childEntry, ...childSub.path] };
            }
        }
        return best;
    }

    const sourceEntry = { db: sourceDb, field: sourceField, type: sourceType };
    const rest = longestBranch(treeNode);

    let path = [sourceEntry, ...rest.path];
    let depth = 1 + rest.depth;

    // 최장 경로의 마지막 노드에 referencedProperty가 있으면 최종 참조 필드도 경로에 추가
    const lastNode = path[path.length - 1];
    if (lastNode && lastNode.referencedProperty) {
        // treeNode를 다시 순회해 마지막 노드에 대응하는 referencedPropertyDb를 찾는다
        const terminal = _findTerminalNode(treeNode, path);
        if (terminal && terminal.referencedProperty && terminal.referencedPropertyDb) {
            path = [...path, { db: terminal.referencedPropertyDb, field: terminal.referencedProperty, type: 'referenced' }];
            depth++;
        }
    }

    return { path, depth, chainLength: depth };
}

/**
 * 최장 경로의 마지막 노드(원본 트리 노드 객체)를 찾는다(referencedPropertyDb 조회용).
 */
function _findTerminalNode(treeNode, path) {
    let current = treeNode;
    // path[0]은 sourceField 자신이므로 path[1]부터 트리 노드와 대응
    for (let i = 1; i < path.length; i++) {
        const target = path[i];
        const next = (current.children || []).find(c => c.db === target.db && c.fieldName === target.field);
        if (!next) return current;
        current = next;
    }
    return current;
}

/**
 * 경로에서 데이터베이스 리스트 추출 (중복 제거)
 */
function _extractDatabasesFromPath(path) {
    const dbSet = new Set();
    path.forEach(node => {
        if (node.db) dbSet.add(node.db);
    });
    return Array.from(dbSet);
}

/**
 * 깊은 참조 체인에서 하위 경로 필터링
 * A - B - C - D가 있으면 B - C - D는 제외 (중복 표시 방지 — 임계값이 아닌 구조적 중복 제거)
 */
function _filterIncludedChains(chains) {
    const allIncludedStartNodes = new Set();

    chains.forEach(chain => {
        if (chain.path && chain.path.length > 1) {
            for (let i = 1; i < chain.path.length; i++) {
                const node = chain.path[i];
                allIncludedStartNodes.add(`${node.db}|${node.field}`);
            }
        }
    });

    return chains.filter(chain => !allIncludedStartNodes.has(`${chain.sourceDb}|${chain.sourceField}`));
}

/**
 * 동일한 순환 참조를 가리키는 여러 시작점(A→B→A와 B→A→B는 같은 순환)을 하나로 합친다.
 * 순환에 관여하는 노드 집합을 정규화한 서명으로 중복을 판정한다.
 */
function _dedupeCyclicChains(cyclicChains) {
    const seenSignatures = new Set();
    const result = [];

    cyclicChains.forEach(chain => {
        const nodeKeys = new Set();
        (chain.cyclePaths || []).forEach(cyclePath => {
            cyclePath.forEach(key => nodeKeys.add(key));
        });
        const signature = Array.from(nodeKeys).sort().join('|');

        if (signature && seenSignatures.has(signature)) return;
        if (signature) seenSignatures.add(signature);
        result.push(chain);
    });

    return result;
}

/**
 * 체인별 최적화 제안 생성 (Notion 공식 문서 성능 가이드 반영)
 * priority는 절대 깊이 임계값이 아니라 순환 여부(hasCycle)와, 이 데이터베이스 내에서
 * 통계적으로 이상치인 깊이인지(isOutlier) 여부로만 결정한다.
 */
function _generateChainOptimizationTips(pathAnalysis, affectedRecords, hasCycle, isOutlier) {
    const tips = [];
    const depth = pathAnalysis.depth;
    const hasFormula = pathAnalysis.path.some(node => node.type === 'formula');
    const hasRollup = pathAnalysis.path.some(node => node.type === 'rollup');

    if (hasCycle) {
        tips.push({
            priority: 'high',
            title: '순환 참조 해소 필요',
            description: `이 체인은 자기 자신을 다시 참조하는 순환 구조를 포함합니다. Notion은 순환 참조가 있는 수식/롤업의 값을 안정적으로 계산할 수 없습니다.`,
            action: '순환을 이루는 필드 중 하나의 참조 대상을 변경하거나, 별도의 정적 값을 사용하도록 재구성하세요.'
        });
    }

    tips.push({
        priority: isOutlier ? 'high' : 'medium',
        title: '참조 체인 단순화',
        description: `현재 참조는 ${depth}단계로 구성되어 있습니다${isOutlier ? ' (이 데이터베이스 내에서 통계적으로 이례적으로 깊은 체인입니다)' : ''}. Notion은 수식이 다른 수식이나 롤업을 중첩 참조할수록 데이터베이스 로딩 속도가 느려진다고 안내합니다.`,
        action: '불필요한 중간 수식/롤업 단계를 제거하고, 참조 구조를 최대한 단순화하세요.'
    });

    if (hasFormula || hasRollup) {
        tips.push({
            priority: 'medium',
            title: '수식/롤업 기반 필터링 및 정렬',
            description: '수식과 롤업으로 필터링하거나 정렬하면 로딩 시간이 길어질 수 있습니다.',
            action: '필터 및 정렬 기준을 선택, 상태, 숫자, 날짜 등의 단순 속성으로 변경하세요.'
        });
    }

    tips.push({
        priority: 'low',
        title: '중간 계산용 속성 가시성 관리',
        description: '이 체인을 완성하기 위해 생성된 중간 도우미(Helper) 속성들이 표나 보기에 노출되어 있으면 렌더링 성능이 저하됩니다.',
        action: '최종 결과 표시에 중요하지 않은 중간 참조용 롤업 및 수식 속성들은 뷰에서 숨기기(Hide) 처리하세요.'
    });

    return tips;
}

/**
 * 깊은 참조 체인의 요약 통계 생성
 */
function generateDeepChainsMetrics(deepReferenceChains = [], cyclicChains = []) {
    const allChains = [...deepReferenceChains, ...cyclicChains];

    if (allChains.length === 0) {
        return {
            totalChains: 0,
            maxDepth: 0,
            totalAffectedRecords: 0,
            avgDepth: 0,
            cyclicCount: 0,
            depthOutlierCount: 0,
            affectedDatabases: [],
            affectedDatabasesCount: 0
        };
    }

    const maxDepth = Math.max(...allChains.map(c => c.depth));
    const totalAffectedRecords = allChains.reduce((sum, c) => sum + c.affectedRecords, 0);
    const avgDepth = Math.round((allChains.reduce((sum, c) => sum + c.depth, 0) / allChains.length) * 10) / 10;
    const depthOutlierCount = deepReferenceChains.filter(c => c.isDepthOutlier).length;

    const affectedDbSet = new Set();
    allChains.forEach(chain => {
        (chain.relatedDatabases || []).forEach(db => affectedDbSet.add(db));
    });

    return {
        totalChains: allChains.length,
        maxDepth,
        totalAffectedRecords,
        avgDepth,
        cyclicCount: cyclicChains.length,
        depthOutlierCount,
        affectedDatabases: Array.from(affectedDbSet),
        affectedDatabasesCount: affectedDbSet.size
    };
}

/**
 * 종합 성능 분석 보고서
 */
function generatePerformanceReport(records, properties, propertyNames, columnStats = {}, referenceChains = []) {
    const { hardLimits, warnings } = checkSizeLimits(records, properties, propertyNames);
    const opportunities = evaluateOptimizationOpportunities(records, properties, propertyNames, columnStats);
    const { deepReferenceChains, cyclicChains } = analyzeDeepReferenceChains(referenceChains, records);
    const deepChainsMetrics = generateDeepChainsMetrics(deepReferenceChains, cyclicChains);
    const chainDepths = [...deepReferenceChains, ...cyclicChains].map(c => c.depth);
    const informational = getInformationalMetrics(records, properties, propertyNames, chainDepths);

    return {
        timestamp: new Date().toISOString(),
        hardLimits,
        warnings,
        informational,
        opportunities,
        deepReferenceChains,
        cyclicChains,
        deepChainsMetrics
    };
}

module.exports = {
    analyzeDatabase,
    checkSizeLimits,
    getInformationalMetrics,
    evaluateOptimizationOpportunities,
    generatePerformanceReport,
    analyzeDeepReferenceChains,
    generateDeepChainsMetrics,
    _extractChainPath
};
