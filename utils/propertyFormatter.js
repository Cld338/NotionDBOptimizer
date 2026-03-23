/**
 * 속성 값 포맷팅 유틸리티
 * 책임: Notion 속성 값을 일관된 형식으로 포맷팅
 */

/**
 * Notion 속성 값을 표준 형식으로 포맷
 */
function formatPropertyValue(property) {
    const type = property.type;

    switch (type) {
        case 'title':
            return property.title.map(t => t.plain_text).join('');
        case 'rich_text':
            return property.rich_text.map(t => t.plain_text).join('');
        case 'checkbox':
            return property.checkbox;
        case 'select':
            return property.select?.name || null;
        case 'multi_select':
            return property.multi_select.map(s => s.name);
        case 'date':
            return property.date?.start || null;
        case 'number':
            return property.number;
        case 'email':
            return property.email;
        case 'phone_number':
            return property.phone_number;
        case 'url':
            return property.url;
        case 'people':
            return property.people.map(p => p.name);
        case 'relation':
            return property.relation.map(r => r.id);
        case 'rollup':
            if (property.rollup.type === 'array') {
                return property.rollup.array || [];
            } else if (property.rollup.type === 'string') {
                return property.rollup.string || null;
            } else if (property.rollup.type === 'number') {
                return property.rollup.number;
            }
            return property.rollup;
        case 'formula':
            if (property.formula.type === 'string') {
                return property.formula.string || null;
            } else if (property.formula.type === 'number') {
                return property.formula.number;
            } else if (property.formula.type === 'boolean') {
                return property.formula.boolean;
            } else if (property.formula.type === 'date') {
                return property.formula.date;
            }
            return property.formula;
        case 'created_time':
            return property.created_time;
        case 'last_edited_time':
            return property.last_edited_time;
        case 'created_by':
            return property.created_by?.name || null;
        case 'last_edited_by':
            return property.last_edited_by?.name || null;
        case 'files':
            return property.files.map(f => f.name);
        case 'button':
            return null; // 버튼은 데이터 필드 아님
        default:
            return null;
    }
}

/**
 * 데이터베이스 레코드를 표준 형식으로 포맷
 */
function formatDatabaseRecord(page) {
    const properties = {};
    for (const [key, value] of Object.entries(page.properties)) {
        properties[key] = formatPropertyValue(value);
    }

    return {
        id: page.id,
        created_time: page.created_time,
        last_edited_time: page.last_edited_time,
        properties: properties
    };
}

/**
 * 데이터베이스 메타데이터를 표준 형식으로 포맷
 */
function formatDatabase(dbData, title = null) {
    return {
        id: dbData.id,
        title: title || dbData.title?.[0]?.plain_text || 'Untitled',
        icon: dbData.icon,
        properties: dbData.properties,
        created_time: dbData.created_time,
        last_edited_time: dbData.last_edited_time
    };
}

module.exports = {
    formatPropertyValue,
    formatDatabaseRecord,
    formatDatabase
};
