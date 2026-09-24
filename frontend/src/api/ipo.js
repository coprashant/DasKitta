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

export const applyIpoStreamApi = async (data, onEvent, onDone, onError, signal) => {
  const base = client.defaults.baseURL;
  const payload = {
    shareId: String(data.shareId),
    companyName: data.companyName,
    kitta: Number(data.kitta),
    accountIds: data.accountIds,
  };

  const openStream = (token) => fetch(`${base}/ipo/apply/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
    signal,
  });

  try {
    let res = await openStream(getToken());

    if (res.status === 401) {
      const refreshed = await attemptRefresh().catch(() => null);
      res = await openStream(refreshed?.token ?? getToken());
    }

    if (!res.ok || !res.body) {
      throw new Error("Could not start IPO apply stream");
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;

      buffer += decoder.decode(chunk.value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() || "";

      for (const rawEvent of events) {
        const lines = rawEvent.split("\n");
        let eventName = "message";
        const dataLines = [];

        for (const line of lines) {
          if (line.startsWith("event:")) {
            eventName = line.slice(6).trim();
          }
          if (line.startsWith("data:")) {
            dataLines.push(line.slice(5).trim());
          }
        }

        if (!dataLines.length) continue;

        try {
          const dataObj = JSON.parse(dataLines.join("\n"));
          onEvent?.({ event: eventName, data: dataObj });
        } catch {
        }
      }
    }

    onDone?.();
  } catch (err) {
    if (err?.name === "AbortError") return;
    onError?.(err);
  }
};

export const startApplyJobApi = (data) => client.post("/ipo/apply/jobs", {
  shareId: String(data.shareId),
  companyName: data.companyName,
  kitta: Number(data.kitta),
  accountIds: data.accountIds,
});

export const getApplyJobSnapshotApi = (jobId) =>
    client.get(`/ipo/apply/jobs/${jobId}`);

export const retryFailedApplyJobApi = (jobId) =>
    client.post(`/ipo/apply/jobs/${jobId}/retry-failed`);

export const cancelApplyJobApi = (jobId) =>
    client.post(`/ipo/apply/jobs/${jobId}/cancel`);

export const streamApplyJobApi = async (
    jobId,
    fromSequence,
    onEvent,
    onDone,
    onError,
    signal
) => {
  const base = client.defaults.baseURL;

  const openStream = (token) => fetch(
      `${base}/ipo/apply/jobs/${jobId}/stream?fromSequence=${Number(fromSequence || 0)}`,
      {
        method: "GET",
        headers: {
          Accept: "text/event-stream",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        signal,
      }
  );

  try {
    let res = await openStream(getToken());

    if (res.status === 401) {
      const refreshed = await attemptRefresh().catch(() => null);
      res = await openStream(refreshed?.token ?? getToken());
    }

    if (!res.ok || !res.body) {
      throw new Error("Could not start IPO apply job stream");
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;

      buffer += decoder.decode(chunk.value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() || "";

      for (const rawEvent of events) {
        const lines = rawEvent.split("\n");
        let eventName = "message";
        const dataLines = [];
        let eventId = null;

        for (const line of lines) {
          if (line.startsWith("event:")) {
            eventName = line.slice(6).trim();
          }
          if (line.startsWith("id:")) {
            eventId = line.slice(3).trim();
          }
          if (line.startsWith("data:")) {
            dataLines.push(line.slice(5).trim());
          }
        }

        if (!dataLines.length) continue;

        try {
          const dataObj = JSON.parse(dataLines.join("\n"));
          onEvent?.({ event: eventName, id: eventId, data: dataObj });
        } catch {
        }
      }
    }

    onDone?.();
  } catch (err) {
    if (err?.name === "AbortError") return;
    onError?.(err);
  }
};
export const getHistoryApi = () => client.get("/ipo/history");
export const getCdscSummaryApi = (accountId) =>
    client.get("/ipo/cdsc-summary", { params: { accountId } });

// streams one result at a time using server sent events
// onResult fires per account onDone fires at end onError fires on failure
export const checkResultStreamApi = async (shareId, onResult, onDone, onError, signal) => {
  const base = client.defaults.baseURL;

  const openStream = (token) => fetch(`${base}/ipo/result/${shareId}/stream`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    signal,
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
    if (err?.name === "AbortError") return;
    onError?.(err);
  }
};