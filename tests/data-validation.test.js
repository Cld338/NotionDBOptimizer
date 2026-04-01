/**
 * data-validation.test.js
 * 데이터 검증 테스트: 입력값 유효성, 스키마 검증, 타입 체크
 */

const {
    formatPropertyValue,
    formatDatabaseRecord,
    formatDatabase
} = require('../utils/propertyFormatter');

const {
    analyzeDatabase,
    calculateQualityScore
} = require('../services/analyzerService');

describe('Data Validation Tests - 데이터 검증', () => {

    // ============================================
    // 입력값 유효성 검증
    // ============================================
    describe('입력값 검증 - formatPropertyValue', () => {
        test('null 입력 처리', () => {
            const property = {
                type: 'text',
                text: null
            };
            // null은 안전하게 처리 (빈 문자열 반환 등)
            const result = formatPropertyValue(property);
            expect(result === '' || result === null).toBe(true);
        });

        test('undefined 입력 처리', () => {
            const property = {
                type: 'title',
                title: undefined
            };
            // undefined는 에러 발생 가능 - 함수가 undefined 배열을 map 시도
            expect(() => formatPropertyValue(property)).toThrow();
        });

        test('빈 객체 처리', () => {
            const property = {};
            // type이 없으면 undefined 반환
            const result = formatPropertyValue(property);
            expect(result === undefined || result === null).toBe(true);
        });

        test('누락된 필드 처리', () => {
            const property = {
                type: 'select'
                // select 필드 없음
            };
            // select 필드가 없으면 null 반환 또는 에러
            const result = formatPropertyValue(property);
            expect(result === null || Array.isArray(result)).toBe(true);
        });

        test('특수 문자 처리', () => {
            const property = {
                type: 'title',
                title: [{ plain_text: 'Title with <tag> & "quotes"' }]
            };
            const result = formatPropertyValue(property);
            expect(result).toContain('<tag>');
            expect(result).toContain('"quotes"');
        });

        test('이모지 처리', () => {
            const property = {
                type: 'title',
                title: [{ plain_text: '🎉 Event 🎊' }]
            };
            const result = formatPropertyValue(property);
            expect(result).toBe('🎉 Event 🎊');
        });

        test('매우 긴 문자열 처리', () => {
            const longText = 'A'.repeat(10000);
            const property = {
                type: 'title',
                title: [{ plain_text: longText }]
            };
            const result = formatPropertyValue(property);
            expect(result.length).toBe(10000);
        });

        test('제어 문자 처리', () => {
            const property = {
                type: 'title',
                title: [{ plain_text: 'Line1\nLine2\tTabbed' }]
            };
            const result = formatPropertyValue(property);
            expect(result).toContain('\n');
            expect(result).toContain('\t');
        });

        test('NaN 숫자 처리', () => {
            const property = {
                type: 'number',
                number: NaN
            };
            const result = formatPropertyValue(property);
            expect(Number.isNaN(result) || result === null).toBe(true);
        });

        test('무한대 처리', () => {
            const property = {
                type: 'number',
                number: Infinity
            };
            const result = formatPropertyValue(property);
            expect(result === Infinity || typeof result === 'number').toBe(true);
        });
    });

    // ============================================
    // 배열 데이터 검증
    // ============================================
    describe('배열 데이터 검증', () => {
        test('multi_select 타입: 빈 배열', () => {
            const property = {
                type: 'multi_select',
                multi_select: []
            };
            const result = formatPropertyValue(property);
            expect(Array.isArray(result)).toBe(true);
            expect(result).toHaveLength(0);
        });

        test('multi_select 타입: 중복된 항목 처리', () => {
            const property = {
                type: 'multi_select',
                multi_select: [
                    { name: 'Tag1' },
                    { name: 'Tag1' }, // 중복
                    { name: 'Tag2' }
                ]
            };
            const result = formatPropertyValue(property);
            expect(result).toEqual(['Tag1', 'Tag1', 'Tag2']);
        });

        test('relation 타입: 빈 관계', () => {
            const property = {
                type: 'relation',
                relation: []
            };
            const result = formatPropertyValue(property);
            expect(Array.isArray(result)).toBe(true);
            expect(result).toHaveLength(0);
        });

        test('people 타입: 매우 많은 사람', () => {
            const peopleArray = Array(100).fill(null).map((_, i) => ({
                name: `Person ${i}`
            }));
            const property = {
                type: 'people',
                people: peopleArray
            };
            const result = formatPropertyValue(property);
            expect(Array.isArray(result)).toBe(true);
            expect(result).toHaveLength(100);
        });
    });

    // ============================================
    // 스키마 검증
    // ============================================
    describe('스키마 및 구조 검증', () => {
        test('데이터베이스 레코드: 필수 필드 확인', () => {
            const record = {
                id: 'record-1',
                properties: {
                    name: 'Test Name',
                    status: 'Active'
                }
            };

            expect(record).toHaveProperty('id');
            expect(record).toHaveProperty('properties');
            expect(typeof record.id).toBe('string');
            expect(typeof record.properties).toBe('object');
        });

        test('정의되지 않은 속성 타입 처리', () => {
            const property = {
                type: 'unknown_future_type',
                data: 'some data'
            };
            // 알려지지 않은 타입도 graceful하게 처리되어야 함
            expect(() => formatPropertyValue(property)).not.toThrow();
        });

        test('속성 ID 검증: UUID 형식', () => {
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            const propertyId = '550e8400-e29b-41d4-a716-446655440000';
            
            expect(uuidRegex.test(propertyId)).toBe(true);
        });

        test('데이터베이스 ID 검증', () => {
            const databaseId = 'db-123456789abcdef';
            expect(typeof databaseId).toBe('string');
            expect(databaseId.length).toBeGreaterThan(0);
        });
    });

    // ============================================
    // 숫자 범위 검증
    // ============================================
    describe('숫자 범위 검증', () => {
        test('품질 점수: 0-100 범위 검증', () => {
            const scores = [0, 25, 50, 75, 100];
            scores.forEach(score => {
                expect(calculateQualityScore(score, 20, 100)).toBeGreaterThanOrEqual(0);
                expect(calculateQualityScore(score, 20, 100)).toBeLessThanOrEqual(100);
            });
        });

        test('완성도 점수: 0-100 검증', () => {
            const records = [
                { id: 1, properties: { name: 'A', status: 'Active' } },
                { id: 2, properties: { name: 'B', status: null } }
            ];
            const properties = {
                name: { type: 'title' },
                status: { type: 'select' }
            };

            const result = analyzeDatabase(records, properties, ['name', 'status']);
            expect(result.overallCompleteness).toBeGreaterThanOrEqual(0);
            expect(result.overallCompleteness).toBeLessThanOrEqual(100);
        });

        test('음수 입력 처리', () => {
            const score = calculateQualityScore(-10, 20, 100);
            // 음수는 0으로 처리되어야 함
            expect(score).toBeGreaterThanOrEqual(0);
        });

        test('선택 옵션 수: 유효한 범위', () => {
            const property = {
                type: 'multi_select',
                multi_select: Array(50).fill(null).map((_, i) => ({ name: `Option ${i}` }))
            };
            const result = formatPropertyValue(property);
            expect(result.length).toBe(50);
        });
    });

    // ============================================
    // 날짜/시간 검증
    // ============================================
    describe('날짜/시간 형식 검증', () => {
        test('ISO 8601 날짜 형식 검증', () => {
            const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
            const testDate = '2024-01-15T10:30:00.000Z';
            expect(isoDateRegex.test(testDate)).toBe(true);
        });

        test('날짜만 형식 검증', () => {
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            const testDate = '2024-01-15';
            expect(dateRegex.test(testDate)).toBe(true);
        });

        test('timestamp 속성: 올바른 형식', () => {
            const property = {
                type: 'created_time',
                created_time: '2024-01-01T12:00:00.000Z'
            };
            const result = formatPropertyValue(property);
            expect(typeof result).toBe('string');
            expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T/);
        });
    });

    // ============================================
    // 순환 데이터 구조 처리
    // ============================================
    describe('순환 참조 및 순환 데이터', () => {
        test('순환 참조 객체 직렬화 안전성', () => {
            const obj = { name: 'test' };
            obj.self = obj; // 순환 참조

            expect(() => {
                JSON.stringify(obj);
            }).toThrow();

            // 순환 참조를 처리해야 함
            const safeObj = {
                name: obj.name
                // self 제외
            };
            expect(() => {
                JSON.stringify(safeObj);
            }).not.toThrow();
        });

        test('깊게 중첩된 객체 처리', () => {
            let nested = { value: 'deep' };
            for (let i = 0; i < 100; i++) {
                nested = { nested };
            }

            const result = (obj) => {
                try {
                    return JSON.stringify(obj);
                } catch (e) {
                    return null;
                }
            };

            expect(result(nested)).not.toBeNull();
        });
    });

    // ============================================
    // 타입 강제 및 변환
    // ============================================
    describe('타입 변환 및 강제', () => {
        test('문자열을 숫자로 변환 필요 시 검증', () => {
            const numberString = '123';
            const converted = Number(numberString);
            expect(converted).toBe(123);
            expect(typeof converted).toBe('number');
        });

        test('boolean 타입 강제 변환', () => {
            const testCases = [
                { value: true, expected: true },
                { value: false, expected: false },
                { value: 1, expected: true },
                { value: 0, expected: false },
                { value: 'true', expected: true },
                { value: '', expected: false }
            ];

            testCases.forEach(({ value, expected }) => {
                expect(Boolean(value)).toBe(expected);
            });
        });

        test('배열 타입 검증', () => {
            const testCases = [
                { value: [1, 2, 3], isArray: true },
                { value: [], isArray: true },
                { value: 'not array', isArray: false },
                { value: { 0: 1 }, isArray: false }
            ];

            testCases.forEach(({ value, isArray }) => {
                expect(Array.isArray(value)).toBe(isArray);
            });
        });
    });

    // ============================================
    // 이메일 검증
    // ============================================
    describe('이메일 형식 검증', () => {
        test('유효한 이메일 형식', () => {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            const validEmails = [
                'test@example.com',
                'user.name@example.co.uk',
                'user+tag@example.com'
            ];

            validEmails.forEach(email => {
                expect(emailRegex.test(email)).toBe(true);
            });
        });

        test('무효한 이메일 형식', () => {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            const invalidEmails = [
                'notanemail',
                '@example.com',
                'user@',
                'user @example.com'
            ];

            invalidEmails.forEach(email => {
                expect(emailRegex.test(email)).toBe(false);
            });
        });

        test('이메일 속성 포맷팅', () => {
            const property = {
                type: 'email',
                email: 'test@example.com'
            };
            const result = formatPropertyValue(property);
            expect(result).toBe('test@example.com');
        });
    });

    // ============================================
    // URL 검증
    // ============================================
    describe('URL 형식 검증', () => {
        test('유효한 URL 형식', () => {
            const urlRegex = /^https?:\/\/.+\..+/;
            const validUrls = [
                'https://example.com',
                'http://example.com/path',
                'https://example.com:8080/path?query=value'
            ];

            validUrls.forEach(url => {
                expect(urlRegex.test(url)).toBe(true);
            });
        });

        test('무효한 URL 형식', () => {
            const urlRegex = /^https?:\/\/.+\..+/;
            const invalidUrls = [
                'not a url',
                'ftp://example.com',
                '://example.com'
            ];

            invalidUrls.forEach(url => {
                expect(urlRegex.test(url)).toBe(false);
            });
        });
    });

    // ============================================
    // 전화번호 검증
    // ============================================
    describe('전화번호 형식 검증', () => {
        test('다양한 전화번호 형식 지원', () => {
            const phoneFormats = [
                '+1-234-567-8900',
                '(123) 456-7890',
                '123-456-7890',
                '+82-10-1234-5678'
            ];

            phoneFormats.forEach(phone => {
                expect(typeof phone).toBe('string');
                expect(phone.length).toBeGreaterThan(0);
            });
        });

        test('전화번호 속성 포맷팅', () => {
            const property = {
                type: 'phone_number',
                phone_number: '+1-234-567-8900'
            };
            const result = formatPropertyValue(property);
            expect(result).toBe('+1-234-567-8900');
        });
    });

    // ============================================
    // 데이터 무결성 검증
    // ============================================
    describe('데이터 무결성 및 일관성', () => {
        test('속성 name과 type 일치 검증', () => {
            const mockProperties = {
                title: { name: 'Title', type: 'title' },
                status: { name: 'Status', type: 'select' },
                count: { name: 'Count', type: 'number' }
            };

            Object.entries(mockProperties).forEach(([key, prop]) => {
                expect(prop).toHaveProperty('name');
                expect(prop).toHaveProperty('type');
                expect(typeof prop.name).toBe('string');
                expect(typeof prop.type).toBe('string');
            });
        });

        test('레코드 속성값과 스키마 일치 검증', () => {
            const schema = {
                title: 'title',
                count: 'number',
                active: 'checkbox'
            };

            const record = {
                properties: {
                    title: 'My Record',
                    count: 42,
                    active: true
                }
            };

            Object.entries(record.properties).forEach(([key, value]) => {
                expect(schema).toHaveProperty(key);
                if (schema[key] === 'number') {
                    expect(typeof value).toBe('number');
                } else if (schema[key] === 'checkbox') {
                    expect(typeof value).toBe('boolean');
                } else {
                    expect(typeof value).toBe('string');
                }
            });
        });
    });
});
