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

        async getProjects(accessToken, guildId) {
            const response = await fetch(`${baseUrl}/api/projects?guildId=${encodeURIComponent(guildId || '')}`, {
                headers: { authorization: `Bearer ${accessToken}` }
            });

            if (!response.ok) {
                throw new Error(`Project API request failed: ${response.status}`);
            }

            return response.json();
        },

        async getProjectDetail(accessToken, projectId) {
            const response = await fetch(`${baseUrl}/api/projects/${encodeURIComponent(projectId)}`, {
                headers: { authorization: `Bearer ${accessToken}` }
            });

            if (!response.ok) {
                throw new Error(`Project detail API request failed: ${response.status}`);
            }

            return response.json();
        }
    };
}

module.exports = {
    createApiClient
};
