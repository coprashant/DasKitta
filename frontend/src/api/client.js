import axios from 'axios';

const API = axios.create({
    baseURL: 'http://localhost:5000/api', // Point to your Node.js server
});

export const fetchAccounts = () => API.get('/accounts');
export const applyIPO = (payload) => API.post('/ipo/apply-ipo', payload);
export const checkResults = (payload) => API.post('/ipo/check-results', payload);

export default API;