import client from "./client";

// All CDSC calls go through our backend to avoid CORS blocks
export const getPublicShareListApi = () => client.get("/ipo/shares");

export const checkResultGuestApi = (shareId, boid) =>
  client.get(`/ipo/result/${shareId}`, { params: { boid } });

export const getIpoListsApi = () => client.get("/ipo/lists");

export const getOpenIposApi = () => client.get("/ipo/open");

export const applyIpoApi = (data) => client.post("/ipo/apply", data);

export const checkResultApi = (shareId) => client.get(`/ipo/result/${shareId}`);

export const getHistoryApi = () => client.get("/ipo/history");