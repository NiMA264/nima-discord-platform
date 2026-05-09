const DISCORD_API_BASE = 'https://discord.com/api/v10';

async function exchangeCodeForToken({ clientId, clientSecret, redirectUri, code }) {
    const body = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri
    });

    const response = await fetch(`${DISCORD_API_BASE}/oauth2/token`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Discord token exchange failed: ${response.status} ${text}`);
    }

    return response.json();
}

async function fetchCurrentUser(accessToken) {
    const response = await fetch(`${DISCORD_API_BASE}/users/@me`, {
        headers: { authorization: `Bearer ${accessToken}` }
    });

    if (!response.ok) {
        throw new Error(`Discord user fetch failed: ${response.status}`);
    }

    return response.json();
}

async function fetchUserGuilds(accessToken) {
    const response = await fetch(`${DISCORD_API_BASE}/users/@me/guilds`, {
        headers: { authorization: `Bearer ${accessToken}` }
    });

    if (!response.ok) {
        throw new Error(`Discord guild fetch failed: ${response.status}`);
    }

    return response.json();
}

function buildAuthorizeUrl({ clientId, redirectUri, state }) {
    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'identify guilds',
        prompt: 'none',
        state
    });

    return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

module.exports = {
    exchangeCodeForToken,
    fetchCurrentUser,
    fetchUserGuilds,
    buildAuthorizeUrl
};
