import client from "./client";

export const registerApi = (data) => client.post("/auth/register", data);
export const loginApi = (data) => client.post("/auth/login", data);

export const verifyOtpApi = (email, code) =>
    client.post("/auth/verify-otp", { email, code });

export const resendOtpApi = (email) =>
    client.post("/auth/resend-otp", { email });