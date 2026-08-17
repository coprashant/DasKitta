import { SITE_URL, SITE_NAME, DEFAULT_DESCRIPTION } from "./SEO";

export const HOME_JSONLD = {
    "@context": "https://schema.org",
    "@graph": [
        {
            "@type": "WebSite",
            "@id": `${SITE_URL}/#website`,
            url: SITE_URL,
            name: SITE_NAME,
            description: DEFAULT_DESCRIPTION,
            inLanguage: "en-NP",
            potentialAction: {
                "@type": "SearchAction",
                target: {
                    "@type": "EntryPoint",
                    urlTemplate: `${SITE_URL}/nepse?q={search_term_string}`,
                },
                "query-input": "required name=search_term_string",
            },
        },
        {
            "@type": "SoftwareApplication",
            "@id": `${SITE_URL}/#app`,
            name: SITE_NAME,
            url: SITE_URL,
            description: DEFAULT_DESCRIPTION,
            applicationCategory: "FinanceApplication",
            operatingSystem: "Web, Android, iOS",
            offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "NPR",
            },
            featureList: [
                "One-click IPO application across multiple Meroshare accounts",
                "Live NEPSE market data and stock prices",
                "IPO allotment result checker",
                "Portfolio tracking",
                "Application history timeline",
            ],
        },
        {
            "@type": "Organization",
            "@id": `${SITE_URL}/#organization`,
            name: SITE_NAME,
            url: SITE_URL,
            logo: {
                "@type": "ImageObject",
                url: `${SITE_URL}/daskitta.png`,
            },
        },
    ],
};

export const NEPSE_JSONLD = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${SITE_URL}/nepse`,
    url: `${SITE_URL}/nepse`,
    name: "NEPSE Live Market Data | DasKitta",
    description:
        "Live Nepal Stock Exchange (NEPSE) index, top gainers, losers, turnover, sector sub-indices, and company stock prices.",
    inLanguage: "en-NP",
    about: {
        "@type": "FinancialProduct",
        name: "Nepal Stock Exchange",
        description: "Primary stock exchange of Nepal providing equity trading.",
    },
    isPartOf: { "@id": `${SITE_URL}/#website` },
};

export const RESULT_CHECKER_JSONLD = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${SITE_URL}/ipo/result`,
    url: `${SITE_URL}/ipo/result`,
    name: "IPO Result Checker | DasKitta",
    description:
        "Check your NEPSE IPO allotment result instantly. Enter your BOID and select the company to see if you were allotted shares.",
    inLanguage: "en-NP",
    isPartOf: { "@id": `${SITE_URL}/#website` },
};

export const companyDetailJsonLd = (symbol, name) => ({
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${SITE_URL}/nepse/company/${symbol}`,
    url: `${SITE_URL}/nepse/company/${symbol}`,
    name: `${name || symbol} Stock Price and Data | DasKitta`,
    description: `Live stock price, market depth, price history, and floorsheet for ${name || symbol} listed on the Nepal Stock Exchange (NEPSE).`,
    inLanguage: "en-NP",
    about: {
        "@type": "Corporation",
        name: name || symbol,
        tickerSymbol: symbol,
        exchange: "Nepal Stock Exchange",
    },
    isPartOf: { "@id": `${SITE_URL}/#website` },
});
