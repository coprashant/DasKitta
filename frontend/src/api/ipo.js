import client from "./client";

export const getOpenIposApi = () => client.get("/ipo/open");

export const getClosedIposApi = () => client.get("/ipo/closed");

export const applyIpoApi = (data) => client.post("/ipo/apply", data);

export const checkResultApi = (shareId) => client.get(`/ipo/result/${shareId}`);

export const getHistoryApi = () => client.get("/ipo/history");