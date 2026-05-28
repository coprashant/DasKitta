import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAccount } from "../../context/AccountContext.jsx";
import {
    IconUser, IconPlus, IconFile, IconRefresh, 
    IconStack, IconCheck, IconX, IconClock, 
    IconChevronDown, IconCheckSmall
} from "../Icons.jsx";
import "./AccountSwitcher.css";

export default function AccountSwitcher() {
    const { accounts, activeAccount, setActiveAccount } = useAccount();
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        if (!open) return;
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [open]);

    if (!activeAccount) return null;

    return (
        <div className="switcher-wrap" ref={ref}>
            <button
                className={`switcher-btn${open ? " open" : ""}`}
                onClick={() => setOpen(v => !v)}
                aria-haspopup="listbox"
                aria-expanded={open}
            >
                <div className="switcher-avatar">
                    {activeAccount.fullName?.[0]?.toUpperCase() ?? "?"}
                </div>
                <div className="switcher-info">
                    <span className="switcher-name">{activeAccount.fullName}</span>
                    <span className="switcher-meta">{activeAccount.username}</span>
                </div>
                <span className={`switcher-chevron${open ? " open" : ""}`}>
                    <IconChevronDown />
                </span>
            </button>

            {open && (
                <div className="switcher-dropdown" role="listbox">
                    <div className="switcher-dropdown-label">Switch account</div>
                    {accounts.map((acc) => {
                        const active = activeAccount?.id === acc.id;
                        return (
                            <button
                                key={acc.id}
                                role="option"
                                aria-selected={active}
                                className={`switcher-option${active ? " active" : ""}`}
                                onClick={() => { setActiveAccount(acc); setOpen(false); }}
                            >
                                <div className={`switcher-opt-avatar${active ? " active" : ""}`}>
                                    {acc.fullName?.[0]?.toUpperCase() ?? "?"}
                                </div>
                                <div className="switcher-opt-info">
                                    <span className="switcher-opt-name">{acc.fullName}</span>
                                    <span className="switcher-opt-meta">
                                        {acc.username}{acc.dpCode ? ` · DP ${acc.dpCode}` : ""}
                                    </span>
                                </div>
                                {active && <span className="switcher-opt-check"><IconCheckSmall /></span>}
                            </button>
                        );
                    })}
                    <div className="switcher-footer">
                        <Link to="/accounts/add" className="switcher-add-link" onClick={() => setOpen(false)}>
                            <IconPlus /> Add account
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
};