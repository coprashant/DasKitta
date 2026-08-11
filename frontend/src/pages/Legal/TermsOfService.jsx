import Layout from "../../components/Layout/Layout.jsx";
import "./Legal.css";

const TermsOfService = () => {
    return (
        <Layout>
            <main className="page">
                <div className="legal-doc">
                    <h1 className="page-title">Terms of Service</h1>
                    <p className="legal-updated">Last updated: August 2026</p>

                    <section className="legal-section">
                        <h2 className="legal-section-title">
                            <span className="legal-num">1.</span>Acceptance of Terms
                        </h2>
                        <div className="legal-body">
                            <p>
                                By accessing or using DasKitta, you agree to be bound by
                                these Terms of Service. If you do not agree with any part
                                of these terms, you must not use our service.
                            </p>
                        </div>
                    </section>

                    <section className="legal-section">
                        <h2 className="legal-section-title">
                            <span className="legal-num">2.</span>Description of Service
                        </h2>
                        <div className="legal-body">
                            <p>
                                DasKitta provides a unified interface for NEPSE investors
                                to aggregate Meroshare account management, streamline bulk
                                IPO submissions, check allotment results, and monitor live
                                stock market metrics.
                            </p>
                        </div>
                    </section>

                    <section className="legal-section">
                        <h2 className="legal-section-title">
                            <span className="legal-num">3.</span>User Responsibilities and Account Security
                        </h2>
                        <ul className="legal-list">
                            <li>You are responsible for maintaining the confidentiality of your DasKitta login credentials.</li>
                            <li>You must provide accurate, authorized Meroshare account credentials that you have legal permission to operate (e.g., your account or family accounts under your care).</li>
                            <li>You accept full responsibility for ensuring your Meroshare accounts have adequate bank balances and valid CRN details before submitting IPO requests.</li>
                        </ul>
                    </section>

                    <section className="legal-section">
                        <h2 className="legal-section-title">
                            <span className="legal-num">4.</span>Third-Party Dependencies (CDSC and NEPSE)
                        </h2>
                        <div className="legal-body">
                            <p>
                                DasKitta relies on external infrastructure operated by CDSC
                                (Meroshare) and NEPSE. We are not responsible for service
                                delays, failed IPO submissions, or inaccurate result
                                reporting resulting from third-party server outages, rate
                                limits, or API structural changes.
                            </p>
                        </div>
                    </section>

                    <section className="legal-section">
                        <h2 className="legal-section-title">
                            <span className="legal-num">5.</span>Limitation of Liability
                        </h2>
                        <div className="legal-body">
                            <p>
                                To the maximum extent permitted by law, DasKitta and its
                                developer(s) shall not be liable for any direct, indirect,
                                incidental, or consequential damages resulting from lost
                                IPO opportunities, banking rejections, or account locks
                                caused by <strong>incorrect PIN attempts or third-party downtime</strong>.
                            </p>
                        </div>
                    </section>

                    <section className="legal-section">
                        <h2 className="legal-section-title">
                            <span className="legal-num">6.</span>Modifications
                        </h2>
                        <div className="legal-body">
                            <p>
                                We reserve the right to modify or terminate features or
                                these Terms of Service at any time. Continued use of the
                                service constitutes acceptance of updated terms.
                            </p>
                        </div>
                    </section>

                    <p className="legal-footnote">
                        Questions about these terms? Reach the developer at{" "}
                        <a href="https://prasant-bhattarai.com.np">prasant-bhattarai.com.np</a>.
                    </p>
                </div>
            </main>
        </Layout>
    );
};

export default TermsOfService;