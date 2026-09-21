/**
 * utils/statistics 테스트
 */

const { median, percentile, iqrBounds, iqrOutliers } = require('../utils/statistics');

describe('statistics', () => {
    describe('median', () => {
        test('홀수 개수는 중간값 반환', () => {
            expect(median([1, 3, 2])).toBe(2);
        });
        test('짝수 개수는 중간 두 값의 평균', () => {
            expect(median([1, 2, 3, 4])).toBe(2.5);
        });
        test('빈 배열은 0 반환', () => {
            expect(median([])).toBe(0);
        });
    });

    describe('percentile', () => {
        test('0번째 백분위수는 최솟값', () => {
            expect(percentile([1, 2, 3, 4, 5], 0)).toBe(1);
        });
        test('100번째 백분위수는 최댓값', () => {
            expect(percentile([1, 2, 3, 4, 5], 100)).toBe(5);
        });
        test('50번째 백분위수는 중앙값과 동일', () => {
            expect(percentile([1, 2, 3, 4, 5], 50)).toBe(median([1, 2, 3, 4, 5]));
        });
    });

    describe('iqrBounds', () => {
        test('Q1, Q3, lowerFence, upperFence 계산', () => {
            const bounds = iqrBounds([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
            expect(bounds.q1).toBeLessThan(bounds.q3);
            expect(bounds.lowerFence).toBeLessThanOrEqual(bounds.q1);
            expect(bounds.upperFence).toBeGreaterThanOrEqual(bounds.q3);
        });
        test('빈 배열은 모두 0', () => {
            expect(iqrBounds([])).toEqual({ q1: 0, q3: 0, iqr: 0, lowerFence: 0, upperFence: 0 });
        });
    });

    describe('iqrOutliers', () => {
        test('명확한 이상치를 인덱스로 반환', () => {
            const values = [10, 11, 12, 13, 14, 100];
            const outliers = iqrOutliers(values);
            expect(outliers).toContain(5);
        });
        test('표본이 4개 미만이면 빈 배열 반환 (통계적으로 불안정)', () => {
            expect(iqrOutliers([1, 2, 3])).toEqual([]);
        });
        test('고르게 분포된 데이터는 이상치 없음', () => {
            expect(iqrOutliers([10, 11, 12, 13, 14, 15])).toEqual([]);
        });
    });
});
