const app = {
    currentDatabaseId: null,
    currentPage: 1,
    currentDatabaseProperties: null,
    currentTab: 'data',
    // 데이터베이스 검색 및 페이지네이션 관련
    allDatabases: [],
    filteredDatabases: [],
    databasePageSize: 16,
    databaseCurrentPage: 1,
    
    // 색상 정의 (분석 탭 통일)
    colors: {
        success: '#10b981',    // 초록색 - 우수
        warning: '#f59e0b',    // 주황색 - 경고
        error: '#ef4444'       // 빨간색 - 에러/심각
    },

    async init() {
        // URL 파라미터 확인
        const params = new URLSearchParams(window.location.search);
        if (params.get('error')) {
            this.showError('로그인에 실패했습니다.');
            return;
        }
        if (params.get('success') === 'login') {
            this.showSuccess('로그인 성공!');
        }

        // 사용자 로그인 상태 확인
        try {
            const userResponse = await fetch('/auth/user');
            if (userResponse.ok) {
                const userData = await userResponse.json();
                document.getElementById('loginView').style.display = 'none';
                document.getElementById('mainView').style.display = 'flex';
                document.getElementById('userName').textContent = userData.workspaceName || userData.ownerName || 'Notion 사용자';
                this.loadDatabases();
            } else {
                document.getElementById('loginView').style.display = 'flex';
                document.getElementById('mainView').style.display = 'none';
            }
        } catch (error) {
            console.error('사용자 정보 로드 실패:', error);
            document.getElementById('loginView').style.display = 'flex';
            document.getElementById('mainView').style.display = 'none';
        }
    },

    async loadDatabases() {
        // 스켈레톤 로딩 UI 표시
        this.renderSkeletonDatabases();
        
        try {
            const response = await fetch('/api/databases');
            if (!response.ok) throw new Error('API 오류');

            const data = await response.json();
            this.allDatabases = data.databases;
            this.filteredDatabases = [...this.allDatabases];
            this.databaseCurrentPage = 1;
            this.updateDatabasesDisplay();
        } catch (error) {
            console.error('데이터베이스 로드 실패:', error);
            this.showError('데이터베이스를 불러올 수 없습니다.');
            document.getElementById('databasesList').innerHTML = '<div class="loading-card"><p>데이터베이스를 불러올 수 없습니다.</p></div>';
        }
    },

    renderDatabases(databases) {
        const container = document.getElementById('databasesList');
        
        if (databases.length === 0) {
            container.innerHTML = '<div class="error">사용 가능한 데이터베이스가 없습니다.</div>';
            return;
        }

        // 페이지네이션 적용
        const startIdx = (this.databaseCurrentPage - 1) * this.databasePageSize;
        const endIdx = startIdx + this.databasePageSize;
        const paginatedDatabases = databases.slice(startIdx, endIdx);

        container.innerHTML = paginatedDatabases.map(db => `
            <div class="database-card" onclick="app.selectDatabase('${db.id}', '${this.escapeHtml(db.title)}')">
                <div class="database-icon">${db.icon?.emoji || '📊'}</div>
                <div class="database-title">${this.escapeHtml(db.title)}</div>
                <div class="database-meta">
                    <div>수정: ${new Date(db.last_edited_time).toLocaleDateString('ko-KR')}</div>
                </div>
            </div>
        `).join('');
    },

    updateDatabasesDisplay() {
        this.renderDatabases(this.filteredDatabases);
        this.updateDatabasesPagination();
        this.updateDatabasesCount();
    },

    updateDatabasesPagination() {
        const totalPages = Math.ceil(this.filteredDatabases.length / this.databasePageSize);
        const paginationEl = document.getElementById('databasesPagination');
        const pageInfoEl = document.getElementById('pageInfo');
        const prevBtn = document.getElementById('prevBtn');
        const nextBtn = document.getElementById('nextBtn');

        if (totalPages <= 1) {
            paginationEl.style.display = 'none';
        } else {
            paginationEl.style.display = 'flex';
            pageInfoEl.textContent = `${this.databaseCurrentPage} / ${totalPages}`;
            prevBtn.disabled = this.databaseCurrentPage === 1;
            nextBtn.disabled = this.databaseCurrentPage === totalPages;
        }
    },

    updateDatabasesCount() {
        const countEl = document.getElementById('databasesCount');
        countEl.textContent = `총 ${this.filteredDatabases.length}개`;
    },

    onDatabaseSearch() {
        const searchInput = document.getElementById('databaseSearchInput').value.toLowerCase();
        
        if (searchInput === '') {
            this.filteredDatabases = [...this.allDatabases];
        } else {
            this.filteredDatabases = this.allDatabases.filter(db => 
                db.title.toLowerCase().includes(searchInput)
            );
        }

        this.databaseCurrentPage = 1;
        this.updateDatabasesDisplay();
    },

    nextDatabasePage() {
        const totalPages = Math.ceil(this.filteredDatabases.length / this.databasePageSize);
        if (this.databaseCurrentPage < totalPages) {
            this.databaseCurrentPage++;
            this.updateDatabasesDisplay();
        }
    },

    previousDatabasePage() {
        if (this.databaseCurrentPage > 1) {
            this.databaseCurrentPage--;
            this.updateDatabasesDisplay();
        }
    },

    switchView(viewName) {
        document.querySelectorAll('.view-section').forEach(v => v.style.display = 'none');
        
        // 데이터베이스 탭 UI 상태 업데이트
        const databasesExpandIcon = document.getElementById('databasesExpandIcon');
        const databasesTabs = document.getElementById('databasesTabs');
        const databasesNavBtn = document.getElementById('databasesNavBtn');
        
        if (viewName === 'databases') {
            document.getElementById('databasesView').style.display = 'block';
            databasesNavBtn.classList.add('active');
            databasesExpandIcon.style.display = 'none';
            databasesTabs.style.display = 'none';
        } else {
            databasesNavBtn.classList.remove('active');
        }
    },

    async selectDatabase(databaseId, databaseTitle) {
        this.currentDatabaseId = databaseId;
        this.currentPage = 1;

        // UI 변경
        document.getElementById('databasesView').style.display = 'none';
        document.getElementById('databaseDetail').style.display = 'block';
        document.getElementById('databaseTitle').textContent = databaseTitle;
        
        // 사이드바 탭 UI 표시
        document.getElementById('databasesExpandIcon').style.display = 'inline';
        document.getElementById('databasesTabs').style.display = 'flex';
        
        // 분석 스켈레톤 표시
        this.renderSkeletonAnalysis();

        try {
            // 데이터베이스 구조 로드
            const dbResponse = await fetch(`/api/database/${databaseId}`);
            if (!dbResponse.ok) throw new Error('데이터베이스 구조 로드 실패');
            
            const dbData = await dbResponse.json();
            this.currentDatabaseProperties = dbData.properties;

            // 백그라운드에서 네트워크 및 분석 데이터 프리페치
            this.prefetchData(databaseId);

            // 탭 초기화
            this.switchTab('analysis');


        } catch (error) {
            console.error('데이터베이스 상세 로드 실패:', error);
            this.showError('데이터베이스를 불러올 수 없습니다.');
        }
    },

    async prefetchData(databaseId) {
        try {
            const response = await fetch(`/api/prefetch/${databaseId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });
            if (response.ok) {
                console.log(`[Prefetch] Started for DB: ${databaseId}`);
            }
        } catch (error) {
            console.warn('[Prefetch] Error starting prefetch:', error.message);
            // 프리페치 실패는 무시 (사용자에게 영향 없음)
        }
    },

    refreshCurrentTab() {
        if (this.currentTab === 'network') {
            this.refreshNetwork();
        } else if (this.currentTab === 'analysis') {
            this.refreshAnalysis();
        }
    },

    async refreshNetwork() {
        try {
            const response = await fetch(`/api/network/${this.currentDatabaseId}/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            if (!response.ok) throw new Error('네트워크 새로고침 실패');

            const result = await response.json();
            this.renderNetwork(result.data);
            this.showSuccess('네트워크가 새로 고쳐졌습니다.');
        } catch (error) {
            console.error('네트워크 새로고침 실패:', error);
            this.showError('네트워크 새로고침에 실패했습니다.');
        }
    },

    async refreshAnalysis() {
        try {
            const response = await fetch(`/api/analyze/${this.currentDatabaseId}/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            if (!response.ok) throw new Error('분석 새로고침 실패');

            const result = await response.json();
            this.renderAnalysis(result.data);
            this.showSuccess('분석이 새로 고쳐졌습니다.');
        } catch (error) {
            console.error('분석 새로고침 실패:', error);
            this.showError('분석 새로고침에 실패했습니다.');
        }
    },

    async refreshDatabases() {
        try {
            const btn = document.getElementById('refreshDatabasesBtn');
            if (btn) btn.disabled = true;

            const response = await fetch('/api/databases/refresh', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            if (!response.ok) throw new Error('DB 목록 새로고침 실패');

            const result = await response.json();
            this.allDatabases = result.databases;
            this.filteredDatabases = [...this.allDatabases];
            this.databaseCurrentPage = 1;
            this.updateDatabasesDisplay();
            this.showSuccess('DB 목록이 새로 고쳐졌습니다.');
        } catch (error) {
            console.error('DB 목록 새로고침 실패:', error);
            this.showError('DB 목록 새로고침에 실패했습니다.');
        } finally {
            const btn = document.getElementById('refreshDatabasesBtn');
            if (btn) btn.disabled = false;
        }
    },

    switchTab(tabName) {
        this.currentTab = tabName;

        // 사이드바 탭 버튼 업데이트
        document.querySelectorAll('.nav-sub-item').forEach(btn => {
            btn.classList.remove('active');
            if (btn.getAttribute('data-tab') === tabName) {
                btn.classList.add('active');
            }
        });

        // 탭 콘텐츠 업데이트
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.style.display = 'none';
        });

        if (tabName === 'analysis') {
            document.getElementById('analysisTab').style.display = 'block';
            this.loadAnalysis();
        } else if (tabName === 'network') {
            document.getElementById('networkTab').style.display = 'block';
            this.loadNetwork();
        }
    },

    async loadAnalysis() {
        // 분석 스켈레톤 표시
        this.renderSkeletonAnalysis();
        
        try {
            const response = await fetch(`/api/analyze/${this.currentDatabaseId}`);
            if (!response.ok) throw new Error('분석 로드 실패');

            const analysis = await response.json();
            console.log('분석 데이터:', analysis);
            
            this.renderAnalysis(analysis);
        } catch (error) {
            console.error('분석 로드 실패:', error);
            this.showError('분석을 불러올 수 없습니다.');
            document.getElementById('analysisPlaceholder').innerHTML = '<div class="card"><div class="card-content"><p style="color: var(--color-error);">분석을 불러올 수 없습니다.</p></div></div>';
        }
    },

    renderAnalysis(analysis) {
        console.log('renderAnalysis 시작');
        const qualityScore = analysis.qualityScore;
        const qualityColors = { excellent: 'var(--color-success)', warning: 'var(--color-warning)', critical: 'var(--color-error)' };
        const scoreColor = qualityScore >= 80 ? this.colors.success : qualityScore >= 60 ? this.colors.warning : this.colors.error;
        
        const performanceAnalysis = analysis.performanceAnalysis || {};
        const performanceIssues = performanceAnalysis.issues || {};
        const performanceScore = performanceIssues.score || 0;
        const limits = performanceAnalysis.limits || {};

        // 항상 표시되는 주요 메트릭 섹션
        let html = `
            <div class="analysis-container">
                <!-- 📊 1단계: 상단 고정 - 주요 통계 섹션 (최상 우선순위) -->
                <div class="analysis-pinned-section">
                    <div class="stats-section">
                        <!-- 품질 점수 강조 -->
                        <div class="quality-score-hero">
                            <div class="hero-left">
                                <div class="quality-badge" style="background: linear-gradient(135deg, ${scoreColor} 0%, ${scoreColor}dd 100%)">
                                    <div class="badge-value">${qualityScore}</div>
                                    <div class="badge-unit">/100</div>
                                </div>
                                <div class="quality-info">
                                    <div class="quality-level" style="color: ${scoreColor}">${this.getQualityLevel(qualityScore)}</div>
                                    <div class="quality-desc">데이터 품질 평가</div>
                                </div>
                            </div>
                            
                            <!-- 기본 통계 미니 -->
                            <div class="hero-right">
                                <div class="mini-stat">
                                    <div class="mini-icon">📝</div>
                                    <div class="mini-info">
                                        <div class="mini-label info-tooltip" data-tooltip="데이터베이스의 전체 항목(행) 수">총 항목</div>
                                        <div class="mini-value">${analysis.totalRecords}</div>
                                    </div>
                                </div>
                                <div class="mini-stat">
                                    <div class="mini-icon">🏢</div>
                                    <div class="mini-info">
                                        <div class="mini-label info-tooltip" data-tooltip="데이터베이스의 전체 필드 수">총 컬럼</div>
                                        <div class="mini-value">${analysis.totalColumns}</div>
                                    </div>
                                </div>
                                <div class="mini-stat">
                                    <div class="mini-icon">✓</div>
                                    <div class="mini-info">
                                        <div class="mini-label info-tooltip" data-tooltip="채워진 필드의 비율">완성도</div>
                                        <div class="mini-value">${analysis.overallCompleteness}%</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- 진행 상태 비교 -->
                        <div class="quality-progress-compare">
                            <div class="progress-item">
                                <div class="progress-header">
                                    <span class="progress-label">데이터 완성도</span>
                                    <span class="progress-value">${analysis.overallCompleteness}%</span>
                                </div>
                                <div class="progress-bar">
                                    <div class="progress-fill" style="width: ${analysis.overallCompleteness}%; background: linear-gradient(90deg, var(--color-warning), #fbbf24)"></div>
                                </div>
                            </div>
                            <div class="progress-item">
                                <div class="progress-header">
                                    <span class="progress-label info-tooltip" data-tooltip="데이터 완성도와 품질을 종합적으로 평가">품질 점수</span>
                                    <span class="progress-value">${qualityScore}%</span>
                                </div>
                                <div class="progress-bar">
                                    <div class="progress-fill" style="width: ${qualityScore}%; background: linear-gradient(90deg, ${scoreColor}, ${scoreColor}dd)"></div>
                                </div>
                            </div>
                            <div class="progress-item">
                                <div class="progress-header">
                                    <span class="progress-label info-tooltip" data-tooltip="데이터베이스의 성능 및 최적화 상태">성능 점수</span>
                                    <span class="progress-value">${performanceScore}%</span>
                                </div>
                                <div class="progress-bar">
                                    <div class="progress-fill" style="width: ${performanceScore}%; background: linear-gradient(90deg, ${performanceScore >= 80 ? this.colors.success : performanceScore >= 60 ? this.colors.warning : this.colors.error}, ${performanceScore >= 80 ? this.colors.success : performanceScore >= 60 ? this.colors.warning : this.colors.error}dd)"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- ✨ 완벽한 상태 UI (100점일 때만 표시) -->
                ${qualityScore === 100 ? `
                <div class="zero-error-state">
                    <div class="zero-error-state-icon">🌟</div>
                    <div class="zero-error-state-title">완벽한 데이터 상태!</div>
                    <div class="zero-error-state-subtitle">
                        모든 지표가 최적 상태입니다. 이 수준을 유지하면서 지속적으로 데이터를 업데이트해주세요.
                    </div>
                    <div class="zero-error-state-stats">
                        <div class="zero-stat-item">
                            <div class="zero-stat-icon">✓</div>
                            <div class="zero-stat-label">완성도</div>
                            <div class="zero-stat-value">100%</div>
                        </div>
                        <div class="zero-stat-item">
                            <div class="zero-stat-icon">⚡</div>
                            <div class="zero-stat-label">성능</div>
                            <div class="zero-stat-value">우수</div>
                        </div>
                        <div class="zero-stat-item">
                            <div class="zero-stat-icon">📊</div>
                            <div class="zero-stat-label">데이터</div>
                            <div class="zero-stat-value">최적</div>
                        </div>
                    </div>
                </div>
                ` : ''}

                <!-- ⚠️ 2단계: 긴급 이슈 섹션 -->
                ${limits.warnings && limits.warnings.length > 0 ? `
                <div class="size-warnings-section">
                    <h3 style="color: var(--color-error); margin-bottom: var(--spacing-md); display: flex; align-items: center; gap: var(--spacing-sm);">
                        <span>⛔ 긴급 이슈</span>
                        <span style="font-size: 0.85rem; font-weight: 600; color: white; background: var(--color-error); padding: 2px 8px; border-radius: 4px;">${limits.warnings.length}개</span>

                    </h3>
                    <div class="warnings-list">
                        ${limits.warnings.map(warning => {
                            const warningColor = warning.level === 'critical' ? this.colors.error : this.colors.warning;
                            return `
                                <div class="warning-item" style="border-left-color: ${warningColor}">
                                    <div class="warning-header" style="color: ${warningColor}">
                                        <strong>${warning.level === 'critical' ? '⛔ 심각' : '⚠️ 경고'}: ${this.escapeHtml(warning.message)}</strong>
                                    </div>
                                    <div class="warning-suggestion">
                                        ${this.escapeHtml(warning.recommendation)}
                                    </div>
                                    <div class="item-actions">
                                        <button class="action-btn" onclick="app.openNotionDatabase()" title="Notion으로 이동">↗</button>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
                ` : ''}

                <!-- 💡 3단계: 최적화 기회 섹션 (즉각적인 조치 필요) -->
                ${performanceAnalysis.opportunities && performanceAnalysis.opportunities.length > 0 ? `
                <div class="collapsible-section" data-section="opportunities">
                    <div class="section-header" onclick="app.toggleSection(event)">
                        <div class="section-title-wrapper">
                            <span class="section-icon">💡</span>
                            <div class="section-title-group">
                                <h3 class="section-title">최적화 기회</h3>
                                <p class="section-subtitle">${performanceAnalysis.opportunities.length}개 발견 - 데이터 품질 향상 방법</p>
                            </div>
                        </div>
                        <div class="section-header-actions">
                            <div class="collapse-toggle">▼</div>
                        </div>
                    </div>
                    <div class="section-content">
                        <div class="opportunities-list">
                            ${this.groupOpportunitiesByTitle(performanceAnalysis.opportunities).map((group, idx) => {
                                const priorityColor = group.priority === 'high' ? this.colors.error : group.priority === 'medium' ? this.colors.warning : this.colors.success;
                                const impactEstimate = group.priority === 'high' ? '+5~10점' : group.priority === 'medium' ? '+3~5점' : '+1~2점';
                                const groupId = `opp-group-${idx}`;
                                return `
                                    <div class="opportunity-group" data-group-id="${groupId}">
                                        <div class="opp-group-header" onclick="app.toggleOpportunityGroup('${groupId}')">
                                            <div class="opp-group-left">
                                                <span class="opp-group-toggle">▶</span>
                                                <div class="opp-group-info">
                                                    <div class="opp-group-title">${this.escapeHtml(group.title)} <span style="display: inline-block; margin-left: 8px; background: var(--color-success); color: white; padding: 2px 8px; border-radius: 3px; font-size: 0.7rem; font-weight: 600;">${impactEstimate}</span></div>
                                                    <div class="opp-group-count">${group.count}개 발견 - 이 개선으로 데이터 품질 향상 가능</div>
                                                </div>
                                            </div>
                                            <div class="opp-group-actions-container">
                                                <div class="opp-group-badge" style="background-color: ${priorityColor}">
                                                    ${group.priority.toUpperCase()}
                                                </div>
                                                <button class="action-btn" onclick="event.stopPropagation(); app.openNotionDatabase()" title="Notion으로 이동">↗</button>
                                            </div>
                                        </div>
                                        <div class="opp-group-content">
                                            <div class="opp-group-details">
                                                <p><strong>문제:</strong> ${this.escapeHtml(group.description)}</p>
                                                <p><strong>효과:</strong> ${this.escapeHtml(group.benefit)}</p>
                                                
                                                <!-- 영향을 받는 속성들 -->
                                                ${group.properties && group.properties.length > 0 ? `
                                                    <div class="opp-affected-properties">
                                                        <strong>영향을 받는 속성:</strong>
                                                        <div class="properties-list">
                                                            ${group.properties.map(prop => `
                                                                <span class="property-tag" style="position: relative; display: inline-flex; align-items: center; gap: 4px;">
                                                                    ${this.escapeHtml(prop)}
                                                                </span>
                                                            `).join('')}
                                                        </div>
                                                    </div>
                                                ` : ''}
                                                
                                                <!-- 조치사항 -->
                                                ${group.details.length > 0 ? `
                                                    <div class="opp-group-actions">
                                                        <strong>조치:</strong>
                                                        <ul>
                                                            ${group.details.slice(0, 3).map(action => `
                                                                <li style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
                                                                    <span>${this.escapeHtml(action)}</span>
                                                                </li>
                                                            `).join('')}
                                                            ${group.details.length > 3 ? `<li>+ ${group.details.length - 3}개 더</li>` : ''}
                                                        </ul>
                                                    </div>
                                                ` : ''}
                                            </div>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                </div>
                ` : ''}

                <!-- 4단계: 성능 분석 섹션 (상세 정보) -->
                ${performanceAnalysis.issues ? `
                <div class="collapsible-section" data-section="performance">
                    <div class="section-header" onclick="app.toggleSection(event)">
                        <div class="section-title-wrapper">
                            <span class="section-icon">⚡</span>
                            <div class="section-title-group">
                                <h3 class="section-title">성능 분석</h3>
                                <p class="section-subtitle">노션 공식 가이드 기반</p>
                            </div>
                        </div>
                        <div class="section-header-actions">
                            <div class="collapse-toggle">▼</div>
                        </div>
                    </div>
                    <div class="section-content">
                        ${this.renderPerformanceAnalysis(performanceAnalysis)}
                    </div>
                </div>
                ` : ''}

                <!-- 5단계: 컬럼별 분석 (상세 데이터 탐색) -->
                <div class="collapsible-section" data-section="columns">
                    <div class="section-header" onclick="app.toggleSection(event)">
                        <div class="section-title-wrapper">
                            <span class="section-icon">📋</span>
                            <div class="section-title-group">
                                <h3 class="section-title">컬럼별 분석</h3>
                                <p class="section-subtitle">${Object.keys(analysis.columnStats).length}개 컬럼 - 각 필드의 완성도</p>
                            </div>
                        </div>
                        <div class="section-header-actions">
                            <div class="collapse-toggle">▼</div>
                        </div>
                    </div>
                    <div class="section-content">
                        <div class="columns-container">
                            <div class="columns-left">
                                ${this.renderColumnAnalysisSummary(analysis.columnStats)}
                            </div>
                            <div class="columns-right">
                                <div class="columns-list">
                                    ${this.renderColumnAnalysis(analysis.columnStats)}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('analysisPlaceholder').innerHTML = html;
        
        // 초기 축소 상태: 컬럼별 분석을 기본으로 축소
        this.initializeCollapsibleSections();
    },

    renderColumnAnalysis(columnStats) {
        let html = '';
        Object.entries(columnStats).forEach(([key, stats]) => {
            const completenessColor = stats.completeness >= 80 ? this.colors.success : stats.completeness >= 60 ? this.colors.warning : this.colors.error;
            
            html += `
                <div class="column-row">
                    <div class="column-info">
                        <div class="column-name">
                            ${this.escapeHtml(stats.name)}
                        </div>
                        <div class="column-type">${stats.type}</div>
                    </div>
                    <div class="column-stats">
                        <div class="stat-item">
                            <span>입력됨</span>
                            <strong>${stats.filledCount}/${stats.totalCount}</strong>
                        </div>
                        <div class="stat-item">
                            <span>비율</span>
                            <strong>${stats.completeness}%</strong>
                        </div>
                        <div class="stat-item">
                            <span>유니크 값</span>
                            <strong>${stats.uniqueCount}</strong>
                        </div>
                    </div>
                    <div class="completeness-bar">
                        <div class="bar" style="background-color: ${completenessColor}; width: ${stats.completeness}%"></div>
                    </div>
                </div>
            `;
        });
        return html;
    },

    renderColumnAnalysisSummary(columnStats) {
        // 전체 통계 계산
        const entries = Object.entries(columnStats);
        const totalColumns = entries.length;
        
        let totalFilled = 0;
        let totalRecords = 0;
        let completenessSum = 0;
        let uniqueSum = 0;
        let excellentCount = 0;
        let goodCount = 0;
        let warningCount = 0;
        let criticalCount = 0;
        
        const typeDistribution = {};
        
        entries.forEach(([key, stats]) => {
            totalFilled += stats.filledCount;
            totalRecords += stats.totalCount;
            completenessSum += stats.completeness;
            uniqueSum += stats.uniqueCount;
            
            // 완성도 등급 분류
            if (stats.completeness >= 80) excellentCount++;
            else if (stats.completeness >= 60) goodCount++;
            else if (stats.completeness >= 30) warningCount++;
            else criticalCount++;
            
            // 타입 분포
            const type = stats.type;
            typeDistribution[type] = (typeDistribution[type] || 0) + 1;
        });
        
        const avgCompleteness = totalColumns > 0 ? Math.round(completenessSum / totalColumns) : 0;
        const avgUnique = totalColumns > 0 ? Math.round(uniqueSum / totalColumns) : 0;
        
        // 타입별 정렬 (많은 것부터)
        const sortedTypes = Object.entries(typeDistribution)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5);
        
        return `
            <div class="column-summary-panel">
                <!-- 상단: 주요 지표 -->
                <div class="summary-top">
                    <h3 class="summary-title">컬럼 통계</h3>
                    
                    <div class="summary-metrics">
                        <div class="summary-metric">
                            <div class="metric-icon">📊</div>
                            <div class="metric-content">
                                <div class="metric-label">전체 컬럼</div>
                                <div class="metric-value">${totalColumns}</div>
                            </div>
                        </div>
                        
                        <div class="summary-metric">
                            <div class="metric-icon">✓</div>
                            <div class="metric-content">
                                <div class="metric-label">평균 완성도</div>
                                <div class="metric-value">${avgCompleteness}%</div>
                            </div>
                        </div>
                        
                        <div class="summary-metric">
                            <div class="metric-icon">🔢</div>
                            <div class="metric-content">
                                <div class="metric-label">평균 유니크 값</div>
                                <div class="metric-value">${avgUnique}</div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- 중단: 완성도 등급 분포 (Stacked Bar Chart) -->
                <div class="summary-section">
                    <h4 class="summary-section-title">완성도 등급</h4>
                    <div class="grade-distribution">
                        <div class="stacked-bar-wrapper">
                            <div class="stacked-bar">
                                <div class="grade-segment excellent" style="width: ${totalColumns > 0 ? (excellentCount / totalColumns * 100) : 0}%" title="우수 (80%+): ${excellentCount}"></div>
                                <div class="grade-segment good" style="width: ${totalColumns > 0 ? (goodCount / totalColumns * 100) : 0}%" title="양호 (60-80%): ${goodCount}"></div>
                                <div class="grade-segment warning" style="width: ${totalColumns > 0 ? (warningCount / totalColumns * 100) : 0}%" title="주의 (40-60%): ${warningCount}"></div>
                                <div class="grade-segment critical" style="width: ${totalColumns > 0 ? (criticalCount / totalColumns * 100) : 0}%" title="심각 (<40%): ${criticalCount}"></div>
                            </div>
                        </div>
                        
                        <div class="grade-legend">
                            <div class="legend-item">
                                <div class="legend-color excellent"></div>
                                <span class="legend-label">우수 (80%+): ${excellentCount}</span>
                            </div>
                            <div class="legend-item">
                                <div class="legend-color good"></div>
                                <span class="legend-label">양호 (60-80%): ${goodCount}</span>
                            </div>
                            <div class="legend-item">
                                <div class="legend-color warning"></div>
                                <span class="legend-label">주의 (40-60%): ${warningCount}</span>
                            </div>
                            <div class="legend-item">
                                <div class="legend-color critical"></div>
                                <span class="legend-label">심각 (<40%): ${criticalCount}</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- 하단: 컬럼 타입 분포 -->
                <div class="summary-section">
                    <h4 class="summary-section-title">컬럼 타입</h4>
                    <div class="type-distribution">
                        ${sortedTypes.map(([type, count]) => `
                            <div class="type-item">
                                <div class="type-name">${type}</div>
                                <div class="type-bar">
                                    <div class="type-fill" style="width: ${(count / totalColumns * 100)}%"></div>
                                </div>
                                <div class="type-count">${count}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    },

    toggleSection(event) {
        const header = event.currentTarget;
        const section = header.closest('.collapsible-section');
        const toggle = header.querySelector('.collapse-toggle');
        
        // 현재 섹션이 이미 열려있으면 닫기만 함
        const isCurrentlyExpanded = !section.classList.contains('collapsed');
        
        if (isCurrentlyExpanded) {
            // 이미 열려있으면 닫기
            section.classList.add('collapsed');
            toggle.classList.remove('expanded');
        } else {
            // 닫혀있으면, 다른 섹션들을 먼저 닫은 후 이 섹션을 열기 (Accordion 동작)
            const analysisContainer = document.querySelector('.analysis-container');
            if (analysisContainer) {
                // 현재 섹션을 제외한 모든 collapsible-section을 닫기
                analysisContainer.querySelectorAll('.collapsible-section').forEach(otherSection => {
                    if (otherSection !== section) {
                        otherSection.classList.add('collapsed');
                        const otherToggle = otherSection.querySelector('.collapse-toggle');
                        if (otherToggle) {
                            otherToggle.classList.remove('expanded');
                        }
                    }
                });
            }
            
            // 현재 섹션 열기
            section.classList.remove('collapsed');
            toggle.classList.add('expanded');
        }
    },

    toggleOpportunityGroup(groupId) {
        const group = document.querySelector(`[data-group-id="${groupId}"]`);
        if (group) {
            group.classList.toggle('collapsed');
        }
    },

    initializeCollapsibleSections() {
        // Progressive Disclosure: 모든 분석 섹션들을 기본으로 축소
        const opportunitiesSection = document.querySelector('[data-section="opportunities"]');
        if (opportunitiesSection) {
            opportunitiesSection.classList.add('collapsed');
            opportunitiesSection.querySelector('.collapse-toggle').classList.remove('expanded');
        }
        
        const performanceSection = document.querySelector('[data-section="performance"]');
        if (performanceSection) {
            performanceSection.classList.add('collapsed');
            performanceSection.querySelector('.collapse-toggle').classList.remove('expanded');
        }
        
        const columnsSection = document.querySelector('[data-section="columns"]');
        if (columnsSection) {
            columnsSection.classList.add('collapsed');
            columnsSection.querySelector('.collapse-toggle').classList.remove('expanded');
        }

        // 최적화 기회 그룹들도 모두 접혀있도록 설정
        document.querySelectorAll('.opportunity-group').forEach(group => {
            group.classList.add('collapsed');
            const toggle = group.querySelector('.opp-group-toggle');
            if (toggle) {
                toggle.style.transform = 'rotate(0deg)';
            }
        });
    },

    groupOpportunitiesByTitle(opportunities) {
        // 같은 title을 가진 opportunities를 그룹화
        const grouped = {};
        
        opportunities.forEach(opp => {
            if (!grouped[opp.title]) {
                grouped[opp.title] = {
                    title: opp.title,
                    description: opp.description,
                    benefit: opp.benefit,
                    priority: opp.priority,
                    difficulty: opp.difficulty || 'medium',
                    type: opp.type,
                    count: 0,
                    details: [],
                    properties: [],  // 속성명 수집
                    types: []  // 타입 수집
                };
            }
            grouped[opp.title].count++;
            
            // 속성명 수집 (중복 제거)
            if (opp.property && !grouped[opp.title].properties.includes(opp.property)) {
                grouped[opp.title].properties.push(opp.property);
            }
            
            // 타입 수집
            if (opp.type && !grouped[opp.title].types.includes(opp.type)) {
                grouped[opp.title].types.push(opp.type);
            }
            
            // 상세 내용이 다르면 details에 추가
            if (opp.action && !grouped[opp.title].details.some(d => d === opp.action)) {
                grouped[opp.title].details.push(opp.action);
            }
        });
        
        // 우선순위 기반 정렬
        const groups = Object.values(grouped);
        return groups.sort((a, b) => {
            // 1순위: HIGH 우선순위를 최상단에
            if (a.priority === 'high' && b.priority !== 'high') return -1;
            if (a.priority !== 'high' && b.priority === 'high') return 1;
            
            // 2순위: Quick Win (난이도 낮음) - 효과 높지만 쉬운 것들
            const aIsQuickWin = a.difficulty === 'low' && a.priority !== 'low';
            const bIsQuickWin = b.difficulty === 'low' && b.priority !== 'low';
            if (aIsQuickWin && !bIsQuickWin) return -1;
            if (!aIsQuickWin && bIsQuickWin) return 1;
            
            // 3순위: MEDIUM 우선순위
            if (a.priority === 'medium' && b.priority !== 'medium') return -1;
            if (a.priority !== 'medium' && b.priority === 'medium') return 1;
            
            // 4순위: 같은 우선순위 내에서 난이도 낮은 것부터
            const difficultyOrder = { 'low': 0, 'medium': 1, 'high': 2 };
            if ((difficultyOrder[a.difficulty] || 1) !== (difficultyOrder[b.difficulty] || 1)) {
                return (difficultyOrder[a.difficulty] || 1) - (difficultyOrder[b.difficulty] || 1);
            }
            
            // 5순위: 개수가 많은 것부터
            return b.count - a.count;
        });
    },

    renderPerformanceSuccessChecklist(performanceAnalysis) {
        const limits = performanceAnalysis.limits || {};
        const metrics = limits.metrics || {};
        
        let checklist = `
            <div class="success-checklist">
                <div class="checklist-title">성능 분석 - 모든 항목 정상</div>
                <div class="checklist-items">
                    <div class="checklist-item">
                        <span class="checklist-label">필드 개수</span>
                        <span class="checklist-value">권장 한계 이하 (최대 500개) <span style="color: var(--color-success); font-weight: 600; font-size: 0.8rem;">✓ 안정성 유지</span></span>
                    </div>
                    <div class="checklist-item">
                        <span class="checklist-label">레코드 개수</span>
                        <span class="checklist-value">성능 최적 범위 내 <span style="color: var(--color-success); font-weight: 600; font-size: 0.8rem;">✓ 빠른 로딩</span></span>
                    </div>
                    <div class="checklist-item">
                        <span class="checklist-label">관계 필드</span>
                        <span class="checklist-value">복잡도 정상 범위 <span style="color: var(--color-success); font-weight: 600; font-size: 0.8rem;">✓ 쿼리 효율</span></span>
                    </div>
                    <div class="checklist-item">
                        <span class="checklist-label">롤업/포뮬러</span>
                        <span class="checklist-value">성능 영향 미미 <span style="color: var(--color-success); font-weight: 600; font-size: 0.8rem;">✓ 계산 속도</span></span>
                    </div>
        `;
        
        // 측정된 메트릭이 있으면 추가 정보 표시
        if (metrics.avgPageSize !== undefined) {
            checklist += `
                    <div class="checklist-item">
                        <span class="checklist-label">평균 페이지 크기</span>
                        <span class="checklist-value">${(metrics.avgPageSize / 1024).toFixed(2)} KB <span style="color: var(--color-success); font-weight: 600; font-size: 0.8rem;">✓ 최적</span></span>
                    </div>
                    <div class="checklist-item">
                        <span class="checklist-label">최대 페이지 크기</span>
                        <span class="checklist-value">${(metrics.maxPageSize / 1024).toFixed(2)} KB <span style="color: #10b981; font-weight: 600; font-size: 0.8rem;">✓ 안전</span></span>
                    </div>
            `;
        }
        
        checklist += `
                </div>
            </div>
        `;
        
        return checklist;
    },

    renderPerformanceAnalysis(performanceAnalysis) {
        const issues = performanceAnalysis.issues || {};
        const opportunities = performanceAnalysis.opportunities || [];
        const limits = performanceAnalysis.limits || {};
        
        const performanceScore = issues.score || 0;
        const perfScoreColor = performanceScore >= 80 ? this.colors.success : performanceScore >= 60 ? this.colors.warning : this.colors.error;
        
        let html = `
            <div class="performance-section">
                <!-- 성능 문제 분석 -->
                ${issues.factors && issues.factors.length > 0 ? `
                <div class="performance-factors-section">
                    <h4>⚠️ 성능 영향 요인</h4>
                    <div class="factors-list">
                        ${issues.factors.map(factor => {
                            const factorColor = factor.severity === 'critical' ? '#ef4444' : '#f59e0b';
                            return `
                                <div class="factor-item" style="border-left: 4px solid ${factorColor}">
                                    <div class="factor-header">
                                        <span class="factor-title">${this.escapeHtml(factor.title)}</span>
                                        <span class="factor-severity" style="background-color: ${factorColor}; color: white; padding: 2px 8px; border-radius: 3px; font-size: 12px;">
                                            ${factor.severity.toUpperCase()}
                                        </span>
                                    </div>
                                    <div class="factor-info">
                                        <div class="info-row">
                                            <span class="info-label">현재:</span>
                                            <span class="info-value">${factor.current}${factor.unit ? ' ' + factor.unit : ''}</span>
                                        </div>
                                        <div class="info-row">
                                            <span class="info-label">임계:</span>
                                            <span class="info-value">${factor.threshold}${factor.unit ? ' ' + factor.unit : ''}</span>
                                        </div>
                                        <div class="info-row">
                                            <span class="info-label">해결책:</span>
                                            <span class="info-value">${this.escapeHtml(factor.recommendation)}</span>
                                        </div>
                                    </div>
                                    <div class="item-actions">
                                        <button class="action-btn" onclick="app.openNotionDatabase()" title="Notion으로 이동">↗</button>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
                ` : this.renderPerformanceSuccessChecklist(performanceAnalysis)} 

                <!-- 크기 제한 체크 -->
                ${limits.metrics ? `
                <div class="size-constraints-section">
                    <h4>💾 데이터 크기 (노션 제한사항)</h4>
                    <div class="constraint-metrics">
                        <div class="metric-item">
                            <span class="metric-label">평균 페이지</span>
                            <span class="metric-value">${(limits.metrics.avgPageSize / 1024).toFixed(2)} KB</span>
                        </div>
                        <div class="metric-item">
                            <span class="metric-label">최대 페이지</span>
                            <span class="metric-value">${(limits.metrics.maxPageSize / 1024).toFixed(2)} KB</span>
                        </div>
                        <div class="metric-item">
                            <span class="metric-label">구조 크기</span>
                            <span class="metric-value">${(limits.metrics.dbStructureSize / 1024).toFixed(2)} KB</span>
                        </div>
                        <div class="metric-item">
                            <span class="metric-label">참조 수</span>
                            <span class="metric-value">${limits.metrics.totalRelationReferences}</span>
                        </div>
                    </div>
                </div>
                ` : ''}
            </div>
        `;
        
        return html;
    },

    getComplexityLabel(level) {
        if (level === 'high') return '높음';
        if (level === 'medium') return '중간';
        return '낮음';
    },

    getQualityLevel(score) {
        if (score >= 90) return '탁월함';
        if (score >= 80) return '우수';
        if (score >= 70) return '좋음';
        if (score >= 60) return '보통';
        if (score >= 50) return '주의필요';
        return '개선필요';
    },

    // 클립보드에 텍스트 복사
    copyToClipboard(text, button) {
        navigator.clipboard.writeText(text).then(() => {
            if (button) {
                button.classList.add('copied');
                setTimeout(() => {
                    button.classList.remove('copied');
                }, 1500);
            }
        }).catch(err => {
            console.error('복사 실패:', err);
            alert('클립보드 복사에 실패했습니다.');
        });
    },

    // Notion 페이지 링크 복사
    copyPropertyList(properties, button) {
        const text = properties.join(', ');
        this.copyToClipboard(text, button);
    },

    // Notion 데이터베이스 바로가기 열기
    openNotionDatabase() {
        if (!this.currentDatabaseId) return;
        const notionUrl = `https://www.notion.so/${this.currentDatabaseId.replace(/-/g, '')}`;
        window.open(notionUrl, '_blank');
    },

    // 분석 리포트를 클립보드에 복사
    copyReportToClipboard(reportType, button) {
        let reportText = '';
        
        if (reportType === 'warnings') {
            const warningElements = document.querySelectorAll('.warning-item .warning-header strong');
            reportText = '🔴 긴급 이슈 리포트:\n\n';
            warningElements.forEach((el, idx) => {
                reportText += `${idx + 1}. ${el.textContent}\n`;
            });
        } else if (reportType === 'opportunities') {
            const oppElements = document.querySelectorAll('.opportunity-group .opp-group-title');
            reportText = '💡 최적화 기회 리포트:\n\n';
            oppElements.forEach((el, idx) => {
                reportText += `${idx + 1}. ${el.textContent}\n`;
            });
        }
        
        if (reportText) {
            navigator.clipboard.writeText(reportText).then(() => {
                if (button) {
                    button.classList.add('copied');
                    const originalText = button.textContent;
                    button.textContent = '✓';
                    setTimeout(() => {
                        button.classList.remove('copied');
                        button.textContent = originalText;
                    }, 1500);
                }
                this.showSuccess('리포트가 복사되었습니다.');
            }).catch(err => {
                console.error('복사 실패:', err);
                alert('클립보드 복사에 실패했습니다.');
            });
        }
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    async loadNetwork() {
        try {
            // 스켈레톤 로딩 표시
            this.renderSkeletonNetwork();
            
            const response = await fetch(`/api/network/${this.currentDatabaseId}`);
            if (!response.ok) throw new Error('네트워크 로드 실패');

            const data = await response.json();
            this.renderNetwork(data);
        } catch (error) {
            console.error('네트워크 로드 실패:', error);
            this.showError('네트워크를 불러올 수 없습니다.');
            document.getElementById('networkContainer').innerHTML = '<div style="color: var(--color-error);">네트워크를 불러올 수 없습니다.</div>';
        }
    },

    renderNetwork(data) {
        const container = document.getElementById('networkContainer');
        container.innerHTML = '';
        
        // vis.js가 제대로 렌더링되도록 display를 block으로 설정
        container.style.display = 'block';
        
        // 데이터 검증 - 콘솔에 로그 남기기
        console.log('Network data:', data);
        console.log('Nodes:', data.nodes);

        // 속성 정보 저장 (나중에 showRelationsList에서 사용)
        this.currentNetworkData = data;

        // vis.js 네트워크 옵션
        // 주의: physics를 enabled: false로 설정하여 초기 로딩 속도 증가
        const options = {
            physics: {
                enabled: true, // 물리 시뮬레이션 비활성화 (성능 최적화)
                barnesHut: {
                    gravitationalConstant: -26000,
                    centralGravity: 0.3,
                    springLength: 200,
                    springConstant: 0.08
                }
            },
            interaction: {
                navigationButtons: true,
                keyboard: true,
                zoomView: true,
                dragView: true
            },
            nodes: {
                shape: 'dot',
                font: {
                    size: 16,
                    color: 'white',
                    face: 'Arial',
                    bold: {
                        size: 18
                    },
                    strokeWidth: 2,
                    strokeColor: 'rgba(0, 0, 0, 0.5)'
                },
                widthConstraint: {
                    maximum: 200
                }
            },
            edges: {
                width: 2,
                color: { inherit: 'from' },
                font: {
                    size: 13,
                    align: 'middle',
                    color: '#333',
                    strokeWidth: 2,
                    strokeColor: '#ffffff'
                },
                arrows: {
                    to: { enabled: true, scaleFactor: 0.5 }
                }
            }
        };

        // 네트워크 생성
        const network = new vis.Network(container, {
            nodes: new vis.DataSet(data.nodes),
            edges: new vis.DataSet(data.edges)
        }, options);

        // 자동 피팅
        setTimeout(() => {
            network.fit();
        }, 500);

        // 클릭 이벤트
        network.on('click', (params) => {
            if (params.edges.length > 0) {
                // 엣지 클릭
                const edgeId = params.edges[0];
                const selectedEdge = data.edges.find(e => e.id === edgeId);
                if (selectedEdge && selectedEdge.relations && selectedEdge.relations.length > 0) {
                    this.showRelationsList(selectedEdge, data);
                }
            } else if (params.nodes.length > 0) {
                // 노드 클릭
                const nodeId = params.nodes[0];
                const selectedNode = data.nodes.find(n => n.id === nodeId);
                if (selectedNode) {
                    this.showDatabaseProperties(nodeId, data);
                }
            }
        });

        // 속성 정보 표 표시 (지연 렌더링)
        // 네트워크 시각화 후에 테이블을 렌더링하여 UI 응답성 개선
        setTimeout(() => {
            this.renderPropertiesTable(data);
        }, 100);
    },

    showDatabaseProperties(databaseId, data) {
        const dbInfo = data.propertiesInfo[databaseId];
        if (!dbInfo) {
            this.showError('속성 정보를 찾을 수 없습니다.');
            return;
        }

        const container = document.getElementById('relationsTableContainer');
        const contextPanel = document.getElementById('contextPanel');
        const tableBody = document.getElementById('relationsTableBody');
        
        // 테이블 헤더 업데이트
        const headerTitle = container.querySelector('h3');
        headerTitle.textContent = `📋 ${dbInfo.databaseTitle}의 참조 필드`;
        
        // 테이블 바디 업데이트
        if (dbInfo.properties.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: #666;">참조 필드가 없습니다.</td></tr>';
        } else {
            tableBody.innerHTML = dbInfo.properties.map((prop) => {
                if (prop.type === 'rollup') {
                    return `
                        <tr>
                            <td><strong>[Rollup] ${prop.name}</strong></td>
                            <td>${prop.referencedDatabase}</td>
                            <td>${prop.referencedProperty} (${prop.aggregationFunction})</td>
                        </tr>
                    `;
                } else {
                    return `
                        <tr>
                            <td><strong>[Relation] ${prop.name}</strong></td>
                            <td>${prop.referencedDatabase}</td>
                            <td>-</td>
                        </tr>
                    `;
                }
            }).join('');
        }
        
        // 컨텍스트 패널 표시 (우측)
        contextPanel.style.display = 'flex';
    },

    showRelationsList(selectedEdge, data) {
        const container = document.getElementById('relationsTableContainer');
        const contextPanel = document.getElementById('contextPanel');
        const tableBody = document.getElementById('relationsTableBody');
        
        // UUID를 DB 이름으로 변환
        const fromNode = data.nodes.find(n => n.id === selectedEdge.from);
        const toNode = data.nodes.find(n => n.id === selectedEdge.to);
        const fromDbName = fromNode ? fromNode.label : selectedEdge.from;
        const toDbName = toNode ? toNode.label : selectedEdge.to;
        
        // 테이블 헤더 업데이트
        const headerTitle = container.querySelector('h3');
        headerTitle.textContent = `🔗 ${fromDbName} → ${toDbName}`;
        
        // 테이블 바디 업데이트
        if (!selectedEdge.relations || selectedEdge.relations.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: #666;">연결 정보가 없습니다.</td></tr>';
        } else {
            tableBody.innerHTML = selectedEdge.relations.map((relation) => {
                const typeLabel = relation.type === 'relation' ? '🔄 Relation' : 
                                  relation.type === 'rollup' ? '📊 Rollup' : '🧮 Formula';
                
                // 참조 정보를 "DB명.필드명" 형태로 표시
                let refInfo = '-';
                if (relation.type === 'relation') {
                    refInfo = relation.relationField ? `${toDbName}.${relation.relationField}` : '-';
                } else if (relation.type === 'rollup') {
                    refInfo = `${toDbName}.${relation.relatedProperty} (${relation.aggregationFunction})`;
                }
                
                return `
                    <tr>
                        <td><strong>${typeLabel} ${relation.name}</strong></td>
                        <td>${fromDbName}</td>
                        <td>${refInfo}</td>
                    </tr>
                `;
            }).join('');
        }
        
        // 컨텍스트 패널 표시 (우측)
        contextPanel.style.display = 'flex';
    },

    closeContextPanel() {
        const contextPanel = document.getElementById('contextPanel');
        contextPanel.style.display = 'none';
    },

    renderPropertiesTable(data) {
        const tabContent = document.getElementById('networkTab');
        let propertiesSection = tabContent.querySelector('.properties-info-section');
        
        if (!propertiesSection) {
            propertiesSection = document.createElement('div');
            propertiesSection.className = 'properties-info-section mt-lg';
            tabContent.appendChild(propertiesSection);
        }

        const referencingDbs = Object.entries(data.propertiesInfo)
            .filter(([_, dbInfo]) => dbInfo.properties.length > 0);

        let html = '';

        // 1. 데이터 참조 관계 (Rollup / Formula) 테이블
        if (referencingDbs.length > 0) {
            const dataReferencingDbs = referencingDbs.filter(([_, dbInfo]) => 
                dbInfo.properties.some(p => p.type === 'rollup' || p.type === 'formula')
            );

            if (dataReferencingDbs.length > 0) {
                html += `
                <div class="card mb-lg">
                    <div class="card-header">
                        <h3>📊 데이터 참조 관계 (Rollup / Formula)</h3>
                    </div>
                    <div class="card-content p-0">
                        <div class="table-wrapper">
                            <table>
                                <thead>
                                    <tr>
                                        <th>소스 DB</th>
                                        <th>필드명</th>
                                        <th>필드 유형</th>
                                        <th>참조 대상</th>
                                    </tr>
                                </thead>
                                <tbody>
                `;

                dataReferencingDbs.forEach(([dbId, dbInfo]) => {
                    dbInfo.properties
                        .filter(p => p.type === 'rollup' || p.type === 'formula')
                        .forEach((prop) => {
                            const isRollup = prop.type === 'rollup';
                            const typeLabel = isRollup ? '🔄 Rollup' : '🧮 Formula';
                            const typeClass = isRollup ? 'text-primary' : 'text-accent';
                            
                            let refTarget = '-';
                            if (isRollup) {
                                refTarget = `<strong>[${this.escapeHtml(prop.referencedDatabase)}]</strong> ${this.escapeHtml(prop.referencedProperty)} <span class="text-muted">(${this.escapeHtml(prop.aggregationFunction)})</span>`;
                            } else if (prop.type === 'formula') {
                                if (prop.referencedFields && prop.referencedFields.length > 0) {
                                    refTarget = prop.referencedFields.map(field => 
                                        `<span class="property-tag">${this.escapeHtml(field)}</span>`
                                    ).join(' ');
                                } else {
                                    refTarget = `<span class="text-muted text-sm">(직접 참조 없음)</span>`;
                                }
                            }
                            
                            html += `
                                    <tr>
                                        <td><strong>${this.escapeHtml(dbInfo.databaseTitle)}</strong></td>
                                        <td>${this.escapeHtml(prop.name)}</td>
                                        <td><span class="${typeClass} font-weight-600">${typeLabel}</span></td>
                                        <td>${refTarget}</td>
                                    </tr>
                            `;
                        });
                });

                html += `
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
                `;
            }
        }

        // 2. 참조 트리 분석 (다단계 참조 흐름) - 페이지네이션 추가
        if (data.referenceChains && data.referenceChains.length > 0) {
            const itemsPerPage = 10;
            const allPaths = [];
            data.referenceChains.forEach(treeItem => {
                if (treeItem.tree) {
                    const paths = this._extractPathsFromTree(treeItem.tree);
                    paths.forEach(path => {
                        allPaths.push({
                            sourceDb: treeItem.sourceDb,
                            sourceField: treeItem.sourceField,
                            sourceType: treeItem.sourceType,
                            path: path,
                            pathLength: path.length
                        });
                    });
                }
            });

            const pathsByLength = {};
            allPaths.forEach(item => {
                const len = item.pathLength;
                if (!pathsByLength[len]) pathsByLength[len] = [];
                pathsByLength[len].push(item);
            });

            html += `
            <div class="card mb-lg">
                <div class="card-header">
                    <h3>🌳 다단계 참조 트리 분석</h3>
                </div>
                <div class="card-content">
            `;

            Object.keys(pathsByLength)
                .sort((a, b) => b - a)
                .forEach(length => {
                    const pathsOfLength = pathsByLength[length];
                    const sectionId = `reference-chain-${length}`;
                    const displayItemsCount = Math.min(itemsPerPage, pathsOfLength.length);
                    const hasMore = pathsOfLength.length > itemsPerPage;
                    
                    html += `
                    <div class="mb-lg">
                        <h4 class="mb-sm text-primary">📍 ${length}단계 연속 참조 <span class="text-muted text-sm">(${pathsOfLength.length}개)</span></h4>
                        <div class="opportunities-list" id="${sectionId}">
                    `;

                    // 처음 itemsPerPage개만 표시
                    for (let i = 0; i < displayItemsCount; i++) {
                        const item = pathsOfLength[i];
                        html += this._renderReferenceChainItem(item);
                    }

                    html += `
                        </div>
                        ${hasMore ? `
                        <div style="text-align: center; margin-top: var(--spacing-md);">
                            <button class="btn-secondary" onclick="app.loadMoreReferenceChains('${sectionId}', ${length}, ${itemsPerPage})">
                                더 보기 (${pathsOfLength.length - displayItemsCount}개 항목)
                            </button>
                        </div>
                        ` : ''}
                    </div>
                    `;
                    
                    // 나머지 데이터를 data 속성에 저장
                    if (hasMore) {
                        html += `<script data-section-id="${sectionId}" data-paths="${this.escapeHtml(JSON.stringify(pathsOfLength))}" type="application/json"></script>`;
                    }
                });

            html += `
                </div>
            </div>
            `;
        } else if (data.referenceChains) {
            html += `
            <div class="card mb-lg">
                <div class="card-content text-center text-muted p-lg">
                    <span style="font-size: 2rem; display: block; margin-bottom: var(--spacing-sm);">🌳</span>
                    다단계로 깊게 연결된 참조 트리 흐름이 없습니다. (현재 쾌적한 상태입니다)
                </div>
            </div>
            `;
        }

        propertiesSection.innerHTML = html;
    },

    _renderReferenceChainItem(item) {
        let html = `
            <div class="opportunity-item mb-sm bg-secondary" style="border-left-color: var(--color-warning);">
                <div class="opp-header mb-xs">
                    <div class="opp-title">
                        <strong>${this.escapeHtml(item.sourceDb)}</strong>의 <span class="property-tag">${this.escapeHtml(item.sourceField)}</span> 필드 시작
                    </div>
                    <span class="opp-priority text-muted">${item.sourceType}</span>
                </div>
                <div class="opp-content">
                    <div style="display: flex; flex-wrap: wrap; align-items: center; gap: var(--spacing-xs);">
        `;

        item.path.forEach((node, nodeIdx) => {
            const isRollup = node.fieldType === 'rollup';
            const stepIcon = isRollup ? '🔄' : '🧮';
            const refDbName = node.referencedPropertyDb || 'Unknown';
            
            if (nodeIdx > 0) {
                html += `<span style="color: var(--color-primary-deep); font-weight: bold;">→</span>`;
            }
            
            html += `
                        <div style="background: var(--color-surface); border: 1px solid var(--color-divider); border-radius: var(--radius-sm); padding: var(--spacing-xs) var(--spacing-sm); font-size: 0.85rem; box-shadow: var(--shadow-xs);">
                            ${stepIcon} <strong>[${this.escapeHtml(node.db)}]</strong> ${this.escapeHtml(node.fieldName)}
            `;
            
            if (node.referencedProperty) {
                html += ` <span style="color: var(--color-neutral);">↳</span> <strong>[${this.escapeHtml(refDbName)}]</strong> ${this.escapeHtml(node.referencedProperty)}`;
            }
            if (node.aggregationFunction) {
                html += ` <span class="text-muted">(${this.escapeHtml(node.aggregationFunction)})</span>`;
            }
            
            html += `</div>`;
        });

        html += `
                    </div>
                </div>
            </div>
        `;
        return html;
    },

    loadMoreReferenceChains(sectionId, chainLength, itemsPerPage) {
        const section = document.getElementById(sectionId);
        if (!section) return;

        const script = document.querySelector(`script[data-section-id="${sectionId}"]`);
        if (!script) return;

        try {
            const pathsOfLength = JSON.parse(script.getAttribute('data-paths'));
            const currentCount = section.querySelectorAll('.opportunity-item').length;
            const startIdx = currentCount;
            const endIdx = Math.min(startIdx + itemsPerPage, pathsOfLength.length);

            // 더 많은 항목 렌더링
            let newHtml = '';
            for (let i = startIdx; i < endIdx; i++) {
                newHtml += this._renderReferenceChainItem(pathsOfLength[i]);
            }

            // "더 보기" 버튼 영역 찾기 및 업데이트
            const button = section.parentElement.querySelector('.btn-secondary');
            if (button) {
                section.innerHTML += newHtml;
                const remainingCount = pathsOfLength.length - endIdx;
                if (remainingCount > 0) {
                    button.textContent = `더 보기 (${remainingCount}개 항목)`;
                } else {
                    button.style.display = 'none';
                }
            }
        } catch (e) {
            console.error('더 보기 로드 실패:', e);
        }
    },

    /**
     * 트리 노드에서 root부터 각 노드까지의 모든 경로를 추출
     * root부터 각 leaf까지의 경로를 배열로 반환
     */
    _extractPathsFromTree(treeNode, currentPath = []) {
        if (!treeNode) return [];

        const paths = [];
        const newPath = [...currentPath, treeNode];

        // 자식이 없으면 이 경로를 저장
        if (!treeNode.children || treeNode.children.length === 0) {
            paths.push(newPath);
        } else {
            // 각 자식에 대해 재귀적으로 경로 추출
            treeNode.children.forEach(child => {
                const childPaths = this._extractPathsFromTree(child, newPath);
                paths.push(...childPaths);
            });
        }

        return paths;
    },

    showError(message) {
        const container = document.getElementById('messagesContainer') || this._createMessageContainer();
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message error';
        messageDiv.textContent = message;
        container.appendChild(messageDiv);
        setTimeout(() => messageDiv.remove(), 5000);
    },

    showSuccess(message) {
        const container = document.getElementById('messagesContainer') || this._createMessageContainer();
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message success';
        messageDiv.textContent = message;
        container.appendChild(messageDiv);
        setTimeout(() => messageDiv.remove(), 3000);
    },

    _createMessageContainer() {
        const container = document.createElement('div');
        container.id = 'messagesContainer';
        container.className = 'messages-container';
        document.body.appendChild(container);
        return container;
    },

    // ============ 스켈레톤 UI 렌더링 함수 ============

    /**
     * 데이터베이스 목록 스켈레톤 렌더링
     */
    renderSkeletonDatabases() {
        const container = document.getElementById('databasesList');
        let html = '<div class="skeleton-grid">';
        
        // 4개의 스켈레톤 카드 생성
        for (let i = 0; i < 4; i++) {
            html += `
                <div class="skeleton-database-card">
                    <div class="skeleton-icon skeleton"></div>
                    <div class="skeleton-text lg skeleton"></div>
                    <div class="skeleton-text skeleton"></div>
                    <div class="skeleton-text skeleton"></div>
                </div>
            `;
        }
        
        html += '</div>';
        container.innerHTML = html;
    },

    /**
     * 테이블 스켈레톤 렌더링
     */
    renderSkeletonTable() {
        const container = document.getElementById('tablePlaceholder');
        let html = `
            <div class="skeleton-table">
                <div class="skeleton-table-header">
                    <div class="skeleton-text lg skeleton"></div>
                    <div class="skeleton-text lg skeleton"></div>
                    <div class="skeleton-text lg skeleton"></div>
                    <div class="skeleton-text lg skeleton"></div>
                </div>
        `;
        
        // 5개의 스켈레톤 행 생성
        for (let i = 0; i < 5; i++) {
            html += `
                <div class="skeleton-table-row">
                    <div class="skeleton-text skeleton"></div>
                    <div class="skeleton-text skeleton"></div>
                    <div class="skeleton-text skeleton"></div>
                    <div class="skeleton-text skeleton"></div>
                </div>
            `;
        }
        
        html += '</div>';
        container.innerHTML = html;
    },

    /**
     * 분석 탭 스켈레톤 렌더링
     */
    renderSkeletonAnalysis() {
        const container = document.getElementById('analysisPlaceholder');
        let html = `
            <div class="skeleton-analysis">
                <!-- 주요 통계 카드 -->
                <div class="skeleton-section">
                    <div class="skeleton-stat-card">
                        <div class="skeleton-icon skeleton"></div>
                        <div>
                            <div class="skeleton-text lg skeleton"></div>
                            <div class="skeleton-text lg skeleton"></div>
                            <div class="skeleton-text skeleton"></div>
                        </div>
                    </div>
                </div>
                
                <!-- 섹션 1 -->
                <div class="skeleton-section">
                    <div class="skeleton-text lg skeleton" style="width: 50%;"></div>
                    <div class="skeleton-list-item">
                        <div class="skeleton-text skeleton"></div>
                        <div class="skeleton-text skeleton"></div>
                        <div class="skeleton-text skeleton"></div>
                    </div>
                    <div class="skeleton-list-item">
                        <div class="skeleton-text skeleton"></div>
                        <div class="skeleton-text skeleton"></div>
                        <div class="skeleton-text skeleton"></div>
                    </div>
                </div>
                
                <!-- 섹션 2 -->
                <div class="skeleton-section">
                    <div class="skeleton-text lg skeleton" style="width: 50%;"></div>
                    <div class="skeleton-list-item">
                        <div class="skeleton-text skeleton"></div>
                        <div class="skeleton-text skeleton"></div>
                    </div>
                    <div class="skeleton-list-item">
                        <div class="skeleton-text skeleton"></div>
                        <div class="skeleton-text skeleton"></div>
                    </div>
                    <div class="skeleton-list-item">
                        <div class="skeleton-text skeleton"></div>
                        <div class="skeleton-text skeleton"></div>
                    </div>
                </div>
            </div>
        `;
        container.innerHTML = html;
    },

    /**
     * 네트워크 탭 스켈레톤 렌더링
     */
    renderSkeletonNetwork() {
        const containerLeft = document.getElementById('networkContainer');
        const containerRight = document.getElementById('networkPropertiesPanel');
        
        // 좌측 vis.js 컨테이너 스켈레톤
        let networkHtml = `
            <div class="skeleton-network" style="width: 100%; height: 500px; background: linear-gradient(90deg, var(--color-surface) 25%, var(--color-border) 50%, var(--color-surface) 75%); background-size: 200% 100%; animation: loading 1.5s infinite;"></div>
        `;
        containerLeft.innerHTML = networkHtml;

        // 우측 속성 패널 스켈레톤
        let propertiesHtml = `
            <div class="skeleton-section" style="padding: var(--spacing-lg);">
                <div class="skeleton-text lg skeleton" style="width: 60%; margin-bottom: var(--spacing-md);"></div>
                <div class="skeleton-list-item">
                    <div class="skeleton-text skeleton"></div>
                    <div class="skeleton-text skeleton"></div>
                </div>
                <div class="skeleton-list-item" style="margin-top: var(--spacing-md);">
                    <div class="skeleton-text skeleton"></div>
                    <div class="skeleton-text skeleton"></div>
                </div>
            </div>
        `;
        if (containerRight) {
            containerRight.innerHTML = propertiesHtml;
        }
    }
};

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => app.init());
