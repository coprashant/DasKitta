import client from "./client";
export const getDpListApi = () => client.get("/accounts/dp-list");
export const getBankByDpApi = (dpId) => client.get(`/accounts/bank-by-dp/${dpId}`);
export const getAccountsApi = () => client.get("/accounts");
export const addAccountApi = (data) => client.post("/accounts", {
  dpId:     Number(data.dpId),
  dpCode:   data.dpCode,
  username: data.username,
  password: data.password,
  bankId:   data.bankId ?? null,
  crn:      data.crn ?? "",
  pin:      data.pin ?? "",
});
export const updateAccountApi = (id, data) => client.patch(`/accounts/${id}`, {
  password: data.password ?? "",
  pin:      data.pin ?? "",
});
export const deleteAccountApi = (id) => client.delete(`/accounts/${id}`);
export const getPortfolioApi = (accountId) => client.get(`/accounts/${accountId}/portfolio`);