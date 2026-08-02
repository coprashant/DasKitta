import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getAccountInfoApi } from "../../api/accounts";
import { SpinnerIcon, InfoIcon } from "../../components/Icons";

function InfoRow({ label, value }) {
    return (
        <div className="info-row">
            <span className="info-row-label">{label}</span>
            <span className="info-row-value">{value || "—"}</span>
        </div>
    );
}

export default function AccountInfo() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [info, setInfo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await getAccountInfoApi(id);
                if (!cancelled) setInfo(res.data);
            } catch (err) {
                if (!cancelled) {
                    setError(err.response?.data?.message || "Could not load account info");
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [id]);

    return (
        <div className="stg-card anim-fade-up">
            <div className="stg-card-head">
                <h2 className="stg-card-title">Account info</h2>
            </div>

            {loading ? (
                <div className="info-loading">
                    <SpinnerIcon /> Loading account details...
                </div>
            ) : error ? (
                <div className="card empty-state">
                    <p>{error}</p>
                    <button className="btn btn-secondary" onClick={() => navigate(-1)}>
                        Go back
                    </button>
                </div>
            ) : (
                <div className="card info-panel">
                    {!info.liveDataAvailable && (
                        <div className="form-note">
                            <InfoIcon />
                            <span>Could not reach Meroshare right now — showing last saved details</span>
                        </div>
                    )}

                    <InfoRow label="Full name" value={info.fullName} />
                    <InfoRow label="BOID" value={info.boid} />
                    <InfoRow label="Demat" value={info.demat} />
                    <InfoRow label="DP ID" value={info.dpId} />
                    <InfoRow label="DP Code" value={info.dpCode} />
                    <InfoRow label="Username" value={info.username} />
                    <InfoRow label="CRN" value={info.crn} />
                    <InfoRow label="Bank" value={info.bankName} />
                    <InfoRow label="Branch" value={info.branchName} />
                    <InfoRow label="Bank account no." value={info.accountNumber} />
                    <InfoRow label="Account type" value={info.accountTypeId === 1 ? "Saving" : "Current"} />
                    <InfoRow label="Meroshare account expiry" value={info.accountExpiryDate} />
                    <InfoRow label="Meroshare password expiry" value={info.passwordExpiryDate} />
                    <InfoRow label="Demat expiry (BS)" value={info.dematExpiryDate} />

                    <button className="btn btn-secondary" style={{ marginTop: 16 }} onClick={() => navigate(-1)}>
                        Back
                    </button>
                </div>
            )}
        </div>
    );
}