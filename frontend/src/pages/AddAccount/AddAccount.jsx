import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { addAccountApi, getDpListApi, getBankByDpApi } from "../../api/accounts";
import { useAccount } from "../../context/AccountContext";
import Layout from "../../components/Layout/Layout.jsx";
import { InfoIcon, SpinnerIcon, EyeIcon, EyeOffIcon, ChevronIcon } from "../../components/Icons";
import toast from "react-hot-toast";
import "./AddAccount.css";

const EMPTY_FORM = { dpId: "", dpCode: "", username: "", password: "", bankId: "", crn: "", pin: "" };

const AddAccount = () => {
  const navigate = useNavigate();
  const { refreshAccounts } = useAccount();

  const [form, setForm] = useState(EMPTY_FORM);
  const [showPassword, setShowPassword] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [dpList, setDpList] = useState([]);
  const [dpFilter, setDpFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [dpLoading, setDpLoading] = useState(true);
  const [dpError, setDpError] = useState(false);
  const [bankLookupLoading, setBankLookupLoading] = useState(false);

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

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleDpChange = async (e) => {
    const selectedId = e.target.value;
    const dp = dpList.find((d) => String(d.id) === String(selectedId));
    setForm((f) => ({ ...f, dpId: selectedId, dpCode: dp ? dp.code : "", bankId: "" }));
    if (!selectedId) return;
    setBankLookupLoading(true);
    try {
      const res = await getBankByDpApi(selectedId);
      const bankId = res.data?.bankId;
      if (bankId) setForm((f) => ({ ...f, bankId: String(bankId) }));
    } catch {
      // silent fail on bank lookup
    } finally {
      setBankLookupLoading(false);
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
      await addAccountApi(form);
      toast.success("Account added successfully");
      await refreshAccounts();
      navigate("/accounts");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to add account");
    } finally {
      setLoading(false);
    }
  };

  const selectedDp = dpList.find((d) => String(d.id) === String(form.dpId));

  const filteredDpList = dpFilter.trim()
      ? dpList.filter((dp) =>
          `${dp.name} ${dp.code}`.toLowerCase().includes(dpFilter.trim().toLowerCase()))
      : dpList;

  return (
      <Layout>
        <div className="page">
          <Link to="/accounts" className="back-link">
            <ChevronIcon rotated /> Back to accounts
          </Link>

          <h1 className="page-title">Add account</h1>
          <p className="page-subtitle">
            Connect a Meroshare account Passwords are AES encrypted before storing
          </p>

          <div className="card anim-fade-up add-account-card">
            <form onSubmit={handleSubmit}>

              <div className="form-section">
                <h2 className="form-section-title">Broker details</h2>

                <div className="form-group">
                  <label className="form-label">Depository Participant (DP)</label>
                  {dpError ? (
                      <div className="dp-error-box">
                        <span>Could not load the DP list</span>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={fetchDpList}>
                          Retry
                        </button>
                      </div>
                  ) : (
                      <>
                        <input
                            className="input"
                            type="text"
                            placeholder={dpLoading ? "Loading DPs..." : "Search your bank or DP"}
                            value={dpFilter}
                            onChange={(e) => setDpFilter(e.target.value)}
                            disabled={dpLoading}
                            style={{ marginBottom: 8 }}
                        />
                        <select
                            className="input"
                            name="dpId"
                            value={form.dpId}
                            onChange={handleDpChange}
                            required
                            disabled={dpLoading}
                            size={dpFilter.trim() ? Math.min(filteredDpList.length + 1, 6) : undefined}
                        >
                          <option value="">
                            {dpLoading ? "Loading DPs..." : "Select your bank or DP"}
                          </option>
                          {filteredDpList.map((dp) => (
                              <option key={dp.id} value={dp.id}>
                                {dp.name} ({dp.code})
                              </option>
                          ))}
                        </select>
                      </>
                  )}
                  {selectedDp && (
                      <span className="form-hint">
                    DP code {selectedDp.code} ID {selectedDp.id}
                        {bankLookupLoading && " Looking up bank..."}
                        {!bankLookupLoading && form.bankId && ` Bank ID ${form.bankId}`}
                        {!bankLookupLoading && !form.bankId && (
                            <span className="form-hint-danger">
                        {" "}Bank ID not found Try a different DP
                      </span>
                        )}
                  </span>
                  )}
                </div>
              </div>

              <div className="form-section">
                <h2 className="form-section-title">Login credentials</h2>

                <div className="form-group">
                  <label className="form-label">Meroshare username</label>
                  <input
                      className="input" type="text" name="username"
                      value={form.username} onChange={handleChange}
                      placeholder="Your Meroshare username" required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Meroshare password</label>
                  <div className="input-with-icon">
                    <input
                        className="input" type={showPassword ? "text" : "password"} name="password"
                        value={form.password} onChange={handleChange}
                        placeholder="Your Meroshare password" required
                    />
                    <button type="button" className="input-icon-btn" onClick={() => setShowPassword((v) => !v)}
                            aria-label={showPassword ? "Hide password" : "Show password"}>
                      {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h2 className="form-section-title">IPO details</h2>

                <div className="form-group">
                  <label className="form-label">CRN number</label>
                  <input
                      className="input" type="text" name="crn"
                      value={form.crn} onChange={handleChange}
                      placeholder="Bank CRN (required for IPO apply)" required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Transaction PIN</label>
                  <div className="input-with-icon">
                    <input
                        className="input" type={showPin ? "text" : "password"} name="pin"
                        value={form.pin} onChange={handleChange}
                        placeholder="Meroshare transaction PIN (MPIN)"
                    />
                    <button type="button" className="input-icon-btn" onClick={() => setShowPin((v) => !v)}
                            aria-label={showPin ? "Hide PIN" : "Show PIN"}>
                      {showPin ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="form-note">
                <InfoIcon />
                <span>
                Your password and PIN are AES encrypted before saving
                Bank details are resolved automatically from your selected DP
              </span>
              </div>

              <div className="form-actions">
                <Link to="/accounts" className="btn btn-secondary">
                  Cancel
                </Link>
                <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={loading || dpLoading || bankLookupLoading}
                >
                  {loading ? <><SpinnerIcon /> Verifying and adding</> : "Add account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </Layout>
  );
};

export default AddAccount;