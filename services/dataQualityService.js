/**
 * 데이터 품질 서비스
 * 책임: DAMA-DMBOK/ISO 8000-61 데이터 품질 차원 중 Notion API 데이터만으로
 *       실제로 계산 가능한 차원(완전성·고유성·유효성·적시성)을 산출한다.
 *       정확성(Accuracy)·일관성(Consistency)은 외부 정답 데이터/도메인 규칙이
 *       없어 계산할 수 없으므로 { applicable: false } 로 명시한다.
 */

const { median, percentile, iqrOutliers } = require('../utils/statistics');

const SYSTEM_TYPES = ['created_time', 'last_edited_time', 'created_by', 'last_edited_by'];
const DERIVED_TYPES = ['formula', 'rollup'];
const UNIQUENESS_APPLICABLE_TYPES = ['title', 'rich_text', 'number', 'email', 'url', 'phone_number'];
const VALIDITY_APPLICABLE_TYPES = ['title', 'rich_text', 'select', 'status', 'multi_select', 'number', 'date', 'checkbox', 'email', 'url', 'phone_number'];

function _isEmpty(value) {
    return (
        value === null ||
        value === '' ||
        value === undefined ||
        (Array.isArray(value) && value.length === 0)
    );
}

/**
 * 완전성(Completeness)
 * 시스템 생성 필드는 항상 값이 존재하므로 100으로 고정하고,
 * formula/rollup은 사용자가 직접 입력하는 값이 아니라 파생값이므로
 * 종합 완전성 평균에서 제외하고 별도로 집계한다.
 */
function calculateCompleteness(columnStats, properties, propertyNames) {
    const byColumn = {};
    const derivedColumns = {};
    const inputCompletenessValues = [];

    propertyNames.forEach(propKey => {
        const stats = columnStats[propKey];
        if (!stats) return;
        const type = properties[propKey]?.type || stats.type;

        if (SYSTEM_TYPES.includes(type)) {
            byColumn[propKey] = { name: stats.name, type, completeness: 100, note: '시스템 생성 필드로 항상 값이 존재함' };
            return;
        }
        if (DERIVED_TYPES.includes(type)) {
            derivedColumns[propKey] = { name: stats.name, type, completeness: stats.completeness };
            return;
        }
        byColumn[propKey] = { name: stats.name, type, completeness: stats.completeness };
        inputCompletenessValues.push(stats.completeness);
    });

    const overall = inputCompletenessValues.length > 0
        ? Math.round(inputCompletenessValues.reduce((a, b) => a + b, 0) / inputCompletenessValues.length)
        : 100;

    return { overall, byColumn, derivedColumns };
}

/**
 * 고유성(Uniqueness)
 * select/status/multi_select/relation처럼 값이 반복되는 것이 정상인 타입은 N/A 처리한다.
 */
function calculateUniqueness(columnStats, properties, propertyNames) {
    const byColumn = {};
    const excludedColumns = [];

    propertyNames.forEach(propKey => {
        const stats = columnStats[propKey];
        if (!stats) return;
        const type = properties[propKey]?.type || stats.type;

        if (!UNIQUENESS_APPLICABLE_TYPES.includes(type)) {
            excludedColumns.push(propKey);
            return;
        }

        const filledCount = stats.filledCount || 0;
        const uniqueCount = stats.uniqueCount || 0;
        const duplicateRatio = filledCount > 0 ? Math.round((1 - uniqueCount / filledCount) * 100) : 0;

        byColumn[propKey] = { name: stats.name, type, filledCount, uniqueCount, duplicateRatio };
    });

    return { byColumn, excludedColumns };
}

/**
 * 타입별 유효성 판정. 검증 규칙이 없는 타입은 null(N/A) 반환.
 * 주의: propertyFormatter가 date 값을 `date.start`만 남기고 `end`를 버리므로
 * range(start<=end) 검증은 원본 데이터 파이프라인상 불가능하다 — 파싱 가능 여부만 검증한다.
 */
function _isValidValue(type, value, propertySchema) {
    switch (type) {
        case 'title':
        case 'rich_text':
            return typeof value === 'string' && value.length <= 2000;
        case 'select': {
            const names = (propertySchema.select?.options || []).map(o => o.name);
            return names.includes(value);
        }
        case 'status': {
            const names = (propertySchema.status?.options || []).map(o => o.name);
            return names.includes(value);
        }
        case 'multi_select': {
            const names = (propertySchema.multi_select?.options || []).map(o => o.name);
            return Array.isArray(value) && value.every(v => names.includes(v));
        }
        case 'number':
            return typeof value === 'number' && Number.isFinite(value);
        case 'date':
            return typeof value === 'string' && !Number.isNaN(Date.parse(value));
        case 'email':
            return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
        case 'url':
            try {
                new URL(value);
                return true;
            } catch (e) {
                return false;
            }
        case 'phone_number':
            return typeof value === 'string' && /^[+\d][\d\s\-().]{2,}$/.test(value);
        default:
            return null;
    }
}

/**
 * 유효성(Validity)
 * 완전성과 겹치지 않도록, 값이 채워진(비어있지 않은) 레코드만 검사 대상으로 삼는다.
 */
function calculateValidity(records, properties, propertyNames, columnStats) {
    const byColumn = {};
    const invalidSamples = {};
    let totalInvalid = 0;
    let totalFilled = 0;

    propertyNames.forEach(propKey => {
        const propertySchema = properties[propKey];
        const type = propertySchema?.type;
        if (!VALIDITY_APPLICABLE_TYPES.includes(type)) return;

        let filledCount = 0;
        let invalidCount = 0;
        const samples = [];

        records.forEach(record => {
            const value = record.properties?.[propKey];
            if (_isEmpty(value)) return;
            filledCount++;

            if (type === 'checkbox') return; // boolean은 항상 유효

            const valid = _isValidValue(type, value, propertySchema);
            if (valid === false) {
                invalidCount++;
                if (samples.length < 10) samples.push(record.id);
            }
        });

        const validityRate = filledCount > 0 ? Math.round((1 - invalidCount / filledCount) * 100) : 100;
        byColumn[propKey] = {
            name: columnStats[propKey]?.name || propKey,
            type,
            filledCount,
            invalidCount,
            validityRate
        };
        if (samples.length > 0) invalidSamples[propKey] = samples;

        totalFilled += filledCount;
        totalInvalid += invalidCount;
    });

    const overall = totalFilled > 0 ? Math.round((1 - totalInvalid / totalFilled) * 100) : 100;
    return { overall, byColumn, invalidSamples };
}

/**
 * 적시성(Timeliness)
 * 절대 기준("30일 이상 미수정=경고") 없이, 이 데이터베이스 자체의 수정일 분포에서
 * IQR 상단 이상치(유난히 오래 방치된 레코드)만 정보로 제공한다.
 */
function calculateTimeliness(records) {
    const now = Date.now();
    const withDays = records
        .map(r => ({
            id: r.id,
            days: r.last_edited_time ? (now - new Date(r.last_edited_time).getTime()) / 86400000 : null
        }))
        .filter(x => x.days !== null && Number.isFinite(x.days));

    if (withDays.length === 0) {
        return { medianDaysSinceEdit: null, p90DaysSinceEdit: null, staleOutlierRecordIds: [] };
    }

    const daysList = withDays.map(x => x.days);
    const med = median(daysList);
    const outlierIndices = iqrOutliers(daysList);

    const staleOutlierRecordIds = outlierIndices
        .map(i => withDays[i])
        .filter(x => x.days > med) // 오래 방치된 쪽 이상치만 의미가 있음
        .map(x => x.id)
        .slice(0, 20);

    return {
        medianDaysSinceEdit: Math.round(med * 10) / 10,
        p90DaysSinceEdit: Math.round(percentile(daysList, 90) * 10) / 10,
        staleOutlierRecordIds
    };
}

/**
 * DAMA-DMBOK 6대 데이터 품질 차원 종합 산출
 */
function calculateDataQualityDimensions(records, properties, propertyNames, columnStats) {
    return {
        completeness: calculateCompleteness(columnStats, properties, propertyNames),
        uniqueness: calculateUniqueness(columnStats, properties, propertyNames),
        validity: calculateValidity(records, properties, propertyNames, columnStats),
        timeliness: calculateTimeliness(records),
        accuracy: {
            applicable: false,
            reason: '외부 정답 데이터 없이는 Notion API만으로 값의 사실적 정확성을 검증할 수 없습니다.'
        },
        consistency: {
            applicable: false,
            reason: '교차 필드 비즈니스 규칙이 스키마에 정의되어 있지 않아 판정할 수 없습니다.'
        }
    };
}

module.exports = {
    calculateDataQualityDimensions,
    calculateCompleteness,
    calculateUniqueness,
    calculateValidity,
    calculateTimeliness
};
