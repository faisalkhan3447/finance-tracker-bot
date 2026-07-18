import PDFDocument from 'pdfkit';
import { formatUSD } from './currency.js';

export const generatePDFReceipt = (tx) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      // Brand Header Background
      doc.rect(0, 0, 595.28, 120).fill('#2b2d31');
      
      // Header Text
      doc.fillColor('#ffffff').fontSize(28).font('Helvetica-Bold').text('INVOICE / RECEIPT', 50, 45);
      doc.fontSize(10).font('Helvetica').text('Finance Tracker System', 50, 80);
      
      // Receipt Details
      doc.fillColor('#ffffff').fontSize(10).text(`Receipt No: ${tx.tx_id}`, 400, 45, { align: 'right' });
      doc.text(`Date: ${new Date(tx.timestamp).toLocaleDateString()}`, 400, 60, { align: 'right' });
      doc.text(`Time: ${new Date(tx.timestamp).toLocaleTimeString()}`, 400, 75, { align: 'right' });
      
      // Reset color for body
      doc.fillColor('#333333');
      doc.moveDown(5);

      // Bill To section
      doc.fontSize(14).font('Helvetica-Bold').text('Transaction Details', 50, 160);
      doc.fontSize(10).font('Helvetica').text(`Logged By:`, 50, 185);
      doc.font('Helvetica-Bold').text(tx.username, 120, 185);
      doc.font('Helvetica').text(`User ID:`, 50, 200);
      doc.font('Helvetica-Bold').text(tx.user_id, 120, 200);
      doc.font('Helvetica').text(`Type:`, 50, 215);
      
      const typeStr = tx.type === 'INCOME' ? 'INCOME / DEPOSIT' : 'EXPENSE / WITHDRAWAL';
      doc.fillColor(tx.type === 'INCOME' ? '#2e7d32' : '#c62828').font('Helvetica-Bold').text(typeStr, 120, 215);
      doc.fillColor('#333333');

      // Table Header
      doc.rect(50, 260, 495, 30).fill('#f4f4f5');
      doc.fillColor('#000000').fontSize(11).font('Helvetica-Bold');
      doc.text('DESCRIPTION', 60, 270);
      doc.text('AMOUNT', 450, 270, { width: 85, align: 'right' });
      
      // Table Row
      doc.font('Helvetica').fontSize(11).fillColor('#333333');
      doc.text(tx.reason, 60, 310, { width: 380 });
      
      const sign = tx.type === 'INCOME' ? '+' : '-';
      doc.font('Helvetica-Bold').text(`${sign}${formatUSD(tx.amount)}`, 450, 310, { width: 85, align: 'right' });

      // Table Footer / Summary
      doc.moveTo(50, 350).lineTo(545, 350).lineWidth(1).stroke('#e4e4e7');
      
      doc.fontSize(12).font('Helvetica').text('Transaction Total:', 300, 370, { width: 140, align: 'right' });
      doc.font('Helvetica-Bold').text(`${sign}${formatUSD(tx.amount)}`, 450, 370, { width: 85, align: 'right' });

      doc.fontSize(12).font('Helvetica').text('New Account Balance:', 300, 395, { width: 140, align: 'right' });
      doc.font('Helvetica-Bold').text(formatUSD(tx.balance_after), 450, 395, { width: 85, align: 'right' });

      // Footer
      const bottomY = 750;
      doc.rect(0, bottomY, 595.28, 100).fill('#f4f4f5');
      doc.fillColor('#71717a').fontSize(9).font('Helvetica');
      doc.text('This is an automatically generated receipt.', 0, bottomY + 20, { align: 'center' });
      doc.text('Powered by Finance Tracker Bot', 0, bottomY + 35, { align: 'center' });

      doc.end();
    } catch (error) { reject(error); }
  });
};