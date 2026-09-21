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
 * 문자열 리터럴을 동일한 길이의 공백으로 치환한다.
 * 직접 필드명 매칭이 리터럴 내부 텍스트(예: if(x == "Status")의 "Status")를
 * 실제 필드 참조로 오탐하지 않도록, 매칭 전에 리터럴을 제거하기 위한 전처리다.
 * 공백으로 치환해 문자 오프셋을 보존하므로 디버깅 시 원본 위치 추적이 쉽다.
 */
function _stripStringLiterals(expression) {
    return expression.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, match => ' '.repeat(match.length));
}

/**
 * 포뮬러 표현식에서 필드 참조 추출
 * block_property, prop(), 직접 필드명 세 가지 추출 전략을 모두 실행한 뒤 병합·중복 제거한다.
 * (이전에는 앞 전략이 하나라도 매치되면 뒤 전략을 건너뛰어, block_property와 prop()이
 * 한 수식에 혼용된 경우 참조가 누락되는 문제가 있었다.)
 */
function extractFieldReferencesFromFormula(
    expression,
    availableFieldNames,
    propertyIdMap = {},
    globalPropertyIdMap = {},
    debug = false
) {
    if (!expression || typeof expression !== 'string') return [];

    if (debug) {
        console.log(`${' '.repeat(10)}[extractFieldReferencesFromFormula]`);
        console.log(`${' '.repeat(12)}수식 길이: ${expression.length}자`);
        console.log(`${' '.repeat(12)}availableFieldNames: [${availableFieldNames.join(', ')}]`);
    }

    // 1. {{notion:block_property:...}} 패턴 분석 (원문 사용 — 리터럴과 무관한 고유 패턴)
    const blockPropertyReferences = _extractBlockPropertyReferences(
        expression,
        propertyIdMap,
        globalPropertyIdMap,
        availableFieldNames,
        debug
    );

    // 2. prop("필드명") 패턴 분석 (원문 사용 — 따옴표 자체가 문법의 일부)
    const propReferences = _extractPropReferences(expression, availableFieldNames, debug);

    // 3. 직접 필드명 참조 분석 (문자열 리터럴을 제거한 정제 텍스트 사용)
    const sanitizedExpression = _stripStringLiterals(expression);
    const directReferences = _extractDirectFieldReferences(sanitizedExpression, availableFieldNames, debug);

    const merged = [...new Set([...blockPropertyReferences, ...propReferences, ...directReferences])];

    if (debug) {
        console.log(`${' '.repeat(12)}결과(병합): [${merged.length > 0 ? merged.join(', ') : '없음'}]`);
    }

    return merged;
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
 * ★ 개선: 수식 본문에서 식별자를 뽑아 필드 목록과 대조하던 기존 방식은
 *   `[a-zA-Z0-9가-힣\s]`만 허용해 하이픈(-)/언더스코어(_)/숫자로 시작하는 필드명을
 *   매칭하지 못했다. 대신 "알려진 필드명을 본문에서 직접 탐색"하는 방식으로 뒤집어
 *   특수문자가 포함된 필드명도 지원한다. 긴 이름을 먼저 검사해 짧은 이름이
 *   긴 이름의 일부로 잘못 매칭되는 것을 방지한다(예: "Total"과 "Total Price").
 */
function _extractDirectFieldReferences(sanitizedExpression, availableFieldNames, debug) {
    const references = [];

    if (debug) {
        console.log(`${' '.repeat(12)}Step 3: 직접 필드명 참조 분석 (문자열 리터럴 제외)...`);
    }

    const sortedFieldNames = [...availableFieldNames]
        .filter(name => typeof name === 'string' && name.length > 0)
        .sort((a, b) => b.length - a.length);

    for (const fieldName of sortedFieldNames) {
        const escaped = fieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // 필드명 앞뒤가 문자/숫자/한글이 아니어야 온전한 단어 경계로 간주한다.
        const pattern = new RegExp(`(?<![\\w가-힣])${escaped}(?![\\w가-힣])`, 'u');

        if (pattern.test(sanitizedExpression)) {
            references.push(fieldName);
            if (debug) {
                console.log(`${' '.repeat(14)}✓ 추가: ${fieldName}`);
            }
        }
    }

    return references;
}

module.exports = {
    extractFieldReferencesFromFormula,
    generateAlternativeIds,
    _stripStringLiterals
};
