import client from "./client";

export const getDpListApi = () => client.get("/accounts/dp-list");

export const getAccountsApi = () => client.get("/accounts");

export const addAccountApi = (data) => client.post("/accounts", data);

export const deleteAccountApi = (id) => client.delete(`/accounts/${id}`);