import { useState, useEffect } from "react";
import {
  addAccountApi, getAccountsApi,
  deleteAccountApi, getDpListApi,
} from "../../api/accounts";
import Layout from "../../components/Layout";
import toast from "react-hot-toast";
import "./AddAccount.css";

const AddAccount = ({ theme, onThemeToggle }) => {
  const [form, setForm] = useState({
    dpId: "", username: "", password: "", crn: "", pin: "",
  });
  const [accounts, setAccounts]   = useState([]);
  const [dpList, setDpList]       = useState([]);
  const [loading, setLoading]     = useState(false);
  const [deleting, setDeleting]   = useState(null);
  const [dpLoading, setDpLoading] = useState(true);
  const [accsLoading, setAccsLoading] = useState(true);

  useEffect(() => {
    fetchAccounts();
    fetchDpList();
  }, []);

  const fetchDpList = async () => {
    setDpLoading(true);
    try {
      const res = await getDpListApi();
      setDpList(res.data);
    } catch {
      toast.error("Failed to load DP list. Please refresh.");
    } finally {
      setDpLoading(false);
    }
  };

  const fetchAccounts = async () => {
    setAccsLoading(true);
    try {
      const res = await getAccountsApi();
      setAccounts(res.data);
    } catch {
      toast.error("Failed to load saved accounts.");
    } finally {
      setAccsLoading(false);
    }
  };

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.dpId || !form.username || !form.password) {
      toast.error("DP, username and password are required");
      return;
    }
    setLoading(true);
    try {
      await addAccountApi(form);
      toast.success("Account added successfully");
      setForm({ dpId: "", username: "", password: "", crn: "", pin: "" });
      fetchAccounts();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to add account");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Remove this Meroshare account?")) return;
    setDeleting(id);
    try {
      await deleteAccountApi(id);
      toast.success("Account removed");
      setAccounts(accounts.filter((a) => a.id !== id));
    } catch {
      toast.error("Failed to remove account");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <Layout theme={theme} onThemeToggle={onThemeToggle}>
      <div className="page">
        <h1 className="page-title">Meroshare Accounts</h1>
        <p className="page-subtitle">
          Add and manage your Meroshare credentials. Passwords are encrypted before storing.
        </p>

        <div className="add-account-layout">
          <div className="card anim-fade-up">
            <h2 className="card-section-title">Add new account</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Depository Participant (DP)</label>
                <select
                  className="input"
                  name="dpId"
                  value={form.dpId}
                  onChange={handleChange}
                  required
                  disabled={dpLoading}
                >
                  <option value="">
                    {dpLoading ? "Loading DPs" : "Select your bank or DP"}
                  </option>
                  {dpList.map((dp) => (
                    <option key={dp.id} value={dp.id}>
                      {dp.name} ({dp.id})
                    </option>
                  ))}
                </select>
              </div>

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
                <input
                  className="input" type="password" name="password"
                  value={form.password} onChange={handleChange}
                  placeholder="Your Meroshare password" required
                />
              </div>

              <div className="form-group">
                <label className="form-label">CRN number</label>
                <input
                  className="input" type="text" name="crn"
                  value={form.crn} onChange={handleChange}
                  placeholder="Bank CRN (required for IPO apply)"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Transaction PIN</label>
                <input
                  className="input" type="password" name="pin"
                  value={form.pin} onChange={handleChange}
                  placeholder="Meroshare transaction PIN"
                />
              </div>

              <div className="form-note">
                <InfoIcon />
                <span>
                  Your password and PIN are AES-encrypted before being saved.
                  CRN and PIN are needed to apply for IPOs.
                </span>
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-full"
                disabled={loading || dpLoading}
                style={{ marginTop: 4 }}
              >
                {loading ? (
                  <><SpinnerIcon /> Verifying and adding</>
                ) : "Add account"}
              </button>
            </form>
          </div>

          <div>
            <div className="section-head-row">
              <span className="section-title-sm">
                Saved accounts ({accounts.length})
              </span>
            </div>

            {accsLoading ? (
              <div className="saved-accounts-list">
                {[1, 2].map((k) => (
                  <div className="card saved-account-card" key={k}>
                    <div className="skeleton" style={{ width: 38, height: 38, borderRadius: 6, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div className="skeleton" style={{ height: 12, width: "55%", marginBottom: 8 }} />
                      <div className="skeleton" style={{ height: 10, width: "35%" }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : accounts.length === 0 ? (
              <div className="card empty-state">
                <p>No accounts added yet.</p>
              </div>
            ) : (
              <div className="saved-accounts-list">
                {accounts.map((acc, i) => (
                  <div
                    className="card saved-account-card anim-fade-up"
                    key={acc.id}
                    style={{ animationDelay: `${i * 0.07}s` }}
                  >
                    <div className="saved-account-avatar">
                      {acc.fullName?.charAt(0) || "?"}
                    </div>
                    <div className="saved-account-info">
                      <p className="saved-account-name">{acc.fullName}</p>
                      <p className="saved-account-meta">{acc.username} &middot; DP {acc.dpId}</p>
                      {acc.boid && (
                        <p className="saved-account-boid">BOID: {acc.boid}</p>
                      )}
                    </div>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDelete(acc.id)}
                      disabled={deleting === acc.id}
                    >
                      {deleting === acc.id ? <SpinnerIcon /> : "Remove"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

const InfoIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    style={{ flexShrink: 0, marginTop: 1 }}>
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8" x2="12" y2="12"/>
    <line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);

const SpinnerIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
    style={{ animation: "spin 0.7s linear infinite" }}>
    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
  </svg>
);

export default AddAccount;