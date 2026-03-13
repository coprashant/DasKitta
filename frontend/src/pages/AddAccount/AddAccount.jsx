import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { addAccountApi, getAccountsApi, deleteAccountApi } from "../../api/accounts";
import Navbar from "../../components/Navbar";
import toast from "react-hot-toast";
import "./AddAccount.css";

const DPID_LIST = [
  { id: "13200", name: "Kumari Bank" },
  { id: "13300", name: "NIC Asia Bank" },
  { id: "13000", name: "Nepal Investment Bank" },
  { id: "13100", name: "Nabil Bank" },
  { id: "13400", name: "Laxmi Bank" },
  { id: "13500", name: "Siddhartha Bank" },
  { id: "13600", name: "Global IME Bank" },
  { id: "13700", name: "Citizens Bank" },
  { id: "13800", name: "Prime Commercial Bank" },
  { id: "13900", name: "Sunrise Bank" },
  { id: "14000", name: "Century Bank" },
  { id: "14100", name: "Sanima Bank" },
  { id: "14200", name: "Mega Bank" },
  { id: "14300", name: "Civil Bank" },
  { id: "14400", name: "Nepal SBI Bank" },
  { id: "14500", name: "Everest Bank" },
  { id: "14600", name: "Prabhu Bank" },
  { id: "14700", name: "Rastriya Banijya Bank" },
  { id: "14800", name: "Agricultural Development Bank" },
  { id: "14900", name: "Nepal Bank" },
];

const AddAccount = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({ dpId: "", username: "", password: "" });
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      const res = await getAccountsApi();
      setAccounts(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await addAccountApi(form);
      toast.success("Account added successfully");
      setForm({ dpId: "", username: "", password: "" });
      fetchAccounts();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to add account");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    setDeleting(id);
    try {
      await deleteAccountApi(id);
      toast.success("Account removed");
      setAccounts(accounts.filter((a) => a.id !== id));
    } catch (err) {
      toast.error("Failed to remove account");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div>
      <Navbar />
      <div className="page">
        <h1 className="page-title">Meroshare Accounts</h1>
        <p className="page-subtitle">
          Add your Meroshare credentials. Passwords are encrypted before storing.
        </p>

        <div className="add-account-layout">
          <div className="add-account-form card">
            <h2 className="form-section-title">Add New Account</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Depository Participant (DP)</label>
                <select
                  name="dpId"
                  value={form.dpId}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select your bank / DP</option>
                  {DPID_LIST.map((dp) => (
                    <option key={dp.id} value={dp.id}>
                      {dp.name} ({dp.id})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Meroshare Username</label>
                <input
                  type="text"
                  name="username"
                  value={form.username}
                  onChange={handleChange}
                  placeholder="Your Meroshare username"
                  required
                />
              </div>

              <div className="form-group">
                <label>Meroshare Password</label>
                <input
                  type="password"
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Your Meroshare password"
                  required
                />
              </div>

              <div className="form-note">
                Your password is AES-encrypted before being saved to the database.
              </div>

              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? "Verifying & Adding..." : "Add Account"}
              </button>
            </form>
          </div>

          <div className="add-account-list">
            <h2 className="form-section-title">Saved Accounts ({accounts.length})</h2>

            {accounts.length === 0 ? (
              <div className="card empty-state">
                <p>No accounts added yet.</p>
              </div>
            ) : (
              accounts.map((acc) => (
                <div className="saved-account card" key={acc.id}>
                  <div className="saved-account-avatar">
                    {acc.fullName?.charAt(0) || "?"}
                  </div>
                  <div className="saved-account-info">
                    <p className="saved-account-name">{acc.fullName}</p>
                    <p className="saved-account-meta">
                      {acc.username} &middot; DP {acc.dpId}
                    </p>
                    {acc.boid && (
                      <p className="saved-account-boid">BOID: {acc.boid}</p>
                    )}
                  </div>
                  <button
                    className="btn btn-danger"
                    onClick={() => handleDelete(acc.id)}
                    disabled={deleting === acc.id}
                  >
                    {deleting === acc.id ? "Removing..." : "Remove"}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddAccount;