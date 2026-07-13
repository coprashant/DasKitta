import client from "./client";

export const registerApi = (data) => client.post("/auth/register", data);
export const loginApi = (data) => client.post("/auth/login", data);
export const verifyOtpApi = (email, code) =>
    client.post("/auth/verify-otp", { email, code });
export const resendOtpApi = (email) =>
    client.post("/auth/resend-otp", { email });

export const updatePasswordApi = (oldPassword, newPassword) =>
    client.patch("/auth/password", { oldPassword, newPassword });

export const updateUsernameApi = (newUsername) =>
    client.patch("/auth/username", { newUsername });

export const requestEmailChangeApi = (newEmail) =>
    client.post("/auth/email/request-change", { newEmail });

export const confirmEmailChangeApi = (newEmail, code) =>
    client.post("/auth/email/confirm-change", { newEmail, code });

export const getUserDetailsApi = () => client.get("/auth/me");