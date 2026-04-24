import { Link } from "react-router-dom";
import Layout from "../../components/Layout";
import "./NotFound.css";

const NotFound = () => {
  return (
    <Layout>
      <div className="notfound-page">
        <div className="notfound-inner anim-fade-up">
          <div className="notfound-graphic" aria-hidden="true">
            <svg
              width="80" height="80" viewBox="0 0 80 80" fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect
                x="8" y="8" width="64" height="64" rx="12"
                stroke="var(--border-strong)" strokeWidth="2"
              />
              <circle cx="40" cy="34" r="10" stroke="var(--text-3)" strokeWidth="2"/>
              <line
                x1="26" y1="56" x2="54" y2="56"
                stroke="var(--text-3)" strokeWidth="2" strokeLinecap="round"
              />
              <line
                x1="36" y1="30" x2="36" y2="38"
                stroke="var(--text-3)" strokeWidth="2" strokeLinecap="round"
              />
              <line
                x1="44" y1="30" x2="44" y2="38"
                stroke="var(--text-3)" strokeWidth="2" strokeLinecap="round"
              />
            </svg>
          </div>
          <p className="notfound-code">404</p>
          <h1 className="notfound-title">Page not found</h1>
          <p className="notfound-desc">
            The page you are looking for does not exist or has been moved.
          </p>
          <div className="notfound-actions">
            <Link to="/" className="btn btn-primary">Go home</Link>
            <Link to="/ipo/result" className="btn btn-secondary">Check IPO result</Link>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default NotFound;