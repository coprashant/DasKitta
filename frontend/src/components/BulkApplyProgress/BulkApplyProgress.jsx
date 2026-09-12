import React from "react";
import { SpinnerIcon } from "../Icons";
import "./BulkApplyProgress.css";

const STATUS_META = {
  PENDING: { label: "Pending", cls: "pending" },
  APPLYING: { label: "Applying", cls: "applying" },
  SUCCESS: { label: "Success", cls: "success" },
  FAILED: { label: "Failed", cls: "failed" },
  CANCELLED: { label: "Cancelled", cls: "cancelled" },
};

const clamp = (v) => Math.max(0, Math.min(100, v));

const BulkApplyProgress = ({
  open,
  title,
  summary,
  rows,
  applying,
  completed,
  reconnecting,
  cancelling,
  canRetryFailed,
  canCancel,
  onRetryFailed,
  onCancelRemaining,
  onResume,
  onClose,
}) => {
  if (!open) return null;

  const total = Number(summary?.totalCount || 0);
  const processed = Number(summary?.processedCount || 0);
  const progress = total > 0 ? clamp((processed / total) * 100) : 0;

  return (
    <div className="ipo-progress-overlay" role="dialog" aria-modal="true">
      <div className="ipo-progress-drawer card">
        <div className="ipo-progress-head">
          <div>
            <p className="ipo-progress-title">Applying IPO</p>
            <p className="ipo-progress-subtitle">{title || "Selected IPO"}</p>
          </div>
          <button type="button" className="ipo-progress-close" onClick={onClose}>
            Minimize
          </button>
        </div>

        <div className="ipo-progress-stats">
          <span>Done {processed}/{total}</span>
          <span>Success {summary?.successCount || 0}</span>
          <span>Failed {summary?.failedCount || 0}</span>
          <span>Cancelled {summary?.cancelledCount || 0}</span>
          <span>Pending {summary?.pendingCount || 0}</span>
        </div>

        <div className="ipo-progress-track">
          <div className="ipo-progress-fill" style={{ width: `${progress}%` }} />
        </div>

        <div className="ipo-progress-list">
          {rows.map((row, index) => {
            const meta = STATUS_META[row.status] || STATUS_META.PENDING;
            const rowKey = `${row.accountId ?? "na"}_${row.username ?? "na"}_${index}`;
            return (
              <div key={rowKey} className="ipo-progress-row">
                <div>
                  <p className="ipo-progress-name">{row.fullName || row.username || "Account"}</p>
                  <p className="ipo-progress-meta">{row.username || "Unknown"}</p>
                  {row.message ? <p className="ipo-progress-msg">{row.message}</p> : null}
                </div>
                <div className={`ipo-progress-pill ${meta.cls}`}>
                  {row.status === "APPLYING" ? <SpinnerIcon /> : null}
                  <span>{meta.label}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="ipo-progress-foot">
          {reconnecting ? <span>Reconnecting stream</span> : null}
          {cancelling ? <span>Cancelling remaining</span> : null}
          {!reconnecting && applying ? <span>Processing accounts</span> : null}
          {completed ? <span>Completed</span> : null}
        </div>

        <div className="ipo-progress-actions">
          {!completed && !applying ? (
            <button type="button" className="ipo-progress-action" onClick={onResume}>
              Resume
            </button>
          ) : null}
          {canCancel ? (
            <button type="button" className="ipo-progress-action danger" onClick={onCancelRemaining}>
              Cancel remaining
            </button>
          ) : null}
          {canRetryFailed ? (
            <button type="button" className="ipo-progress-action primary" onClick={onRetryFailed}>
              Retry failed
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default BulkApplyProgress;
