// 사용자 인증 상태 확인 미들웨어
const checkAuth = (req, res, next) => {
    if (req.session.user) {
        next();
    } else {
        res.status(401).json({ error: '로그인이 필요합니다.' });
    }
};

// 세션 정보 가져오기
const getSessionInfo = (req) => {
    return req.session.user || null;
};

module.exports = {
    checkAuth,
    getSessionInfo
};
