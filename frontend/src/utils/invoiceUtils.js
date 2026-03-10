// utility for generating invoice HTML used across various components

export function generateInvoiceHTML(invoice, products = []) {
  const itemsHaveDiscount = (invoice.items || []).some(i => Number(i.discount) > 0);
  // build refund maps keyed by productId/SKU to total refunded qty and amount
  const refundQtyMap = new Map();
  const refundAmtMap = new Map();
  (invoice.refunds || []).forEach(r => {
    (r.items || []).forEach(it => {
      const key = String(it.productId || it.SKU || it._id || '');
      const qty = Number(it.quantity) || 0;
      const price = Number(it.perPiecePrice || 0);
      refundQtyMap.set(key, (refundQtyMap.get(key) || 0) + qty);
      refundAmtMap.set(key, (refundAmtMap.get(key) || 0) + qty * price);
    });
  });

  // net amount should come from invoice if available (backend updates it), else compute from remaining quantities
  let netAmount;
  if (invoice.netAmount !== undefined && invoice.netAmount !== null) {
    netAmount = Number(invoice.netAmount) || 0;
  } else {
    netAmount = (invoice.items || []).reduce((s, i) => {
      const key = String(i.productId || i.SKU || i._id || '');
      const origQty = Number(i.quantity) || 0;
      const refundedQty = Number(refundQtyMap.get(key) || 0);
      const usedQty = Math.max(0, origQty - refundedQty);
      return s + ((Number(i.perPiecePrice) || 0) * usedQty - (Number(i.discount) || 0));
    }, 0);
  }

  // check if invoice has any refunds at all
  const hasRefunds = (invoice.refunds || []).length > 0;

  // helper to compute warranty string for an item
  const warrantyForItem = (i) => {
    let warrantyString = 'No warranty';
    const prod = products.find(p => p._id === (i.productId || i._id));
    const months = prod ? Number(prod.warrantyMonths || 0) : 0;
    if (months > 0) {
      const saleDate = new Date(invoice.createdAt || invoice.date || Date.now());
      const warrantyUntil = new Date(saleDate);
      warrantyUntil.setMonth(warrantyUntil.getMonth() + months);
      const now = new Date();
      if (now <= warrantyUntil) {
        warrantyString = warrantyUntil.toLocaleDateString();
      } else {
        warrantyString = 'Expired';
      }
    }
    return warrantyString;
  };

  return `
      <html>
        <head>
          <title>Invoice #${(invoice._id || '').toString().slice(-6)}</title>
          <style>
            html, body { width: 100%; margin: 0; padding: 0; }
            body { font-family: 'Courier New', monospace; margin: 0 auto; padding: 15px; width: 80mm; color: #333; }
            html { display: flex; justify-content: center; }
            .header { text-align: center; margin-bottom: 15px; border-bottom: 2px solid #000; padding-bottom: 10px; }
            .header h1 { margin: 0 0 5px 0; font-size: 16px; font-weight: bold; }
            .header p { margin: 2px 0; font-size: 11px; }
            .invoice-info { margin: 12px 0; font-size: 11px; }
            .invoice-info div { margin: 3px 0; }
            .invoice-info strong { font-weight: bold; }
            table { width: 100%; border-collapse: collapse; margin: 12px 0; }
            th { background: #f5f5f5; border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 6px 4px; text-align: left; font-weight: bold; font-size: 10px; }
            td { padding: 5px 4px; border-bottom: 1px solid #eee; font-size: 10px; }
            tr:last-child td { border-bottom: 1px solid #000; }
            .text-right { text-align: right !important; }
            .total-row { border-top: 2px solid #000; border-bottom: 2px solid #000; font-weight: bold; background: #f9f9f9; }
            .total-amount { font-weight: bold; font-size: 11px; }
            .payment-info { margin-top: 8px; }
            .payment-info div { margin: 2px 0; font-size: 10px; display: flex; justify-content: space-between; }
            .footer { text-align: center; margin-top: 15px; font-size: 11px; font-weight: bold; }
            @media print { body { margin: 0 auto; padding: 10px; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>New Adil Electric Concern</h1>
            <p>4-B, Jamiat Center, Shah Alam Market</p>
            <p>Lahore, Pakistan</p>
            <p>Phone: 0333-4263733 | Email: info@adilelectric.com</p>
            <p>Website: e-roshni.com</p>
          </div>

          <div class="invoice-info">
            <div><strong>Invoice #</strong>${(invoice._id || '').toString().slice(-6)}</div>
            <div><strong>Date:</strong> ${new Date(invoice.createdAt || invoice.date).toLocaleDateString()} <strong>Time:</strong> ${new Date(invoice.createdAt || invoice.date).toLocaleTimeString()}</div>
            <div><strong>Customer:</strong> ${invoice.customerName || '-'} | <strong>Contact:</strong> ${invoice.customerContact || '-'}</div>
            <div><strong>Payment:</strong> ${invoice.paymentMethod || '-'} | <strong>Status:</strong> ${invoice.paymentStatus || '-'}${invoice.paymentStatus === 'Credit' && invoice.dueDate ? ` | <strong>Due:</strong> ${new Date(invoice.dueDate).toLocaleDateString()}` : ''}</div>
          </div>

          <table>
            <thead>
              <tr>
                <th>S/N</th>
                <th>Item</th>
                <th class="text-right">Qty</th>
                <th class="text-right">Rate</th>
                ${hasRefunds ? '<th class="text-right">Refund</th>' : ''}
                <th class="text-right">Warranty</th>
                ${itemsHaveDiscount ? '<th class="text-right">Disc.</th>' : ''}
                <th class="text-right">SubTotal</th>
              </tr>
            </thead>
            <tbody>
              ${(invoice.items || []).map((i, idx) => {
                const warrantyString = warrantyForItem(i);
                const key = String(i.productId || i.SKU || i._id || '');
                const origQty = Number(i.quantity) || 0;
                const refundedQty = Number(refundQtyMap.get(key) || 0);
                const refundAmt = Number(refundAmtMap.get(key) || 0);
                const remainingQty = Math.max(0, origQty - refundedQty);
                const itemSubtotal = ((Number(i.perPiecePrice) || 0) * remainingQty) - (Number(i.discount) || 0);
                return `
                <tr>
                  <td>${idx + 1}</td>
                  <td>${i.productName || 'Item'}</td>
                  <td class="text-right">${origQty}${refundedQty ? ` (-${refundedQty} ref)` : ''}</td>
                  <td class="text-right">${Number(i.perPiecePrice || 0).toLocaleString()}</td>
                  ${hasRefunds ? `<td class="text-right">${refundAmt ? 'Rs. ' + refundAmt.toLocaleString() : ''}</td>` : ''}
                  <td class="text-right">${warrantyString}</td>
                  ${itemsHaveDiscount ? `<td class="text-right">${i.discount || 0}</td>` : ''}
                  <td class="text-right">${Number(itemSubtotal).toLocaleString()}</td>
                </tr>
              `;
              }).join('')}
              
              <tr class="total-row">
                <td colspan="${5 + (hasRefunds ? 1 : 0) + (itemsHaveDiscount ? 1 : 0)}"></td>
                <td class="text-right total-amount">Rs.${Number(netAmount).toLocaleString()}</td>
              </tr>
            </tbody>
          </table>

          <div class="payment-info">
            ${(() => {
              const paidVal = invoice.paymentMethod === 'Cash'
                ? (invoice.cashAmount || invoice.paidAmount || 0)
                : (invoice.paidAmount || 0);
              const changeVal = invoice.changeAmount || 0;
              const totalRefundAmount = (invoice.refunds || []).reduce((s, r) => s + (Number(r.totalRefundAmount) || 0), 0);
              let extra = '';
              if (invoice.paymentStatus === 'Partial Paid') {
                const remaining = Math.max(0, netAmount - (invoice.paidAmount || 0));
                extra = `
                  <div><span>Remaining</span> <span>Rs. ${remaining.toLocaleString()}</span></div>`;
              } else if (invoice.paymentStatus === 'Credit') {
                extra = `
                  <div><span>Due Date</span> <span>${invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : '-'}</span></div>`;
              }
              return `
                <div><span>Paid Amount</span> <span>Rs. ${Number(paidVal).toLocaleString()}</span></div>
                ${totalRefundAmount > 0 ? `<div><span>Refunded</span> <span>Rs. ${totalRefundAmount.toLocaleString()}</span></div>` : ''}
                <div><span>Change</span> <span>Rs. ${Number(changeVal).toLocaleString()}</span></div>
                ${extra}
              `;
            })()}
          </div>

          <div class="footer">Thank you for your business!</div>
        </body>
      </html>
    `;
}
