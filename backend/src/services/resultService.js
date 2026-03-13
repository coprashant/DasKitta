const axios = require('axios');

const checkIpoResult = async (boid, companyId) => {
    try {
        const response = await axios.post('https://iporesult.cdsc.com.np/api/check-result', {
            boid: boid,
            companyShareId: companyId
        });
        // The API returns { success: true/false, message: "..." }
        return { boid, status: response.data.message };
    } catch (error) {
        return { boid, status: "Error checking result" };
    }
};

module.exports = { checkIpoResult };