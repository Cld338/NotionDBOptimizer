// ============ 유틸리티 ============
/**
 * DOMUtils - DOM 조작 유틸리티
 * 책임: 클래스 및 속성 관리 헬퍼 함수 제공
 */
const DOMUtils = {
    /**
     * 요소를 숨김 (is-hidden 클래스 추가)
     */
    hide(element) {
        if (element) element.classList.add('is-hidden');
    },

    /**
     * 요소를 표시 (is-hidden 클래스 제거)
     */
    show(element) {
        if (element) element.classList.remove('is-hidden');
    },

    /**
     * 요소 표시 상태 토글
     */
    toggle(element) {
        if (element) element.classList.toggle('is-hidden');
    },

    /**
     * 요소를 활성화 (is-active 클래스 추가)
     */
    setActive(element) {
        if (element) element.classList.add('is-active');
    },

    /**
     * 요소를 비활성화 (is-active 클래스 제거)
     */
    removeActive(element) {
        if (element) element.classList.remove('is-active');
    },

    /**
     * 요소 그룹 중에서 활성 클래스 변경
     */
    setActiveInGroup(elements, targetElement) {
        elements.forEach(el => this.removeActive(el));
        if (targetElement) this.setActive(targetElement);
    },

    /**
     * 요소 그룹을 모두 숨김
     */
    hideAll(selector) {
        document.querySelectorAll(selector).forEach(el => this.hide(el));
    },

    /**
     * 요소 그룹을 모두 표시
     */
    showAll(selector) {
        document.querySelectorAll(selector).forEach(el => this.show(el));
    }
};

// ============ 이벤트 위임 ============
/**
 * EventDelegator - 이벤트 위임 관리
 * 책임: 데이터 속성 기반 이벤트 처리
 */
const EventDelegator = {
    init() {
        // 클릭 이벤트 위임
        document.addEventListener('click', (event) => this.handleClick(event));
        
        // 검색 입력 이벤트 (엔터 키)
        document.addEventListener('keyup', (event) => this.handleKeyup(event));
    },

    handleClick(event) {
        const target = event.target.closest('[data-action]') || event.target.closest('[data-view]') || event.target.closest('[data-tab]');
        
        if (!target) return;
        
        const action = target.dataset.action;
        const view = target.dataset.view;
        const tab = target.dataset.tab;

        // 데이터 속성에 따른 처리
        if (action === 'search') {
            EventHandler.onDatabaseSearch();
        } else if (action === 'refresh-databases') {
            DatabaseManager.refreshDatabases();
        } else if (action === 'prev-page') {
            EventHandler.previousDatabasePage();
        } else if (action === 'next-page') {
            EventHandler.nextDatabasePage();
        } else if (action === 'refresh-current') {
            EventHandler.refreshCurrentTab();
        } else if (action === 'close-modal') {
            const modal = document.getElementById('optimizationModal');
            if (modal) modal.close();
        } else if (view === 'databases') {
            EventHandler.switchView('databases');
            // 확장 아이콘 상태 업데이트
            const expandIcon = document.getElementById('databasesExpandIcon');
            if (expandIcon.classList.contains('is-hidden')) {
                DOMUtils.show(expandIcon);
                DOMUtils.show(document.getElementById('databasesTabs'));
            } else {
                DOMUtils.hide(expandIcon);
                DOMUtils.hide(document.getElementById('databasesTabs'));
            }
            event.stopPropagation();
        } else if (tab === 'analysis') {
            app.switchTab('analysis');
            event.stopPropagation();
        }
    },

    handleKeyup(event) {
        if (event.target.id === 'databaseSearchInput' && event.key === 'Enter') {
            EventHandler.onDatabaseSearch();
        }
    }
};

// ============ 상태 관리 ============
/**
 * AppState - 애플리케이션 전역 상태 관리
 * 책임: 앱의 모든 상태 데이터를 관리
 */
const AppState = {
    currentDatabaseId: null,
    currentPage: 1,
    currentDatabaseProperties: null,
    currentTab: 'data',
    allDatabases: [],
    filteredDatabases: [],
    databasePageSize: 16,
    databaseCurrentPage: 1,

    setCurrentDatabase(databaseId, properties = null) {
        this.currentDatabaseId = databaseId;
        this.currentDatabaseProperties = properties;
        this.currentPage = 1;
    },

    setCurrentTab(tabName) {
        this.currentTab = tabName;
    },

    setDatabaseList(databases) {
        this.allDatabases = databases;
        this.filteredDatabases = [...databases];
        this.databaseCurrentPage = 1;
    },

    filterDatabases(searchText) {
        const lowerSearch = searchText.toLowerCase();
        this.filteredDatabases = this.allDatabases.filter(db =>
            db.title.toLowerCase().includes(lowerSearch)
        );
        this.databaseCurrentPage = 1;
    },

    nextDatabasePage() {
        const totalPages = Math.ceil(this.filteredDatabases.length / this.databasePageSize);
        if (this.databaseCurrentPage < totalPages) {
            this.databaseCurrentPage++;
        }
    },

    previousDatabasePage() {
        if (this.databaseCurrentPage > 1) {
            this.databaseCurrentPage--;
        }
    }
};

// ============ 2. 포맷팅 및 유틸 ============
/**
 * Formatter - 데이터 포맷팅 및 문자열 처리
 * 책임: 데이터를 표시 가능한 형식으로 변환
 */
const Formatter = {
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

    getPropertyTypeDisplay(type) {
        const lowerType = (type || '').toLowerCase().trim();
        return this.propertyTypeMap[lowerType] || {
            icon: '❓',
            label: type || 'UNKNOWN'
        };
    },

    formatPropertyType(type) {
        const display = this.getPropertyTypeDisplay(type);
        return `${display.icon} ${display.label}`;
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    getQualityLevel(score) {
        if (score >= 90) return '탁월함';
        if (score >= 80) return '우수';
        if (score >= 70) return '좋음';
        if (score >= 60) return '보통';
        if (score >= 50) return '주의필요';
        return '개선필요';
    },

    getComplexityLabel(level) {
        if (level === 'high') return '높음';
        if (level === 'medium') return '중간';
        return '낮음';
    }
};

// ============ 3. 메시지 표시 ============
/**
 * NotificationService - 사용자 알림 표시
 * 책임: 성공, 에러 메시지를 화면에 표시
 */
const NotificationService = {
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
    }
};

// ============ 4. API 통신 ============
/**
 * ApiService - 백엔드 API 통신
 * 책임: 모든 HTTP 요청을 처리
 */
const ApiService = {
    async fetchUser() {
        const response = await fetch('/auth/user');
        return response.ok ? response.json() : null;
    },

    async fetchDatabases() {
        const response = await fetch('/api/databases');
        if (!response.ok) throw new Error('API 오류');
        return response.json();
    },

    async fetchDatabase(databaseId) {
        const response = await fetch(`/api/database/${databaseId}`);
        if (!response.ok) throw new Error('데이터베이스 구조 로드 실패');
        return response.json();
    },

    async fetchAnalysis(databaseId) {
        const response = await fetch(`/api/analyze/${databaseId}`);
        if (!response.ok) throw new Error('분석 로드 실패');
        return response.json();
    },

    async refreshDatabaseList() {
        const response = await fetch('/api/databases/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        if (!response.ok) throw new Error('DB 목록 새로고침 실패');
        return response.json();
    },

    async refreshAnalysis(databaseId) {
        const response = await fetch(`/api/analyze/${databaseId}/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        if (!response.ok) throw new Error('분석 새로고침 실패');
        return response.json();
    },

    async refreshNetwork(databaseId) {
        const response = await fetch(`/api/network/${databaseId}/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        if (!response.ok) throw new Error('네트워크 새로고침 실패');
        return response.json();
    },

    async prefetchData(databaseId) {
        try {
            const response = await fetch(`/api/prefetch/${databaseId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });
            return response.ok;
        } catch (error) {
            console.warn('[Prefetch] Error starting prefetch:', error.message);
            return false;
        }
    }
};

// ============ 5. 스켈레톤 UI ============
/**
 * SkeletonRenderer - 로딩 상태 UI 렌더링
 * 책임: 스켈레톤 로딩 UI를 생성하고 표시
 */
const SkeletonRenderer = {
    renderDatabases() {
        const container = document.getElementById('databasesList');
        let html = '<div class="skeleton-grid">';
        for (let i = 0; i < 4; i++) {
            html += `<div class="skeleton-database-card">
                <div class="skeleton-icon skeleton"></div>
                <div class="skeleton-text lg skeleton"></div>
                <div class="skeleton-text skeleton"></div>
                <div class="skeleton-text skeleton"></div>
            </div>`;
        }
        container.innerHTML = html + '</div>';
    },

    renderAnalysis() {
        const container = document.getElementById('analysisPlaceholder');
        container.innerHTML = `<div class="skeleton-analysis">
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
            <div class="skeleton-section">
                <div class="skeleton-text lg skeleton" style="width: 50%;"></div>
                <div class="skeleton-list-item">
                    <div class="skeleton-text skeleton"></div>
                    <div class="skeleton-text skeleton"></div>
                    <div class="skeleton-text skeleton"></div>
                </div>
            </div>
        </div>`;
    },

    renderTable() {
        const container = document.getElementById('tablePlaceholder');
        let html = '<div class="skeleton-table"><div class="skeleton-table-header">';
        for (let i = 0; i < 4; i++) {
            html += '<div class="skeleton-text lg skeleton"></div>';
        }
        html += '</div>';
        for (let i = 0; i < 5; i++) {
            html += '<div class="skeleton-table-row">';
            for (let j = 0; j < 4; j++) {
                html += '<div class="skeleton-text skeleton"></div>';
            }
            html += '</div>';
        }
        container.innerHTML = html + '</div>';
    }
};

// ============ 6. 색상 및 상수 ============
/**
 * Constants - 상수 정의
 */
const Constants = {
    colors: {
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444'
    },
    priorityColors: {
        high: '#D47D3C',
        medium: '#E8944A',
        low: '#F5B878'
    }
};

// ============ 7. UI 렌더링 ============
/**
 * UIRenderer - 기본 UI 렌더링
 * 책임: HTML을 생성하고 DOM에 출력
 */
const UIRenderer = {
    renderDatabaseCard(db) {
        return `<div class="database-card" data-db-id="${db.id}">
            <div class="database-icon">${db.icon?.emoji || '📊'}</div>
            <div class="database-title">${Formatter.escapeHtml(db.title)}</div>
            <div class="database-meta">
                <div>수정: ${new Date(db.last_edited_time).toLocaleDateString('ko-KR')}</div>
            </div>
        </div>`;
    },

    renderDatabases(databases) {
        const container = document.getElementById('databasesList');
        if (databases.length === 0) {
            container.innerHTML = '<div class="error">사용 가능한 데이터베이스가 없습니다.</div>';
            return;
        }
        const startIdx = (AppState.databaseCurrentPage - 1) * AppState.databasePageSize;
        const endIdx = startIdx + AppState.databasePageSize;
        const paginatedDatabases = databases.slice(startIdx, endIdx);
        container.innerHTML = paginatedDatabases.map(db => this.renderDatabaseCard(db)).join('');
        
        // 데이터베이스 카드 클릭 이벤트 위임
        container.addEventListener('click', (e) => {
            const card = e.target.closest('.database-card');
            if (card) {
                const dbId = card.dataset.dbId;
                const dbTitle = card.querySelector('.database-title').textContent;
                app.selectDatabase(dbId, dbTitle);
            }
        });
    },

    updateDatabasesPagination() {
        const totalPages = Math.ceil(AppState.filteredDatabases.length / AppState.databasePageSize);
        const paginationEl = document.getElementById('databasesPagination');
        const pageInfoEl = document.getElementById('pageInfo');
        const prevBtn = document.getElementById('prevBtn');
        const nextBtn = document.getElementById('nextBtn');
        if (totalPages <= 1) {
            DOMUtils.hide(paginationEl);
        } else {
            DOMUtils.show(paginationEl);
            pageInfoEl.textContent = `${AppState.databaseCurrentPage} / ${totalPages}`;
            prevBtn.disabled = AppState.databaseCurrentPage === 1;
            nextBtn.disabled = AppState.databaseCurrentPage === totalPages;
        }
    },

    updateDatabasesCount() {
        document.getElementById('databasesCount').textContent = `총 ${AppState.filteredDatabases.length}개`;
    },

    updateDatabasesDisplay() {
        this.renderDatabases(AppState.filteredDatabases);
        this.updateDatabasesPagination();
        this.updateDatabasesCount();
    },

    switchView(viewName) {
        document.querySelectorAll('.view-section').forEach(v => DOMUtils.hide(v));
        const databasesExpandIcon = document.getElementById('databasesExpandIcon');
        const databasesTabs = document.getElementById('databasesTabs');
        const databasesNavBtn = document.getElementById('databasesNavBtn');
        if (viewName === 'databases') {
            DOMUtils.show(document.getElementById('databasesView'));
            DOMUtils.setActive(databasesNavBtn);
            DOMUtils.hide(databasesExpandIcon);
            DOMUtils.hide(databasesTabs);
        } else {
            DOMUtils.removeActive(databasesNavBtn);
        }
    },

    switchTab(tabName) {
        document.querySelectorAll('.nav-sub-item').forEach(btn => {
            if (btn.getAttribute('data-tab') === tabName) {
                DOMUtils.setActive(btn);
            } else {
                DOMUtils.removeActive(btn);
            }
        });
        document.querySelectorAll('.tab-content').forEach(tab => DOMUtils.hide(tab));
        if (tabName === 'analysis') {
            DOMUtils.show(document.getElementById('analysisTab'));
        }
    },

    showDatabase(databaseTitle) {
        DOMUtils.hide(document.getElementById('databasesView'));
        DOMUtils.show(document.getElementById('databaseDetail'));
        document.getElementById('databaseTitle').textContent = databaseTitle;
        DOMUtils.show(document.getElementById('databasesExpandIcon'));
        DOMUtils.show(document.getElementById('databasesTabs'));
    },

    copyToClipboard(text, button) {
        navigator.clipboard.writeText(text).then(() => {
            if (button) {
                button.classList.add('copied');
                setTimeout(() => button.classList.remove('copied'), 1500);
            }
        }).catch(err => {
            console.error('복사 실패:', err);
            alert('클립보드 복사에 실패했습니다.');
        });
    },

    openNotionDatabase(databaseId) {
        if (!databaseId) return;
        const notionUrl = `https://www.notion.so/${databaseId.replace(/-/g, '')}`;
        window.open(notionUrl, '_blank');
    }
};

// ============ 8. 분석 렌더링 ============
/**
 * AnalysisRenderer - 분석 데이터 렌더링
 * 책임: 분석 결과를 HTML로 변환하여 표시
 */
const AnalysisRenderer = {
    renderColumnAnalysis(columnStats) {
        let html = '';
        Object.entries(columnStats).forEach(([key, stats]) => {
            const completenessColor = stats.completeness >= 80 ? Constants.colors.success : stats.completeness >= 60 ? Constants.colors.warning : Constants.colors.error;
            const typeDisplay = Formatter.formatPropertyType(stats.type);
            html += `<div class="column-row">
                <div class="column-info">
                    <div class="column-name"><span class="data-field-name">${Formatter.escapeHtml(stats.name)}</span></div>
                    <div class="column-type">${typeDisplay}</div>
                </div>
                <div class="column-stats">
                    <div class="stat-item"><span>입력됨</span><strong>${stats.filledCount}/${stats.totalCount}</strong></div>
                    <div class="stat-item"><span>비율</span><strong>${stats.completeness}%</strong></div>
                    <div class="stat-item"><span>유니크 값</span><strong>${stats.uniqueCount}</strong></div>
                </div>
                <div class="completeness-bar">
                    <div class="bar" style="background-color: ${completenessColor}; width: ${stats.completeness}%"></div>
                </div>
            </div>`;
        });
        return html;
    },

    renderColumnAnalysisSummary(columnStats) {
        const entries = Object.entries(columnStats);
        const totalColumns = entries.length;
        let totalFilled = 0, totalRecords = 0, completenessSum = 0, uniqueSum = 0;
        let excellentCount = 0, goodCount = 0, warningCount = 0, criticalCount = 0;
        const typeDistribution = {};
        
        entries.forEach(([key, stats]) => {
            totalFilled += stats.filledCount;
            totalRecords += stats.totalCount;
            completenessSum += stats.completeness;
            uniqueSum += stats.uniqueCount;
            
            if (stats.completeness >= 80) excellentCount++;
            else if (stats.completeness >= 60) goodCount++;
            else if (stats.completeness >= 30) warningCount++;
            else criticalCount++;
            
            const type = stats.type;
            typeDistribution[type] = (typeDistribution[type] || 0) + 1;
        });
        
        const avgCompleteness = totalColumns > 0 ? Math.round(completenessSum / totalColumns) : 0;
        const avgUnique = totalColumns > 0 ? Math.round(uniqueSum / totalColumns) : 0;
        const sortedTypes = Object.entries(typeDistribution).sort(([,a], [,b]) => b - a).slice(0, 5);
        
        return `<div class="column-summary-panel">
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
            <div class="summary-section">
                <h4 class="summary-section-title">완성도 등급</h4>
                <div class="grade-distribution">
                    <div class="stacked-bar-wrapper">
                        <div class="stacked-bar">
                            <div class="grade-segment excellent" style="width: ${totalColumns > 0 ? (excellentCount / totalColumns * 100) : 0}%"></div>
                            <div class="grade-segment good" style="width: ${totalColumns > 0 ? (goodCount / totalColumns * 100) : 0}%"></div>
                            <div class="grade-segment warning" style="width: ${totalColumns > 0 ? (warningCount / totalColumns * 100) : 0}%"></div>
                            <div class="grade-segment critical" style="width: ${totalColumns > 0 ? (criticalCount / totalColumns * 100) : 0}%"></div>
                        </div>
                    </div>
                    <div class="grade-legend">
                        <div class="legend-item"><div class="legend-color excellent"></div><span class="legend-label">우수 (80%+): ${excellentCount}</span></div>
                        <div class="legend-item"><div class="legend-color good"></div><span class="legend-label">양호 (60-80%): ${goodCount}</span></div>
                        <div class="legend-item"><div class="legend-color warning"></div><span class="legend-label">주의 (40-60%): ${warningCount}</span></div>
                        <div class="legend-item"><div class="legend-color critical"></div><span class="legend-label">심각 (<40%): ${criticalCount}</span></div>
                    </div>
                </div>
            </div>
            <div class="summary-section">
                <h4 class="summary-section-title">컬럼 타입</h4>
                <div class="type-distribution">
                    ${sortedTypes.map(([type, count]) => {
                        const display = Formatter.getPropertyTypeDisplay(type);
                        return `<div class="type-item">
                            <div class="type-name">${display.icon} ${display.label}</div>
                            <div class="type-bar"><div class="type-fill" style="width: ${(count / totalColumns * 100)}%"></div></div>
                            <div class="type-count">${count}</div>
                        </div>`;
                    }).join('')}
                </div>
            </div>
        </div>`;
    },

    groupOpportunitiesByTitle(opportunities) {
        const grouped = {};
        opportunities.forEach(opp => {
            if (!grouped[opp.title]) {
                grouped[opp.title] = {
                    title: opp.title, description: opp.description, benefit: opp.benefit,
                    priority: opp.priority, difficulty: opp.difficulty || 'medium', type: opp.type,
                    count: 0, details: [], properties: [], types: []
                };
            }
            grouped[opp.title].count++;
            if (opp.property && !grouped[opp.title].properties.includes(opp.property)) {
                grouped[opp.title].properties.push(opp.property);
            }
            if (opp.type && !grouped[opp.title].types.includes(opp.type)) {
                grouped[opp.title].types.push(opp.type);
            }
            if (opp.action && !grouped[opp.title].details.some(d => d === opp.action)) {
                grouped[opp.title].details.push(opp.action);
            }
        });
        
        const groups = Object.values(grouped);
        return groups.sort((a, b) => {
            if (a.priority === 'high' && b.priority !== 'high') return -1;
            if (a.priority !== 'high' && b.priority === 'high') return 1;
            const aIsQuickWin = a.difficulty === 'low' && a.priority !== 'low';
            const bIsQuickWin = b.difficulty === 'low' && b.priority !== 'low';
            if (aIsQuickWin && !bIsQuickWin) return -1;
            if (!aIsQuickWin && bIsQuickWin) return 1;
            if (a.priority === 'medium' && b.priority !== 'medium') return -1;
            if (a.priority !== 'medium' && b.priority === 'medium') return 1;
            const difficultyOrder = { 'low': 0, 'medium': 1, 'high': 2 };
            if ((difficultyOrder[a.difficulty] || 1) !== (difficultyOrder[b.difficulty] || 1)) {
                return (difficultyOrder[a.difficulty] || 1) - (difficultyOrder[b.difficulty] || 1);
            }
            return b.count - a.count;
        });
    },

    renderPerformanceSuccessChecklist(performanceAnalysis) {
        const limits = performanceAnalysis.limits || {};
        const metrics = limits.metrics || {};
        let checklist = `<div class="success-checklist">
            <div class="checklist-title">성능 분석 - 모든 항목 정상</div>
            <div class="checklist-items">
                <div class="checklist-item"><span class="checklist-label">필드 개수</span><span class="checklist-value">권장 한계 이하 (최대 500개) <span style="color: var(--color-success); font-weight: 600; font-size: 0.8rem;">✓ 안정성 유지</span></span></div>
                <div class="checklist-item"><span class="checklist-label">레코드 개수</span><span class="checklist-value">성능 최적 범위 내 <span style="color: var(--color-success); font-weight: 600; font-size: 0.8rem;">✓ 빠른 로딩</span></span></div>
                <div class="checklist-item"><span class="checklist-label">관계 필드</span><span class="checklist-value">복잡도 정상 범위 <span style="color: var(--color-success); font-weight: 600; font-size: 0.8rem;">✓ 쿼리 효율</span></span></div>
                <div class="checklist-item"><span class="checklist-label">롤업/포뮬러</span><span class="checklist-value">성능 영향 미미 <span style="color: var(--color-success); font-weight: 600; font-size: 0.8rem;">✓ 계산 속도</span></span></div>
        `;
        if (metrics.avgPageSize !== undefined) {
            checklist += `<div class="checklist-item"><span class="checklist-label">평균 페이지 크기</span><span class="checklist-value">${(metrics.avgPageSize / 1024).toFixed(2)} KB <span style="color: var(--color-success); font-weight: 600; font-size: 0.8rem;">✓ 최적</span></span></div>
            <div class="checklist-item"><span class="checklist-label">최대 페이지 크기</span><span class="checklist-value">${(metrics.maxPageSize / 1024).toFixed(2)} KB <span style="color: #10b981; font-weight: 600; font-size: 0.8rem;">✓ 안전</span></span></div>`;
        }
        checklist += `</div></div>`;
        return checklist;
    },

    renderDeepReferenceChainsSection(deepChains, metrics) {
        if (!deepChains || deepChains.length === 0) return '';
        const safeMetrics = metrics || {
            totalChains: deepChains.length,
            maxDepth: Math.max(...deepChains.map(c => c.depth || 0), 0),
            totalAffectedRecords: deepChains.reduce((sum, c) => sum + (c.affectedRecords || 0), 0)
        };
        return `<div class="deep-chains-section">
            <div class="deep-chains-metrics">
                <div class="metrics-grid">
                    <div class="metric-card"><div class="metric-label">📊 최대 깊이</div><div class="metric-value">${safeMetrics.maxDepth || 0}</div><div class="metric-desc">가장 복잡한 경로</div></div>
                    <div class="metric-card"><div class="metric-label">🔗 발견된 경로</div><div class="metric-value">${deepChains.length}</div><div class="metric-desc">3단계 이상</div></div>
                    <div class="metric-card"><div class="metric-label">💾 영향 범위</div><div class="metric-value">${safeMetrics.totalAffectedRecords || 0}</div><div class="metric-desc">레코드 수</div></div>
                </div>
            </div>
            <div class="deep-chains-list">
                ${deepChains.map((chain, idx) => `<div class="deep-chain-item" data-chain-id="deep-chain-${idx}">
                    <div class="deep-chain-header" onclick="app.toggleDeepChainItem('deep-chain-${idx}')">
                        <div class="deep-chain-header-left">
                            <span class="deep-chain-toggle">▶</span>
                            <span class="deep-chain-depth-badge ${chain.depth >= 5 ? 'depth-critical' : chain.depth >= 4 ? 'depth-warning' : 'depth-normal'}">${chain.depth}단계</span>
                            <span class="deep-chain-path-text" title="${chain.path ? chain.path.map(node => `${node.db}.${node.field}`).join(' → ') : ''}">${chain.sourceDb}.${chain.sourceField}</span>
                        </div>
                        <div class="deep-chain-header-right">
                            <div class="deep-chain-info"><span style="font-size: 12px; color: #999;">영향</span><strong>${chain.affectedRecords}</strong>개</div>
                            <button class="action-btn" onclick="event.stopPropagation(); app.openNotionDatabase()" title="Notion으로 이동">↗</button>
                        </div>
                    </div>
                    <div class="deep-chain-content hidden">
                        ${this._renderDeepChainContent(chain)}
                    </div>
                </div>`).join('')}
            </div>
        </div>`;
    },

    _renderDeepChainContent(chain) {
        // 타임라인 데이터 생성
        let timelineHtml = `<div class="chain-timeline">`;
        
        // 시작점
        timelineHtml += `
            <div class="chain-timeline-item">
                <div class="chain-timeline-dot">1</div>
                <div class="chain-timeline-content">
                    <div class="chain-timeline-title">
                        <span>📌 시작점</span> ${Formatter.escapeHtml(chain.sourceDb)} 데이터베이스
                    </div>
                    <div class="chain-timeline-text">
                        <strong>${Formatter.escapeHtml(chain.sourceField)}</strong> 필드를 통한 참조 시작 (깊이: <strong>${chain.depth}</strong>단계)
                    </div>
                </div>
            </div>
        `;
        
        // 중간 경로 (있으면) - 첫 번째 항목은 시작점과 동일하므로 스킵
        if (chain.path && chain.path.length > 1) {
            chain.path.slice(1).forEach((node, idx) => {
                timelineHtml += `
                    <div class="chain-timeline-item">
                        <div class="chain-timeline-dot">${idx + 2}</div>
                        <div class="chain-timeline-content">
                            <div class="chain-timeline-title">
                                <span>🔗 참조</span> ${Formatter.escapeHtml(node.db)} 데이터베이스
                            </div>
                            <div class="chain-timeline-text">
                                <strong>${Formatter.escapeHtml(node.field)}</strong> 필드 → ${chain.affectedRecords ? `${chain.affectedRecords.toLocaleString()}개 레코드에서 실행` : '참조'}
                            </div>
                        </div>
                    </div>
                `;
            });
        }
        
        timelineHtml += `</div>`;
        
        // 최적화 제안 섹션 - 아코디언 스타일
        let optimizationHtml = `<div class="chain-section">
                <h5 class="chain-section-title">
                    <span class="section-title-count">${chain.optimizationTips ? chain.optimizationTips.length : 0}개</span>
                </h5>
                <div class="chain-section-content">
                    <div class="optimization-tips-container">
                        ${chain.optimizationTips && chain.optimizationTips.length > 0 ? chain.optimizationTips.map((tip, idx) => {
                            const priorityConfig = {
                                'high': { icon: '⚠️', label: '높음', class: 'priority-high' },
                                'medium': { icon: '💡', label: '중간', class: 'priority-medium' },
                                'low': { icon: 'ℹ️', label: '낮음', class: 'priority-low' }
                            };
                            const config = priorityConfig[tip.priority] || priorityConfig['low'];
                            const titleEsc = Formatter.escapeHtml(tip.title);
                            const descEsc = Formatter.escapeHtml(tip.description);
                            const actionEsc = Formatter.escapeHtml(tip.action);
                            return `
                                <div class="optimization-accordion-item ${config.class}" data-priority="${tip.priority || 'low'}">
                                    <div class="optimization-accordion-header" onclick="this.parentElement.classList.toggle('active')">
                                        <div class="optimization-header-content">
                                            <div class="optimization-priority-badge">${idx + 1}</div>
                                            <div class="optimization-header-text">
                                                <div class="optimization-header-title">${titleEsc}</div>
                                                <div class="optimization-header-desc"></div>
                                            </div>
                                        </div>
                                        <div class="optimization-toggle-icon">▼</div>
                                    </div>
                                    <div class="optimization-accordion-content">
                                        <div class="optimization-section">
                                            <div class="optimization-section-text">${descEsc}</div>
                                        </div>
                                        <div class="optimization-section">
                                            <div class="optimization-section-title">✓ 개선 방법</div>
                                            <div class="optimization-section-text">${actionEsc}</div>
                                        </div>
                                    </div>
                                </div>
                            `;
                        }).join('') : '<div class="empty-state"><p>최적화 제안이 없습니다.</p></div>'}
                    </div>
                </div>
            </div>`;

        return `<div class="chain-sections-wrapper">${timelineHtml}${optimizationHtml}</div>`;
    },

    _renderReferenceChainAsIndentedTree(sourceDb, sourceField, sourceType, treeRoot) {
        const safeSourceType = (sourceType || 'formula').toLowerCase().trim();
        const sourceTypeDisplay = Formatter.getPropertyTypeDisplay(safeSourceType);
        
        let html = `
            <div class="tree-node-item">
                <div class="tree-node-label">
                    <span class="tree-node-type ${safeSourceType}">${sourceTypeDisplay.icon} ${sourceTypeDisplay.label.toUpperCase()}</span>
                    <span class="tree-node-db">[${Formatter.escapeHtml(sourceDb)}]</span>
                    <span class="tree-node-field">${Formatter.escapeHtml(sourceField)}</span>
                </div>
        `;

        if (treeRoot.children && treeRoot.children.length > 0) {
            html += `<div class="tree-node-container">`;
            treeRoot.children.forEach((child, idx) => {
                html += this._renderIndentedTreeNode(child, 1, idx === treeRoot.children.length - 1, treeRoot.children.length);
            });
            html += `</div>`;
        }

        html += `</div>`;

        return html;
    },

    _renderIndentedTreeNode(node, depth, isLast, siblingCount) {
        const nodeType = (node.type || 'formula').toLowerCase().trim();
        const display = Formatter.getPropertyTypeDisplay(nodeType);
        const typeIcon = display.icon;
        const typeLabel = display.label.toUpperCase();
        const refDbName = node.referencedPropertyDb || 'Unknown';

        let html = `
            <div class="tree-node-item">
                <div class="tree-node-label">
                    <span class="tree-node-type ${nodeType}">${typeIcon} ${typeLabel}</span>
                    <span class="tree-node-db">[${Formatter.escapeHtml(node.db)}]</span>
                    <span class="tree-node-field">${Formatter.escapeHtml(node.fieldName)}</span>
                </div>
        `;

        if ((node.children && node.children.length > 0) || node.referencedProperty) {
            html += `<div class="tree-node-container">`;
            
            if (node.referencedProperty) {
                const refFieldType = (node.referencedPropertyType || nodeType).toLowerCase().trim();
                const refDisplay = Formatter.getPropertyTypeDisplay(refFieldType);
                const refTypeIcon = refDisplay.icon;
                const refTypeLabel = refDisplay.label.toUpperCase();
                
                html += `
                <div class="tree-node-item">
                    <div class="tree-node-label">
                        <span class="tree-node-type ${refFieldType}">${refTypeIcon} ${refTypeLabel}</span>
                        <span class="tree-node-db">[${Formatter.escapeHtml(refDbName)}]</span>
                        <span class="tree-node-field">${Formatter.escapeHtml(node.referencedProperty)}</span>
                `;
                if (node.aggregationFunction) {
                    html += `<span class="tree-node-type" style="background: rgba(180, 180, 180, 0.1); color: #999;">${Formatter.escapeHtml(node.aggregationFunction)}</span>`;
                }
                html += `</div></div>`;
            }
            
            if (node.children && node.children.length > 0) {
                node.children.forEach((child, idx) => {
                    const isLastChild = idx === node.children.length - 1;
                    html += this._renderIndentedTreeNode(child, depth + 1, isLastChild, node.children.length);
                });
            }
            
            html += `</div>`;
        }

        html += `</div>`;

        return html;
    },

    renderPerformanceAnalysis(performanceAnalysis) {
        const issues = performanceAnalysis.issues || {};
        const limits = performanceAnalysis.limits || {};
        const performanceScore = issues.score || 0;
        let html = `<div class="performance-section">`;
        if (issues.factors && issues.factors.length > 0) {
            html += `<div class="performance-factors-section"><h4>⚠️ 성능 영향 요인</h4><div class="factors-list">`;
            issues.factors.forEach(factor => {
                const factorColor = factor.severity === 'critical' ? Constants.priorityColors.high : Constants.priorityColors.medium;
                html += `<div class="factor-item" style="border-left: 4px solid ${factorColor};">
                    <div class="factor-header"><span class="factor-title">${Formatter.escapeHtml(factor.title)}</span></div>
                    <div class="factor-info">
                        <div class="info-row"><span class="info-label">현재:</span><span class="info-value">${factor.current}${factor.unit ? ' ' + factor.unit : ''}</span></div>
                        <div class="info-row"><span class="info-label">해결책:</span><span class="info-value">${Formatter.escapeHtml(factor.recommendation)}</span></div>
                    </div>
                </div>`;
            });
            html += `</div></div>`;
        } else {
            html += this.renderPerformanceSuccessChecklist(performanceAnalysis);
        }
        if (limits.metrics) {
            html += `<div class="size-constraints-section"><h4>💾 데이터 크기</h4><div class="constraint-metrics">
                <div class="metric-item"><span class="metric-label">평균 페이지</span><span class="metric-value">${(limits.metrics.avgPageSize / 1024).toFixed(2)} KB</span></div>
                <div class="metric-item"><span class="metric-label">최대 페이지</span><span class="metric-value">${(limits.metrics.maxPageSize / 1024).toFixed(2)} KB</span></div>
            </div></div>`;
        }
        html += `</div>`;
        return html;
    },

    renderAnalysis(analysis) {
        const qualityScore = analysis.qualityScore || 0;
        const scoreColor = qualityScore >= 80 ? Constants.colors.success : qualityScore >= 60 ? Constants.colors.warning : Constants.colors.error;
        const performanceAnalysis = analysis.performanceAnalysis || {};
        const performanceIssues = performanceAnalysis.issues || {};
        const performanceScore = performanceIssues.score || 0;

        let html = `<div class="analysis-container">
            <div class="analysis-pinned-section">
                <div class="stats-section">
                    <div class="quality-score-hero">
                        <div class="hero-left">
                            <div class="quality-badge" style="background: linear-gradient(135deg, ${scoreColor} 0%, ${scoreColor}dd 100%)">
                                <div class="badge-value">${qualityScore}</div>
                                <div class="badge-unit">/100</div>
                            </div>
                            <div class="quality-info">
                                <div class="quality-level" style="color: ${scoreColor}">${Formatter.getQualityLevel(qualityScore)}</div>
                                <div class="quality-desc">데이터 품질 평가</div>
                            </div>
                        </div>
                        <div class="hero-right">
                            <div class="mini-stat"><div class="mini-icon">📝</div><div class="mini-info"><div class="mini-label">총 항목</div><div class="mini-value">${analysis.totalRecords || 0}</div></div></div>
                            <div class="mini-stat"><div class="mini-icon">🏢</div><div class="mini-info"><div class="mini-label">총 컬럼</div><div class="mini-value">${analysis.totalColumns || 0}</div></div></div>
                            <div class="mini-stat"><div class="mini-icon">✓</div><div class="mini-info"><div class="mini-label">완성도</div><div class="mini-value">${analysis.overallCompleteness || 0}%</div></div></div>
                        </div>
                    </div>
                    <div class="quality-progress-compare">
                        <div class="progress-item">
                            <div class="progress-header"><span class="progress-label">데이터 완성도</span><span class="progress-value">${analysis.overallCompleteness || 0}%</span></div>
                            <div class="progress-bar"><div class="progress-fill" style="width: ${analysis.overallCompleteness || 0}%; background: linear-gradient(90deg, var(--color-warning), #fbbf24)"></div></div>
                        </div>
                        <div class="progress-item">
                            <div class="progress-header"><span class="progress-label">품질 점수</span><span class="progress-value">${qualityScore}%</span></div>
                            <div class="progress-bar"><div class="progress-fill" style="width: ${qualityScore}%; background: linear-gradient(90deg, ${scoreColor}, ${scoreColor}dd)"></div></div>
                        </div>
                        <div class="progress-item">
                            <div class="progress-header"><span class="progress-label">성능 점수</span><span class="progress-value">${performanceScore}%</span></div>
                            <div class="progress-bar"><div class="progress-fill" style="width: ${performanceScore}%; background: linear-gradient(90deg, ${performanceScore >= 80 ? Constants.colors.success : performanceScore >= 60 ? Constants.colors.warning : Constants.colors.error}, ${performanceScore >= 80 ? Constants.colors.success : performanceScore >= 60 ? Constants.colors.warning : Constants.colors.error}dd)"></div></div>
                        </div>
                    </div>
                </div>
            </div>`;

        if (performanceAnalysis.opportunities && performanceAnalysis.opportunities.length > 0) {
            html += `<div class="collapsible-section" data-section="opportunities">
                <div class="section-header" onclick="app.toggleSection(event)">
                    <div class="section-title-wrapper">
                        <span class="section-icon">💡</span>
                        <div class="section-title-group">
                            <h3 class="section-title">최적화 기회</h3>
                            <p class="section-subtitle">${performanceAnalysis.opportunities.length}개 발견</p>
                        </div>
                    </div>
                    <div class="section-header-actions"><div class="collapse-toggle">▼</div></div>
                </div>
                <div class="section-content">
                    <div class="opportunities-list">
                        ${this.groupOpportunitiesByTitle(performanceAnalysis.opportunities).map((group, idx) => `
                            <div class="opportunity-group" data-group-id="opp-group-${idx}">
                                <div class="opp-group-header" onclick="app.toggleOpportunityGroup('opp-group-${idx}')">
                                    <div class="opp-group-left">
                                        <span class="opp-group-toggle">▶</span>
                                        <div class="opp-group-info">
                                            <div class="opp-group-title">${Formatter.escapeHtml(group.title)}</div>
                                            <div class="opp-group-count">${group.count}개 발견</div>
                                        </div>
                                    </div>
                                </div>
                                <div class="opp-group-content">
                                    <div class="opp-group-details">
                                        <p><strong>문제:</strong> ${Formatter.escapeHtml(group.description)}</p>
                                        <p><strong>효과:</strong> ${Formatter.escapeHtml(group.benefit)}</p>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>`;
        }

        if (performanceAnalysis.issues) {
            html += `<div class="collapsible-section" data-section="performance">
                <div class="section-header" onclick="app.toggleSection(event)">
                    <div class="section-title-wrapper">
                        <span class="section-icon">⚡</span>
                        <div class="section-title-group">
                            <h3 class="section-title">성능 분석</h3>
                            <p class="section-subtitle">노션 공식 가이드 기반</p>
                        </div>
                    </div>
                    <div class="section-header-actions"><div class="collapse-toggle">▼</div></div>
                </div>
                <div class="section-content">${this.renderPerformanceAnalysis(performanceAnalysis)}</div>
            </div>`;
        }

        if (performanceAnalysis.deepReferenceChains && performanceAnalysis.deepReferenceChains.length > 0) {
            html += `<div class="collapsible-section" data-section="deep-chains">
                <div class="section-header" onclick="app.toggleSection(event)">
                    <div class="section-title-wrapper">
                        <span class="section-icon">🔗</span>
                        <div class="section-title-group">
                            <h3 class="section-title">깊은 참조 경로 분석</h3>
                            <p class="section-subtitle">${performanceAnalysis.deepReferenceChains.length}개 발견 - 3단계 이상의 참조 체인</p>
                        </div>
                    </div>
                    <div class="section-header-actions"><div class="collapse-toggle">▼</div></div>
                </div>
                <div class="section-content">
                    ${this.renderDeepReferenceChainsSection(performanceAnalysis.deepReferenceChains, performanceAnalysis.deepChainsMetrics)}
                </div>
            </div>`;
        }

        html += `<div class="collapsible-section" data-section="columns">
            <div class="section-header" onclick="app.toggleSection(event)">
                <div class="section-title-wrapper">
                    <span class="section-icon">📋</span>
                    <div class="section-title-group">
                        <h3 class="section-title">컬럼별 분석</h3>
                        <p class="section-subtitle">${Object.keys(analysis.columnStats || {}).length}개 컬럼</p>
                    </div>
                </div>
                <div class="section-header-actions"><div class="collapse-toggle">▼</div></div>
            </div>
            <div class="section-content">
                <div class="columns-container">
                    <div class="columns-left">${this.renderColumnAnalysisSummary(analysis.columnStats || {})}</div>
                    <div class="columns-right"><div class="columns-list">${this.renderColumnAnalysis(analysis.columnStats || {})}</div></div>
                </div>
            </div>
        </div></div>`;

        document.getElementById('analysisPlaceholder').innerHTML = html;
        this.initializeCollapsibleSections();
    },

    initializeCollapsibleSections() {
        document.querySelectorAll('[data-section]').forEach(section => {
            section.classList.add('collapsed');
            const toggle = section.querySelector('.collapse-toggle');
            if (toggle) toggle.classList.remove('expanded');
        });
        document.querySelectorAll('.opportunity-group').forEach(group => {
            group.classList.add('collapsed');
        });
    },

    toggleSection(event) {
        const section = event.currentTarget.closest('.collapsible-section');
        const toggle = section.querySelector('.collapse-toggle');
        const isExpanded = !section.classList.contains('collapsed');
        
        if (isExpanded) {
            section.classList.add('collapsed');
            toggle.classList.remove('expanded');
        } else {
            document.querySelectorAll('.collapsible-section').forEach(s => {
                if (s !== section) {
                    s.classList.add('collapsed');
                    s.querySelector('.collapse-toggle').classList.remove('expanded');
                }
            });
            section.classList.remove('collapsed');
            toggle.classList.add('expanded');
        }
    },

    toggleOpportunityGroup(groupId) {
        const group = document.querySelector(`[data-group-id="${groupId}"]`);
        if (group) group.classList.toggle('collapsed');
    },

    toggleDeepChainItem(chainId) {
        const item = document.querySelector(`[data-chain-id="${chainId}"]`);
        if (!item) return;
        const content = item.querySelector('.deep-chain-content');
        const toggle = item.querySelector('.deep-chain-toggle');
        
        // 다른 모든 아이템 닫기
        document.querySelectorAll('.deep-chain-item').forEach(el => {
            if (el !== item) {
                el.querySelector('.deep-chain-content').classList.add('hidden');
                el.querySelector('.deep-chain-toggle').classList.remove('expanded');
            }
        });
        
        // 현재 아이템 토글
        content.classList.toggle('hidden');
        toggle.classList.toggle('expanded');
    }
};

// ============ 9. 데이터베이스 관리 ============
const DatabaseManager = {
    async loadDatabases() {
        SkeletonRenderer.renderDatabases();
        try {
            const data = await ApiService.fetchDatabases();
            AppState.setDatabaseList(data.databases);
            UIRenderer.updateDatabasesDisplay();
        } catch (error) {
            console.error('데이터베이스 로드 실패:', error);
            NotificationService.showError('데이터베이스를 불러올 수 없습니다.');
        }
    },

    async selectDatabase(databaseId, databaseTitle) {
        AppState.setCurrentDatabase(databaseId);
        UIRenderer.showDatabase(databaseTitle);
        SkeletonRenderer.renderAnalysis();
        try {
            const dbData = await ApiService.fetchDatabase(databaseId);
            AppState.currentDatabaseProperties = dbData.properties;
            ApiService.prefetchData(databaseId);
            this.switchToAnalysisTab();
        } catch (error) {
            console.error('데이터베이스 상세 로드 실패:', error);
            NotificationService.showError('데이터베이스를 불러올 수 없습니다.');
        }
    },

    switchToAnalysisTab() {
        AppState.setCurrentTab('analysis');
        UIRenderer.switchTab('analysis');
        this.loadAnalysis();
    },

    async loadAnalysis() {
        SkeletonRenderer.renderAnalysis();
        try {
            const analysis = await ApiService.fetchAnalysis(AppState.currentDatabaseId);
            AnalysisRenderer.renderAnalysis(analysis);
        } catch (error) {
            console.error('분석 로드 실패:', error);
            NotificationService.showError('분석을 불러올 수 없습니다.');
        }
    },

    async refreshDatabases() {
        const btn = document.getElementById('refreshDatabasesBtn');
        btn.classList.add('loading', 'active');
        btn.disabled = true;

        try {
            const result = await ApiService.refreshDatabaseList();
            AppState.setDatabaseList(result.databases);
            UIRenderer.updateDatabasesDisplay();
            NotificationService.showSuccess('DB 목록이 새로 고쳐졌습니다.');
        } catch (error) {
            NotificationService.showError('DB 목록 새로고침에 실패했습니다.');
        } finally {
            btn.classList.remove('loading', 'active');
            btn.disabled = false;
        }
    },

    async refreshAnalysis() {
        const btn = document.getElementById('refreshBtn');
        btn.classList.add('loading', 'active');
        btn.disabled = true;

        try {
            const result = await ApiService.refreshAnalysis(AppState.currentDatabaseId);
            AnalysisRenderer.renderAnalysis(result.data);
            NotificationService.showSuccess('분석이 새로 고쳐졌습니다.');
        } catch (error) {
            NotificationService.showError('분석 새로고침에 실패했습니다.');
        } finally {
            btn.classList.remove('loading', 'active');
            btn.disabled = false;
        }
    },

    async refreshNetwork() {
        const btn = document.getElementById('refreshBtn');
        btn.classList.add('loading', 'active');
        btn.disabled = true;

        try {
            const result = await ApiService.refreshNetwork(AppState.currentDatabaseId);
            NotificationService.showSuccess('네트워크가 새로 고쳐졌습니다.');
        } catch (error) {
            NotificationService.showError('네트워크 새로고침에 실패했습니다.');
        } finally {
            btn.classList.remove('loading', 'active');
            btn.disabled = false;
        }
    }
};

// ============ 모달 관련 함수 ============
function showOptimizationModal(title, problem, solution, icon, priority) {
    const modal = document.getElementById('optimizationModal');
    const priorityLabels = { high: '🔴 높은 우선순위', medium: '🟠 중간 우선순위', low: '🔵 낮은 우선순위' };
    
    document.getElementById('optimizationModalTitle').textContent = title;
    document.getElementById('optimizationModalBody').innerHTML = `
        <div style="margin-bottom: 16px; text-align: center; color: #7f8c8d; font-size: 0.9rem;">
            ${priorityLabels[priority] || '낮은 우선순위'}
        </div>
        <div class="optimization-modal-section">
            <div class="optimization-modal-section-label">
                <span class="optimization-modal-section-icon">●</span>
                <span>문제점</span>
            </div>
            <div class="optimization-modal-section-text">${problem}</div>
        </div>
        <div class="optimization-modal-section">
            <div class="optimization-modal-section-label">
                <span class="optimization-modal-section-icon">✓</span>
                <span>개선 방법</span>
            </div>
            <div class="optimization-modal-section-text">${solution}</div>
        </div>
    `;
    
    modal.classList.add(priority, 'show');
}

function closeOptimizationModal() {
    const modal = document.getElementById('optimizationModal');
    if (modal.close) {
        modal.close();
    } else {
        modal.classList.remove('show', 'high', 'medium', 'low');
    }
}

// ESC 키로 모달 닫기
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeOptimizationModal();
    }
});

// ============ 10. 이벤트 핸들러 ============
const EventHandler = {
    onDatabaseSearch() {
        const searchInput = document.getElementById('databaseSearchInput').value.toLowerCase();
        AppState.filterDatabases(searchInput);
        UIRenderer.updateDatabasesDisplay();
    },

    nextDatabasePage() {
        AppState.nextDatabasePage();
        UIRenderer.updateDatabasesDisplay();
    },

    previousDatabasePage() {
        AppState.previousDatabasePage();
        UIRenderer.updateDatabasesDisplay();
    },

    switchView(viewName) {
        UIRenderer.switchView(viewName);
    },

    refreshCurrentTab() {
        if (AppState.currentTab === 'analysis') {
            DatabaseManager.refreshAnalysis();
        }
    },

    copyToClipboard(text, button) {
        UIRenderer.copyToClipboard(text, button);
    },

    copyPropertyList(properties, button) {
        const text = properties.join(', ');
        this.copyToClipboard(text, button);
    },

    openNotionDatabase() {
        UIRenderer.openNotionDatabase(AppState.currentDatabaseId);
    },

    copyReportToClipboard(reportType, button) {
        let reportText = '';
        if (reportType === 'warnings') {
            const warningElements = document.querySelectorAll('.warning-item .warning-header strong');
            reportText = '🔴 긴급 이슈 리포트:\n\n';
            warningElements.forEach((el, idx) => {
                reportText += `${idx + 1}. ${el.textContent}\n`;
            });
        }
        if (reportText) {
            navigator.clipboard.writeText(reportText);
            NotificationService.showSuccess('리포트가 복사되었습니다.');
        }
    },

    toggleSection(event) {
        AnalysisRenderer.toggleSection(event);
    },

    toggleOpportunityGroup(groupId) {
        AnalysisRenderer.toggleOpportunityGroup(groupId);
    },

    toggleDeepChainItem(chainId) {
        AnalysisRenderer.toggleDeepChainItem(chainId);
    }
};

// ============ 11. 메인 앱 (컨트롤러) ============
const app = {
    async init() {
        // 이벤트 위임 초기화
        EventDelegator.init();
        
        const params = new URLSearchParams(window.location.search);
        if (params.get('error')) {
            NotificationService.showError('로그인에 실패했습니다.');
            return;
        }
        if (params.get('success') === 'login') {
            NotificationService.showSuccess('로그인 성공!');
        }
        try {
            const userData = await ApiService.fetchUser();
            if (userData) {
                DOMUtils.hide(document.getElementById('loginView'));
                DOMUtils.show(document.getElementById('mainView'));
                document.getElementById('userName').textContent = userData.workspaceName || userData.ownerName || 'Notion 사용자';
                DatabaseManager.loadDatabases();
            } else {
                DOMUtils.show(document.getElementById('loginView'));
                DOMUtils.hide(document.getElementById('mainView'));
            }
        } catch (error) {
            console.error('사용자 정보 로드 실패:', error);
            DOMUtils.show(document.getElementById('loginView'));
            DOMUtils.hide(document.getElementById('mainView'));
        }
    },

    loadDatabases() { DatabaseManager.loadDatabases(); },
    selectDatabase(databaseId, databaseTitle) { DatabaseManager.selectDatabase(databaseId, databaseTitle); },
    onDatabaseSearch() { EventHandler.onDatabaseSearch(); },
    nextDatabasePage() { EventHandler.nextDatabasePage(); },
    previousDatabasePage() { EventHandler.previousDatabasePage(); },
    switchView(viewName) { EventHandler.switchView(viewName); },
    switchTab(tabName) { AppState.setCurrentTab(tabName); UIRenderer.switchTab(tabName); if (tabName === 'analysis') DatabaseManager.loadAnalysis(); },
    refreshCurrentTab() { EventHandler.refreshCurrentTab(); },
    copyToClipboard(text, button) { EventHandler.copyToClipboard(text, button); },
    copyPropertyList(properties, button) { EventHandler.copyPropertyList(properties, button); },
    openNotionDatabase() { EventHandler.openNotionDatabase(); },
    copyReportToClipboard(reportType, button) { EventHandler.copyReportToClipboard(reportType, button); },
    toggleSection(event) { EventHandler.toggleSection(event); },
    toggleOpportunityGroup(groupId) { EventHandler.toggleOpportunityGroup(groupId); },
    toggleDeepChainItem(chainId) { EventHandler.toggleDeepChainItem(chainId); },
    refreshDatabases() { DatabaseManager.refreshDatabases(); },
    refreshAnalysis() { DatabaseManager.refreshAnalysis(); },
    refreshNetwork() { DatabaseManager.refreshNetwork(); }
};

// ============초기화============
document.addEventListener('DOMContentLoaded', () => app.init());
