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
        }
    };
}

module.exports = {
    createApiClient
};
