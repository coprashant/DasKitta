import { Helmet } from "react-helmet-async";

const SITE_NAME = "DasKitta";
const SITE_URL = "https://daskitta.prasant-bhattarai.com.np";
const DEFAULT_IMAGE = `${SITE_URL}/daskitta.png`;
const DEFAULT_DESCRIPTION =
    "Apply for NEPSE IPOs across all your Meroshare accounts in one click. Track your stock portfolio, check IPO allotment results, and monitor live Nepal stock market data — free and fast.";

const SEO = ({
    title,
    description = DEFAULT_DESCRIPTION,
    canonical,
    image = DEFAULT_IMAGE,
    noindex = false,
    type = "website",
    jsonLd,
}) => {
    const fullTitle = title
        ? `${title} | ${SITE_NAME}`
        : `${SITE_NAME} — Nepal IPO and NEPSE Tracker`;
    const canonicalUrl = canonical ? `${SITE_URL}${canonical}` : null;

    return (
        <Helmet>
            <title>{fullTitle}</title>
            <meta name="description" content={description} />
            {noindex
                ? <meta name="robots" content="noindex, nofollow" />
                : <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
            }
            {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}

            {/* Open Graph */}
            <meta property="og:type" content={type} />
            <meta property="og:title" content={fullTitle} />
            <meta property="og:description" content={description} />
            <meta property="og:image" content={image} />
            <meta property="og:image:width" content="1200" />
            <meta property="og:image:height" content="630" />
            <meta property="og:image:alt" content={`${SITE_NAME} — Nepal IPO and NEPSE Tracker`} />
            {canonicalUrl && <meta property="og:url" content={canonicalUrl} />}
            <meta property="og:site_name" content={SITE_NAME} />
            <meta property="og:locale" content="en_NP" />

            {/* Twitter Card */}
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:title" content={fullTitle} />
            <meta name="twitter:description" content={description} />
            <meta name="twitter:image" content={image} />
            <meta name="twitter:image:alt" content={`${SITE_NAME} — Nepal IPO and NEPSE Tracker`} />

            {/* JSON-LD Structured Data */}
            {jsonLd && (
                <script type="application/ld+json">
                    {JSON.stringify(jsonLd)}
                </script>
            )}
        </Helmet>
    );
};

export { SITE_URL, SITE_NAME, DEFAULT_DESCRIPTION };
export default SEO;
