function createApiClient({ baseUrl }) {
    return {
        async getGuilds(accessToken) {
            const response = await fetch(`${baseUrl}/api/guilds`, {
                headers: { authorization: `Bearer ${accessToken}` }
            });

            if (!response.ok) {
                throw new Error(`Guild API request failed: ${response.status}`);
            }

            return response.json();
        },

        async getProjects(accessToken, guildId, workspaceId = '') {
            const workspaceQuery = workspaceId ? `&workspaceId=${encodeURIComponent(workspaceId)}` : '';
            const response = await fetch(`${baseUrl}/api/projects?guildId=${encodeURIComponent(guildId || '')}${workspaceQuery}`, {
                headers: { authorization: `Bearer ${accessToken}` }
            });

            if (!response.ok) {
                throw new Error(`Project API request failed: ${response.status}`);
            }

            return response.json();
        },

        async getProjectDetail(accessToken, projectId, workspaceId = '') {
            const workspaceQuery = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : '';
            const response = await fetch(`${baseUrl}/api/projects/${encodeURIComponent(projectId)}${workspaceQuery}`, {
                headers: { authorization: `Bearer ${accessToken}` }
            });

            if (!response.ok) {
                throw new Error(`Project detail API request failed: ${response.status}`);
            }

            return response.json();
        },

        async getAnalyticsOverview(accessToken, guildId, workspaceId = '') {
            const workspaceQuery = workspaceId ? `&workspaceId=${encodeURIComponent(workspaceId)}` : '';
            const response = await fetch(`${baseUrl}/api/analytics/overview?guildId=${encodeURIComponent(guildId || '')}${workspaceQuery}`, {
                headers: { authorization: `Bearer ${accessToken}` }
            });

            if (!response.ok) {
                throw new Error(`Analytics API request failed: ${response.status}`);
            }

            return response.json();
        },

        async getRoleBindings(accessToken, guildId) {
            const response = await fetch(`${baseUrl}/api/guilds/${encodeURIComponent(guildId)}/role-bindings`, {
                headers: { authorization: `Bearer ${accessToken}` }
            });

            if (!response.ok) {
                throw new Error(`Role binding API request failed: ${response.status}`);
            }

            return response.json();
        },

        async updateRoleBinding(accessToken, guildId, payload) {
            const response = await fetch(`${baseUrl}/api/guilds/${encodeURIComponent(guildId)}/role-bindings`, {
                method: 'POST',
                headers: {
                    authorization: `Bearer ${accessToken}`,
                    'content-type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const body = await response.json().catch(() => ({}));
                throw new Error(body.error || `Role binding update failed: ${response.status}`);
            }

            return response.json();
        },

        async updateProjectMemberRole(accessToken, projectId, payload) {
            const response = await fetch(`${baseUrl}/api/projects/${encodeURIComponent(projectId)}/members`, {
                method: 'POST',
                headers: {
                    authorization: `Bearer ${accessToken}`,
                    'content-type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const body = await response.json().catch(() => ({}));
                throw new Error(body.error || `Project member update failed: ${response.status}`);
            }

            return response.json();
        }
    };
}

module.exports = {
    createApiClient
};
