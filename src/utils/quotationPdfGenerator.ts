// utils/quotationPdfGenerator.ts

interface QuotationPDFOptions {
    quotation: any;
    clientName: string;
    lang: "ar" | "en";
    t: (key: string, fallback: string) => string;
    items?: any[];
}

export const generateQuotationPDF = async ({ quotation, clientName, lang, items = [] }: QuotationPDFOptions): Promise<string> => {
    const isRTL = lang === "ar";
    const dateStr = quotation.createdAt ? new Date(quotation.createdAt).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US") : "";
    const validUntilStr = quotation.validUntil ? new Date(quotation.validUntil).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US") : "";

    // Helper function to safely escape HTML
    const escapeHtml = (text: string) => {
        if (!text) return "";
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    };

    // Helper function to get localized name
    const getLocalizedName = (obj: any) => {
        if (!obj) return "";
        if (lang === "ar") {
            return obj.nameAr || obj.ar || obj.name || obj.nameEn || obj.en || "";
        }
        return obj.nameEn || obj.en || obj.name || obj.nameAr || obj.ar || "";
    };

    // Helper function to find item by ID
    const findItemById = (itemId: string) => {
        return items.find((i: any) => String(i._id) === String(itemId) || String(i.id) === String(itemId));
    };

    // Helper function to get item name
    const getItemName = (item: any) => {
        if (item.name) return getLocalizedName(item) || item.name;
        if (item.item) {
            if (typeof item.item === 'object') {
                return getLocalizedName(item.item) || item.item.name || "(item)";
            }
            if (typeof item.item === 'string') {
                const found = findItemById(item.item);
                if (found) return getLocalizedName(found) || found.name || "(item)";
                return `Item ${item.item.slice(-6)}`;
            }
        }
        return "(item)";
    };

    // Helper function to format quantity display
    const formatQuantityDisplay = (quantity: any) => {
        if (quantity === undefined || quantity === null) return "";
        if (typeof quantity === 'boolean') {
            return quantity ? " ✓" : "";
        }
        if (typeof quantity === 'number') {
            return ` ×${quantity}`;
        }
        if (typeof quantity === 'string') {
            if (quantity.includes('%')) return ` (${quantity})`;
            const num = parseFloat(quantity);
            if (!isNaN(num)) return ` ×${num}`;
            return ` (${quantity})`;
        }
        return "";
    };

    const currency = lang === "ar" ? "ج.م" : "EGP";

    // Build items/services HTML
    let itemsHTML = "";
    let itemNumber = 1;

    // Process packages
    if (quotation.packages && quotation.packages.length > 0) {
        for (const pkg of quotation.packages) {
            if (pkg.deleted === true) continue;
            
            const packageName = getLocalizedName(pkg) || pkg.name || "Package";
            const packagePrice = pkg.price || 0;
            
            // Main package row
            itemsHTML += `
                <tr style="background-color: #e8f5e9;">
                    <td style="padding: 10px 8px; text-align: center; border: 1px solid #c8e6c9; vertical-align: top; font-weight: bold;">${itemNumber++}</td>
                    <td style="padding: 10px 8px; border: 1px solid #c8e6c9; vertical-align: top;">
                        <strong style="color: #2e7d32;">${escapeHtml(packageName)}</strong>
                        <div style="font-size: 8pt; color: #666; margin-top: 2px;">📦 Package</div>
                    </td>
                    <td style="padding: 10px 8px; text-align: right; border: 1px solid #c8e6c9; vertical-align: top;">${packagePrice.toFixed(2)} ${currency}</td>
                    <td style="padding: 10px 8px; text-align: center; border: 1px solid #c8e6c9; vertical-align: top;">1</td>
                    <td style="padding: 10px 8px; text-align: right; border: 1px solid #c8e6c9; vertical-align: top; font-weight: 500;">${packagePrice.toFixed(2)} ${currency}</td>
                </tr>
            `;
            
            // Package items as detailed list
            if (pkg.items && pkg.items.length > 0) {
                itemsHTML += `
                    <tr>
                        <td colspan="5" style="padding: 0; border: none;">
                            <div style="background-color: #f9f9f9; padding: 10px 15px 10px 25px; margin: 0; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 4px 4px;">
                                <div style="font-size: 9pt; color: #2e7d32; font-weight: 600; margin-bottom: 8px;">📋 Package Includes:</div>
                                <div style="display: flex; flex-wrap: wrap; gap: 6px 15px;">
                `;
                
                for (const it of pkg.items) {
                    const itemName = getItemName(it);
                    const quantityText = formatQuantityDisplay(it.quantity);
                    const itemNote = it.note || "";
                    const cleanNote = itemNote ? itemNote.replace(/[���]/g, '') : '';
                    
                    itemsHTML += `
                        <div style="font-size: 9pt; color: #333; min-width: 180px;">
                            <span style="color: #4caf50;">✓</span> ${escapeHtml(itemName)}${quantityText}
                            ${cleanNote ? `<span style="color: #ff9800; font-size: 8pt;"> (${escapeHtml(cleanNote)})</span>` : ''}
                        </div>
                    `;
                }
                
                itemsHTML += `
                                </div>
                            </div>
                        </td>
                    </tr>
                `;
            }
        }
    }

    // Process services pricing
    if (quotation.servicesPricing && quotation.servicesPricing.length > 0) {
        for (const sp of quotation.servicesPricing) {
            const service = sp.service;
            if (!service) continue;
            
            let serviceName = "";
            let price = sp.customPrice || 0;
            
            if (typeof service === 'object' && service !== null) {
                serviceName = getLocalizedName(service) || "Service";
                if (!price) price = service.price || 0;
            } else if (typeof service === 'string') {
                serviceName = `Service ${service.slice(-6)}`;
            }
            
            itemsHTML += `
                <tr>
                    <td style="padding: 10px 8px; text-align: center; border: 1px solid #e0e0e0; vertical-align: top;">${itemNumber++}</td>
                    <td style="padding: 10px 8px; border: 1px solid #e0e0e0; vertical-align: top;">
                        <strong>${escapeHtml(serviceName)}</strong>
                        <div style="font-size: 8pt; color: #666; margin-top: 2px;">🔧 Individual Service</div>
                    </td>
                    <td style="padding: 10px 8px; text-align: right; border: 1px solid #e0e0e0; vertical-align: top;">${price.toFixed(2)} ${currency}</td>
                    <td style="padding: 10px 8px; text-align: center; border: 1px solid #e0e0e0; vertical-align: top;">1</td>
                    <td style="padding: 10px 8px; text-align: right; border: 1px solid #e0e0e0; vertical-align: top; font-weight: 500;">${price.toFixed(2)} ${currency}</td>
                </tr>
            `;
        }
    }

    // Process custom services
    if (quotation.customServices && quotation.customServices.length > 0) {
        for (const cs of quotation.customServices) {
            let finalPrice = cs.price;
            let discountText = "";
            const serviceName = lang === "ar" ? cs.ar : cs.en;
            
            if (cs.discount && cs.discount > 0) {
                if (cs.discountType === "percentage") {
                    const discountAmt = (cs.price * cs.discount) / 100;
                    finalPrice = cs.price - discountAmt;
                    discountText = `(${cs.discount}% off)`;
                } else {
                    finalPrice = cs.price - cs.discount;
                    discountText = `(-${cs.discount} ${currency})`;
                }
            }
            
            itemsHTML += `
                <tr>
                    <td style="padding: 10px 8px; text-align: center; border: 1px solid #e0e0e0; vertical-align: top;">${itemNumber++}</td>
                    <td style="padding: 10px 8px; border: 1px solid #e0e0e0; vertical-align: top;">
                        <strong>${escapeHtml(serviceName)}</strong>
                        <div style="font-size: 8pt; color: #666; margin-top: 2px;">✨ Custom Service ${discountText}</div>
                    </td>
                    <td style="padding: 10px 8px; text-align: right; border: 1px solid #e0e0e0; vertical-align: top;">${cs.price.toFixed(2)} ${currency}</td>
                    <td style="padding: 10px 8px; text-align: center; border: 1px solid #e0e0e0; vertical-align: top;">1</td>
                    <td style="padding: 10px 8px; text-align: right; border: 1px solid #e0e0e0; vertical-align: top; font-weight: 500;">${finalPrice.toFixed(2)} ${currency}</td>
                </tr>
            `;
        }
    }

    // Empty state
    if (itemsHTML === "") {
        itemsHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 30px; border: 1px solid #e0e0e0;">${lang === "ar" ? "لا توجد خدمات" : "No services"}</td>
            </tr>
        `;
    }

    // Calculate discount amount
    let discountAmount = 0;
    if (quotation.discountValue > 0) {
        if (quotation.discountType === "percentage") {
            discountAmount = (quotation.subtotal * quotation.discountValue) / 100;
        } else {
            discountAmount = quotation.discountValue;
        }
    }

    // Clean up notes
    const cleanMainNote = quotation.note ? quotation.note.replace(/[���]/g, '') : '';

    const htmlContent = `<!DOCTYPE html>
<html dir="${isRTL ? "rtl" : "ltr"}" lang="${lang}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Quotation - ${quotation.quotationNumber || ""}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: ${isRTL ? "'Segoe UI', 'Tahoma', Arial, sans-serif" : "'Segoe UI', Arial, sans-serif"};
            font-size: 10pt;
            line-height: 1.4;
            color: #333;
            direction: ${isRTL ? "rtl" : "ltr"};
            padding: 0;
            margin: 0;
            background: white;
        }

        .pdf-container {
            max-width: 210mm;
            margin: 0 auto;
            background: white;
            padding: 12mm 10mm;
        }

        /* Header */
        .header {
            background: #dc2626;
            color: white;
            padding: 15px 20px;
            margin-bottom: 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 10px;
            border-radius: 4px;
        }

        .company-name {
            font-size: 20pt;
            font-weight: 800;
            letter-spacing: 1px;
        }

        .company-subtitle {
            font-size: 9pt;
            opacity: 0.9;
            margin-top: 4px;
        }

        .quotation-title {
            font-size: 16pt;
            font-weight: 700;
            text-align: center;
            margin: 20px 0;
            color: #dc2626;
        }

        /* Client Box */
        .party-box {
            background: #f5f5f5;
            border: 1px solid #e0e0e0;
            border-radius: 4px;
            padding: 12px 15px;
            margin: 15px 0;
        }

        .party-label {
            font-size: 10pt;
            font-weight: 700;
            margin-bottom: 5px;
            color: #555;
        }

        .party-details {
            font-size: 11pt;
            color: #333;
            font-weight: 500;
        }

        /* Table */
        .items-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            font-size: 9pt;
        }

        .items-table th {
            background: #dc2626;
            color: white;
            padding: 10px 8px;
            font-weight: 700;
            font-size: 10pt;
            border: 1px solid #b91c1c;
            text-align: center;
        }

        .items-table th:first-child {
            border-top-left-radius: 4px;
        }

        .items-table th:last-child {
            border-top-right-radius: 4px;
        }

        .items-table td {
            padding: 10px 8px;
            border: 1px solid #e0e0e0;
            vertical-align: top;
        }

        /* Summary Section */
        .summary-section {
            margin: 20px 0;
            padding: 15px 20px;
            background: #fafafa;
            border-radius: 4px;
            text-align: right;
            border: 1px solid #e0e0e0;
        }

        .summary-row {
            margin: 6px 0;
            font-size: 10pt;
        }

        .total-row {
            font-size: 13pt;
            font-weight: 800;
            color: #dc2626;
            margin-top: 10px;
            padding-top: 8px;
            border-top: 2px solid #ddd;
        }

        /* Notes Section */
        .notes-section {
            margin: 20px 0;
            padding: 12px 15px;
            background: #fff8e1;
            border-left: 4px solid #ff9800;
            border-radius: 4px;
        }

        .notes-title {
            font-size: 10pt;
            font-weight: 700;
            margin-bottom: 6px;
            color: #ff9800;
        }

        .notes-content {
            font-size: 9pt;
            color: #555;
            white-space: pre-wrap;
            word-break: break-word;
            line-height: 1.5;
        }

        /* Validity */
        .validity-section {
            margin: 20px 0;
            padding: 10px 15px;
            background: #fff3e0;
            border-radius: 4px;
            text-align: center;
            font-size: 9pt;
            border: 1px solid #ffe0b2;
        }

        .validity-section strong {
            color: #e65100;
        }

        /* Footer */
        .footer {
            margin-top: 30px;
            text-align: center;
            font-size: 8pt;
            color: #999;
            border-top: 1px solid #e0e0e0;
            padding-top: 15px;
        }

        /* Print optimization */
        @media print {
            body {
                padding: 0;
                margin: 0;
            }
            .header {
                background: #dc2626 !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }
            .items-table th {
                background: #dc2626 !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }
            tr[style*="background-color"] {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }
            .summary-section {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }
            .notes-section {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }
            .validity-section {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }
        }
    </style>
</head>
<body>
    <div class="pdf-container">
        <!-- Header -->
        <div class="header">
            <div>
                <div class="company-name">${lang === "ar" ? "صابر جروب" : "SABER GROUP"}</div>
                <div class="company-subtitle">${lang === "ar" ? "وكالة تسويق" : "MARKETING AGENCY"}</div>
            </div>
            <div style="text-align: right;">
                <div style="font-size: 14pt; font-weight: 800;">${lang === "ar" ? "عرض سعر" : "QUOTATION"}</div>
                <div style="font-size: 10pt; margin-top: 4px;">${quotation.quotationNumber || ""}</div>
                <div style="font-size: 9pt; opacity: 0.9;">${dateStr}</div>
            </div>
        </div>

        <!-- Title -->
        <div class="quotation-title">
            ${lang === "ar" ? "عرض سعر خدمات إدارة منصات التواصل الاجتماعي" : "Social Media Management Services Quotation"}
        </div>

        <!-- Client Info -->
        <div class="party-box">
            <div class="party-label">${lang === "ar" ? "العميل" : "Client"}</div>
            <div class="party-details">${escapeHtml(clientName) || (lang === "ar" ? "غير محدد" : "Not specified")}</div>
        </div>

        <!-- Items Table -->
        <table class="items-table">
            <thead>
                <tr>
                    <th style="width: 5%;">#</th>
                    <th style="width: 55%;">${lang === "ar" ? "الخدمة / الباقة" : "Service / Package"}</th>
                    <th style="width: 15%;">${lang === "ar" ? "السعر" : "Price"}</th>
                    <th style="width: 10%;">${lang === "ar" ? "الكمية" : "Qty"}</th>
                    <th style="width: 15%;">${lang === "ar" ? "الإجمالي" : "Total"}</th>
                </tr>
            </thead>
            <tbody>
                ${itemsHTML}
            </tbody>
        </table>

        <!-- Summary -->
        <div class="summary-section">
            <div class="summary-row">
                <strong>${lang === "ar" ? "المجموع الفرعي:" : "Subtotal:"}</strong> ${(quotation.subtotal || 0).toFixed(2)} ${currency}
            </div>
            ${quotation.discountValue > 0 ? `
            <div class="summary-row">
                <strong>${lang === "ar" ? "الخصم:" : "Discount:"}</strong> 
                ${quotation.discountType === "percentage" ? `${quotation.discountValue}%` : `${quotation.discountValue.toFixed(2)} ${currency}`}
                <span style="color: #dc2626;">(-${discountAmount.toFixed(2)} ${currency})</span>
            </div>
            ` : ''}
            <div class="total-row">
                <strong>${lang === "ar" ? "الإجمالي:" : "Total:"}</strong> ${(quotation.total || 0).toFixed(2)} ${currency}
            </div>
        </div>

        <!-- Validity -->
        ${validUntilStr ? `
        <div class="validity-section">
            <strong>${lang === "ar" ? "صالح حتى:" : "Valid Until:"}</strong> ${validUntilStr}
        </div>
        ` : ''}

        <!-- Notes -->
        ${cleanMainNote ? `
        <div class="notes-section">
            <div class="notes-title">${lang === "ar" ? "ملاحظات:" : "Notes:"}</div>
            <div class="notes-content">${escapeHtml(cleanMainNote).replace(/\n/g, '<br>')}</div>
        </div>
        ` : ''}

        <!-- Footer -->
        <div class="footer">
            ${lang === "ar" ? "شكراً لثقتكم بنا" : "Thank you for your business"}
        </div>
    </div>
</body>
</html>`;

    return htmlContent;
};

export const downloadQuotationPDF = async (htmlContent: string, filename: string): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
        // Create a hidden iframe — completely isolated from your page DOM
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.top = '0';
        iframe.style.left = '0';
        iframe.style.width = '210mm';
        iframe.style.height = '297mm';
        iframe.style.border = 'none';
        iframe.style.visibility = 'hidden';   // hidden but still rendered
        iframe.style.zIndex = '-9999';
        iframe.style.pointerEvents = 'none';
        document.body.appendChild(iframe);

        iframe.onload = async () => {
            try {
                const iframeDoc = iframe.contentDocument!;
                iframeDoc.open();
                iframeDoc.write(htmlContent);
                iframeDoc.close();

                // Wait for fonts/images inside iframe to settle
                await new Promise<void>((r) => setTimeout(r, 500));

                const element = iframeDoc.querySelector('.pdf-container') as HTMLElement;
                if (!element) throw new Error('PDF container not found');

                const html2pdfModule: any = await import('html2pdf.js');
                const html2pdf = html2pdfModule.default || html2pdfModule;

                const opt = {
                    margin: [0.2, 0.2, 0.2, 0.2] as [number, number, number, number],
                    filename,
                    image: { type: 'jpeg', quality: 1 },
                    html2canvas: {
                        scale: 3,
                        useCORS: true,
                        letterRendering: true,
                        logging: false,
                        backgroundColor: '#ffffff',
                        windowWidth: element.scrollWidth,
                        dpi: 300,
                    },
                    jsPDF: {
                        unit: 'in',
                        format: 'a4',
                        orientation: 'portrait',
                    },
                };

                await html2pdf().set(opt).from(element).save();
                resolve();
            } catch (err) {
                reject(err);
            } finally {
                // Always clean up — even on error
                document.body.removeChild(iframe);
            }
        };

        // Trigger the onload
        iframe.src = 'about:blank';
    });
};