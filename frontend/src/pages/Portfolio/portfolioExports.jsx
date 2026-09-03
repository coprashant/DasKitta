import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { adToBs } from "../../dateUtils";

const BRAND_LOGO_PATH = "/favicon.png";

const PDF_THEME = {
    accent: [30, 111, 181],
    accentDark: [22, 95, 160],
    surfaceBlue: [232, 240, 249],
    border: [200, 217, 238],
    text: [20, 28, 40],
    textSoft: [61, 79, 106],
    footerText: [90, 116, 153],
};

let brandLogoDataUrl = null;

const blobToDataUrl = (blob) =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });

const getBrandLogoData = async () => {
    if (brandLogoDataUrl) return brandLogoDataUrl;

    try {
        const res = await fetch(BRAND_LOGO_PATH, { cache: "force-cache" });
        if (!res.ok) throw new Error("logo fetch failed");
        const blob = await res.blob();
        const dataUrl = await blobToDataUrl(blob);
        brandLogoDataUrl = dataUrl;
        return dataUrl;
    } catch {
        return null;
    }
};

export const exportPortfolioCSV = ({ items, activeAccount }) => {
    if (!items?.length) return;

    try {
        const headers = ["Scrip", "Description", "Units", "LTP", "Prev Close", "LTP Value", "Prev Value"];
        const rows = items.map((it) => [
            it.script ?? "",
            it.scriptDesc ?? "",
            it.currentBalance ?? "",
            it.lastTransactionPrice ?? "",
            it.previousClosingPrice ?? "",
            it.valueAsOfLTP ?? "",
            it.valueAsOfPrevClose ?? "",
        ]);

        const csv = [headers, ...rows]
            .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
            .join("\n");

        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        const stamp = new Date().toISOString().slice(0, 10);
        const who = (activeAccount?.fullName || "portfolio").replace(/\s+/g, "_");
        a.href = url;
        a.download = `${who}_${stamp}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    } catch {
        // export is best effort, fail silently rather than break the page
    }
};

export const exportPortfolioPDF = async ({ items, activeAccount, portfolio, totalPnL, fmt, fmtUnits }) => {
    if (!items?.length) return;

    try {
        const now = new Date();
        const stamp = now.toISOString().slice(0, 10);
        const stampCompact = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
        const timeCompact = `${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
        const reportId = `DK-PORT-${stampCompact}-${timeCompact}`;
        const nptDateParts = new Intl.DateTimeFormat("en-GB", {
            timeZone: "Asia/Kathmandu",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        })
            .formatToParts(now)
            .reduce((acc, part) => {
                if (part.type === "year" || part.type === "month" || part.type === "day") {
                    acc[part.type] = part.value;
                }
                return acc;
            }, {});
        const adDateShort = `${nptDateParts.year}-${nptDateParts.month}-${nptDateParts.day}`;
        const nptDateForBs = new Date(
            Number(nptDateParts.year),
            Number(nptDateParts.month) - 1,
            Number(nptDateParts.day),
        );
        const bsDate = adToBs(nptDateForBs);
        const bsDateShort = `${bsDate.year}-${String(bsDate.month).padStart(2, "0")}-${String(bsDate.day).padStart(2, "0")}`;
        const issuedDateDual = `${bsDateShort} BS | ${adDateShort} AD`;
        const generatedAtNptTime = new Intl.DateTimeFormat("en-GB", {
            timeZone: "Asia/Kathmandu",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
        }).format(now);
        const generatedAtLocal = now.toLocaleString("en-NP", {
            timeZone: "Asia/Kathmandu",
            year: "numeric",
            month: "short",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
        });
        const generatedAtIso = now.toISOString();
        const logoData = await getBrandLogoData();

        const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        const drawPageChrome = () => {
            doc.setFillColor(...PDF_THEME.surfaceBlue);
            doc.rect(0, 0, pageWidth, 66, "F");
            doc.setFillColor(...PDF_THEME.accent);
            doc.rect(0, 0, pageWidth, 8, "F");

            if (logoData) {
                doc.addImage(logoData, "PNG", 40, 18, 30, 30, undefined, "FAST");
            }

            doc.setTextColor(...PDF_THEME.text);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(16);
            doc.text("DasKitta", 78, 34);

            doc.setFontSize(10.5);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(...PDF_THEME.textSoft);
            doc.text("Portfolio Statement", 78, 48);

            doc.setTextColor(...PDF_THEME.accentDark);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(11.5);
            doc.text("Official Account Holding Report", pageWidth - 40, 34, { align: "right" });

            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.text(`Report ID: ${reportId}`, pageWidth - 40, 48, { align: "right" });

            doc.setDrawColor(...PDF_THEME.border);
            doc.line(40, pageHeight - 44, pageWidth - 40, pageHeight - 44);

            doc.setTextColor(...PDF_THEME.footerText);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8.8);
            doc.text("DasKitta Portfolio System", 40, pageHeight - 28);
            doc.text(`Date: ${issuedDateDual} | Time: ${generatedAtNptTime} NPT`, pageWidth / 2, pageHeight - 28, {
                align: "center",
            });
            doc.text(`Page ${doc.getNumberOfPages()}`, pageWidth - 40, pageHeight - 28, { align: "right" });
        };

        drawPageChrome();

        doc.setTextColor(...PDF_THEME.text);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text("Document Information", 40, 88);

        doc.setDrawColor(...PDF_THEME.border);
        doc.setFillColor(248, 251, 255);
        doc.roundedRect(40, 96, pageWidth - 80, 56, 4, 4, "FD");

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9.5);
        doc.setTextColor(...PDF_THEME.textSoft);
        doc.text(`Issued Date (BS | AD): ${issuedDateDual}`, 52, 116);
        doc.text(`Issued At (NPT): ${generatedAtLocal} UTC+05:45`, 52, 131);
        doc.text(`Account Holder: ${activeAccount?.fullName || "N/A"}`, 430, 116);
        doc.text(`Account ID: ${activeAccount?.id ?? "N/A"}`, 430, 131);
        doc.text(`Total Holdings: ${items.length}`, pageWidth - 52, 116, { align: "right" });

        autoTable(doc, {
            startY: 162,
            margin: { left: 40, right: 40, bottom: 58 },
            head: [["SN", "Scrip", "Description", "Units", "LTP", "Prev Close", "LTP Value", "Prev Value"]],
            body: items.map((it, idx) => [
                idx + 1,
                it.script ?? "",
                it.scriptDesc ?? "",
                fmtUnits(it.currentBalance),
                fmt(it.lastTransactionPrice),
                fmt(it.previousClosingPrice),
                fmt(it.valueAsOfLTP),
                fmt(it.valueAsOfPrevClose),
            ]),
            theme: "grid",
            styles: { fontSize: 8.2, cellPadding: 4.5, lineColor: PDF_THEME.border, textColor: PDF_THEME.textSoft },
            headStyles: {
                fillColor: PDF_THEME.accent,
                textColor: 255,
                fontStyle: "bold",
            },
            alternateRowStyles: { fillColor: [246, 250, 255] },
            didDrawPage: () => {
                drawPageChrome();
            },
        });

        let finalY = doc.lastAutoTable?.finalY ?? 148;
        const needsNewPage = finalY > pageHeight - 190;
        if (needsNewPage) {
            doc.addPage();
            drawPageChrome();
            finalY = 82;
        }

        const summaryTop = finalY + 18;
        doc.setDrawColor(...PDF_THEME.border);
        doc.setFillColor(248, 251, 255);
        doc.roundedRect(40, summaryTop, pageWidth - 80, 104, 6, 6, "FD");
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...PDF_THEME.accentDark);
        doc.setFontSize(10.5);
        doc.text("Portfolio Summary", 52, summaryTop + 18);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(...PDF_THEME.text);
        doc.text(`Total LTP Value: Rs ${fmt(portfolio?.totalValueLTP)}`, 52, summaryTop + 40);
        doc.text(`Total Previous Close Value: Rs ${fmt(portfolio?.totalValuePrevClose)}`, 52, summaryTop + 56);
        doc.setTextColor(totalPnL >= 0 ? 22 : 185, totalPnL >= 0 ? 101 : 28, totalPnL >= 0 ? 52 : 28);
        doc.text(
            `Day Change: ${totalPnL >= 0 ? "+" : "-"}Rs ${fmt(Math.abs(totalPnL))}`,
            52,
            summaryTop + 72,
        );

        doc.setDrawColor(...PDF_THEME.border);
        doc.line(52, summaryTop + 82, pageWidth - 52, summaryTop + 82);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.8);
        doc.setTextColor(...PDF_THEME.textSoft);
        doc.text(
            "Certification: This statement is system-generated by DasKitta and is valid for record-keeping without physical signature.",
            52,
            summaryTop + 98,
        );
        doc.text("Authorized By: DasKitta System", 52, summaryTop + 116);
        doc.text("Verified Electronically", pageWidth - 52, summaryTop + 116, { align: "right" });

        const who = (activeAccount?.fullName || "portfolio").replace(/\s+/g, "_");
        doc.save(`${who}_${stamp}_${timeCompact}.pdf`);
    } catch {
        // export is best effort, fail silently rather than break the page
    }
};