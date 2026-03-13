import client from "./client";

export const registerApi = (data) => client.post("/auth/register", data);

export const loginApi = (data) => client.post("/auth/login", data);