/**
 * 데이터베이스 서비스
 * 책임: 데이터베이스 조회 및 처리
 */

const { 
    searchDatabases, 
    getDatabaseStructure, 
    queryDatabase 
} = require('../utils/notionApi');
const { 
    formatDatabase, 
    formatDatabaseRecord 
} = require('../utils/propertyFormatter');
const { generateAlternativeIds } = require('../utils/formulaParser');

/**
 * 사용자의 모든 데이터베이스 조회
 */
async function getAllDatabases(accessToken) {
    const results = await searchDatabases(accessToken);
    
    return results.map(db => ({
        id: db.id,
        title: db.title?.[0]?.plain_text || 'Untitled',
        icon: db.icon,
        created_time: db.created_time,
        last_edited_time: db.last_edited_time
    }));
}

/**
 * 특정 데이터베이스의 구조 조회
 */
async function getDatabaseInfo(databaseId, accessToken) {
    const dbData = await getDatabaseStructure(databaseId, accessToken);
    return formatDatabase(dbData);
}

/**
 * 데이터베이스의 모든 레코드 조회 (페이지네이션 처리)
 */
async function getAllDatabaseRecords(databaseId, accessToken) {
    let allRecords = [];
    let hasMore = true;
    let cursor = null;

    while (hasMore) {
        const response = await queryDatabase(databaseId, accessToken, 100, cursor);
        
        allRecords = allRecords.concat(
            response.results.map(page => formatDatabaseRecord(page))
        );
        
        hasMore = response.has_more;
        cursor = response.next_cursor;
    }

    return allRecords;
}

/**
 * 데이터베이스 페이지 쿼리 (페이지네이션 지원)
 */
async function queryDatabasePages(databaseId, accessToken, pageSize = 10, startCursor = null) {
    const response = await queryDatabase(databaseId, accessToken, pageSize, startCursor);
    
    return {
        records: response.results.map(page => formatDatabaseRecord(page)),
        has_more: response.has_more,
        next_cursor: response.next_cursor
    };
}

/**
 * DB 속성 정보 구조화
 * propertyIdMap과 globalPropertyIdMap 생성
 */
function buildPropertyMaps(dbPropertiesMap) {
    const propertyIdMapByDb = new Map();
    const propertyNameMapByDb = new Map();
    const globalPropertyIdMap = {};
    
    for (const [dbId, dbInfo] of dbPropertiesMap.entries()) {
        const propertyIdMap = {};
        const propertyNameMap = {};
        let idCount = 0;
        let noIdCount = 0;
        
        if (dbInfo.properties) {
            dbInfo.properties.forEach(prop => {
                propertyNameMap[prop.name] = prop.name;
                
                if (prop.id) {
                    propertyIdMap[prop.id] = prop.name;
                    
                    globalPropertyIdMap[prop.id] = {
                        dbId: dbId,
                        dbName: dbInfo.databaseTitle,
                        fieldName: prop.name,
                        fieldType: prop.type
                    };
                    
                    // 대체 ID 형식 생성
                    const alternativeIds = generateAlternativeIds(prop.id);
                    alternativeIds.forEach(altId => {
                        if (!propertyIdMap[altId]) {
                            propertyIdMap[altId] = prop.name;
                        }
                        if (!globalPropertyIdMap[altId]) {
                            globalPropertyIdMap[altId] = {
                                dbId: dbId,
                                dbName: dbInfo.databaseTitle,
                                fieldName: prop.name,
                                fieldType: prop.type,
                                originalId: prop.id
                            };
                        }
                    });
                    
                    idCount++;
                } else {
                    propertyIdMap[prop.name] = prop.name;
                    noIdCount++;
                }
            });
        }
        
        propertyIdMapByDb.set(dbId, propertyIdMap);
        propertyNameMapByDb.set(dbId, propertyNameMap);
    }
    
    return { propertyIdMapByDb, propertyNameMapByDb, globalPropertyIdMap };
}

/**
 * DB 네트워크 노드 생성
 */
function createDatabaseNode(dbId, dbInfo, isCenter = false) {
    return {
        id: dbId,
        label: dbInfo.title,
        title: dbInfo.title,
        color: isCenter ? '#3498db' : '#95a5a6',
        font: { 
            size: isCenter ? 18 : 16,
            color: '#ffffff'
        },
        size: isCenter ? 40 : 35,
        physics: true,
        shapeProperties: {
            useBorderWithLabel: true
        }
    };
}

/**
 * DB 네트워크 엣지 생성
 */
function createDatabaseEdge(fromDbId, toDbId, label, relationInfo) {
    return {
        from: fromDbId,
        to: toDbId,
        label: label,
        title: relationInfo.map(r => `[${r.type}] ${r.name}`).join('\n'),
        relations: relationInfo,
        arrows: 'to',
        color: { color: '#bdc3c7', highlight: '#e74c3c' },
        font: { align: 'middle', size: 12 }
    };
}

module.exports = {
    getAllDatabases,
    getDatabaseInfo,
    getAllDatabaseRecords,
    queryDatabasePages,
    buildPropertyMaps,
    createDatabaseNode,
    createDatabaseEdge
};
