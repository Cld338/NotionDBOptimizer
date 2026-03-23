/**
 * Notion API 유틸리티
 * 책임: Notion API 호출 및 헤더 관리
 */

const axios = require('axios');

const NOTION_API_URL = 'https://api.notion.com/v1';

/**
 * Notion API 요청 헤더 생성
 */
function getNotionHeaders(accessToken) {
    return {
        'Authorization': `Bearer ${accessToken}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
    };
}

/**
 * 모든 데이터베이스 검색
 */
async function searchDatabases(accessToken) {
    const response = await axios.post(`${NOTION_API_URL}/search`, {
        filter: {
            value: 'database',
            property: 'object'
        }
    }, {
        headers: getNotionHeaders(accessToken)
    });

    return response.data.results;
}

/**
 * 데이터베이스 구조 조회
 */
async function getDatabaseStructure(databaseId, accessToken) {
    const response = await axios.get(`${NOTION_API_URL}/databases/${databaseId}`, {
        headers: getNotionHeaders(accessToken)
    });

    return response.data;
}

/**
 * 데이터베이스 내 페이지 쿼리
 */
async function queryDatabase(databaseId, accessToken, pageSize = 100, startCursor = null) {
    const data = {
        page_size: Math.min(pageSize, 100)
    };

    if (startCursor) {
        data.start_cursor = startCursor;
    }

    const response = await axios.post(
        `${NOTION_API_URL}/databases/${databaseId}/query`,
        data,
        { headers: getNotionHeaders(accessToken) }
    );

    return response.data;
}

/**
 * 페이지 블록 조회
 */
async function getPageBlocks(pageId, accessToken) {
    const response = await axios.get(`${NOTION_API_URL}/blocks/${pageId}/children`, {
        headers: getNotionHeaders(accessToken)
    });

    return response.data.results;
}

module.exports = {
    getNotionHeaders,
    searchDatabases,
    getDatabaseStructure,
    queryDatabase,
    getPageBlocks,
    NOTION_API_URL
};
