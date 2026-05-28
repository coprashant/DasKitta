import { useNotifications } from "../../context/NotificationContext.jsx";
import {
  IconBell, IconBellOff, IconRefresh, IconTrash,
  IconTrendUp, IconTrendDown, IconAlertCircle,
  IconCalendarClock, IconSparkle,
} from "../Icons.jsx";
import "./NotificationPanel.css";

const TYPE_META = {
  ALLOTTED: {
    icon:      <IconTrendUp />,
    colorVar:  "var(--success)",
    dimVar:    "var(--success-dim)",
  },
  NOT_ALLOTTED: {
    icon:      <IconTrendDown />,
    colorVar:  "var(--danger)",
    dimVar:    "var(--danger-dim)",
  },
  RESULT_PUBLISHED: {
    icon:      <IconBell />,
    colorVar:  "var(--accent)",
    dimVar:    "var(--accent-dim)",
  },
  APP_FAILED: {
    icon:      <IconAlertCircle />,
    colorVar:  "var(--danger)",
    dimVar:    "var(--danger-dim)",
  },
  IPO_CLOSING_SOON: {
    icon:      <IconCalendarClock />,
    colorVar:  "var(--warning)",
    dimVar:    "var(--warning-dim)",
  },
  NEW_IPO: {
    icon:      <IconSparkle />,
    colorVar:  "var(--accent)",
    dimVar:    "var(--accent-dim)",
  },
};

const fmtRelative = (iso) => {
  if (!iso) return "";
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1)   return "just now";
    if (m < 60)  return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24)  return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 7)   return `${d}d ago`;
    return new Date(iso).toLocaleDateString();
  } catch {
    return "";
  }
};

const NotificationPanel = ({ readTimestamp, onClose }) => {
  const { notifications, loading, markAllRead, clearAll, refresh } = useNotifications();

  const handleMarkRead = () => {
    markAllRead();
  };

  const handleClear = () => {
    clearAll();
    onClose();
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
                onClick={handleMarkRead}
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
            <p>No notifications yet</p>
          </div>
        ) : (
          notifications.map((n) => {
            const meta    = TYPE_META[n.type] || TYPE_META.RESULT_PUBLISHED;
            const isUnread = new Date(n.timestamp).getTime() > readTimestamp;
            return (
              <div
                key={n.id}
                className={`notif-item${isUnread ? " notif-item-unread" : ""}`}
              >
                <div
                  className="notif-icon-wrap"
                  style={{
                    color:      meta.colorVar,
                    background: meta.dimVar,
                  }}
                >
                  {meta.icon}
                </div>
                <div className="notif-content">
                  <p className="notif-title">{n.title}</p>
                  <p className="notif-body">{n.body}</p>
                  {n.detail && <p className="notif-detail">{n.detail}</p>}
                </div>
                <span className="notif-time">{fmtRelative(n.timestamp)}</span>
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