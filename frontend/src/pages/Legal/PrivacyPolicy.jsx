import Layout from "../../components/Layout/Layout.jsx";
import SEO from "../../seo/SEO.jsx";
import "./Legal.css";

const PrivacyPolicy = () => {
    return (
        <Layout>
            <SEO
                title="Privacy Policy"
                description="Learn how DasKitta collects, uses, and protects your personal data and Meroshare credentials."
                canonical="/privacy"
            />
            <main className="page">
                <div className="legal-doc">
                    <h1 className="page-title">Privacy Policy</h1>
                    <p className="legal-updated">Last updated: August 2026</p>

                    <section className="legal-section">
                        <h2 className="legal-section-title">
                            <span className="legal-num">1.</span>Overview
                        </h2>
                        <div className="legal-body">
                            <p>
                                DasKitta ("we", "our", or "us") is committed to protecting
                                your privacy. This policy explains how we collect, use,
                                and protect your information when you use our platform for
                                managing Meroshare accounts and viewing NEPSE market data.
                            </p>
                        </div>
                    </section>

                    <section className="legal-section">
                        <h2 className="legal-section-title">
                            <span className="legal-num">2.</span>Information We Collect
                        </h2>
                        <ul className="legal-list">
                            <li><strong>Account information:</strong> email address, encrypted password, and OTP verification data required for DasKitta authentication.</li>
                            <li><strong>Meroshare credentials:</strong> DP information, Meroshare username, password, and transaction PIN required to submit IPO applications on your behalf.</li>
                            <li><strong>Usage and device data:</strong> technical logs, browser details, and PWA installation state used strictly for security monitoring and application optimization.</li>
                        </ul>
                    </section>

                    <section className="legal-section">
                        <h2 className="legal-section-title">
                            <span className="legal-num">3.</span>How We Store and Protect Meroshare Credentials
                        </h2>
                        <div className="legal-body">
                            <p>
                                Your security is our top priority. All sensitive external
                                credentials, including Meroshare passwords and PINs, are
                                encrypted using industry-standard AES encryption before
                                being stored in our PostgreSQL database.{" "}
                                <strong>We do not store plaintext credentials.</strong>
                            </p>
                        </div>
                    </section>

                    <section className="legal-section">
                        <h2 className="legal-section-title">
                            <span className="legal-num">4.</span>How We Use Your Information
                        </h2>
                        <ul className="legal-list">
                            <li>To execute automated bulk IPO applications across your authorized Meroshare accounts.</li>
                            <li>To query CDSC servers for IPO allotment results and portfolio summaries.</li>
                            <li>To send essential security notifications, such as OTPs and email updates.</li>
                        </ul>
                    </section>

                    <section className="legal-section">
                        <h2 className="legal-section-title">
                            <span className="legal-num">5.</span>Third-Party Sharing
                        </h2>
                        <div className="legal-body">
                            <p>
                                <strong>We never sell, rent, or commercialize your personal data.</strong>{" "}
                                Your credentials are used strictly to communicate directly
                                with official CDSC/Meroshare and NEPSE endpoints necessary
                                to perform platform operations.
                            </p>
                        </div>
                    </section>

                    <section className="legal-section">
                        <h2 className="legal-section-title">
                            <span className="legal-num">6.</span>Your Rights
                        </h2>
                        <div className="legal-body">
                            <p>
                                You may modify or remove your linked Meroshare accounts at
                                any time through your dashboard. You may also update your
                                account credentials or request permanent account deletion
                                through your account settings.
                            </p>
                        </div>
                    </section>

                    <p className="legal-footnote">
                        Questions about your data? Reach the developer at{" "}
                        <a href="https://prasant-bhattarai.com.np">prasant-bhattarai.com.np</a>.
                    </p>
                </div>
            </main>
        </Layout>
    );
};

export default PrivacyPolicy;