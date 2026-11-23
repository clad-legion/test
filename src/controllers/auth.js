const axios = require('axios');

const TOKEN_URLS = {
    sandbox: 'https://sandbox.safaricom.co.ke/oauth/v1/generate',
    production: 'https://api.safaricom.co.ke/oauth/v1/generate'
};

async function getAccessToken() {
    const consumerKey = process.env.MPESA_CONSUMER_KEY;
    const consumerSecret = process.env.MPESA_CONSUMER_SECRET;
    const environment = (process.env.MPESA_ENVIRONMENT || process.env.MPESA_ENV || 'sandbox').toLowerCase();
    const tokenUrl = TOKEN_URLS[environment];

    if (!consumerKey || !consumerSecret) {
        throw new Error('MPESA_CONSUMER_KEY and MPESA_CONSUMER_SECRET must be configured.');
    }

    if (!tokenUrl) {
        throw new Error('MPESA_ENVIRONMENT must be either "sandbox" or "production".');
    }

    let response;
    try {
        response = await axios.get(tokenUrl, {
            params: { grant_type: 'client_credentials' },
            auth: {
                username: consumerKey,
                password: consumerSecret
            },
            headers: { Accept: 'application/json' },
            timeout: 10000
        });
    } catch (error) {
        if (axios.isAxiosError(error)) {
            const status = error.response ? ' (HTTP ' + error.response.status + ')' : '';
            throw new Error('Safaricom OAuth request failed' + status + '.');
        }
        throw error;
    }

    if (!response.data || typeof response.data.access_token !== 'string') {
        throw new Error('Safaricom OAuth response did not contain an access token.');
    }

    return response.data.access_token;
}

module.exports = { getAccessToken };
