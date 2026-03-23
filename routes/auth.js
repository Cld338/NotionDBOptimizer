const express = require('express');
const axios = require('axios');
const router = express.Router();

const NOTION_AUTH_URL = 'https://api.notion.com/v1/oauth/authorize';
const NOTION_TOKEN_URL = 'https://api.notion.com/v1/oauth/token';

// 1. OAuth 인증 시작
router.get('/notion/login', (req, res) => {
    const state = Math.random().toString(36).substring(2, 15);
    req.session.oauthState = state;

    const params = new URLSearchParams({
        client_id: process.env.NOTION_CLIENT_ID,
        redirect_uri: process.env.REDIRECT_URI,
        response_type: 'code',
        owner: 'user',
        state: state
    });

    res.redirect(`${NOTION_AUTH_URL}?${params.toString()}`);
});

// 2. OAuth 콜백 처리
router.get('/notion/callback', async (req, res) => {
    try {
        const { code, state } = req.query;

        // State 검증
        if (state !== req.session.oauthState) {
            return res.status(400).json({ error: 'State 불일치' });
        }

        // 액세스 토큰 요청
        const tokenResponse = await axios.post(NOTION_TOKEN_URL, {
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: process.env.REDIRECT_URI
        }, {
            auth: {
                username: process.env.NOTION_CLIENT_ID,
                password: process.env.NOTION_CLIENT_SECRET
            }
        });

        const { access_token, token_type, workspace_id, workspace_name, workspace_icon, owner } = tokenResponse.data;

        // 세션에 사용자 정보 저장
        req.session.user = {
            accessToken: access_token,
            tokenType: token_type,
            workspaceId: workspace_id,
            workspaceName: workspace_name,
            workspaceIcon: workspace_icon,
            ownerType: owner.type,
            ownerId: owner.user?.id,
            ownerName: owner.user?.name
        };

        req.session.save((err) => {
            if (err) {
                console.error('세션 저장 에러:', err);
                return res.redirect('/?error=session_save_failed');
            }
            res.redirect('/?success=login');
        });

    } catch (error) {
        console.error('OAuth 콜백 에러:', error.response?.data || error.message);
        res.redirect('/?error=oauth_failed');
    }
});

// 3. 사용자 정보 확인
router.get('/user', (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: '로그인이 필요합니다.' });
    }

    res.json({
        workspaceName: req.session.user.workspaceName,
        ownerId: req.session.user.ownerId,
        ownerName: req.session.user.ownerName
    });
});

module.exports = router;
