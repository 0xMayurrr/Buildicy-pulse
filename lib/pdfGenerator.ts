import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { formatCurrency, formatFullCurrency } from '../data/demo';

export interface InvoiceData {
  invoiceNumber: string;
  date: string;
  clientName: string;
  clientCompany: string;
  projectName: string;
  items: Array<{ description: string; amount: number }>;
  notes?: string;
}

export interface ReportData {
  title: string;
  startDate: string;
  endDate: string;
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  transactionsCount: number;
  clientsCount: number;
  projectsCount: number;
  topExpenses: Array<{ category: string; amount: number }>;
}

/**
 * Generates an itemized HTML Invoice and opens native PDF preview / print / share dialog
 */
export async function generateAndShareInvoice(data: InvoiceData): Promise<boolean> {
  const { invoiceNumber, date, clientName, clientCompany, projectName, items, notes } = data;

  const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);

  const itemsHtml = items
    .map(
      (item, idx) => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #E2E8F0; font-weight: 600;">${idx + 1}. ${item.description}</td>
        <td style="padding: 12px; border-bottom: 1px solid #E2E8F0; font-weight: 800; text-align: right;">${formatFullCurrency(item.amount)}</td>
      </tr>
    `
    )
    .join('');

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Invoice #${invoiceNumber}</title>
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #0B0F17; margin: 0; padding: 40px; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #7C3AED; padding-bottom: 20px; }
          .brand { font-size: 24px; font-weight: 900; letter-spacing: 2px; color: #0B0F17; }
          .badge { background: #7C3AED; color: #FFF; padding: 4px 8px; font-size: 11px; font-weight: 900; border-radius: 4px; display: inline-block; margin-left: 6px; }
          .inv-title { font-size: 28px; font-weight: 900; text-align: right; color: #7C3AED; }
          .meta-row { display: flex; justify-content: space-between; margin-top: 30px; margin-bottom: 30px; }
          .meta-box { width: 48%; }
          .meta-label { font-size: 10px; font-weight: 900; color: #64748B; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 4px; }
          .meta-val { font-size: 16px; font-weight: 800; color: #0B0F17; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { background: #0B0F17; color: #FFFFFF; font-size: 11px; font-weight: 900; letter-spacing: 1px; padding: 12px; text-align: left; }
          .total-box { margin-top: 30px; background: #F8F7FC; border: 2px solid #0B0F17; padding: 20px; display: flex; justify-content: space-between; align-items: center; }
          .total-title { font-size: 14px; font-weight: 900; letter-spacing: 1px; }
          .total-val { font-size: 32px; font-weight: 900; color: #059669; }
          .footer { margin-top: 50px; font-size: 10px; color: #64748B; text-align: center; border-top: 1px solid #E2E8F0; padding-top: 20px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="brand">BUILDICY <span class="badge">PULSE</span></div>
            <div style="font-size: 11px; color: #7C3AED; font-weight: 800; margin-top: 4px;">FINANCIAL CONTROL PLATFORM</div>
          </div>
          <div>
            <div class="inv-title">INVOICE</div>
            <div style="font-size: 12px; font-weight: 800; text-align: right; color: #64748B;">#${invoiceNumber}</div>
            <div style="font-size: 11px; font-weight: 700; text-align: right; color: #64748B;">Date: ${date}</div>
          </div>
        </div>

        <div class="meta-row">
          <div class="meta-box">
            <div class="meta-label">BILLED TO</div>
            <div class="meta-val">${clientCompany}</div>
            <div style="font-size: 13px; color: #64748B; font-weight: 700;">Attn: ${clientName}</div>
          </div>
          <div class="meta-box" style="text-align: right;">
            <div class="meta-label">PROJECT NAME</div>
            <div class="meta-val">${projectName || 'General Services'}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>DESCRIPTION</th>
              <th style="text-align: right;">AMOUNT (INR)</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div class="total-box">
          <div class="total-title">TOTAL DUE</div>
          <div class="total-val">${formatFullCurrency(totalAmount)}</div>
        </div>

        ${notes ? `<div style="margin-top: 20px; font-size: 12px; color: #475569; background: #FFF; padding: 12px; border: 1px solid #CBD5E1;"><strong>Notes:</strong> ${notes}</div>` : ''}

        <div class="footer">
          Generated via Buildicy Pulse • Thank you for your business!
        </div>
      </body>
    </html>
  `;

  try {
    console.log('[PDF GENERATOR] Printing Invoice HTML to PDF file...');
    const { uri } = await Print.printToFileAsync({ html });
    console.log('[PDF GENERATOR SUCCESS] PDF generated at URI:', uri);

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } else {
      await Print.printAsync({ uri });
    }
    return true;
  } catch (err: any) {
    console.error('[PDF GENERATOR ERROR] Failed to generate/share PDF:', err.message || err);
    return false;
  }
}

/**
 * Generates a Financial Summary Report PDF
 */
export async function generateAndShareReport(data: ReportData): Promise<boolean> {
  const { title, startDate, endDate, totalRevenue, totalExpenses, netProfit, transactionsCount, clientsCount, projectsCount, topExpenses } = data;

  const topExpHtml = topExpenses
    .map(
      exp => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; font-weight: 700;">${exp.category}</td>
        <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; font-weight: 900; text-align: right; color: #DC2626;">${formatFullCurrency(exp.amount)}</td>
      </tr>
    `
    )
    .join('');

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${title}</title>
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #0B0F17; margin: 0; padding: 40px; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #0B0F17; padding-bottom: 20px; }
          .brand { font-size: 24px; font-weight: 900; letter-spacing: 2px; }
          .report-title { font-size: 26px; font-weight: 900; color: #7C3AED; }
          .kpi-row { display: flex; justify-content: space-between; margin-top: 30px; margin-bottom: 30px; gap: 15px; }
          .kpi-card { flex: 1; border: 2px solid #0B0F17; padding: 16px; background: #FFFFFF; }
          .kpi-lbl { font-size: 9px; font-weight: 900; color: #64748B; letter-spacing: 1.5px; text-transform: uppercase; }
          .kpi-val { font-size: 24px; font-weight: 900; margin-top: 4px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { background: #7C3AED; color: #FFFFFF; font-size: 11px; font-weight: 900; letter-spacing: 1px; padding: 10px; text-align: left; }
          .footer { margin-top: 50px; font-size: 10px; color: #64748B; text-align: center; border-top: 1px solid #E2E8F0; padding-top: 20px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="brand">BUILDICY PULSE</div>
            <div style="font-size: 11px; color: #7C3AED; font-weight: 800; margin-top: 4px;">FINANCIAL CONTROL ENGINE</div>
          </div>
          <div style="text-align: right;">
            <div class="report-title">${title}</div>
            <div style="font-size: 11px; font-weight: 700; color: #64748B;">Period: ${startDate} to ${endDate}</div>
          </div>
        </div>

        <div class="kpi-row">
          <div class="kpi-card">
            <div class="kpi-lbl">TOTAL REVENUE</div>
            <div class="kpi-val" style="color: #059669;">${formatFullCurrency(totalRevenue)}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-lbl">TOTAL EXPENSES</div>
            <div class="kpi-val" style="color: #DC2626;">${formatFullCurrency(totalExpenses)}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-lbl">NET PROFIT</div>
            <div class="kpi-val" style="color: #7C3AED;">${formatFullCurrency(netProfit)}</div>
          </div>
        </div>

        <div style="margin-top: 20px; font-size: 13px; font-weight: 900; letter-spacing: 1px;">EXPENSE BREAKDOWN BY CATEGORY</div>
        <table>
          <thead>
            <tr>
              <th>CATEGORY</th>
              <th style="text-align: right;">TOTAL SPENT</th>
            </tr>
          </thead>
          <tbody>
            ${topExpHtml || '<tr><td colspan="2" style="padding:12px; text-align:center;">No expenses recorded</td></tr>'}
          </tbody>
        </table>

        <div class="footer">
          Generated via Buildicy Pulse Control Center • Confidential Financial Document
        </div>
      </body>
    </html>
  `;

  try {
    console.log('[PDF GENERATOR] Printing Financial Report HTML to PDF file...');
    const { uri } = await Print.printToFileAsync({ html });
    console.log('[PDF GENERATOR SUCCESS] Report generated at URI:', uri);

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } else {
      await Print.printAsync({ uri });
    }
    return true;
  } catch (err: any) {
    console.error('[PDF GENERATOR ERROR] Failed to generate/share Report:', err.message || err);
    return false;
  }
}
