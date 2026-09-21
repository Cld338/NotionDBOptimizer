/**
 * dataQualityService 테스트
 * 책임: DAMA-DMBOK 데이터 품질 차원(완전성/고유성/유효성/적시성) 산출 검증
 */

const {
    calculateDataQualityDimensions,
    calculateCompleteness,
    calculateUniqueness,
    calculateValidity,
    calculateTimeliness
} = require('../services/dataQualityService');

describe('dataQualityService', () => {
    describe('calculateCompleteness', () => {
        test('시스템 생성 필드(created_time 등)는 항상 100%', () => {
            const columnStats = { created: { name: 'Created', type: 'created_time', completeness: 0 } };
            const properties = { created: { type: 'created_time' } };
            const result = calculateCompleteness(columnStats, properties, ['created']);
            expect(result.byColumn.created.completeness).toBe(100);
        });

        test('formula/rollup은 파생값이므로 derivedColumns로 분리되고 overall 평균에서 제외됨', () => {
            const columnStats = {
                name: { name: 'Name', type: 'title', completeness: 50 },
                calc: { name: 'Calc', type: 'formula', completeness: 10 }
            };
            const properties = { name: { type: 'title' }, calc: { type: 'formula' } };
            const result = calculateCompleteness(columnStats, properties, ['name', 'calc']);

            expect(result.derivedColumns.calc).toBeDefined();
            expect(result.byColumn.calc).toBeUndefined();
            expect(result.overall).toBe(50); // formula(10)가 평균에서 제외되어 name(50)만 반영
        });
    });

    describe('calculateUniqueness', () => {
        test('select/status/multi_select/relation은 반복이 정상이므로 N/A(excludedColumns) 처리', () => {
            const columnStats = { status: { name: 'Status', type: 'select', filledCount: 10, uniqueCount: 2 } };
            const properties = { status: { type: 'select' } };
            const result = calculateUniqueness(columnStats, properties, ['status']);
            expect(result.excludedColumns).toContain('status');
            expect(result.byColumn.status).toBeUndefined();
        });

        test('title처럼 고유성이 의미 있는 타입은 중복률 계산', () => {
            const columnStats = { name: { name: 'Name', type: 'title', filledCount: 10, uniqueCount: 8 } };
            const properties = { name: { type: 'title' } };
            const result = calculateUniqueness(columnStats, properties, ['name']);
            expect(result.byColumn.name.duplicateRatio).toBe(20); // (1 - 8/10) * 100
        });
    });

    describe('calculateValidity', () => {
        test('select 값이 옵션 목록에 없으면 무효로 판정', () => {
            const records = [
                { id: 'r1', properties: { status: 'Active' } },
                { id: 'r2', properties: { status: 'DeletedOption' } }
            ];
            const properties = { status: { type: 'select', select: { options: [{ name: 'Active' }, { name: 'Inactive' }] } } };
            const result = calculateValidity(records, properties, ['status'], { status: { name: 'Status' } });

            expect(result.byColumn.status.invalidCount).toBe(1);
            expect(result.invalidSamples.status).toEqual(['r2']);
        });

        test('checkbox는 항상 유효(boolean이면 무조건 통과)', () => {
            const records = [{ id: 'r1', properties: { done: true } }, { id: 'r2', properties: { done: false } }];
            const properties = { done: { type: 'checkbox' } };
            const result = calculateValidity(records, properties, ['done'], { done: { name: 'Done' } });
            expect(result.byColumn.done.invalidCount).toBe(0);
        });

        test('relation은 검증 규칙이 없어 byColumn에 나타나지 않음(N/A)', () => {
            const records = [{ id: 'r1', properties: { rel: ['id1'] } }];
            const properties = { rel: { type: 'relation' } };
            const result = calculateValidity(records, properties, ['rel'], { rel: { name: 'Rel' } });
            expect(result.byColumn.rel).toBeUndefined();
        });

        test('formula/rollup은 검증 대상에서 제외됨(N/A)', () => {
            const records = [{ id: 'r1', properties: { calc: 42 } }];
            const properties = { calc: { type: 'formula' } };
            const result = calculateValidity(records, properties, ['calc'], { calc: { name: 'Calc' } });
            expect(result.byColumn.calc).toBeUndefined();
        });

        test('number 필드는 NaN/Infinity를 무효로 판정', () => {
            const records = [{ id: 'r1', properties: { n: 10 } }, { id: 'r2', properties: { n: NaN } }];
            const properties = { n: { type: 'number' } };
            const result = calculateValidity(records, properties, ['n'], { n: { name: 'N' } });
            expect(result.byColumn.n.invalidCount).toBe(1);
        });

        test('email 형식이 아니면 무효로 판정', () => {
            const records = [{ id: 'r1', properties: { e: 'a@b.com' } }, { id: 'r2', properties: { e: 'not-an-email' } }];
            const properties = { e: { type: 'email' } };
            const result = calculateValidity(records, properties, ['e'], { e: { name: 'E' } });
            expect(result.byColumn.e.invalidCount).toBe(1);
        });

        test('빈 값은 완전성 차원의 몫이므로 유효성 검사 대상에서 제외', () => {
            const records = [{ id: 'r1', properties: { e: null } }];
            const properties = { e: { type: 'email' } };
            const result = calculateValidity(records, properties, ['e'], { e: { name: 'E' } });
            expect(result.byColumn.e.filledCount).toBe(0);
            expect(result.byColumn.e.invalidCount).toBe(0);
        });
    });

    describe('calculateTimeliness', () => {
        test('레코드가 없으면 null 반환', () => {
            const result = calculateTimeliness([]);
            expect(result.medianDaysSinceEdit).toBeNull();
        });

        test('유난히 오래 방치된 레코드만 이상치로 표시 (절대 기준 없음)', () => {
            const now = Date.now();
            const records = [];
            for (let i = 0; i < 10; i++) {
                records.push({ id: `recent${i}`, last_edited_time: new Date(now - i * 86400000).toISOString() });
            }
            records.push({ id: 'stale', last_edited_time: new Date(now - 3650 * 86400000).toISOString() });

            const result = calculateTimeliness(records);
            expect(result.staleOutlierRecordIds).toContain('stale');
        });
    });

    describe('calculateDataQualityDimensions', () => {
        test('accuracy/consistency는 항상 applicable: false와 사유를 포함', () => {
            const result = calculateDataQualityDimensions([], {}, [], {});
            expect(result.accuracy.applicable).toBe(false);
            expect(result.accuracy.reason).toBeTruthy();
            expect(result.consistency.applicable).toBe(false);
            expect(result.consistency.reason).toBeTruthy();
        });

        test('6개 차원을 모두 포함', () => {
            const result = calculateDataQualityDimensions([], {}, [], {});
            expect(Object.keys(result).sort()).toEqual(
                ['accuracy', 'completeness', 'consistency', 'timeliness', 'uniqueness', 'validity'].sort()
            );
        });
    });
});
