import client from "./client";

export const getDpListApi = () => client.get("/accounts/dp-list");

export const getBankByDpApi = (dpId) => client.get(`/accounts/bank-by-dp/${dpId}`);

export const getAccountsApi = () => client.get("/accounts");

export const addAccountApi = (data) => client.post("/accounts", {
  dpId:     Number(data.dpId),
  dpCode:   data.dpCode,
  username: data.username,
  password: data.password,
  bankId:   Number(data.bankId),
  crn:      data.crn ?? "",
  pin:      data.pin ?? "",
});

export const deleteAccountApi = (id) => client.delete(`/accounts/${id}`);

export const getPortfolioApi = (accountId) => client.get(`/accounts/${accountId}/portfolio`);