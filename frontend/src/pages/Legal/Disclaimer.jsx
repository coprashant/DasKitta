import Layout from "../../components/Layout/Layout.jsx";
import SEO from "../../seo/SEO.jsx";
import "./Legal.css";

const Disclaimer = () => {
    return (
        <Layout>
            <SEO
                title="Disclaimer"
                description="DasKitta is not a licensed financial advisor. All NEPSE market data and IPO information is provided for informational purposes only."
                canonical="/disclaimer"
            />
            <main className="page">
                <div className="legal-doc">
                    <h1 className="page-title">Disclaimer</h1>
                    <p className="legal-updated">Last updated: August 2026</p>

                    <section className="legal-section">
                        <h2 className="legal-section-title">
                            <span className="legal-num">1.</span>Financial Disclaimer
                        </h2>
                        <div className="legal-body">
                            <p>
                                DasKitta is a productivity tool built for NEPSE investors.{" "}
                                <strong>DasKitta does not provide investment advice,
                                    financial planning, or stock recommendation services.</strong>{" "}
                                All stock data, IPO details, and market analytics provided
                                on this platform are for informational purposes only.
                            </p>
                        </div>
                    </section>

                    <section className="legal-section">
                        <h2 className="legal-section-title">
                            <span className="legal-num">2.</span>Affiliation Disclaimer
                        </h2>
                        <div className="legal-body">
                            <p>
                                DasKitta is an independent utility app developed by
                                Prasant Bhattarai.{" "}
                                <strong>DasKitta is not officially affiliated with,
                                    endorsed by, or operated by CDS and Clearing Limited
                                    (CDSC), Meroshare, the Nepal Stock Exchange (NEPSE), or
                                    SEBON.</strong> All product names, logos, and trademarks are
                                property of their respective owners.
                            </p>
                        </div>
                    </section>

                    <section className="legal-section">
                        <h2 className="legal-section-title">
                            <span className="legal-num">3.</span>Market Data Accuracy
                        </h2>
                        <div className="legal-body">
                            <p>
                                While we strive to keep market feeds, stock floorsheets,
                                and allotment data as accurate and real-time as possible,
                                data feeds may experience delay or processing errors due
                                to upstream infrastructure. Users should double-check
                                critical transaction data directly on official portals
                                before making financial decisions.
                            </p>
                        </div>
                    </section>

                    <section className="legal-section">
                        <h2 className="legal-section-title">
                            <span className="legal-num">4.</span>User Discretion
                        </h2>
                        <div className="legal-body">
                            <p>
                                Users are solely responsible for verifying the details of
                                IPO applications, share quantities, and bank selections
                                prior to submitting applications via the bulk tools.
                            </p>
                        </div>
                    </section>

                    <p className="legal-footnote">
                        Built independently by{" "}
                        <a href="https://prasant-bhattarai.com.np">Prasant Bhattarai</a>.
                    </p>
                </div>
            </main>
        </Layout>
    );
};

export default Disclaimer;