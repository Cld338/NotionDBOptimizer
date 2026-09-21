/**
 * 통계 유틸리티
 * 책임: 데이터 자체 분포에서 유도되는 통계 기준(사분위수, IQR 이상치 등) 계산
 */

/**
 * 중앙값 계산
 */
function median(values) {
    if (!values || values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
}

/**
 * 백분위수 계산 (선형 보간, Type 7 방식)
 */
function percentile(values, p) {
    if (!values || values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    if (sorted.length === 1) return sorted[0];

    const rank = (p / 100) * (sorted.length - 1);
    const lowerIndex = Math.floor(rank);
    const upperIndex = Math.ceil(rank);
    const weight = rank - lowerIndex;

    if (lowerIndex === upperIndex) return sorted[lowerIndex];
    return sorted[lowerIndex] * (1 - weight) + sorted[upperIndex] * weight;
}

/**
 * Tukey IQR(사분위 범위) 기반 이상치 경계 계산
 * lowerFence = Q1 - 1.5*IQR, upperFence = Q3 + 1.5*IQR
 */
function iqrBounds(values) {
    if (!values || values.length === 0) {
        return { q1: 0, q3: 0, iqr: 0, lowerFence: 0, upperFence: 0 };
    }
    const q1 = percentile(values, 25);
    const q3 = percentile(values, 75);
    const iqr = q3 - q1;
    return {
        q1,
        q3,
        iqr,
        lowerFence: q1 - 1.5 * iqr,
        upperFence: q3 + 1.5 * iqr
    };
}

/**
 * IQR 경계를 벗어나는 이상치의 인덱스 목록 반환
 * 표본이 4개 미만이면 IQR이 통계적으로 불안정하므로 빈 배열 반환
 */
function iqrOutliers(values) {
    if (!values || values.length < 4) return [];
    const { lowerFence, upperFence } = iqrBounds(values);
    const indices = [];
    values.forEach((v, idx) => {
        if (v < lowerFence || v > upperFence) {
            indices.push(idx);
        }
    });
    return indices;
}

module.exports = {
    median,
    percentile,
    iqrBounds,
    iqrOutliers
};
