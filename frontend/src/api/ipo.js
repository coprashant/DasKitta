import client, { attemptRefresh } from "./client";
import { getToken } from "./tokenStore";

export const getAppliedCompaniesApi = () => client.get("/ipo/applied-companies");
export const getPublicShareListApi = () => client.get("/ipo/shares");
export const getOpenIposApi = () => client.get("/ipo/open");
export const applyIpoApi = (data) => client.post("/ipo/apply", {
  shareId:     String(data.shareId),
  companyName: data.companyName,
  kitta:       Number(data.kitta),
  accountIds:  data.accountIds,
});
export const getHistoryApi = () => client.get("/ipo/history");
export const getCdscSummaryApi = (accountId) =>
    client.get("/ipo/cdsc-summary", { params: { accountId } });

// streams one result at a time using server sent events
// onResult fires per account onDone fires at end onError fires on failure
export const checkResultStreamApi = async (shareId, onResult, onDone, onError) => {
  const base = client.defaults.baseURL;

  const openStream = (token) => fetch(`${base}/ipo/result/${shareId}/stream`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  try {
    let res = await openStream(getToken());

    // token expired mid session, refresh once through the shared flow then retry
    if (res.status === 401) {
      const data = await attemptRefresh().catch(() => null);
      res = await openStream(data?.token ?? getToken());
    }

    if (!res.ok || !res.body) {
      throw new Error("Could not start result check");
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;

      buffer += decoder.decode(chunk.value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop();

      for (const evt of events) {
        const dataLine = evt.split("\n").find((line) => line.startsWith("data:"));
        if (!dataLine) continue;
        try {
          onResult(JSON.parse(dataLine.slice(5).trim()));
        } catch {
          // skip malformed chunk
        }
      }
    }

    onDone?.();
  } catch (err) {
    onError?.(err);
  }
};