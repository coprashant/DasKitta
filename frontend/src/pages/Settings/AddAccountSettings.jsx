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
    pin: ""
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

    const bankLookupId = useRef(0);

    useEffect(() => {
        fetchDpList();
    }, []);

    const fetchDpList = async () => {
        setDpLoading(true);
        setDpError(false);

        try {
            const res = await getDpListApi();
            setDpList(Array.isArray(res.data) ? res.data : []);
        } catch {
            setDpError(true);
            toast.error("Failed to load DP list");
        } finally {
            setDpLoading(false);
        }
    };

    const handleChange = (e) =>
        setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

    const handleDpChange = async (e) => {
        const selectedId = e.target.value;
        const dp = dpList.find((d) => String(d.id) === String(selectedId));

        setForm((f) => ({
            ...f,
            dpId: selectedId,
            dpCode: dp ? dp.code : "",
            bankId: ""
        }));

        if (!selectedId) return;

        const requestId = ++bankLookupId.current;
        setBankLookupLoading(true);

        try {
            const res = await getBankByDpApi(selectedId);
            const bankId = res.data?.bankId;

            if (requestId === bankLookupId.current && bankId) {
                setForm((f) => ({
                    ...f,
                    bankId: String(bankId)
                }));
            }
        } catch {
        } finally {
            if (requestId === bankLookupId.current) {
                setBankLookupLoading(false);
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!form.dpId || !form.username || !form.password) {
            toast.error("DP username and password are required");
            return;
        }

        if (!form.crn.trim()) {
            toast.error("CRN number is required for IPO applications");
            return;
        }

        if (!form.bankId) {
            toast.error("Bank ID could not be resolved Please reselect your DP");
            return;
        }

        setLoading(true);

        try {
            await addAccountApi({
                ...form,
                username: form.username.trim(),
                crn: form.crn.trim()
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
                    <h2 className="form-section-title">Broker details</h2>

                    <div className="form-group">
                        <label className="form-label">
                            Depository Participant (DP)
                        </label>

                        {dpError ? (
                            <div className="dp-error-box">
                                <span>Could not load the DP list</span>
                                <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={fetchDpList}
                                >
                                    Retry
                                </button>
                            </div>
                        ) : (
                            <select
                                className="input"
                                name="dpId"
                                value={form.dpId}
                                onChange={handleDpChange}
                                required
                                disabled={dpLoading}
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
                        )}
                    </div>
                </div>

                <div className="form-section">
                    <h2 className="form-section-title">
                        Login credentials
                    </h2>

                    <div className="form-group">
                        <label className="form-label">
                            Meroshare username
                        </label>

                        <input
                            className="input"
                            type="text"
                            name="username"
                            value={form.username}
                            onChange={handleChange}
                            placeholder="Your Meroshare username"
                            required
                            autoComplete="username"
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">
                            Meroshare password
                        </label>

                        <div className="input-with-icon">
                            <input
                                className="input"
                                type={showPassword ? "text" : "password"}
                                name="password"
                                value={form.password}
                                onChange={handleChange}
                                placeholder="Your Meroshare password"
                                required
                                autoComplete="current-password"
                            />

                            <button
                                type="button"
                                className="input-icon-btn"
                                onClick={() =>
                                    setShowPassword((v) => !v)
                                }
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
                    </div>
                </div>

                <div className="form-section">
                    <h2 className="form-section-title">IPO details</h2>

                    <div className="form-group">
                        <label className="form-label">CRN number</label>

                        <input
                            className="input"
                            type="text"
                            name="crn"
                            value={form.crn}
                            onChange={handleChange}
                            placeholder="Bank CRN (required for IPO apply)"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">
                            Transaction PIN
                        </label>

                        <div className="input-with-icon">
                            <input
                                className="input"
                                type={showPin ? "text" : "password"}
                                name="pin"
                                value={form.pin}
                                onChange={handleChange}
                                placeholder="Meroshare transaction PIN (MPIN)"
                                inputMode="numeric"
                                autoComplete="off"
                            />

                            <button
                                type="button"
                                className="input-icon-btn"
                                onClick={() => setShowPin((v) => !v)}
                                aria-label={
                                    showPin ? "Hide PIN" : "Show PIN"
                                }
                            >
                                {showPin ? (
                                    <EyeOffIcon />
                                ) : (
                                    <EyeIcon />
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="form-note">
                    <InfoIcon />

                    <span>
                        Your password and PIN are AES encrypted before saving
                        <br />
                        Bank details are resolved automatically from your
                        selected DP
                    </span>
                </div>

                <div className="form-actions">
                    <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => navigate("/settings/accounts")}
                    >
                        Cancel
                    </button>

                    <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={
                            loading ||
                            dpLoading ||
                            bankLookupLoading
                        }
                    >
                        {loading ? (
                            <>
                                <SpinnerIcon />
                                Verifying and adding
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