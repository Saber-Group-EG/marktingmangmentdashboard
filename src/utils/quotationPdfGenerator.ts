// utils/quotationPdfGenerator.ts

interface QuotationPDFOptions {
    quotation: any;
    clientName: string;
    lang: "ar" | "en";
    t: (key: string, fallback: string) => string; // Updated to include fallback
    items?: any[];
}

export const generateQuotationPDF = async ({ quotation, clientName, lang, items = [] }: QuotationPDFOptions): Promise<Blob> => {
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

    // Build items/services HTML - compact version
    let itemsHTML = "";
    let itemNumber = 1;

    // Helper to add item row
    const addItemRow = (name: string, details: string, quantity: string, price: number, total: number, isPackage: boolean = false) => {
        itemsHTML += `
            <tr style="${isPackage ? 'background-color: #f0fdf4;' : ''}">
                <td style="padding: 6px 8px; text-align: center; font-size: 9pt;">${itemNumber++}</td>
                <td style="padding: 6px 8px;">
                    <strong style="${isPackage ? 'color: #166534;' : ''}">${escapeHtml(name)}</strong>
                    ${details ? `<div style="font-size: 8pt; color: #666; margin-top: 2px;">${escapeHtml(details)}</div>` : ''}
                </td>
                <td style="padding: 6px 8px; text-align: right; font-size: 9pt;">${price > 0 ? `${price.toFixed(2)} ${currency}` : '-'}</td>
                <td style="padding: 6px 8px; text-align: center; font-size: 9pt;">${quantity}</td>
                <td style="padding: 6px 8px; text-align: right; font-size: 9pt; font-weight: 500;">${total > 0 ? `${total.toFixed(2)} ${currency}` : '-'}</td>
            </tr>
        `;
    };

    // Process packages
    if (quotation.packages && quotation.packages.length > 0) {
        for (const pkg of quotation.packages) {
            if (pkg.deleted === true) continue;
            
            const packageName = getLocalizedName(pkg) || pkg.name || "Package";
            const packagePrice = pkg.price || 0;
            
            addItemRow(packageName, `Package`, `1`, packagePrice, packagePrice, true);
            
            // Process package items - compact display
            if (pkg.items && pkg.items.length > 0) {
                for (const it of pkg.items) {
                    const itemName = getItemName(it);
                    const quantityText = formatQuantityDisplay(it.quantity);
                    const itemNote = it.note || "";
                    const cleanNote = itemNote ? itemNote.replace(/[���]/g, '') : '';
                    
                    itemsHTML += `
                        <tr style="background-color: #fafafa;">
                            <td style="padding: 4px 8px; text-align: center; font-size: 8pt;"></td>
                            <td style="padding: 4px 8px; padding-left: 20px; font-size: 8pt; color: #4a5568;">
                                <span style="color: #9ca3af;">↳</span> ${escapeHtml(itemName)}${quantityText}
                                ${cleanNote ? `<div style="font-size: 7pt; color: #f59e0b; margin-top: 2px;">📝 ${escapeHtml(cleanNote)}</div>` : ''}
                            </td>
                            <td style="padding: 4px 8px;"></td>
                            <td style="padding: 4px 8px;"></td>
                            <td style="padding: 4px 8px;"></td>
                        </tr>
                    `;
                }
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
            
            addItemRow(serviceName, `Individual Service`, `1`, price, price);
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
            
            addItemRow(serviceName, `Custom Service ${discountText}`, `1`, cs.price, finalPrice);
        }
    }

    // Empty state
    if (itemsHTML === "") {
        itemsHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 20px; font-size: 10pt;">${lang === "ar" ? "لا توجد خدمات" : "No services"}</td>
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
    <title>Quotation - ${quotation.quotationNumber || ""}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700&display=swap');
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Cairo', 'Segoe UI', Arial, sans-serif;
            font-size: 10pt;
            line-height: 1.4;
            color: #333;
            direction: ${isRTL ? "rtl" : "ltr"};
            padding: 10mm;
        }

        @page {
            size: A4;
            margin: 10mm;
        }

        .page {
            max-width: 100%;
        }

        /* Header - Compact */
        .header {
            background: #dc2626;
            color: white;
            padding: 12px 16px;
            margin-bottom: 15px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 10px;
            border-radius: 6px;
        }

        .company-name {
            font-size: 16pt;
            font-weight: 700;
        }

        .company-subtitle {
            font-size: 8pt;
            opacity: 0.9;
        }

        .company-contact {
            font-size: 7pt;
            opacity: 0.85;
        }

        .quotation-title {
            font-size: 14pt;
            font-weight: 700;
            text-align: center;
            margin: 10px 0;
            color: #dc2626;
        }

        /* Party Box - Compact */
        .party-box {
            background: #f5f5f5;
            border: 1px solid #e0e0e0;
            border-radius: 6px;
            padding: 10px 12px;
            margin: 10px 0;
        }

        .party-label {
            font-size: 9pt;
            font-weight: 700;
            margin-bottom: 4px;
        }

        .party-details {
            font-size: 9pt;
            color: #4a5568;
        }

        /* Table - Compact */
        .items-table {
            width: 100%;
            border-collapse: collapse;
            margin: 12px 0;
            font-size: 9pt;
        }

        .items-table th {
            background: #dc2626;
            color: white;
            padding: 8px 6px;
            font-weight: 600;
            font-size: 9pt;
            border: 1px solid #b91c1c;
        }

        .items-table td {
            padding: 6px;
            border: 1px solid #e2e8f0;
            vertical-align: top;
        }

        .items-table tr:nth-child(even) {
            background-color: #f9fafb;
        }

        /* Summary - Compact */
        .summary-section {
            margin: 12px 0;
            padding: 10px 12px;
            background: #f7fafc;
            border-radius: 6px;
            text-align: right;
        }

        .summary-row {
            margin: 4px 0;
            font-size: 9pt;
        }

        .total-row {
            font-size: 11pt;
            font-weight: 700;
            color: #dc2626;
            margin-top: 6px;
            padding-top: 6px;
            border-top: 1px solid #cbd5e0;
        }

        /* Notes - Compact */
        .notes-section {
            margin: 12px 0;
            padding: 8px 12px;
            background: #fff5f0;
            border-left: 3px solid #f59e0b;
            border-radius: 6px;
        }

        .notes-title {
            font-size: 9pt;
            font-weight: 700;
            margin-bottom: 4px;
            color: #f59e0b;
        }

        .notes-content {
            font-size: 8pt;
            color: #4a5568;
            white-space: pre-wrap;
            word-break: break-word;
        }

        /* Validity */
        .validity-section {
            margin: 10px 0;
            padding: 6px 12px;
            background: #fef3c7;
            border-radius: 6px;
            text-align: center;
            font-size: 8pt;
        }

        /* Footer */
        .footer {
            margin-top: 20px;
            text-align: center;
            font-size: 7pt;
            color: #999;
            border-top: 1px solid #e0e0e0;
            padding-top: 10px;
        }

        .divider {
            border: 0;
            border-top: 1px solid #e0e0e0;
            margin: 12px 0;
        }

        @media print {
            body {
                padding: 0;
                margin: 0;
            }
            .header {
                background: #dc2626 !important;
                print-color-adjust: exact;
                -webkit-print-color-adjust: exact;
            }
            .items-table th {
                background: #dc2626 !important;
                print-color-adjust: exact;
                -webkit-print-color-adjust: exact;
            }
        }
    </style>
</head>
<body>
    <div class="page">
        <!-- Compact Header -->
        <div class="header">
            <div>
                <div class="company-name">${lang === "ar" ? "صابر جروب" : "SABER GROUP"}</div>
                <div class="company-subtitle">${lang === "ar" ? "وكالة تسويق" : "MARKETING AGENCY"}</div>
            </div>
            <div style="text-align: right;">
                <div style="font-weight: 700;">${lang === "ar" ? "عرض سعر" : "QUOTATION"}</div>
                <div style="font-size: 8pt;">${quotation.quotationNumber || ""}</div>
                <div style="font-size: 7pt;">${dateStr}</div>
            </div>
        </div>

        <!-- Title -->
        <div class="quotation-title">
            ${lang === "ar" ? "عرض سعر خدمات إدارة منصات التواصل الاجتماعي" : "Social Media Management Services Quotation"}
        </div>

        <!-- Client Info - Compact -->
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
                (-${discountAmount.toFixed(2)} ${currency})
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

    // Return as Blob instead of printing directly
    const blob = new Blob([htmlContent], { type: 'text/html' });
    return blob;
};