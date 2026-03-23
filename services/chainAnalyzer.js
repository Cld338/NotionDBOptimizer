/**
 * 참조 체인 분석 서비스
 * 책임: 데이터베이스 간 참조 체인 추적 및 분석
 */

const { extractFieldReferencesFromFormula } = require('../utils/formulaParser');

/**
 * 모든 데이터베이스의 참조 트리 분석
 */
function buildReferenceChains(
    dbPropertiesMap, 
    propertyIdMapByDb, 
    propertyNameMapByDb, 
    globalPropertyIdMap, 
    debug = false
) {
    const referenceTree = [];
    const processedFields = new Set();

    // propertyIdMap 생성 시 디버그 로깅
    if (debug) {
        _logPropertyMapsDebug(dbPropertiesMap, propertyIdMapByDb, globalPropertyIdMap);
    }

    // 각 DB의 각 필드에 대해 참조 트리 생성
    for (const [dbId, dbInfo] of dbPropertiesMap.entries()) {
        const properties = dbInfo.properties;
        
        for (const prop of properties) {
            // Rollup 또는 Formula 필드만 시작점
            if (prop.type !== 'rollup' && prop.type !== 'formula') {
                continue;
            }

            const fieldKey = `${dbId}|${prop.name}`;
            if (processedFields.has(fieldKey)) continue;
            processedFields.add(fieldKey);

            if (debug) {
                console.log(`\n🌳 [buildReferenceChains] 시작: ${dbInfo.databaseTitle} > ${prop.name} (${prop.type})`);
            }

            // 참조 트리 생성
            const visited = new Set();
            const treeRoot = _createTreeNode(
                dbId,
                prop,
                prop.name,
                dbPropertiesMap,
                propertyIdMapByDb,
                propertyNameMapByDb,
                globalPropertyIdMap,
                visited,
                0,
                10,
                debug
            );
            
            // 트리에 자식이 있으면 저장 (최소 1단계 이상의 참조가 있어야 함)
            if (treeRoot && (treeRoot.children.length > 0 || _hasAnyReferences(treeRoot))) {
                referenceTree.push({
                    sourceDb: dbInfo.databaseTitle,
                    sourceField: prop.name,
                    sourceDbId: dbId,
                    sourceType: prop.type,
                    tree: treeRoot
                });

                if (debug) {
                    console.log(`   ✓ 트리 저장: ${_countTreeNodes(treeRoot)}개 노드`);
                }
            } else if (debug) {
                console.log(`   ✗ 트리 미저장: 참조 없음`);
            }
        }
    }

    if (debug) {
        console.log(`\n📊 [buildReferenceChains] 최종 결과: ${referenceTree.length}개의 참조 트리 발견\n`);
    }

    return referenceTree;
}

/**
 * 재귀적으로 참조 트리 노드 생성
 */
function _createTreeNode(
    dbId,
    property,
    fieldName,
    dbPropertiesMap,
    propertyIdMapByDb = new Map(),
    propertyNameMapByDb = new Map(),
    globalPropertyIdMap = {},
    visited = new Set(),
    depth = 0,
    maxDepth = 10,
    debug = false
) {
    const indent = '  '.repeat(depth);
    
    if (debug) {
        console.log(`${indent}└─ [depth=${depth}] createTreeNode(${fieldName})`);
    }
    
    if (depth > maxDepth) {
        if (debug) {
            console.log(`${indent}   ⚠️  maxDepth 초과`);
        }
        return null;
    }

    const visitKey = `${dbId}|${fieldName}`;
    if (visited.has(visitKey)) {
        if (debug) {
            console.log(`${indent}   ⚠️  순환 참조 감지`);
        }
        return null;
    }

    visited.add(visitKey);

    // 현재 노드 정보 생성
    const dbInfo = dbPropertiesMap.get(dbId);
    const node = {
        db: dbInfo?.databaseTitle || 'Unknown',
        dbId: dbId,
        fieldName: fieldName,
        fieldType: property.type,
        type: property.type === 'rollup' ? 'rollup' : property.type === 'formula' ? 'formula' : 'unknown',
        referencedProperty: property.referencedProperty || null,
        referencedPropertyDb: null,
        referencedPropertyDbId: null,
        aggregationFunction: property.aggregationFunction || null,
        expression: property.type === 'formula' && property.expression ? property.expression : null,
        children: []  // ★ 트리의 자식 노드들
    };

    // Rollup인 경우 참조된 필드의 DB 정보 추가
    if (property.type === 'rollup' && property.referencedDatabaseId) {
        const refDbInfo = dbPropertiesMap.get(property.referencedDatabaseId);
        if (refDbInfo) {
            node.referencedPropertyDb = refDbInfo.databaseTitle;
            node.referencedPropertyDbId = property.referencedDatabaseId;
        }
    }

    if (debug) {
        console.log(`${indent}   ✓ 노드 생성: ${fieldName} (${property.type})`);
    }

    // Rollup 필드 처리
    if (property.type === 'rollup' && property.referencedDatabaseId) {
        _traceRollupFieldTree(
            property,
            dbPropertiesMap,
            node,
            visited,
            depth,
            maxDepth,
            propertyIdMapByDb,
            propertyNameMapByDb,
            globalPropertyIdMap,
            debug,
            indent
        );
    }
    // Formula 필드 처리
    else if (property.type === 'formula' && property.expression) {
        _traceFormulaFieldTree(
            dbId,
            property,
            dbPropertiesMap,
            node,
            visited,
            depth,
            maxDepth,
            propertyIdMapByDb,
            propertyNameMapByDb,
            globalPropertyIdMap,
            debug,
            indent
        );
    }

    return node;
}

/**
 * Rollup 필드 트리 추적
 */
function _traceRollupFieldTree(
    property,
    dbPropertiesMap,
    parentNode,
    visited,
    depth,
    maxDepth,
    propertyIdMapByDb,
    propertyNameMapByDb,
    globalPropertyIdMap,
    debug,
    indent
) {
    if (debug) {
        console.log(`${indent}   🔍 Rollup 분석: referencedProperty=${property.referencedProperty}`);
    }

    const refDbInfo = dbPropertiesMap.get(property.referencedDatabaseId);
    if (refDbInfo && property.referencedProperty) {
        const refProp = refDbInfo.properties.find(p => p.name === property.referencedProperty);
        if (refProp) {
            if (debug) {
                console.log(`${indent}   ✓ 참조 필드 찾음: ${property.referencedProperty} (${refProp.type})`);
            }

            // Rollup이나 Formula인 경우만 계속 추적
            if (refProp.type === 'rollup' || refProp.type === 'formula') {
                if (debug) {
                    console.log(`${indent}   → 재귀: ${property.referencedProperty}는 ${refProp.type}이므로 계속 추적`);
                }

                const childNode = _createTreeNode(
                    property.referencedDatabaseId,
                    refProp,
                    property.referencedProperty,
                    dbPropertiesMap,
                    propertyIdMapByDb,
                    propertyNameMapByDb,
                    globalPropertyIdMap,
                    visited,
                    depth + 1,
                    maxDepth,
                    debug
                );

                if (childNode) {
                    parentNode.children.push(childNode);
                }
            } else if (debug) {
                console.log(`${indent}   → 종료: ${property.referencedProperty}는 ${refProp.type} (추적 안 함)`);
            }
        } else if (debug) {
            console.log(`${indent}   ✗ 참조 필드 못 찾음: ${property.referencedProperty}`);
        }
    } else if (debug) {
        console.log(`${indent}   ✗ 참조 DB 정보 없음`);
    }
}

/**
 * Formula 필드 트리 추적
 * ★ 중요: 하나의 Formula가 여러 필드를 참조할 때 각각을 자식 노드로 추가
 */
function _traceFormulaFieldTree(
    dbId,
    property,
    dbPropertiesMap,
    parentNode,
    visited,
    depth,
    maxDepth,
    propertyIdMapByDb,
    propertyNameMapByDb,
    globalPropertyIdMap,
    debug,
    indent
) {
    if (debug) {
        console.log(`${indent}   🔍 Formula 분석: expression="${property.expression.substring(0, 50)}..."`);
    }

    const dbInfo = dbPropertiesMap.get(dbId);
    const availableFieldNames = dbInfo?.properties.map(p => p.name) || [];
    const propertyIdMap = propertyIdMapByDb.get(dbId) || {};

    const fieldReferences = extractFieldReferencesFromFormula(
        property.expression,
        availableFieldNames,
        propertyIdMap,
        globalPropertyIdMap,
        debug
    );

    if (debug) {
        console.log(`${indent}   ✓ 참조 필드: [${fieldReferences.join(', ')}]`);
    }

    // ★ 모든 참조 필드를 자식 노드로 추가 (트리의 브랜치 형성)
    // ★ 개선: rollup/formula 뿐 아니라 모든 필드 타입을 포함
    //   - title, name 등의 필드도 참조 관계에 포함
    //   - leaf 노드로 자동 처리됨 (더 이상 재귀하지 않음)
    for (const refFieldName of fieldReferences) {
        const refProp = dbInfo?.properties.find(p => p.name === refFieldName);

        if (refProp) {
            if (debug) {
                console.log(`${indent}   → 브랜치: ${refFieldName} (${refProp.type})`);
            }

            const childNode = _createTreeNode(
                dbId,
                refProp,
                refFieldName,
                dbPropertiesMap,
                propertyIdMapByDb,
                propertyNameMapByDb,
                globalPropertyIdMap,
                visited,
                depth + 1,
                maxDepth,
                debug
            );

            if (childNode) {
                parentNode.children.push(childNode);
            }
        } else if (debug) {
            console.log(`${indent}   ✗ 필드 없음: ${refFieldName}`);
        }
    }
}

/**
 * PropertyMap 디버그 로깅
 */
function _logPropertyMapsDebug(dbPropertiesMap, propertyIdMapByDb, globalPropertyIdMap) {
    for (const [dbId, dbInfo] of dbPropertiesMap.entries()) {
        const propertyIdMap = propertyIdMapByDb.get(dbId) || {};
        const entries = Object.entries(propertyIdMap);
        
        console.log(`\n🔑 [propertyIdMap 생성] ${dbInfo.databaseTitle}`);
        console.log(`   총 속성 수: ${dbInfo.properties?.length || 0}`);
        console.log(`   매핑 수: ${entries.length}개`);
        
        if (entries.length > 0) {
            console.log(`   📋 매핑 예시 (처음 3개):`);
            entries.slice(0, 3).forEach(([key, fieldName]) => {
                const keyPreview = key.length > 20 ? key.substring(0, 8) + '...' : key;
                console.log(`     ${keyPreview} → ${fieldName}`);
            });
            if (entries.length > 3) {
                console.log(`     ... (${entries.length - 3}개 더)`);
            }
        }
    }
}

/**
 * 트리 노드의 총 개수 계산
 */
function _countTreeNodes(node) {
    if (!node) return 0;
    let count = 1;
    if (node.children && Array.isArray(node.children)) {
        for (const child of node.children) {
            count += _countTreeNodes(child);
        }
    }
    return count;
}

/**
 * 트리에 참조가 있는지 확인
 */
function _hasAnyReferences(node) {
    if (!node) return false;
    return node.children && node.children.length > 0;
}

/**
 * 트리를 문자열로 시각화 (디버깅용)
 */
function visualizeReferenceTree(treeItem, depth = 0) {
    const indent = '  '.repeat(depth);
    let output = `${indent}🌳 ${treeItem.sourceDb} > ${treeItem.sourceField} (${treeItem.sourceType})\n`;
    
    function printNode(node, nodeDepth = 1) {
        const nodeIndent = '  '.repeat(nodeDepth);
        const symbol = nodeDepth === 1 ? '├─' : '│ ';
        output += `${nodeIndent}${symbol} [${node.fieldType}] ${node.fieldName} (${node.db})\n`;
        
        if (node.children && node.children.length > 0) {
            node.children.forEach((child, idx) => {
                printNode(child, nodeDepth + 1);
            });
        }
    }
    
    if (treeItem.tree) {
        printNode(treeItem.tree);
    }
    
    return output;
}

module.exports = {
    buildReferenceChains,
    visualizeReferenceTree,
    _countTreeNodes,
    _hasAnyReferences
};
