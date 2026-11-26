/* shared base for every icon */
const Svg = ({ size, children, ...rest }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        {...rest}
    >
        {children}
    </svg>
);

/* soft fill hook used by the tab bar active state */
const duo = { className: "ti-fill", fill: "currentColor", fillOpacity: 0 };

/* status and feedback */

export const IconStack = () => (
    <Svg>
        <path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z" />
        <path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12" />
        <path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17" />
    </Svg>
);

export const IconCheck = () => (
    <Svg>
        <circle cx="12" cy="12" r="10" />
        <path d="m9 12 2 2 4-4" />
    </Svg>
);

export const IconX = () => (
    <Svg>
        <circle cx="12" cy="12" r="10" />
        <path d="m15 9-6 6" />
        <path d="m9 9 6 6" />
    </Svg>
);

export const IconClock = () => (
    <Svg>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
    </Svg>
);

export const InfoIcon = () => (
    <Svg size={14} style={{ flexShrink: 0, marginTop: 1 }}>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4" />
        <path d="M12 8h.01" />
    </Svg>
);

export const WarnIcon = () => (
    <Svg size={14} style={{ flexShrink: 0, marginTop: 1 }}>
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
    </Svg>
);

export const IconAlertCircle = () => (
    <Svg size={13} strokeWidth="2.2">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v4" />
        <path d="M12 16h.01" />
    </Svg>
);

/*  actions  */

export const IconPlus = () => (
    <Svg size={13} strokeWidth="2.2">
        <path d="M5 12h14" />
        <path d="M12 5v14" />
    </Svg>
);

export const PlusIcon = () => (
    <Svg size={15} strokeWidth="2.5">
        <path d="M5 12h14" />
        <path d="M12 5v14" />
    </Svg>
);

export const MinusIcon = () => (
    <Svg size={15} strokeWidth="2.5">
        <path d="M5 12h14" />
    </Svg>
);

export const IconCheckSmall = () => (
    <Svg size={11} strokeWidth="3">
        <path d="M20 6 9 17l-5-5" />
    </Svg>
);

export const CheckIcon = () => (
    <Svg size={10} strokeWidth="3">
        <path d="M20 6 9 17l-5-5" />
    </Svg>
);

export const CloseIcon = () => (
    <Svg size={13} strokeWidth="2.5">
        <path d="M18 6 6 18" />
        <path d="m6 6 12 12" />
    </Svg>
);

export const ClearIcon = () => (
    <Svg size={13} strokeWidth="2.5">
        <path d="M18 6 6 18" />
        <path d="m6 6 12 12" />
    </Svg>
);

export const IconTrash = () => (
    <Svg size={12} strokeWidth="2">
        <path d="M3 6h18" />
        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
        <path d="M10 11v6" />
        <path d="M14 11v6" />
    </Svg>
);

export const EditIcon = () => (
    <Svg size={16} strokeWidth="2">
        <path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z" />
    </Svg>
);

export const MoreIcon = () => (
    <Svg size={18}>
        <circle cx="12" cy="5" r="1.8" fill="currentColor" stroke="none" />
        <circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none" />
        <circle cx="12" cy="19" r="1.8" fill="currentColor" stroke="none" />
    </Svg>
);

export const DragHandleIcon = () => (
    <Svg
        size={14}
        className="drag-handle-icon"
        style={{ flexShrink: 0, cursor: "grab", color: "var(--text-3)" }}
    >
        <circle cx="9" cy="6" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="15" cy="6" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="9" cy="12" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="15" cy="12" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="9" cy="18" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="15" cy="18" r="1.2" fill="currentColor" stroke="none" />
    </Svg>
);

export const IconDownload = () => (
    <Svg strokeWidth="2">
        <path d="M12 15V3" />
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <path d="m7 10 5 5 5-5" />
    </Svg>
);

export const IconShare = () => (
    <Svg strokeWidth="2">
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <line x1="8.6" y1="13.5" x2="15.4" y2="17.4" />
        <line x1="15.4" y1="6.6" x2="8.6" y2="10.5" />
    </Svg>
);

export const IconStar = ({ filled }) => (
    <Svg size={13} strokeWidth="2" fill={filled ? "currentColor" : "none"}>
        <path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" />
    </Svg>
);

/*  loading and refresh */

export const IconRefresh = ({ spinning }) => (
    <Svg
        size={12}
        strokeWidth="2.2"
        style={{ animation: spinning ? "dash-spin 0.9s linear infinite" : "none", display: "block" }}
    >
        <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
        <path d="M21 3v5h-5" />
        <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
        <path d="M8 16H3v5" />
    </Svg>
);

export const IconRefreshOutline = () => (
    <Svg>
        <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
        <path d="M21 3v5h-5" />
    </Svg>
);

export const SpinnerIcon = () => (
    <Svg size={13} strokeWidth="2.5" style={{ animation: "spin 0.7s linear infinite" }}>
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </Svg>
);

/*  chevrons and arrows  */

export const IconChevronDown = () => (
    <Svg size={12} strokeWidth="2.5">
        <path d="m6 9 6 6 6-6" />
    </Svg>
);

export const ChevronIcon = ({ rotated }) => (
    <Svg
        size={13}
        strokeWidth="2.5"
        style={{ transform: rotated ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}
    >
        <path d="m6 9 6 6 6-6" />
    </Svg>
);

export const ChevronLeft = () => (
    <Svg size={14} strokeWidth="2.5">
        <path d="m15 18-6-6 6-6" />
    </Svg>
);

export const ChevronRight = () => (
    <Svg size={14} strokeWidth="2.5">
        <path d="m9 18 6-6-6-6" />
    </Svg>
);

export const IconUp = () => (
    <Svg size={12} strokeWidth="3" stroke="var(--success)">
        <path d="m18 15-6-6-6 6" />
    </Svg>
);

export const IconDown = () => (
    <Svg size={12} strokeWidth="3" stroke="var(--danger)">
        <path d="m6 9 6 6 6-6" />
    </Svg>
);

export const IconArrowUp = () => (
    <Svg strokeWidth="2.2">
        <path d="M12 19V5" />
        <path d="m5 12 7-7 7 7" />
    </Svg>
);

export const IconArrowDown = () => (
    <Svg strokeWidth="2.2">
        <path d="M12 5v14" />
        <path d="m19 12-7 7-7-7" />
    </Svg>
);

export const ArrowIcon = () => (
    <Svg
        size={10}
        strokeWidth="2.5"
        style={{ marginLeft: 2, flexShrink: 0, transition: "transform 0.22s", opacity: 0.6 }}
    >
        <path d="M7 7h10v10" />
        <path d="M7 17 17 7" />
    </Svg>
);

/* market  */

export const IconTrendUp = () => (
    <Svg size={13} strokeWidth="2.2">
        <path d="M16 7h6v6" />
        <path d="m22 7-8.5 8.5-5-5L2 17" />
    </Svg>
);

export const IconTrendDown = () => (
    <Svg size={13} strokeWidth="2.2">
        <path d="M16 17h6v-6" />
        <path d="m22 17-8.5-8.5-5 5L2 7" />
    </Svg>
);

export const IconBriefcase = () => (
    <Svg>
        <path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
        <rect width="20" height="14" x="2" y="6" rx="2" />
    </Svg>
);

export const IconCalendarClock = () => (
    <Svg size={13} strokeWidth="2.2">
        <path d="M16 14v2.2l1.6 1" />
        <path d="M16 2v4" />
        <path d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5" />
        <path d="M3 10h5" />
        <path d="M8 2v4" />
        <circle cx="16" cy="16" r="6" />
    </Svg>
);

export const IconSparkle = () => (
    <Svg size={13} strokeWidth="2.2">
        <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
    </Svg>
);

/* files and search  */

export const IconFile = () => (
    <Svg size={13} strokeWidth="2">
        <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
        <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    </Svg>
);

export const IconSearch = () => (
    <Svg size={15} strokeWidth="2">
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
    </Svg>
);

export const SearchIcon = () => (
    <Svg size={14} strokeWidth="2">
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
    </Svg>
);

/*  people and account  */

export const IconUser = () => (
    <Svg size={20}>
        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
    </Svg>
);

export const ProfileIcon = () => (
    <Svg size={15} strokeWidth="2">
        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
    </Svg>
);

export const UsersIcon = () => (
    <Svg size={13} strokeWidth="2">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </Svg>
);

export const SettingsIcon = () => (
    <Svg size={15} strokeWidth="2">
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
        <circle cx="12" cy="12" r="3" />
    </Svg>
);

export const SignOutIcon = () => (
    <Svg size={13} strokeWidth="2">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <path d="m16 17 5-5-5-5" />
        <path d="M21 12H9" />
    </Svg>
);

/*  notifications */

export const IconBell = () => (
    <Svg size={16} strokeWidth="2">
        <path d="M10.268 21a2 2 0 0 0 3.464 0" />
        <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" />
    </Svg>
);

export const BellIcon = () => (
    <Svg size={16} strokeWidth="2">
        <path d="M10.268 21a2 2 0 0 0 3.464 0" />
        <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" />
    </Svg>
);

export const IconBellOff = () => (
    <Svg size={16} strokeWidth="2">
        <path d="M10.268 21a2 2 0 0 0 3.464 0" />
        <path d="M17 17H4a1 1 0 0 1-.74-1.673C4.59 13.956 6 12.499 6 8a6 6 0 0 1 .258-1.742" />
        <path d="m2 2 20 20" />
        <path d="M8.668 3.01A6 6 0 0 1 18 8c0 2.687.77 4.653 1.707 6.05" />
    </Svg>
);

/* theme  */

export const SunIcon = () => (
    <Svg size={15} strokeWidth="2">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2" />
        <path d="M12 20v2" />
        <path d="m4.93 4.93 1.41 1.41" />
        <path d="m17.66 17.66 1.41 1.41" />
        <path d="M2 12h2" />
        <path d="M20 12h2" />
        <path d="m6.34 17.66-1.41 1.41" />
        <path d="m19.07 4.93-1.41 1.41" />
    </Svg>
);

export const MoonIcon = () => (
    <Svg size={14} strokeWidth="2">
        <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </Svg>
);

export const MonitorIcon = () => (
    <Svg size={15} strokeWidth="2">
        <rect width="20" height="14" x="2" y="3" rx="2" />
        <path d="M8 21h8" />
        <path d="M12 17v4" />
    </Svg>
);

/* visibility */

export const EyeIcon = () => (
    <Svg size={15} strokeWidth="2">
        <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
        <circle cx="12" cy="12" r="3" />
    </Svg>
);

export const EyeOffIcon = () => (
    <Svg size={15} strokeWidth="2">
        <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
        <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
        <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
        <path d="m2 2 20 20" />
    </Svg>
);

/* misc */

export const CodeIcon = () => (
    <Svg className="dev-icon" strokeWidth="2">
        <path d="m16 18 6-6-6-6" />
        <path d="m8 6-6 6 6 6" />
    </Svg>
);

export const EmptyIllustration = () => (
    <svg
        width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true"
        style={{ margin: "0 auto 12px", display: "block" }}
    >
        <rect x="6" y="10" width="36" height="30" rx="5" stroke="var(--border-strong)" strokeWidth="1.5" />
        <line x1="12" y1="18" x2="36" y2="18" stroke="var(--border-strong)" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="12" y1="24" x2="28" y2="24" stroke="var(--border-strong)" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="12" y1="30" x2="22" y2="30" stroke="var(--border-strong)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
);

/*  tab bar icons  */
export const TabIconDashboard = () => (
    <Svg size={22} strokeWidth="1.75">
        <rect width="7" height="9" x="3" y="3" rx="1.5" {...duo} />
        <rect width="7" height="5" x="14" y="3" rx="1.5" {...duo} />
        <rect width="7" height="9" x="14" y="12" rx="1.5" {...duo} />
        <rect width="7" height="5" x="3" y="16" rx="1.5" {...duo} />
    </Svg>
);

export const TabIconNepse = () => (
    <Svg size={22} strokeWidth="1.75">
        <path d="M5 3v3" />
        <rect width="4" height="6" x="3" y="6" rx="1" {...duo} />
        <path d="M5 12v3" />
        <path d="M12 5v3" />
        <rect width="4" height="8" x="10" y="8" rx="1" {...duo} />
        <path d="M12 16v3" />
        <path d="M19 4v3" />
        <rect width="4" height="5" x="17" y="7" rx="1" {...duo} />
        <path d="M19 12v4" />
    </Svg>
);

export const TabIconApply = () => (
    <Svg size={22} strokeWidth="1.75">
        <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" {...duo} />
        <path d="M14 2v4a2 2 0 0 0 2 2h4" />
        <path d="M9 15h6" />
        <path d="M12 18v-6" />
    </Svg>
);

export const TabIconResults = () => (
    <Svg size={22} strokeWidth="1.75">
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" {...duo} />
        <rect width="8" height="4" x="8" y="2" rx="1" />
        <path d="m9 14 2 2 4-4" />
    </Svg>
);

export const TabIconPortfolio = () => (
    <Svg size={22} strokeWidth="1.75">
        <path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
        <rect width="20" height="14" x="2" y="6" rx="2" {...duo} />
    </Svg>
);