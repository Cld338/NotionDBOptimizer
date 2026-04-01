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

    // Notion 필드 타입별 아이콘 및 표시 이름
    propertyTypeMap: {
        'title': { icon: '📝', label: '제목' },
        'rich_text': { icon: '📄', label: '텍스트' },
        'number': { icon: '🔢', label: '숫자' },
        'select': { icon: '📌', label: '선택' },
        'multi_select': { icon: '🏷️', label: '다중 선택' },
        'date': { icon: '📅', label: '날짜' },
        'checkbox': { icon: '✓', label: '체크박스' },
        'email': { icon: '📧', label: '이메일' },
        'phone_number': { icon: '📞', label: '전화번호' },
        'url': { icon: '🔗', label: 'URL' },
        'created_time': { icon: '⏰', label: '생성 일시' },
        'last_edited_time': { icon: '⏱️', label: '최종 편집 일시' },
        'created_by': { icon: '👤', label: '생성자' },
        'last_edited_by': { icon: '👤', label: '최종 편집자' },
        'people': { icon: '👥', label: '사람' },
        'relation': { icon: '🔗', label: '관계형' },
        'rollup': { icon: '🔄', label: '롤업' },
        'formula': { icon: '🧮', label: '수식' },
        'files': { icon: '📁', label: '파일' },
        'button': { icon: '🔘', label: '버튼' },
        'unique_id': { icon: '#️⃣', label: 'ID' }
    },

    /**
     * 필드 타입을 정규화하고 아이콘과 표시 이름 반환
     */
    getPropertyTypeDisplay(type) {
        const lowerType = (type || '').toLowerCase().trim();
        return this.propertyTypeMap[lowerType] || { 
            icon: '❓', 
            label: type || 'UNKNOWN' 
        };
    },

    /**
     * 필드 타입을 아이콘 + 레이블 형식으로 포맷팅
     */
    formatPropertyType(type) {
        const display = this.getPropertyTypeDisplay(type);
        return `${display.icon} ${display.label}`;
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

                <!-- 4-1단계: 깊은 참조 경로 분석 섹션 (별도) -->
                ${performanceAnalysis.deepReferenceChains && performanceAnalysis.deepReferenceChains.length > 0 ? `
                <div class="collapsible-section" data-section="deep-chains">
                    <div class="section-header" onclick="app.toggleSection(event)">
                        <div class="section-title-wrapper">
                            <span class="section-icon">🔗</span>
                            <div class="section-title-group">
                                <h3 class="section-title">깊은 참조 경로 분석</h3>
                                <p class="section-subtitle">${performanceAnalysis.deepReferenceChains.length}개 발견 - 3단계 이상의 참조 체인</p>
                            </div>
                        </div>
                        <div class="section-header-actions">
                            <div class="collapse-toggle">▼</div>
                        </div>
                    </div>
                    <div class="section-content">
                        ${this.renderDeepReferenceChainsSection(performanceAnalysis.deepReferenceChains, performanceAnalysis.deepChainsMetrics)}
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
            const typeDisplay = this.formatPropertyType(stats.type);
            
            html += `
                <div class="column-row">
                    <div class="column-info">
                        <div class="column-name">
                            <span class="data-field-name">${this.escapeHtml(stats.name)}</span>
                        </div>
                        <div class="column-type">${typeDisplay}</div>
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
                        ${sortedTypes.map(([type, count]) => {
                            const display = this.getPropertyTypeDisplay(type);
                            return `
                                <div class="type-item">
                                    <div class="type-name">${display.icon} ${display.label}</div>
                                    <div class="type-bar">
                                        <div class="type-fill" style="width: ${(count / totalColumns * 100)}%"></div>
                                    </div>
                                    <div class="type-count">${count}</div>
                                </div>
                            `;
                        }).join('')}
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

    /**
     * 깊은 참조 경로 분석 섹션 렌더링 (내용만)
     */
    renderDeepReferenceChainsSection(deepChains, metrics) {
        if (!deepChains || deepChains.length === 0) {
            return '';
        }

        // ★ metrics이 없을 경우 자동으로 계산
        const safeMetrics = metrics || {
            totalChains: deepChains.length,
            maxDepth: Math.max(...deepChains.map(c => c.depth || 0), 0),
            totalAffectedRecords: deepChains.reduce((sum, c) => sum + (c.affectedRecords || 0), 0),
            avgDepth: Math.round(deepChains.reduce((sum, c) => sum + (c.depth || 0), 0) / deepChains.length * 10) / 10,
            criticalCount: deepChains.filter(c => c.severity === 'critical').length,
            warningCount: deepChains.filter(c => c.severity === 'warning').length,
            infoCount: deepChains.filter(c => c.severity === 'info').length,
            affectedDatabasesCount: new Set(deepChains.flatMap(c => c.relatedDatabases || [])).size
        };

        let html = `
            <div class="deep-chains-section">
                <!-- ★ 요약 대시보드 상단 배치 -->
                <div class="deep-chains-metrics">
                    <div class="metrics-grid">
                        <div class="metric-card critical">
                            <div class="metric-label">⚠️ 심각도</div>
                            <div class="metric-value severity-badge">
                                ${safeMetrics.criticalCount > 0 ? `<span>🔴 ${safeMetrics.criticalCount}</span>` : ''}
                                ${safeMetrics.warningCount > 0 ? `<span>🟠 ${safeMetrics.warningCount}</span>` : ''}
                                ${safeMetrics.infoCount > 0 ? `<span>🟢 ${safeMetrics.infoCount}</span>` : ''}
                            </div>
                        </div>
                        <div class="metric-card">
                            <div class="metric-label">📊 최대 깊이</div>
                            <div class="metric-value">${safeMetrics.maxDepth || 0}</div>
                            <div class="metric-desc">가장 복잡한 경로</div>
                        </div>
                        <div class="metric-card">
                            <div class="metric-label">🔗 발견된 체인</div>
                            <div class="metric-value">${deepChains.length}</div>
                            <div class="metric-desc">3단계 이상</div>
                        </div>
                        <div class="metric-card">
                            <div class="metric-label">💾 영향 범위</div>
                            <div class="metric-value">${safeMetrics.totalAffectedRecords || 0}</div>
                            <div class="metric-desc">레코드 수</div>
                        </div>
                    </div>
                </div>

                <!-- 체인 목록 -->
                <div class="deep-chains-list">
                    ${deepChains.map((chain, idx) => this._renderDeepChainItem(chain, idx)).join('')}
                </div>
            </div>
        `;

        return html;
    },

    /**
     * 개별 깊은 참조 경로 아이템 렌더링
     */
    _renderDeepChainItem(chain, index) {
        const chainId = `deep-chain-${index}`;
        const pathText = chain.path.map(node => `${node.db}.${node.field}`).join(' → ');
        const severityColor = chain.severity === 'critical' ? '#ef4444' : chain.severity === 'warning' ? '#f59e0b' : '#10b981';
        const severityLabel = chain.severity === 'critical' ? '높음' : chain.severity === 'warning' ? '중간' : '낮음';
        const depthBadgeColor = chain.depth >= 5 ? '#dc2626' : chain.depth >= 4 ? '#ea580c' : '#0ea5e9';

        let html = `
            <div class="deep-chain-item" data-chain-id="${chainId}">
                <div class="deep-chain-header" onclick="app.toggleDeepChainItem('${chainId}')">
                    <div class="deep-chain-header-left">
                        <span class="deep-chain-toggle">▶</span>
                        <span class="deep-chain-depth-badge" style="background-color: ${depthBadgeColor};">${chain.depth}단계</span>
                        <span class="deep-chain-path-text" title="${pathText}">${this.escapeHtml(pathText)}</span>
                    </div>
                    <div class="deep-chain-header-right">
                        <span class="deep-chain-info">
                            영향: <strong>${chain.affectedRecords}</strong>개 레코드
                        </span>
                        <span class="deep-chain-severity" style="background-color: ${severityColor};">
                            ${severityLabel}
                        </span>
                        <button class="action-btn" onclick="event.stopPropagation(); app.openNotionDatabase()" title="Notion으로 이동">↗</button>
                    </div>
                </div>
                <div class="deep-chain-content" style="display: none;">
                    ${this._renderDeepChainContent(chain)}
                </div>
            </div>
        `;

        return html;
    },

    /**
     * 깊은 참조 경로 펼쳐진 컨텐츠 렌더링
     */
    _renderDeepChainContent(chain) {
        const depthDescription = chain.depth >= 5 
            ? `이 체인은 매우 깊습니다(${chain.depth}단계). 각 쿼리마다 여러 단계의 중첩 계산이 필요합니다.`
            : `이 체인은 ${chain.depth}단계로 구성되어 있습니다.`;

        let html = `
            <div class="deep-chain-content-inner">
                <!-- 🔀 참조 경로 -->
                <div class="chain-section">
                    <h5 class="chain-section-title">🔀 참조 경로 (${chain.relatedDatabases.length}개)</h5>
                    <div class="chain-section-content">
                        <div class="indented-tree-root" style="background: none; border: none; padding: 0;">
                            ${chain.tree ? this._renderReferenceChainAsIndentedTree(
                                chain.sourceDb,
                                chain.sourceField,
                                chain.sourceType,
                                chain.tree
                            ) : `<p style="color: var(--color-text-muted); font-size: 0.9rem;">트리 정보를 불러올 수 없습니다</p>`}
                        </div>
                    </div>
                </div>

                <!-- 💡 최적화 제안 -->
                <div class="chain-section">
                    <h5 class="chain-section-title">💡 최적화 제안 (${chain.optimizationTips.length}개)</h5>
                    <div class="chain-section-content">
                        <div class="chain-tips-list">
                            ${chain.optimizationTips.map((tip, idx) => {
                                const priorityColor = tip.priority === 'high' ? '#ef4444' : tip.priority === 'medium' ? '#f59e0b' : '#3b82f6';
                                const priorityLabel = tip.priority === 'high' ? '우선' : tip.priority === 'medium' ? '추가' : '참고';
                                return `
                                    <div class="chain-tip-item">
                                        <div class="chain-tip-header">
                                            <span class="chain-tip-priority" style="background-color: ${priorityColor};">${priorityLabel}</span>
                                            <span class="chain-tip-title">${this.escapeHtml(tip.title)}</span>
                                        </div>
                                        <p class="chain-tip-desc">${this.escapeHtml(tip.description)}</p>
                                        <p class="chain-tip-action">💬 ${this.escapeHtml(tip.action)}</p>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;

        return html;
    },

    /**
     * 체인 타입별 색상 반환
     */
    _getChainTypeColor(type) {
        const typeMap = {
            'formula': 'rgba(168, 85, 247, 0.15)',
            'rollup': 'rgba(34, 197, 94, 0.15)',
            'relation': 'rgba(59, 130, 246, 0.15)',
            'select': 'rgba(245, 158, 11, 0.15)',
            'multi_select': 'rgba(245, 158, 11, 0.15)'
        };
        return typeMap[type] || 'rgba(148, 163, 184, 0.15)';
    },

    /**
     * 깊은 참조 경로 아이템 토글
     */
    toggleDeepChainItem(chainId) {
        const item = document.querySelector(`[data-chain-id="${chainId}"]`);
        if (!item) return;

        const header = item.querySelector('.deep-chain-header');
        const content = item.querySelector('.deep-chain-content');
        const toggle = item.querySelector('.deep-chain-toggle');

        const isExpanded = content.style.display !== 'none';

        // 다른 모든 아이템 닫기
        document.querySelectorAll('.deep-chain-item').forEach(el => {
            if (el !== item) {
                el.querySelector('.deep-chain-content').style.display = 'none';
                el.querySelector('.deep-chain-toggle').classList.remove('expanded');
            }
        });

        // 현재 아이템 토글
        if (isExpanded) {
            content.style.display = 'none';
            toggle.classList.remove('expanded');
        } else {
            content.style.display = 'block';
            toggle.classList.add('expanded');
        }
    },

    /**
     * 네트워크 탭의 참조 경로 시각화로 스크롤
     */


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






    /**
     * 참조 트리를 인덴트 트리 HTML로 렌더링
     */
    _renderReferenceChainAsIndentedTree(sourceDb, sourceField, sourceType, treeRoot) {
        // 타입 안전 처리
        const safeSourceType = (sourceType || 'formula').toLowerCase().trim();
        const sourceTypeDisplay = this.getPropertyTypeDisplay(safeSourceType);
        
        let html = `
            <div class="tree-node-item">
                <div class="tree-node-label">
                    <span class="tree-node-type ${safeSourceType}">${sourceTypeDisplay.icon} ${sourceTypeDisplay.label.toUpperCase()}</span>
                    <span class="tree-node-db">[${this.escapeHtml(sourceDb)}]</span>
                    <span class="tree-node-field">${this.escapeHtml(sourceField)}</span>
                </div>
        `;

        if (treeRoot.children && treeRoot.children.length > 0) {
            html += `<div class="tree-node-container">`;
            treeRoot.children.forEach((child, idx) => {
                html += this._renderIndentedTreeNode(child, 1, idx === treeRoot.children.length - 1, treeRoot.children.length);
            });
            html += `</div>`;
        }

        html += `
            </div>
        `;

        return html;
    },

    /**
     * 재귀적으로 인덴트 트리 노드 렌더링
     */
    _renderIndentedTreeNode(node, depth, isLast, siblingCount) {
        // 노드 타입 안전 처리
        const nodeType = (node.type || 'formula').toLowerCase().trim();
        const display = this.getPropertyTypeDisplay(nodeType);
        const typeIcon = display.icon;
        const typeLabel = display.label.toUpperCase();
        const refDbName = node.referencedPropertyDb || 'Unknown';

        let html = `
            <div class="tree-node-item">
                <div class="tree-node-label">
                    <span class="tree-node-type ${nodeType}">${typeIcon} ${typeLabel}</span>
                    <span class="tree-node-db">[${this.escapeHtml(node.db)}]</span>
                    <span class="tree-node-field">${this.escapeHtml(node.fieldName)}</span>
                </div>
        `;

        // 자식 노드들 및 참조 정보 렌더링
        if ((node.children && node.children.length > 0) || node.referencedProperty) {
            html += `<div class="tree-node-container">`;
            
            // 참조 정보를 자식 노드처럼 렌더링
            if (node.referencedProperty) {
                // 참조된 필드의 실제 타입 사용
                const refFieldType = (node.referencedPropertyType || nodeType).toLowerCase().trim();
                const refDisplay = this.getPropertyTypeDisplay(refFieldType);
                const refTypeIcon = refDisplay.icon;
                const refTypeLabel = refDisplay.label.toUpperCase();
                
                html += `
                <div class="tree-node-item">
                    <div class="tree-node-label">
                        <span class="tree-node-type ${refFieldType}">${refTypeIcon} ${refTypeLabel}</span>
                        <span class="tree-node-db">[${this.escapeHtml(refDbName)}]</span>
                        <span class="tree-node-field">${this.escapeHtml(node.referencedProperty)}</span>
                `;
                if (node.aggregationFunction) {
                    html += `<span class="tree-node-type" style="background: rgba(180, 180, 180, 0.1); color: #999;">${this.escapeHtml(node.aggregationFunction)}</span>`;
                }
                html += `
                    </div>
                </div>
                `;
            }
            
            // 자식 노드들 렌더링
            if (node.children && node.children.length > 0) {
                node.children.forEach((child, idx) => {
                    const isLastChild = idx === node.children.length - 1;
                    html += this._renderIndentedTreeNode(child, depth + 1, isLastChild, node.children.length);
                });
            }
            
            html += `</div>`;
        }

        html += `
            </div>
        `;

        return html;
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
    }

};

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => app.init());
