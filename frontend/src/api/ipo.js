import client from "./client";

export const getAppliedCompaniesApi = () => client.get("/ipo/applied-companies");

export const getPublicShareListApi = () => client.get("/ipo/shares");

export const getOpenIposApi = () => client.get("/ipo/open");

export const applyIpoApi = (data) => client.post("/ipo/apply", {
  shareId:     String(data.shareId),
  companyName: data.companyName,
  kitta:       Number(data.kitta),
  accountIds:  data.accountIds,
});

export const checkResultApi = (shareId) =>
  client.get(`/ipo/result/${shareId}`);

export const checkResultGuestApi = (shareId, boid) =>
  client.get(`/ipo/result/${shareId}`, { params: { boid } });

export const getHistoryApi = () => client.get("/ipo/history");

export const getCdscSummaryApi = (accountId) =>
  client.get("/ipo/cdsc-summary", { params: { accountId } });