/**
 * formulaParser.test.js
 * TDD 테스트: Notion 포뮬러 파싱 유틸리티
 */

const {
    generateAlternativeIds,
    extractFieldReferencesFromFormula
} = require('../utils/formulaParser');

describe('generateAlternativeIds', () => {
    test('빈 ID는 빈 배열과 원본만 반환', () => {
        const result = generateAlternativeIds('');
        expect(result).toContain('');
    });

    test('null ID는 null만 포함된 배열 반환', () => {
        const result = generateAlternativeIds(null);
        expect(result).toContain(null);
    });

    test('원본 ID는 항상 포함', () => {
        const id = 'test-id-123';
        const result = generateAlternativeIds(id);
        expect(result).toContain('test-id-123');
    });

    test('URL-encoded ID를 디코딩 시도', () => {
        const encoded = 'test%20id%20with%20spaces';
        const result = generateAlternativeIds(encoded);
        expect(result).toContain(encoded); // 원본
        expect(result).toContain('test id with spaces'); // 디코딩된 버전
    });

    test('평문 ID를 URL-encoding 시도', () => {
        const plain = 'test value';
        const result = generateAlternativeIds(plain);
        expect(result).toContain('test value'); // 원본
        expect(result).toContain('test%20value'); // 인코딩된 버전
    });

    test('Base64 인코딩 시도', () => {
        const id = 'test-id';
        const result = generateAlternativeIds(id);
        const base64 = Buffer.from('test-id').toString('base64');
        expect(result).toContain(base64);
    });

    test('UUID 첫 부분 추출', () => {
        const uuid = 'a1b2c3d4-e5f6-4a4b-8c8d-e0e1e2e3e4e5';
        const result = generateAlternativeIds(uuid);
        expect(result).toContain('a1b2c3d4e5f6');
    });

    test('하이픈 없는 UUID 처리', () => {
        const uuid = 'a1b2c3d4e5f6';
        const result = generateAlternativeIds(uuid);
        expect(result).toContain('a1b2c3d4');
    });

    test('중복된 ID는 제거', () => {
        const id = 'test';
        const result = generateAlternativeIds(id);
        const uniqueSet = new Set(result);
        expect(uniqueSet.size).toBe(result.length); // 모든 항목이 고유해야함
    });

    test('영문자, 숫자, 하이픈 혼합 ID', () => {
        const id = 'test-123-abc';
        const result = generateAlternativeIds(id);
        expect(result).toContain('test-123-abc');
        expect(result.length).toBeGreaterThan(1); // 대안이 생성됨
    });

    test('특수문자 포함 ID', () => {
        const id = 'test#id$value';
        const result = generateAlternativeIds(id);
        expect(result).toContain('test#id$value');
    });
});

describe('extractFieldReferencesFromFormula', () => {
    describe('기본 동작', () => {
        test('null expression은 빈 배열 반환', () => {
            const result = extractFieldReferencesFromFormula(null, ['field1']);
            expect(result).toEqual([]);
        });

        test('빈 expression은 빈 배열 반환', () => {
            const result = extractFieldReferencesFromFormula('', ['field1']);
            expect(result).toEqual([]);
        });

        test('undefined expression은 빈 배열 반환', () => {
            const result = extractFieldReferencesFromFormula(undefined, ['field1']);
            expect(result).toEqual([]);
        });

        test('number expression은 빈 배열 반환', () => {
            const result = extractFieldReferencesFromFormula(123, ['field1']);
            expect(result).toEqual([]);
        });
    });

    describe('prop() 참조 추출', () => {
        test('prop() 패턴에서 필드명 추출', () => {
            const expression = 'prop("fieldName")';
            const availableFields = ['fieldName', 'other'];
            const result = extractFieldReferencesFromFormula(expression, availableFields);
            expect(result).toContain('fieldName');
        });

        test('싱글 따옴표 prop() 패턴 지원', () => {
            const expression = "prop('fieldName')";
            const availableFields = ['fieldName'];
            const result = extractFieldReferencesFromFormula(expression, availableFields);
            expect(result).toContain('fieldName');
        });

        test('여러 prop() 참조 모두 추출', () => {
            const expression = 'prop("field1") + prop("field2")';
            const availableFields = ['field1', 'field2', 'field3'];
            const result = extractFieldReferencesFromFormula(expression, availableFields);
            expect(result).toContain('field1');
            expect(result).toContain('field2');
        });

        test('사용 불가능한 필드명은 제외', () => {
            const expression = 'prop("notAvailable")';
            const availableFields = ['field1', 'field2'];
            const result = extractFieldReferencesFromFormula(expression, availableFields);
            expect(result).not.toContain('notAvailable');
        });

        test('중복된 prop() 참조는 한 번만 포함', () => {
            const expression = 'prop("field1") + prop("field1")';
            const availableFields = ['field1'];
            const result = extractFieldReferencesFromFormula(expression, availableFields);
            expect(result.filter(f => f === 'field1').length).toBe(1);
        });
    });

    describe('직접 필드명 참조', () => {
        test('식에서 직접 필드명 추출', () => {
            const expression = 'Status and Progress';
            const availableFields = ['Status', 'Progress', 'other'];
            const result = extractFieldReferencesFromFormula(expression, availableFields);
            expect(result).toContain('Status');
            expect(result).toContain('Progress');
        });

        test('Notion 예약어는 제외', () => {
            const expression = 'if Status = "true" then "yes"';
            const availableFields = ['Status', 'true'];
            const result = extractFieldReferencesFromFormula(expression, availableFields);
            expect(result).toContain('Status');
            expect(result).not.toContain('if');
            expect(result).not.toContain('then');
        });

        test('수식 함수명은 제외', () => {
            const expression = 'add(number1, number2)';
            const availableFields = ['number1', 'number2'];
            const result = extractFieldReferencesFromFormula(expression, availableFields);
            expect(result).toContain('number1');
            expect(result).toContain('number2');
            expect(result).not.toContain('add');
        });

        test('한글 필드명 추출', () => {
            const expression = '상태 + 진행도';
            const availableFields = ['상태', '진행도'];
            const result = extractFieldReferencesFromFormula(expression, availableFields);
            expect(result).toContain('상태');
            expect(result).toContain('진행도');
        });

        test('공백 포함 필드명 처리', () => {
            const expression = 'My Field Name is important';
            const availableFields = ['My Field Name', 'important', 'other'];
            const result = extractFieldReferencesFromFormula(expression, availableFields);
            expect(result).toContain('important');
        });

        test('숫자로 시작하는 필드명은 제외', () => {
            const expression = '123field + validField';
            const availableFields = ['123field', 'validField'];
            const result = extractFieldReferencesFromFormula(expression, availableFields);
            expect(result).toContain('validField');
        });
    });

    describe('block_property 참조 (Notion 특화)', () => {
        test('block_property 패턴에서 필드명 추출', () => {
            const expression = '{{notion:block_property:prop-id:a1b2c3d4-e5f6}} > 5';
            const availableFields = ['prop-id', 'otherField'];
            const propertyIdMap = { 'prop-id': 'prop-id' };
            const result = extractFieldReferencesFromFormula(
                expression,
                availableFields,
                propertyIdMap
            );
            expect(result).toContain('prop-id');
        });

        test('UUID를 이용한 block_property 매핑', () => {
            const expression = '{{notion:block_property:db-id:a1b2c3d4-e5f6}} > 10';
            const availableFields = ['fieldName'];
            const propertyIdMap = { 'a1b2c3d4-e5f6': 'fieldName' };
            const result = extractFieldReferencesFromFormula(
                expression,
                availableFields,
                propertyIdMap
            );
            expect(result).toContain('fieldName');
        });

        test('globalPropertyIdMap에서 필드명 조회', () => {
            const expression = '{{notion:block_property:db-id:uuid-123}} + 5';
            const availableFields = ['calculatedField'];
            const globalPropertyIdMap = {
                'uuid-123': { fieldName: 'calculatedField' }
            };
            const result = extractFieldReferencesFromFormula(
                expression,
                availableFields,
                {},
                globalPropertyIdMap
            );
            expect(result).toContain('calculatedField');
        });

        test('사용 불가능한 block_property는 제외', () => {
            const expression = '{{notion:block_property:unknown-id:uuid-456}}';
            const availableFields = ['otherField'];
            const result = extractFieldReferencesFromFormula(expression, availableFields);
            expect(result.length).toBe(0);
        });
    });

    describe('우선순위 (block_property > prop > direct)', () => {
        test('block_property가 존재하면 prop 무시', () => {
            const expression = '{{notion:block_property:field1:uuid}} + prop("field2")';
            const propertyIdMap = { 'field1': 'field1' };
            const availableFields = ['field1', 'field2'];
            const result = extractFieldReferencesFromFormula(
                expression,
                availableFields,
                propertyIdMap
            );
            expect(result).toEqual(['field1']);
        });

        test('prop이 block_property 없을 때 직접 참조 무시', () => {
            const expression = 'prop("field1") + field2';
            const availableFields = ['field1', 'field2'];
            const result = extractFieldReferencesFromFormula(expression, availableFields);
            expect(result).toEqual(['field1']);
        });

        test('prop과 직접 참조 혼합', () => {
            const expression = 'prop("field1") + field2';
            const availableFields = ['field1', 'field2'];
            const result = extractFieldReferencesFromFormula(expression, availableFields);
            expect(result).toContain('field1');
        });
    });

    describe('복잡한 수식', () => {
        test('복합 수식에서 모든 필드 참조 추출', () => {
            const expression = 'if prop("Status") = "Active" then Count + Priority else 0';
            const availableFields = ['Status', 'Count', 'Priority'];
            const result = extractFieldReferencesFromFormula(expression, availableFields);
            expect(result).toContain('Status');
            expect(result).toContain('Count');
            expect(result).toContain('Priority');
        });

        test('중첩된 함수 호출 처리', () => {
            const expression = 'max(add(field1, field2), multiply(field3, 2))';
            const availableFields = ['field1', 'field2', 'field3'];
            const result = extractFieldReferencesFromFormula(expression, availableFields);
            expect(result).toContain('field1');
            expect(result).toContain('field2');
            expect(result).toContain('field3');
        });

        test('문자열 리터럴 내 필드명 무시', () => {
            const expression = 'contains(Notes, "fieldName")';
            const availableFields = ['Notes', 'fieldName', 'other'];
            const result = extractFieldReferencesFromFormula(expression, availableFields);
            expect(result).toContain('Notes');
            // "fieldName"은 문자열 리터럴이므로 무시되어야 함
        });
    });

    describe('엣지 케이스', () => {
        test('빈 availableFieldNames 처리', () => {
            const expression = 'prop("field1")';
            const result = extractFieldReferencesFromFormula(expression, []);
            expect(result).toEqual([]);
        });

        test('매우 긴 수식 처리', () => {
            const longExpression = 'field1 + field2 + field3 + field4 + field5' +
                ' + field6 + field7 + field8 + field9 + field10';
            const availableFields = ['field1', 'field2', 'field3', 'field4', 'field5',
                'field6', 'field7', 'field8', 'field9', 'field10'];
            const result = extractFieldReferencesFromFormula(longExpression, availableFields);
            expect(result.length).toBe(10);
        });

        test('특수 문자 포함 수식', () => {
            const expression = 'field_1 + field-2 + field.3';
            const availableFields = ['field_1', 'field2', 'field3'];
            const result = extractFieldReferencesFromFormula(expression, availableFields);
            expect(result).toContain('field_1');
        });

        test('debug 모드 활성화 (부작용 없음)', () => {
            const expression = 'prop("field1")';
            const availableFields = ['field1'];
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
            
            const result = extractFieldReferencesFromFormula(expression, availableFields, {}, {}, true);
            
            expect(result).toContain('field1');
            expect(consoleSpy).toHaveBeenCalled();
            
            consoleSpy.mockRestore();
        });

        test('대소문자 구분', () => {
            const expression = 'Field1 and FIELD1';
            const availableFields = ['Field1', 'field1'];
            const result = extractFieldReferencesFromFormula(expression, availableFields);
            expect(result).toContain('Field1');
        });
    });

    describe('priorityMap과 globalPropertyIdMap 혼합', () => {
        test('두 map 모두 참조 가능', () => {
            const expression = '{{notion:block_property:id1:uuid1}} + {{notion:block_property:id2:uuid2}}';
            const availableFields = ['field1', 'field2'];
            const propertyIdMap = { 'uuid1': 'field1' };
            const globalPropertyIdMap = { 'uuid2': { fieldName: 'field2' } };
            
            const result = extractFieldReferencesFromFormula(
                expression,
                availableFields,
                propertyIdMap,
                globalPropertyIdMap
            );
            
            expect(result).toContain('field1');
            expect(result).toContain('field2');
        });

        test('propertyIdMap이 globalPropertyIdMap보다 우선', () => {
            const expression = '{{notion:block_property:id:uuid}}';
            const availableFields = ['localField', 'globalField'];
            const propertyIdMap = { 'uuid': 'localField' };
            const globalPropertyIdMap = { 'uuid': { fieldName: 'globalField' } };
            
            const result = extractFieldReferencesFromFormula(
                expression,
                availableFields,
                propertyIdMap,
                globalPropertyIdMap
            );
            
            expect(result).toContain('localField');
            expect(result).not.toContain('globalField');
        });
    });
});
