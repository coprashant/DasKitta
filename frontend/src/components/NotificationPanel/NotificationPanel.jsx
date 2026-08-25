import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useNotifications } from "../../context/NotificationContext.jsx";
import {
  IconBell, IconBellOff, IconRefresh, IconTrash,
  IconAlertCircle, IconCalendarClock, IconSparkle, IconX
} from "../Icons.jsx";
import "./NotificationPanel.css";

const TYPE_META = {
  APP_FAILED: {
    icon:     <IconAlertCircle />,
    colorVar: "var(--danger)",
    dimVar:   "var(--danger-dim)",
  },
  IPO_CLOSING_SOON: {
    icon:     <IconCalendarClock />,
    colorVar: "var(--warning)",
    dimVar:   "var(--warning-dim)",
  },
  NEW_IPO: {
    icon:     <IconSparkle />,
    colorVar: "var(--accent)",
    dimVar:   "var(--accent-dim)",
  },
};

const fmtRelative = (iso) => {
  if (!iso) return "";
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1)  return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 7)  return `${d}d ago`;
    return new Date(iso).toLocaleDateString();
  } catch {
    return "";
  }
};

const NotificationPanel = ({ onClose }) => {
  const { notifications, loading, readIds, markAsRead, markAllRead, removeNotif, clearAll, refresh } = useNotifications();
  const navigate = useNavigate();
  const [, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  const handleClear = () => {
    clearAll();
    if (onClose) onClose();
  };

  const handleItemClick = (n) => {
    markAsRead(n.id);
    if (n.targetUrl) {
      navigate(n.targetUrl);
      if (onClose) onClose();
    }
  };

  // Keyboard accessibility helper
  const handleKeyDown = (e, callback) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      callback();
    }
  };

  const handleDismissOne = (e, id) => {
    e.stopPropagation();
    removeNotif(id);
  };

  return (
      <div className="notif-panel" role="dialog" aria-label="Notifications">
        <div className="notif-panel-header">
          <span className="notif-panel-title">Notifications</span>
          <div className="notif-panel-actions">
            <button
                className="notif-action-btn"
                onClick={refresh}
                disabled={loading}
                title="Refresh"
                aria-label="Refresh notifications"
            >
              <IconRefresh spinning={loading} />
            </button>
            {notifications.length > 0 && (
                <>
                  <button
                      className="notif-action-btn"
                      onClick={markAllRead}
                      title="Mark all read"
                      aria-label="Mark all as read"
                  >
                    <IconBell />
                  </button>
                  <button
                      className="notif-action-btn notif-action-danger"
                      onClick={handleClear}
                      title="Clear all"
                      aria-label="Clear all notifications"
                  >
                    <IconTrash />
                  </button>
                </>
            )}
          </div>
        </div>

        <div className="notif-list">
          {notifications.length === 0 ? (
              <div className="notif-empty">
                <IconBellOff />
                <p>No notifications</p>
              </div>
          ) : (
              notifications.map((n) => {
                const meta     = TYPE_META[n.type] || TYPE_META.NEW_IPO;
                const isUnread = !readIds.has(n.id);

                return (
                    <div
                        key={n.id}
                        className={`notif-item${isUnread ? " notif-item-unread" : ""}`}
                        onClick={() => handleItemClick(n)}
                        onKeyDown={(e) => handleKeyDown(e, () => handleItemClick(n))}
                        role="button"
                        tabIndex={0}
                    >
                      <div
                          className="notif-icon-wrap"
                          style={{ color: meta.colorVar, background: meta.dimVar }}
                      >
                        {meta.icon}
                      </div>
                      <div className="notif-content">
                        <p className="notif-title">{n.title}</p>
                        <p className="notif-body">{n.body}</p>
                        {n.detail && <p className="notif-detail">{n.detail}</p>}
                      </div>
                      <div className="notif-meta">
                        <button
                            className="notif-dismiss-btn"
                            onClick={(e) => handleDismissOne(e, n.id)}
                            title="Dismiss"
                            aria-label="Dismiss notification"
                        >
                          <IconX />
                        </button>
                        <span className="notif-time">{fmtRelative(n.timestamp)}</span>
                      </div>
                      {isUnread && <span className="notif-dot" aria-hidden="true" />}
                    </div>
                );
              })
          )}
        </div>
      </div>
  );
};

export default NotificationPanel;