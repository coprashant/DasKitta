import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { addAccountApi, getDpListApi, getBankByDpApi } from "../../api/accounts";
import { useAccount } from "../../context/AccountContext";
import { InfoIcon, SpinnerIcon, EyeIcon, EyeOffIcon } from "../../components/Icons";
import toast from "react-hot-toast";

const EMPTY_FORM = {
    dpId: "",
    dpCode: "",
    username: "",
    password: "",
    bankId: "",
    crn: "",
    pin: "",
};

// field level checks used on blur, name matches the input's name
const validateField = (name, value) => {
    switch (name) {
        case "username":
            return value.trim() ? "" : "Meroshare username is required.";
        case "password":
            return value ? "" : "Meroshare password is required.";
        case "crn":
            return value.trim() ? "" : "CRN number is required.";
        case "pin":
            if (value && !/^\d+$/.test(value.trim())) {
                return "PIN should contain digits only.";
            }
            return "";
        default:
            return "";
    }
};

export default function AddAccountSettings() {
    const navigate = useNavigate();
    const { refreshAccounts } = useAccount();

    const [form, setForm] = useState(EMPTY_FORM);
    const [showPassword, setShowPassword] = useState(false);
    const [showPin, setShowPin] = useState(false);
    const [dpList, setDpList] = useState([]);
    const [loading, setLoading] = useState(false);
    const [dpLoading, setDpLoading] = useState(true);
    const [dpError, setDpError] = useState(false);
    const [bankLookupLoading, setBankLookupLoading] = useState(false);
    const [fieldErrors, setFieldErrors] = useState({});

    const bankAbortRef = useRef(null);

    useEffect(() => {
        let isMounted = true;

        const fetchDpList = async () => {
            setDpLoading(true);
            setDpError(false);

            try {
                const res = await getDpListApi();
                if (isMounted) {
                    setDpList(Array.isArray(res.data) ? res.data : []);
                }
            } catch {
                if (isMounted) {
                    setDpError(true);
                    toast.error("Failed to load DP list");
                }
            } finally {
                if (isMounted) {
                    setDpLoading(false);
                }
            }
        };

        fetchDpList();

        return () => {
            isMounted = false;
            if (bankAbortRef.current) {
                bankAbortRef.current.abort();
            }
        };
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm((f) => ({ ...f, [name]: value }));
        if (fieldErrors[name]) {
            setFieldErrors((fe) => ({ ...fe, [name]: "" }));
        }
    };

    const handleFieldBlur = (e) => {
        const { name, value } = e.target;
        const message = validateField(name, value);
        setFieldErrors((fe) => ({ ...fe, [name]: message }));
    };

    const handleDpChange = async (e) => {
        const selectedId = e.target.value;
        const dp = dpList.find((d) => String(d.id) === String(selectedId));

        if (bankAbortRef.current) {
            bankAbortRef.current.abort();
        }

        setForm((f) => ({
            ...f,
            dpId: selectedId,
            dpCode: dp ? dp.code : "",
            bankId: "",
        }));

        if (!selectedId) return;

        const controller = new AbortController();
        bankAbortRef.current = controller;
        setBankLookupLoading(true);

        try {
            const res = await getBankByDpApi(selectedId, {
                signal: controller.signal,
            });
            const bankId = res.data?.bankId;

            if (bankId) {
                setForm((f) => ({
                    ...f,
                    bankId: String(bankId),
                }));
            }
        } catch (err) {
            if (err.name !== "CanceledError" && err.name !== "AbortError") {
                toast.error("Could not resolve bank details for selected DP.");
            }
        } finally {
            if (bankAbortRef.current === controller) {
                setBankLookupLoading(false);
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const usernameError = validateField("username", form.username);
        const passwordError = validateField("password", form.password);
        const crnError = validateField("crn", form.crn);
        const pinError = validateField("pin", form.pin);

        if (usernameError || passwordError || crnError || pinError) {
            setFieldErrors({
                username: usernameError,
                password: passwordError,
                crn: crnError,
                pin: pinError,
            });
            toast.error(usernameError || passwordError || crnError || pinError);
            return;
        }

        if (!form.dpId) {
            toast.error("DP is required.");
            return;
        }

        if (!form.bankId) {
            toast.error(
                "Bank ID could not be resolved. Please reselect your DP."
            );
            return;
        }

        setLoading(true);

        try {
            await addAccountApi({
                ...form,
                username: form.username.trim(),
                crn: form.crn.trim(),
                pin: form.pin.trim(),
            });

            toast.success("Account added successfully");
            await refreshAccounts();
            navigate("/settings/accounts");
        } catch (err) {
            toast.error(
                err.response?.data?.message || "Failed to add account"
            );
        } finally {
            setLoading(false);
        }
    };

    const selectedDp = useMemo(
        () => dpList.find((d) => String(d.id) === String(form.dpId)),
        [dpList, form.dpId]
    );

    return (
        <div className="card stg-card anim-fade-up add-account-card">
            <div className="stg-card-head">
                <h2 className="stg-card-title">Add account</h2>
            </div>

            <form onSubmit={handleSubmit}>
                <div className="form-section">
                    <h3 className="form-section-title">Broker details</h3>

                    <div className="form-group">
                        <label className="form-label" htmlFor="dpIdSelect">
                            Depository Participant (DP)
                        </label>

                        {dpError ? (
                            <div className="dp-error-box">
                                <span>Could not load the DP list</span>
                                <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => window.location.reload()}
                                >
                                    Retry
                                </button>
                            </div>
                        ) : (
                            <div className="select-wrap">
                                <select
                                    id="dpIdSelect"
                                    className="input"
                                    name="dpId"
                                    value={form.dpId}
                                    onChange={handleDpChange}
                                    required
                                    disabled={dpLoading || loading}
                                >
                                    <option value="">
                                        {dpLoading
                                            ? "Loading DPs..."
                                            : "Select your bank or DP"}
                                    </option>

                                    {dpList.map((dp) => (
                                        <option key={dp.id} value={dp.id}>
                                            {dp.name} ({dp.code})
                                        </option>
                                    ))}
                                </select>
                                {bankLookupLoading && (
                                    <span className="select-loading-spinner">
                                        <SpinnerIcon />
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div className="form-section">
                    <h3 className="form-section-title">Login credentials</h3>

                    <div className="form-group">
                        <label className="form-label" htmlFor="usernameInput">
                            Meroshare username
                        </label>

                        <input
                            id="usernameInput"
                            className={`input${fieldErrors.username ? " input-invalid" : ""}`}
                            type="text"
                            name="username"
                            value={form.username}
                            onChange={handleChange}
                            onBlur={handleFieldBlur}
                            placeholder="Your Meroshare username"
                            required
                            autoComplete="username"
                            disabled={loading}
                        />
                        {fieldErrors.username && (
                            <span className="field-error">{fieldErrors.username}</span>
                        )}
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="passwordInput">
                            Meroshare password
                        </label>

                        <div className="input-with-icon">
                            <input
                                id="passwordInput"
                                className={`input${fieldErrors.password ? " input-invalid" : ""}`}
                                type={showPassword ? "text" : "password"}
                                name="password"
                                value={form.password}
                                onChange={handleChange}
                                onBlur={handleFieldBlur}
                                placeholder="Your Meroshare password"
                                required
                                autoComplete="current-password"
                                disabled={loading}
                            />

                            <button
                                type="button"
                                className="input-icon-btn"
                                onClick={() => setShowPassword((v) => !v)}
                                aria-label={
                                    showPassword
                                        ? "Hide password"
                                        : "Show password"
                                }
                            >
                                {showPassword ? (
                                    <EyeOffIcon />
                                ) : (
                                    <EyeIcon />
                                )}
                            </button>
                        </div>
                        {fieldErrors.password && (
                            <span className="field-error">{fieldErrors.password}</span>
                        )}
                    </div>
                </div>

                <div className="form-section">
                    <h3 className="form-section-title">IPO details</h3>

                    <div className="form-group">
                        <label className="form-label" htmlFor="crnInput">
                            CRN number
                        </label>

                        <input
                            id="crnInput"
                            className={`input${fieldErrors.crn ? " input-invalid" : ""}`}
                            type="text"
                            name="crn"
                            value={form.crn}
                            onChange={handleChange}
                            onBlur={handleFieldBlur}
                            placeholder="Bank CRN (required for IPO apply)"
                            required
                            disabled={loading}
                        />
                        {fieldErrors.crn && (
                            <span className="field-error">{fieldErrors.crn}</span>
                        )}
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="pinInput">
                            Transaction PIN
                        </label>

                        <div className="input-with-icon">
                            <input
                                id="pinInput"
                                className={`input${fieldErrors.pin ? " input-invalid" : ""}`}
                                type={showPin ? "text" : "password"}
                                name="pin"
                                value={form.pin}
                                onChange={handleChange}
                                onBlur={handleFieldBlur}
                                placeholder="Meroshare transaction PIN (MPIN)"
                                inputMode="numeric"
                                autoComplete="off"
                                disabled={loading}
                            />

                            <button
                                type="button"
                                className="input-icon-btn"
                                onClick={() => setShowPin((v) => !v)}
                                aria-label={
                                    showPin ? "Hide PIN" : "Show PIN"
                                }
                            >
                                {showPin ? <EyeOffIcon /> : <EyeIcon />}
                            </button>
                        </div>
                        {fieldErrors.pin && (
                            <span className="field-error">{fieldErrors.pin}</span>
                        )}
                    </div>
                </div>

                <div className="form-note">
                    <InfoIcon />
                    <span>
                        Your password and PIN are AES encrypted before saving.
                        <br />
                        Bank details are resolved automatically from your selected
                        DP.
                    </span>
                </div>

                <div className="form-actions">
                    <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => navigate("/settings/accounts")}
                        disabled={loading}
                    >
                        Cancel
                    </button>

                    <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={
                            loading ||
                            dpLoading ||
                            bankLookupLoading ||
                            dpError
                        }
                    >
                        {loading ? (
                            <>
                                <SpinnerIcon /> Verifying and adding
                            </>
                        ) : (
                            "Add account"
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}