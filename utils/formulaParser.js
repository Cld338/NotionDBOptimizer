/**
 * 수식 파싱 유틸리티
 * 책임: Notion 포뮬러 표현식 분석 및 참조 추출
 */

/**
 * block_property 참조용 대체 ID 생성
 * block_property의 ID 형식이 다양할 수 있으므로 모든 인코딩 시도
 */
function generateAlternativeIds(id) {
    const alternatives = [id]; // 원본은 항상 포함
    
    if (!id) return alternatives;
    
    // 1. URL decode (percent-encoded인 경우)
    try {
        const decoded = decodeURIComponent(id);
        if (decoded !== id) {
            alternatives.push(decoded);
        }
    } catch (e) {
        // 무시
    }
    
    // 2. URL encode (평문인 경우)
    try {
        const encoded = encodeURIComponent(id);
        if (encoded !== id) {
            alternatives.push(encoded);
        }
    } catch (e) {
        // 무시
    }
    
    // 3. Base64 encode/decode 시도
    try {
        const base64 = Buffer.from(id).toString('base64');
        if (base64 !== id) {
            alternatives.push(base64);
        }
        // Base64 decode도 시도
        try {
            const decoded = Buffer.from(id, 'base64').toString('utf8');
            if (decoded !== id && decoded.length > 0) {
                alternatives.push(decoded);
            }
        } catch (e) {
            // 무시
        }
    } catch (e) {
        // 무시
    }
    
    // 4. 짧은 형식: UUID의 첫 몇 글자 추출
    const uuidMatch = id.match(/^[a-f0-9]{8}-?/i);
    if (uuidMatch) {
        alternatives.push(uuidMatch[0].replace(/-/g, ''));
    }
    
    // 중복 제거
    return [...new Set(alternatives)];
}

/**
 * 포뮬러 표현식에서 필드 참조 추출
 * 우선순위: block_property → prop() → 직접 필드명
 */
function extractFieldReferencesFromFormula(
    expression, 
    availableFieldNames, 
    propertyIdMap = {}, 
    globalPropertyIdMap = {}, 
    debug = false
) {
    const references = [];
    
    if (!expression || typeof expression !== 'string') return references;

    if (debug) {
        console.log(`${' '.repeat(10)}[extractFieldReferencesFromFormula]`);
        console.log(`${' '.repeat(12)}수식 길이: ${expression.length}자`);
        console.log(`${' '.repeat(12)}availableFieldNames: [${availableFieldNames.join(', ')}]`);
    }

    // 1. {{notion:block_property:...}} 패턴 분석
    const blockPropertyReferences = _extractBlockPropertyReferences(
        expression,
        propertyIdMap,
        globalPropertyIdMap,
        availableFieldNames,
        debug
    );
    
    if (blockPropertyReferences.length > 0) {
        if (debug) {
            console.log(`${' '.repeat(12)}결과: [${blockPropertyReferences.join(', ')}] (block_property 우선)`);
        }
        return [...new Set(blockPropertyReferences)];
    }

    // 2. prop("필드명") 패턴 분석
    const propReferences = _extractPropReferences(expression, availableFieldNames, debug);
    
    if (propReferences.length > 0) {
        if (debug) {
            console.log(`${' '.repeat(12)}결과: [${propReferences.join(', ')}] (prop() 우선)`);
        }
        return [...new Set(propReferences)];
    }

    // 3. 직접 필드명 참조 분석
    const directReferences = _extractDirectFieldReferences(expression, availableFieldNames, debug);
    
    if (debug) {
        console.log(`${' '.repeat(12)}결과: [${directReferences.length > 0 ? directReferences.join(', ') : '없음'}]`);
    }

    return [...new Set(directReferences)];
}

/**
 * block_property 참조 추출
 * ★ 개선: 첫 번째 ID가 필드명일 수도 있는 경우를 처리
 */
function _extractBlockPropertyReferences(expression, propertyIdMap, globalPropertyIdMap, availableFieldNames, debug) {
    const blockPropertyPattern = /\{\{notion:block_property:([^:]+):[^:]+:([a-f0-9\-]+)\}\}/g;
    const references = [];
    let blockMatch;
    
    while ((blockMatch = blockPropertyPattern.exec(expression)) !== null) {
        const dbIdPart = blockMatch[1];        // 첫 번째 ID (DB ID 또는 필드명)
        const propertyIdPart = blockMatch[2]; // 두 번째 ID (UUID)
        
        let fieldName = null;
        let foundIn = '';
        
        // ★ 추가: 첫 번째 ID가 필드명인지 직접 확인 (가장 먼저 확인)
        if (availableFieldNames.includes(dbIdPart)) {
            fieldName = dbIdPart;
            foundIn = `direct fieldName match (dbIdPart)`;
        }
        // propertyIdMap에서 첫 번째 ID로 검색
        else if (propertyIdMap[dbIdPart]) {
            fieldName = propertyIdMap[dbIdPart];
            foundIn = `propertyIdMap[${dbIdPart}]`;
        } 
        // globalPropertyIdMap에서 첫 번째 ID로 검색
        else if (globalPropertyIdMap[dbIdPart]) {
            fieldName = globalPropertyIdMap[dbIdPart].fieldName;
            foundIn = `globalPropertyIdMap[${dbIdPart}]`;
        } 
        // propertyIdMap에서 두 번째 ID(UUID)로 검색
        else if (propertyIdMap[propertyIdPart]) {
            fieldName = propertyIdMap[propertyIdPart];
            foundIn = `propertyIdMap[${propertyIdPart}]`;
        } 
        // globalPropertyIdMap에서 두 번째 ID(UUID)로 검색
        else if (globalPropertyIdMap[propertyIdPart]) {
            fieldName = globalPropertyIdMap[propertyIdPart].fieldName;
            foundIn = `globalPropertyIdMap[${propertyIdPart}]`;
        }
        
        if (debug) {
            console.log(`${' '.repeat(12)}Step 1: block_property 발견`);
            console.log(`${' '.repeat(14)}ID1(dbIdPart): ${dbIdPart}, ID2(UUID): ${propertyIdPart}`);
            console.log(`${' '.repeat(14)}→ ${foundIn || '(찾기 실패)'}: ${fieldName || '없음'}`);
        }

        if (fieldName && availableFieldNames.includes(fieldName)) {
            references.push(fieldName);
            if (debug) {
                console.log(`${' '.repeat(14)}✓ 추가: ${fieldName}`);
            }
        } else if (debug && fieldName) {
            console.log(`${' '.repeat(14)}✗ 제외: ${fieldName} (availableFieldNames에 없음)`);
        } else if (debug && !fieldName) {
            console.log(`${' '.repeat(14)}✗ 필드명 추출 실패`);
        }
    }

    return references;
}

/**
 * prop("fieldName") 패턴 참조 추출
 */
function _extractPropReferences(expression, availableFieldNames, debug) {
    const propPattern = /prop\(['"]([^'"]+)['"]\)/g;
    const references = [];
    let match;
    
    const propMatches = [];
    while ((match = propPattern.exec(expression)) !== null) {
        propMatches.push(match[1]);
    }

    if (debug && propMatches.length > 0) {
        console.log(`${' '.repeat(12)}Step 2: prop() 발견: [${propMatches.join(', ')}]`);
    }

    propMatches.forEach(fieldName => {
        if (availableFieldNames.includes(fieldName)) {
            references.push(fieldName);
            if (debug) {
                console.log(`${' '.repeat(14)}✓ 추가: ${fieldName}`);
            }
        } else if (debug) {
            console.log(`${' '.repeat(14)}✗ 제외: ${fieldName}`);
        }
    });

    return references;
}

/**
 * 직접 필드명 참조 추출
 */
function _extractDirectFieldReferences(expression, availableFieldNames, debug) {
    const directPattern = /\b([a-zA-Z가-힣][a-zA-Z0-9가-힣\s]*)\b/g;
    const foundFieldNames = new Set();
    const references = [];
    
    // Notion 예약어
    const reserved = [
        'if', 'then', 'else', 'and', 'or', 'not', 'true', 'false', 
        'empty', 'add', 'subtract', 'multiply', 'divide', 'mod', 'pow', 
        'abs', 'floor', 'ceil', 'round', 'sqrt', 'length', 'contains', 
        'test', 'replace', 'slice', 'concat', 'join', 'split', 'reverse', 
        'sort', 'unique', 'flatten', 'max', 'min', 'sum', 'avg', 'count', 
        'countall', 'any', 'all', 'now', 'today', 'dateAdd', 'dateBetween', 
        'dateSubtract', 'formatDate', 'parseDate'
    ];
    
    if (debug) {
        console.log(`${' '.repeat(12)}Step 3: 직접 필드명 참조 분석...`);
    }

    let match;
    while ((match = directPattern.exec(expression)) !== null) {
        const fieldName = match[1].trim();
        
        if (!reserved.includes(fieldName.toLowerCase())) {
            foundFieldNames.add(fieldName);
        }
    }

    foundFieldNames.forEach(fieldName => {
        if (availableFieldNames.includes(fieldName)) {
            references.push(fieldName);
            if (debug) {
                console.log(`${' '.repeat(14)}✓ 추가: ${fieldName}`);
            }
        }
    });

    return references;
}

module.exports = {
    extractFieldReferencesFromFormula,
    generateAlternativeIds
};
