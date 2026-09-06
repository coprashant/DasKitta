import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAccount } from "../../context/AccountContext.jsx";
import { IconPlus, IconChevronDown, IconCheckSmall } from "../Icons.jsx";
import "./AccountSwitcher.css";

export default function AccountSwitcher() {
    const { accounts = [], activeAccount, setActiveAccount } = useAccount();
    const [open, setOpen] = useState(false);
    const [focusedIdx, setFocusedIdx] = useState(-1);
    const ref = useRef(null);
    const optionRefs = useRef([]);

    /* Get first uppercase letter safely */
    const getInitial = (name) => {
        const clean = name?.trim();
        return clean ? clean[0].toUpperCase() : "?";
    };

    /* Click outside and escape key handling */
    useEffect(() => {
        if (!open) return;

        const handleOutsideClick = (e) => {
            if (ref.current && !ref.current.contains(e.target)) {
                setOpen(false);
            }
        };

        const handleKeyDown = (e) => {
            if (e.key === "Escape") {
                setOpen(false);
            }
        };

        document.addEventListener("pointerdown", handleOutsideClick);
        document.addEventListener("keydown", handleKeyDown);

        return () => {
            document.removeEventListener("pointerdown", handleOutsideClick);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [open]);

    /* Reset focus index when dropdown opens or active account changes */
    useEffect(() => {
        if (open) {
            const idx = accounts.findIndex((a) => a.id === activeAccount?.id);
            setFocusedIdx(idx >= 0 ? idx : 0);
        }
    }, [open, accounts, activeAccount]);

    /* Focus active listbox option DOM element */
    useEffect(() => {
        if (open && focusedIdx >= 0 && optionRefs.current[focusedIdx]) {
            optionRefs.current[focusedIdx].focus();
        }
    }, [open, focusedIdx]);

    /* Listbox keyboard navigation */
    const handleListKeyDown = (e) => {
        if (!open) return;

        if (e.key === "ArrowDown") {
            e.preventDefault();
            setFocusedIdx((prev) => (prev + 1) % accounts.length);
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setFocusedIdx((prev) => (prev - 1 + accounts.length) % accounts.length);
        } else if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (accounts[focusedIdx]) {
                setActiveAccount(accounts[focusedIdx]);
                setOpen(false);
            }
        }
    };

    if (!activeAccount) return null;

    return (
        <div className="switcher-wrap" ref={ref}>
            <button
                className={`switcher-btn${open ? " open" : ""}`}
                onClick={() => setOpen((v) => !v)}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-label="Switch user account"
            >
                <div className="switcher-avatar">
                    {getInitial(activeAccount.fullName)}
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
                <div
                    className="switcher-dropdown"
                    role="listbox"
                    tabIndex={-1}
                    onKeyDown={handleListKeyDown}
                >
                    <div className="switcher-dropdown-label">Switch account</div>

                    <div className="switcher-options-list">
                        {accounts.map((acc, index) => {
                            const active = activeAccount?.id === acc.id;
                            return (
                                <button
                                    key={acc.id}
                                    ref={(el) => (optionRefs.current[index] = el)}
                                    role="option"
                                    aria-selected={active}
                                    tabIndex={focusedIdx === index ? 0 : -1}
                                    className={`switcher-option${active ? " active" : ""}`}
                                    onClick={() => {
                                        setActiveAccount(acc);
                                        setOpen(false);
                                    }}
                                >
                                    <div className={`switcher-opt-avatar${active ? " active" : ""}`}>
                                        {getInitial(acc.fullName)}
                                    </div>
                                    <div className="switcher-opt-info">
                                        <span className="switcher-opt-name">{acc.fullName}</span>
                                        <span className="switcher-opt-meta">
                                            {acc.username}{acc.dpCode ? ` · DP ${acc.dpCode}` : ""}
                                        </span>
                                    </div>
                                    {active && (
                                        <span className="switcher-opt-check">
                                            <IconCheckSmall />
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    <div className="switcher-footer">
                        <Link
                            to="/accounts/add"
                            className="switcher-add-link"
                            onClick={() => setOpen(false)}
                        >
                            <IconPlus /> Add account
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
}