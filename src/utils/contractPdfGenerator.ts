import type { Contract } from "@/api/requests/contractsService";

interface PDFGeneratorOptions {
    contract: Contract;
    clientName: string;
    lang: "ar" | "en";
    t: (key: string) => string;
}

export const generateContractPDF = async ({ contract, clientName, lang }: PDFGeneratorOptions) => {
    try {
        console.log("Starting PDF generation...", { lang, clientName });

        const isRTL = lang === "ar";
        const startDate = new Date(contract.startDate).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US");
        const endDate = new Date(contract.endDate).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US");

        // Get terms in the order they were arranged
        const terms = (contract.terms || []).sort((a: any, b: any) => {
            const orderA = typeof a.order === "number" ? a.order : 999;
            const orderB = typeof b.order === "number" ? b.order : 999;
            return orderA - orderB;
        });

        // Build terms HTML
        const termsHTML = terms
            .map((termItem: any, index: number) => {
                let termKey = "";
                let termValue = "";
                let termKeyAr = "";
                let termValueAr = "";

                if (termItem.isCustom) {
                    termKey = termItem.customKey || "";
                    termKeyAr = termItem.customKeyAr || "";
                    termValue = termItem.customValue || "";
                    termValueAr = termItem.customValueAr || "";
                } else {
                    const term = termItem.term;
                    if (term) {
                        termKey = term.key || "";
                        termKeyAr = term.keyAr || "";
                        termValue = term.value || "";
                        termValueAr = term.valueAr || "";
                    }
                }

                const displayKey = lang === "ar" ? termKeyAr : termKey;
                const displayValue = lang === "ar" ? termValueAr : termValue;

                if (!displayKey && !displayValue) return "";

                return `
                    <div class="term-item">
                        <div class="term-number">${lang === "ar" ? `البند رقم ${index + 1}:` : `Term ${index + 1}:`}</div>
                        ${displayKey ? `<div class="term-key">${displayKey}</div>` : ""}
                        ${displayValue ? `<div class="term-value">${displayValue}</div>` : ""}
                    </div>
                `;
            })
            .join("");

        const htmlContent = `
<!DOCTYPE html>
<html dir="${isRTL ? "rtl" : "ltr"}" lang="${lang}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Cairo', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            font-size: 12pt;
            line-height: 1.6;
            color: #333;
            direction: ${isRTL ? "rtl" : "ltr"};
        }

        @page {
            size: A4;
            margin: 20mm;
        }

        .page {
            background: white;
            padding: 0;
            margin: 0;
        }

        .header {
            background: #dc2626;
            color: white;
            padding: 30px 40px;
            margin-bottom: 30px;
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
        }

        .company-info {
            flex: 1;
        }

        .company-name {
            font-size: 28pt;
            font-weight: 700;
            margin-bottom: 5px;
        }

        .company-subtitle {
            font-size: 11pt;
            margin-bottom: 10px;
            opacity: 0.95;
        }

        .company-contact {
            font-size: 9pt;
            opacity: 0.9;
            line-height: 1.4;
        }

        .contract-info {
            text-align: ${isRTL ? "left" : "right"};
        }

        .contract-title-main {
            font-size: 20pt;
            font-weight: 700;
            text-align: center;
            margin: 30px 0;
            color: #333;
        }

        .party-box {
            background: #f5f5f5;
            border: 1px solid #c8c8c8;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
        }

        .party-label {
            font-size: 12pt;
            font-weight: 700;
            margin-bottom: 10px;
            color: #333;
        }

        .party-details {
            font-size: 10pt;
            line-height: 1.8;
            color: #4a5568;
        }

        .intro-text {
            margin: 25px 0;
            padding: 0 20px;
            font-size: 11pt;
            line-height: 1.8;
        }

        .terms-section {
            margin: 30px 0;
        }

        .section-title {
            font-size: 13pt;
            font-weight: 700;
            margin-bottom: 20px;
            color: #333;
        }

        .term-item {
            margin-bottom: 20px;
            page-break-inside: avoid;
        }

        .term-number {
            font-size: 11pt;
            font-weight: 700;
            margin-bottom: 8px;
            color: #dc2626;
        }

        .term-key {
            font-size: 11pt;
            font-weight: 600;
            margin-bottom: 6px;
            color: #333;
            padding: 0 10px;
        }

        .term-value {
            font-size: 10pt;
            line-height: 1.7;
            color: #4a5568;
            padding: 0 10px;
        }

        .divider {
            border: 0;
            border-top: 1px solid #c8c8c8;
            margin: 25px 0;
        }

        .contract-details {
            margin: 25px 0;
            padding: 15px 20px;
        }

        .detail-row {
            margin: 8px 0;
            font-size: 10pt;
        }

        .validation-note {
            margin: 15px 0;
            padding: 0 20px;
            font-size: 9pt;
            color: #666;
            font-style: italic;
        }

        .signature-section {
            margin-top: 40px;
            page-break-inside: avoid;
        }

        .signature-row {
            display: flex;
            justify-content: space-between;
            margin-top: 20px;
        }

        .signature-box {
            text-align: center;
            flex: 1;
            padding: 0 30px;
        }

        .signature-label {
            font-weight: 700;
            margin-bottom: 30px;
            font-size: 11pt;
        }

        .signature-line {
            border-top: 1px solid #333;
            width: 200px;
            margin: 0 auto;
        }

        .footer {
            margin-top: 50px;
            text-align: center;
            font-size: 9pt;
            color: #999;
        }

        @media print {
            body {
                print-color-adjust: exact;
                -webkit-print-color-adjust: exact;
            }
            
            .header {
                background: #dc2626 !important;
                color: white !important;
            }

            .page-break {
                page-break-before: always;
            }

            .no-break {
                page-break-inside: avoid;
            }
        }
    </style>
</head>
<body>
    <div class="page">
        <div class="header">
            <div class="company-info">
                <div class="company-name">${lang === "ar" ? "صابر جروب" : "SABER GROUP"}</div>
                <div class="company-subtitle">${lang === "ar" ? "وكالة تسويق" : "MARKETING AGENCY"}</div>
                <div class="company-contact">
                    <div>${lang === "ar" ? "٨ شارع الحمزاوي, النادي طنطا الغربيه" : "8 Elhamzawy St, Elnady, Tanta-Elghabria"}</div>
                    <div>01553596428</div>
                    <div>info@sabergroup-eg.com</div>
                </div>
            </div>
            <div class="contract-info">
                <div style="font-size: 16pt; font-weight: 700; margin-bottom: 5px;">${lang === "ar" ? "عقد" : "CONTRACT"}</div>
                <div style="font-size: 11pt;">${(contract as any).contractNumber || contract._id.slice(-6)}</div>
            </div>
        </div>

        <div class="contract-title-main">
            ${lang === "ar" ? "عقد اتفاقية تقديم خدمات إدارة منصات التواصل الاجتماعي" : "Social Media Management Services Agreement"}
        </div>

        <div class="terms-section">
            <div class="section-title">${lang === "ar" ? "بنود العقد:" : "Contract Terms:"}</div>
            ${termsHTML}
        </div>

        <hr class="divider">

        <div class="contract-details no-break">
            <div class="section-title">${lang === "ar" ? "تفاصيل العقد:" : "Contract Details:"}</div>
            <div class="detail-row"><strong>${lang === "ar" ? "تاريخ البدء:" : "Start Date:"}</strong> ${startDate}</div>
            <div class="detail-row"><strong>${lang === "ar" ? "تاريخ الانتهاء:" : "End Date:"}</strong> ${endDate}</div>
        </div>

       

        <hr class="divider">

        <div class="signature-section no-break">
            <div class="signature-row">
                <div class="signature-box">
                    <div class="signature-label">${lang === "ar" ? "توقيع الطرف الأول" : "First Party Signature"}</div>
                    <div class="signature-line"></div>
                </div>
                <div class="signature-box">
                    <div class="signature-label">${lang === "ar" ? "توقيع الطرف الثاني" : "Second Party Signature"}</div>
                    <div class="signature-line"></div>
                </div>
            </div>
        </div>

        <div class="footer">
            ${lang === "ar" ? "شكراً لثقتكم بنا" : "Thank you for your business"}
        </div>
    </div>
</body>
</html>
        `;

        // Create a new window with the HTML content
        const printWindow = window.open("", "_blank");
        if (!printWindow) {
            throw new Error("Pop-up blocked. Please allow pop-ups for this site.");
        }

        printWindow.document.write(htmlContent);
        printWindow.document.close();

        // Wait for content to load
        return new Promise((resolve) => {
            printWindow.onload = () => {
                setTimeout(() => {
                    printWindow.print();
                    // Close window after printing (user can cancel)
                    setTimeout(() => {
                        printWindow.close();
                        resolve(true);
                    }, 500);
                }, 500);
            };
        });
    } catch (error) {
        console.error("Error generating contract PDF:", error);
        console.error("Error details:", error instanceof Error ? error.message : String(error));
        throw error;
    }
};
