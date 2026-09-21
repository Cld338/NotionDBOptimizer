/**
 * utils/formulaParser 테스트
 * 책임: 수식에서 필드 참조를 추출하는 로직 검증 (병합형 추출, 문자열 리터럴 오탐 방지)
 */

const { extractFieldReferencesFromFormula, _stripStringLiterals } = require('../utils/formulaParser');

describe('formulaParser', () => {
    describe('_stripStringLiterals', () => {
        test('큰따옴표/작은따옴표 리터럴을 동일 길이 공백으로 치환', () => {
            const result = _stripStringLiterals('if(x == "Status") then 1');
            expect(result).not.toContain('Status');
            expect(result.length).toBe('if(x == "Status") then 1'.length);
        });
    });

    describe('extractFieldReferencesFromFormula', () => {
        test('block_property와 prop()이 한 수식에 혼용되어도 둘 다 추출됨 (이전 상호배타 버그 회귀 테스트)', () => {
            const expression = '{{notion:block_property:abc-123:ignored:00000000-0000-0000-0000-000000000000}} + prop("Field B")';
            const availableFieldNames = ['Field A', 'Field B'];
            const propertyIdMap = { 'abc-123': 'Field A' };

            const result = extractFieldReferencesFromFormula(expression, availableFieldNames, propertyIdMap, {}, false);

            expect(result).toContain('Field A');
            expect(result).toContain('Field B');
        });

        test('하이픈이 포함된 필드명도 매칭됨', () => {
            const expression = 'prop("Total") + Sub-Total * 2';
            const availableFieldNames = ['Total', 'Sub-Total'];
            const result = extractFieldReferencesFromFormula(expression, availableFieldNames, {}, {}, false);
            expect(result).toContain('Sub-Total');
        });

        test('숫자로 시작하는 필드명도 매칭됨', () => {
            const expression = 'if(2024Target > 100, 1, 0)';
            const availableFieldNames = ['2024Target'];
            const result = extractFieldReferencesFromFormula(expression, availableFieldNames, {}, {}, false);
            expect(result).toContain('2024Target');
        });

        test('문자열 리터럴 내부의 텍스트는 필드 참조로 오탐되지 않음', () => {
            const expression = 'if(prop("Category") == "Status", "매칭", "불일치")';
            const availableFieldNames = ['Category', 'Status'];
            const result = extractFieldReferencesFromFormula(expression, availableFieldNames, {}, {}, false);

            expect(result).toContain('Category'); // prop()으로 정당하게 참조됨
            expect(result).not.toContain('Status'); // 리터럴 내부의 텍스트일 뿐, 실제 참조 아님
        });

        test('긴 필드명이 짧은 필드명의 부분 문자열이어도 올바르게 구분됨', () => {
            const expression = 'prop("Total Price") - prop("Total")';
            const availableFieldNames = ['Total', 'Total Price'];
            const result = extractFieldReferencesFromFormula(expression, availableFieldNames, {}, {}, false);
            expect(result.sort()).toEqual(['Total', 'Total Price'].sort());
        });

        test('빈 수식은 빈 배열 반환', () => {
            expect(extractFieldReferencesFromFormula('', ['A'], {}, {}, false)).toEqual([]);
            expect(extractFieldReferencesFromFormula(null, ['A'], {}, {}, false)).toEqual([]);
        });

        test('중복 참조는 한 번만 반환', () => {
            const expression = 'prop("A") + prop("A") + A';
            const result = extractFieldReferencesFromFormula(expression, ['A'], {}, {}, false);
            expect(result).toEqual(['A']);
        });
    });
});
