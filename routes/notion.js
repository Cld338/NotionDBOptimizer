/**
 * Notion API 라우터
 * 책임: HTTP 라우트 정의 및 요청/응답 처리
 */

const express = require('express');
const router = express.Router();

// 서비스 임포트
const { 
    getAllDatabases, 
    getDatabaseInfo, 
    getAllDatabaseRecords, 
    queryDatabasePages,
    buildPropertyMaps,
    createDatabaseNode,
    createDatabaseEdge
} = require('../services/databaseService');

const { analyzeDatabase } = require('../services/analyzerService');
const { buildReferenceChains } = require('../services/chainAnalyzer');
const { extractFieldReferencesFromFormula } = require('../utils/formulaParser');
const { getNotionHeaders, searchDatabases, getDatabaseStructure } = require('../utils/notionApi');
const { getCachedData, setCachedData, deleteCachedData } = require('../services/cacheService');

// ===========================
// 1. 데이터베이스 조회
// ===========================

/**
 * GET /api/notion/databases
 * 사용자의 모든 데이터베이스 조회
 */
router.get('/databases', async (req, res) => {
    try {
        const accessToken = req.session.user.accessToken;
        
        // 사용자별 캐시 키 생성 (accessToken의 처음 20자로 간단하게)
        const userKey = accessToken.substring(0, 20);
        const cacheKey = `databases:${userKey}`;
        
        // 캐시 확인
        const cachedDatabases = await getCachedData(cacheKey);
        if (cachedDatabases) {
            return res.json({ databases: cachedDatabases });
        }
        
        const databases = await getAllDatabases(accessToken);
        
        // 캐시에 저장 (30분)
        await setCachedData(cacheKey, databases, 1800);
        
        res.json({ databases });
    } catch (error) {
        console.error('데이터베이스 조회 에러:', error.message);
        res.status(500).json({ error: '데이터베이스 조회 실패' });
    }
});

/**
 * POST /api/databases/refresh
 * DB 목록 캐시 초기화 및 재생성
 */
router.post('/databases/refresh', async (req, res) => {
    try {
        const accessToken = req.session.user.accessToken;
        const userKey = accessToken.substring(0, 20);
        const cacheKey = `databases:${userKey}`;
        
        // 캐시 삭제
        await deleteCachedData(cacheKey);
        
        // 새로운 데이터 조회
        const databases = await getAllDatabases(accessToken);
        
        // 캐시에 저장 (30분)
        await setCachedData(cacheKey, databases, 1800);
        
        res.json({ success: true, databases });
    } catch (error) {
        console.error('DB 목록 캐시 새로 고침 에러:', error.message);
        res.status(500).json({ error: 'DB 목록 캐시 새로 고침 실패' });
    }
});

/**
 * GET /api/database/:databaseId
 * 특정 데이터베이스의 구조 조회
 */
router.get('/database/:databaseId', async (req, res) => {
    try {
        const { databaseId } = req.params;
        const accessToken = req.session.user.accessToken;
        
        // 캐시 확인
        const cacheKey = `database-structure:${databaseId}`;
        const cachedDatabase = await getCachedData(cacheKey);
        if (cachedDatabase) {
            return res.json(cachedDatabase);
        }
        
        const database = await getDatabaseInfo(databaseId, accessToken);
        
        // 캐시에 저장 (30분)
        await setCachedData(cacheKey, database, 1800);
        
        res.json(database);
    } catch (error) {
        console.error('데이터베이스 구조 조회 에러:', error.message);
        res.status(500).json({ error: '데이터베이스 구조 조회 실패' });
    }
});

/**
 * POST /api/database/:databaseId/refresh
 * DB 구조 캐시 초기화 및 재생성
 */
router.post('/database/:databaseId/refresh', async (req, res) => {
    try {
        const { databaseId } = req.params;
        const accessToken = req.session.user.accessToken;
        const cacheKey = `database-structure:${databaseId}`;
        
        // 캐시 삭제
        await deleteCachedData(cacheKey);
        
        // 새로운 데이터 조회
        const database = await getDatabaseInfo(databaseId, accessToken);
        
        // 캐시에 저장 (30분)
        await setCachedData(cacheKey, database, 1800);
        
        res.json({ success: true, database });
    } catch (error) {
        console.error('DB 구조 캐시 새로 고침 에러:', error.message);
        res.status(500).json({ error: 'DB 구조 캐시 새로 고침 실패' });
    }
});

/**
 * POST /api/notion/database/:databaseId/query
 * 데이터베이스의 레코드 조회 (페이지네이션 지원)
 */
router.post('/database/:databaseId/query', async (req, res) => {
    try {
        const { databaseId } = req.params;
        const accessToken = req.session.user.accessToken;
        const { page_size = 10, start_cursor = null } = req.body;

        const result = await queryDatabasePages(databaseId, accessToken, page_size, start_cursor);
        res.json(result);
    } catch (error) {
        console.error('레코드 조회 에러:', error.message);
        res.status(500).json({ error: '레코드 조회 실패' });
    }
});

/**
 * GET /api/notion/page/:pageId/blocks
 * 페이지 내용 조회
 */
router.get('/page/:pageId/blocks', async (req, res) => {
    try {
        const { pageId } = req.params;
        const accessToken = req.session.user.accessToken;

        const response = await getDatabaseStructure(pageId, accessToken); // 기존 API 재사용
        res.json({ blocks: response.results });
    } catch (error) {
        console.error('페이지 내용 조회 에러:', error.message);
        res.status(500).json({ error: '페이지 내용 조회 실패' });
    }
});

// ===========================
// 2. 데이터 분석
// ===========================

/**
 * GET /api/notion/analyze/:databaseId
 * 데이터베이스 분석 (완성도, 품질 점수 등) + 참조 체인 분석
 */
router.get('/analyze/:databaseId', async (req, res) => {
    try {
        const { databaseId } = req.params;
        const accessToken = req.session.user.accessToken;
        const debugMode = req.query.debug === 'true';

        // 캐시 확인
        const cacheKey = `analysis:${databaseId}`;
        const cachedAnalysis = await getCachedData(cacheKey);
        if (cachedAnalysis) {
            return res.json(cachedAnalysis);
        }

        // 데이터베이스 구조 조회
        const dbResponse = await getDatabaseStructure(databaseId, accessToken);
        const properties = dbResponse.properties;
        const propertyNames = Object.keys(properties);

        // 모든 레코드 조회
        const records = await getAllDatabaseRecords(databaseId, accessToken);

        // 참조 체인 분석 (깊은 참조 경로 감지용)
        let referenceChains = [];
        try {
            if (debugMode) {
                console.log('[분석 API] 네트워크 분석 시작...');
            }
            const networkData = await _buildDatabaseNetwork(databaseId, accessToken, debugMode);
            if (debugMode) {
                console.log('[분석 API] 네트워크 분석 완료, dbPropertiesMap 크기:', networkData.dbPropertiesMap.size);
            }
            
            referenceChains = _analyzeReferenceChains(networkData.dbPropertiesMap, debugMode);
            if (debugMode || referenceChains.length > 0) {
                console.log('[분석 API] 참조 체인 분석 완료:', referenceChains.length, '개');
            }
        } catch (chainError) {
            console.error('[분석 API] 참조 체인 분석 오류:', chainError.message);
            if (debugMode) {
                console.error('[분석 API] 오류 스택:', chainError.stack);
            }
            // 참조 체인 분석 오류는 무시하고 기본 분석 계속 진행
        }

        // 분석 실행 (참조 체인 포함)
        const analysis = analyzeDatabase(records, properties, propertyNames, {}, referenceChains);

        // 캐시에 저장 (10분)
        await setCachedData(cacheKey, analysis, 600);

        res.json(analysis);
    } catch (error) {
        console.error('데이터베이스 분석 에러:', error.message);
        res.status(500).json({ error: '데이터베이스 분석 실패' });
    }
});

/**
 * POST /api/analyze/:databaseId/refresh
 * 분석 캐시 초기화 및 재생성 + 참조 체인 분석
 */
router.post('/analyze/:databaseId/refresh', async (req, res) => {
    try {
        const { databaseId } = req.params;
        const accessToken = req.session.user.accessToken;
        const debugMode = req.query.debug === 'true';

        const cacheKey = `analysis:${databaseId}`;
        await deleteCachedData(cacheKey);

        // 데이터베이스 구조 조회
        const dbResponse = await getDatabaseStructure(databaseId, accessToken);
        const properties = dbResponse.properties;
        const propertyNames = Object.keys(properties);

        // 모든 레코드 조회
        const records = await getAllDatabaseRecords(databaseId, accessToken);

        // 참조 체인 분석 (깊은 참조 경로 감지용)
        let referenceChains = [];
        try {
            const networkData = await _buildDatabaseNetwork(databaseId, accessToken, debugMode);
            referenceChains = _analyzeReferenceChains(networkData.dbPropertiesMap, debugMode);
            if (debugMode) {
                console.log('[분석 API Refresh] 참조 체인 분석 완료:', referenceChains.length, '개');
            }
        } catch (chainError) {
            if (debugMode) {
                console.log('[분석 API Refresh] 참조 체인 분석 중 오류 (계속 진행):', chainError.message);
            }
            // 참조 체인 분석 오류는 무시하고 기본 분석 계속 진행
        }

        // 분석 실행 (참조 체인 포함)
        const analysis = analyzeDatabase(records, properties, propertyNames, {}, referenceChains);

        // 캐시에 저장 (10분)
        await setCachedData(cacheKey, analysis, 600);

        res.json({ success: true, data: analysis });
    } catch (error) {
        console.error('분석 캐시 새로 고침 에러:', error.message);
        res.status(500).json({ error: '분석 캐시 새로 고침 실패' });
    }
});

// ===========================
// 3. 네트워크 및 참조 체인 분석
// ===========================

/**
 * GET /api/notion/network/:databaseId
 * 데이터베이스 네트워크 및 참조 체인 분석
 * 쿼리 파라미터: ?debug=true/false (디버그 로깅)
 */
router.get('/network/:databaseId', async (req, res) => {
    try {
        const { databaseId } = req.params;
        const { debug = 'false' } = req.query;
        const debugMode = debug === 'true' || debug === '1';
        const accessToken = req.session.user.accessToken;

        // 캐시 확인
        const cacheKey = `network:${databaseId}`;
        const cachedNetwork = await getCachedData(cacheKey);
        if (cachedNetwork) {
            return res.json(cachedNetwork);
        }

        if (debugMode) {
            console.log(`\n${'='.repeat(70)}`);
            console.log('🔗 DB Reference Chain Analysis Started');
            console.log(`${'='.repeat(70)}\n`);
        }

        // 단계 1: 모든 데이터베이스 조회 및 맵 구성
        const result = await _buildDatabaseNetwork(databaseId, accessToken, debugMode);

        // 단계 2: 참조 체인 분석
        const referenceChains = _analyzeReferenceChains(result.dbPropertiesMap, debugMode);

        if (debugMode) {
            console.log(`${'='.repeat(70)}`);
            console.log('✅ DB Reference Chain Analysis Completed');
            console.log(`${'='.repeat(70)}\n`);
        }

        const networkData = {
            nodes: result.nodes,
            edges: result.edges,
            centerDatabaseId: databaseId,
            propertiesInfo: Object.fromEntries(result.dbPropertiesMap),
            referenceChains: referenceChains
        };

        // 캐시에 저장 (10분)
        await setCachedData(cacheKey, networkData, 600);

        res.json(networkData);
    } catch (error) {
        console.error('DB 네트워크 분석 에러:', error.message);
        res.status(500).json({ error: 'DB 네트워크 분석 실패' });
    }
});

/**
 * POST /api/network/:databaseId/refresh
 * 네트워크 캐시 초기화 및 재생성
 */
router.post('/network/:databaseId/refresh', async (req, res) => {
    try {
        const { databaseId } = req.params;
        const accessToken = req.session.user.accessToken;

        const cacheKey = `network:${databaseId}`;
        await deleteCachedData(cacheKey);

        // 단계 1: 모든 데이터베이스 조회 및 맵 구성
        const result = await _buildDatabaseNetwork(databaseId, accessToken, false);

        // 단계 2: 참조 체인 분석
        const referenceChains = _analyzeReferenceChains(result.dbPropertiesMap, false);

        const networkData = {
            nodes: result.nodes,
            edges: result.edges,
            centerDatabaseId: databaseId,
            propertiesInfo: Object.fromEntries(result.dbPropertiesMap),
            referenceChains: referenceChains
        };

        // 캐시에 저장 (10분)
        await setCachedData(cacheKey, networkData, 600);

        res.json({ success: true, data: networkData });
    } catch (error) {
        console.error('네트워크 캐시 새로 고침 에러:', error.message);
        res.status(500).json({ error: '네트워크 캐시 새로 고침 실패' });
    }
});

/**
 * POST /api/prefetch/:databaseId
 * 백그라운드에서 네트워크 및 분석 데이터 미리 가져오기
 * 반응 즉시 반환, 실패해도 무시 (사용자 경험 향상)
 */
router.post('/prefetch/:databaseId', async (req, res) => {
    try {
        const { databaseId } = req.params;
        const { types = 'network,analysis' } = req.query;
        const accessToken = req.session.user.accessToken;

        // 즉시 응답
        res.json({ success: true, message: 'Prefetch started in background' });

        // 백그라운드 처리 (응답 완료 후)
        setImmediate(async () => {
            try {
                const typeArray = types.split(',').map(t => t.trim());

                // 네트워크 데이터 프리페치
                if (typeArray.includes('network')) {
                    const networkCacheKey = `network:${databaseId}`;
                    const existingNetworkCache = await getCachedData(networkCacheKey);
                    
                    if (!existingNetworkCache) {
                        try {
                            const result = await _buildDatabaseNetwork(databaseId, accessToken, false);
                            const referenceChains = _analyzeReferenceChains(result.dbPropertiesMap, false);
                            const networkData = {
                                nodes: result.nodes,
                                edges: result.edges,
                                centerDatabaseId: databaseId,
                                propertiesInfo: Object.fromEntries(result.dbPropertiesMap),
                                referenceChains: referenceChains
                            };
                            await setCachedData(networkCacheKey, networkData, 600);
                            console.log(`[Prefetch] Network data cached for DB: ${databaseId}`);
                        } catch (err) {
                            console.warn(`[Prefetch] Failed to prefetch network data for DB ${databaseId}:`, err.message);
                        }
                    }
                }

                // 분석 데이터 프리페치
                if (typeArray.includes('analysis')) {
                    const analysisCacheKey = `analysis:${databaseId}`;
                    const existingAnalysisCache = await getCachedData(analysisCacheKey);
                    
                    if (!existingAnalysisCache) {
                        try {
                            const dbResponse = await getDatabaseStructure(databaseId, accessToken);
                            const properties = dbResponse.properties;
                            const propertyNames = Object.keys(properties);
                            const records = await getAllDatabaseRecords(databaseId, accessToken);
                            const analysis = analyzeDatabase(records, properties, propertyNames);
                            await setCachedData(analysisCacheKey, analysis, 600);
                            console.log(`[Prefetch] Analysis data cached for DB: ${databaseId}`);
                        } catch (err) {
                            console.warn(`[Prefetch] Failed to prefetch analysis data for DB ${databaseId}:`, err.message);
                        }
                    }
                }
            } catch (err) {
                console.warn('[Prefetch] Background prefetch error:', err.message);
                // 백그라운드 작업 실패는 무시
            }
        });
    } catch (error) {
        console.error('프리페치 초기화 에러:', error.message);
        res.status(500).json({ error: '프리페치 초기화 실패' });
    }
});

// ===========================
// 헬퍼 함수
// ===========================

/**
 * 데이터베이스 네트워크 구성 (노드, 엣지)
 * 최적화: MAX_DATABASES_TO_FETCH 제한 및 기본 캐싱 추가
 */
async function _buildDatabaseNetwork(centerDatabaseId, accessToken, debugMode) {
    const MAX_DATABASES_TO_FETCH = 50; // 최대 50개 데이터베이스만 분석
    const API_TIMEOUT = 5000; // 각 API 호출 5초 타임아웃
    
    const searchResponse = await searchDatabases(accessToken);
    const allDatabases = searchResponse;
    
    const dbMap = new Map();
    const dbPropertiesMap = new Map();
    const nodes = [];
    const edgesMap = new Map();
    const visitedDbs = new Set();

    // 데이터베이스 맵 생성
    allDatabases.forEach(db => {
        dbMap.set(db.id, {
            id: db.id,
            title: db.title?.[0]?.plain_text || 'Untitled',
            icon: db.icon?.emoji || '📊'
        });
    });

    // 현재 DB를 중심으로 관련 DB 찾기 (BFS) - 최대 MAX_DATABASES_TO_FETCH개만
    const queue = [centerDatabaseId];

    while (queue.length > 0 && visitedDbs.size < MAX_DATABASES_TO_FETCH) {
        const currentDbId = queue.shift();
        
        if (visitedDbs.has(currentDbId)) continue;
        visitedDbs.add(currentDbId);

        const dbInfo = dbMap.get(currentDbId);
        if (!dbInfo) continue;

        // 노드 추가
        nodes.push(createDatabaseNode(currentDbId, dbInfo, currentDbId === centerDatabaseId));

        // DB 구조 조회 (타임아웃 포함)
        try {
            const dbResponse = await Promise.race([
                getDatabaseStructure(currentDbId, accessToken),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('API timeout')), API_TIMEOUT)
                )
            ]);
            const properties = dbResponse.properties;
            const propertiesList = [];

            // DB의 모든 필드명 미리 수집 (formula 파싱에 필요)
            const allFieldNames = Object.values(properties).map(p => p.name);
            
            // DB의 모든 필드 ID를 이름으로 매핑 (formula 파싱을 위해)
            const propertyIdMap = {};
            Object.entries(properties).forEach(([propKey, property]) => {
                const actualPropertyId = property.id || propKey;
                propertyIdMap[actualPropertyId] = property.name;
                propertyIdMap[propKey] = property.name;  // propKey도 매핑
            });

            // relation 필드와 rollup 필드 처리
            for (const [propKey, property] of Object.entries(properties)) {
                const actualPropertyId = property.id || propKey;
                
                if (property.type === 'relation') {
                    const relatedDbId = property.relation.database_id;
                    const relatedDbInfo = dbMap.get(relatedDbId);

                    if (relatedDbInfo) {
                        const edgeKey = `${currentDbId}|${relatedDbId}`;
                        const relationInfo = {
                            name: property.name,
                            type: 'relation',
                            propertyId: propKey,
                            relationField: property.relation.synced_property_name || property.name
                        };

                        propertiesList.push({
                            name: property.name,
                            type: 'relation',
                            id: actualPropertyId,
                            referencedDatabase: relatedDbInfo.title,
                            referencedDatabaseId: relatedDbId
                        });

                        _updateEdge(edgesMap, edgeKey, currentDbId, relatedDbId, relationInfo);

                        // 큐에 추가 (방문한 DB 체크)
                        if (!visitedDbs.has(relatedDbId) && visitedDbs.size < MAX_DATABASES_TO_FETCH) {
                            queue.push(relatedDbId);
                        }
                    }
                } else if (property.type === 'rollup') {
                    const relationPropertyName = property.rollup.relation_property_name;
                    
                    for (const [relPropKey, relProperty] of Object.entries(properties)) {
                        if (relProperty.type === 'relation' && relProperty.name === relationPropertyName) {
                            const relatedDbId = relProperty.relation.database_id;
                            const relatedDbInfo = dbMap.get(relatedDbId);

                            if (relatedDbInfo) {
                                const edgeKey = `${currentDbId}|${relatedDbId}`;
                                const rollupInfo = {
                                    name: property.name,
                                    type: 'rollup',
                                    propertyId: propKey,
                                    relatedProperty: property.rollup.rollup_property_name,
                                    relationField: relationPropertyName,
                                    aggregationFunction: property.rollup.function
                                };

                                propertiesList.push({
                                    name: property.name,
                                    type: 'rollup',
                                    id: actualPropertyId,
                                    referencedDatabase: relatedDbInfo.title,
                                    referencedDatabaseId: relatedDbId,
                                    referencedProperty: property.rollup.rollup_property_name,
                                    relationField: relationPropertyName,
                                    aggregationFunction: property.rollup.function
                                });

                                _updateEdge(edgesMap, edgeKey, currentDbId, relatedDbId, rollupInfo);
                            }
                            break;
                        }
                    }
                } else if (property.type === 'formula') {
                    // Formula 필드에서 참조 대상 필드명 추출
                    const expression = property.formula?.expression || '';
                    const referencedFields = expression ? extractFieldReferencesFromFormula(
                        expression,
                        allFieldNames,
                        propertyIdMap,
                        {},
                        debugMode
                    ) : [];

                    propertiesList.push({
                        name: property.name,
                        type: 'formula',
                        id: actualPropertyId,
                        expression: expression,
                        referencedFields: referencedFields,
                        referencedDatabaseId: null,
                        referencedProperty: null
                    });
                }
            }

            // 빠진 필드들 추가
            const propertiesSet = new Set(propertiesList.map(p => p.id));
            for (const [propKey, property] of Object.entries(properties)) {
                const actualPropertyId = property.id || propKey;
                if (!propertiesSet.has(actualPropertyId)) {
                    if (property.type === 'formula') {
                        // Formula 필드에서 참조 대상 필드명 추출
                        const expression = property.formula?.expression || '';
                        const referencedFields = expression ? extractFieldReferencesFromFormula(
                            expression,
                            allFieldNames,
                            propertyIdMap,
                            {},
                            debugMode
                        ) : [];

                        propertiesList.push({
                            name: property.name,
                            type: property.type,
                            id: actualPropertyId,
                            expression: expression,
                            referencedFields: referencedFields
                        });
                    } else {
                        propertiesList.push({
                            name: property.name,
                            type: property.type,
                            id: actualPropertyId,
                            expression: property.type === 'formula' ? property.formula?.expression : null
                        });
                    }
                }
            }

            dbPropertiesMap.set(currentDbId, {
                databaseTitle: dbInfo.title,
                properties: propertiesList
            });
        } catch (error) {
            console.error(`DB ${currentDbId} 구조 조회 에러:`, error.message);
            // 타임아웃이나 에러 발생 시에도 계속 진행
            dbPropertiesMap.set(currentDbId, {
                databaseTitle: dbInfo.title,
                properties: []
            });
        }
    }

    // 제한 도달 시 디버그 로깅
    if (debugMode && visitedDbs.size >= MAX_DATABASES_TO_FETCH) {
        console.log(`⚠️  최대 데이터베이스 제한(${MAX_DATABASES_TO_FETCH}개)에 도달했습니다. 추가 데이터베이스는 분석하지 않습니다.`);
    }

    // 엣지 정리
    let edges = Array.from(edgesMap.values());
    edges = _processEdges(edges);

    return { nodes, edges, dbPropertiesMap };
}

/**
 * 엣지 업데이트/생성
 */
function _updateEdge(edgesMap, edgeKey, fromDbId, toDbId, relationInfo) {
    if (edgesMap.has(edgeKey)) {
        const existingEdge = edgesMap.get(edgeKey);
        existingEdge.relations.push(relationInfo);
        existingEdge.label = `${existingEdge.relations.length}개 연결`;
    } else {
        edgesMap.set(edgeKey, createDatabaseEdge(
            fromDbId,
            toDbId,
            '1개 연결',
            [relationInfo]
        ));
    }
}

/**
 * 엣지 후처리 (ID, smooth 설정)
 */
function _processEdges(edges) {
    const bidirectionalMap = new Map();
    
    edges.forEach(edge => {
        const key = [edge.from, edge.to].sort().join('|');
        const isBidirectional = edges.some(e => 
            e.from === edge.to && e.to === edge.from
        );
        
        if (isBidirectional) {
            bidirectionalMap.set(key, true);
        }
    });

    return edges.map((edge, index) => {
        edge.id = `edge_${index}`;
        
        const key = [edge.from, edge.to].sort().join('|');
        const isBidirectional = bidirectionalMap.has(key);
        
        if (isBidirectional) {
            // 양방향 관계인 경우 곡선
            const edgeOrder = edges.filter(e => 
                (e.from === edge.from && e.to === edge.to) ||
                (e.from === edge.to && e.to === edge.from)
            ).indexOf(edge);
            
            edge.smooth = {
                type: 'curvedCW',
                roundness: 0.2 + (edgeOrder * 0.2)
            };
        } else {
            // 단방향 관계는 직선
            edge.smooth = { type: 'continuous' };
        }
        
        return edge;
    });
}

/**
 * 참조 체인 분석
 */
function _analyzeReferenceChains(dbPropertiesMap, debugMode) {
    const { propertyIdMapByDb, propertyNameMapByDb, globalPropertyIdMap } = 
        buildPropertyMaps(dbPropertiesMap);

    return buildReferenceChains(
        dbPropertiesMap,
        propertyIdMapByDb,
        propertyNameMapByDb,
        globalPropertyIdMap,
        debugMode
    );
}

module.exports = router;
