import React, { useRef, useEffect } from "react";
import "./OtpInput.css";

const OTP_LENGTH = 6;

const OtpInput = ({ value = "", onChange, disabled = false }) => {
    const inputRefs = useRef([]);
    const otpArray = Array.from({ length: OTP_LENGTH }, (_, i) => value[i] || "");

    useEffect(() => {
        const firstEmptyIndex = otpArray.findIndex((digit) => !digit);
        const targetIndex = firstEmptyIndex !== -1 ? firstEmptyIndex : 0;
        inputRefs.current[targetIndex]?.focus();
    }, []);

    const handleChange = (e, index) => {
        const val = e.target.value.replace(/\D/g, "");
        if (!val) return;

        const lastChar = val.slice(-1);
        const newOtp = [...otpArray];
        newOtp[index] = lastChar;
        const combined = newOtp.join("");

        onChange(combined);

        if (index < OTP_LENGTH - 1) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handleKeyDown = (e, index) => {
        if (e.key === "Backspace") {
            e.preventDefault();
            const newOtp = [...otpArray];

            if (newOtp[index]) {
                newOtp[index] = "";
                onChange(newOtp.join(""));
            } else if (index > 0) {
                newOtp[index - 1] = "";
                onChange(newOtp.join(""));
                inputRefs.current[index - 1]?.focus();
            }
        } else if (e.key === "ArrowLeft" && index > 0) {
            e.preventDefault();
            inputRefs.current[index - 1]?.focus();
        } else if (e.key === "ArrowRight" && index < OTP_LENGTH - 1) {
            e.preventDefault();
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handlePaste = (e) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
        if (!pastedData) return;

        onChange(pastedData);
        const nextIndex = Math.min(pastedData.length, OTP_LENGTH - 1);
        inputRefs.current[nextIndex]?.focus();
    };

    return (
        <div className="otp-container" onPaste={handlePaste}>
            {otpArray.map((digit, index) => (
                <input
                    key={index}
                    ref={(el) => (inputRefs.current[index] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleChange(e, index)}
                    onKeyDown={(e) => handleKeyDown(e, index)}
                    disabled={disabled}
                    className={`otp-slot ${digit ? "otp-slot--filled" : ""}`}
                    aria-label={`Digit ${index + 1} of ${OTP_LENGTH}`}
                    autoComplete="one-time-code"
                />
            ))}
        </div>
    );
};

export default OtpInput;