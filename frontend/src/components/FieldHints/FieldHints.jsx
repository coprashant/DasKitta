import { getPasswordStrength } from "../../authRules";
import "./FieldHints.css";

export const PasswordStrength = ({ value, id }) => {
    if (!value) return null;
    const { score, label, tip } = getPasswordStrength(value);
    return (
        <div className="pw-strength" id={id}>
            <div className="pw-strength-bars" data-score={score} aria-hidden="true">
                {[1, 2, 3, 4].map((i) => (
                    <span key={i} className={i <= score ? "on" : ""} />
                ))}
            </div>
            <span className="pw-strength-text">{label}{tip && ` · ${tip}`}</span>
        </div>
    );
};