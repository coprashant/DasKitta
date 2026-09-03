import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const BRAND_LOGO_PATH = "/favicon.png";

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
            doc.setFillColor(16, 139, 85);
            doc.rect(0, 0, pageWidth, 58, "F");

            if (logoData) {
                doc.addImage(logoData, "PNG", pageWidth - 94, 10, 38, 38, undefined, "FAST");
            }

            doc.setTextColor(255, 255, 255);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(16);
            doc.text("DasKitta", 40, 29);
            doc.setFontSize(10.5);
            doc.setFont("helvetica", "normal");
            doc.text("Official Portfolio Statement", 40, 45);

            doc.setDrawColor(214, 219, 224);
            doc.line(40, pageHeight - 44, pageWidth - 40, pageHeight - 44);

            doc.setTextColor(90, 100, 112);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.text("DasKitta Portfolio System", 40, pageHeight - 28);
            doc.text(`Report ID: ${reportId}`, pageWidth / 2, pageHeight - 28, { align: "center" });
            doc.text(`Page ${doc.getNumberOfPages()}`, pageWidth - 40, pageHeight - 28, { align: "right" });
        };

        drawPageChrome();

        doc.setTextColor(45, 55, 72);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text("Document Information", 40, 84);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9.5);
        doc.text(`Report ID: ${reportId}`, 40, 101);
        doc.text(`Issued At (NPT): ${generatedAtLocal} UTC+05:45`, 40, 116);
        doc.text(`Issued At (ISO): ${generatedAtIso}`, 40, 131);
        doc.text(`Account Holder: ${activeAccount?.fullName || "N/A"}`, 420, 101);
        doc.text(`Account ID: ${activeAccount?.id ?? "N/A"}`, 420, 116);
        doc.text(`Total Holdings: ${items.length}`, 420, 131);

        autoTable(doc, {
            startY: 148,
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
            styles: { fontSize: 8.2, cellPadding: 4.5, lineColor: [230, 233, 237] },
            headStyles: {
                fillColor: [15, 23, 42],
                textColor: 255,
                fontStyle: "bold",
            },
            alternateRowStyles: { fillColor: [247, 250, 252] },
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
        doc.setDrawColor(204, 214, 226);
        doc.roundedRect(40, summaryTop, pageWidth - 80, 92, 6, 6, "S");
        doc.setFont("helvetica", "bold");
        doc.setTextColor(31, 41, 55);
        doc.setFontSize(10.5);
        doc.text("Portfolio Summary", 52, summaryTop + 18);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.text(`Total LTP Value: Rs ${fmt(portfolio?.totalValueLTP)}`, 52, summaryTop + 40);
        doc.text(`Total Previous Close Value: Rs ${fmt(portfolio?.totalValuePrevClose)}`, 52, summaryTop + 56);
        doc.text(
            `Day Change: ${totalPnL >= 0 ? "+" : "-"}Rs ${fmt(Math.abs(totalPnL))}`,
            52,
            summaryTop + 72,
        );

        doc.setFont("helvetica", "italic");
        doc.setFontSize(9);
        doc.setTextColor(95, 105, 118);
        doc.text(
            "Certification: This document was system-generated by DasKitta and can be printed for records.",
            40,
            summaryTop + 114,
        );
        doc.text("Authorized By: DasKitta System", 40, summaryTop + 134);
        doc.text("Signature: _________________________", pageWidth - 260, summaryTop + 134);

        const who = (activeAccount?.fullName || "portfolio").replace(/\s+/g, "_");
        doc.save(`${who}_${stamp}_${timeCompact}.pdf`);
    } catch {
        // export is best effort, fail silently rather than break the page
    }
};