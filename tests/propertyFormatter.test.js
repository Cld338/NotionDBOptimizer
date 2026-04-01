/**
 * propertyFormatter.test.js
 * TDD 테스트: Notion 속성 포맷팅 유틸리티
 */

const {
    formatPropertyValue,
    formatDatabaseRecord,
    formatDatabase
} = require('../utils/propertyFormatter');

describe('formatPropertyValue', () => {
    describe('title 타입', () => {
        test('단일 title 텍스트를 문자열로 포맷', () => {
            const property = {
                type: 'title',
                title: [{ plain_text: 'My Title' }]
            };
            expect(formatPropertyValue(property)).toBe('My Title');
        });

        test('여러 title 요소를 연결', () => {
            const property = {
                type: 'title',
                title: [
                    { plain_text: 'Hello ' },
                    { plain_text: 'World' }
                ]
            };
            expect(formatPropertyValue(property)).toBe('Hello World');
        });

        test('빈 title 배열을 빈 문자열로 포맷', () => {
            const property = {
                type: 'title',
                title: []
            };
            expect(formatPropertyValue(property)).toBe('');
        });
    });

    describe('rich_text 타입', () => {
        test('단일 rich_text를 문자열로 포맷', () => {
            const property = {
                type: 'rich_text',
                rich_text: [{ plain_text: 'Rich text content' }]
            };
            expect(formatPropertyValue(property)).toBe('Rich text content');
        });

        test('여러 rich_text 요소를 연결', () => {
            const property = {
                type: 'rich_text',
                rich_text: [
                    { plain_text: 'Part 1 ' },
                    { plain_text: 'Part 2' }
                ]
            };
            expect(formatPropertyValue(property)).toBe('Part 1 Part 2');
        });
    });

    describe('checkbox 타입', () => {
        test('true 값을 그대로 반환', () => {
            const property = {
                type: 'checkbox',
                checkbox: true
            };
            expect(formatPropertyValue(property)).toBe(true);
        });

        test('false 값을 그대로 반환', () => {
            const property = {
                type: 'checkbox',
                checkbox: false
            };
            expect(formatPropertyValue(property)).toBe(false);
        });
    });

    describe('select 타입', () => {
        test('선택된 값의 name을 반환', () => {
            const property = {
                type: 'select',
                select: { name: 'Option A' }
            };
            expect(formatPropertyValue(property)).toBe('Option A');
        });

        test('선택되지 않은 경우 null 반환', () => {
            const property = {
                type: 'select',
                select: null
            };
            expect(formatPropertyValue(property)).toBeNull();
        });
    });

    describe('multi_select 타입', () => {
        test('선택된 항목들의 name 배열을 반환', () => {
            const property = {
                type: 'multi_select',
                multi_select: [
                    { name: 'Tag1' },
                    { name: 'Tag2' },
                    { name: 'Tag3' }
                ]
            };
            expect(formatPropertyValue(property)).toEqual(['Tag1', 'Tag2', 'Tag3']);
        });

        test('선택되지 않은 경우 빈 배열 반환', () => {
            const property = {
                type: 'multi_select',
                multi_select: []
            };
            expect(formatPropertyValue(property)).toEqual([]);
        });
    });

    describe('date 타입', () => {
        test('날짜 시작 값을 반환', () => {
            const property = {
                type: 'date',
                date: { start: '2024-01-15' }
            };
            expect(formatPropertyValue(property)).toBe('2024-01-15');
        });

        test('날짜가 null인 경우 null 반환', () => {
            const property = {
                type: 'date',
                date: null
            };
            expect(formatPropertyValue(property)).toBeNull();
        });
    });

    describe('number 타입', () => {
        test('숫자 값을 그대로 반환', () => {
            const property = {
                type: 'number',
                number: 42
            };
            expect(formatPropertyValue(property)).toBe(42);
        });

        test('0을 포함한 숫자 반환', () => {
            const property = {
                type: 'number',
                number: 0
            };
            expect(formatPropertyValue(property)).toBe(0);
        });

        test('음수 반환', () => {
            const property = {
                type: 'number',
                number: -5
            };
            expect(formatPropertyValue(property)).toBe(-5);
        });
    });

    describe('email 타입', () => {
        test('이메일 주소 반환', () => {
            const property = {
                type: 'email',
                email: 'test@example.com'
            };
            expect(formatPropertyValue(property)).toBe('test@example.com');
        });

        test('빈 이메일 반환', () => {
            const property = {
                type: 'email',
                email: ''
            };
            expect(formatPropertyValue(property)).toBe('');
        });
    });

    describe('phone_number 타입', () => {
        test('전화번호 반환', () => {
            const property = {
                type: 'phone_number',
                phone_number: '+1-234-567-8900'
            };
            expect(formatPropertyValue(property)).toBe('+1-234-567-8900');
        });
    });

    describe('url 타입', () => {
        test('URL 반환', () => {
            const property = {
                type: 'url',
                url: 'https://example.com'
            };
            expect(formatPropertyValue(property)).toBe('https://example.com');
        });
    });

    describe('people 타입', () => {
        test('사람 이름 배열 반환', () => {
            const property = {
                type: 'people',
                people: [
                    { name: 'Alice' },
                    { name: 'Bob' }
                ]
            };
            expect(formatPropertyValue(property)).toEqual(['Alice', 'Bob']);
        });

        test('빈 people 배열 반환', () => {
            const property = {
                type: 'people',
                people: []
            };
            expect(formatPropertyValue(property)).toEqual([]);
        });
    });

    describe('relation 타입', () => {
        test('relation ID 배열 반환', () => {
            const property = {
                type: 'relation',
                relation: [
                    { id: 'id-1' },
                    { id: 'id-2' }
                ]
            };
            expect(formatPropertyValue(property)).toEqual(['id-1', 'id-2']);
        });
    });

    describe('rollup 타입', () => {
        test('array 타입 rollup 반환', () => {
            const property = {
                type: 'rollup',
                rollup: {
                    type: 'array',
                    array: [1, 2, 3]
                }
            };
            expect(formatPropertyValue(property)).toEqual([1, 2, 3]);
        });

        test('string 타입 rollup 반환', () => {
            const property = {
                type: 'rollup',
                rollup: {
                    type: 'string',
                    string: 'rolled-up value'
                }
            };
            expect(formatPropertyValue(property)).toBe('rolled-up value');
        });

        test('number 타입 rollup 반환', () => {
            const property = {
                type: 'rollup',
                rollup: {
                    type: 'number',
                    number: 100
                }
            };
            expect(formatPropertyValue(property)).toBe(100);
        });

        test('빈 array rollup은 빈 배열 반환', () => {
            const property = {
                type: 'rollup',
                rollup: {
                    type: 'array',
                    array: null
                }
            };
            expect(formatPropertyValue(property)).toEqual([]);
        });
    });

    describe('formula 타입', () => {
        test('string 타입 formula 반환', () => {
            const property = {
                type: 'formula',
                formula: {
                    type: 'string',
                    string: 'formula result'
                }
            };
            expect(formatPropertyValue(property)).toBe('formula result');
        });

        test('number 타입 formula 반환', () => {
            const property = {
                type: 'formula',
                formula: {
                    type: 'number',
                    number: 42
                }
            };
            expect(formatPropertyValue(property)).toBe(42);
        });

        test('boolean 타입 formula 반환', () => {
            const property = {
                type: 'formula',
                formula: {
                    type: 'boolean',
                    boolean: true
                }
            };
            expect(formatPropertyValue(property)).toBe(true);
        });

        test('date 타입 formula 반환', () => {
            const property = {
                type: 'formula',
                formula: {
                    type: 'date',
                    date: '2024-01-15'
                }
            };
            expect(formatPropertyValue(property)).toBe('2024-01-15');
        });
    });

    describe('timestamp 타입', () => {
        test('created_time 반환', () => {
            const property = {
                type: 'created_time',
                created_time: '2024-01-01T12:00:00.000Z'
            };
            expect(formatPropertyValue(property)).toBe('2024-01-01T12:00:00.000Z');
        });

        test('last_edited_time 반환', () => {
            const property = {
                type: 'last_edited_time',
                last_edited_time: '2024-01-15T15:30:00.000Z'
            };
            expect(formatPropertyValue(property)).toBe('2024-01-15T15:30:00.000Z');
        });
    });

    describe('user 타입', () => {
        test('created_by 이름 반환', () => {
            const property = {
                type: 'created_by',
                created_by: { name: 'John Doe' }
            };
            expect(formatPropertyValue(property)).toBe('John Doe');
        });

        test('created_by가 null인 경우 null 반환', () => {
            const property = {
                type: 'created_by',
                created_by: null
            };
            expect(formatPropertyValue(property)).toBeNull();
        });

        test('last_edited_by 이름 반환', () => {
            const property = {
                type: 'last_edited_by',
                last_edited_by: { name: 'Jane Smith' }
            };
            expect(formatPropertyValue(property)).toBe('Jane Smith');
        });
    });

    describe('files 타입', () => {
        test('파일 이름 배열 반환', () => {
            const property = {
                type: 'files',
                files: [
                    { name: 'document.pdf' },
                    { name: 'image.png' }
                ]
            };
            expect(formatPropertyValue(property)).toEqual(['document.pdf', 'image.png']);
        });

        test('빈 files 배열 반환', () => {
            const property = {
                type: 'files',
                files: []
            };
            expect(formatPropertyValue(property)).toEqual([]);
        });
    });

    describe('button 타입', () => {
        test('button은 null 반환', () => {
            const property = {
                type: 'button'
            };
            expect(formatPropertyValue(property)).toBeNull();
        });
    });

    describe('unknown 타입', () => {
        test('미지원 타입은 null 반환', () => {
            const property = {
                type: 'unknown_type'
            };
            expect(formatPropertyValue(property)).toBeNull();
        });
    });
});

describe('formatDatabaseRecord', () => {
    test('페이지 객체를 포맷된 레코드로 변환', () => {
        const page = {
            id: 'page-123',
            created_time: '2024-01-01T00:00:00.000Z',
            last_edited_time: '2024-01-15T10:00:00.000Z',
            properties: {
                'Title': {
                    type: 'title',
                    title: [{ plain_text: 'Test Title' }]
                },
                'Status': {
                    type: 'select',
                    select: { name: 'Active' }
                },
                'Count': {
                    type: 'number',
                    number: 5
                }
            }
        };

        const result = formatDatabaseRecord(page);

        expect(result).toEqual({
            id: 'page-123',
            created_time: '2024-01-01T00:00:00.000Z',
            last_edited_time: '2024-01-15T10:00:00.000Z',
            properties: {
                'Title': 'Test Title',
                'Status': 'Active',
                'Count': 5
            }
        });
    });

    test('빈 properties를 처리', () => {
        const page = {
            id: 'page-456',
            created_time: '2024-01-01T00:00:00.000Z',
            last_edited_time: '2024-01-15T10:00:00.000Z',
            properties: {}
        };

        const result = formatDatabaseRecord(page);

        expect(result.properties).toEqual({});
        expect(result.id).toBe('page-456');
    });

    test('다양한 속성 타입 포함', () => {
        const page = {
            id: 'page-789',
            created_time: '2024-01-01T00:00:00.000Z',
            last_edited_time: '2024-01-15T10:00:00.000Z',
            properties: {
                'Name': {
                    type: 'title',
                    title: [{ plain_text: 'John' }]
                },
                'Tags': {
                    type: 'multi_select',
                    multi_select: [{ name: 'important' }, { name: 'work' }]
                },
                'Completed': {
                    type: 'checkbox',
                    checkbox: true
                }
            }
        };

        const result = formatDatabaseRecord(page);

        expect(result.properties).toEqual({
            'Name': 'John',
            'Tags': ['important', 'work'],
            'Completed': true
        });
    });
});

describe('formatDatabase', () => {
    test('데이터베이스 메타데이터를 포맷된 형태로 반환', () => {
        const dbData = {
            id: 'db-123',
            title: [{ plain_text: 'My Database' }],
            icon: { emoji: '📚' },
            properties: { 'Name': {}, 'Status': {} },
            created_time: '2024-01-01T00:00:00.000Z',
            last_edited_time: '2024-01-15T10:00:00.000Z'
        };

        const result = formatDatabase(dbData);

        expect(result).toEqual({
            id: 'db-123',
            title: 'My Database',
            icon: { emoji: '📚' },
            properties: { 'Name': {}, 'Status': {} },
            created_time: '2024-01-01T00:00:00.000Z',
            last_edited_time: '2024-01-15T10:00:00.000Z'
        });
    });

    test('title이 없을 때 기본값 사용', () => {
        const dbData = {
            id: 'db-456',
            title: null,
            icon: null,
            properties: {},
            created_time: '2024-01-01T00:00:00.000Z',
            last_edited_time: '2024-01-15T10:00:00.000Z'
        };

        const result = formatDatabase(dbData);

        expect(result.title).toBe('Untitled');
    });

    test('커스텀 title 파라미터 사용', () => {
        const dbData = {
            id: 'db-789',
            title: [{ plain_text: 'Original Title' }],
            icon: null,
            properties: {},
            created_time: '2024-01-01T00:00:00.000Z',
            last_edited_time: '2024-01-15T10:00:00.000Z'
        };

        const result = formatDatabase(dbData, 'Custom Title');

        expect(result.title).toBe('Custom Title');
    });

    test('title 배열이 비어있을 때 기본값 사용', () => {
        const dbData = {
            id: 'db-101',
            title: [],
            icon: null,
            properties: {},
            created_time: '2024-01-01T00:00:00.000Z',
            last_edited_time: '2024-01-15T10:00:00.000Z'
        };

        const result = formatDatabase(dbData);

        expect(result.title).toBe('Untitled');
    });
});
