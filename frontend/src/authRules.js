// rules for new usernames and passwords only
// login never uses these so old accounts keep working

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;
const USERNAME_RE = /^[a-zA-Z0-9._]+$/;

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 64;
// bcrypt ignores everything after 72 bytes
const PASSWORD_MAX_BYTES = 72;

export const checkUsername = (value) => {
    const trimmed = (value || "").trim();
    if (!trimmed) return "";
    if (/\s/.test(trimmed)) return "Username can't contain spaces.";
    if (trimmed.length < USERNAME_MIN) return `Must be at least ${USERNAME_MIN} characters.`;
    if (trimmed.length > USERNAME_MAX) return `Must be at most ${USERNAME_MAX} characters.`;
    if (!USERNAME_RE.test(trimmed)) return `Only letters, numbers, "." and "_" allowed.`;
    return "";
};

export const checkNewPassword = (value) => {
    if (!value) return "";
    if (value.length < PASSWORD_MIN) return `Must be at least ${PASSWORD_MIN} characters.`;
    if (value.length > PASSWORD_MAX) return `Must be at most ${PASSWORD_MAX} characters.`;
    if (new TextEncoder().encode(value).length > PASSWORD_MAX_BYTES) return "Password is too long.";
    if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) return "Use both letters and numbers.";
    return "";
};

export const getPasswordStrength = (pw) => {
    const labels = ["", "Weak", "Fair", "Good", "Strong"];
    if (pw.length < PASSWORD_MIN) {
        const left = PASSWORD_MIN - pw.length;
        return { score: 1, label: "Too short", tip: `${left} more character${left === 1 ? "" : "s"}` };
    }
    const hasLetter = /[A-Za-z]/.test(pw);
    const hasDigit = /\d/.test(pw);
    const mixed = /[a-z]/.test(pw) && /[A-Z]/.test(pw);
    const symbol = /[^A-Za-z0-9]/.test(pw);

    const score = Math.min(
        4,
        1 + (hasLetter && hasDigit ? 1 : 0) + (mixed || symbol ? 1 : 0) + (pw.length >= 12 ? 1 : 0)
    );
    let tip = "";
    if (!hasLetter || !hasDigit) tip = "add letters and numbers";
    else if (score < 4) tip = "try uppercase, symbols or more length";
    return { score, label: labels[score], tip };
};