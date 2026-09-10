// access token lives in memory only, never in local storage
// this way a future xss bug cant just read the token out of storage
let accessToken = null;

export const getToken = () => accessToken;

export const setToken = (token) => {
    accessToken = token;
};

export const clearToken = () => {
    accessToken = null;
};