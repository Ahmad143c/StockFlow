const Sale = require('../models/Sale');
const Product = require('../models/Product');
const User = require('../models/User');
const nodemailer = require('nodemailer');

// Helper: send email invoice via SMTP (Gmail/app password)
async function sendInvoiceEmail(to, subject, htmlBody) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return { success: false, error: 'SMTP credentials missing. Set SMTP_USER and SMTP_PASS in .env (use Gmail App Password if using Gmail).' };
  }
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT || (process.env.SMTP_SECURE === 'true' ? 465 : 587));
  const secure = String(process.env.SMTP_SECURE || (port === 465)).toLowerCase() === 'true' || port === 465;
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.SMTP_USER,
      to,
      subject,
      html: htmlBody
    });
    return { success: true, result: info };
  } catch (err) {
    // Provide actionable message for common Gmail auth failures
    const msg = err?.message || String(err);
    let friendly = msg;
    if (/(EAUTH|Invalid login|535|Username and Password not accepted)/i.test(msg)) {
      friendly = 'SMTP authentication failed. If using Gmail, enable 2-Step Verification and create an App Password, then set SMTP_PASS to that app password. See: https://support.google.com/accounts/answer/185833';
    }
    console.error('Email send error:', msg);
    return { success: false, error: friendly };
  }
}

// Create a new sale (POST /sales)
exports.createSale = async (req, res) => {
  try {
    const { items, sellerId, sellerName, cashierName, customerName, customerContact, customerEmail, paidAmount, paymentMethod, paymentStatus: paymentStatusInput, paymentProofUrl, cashAmount, changeAmount, dueDate } = req.body;
    if (!items?.length || !sellerId) return res.status(400).json({ message: 'Missing sale items or seller' });

    let totalQuantity = 0;
    let totalAmount = 0; // gross total (sum of price * qty, without discount)
    let discountTotal = 0;

    const saleItems = items.map(item => {
      const quantity = Number(item.quantity);
      const perPiecePrice = Number(item.perPiecePrice);
      const discount = Number(item.discount || 0);
      const lineGross = perPiecePrice * quantity; // without discount

      totalQuantity += quantity;
      totalAmount += lineGross; // accumulate gross
      discountTotal += discount;

      return {
        ...item,
        quantity,
        perPiecePrice,
        discount,
        subtotal: lineGross - discount, // keep for reference
      };
    });
    const netAmount = Math.max(0, totalAmount - discountTotal);
    // Determine payment status
    let computedStatus = paidAmount >= netAmount ? 'Paid' : paidAmount > 0 ? 'Partial' : 'Unpaid';
    // If client provided a valid mapped status, normalize and use it
    const normalizeStatus = (s) => {
      if (!s) return '';
      const map = {
        'paid': 'Paid',
        'unpaid': 'Unpaid',
        'partial': 'Partial',
        'partial paid': 'Partial Paid',
        'credit': 'Credit'
      };
      const key = String(s).toLowerCase();
      return map[key] || '';
    };
    const providedStatus = normalizeStatus(paymentStatusInput);
    const paymentStatus = providedStatus || computedStatus;

    // Decrement product stock based on sold items
    for (const item of saleItems) {
      const product = item.productId
        ? await Product.findById(item.productId)
        : (item.SKU ? await Product.findOne({ SKU: item.SKU }) : null);
      if (!product) {
        return res.status(400).json({ message: `Product not found for item ${item.productName || item.SKU || ''}` });
      }

      const piecesPerCarton = Number(product.piecesPerCarton) || 0;
      const currentTotalPieces = Number(product.totalPieces) || ((Number(product.cartonQuantity) || 0) * (piecesPerCarton)) + (Number(product.losePieces) || 0);
      const sellPieces = Number(item.quantity) || 0; // quantity is assumed in pieces

      if (sellPieces > currentTotalPieces) {
        return res.status(400).json({ message: `Insufficient stock for ${product.name}. In stock: ${currentTotalPieces}, requested: ${sellPieces}` });
      }

      const remainingPieces = currentTotalPieces - sellPieces;

      let newCartons = Number(product.cartonQuantity) || 0;
      let newLosePieces = Number(product.losePieces) || 0;
      if (piecesPerCarton > 0) {
        newCartons = Math.floor(remainingPieces / piecesPerCarton);
        newLosePieces = remainingPieces % piecesPerCarton;
      } else {
        // No defined piecesPerCarton, treat all as loose pieces
        newCartons = Number(product.cartonQuantity) || 0;
        newLosePieces = remainingPieces;
      }

      const stockQuantity = newCartons + (newLosePieces > 0 ? 1 : 0);

      product.totalPieces = remainingPieces;
      product.cartonQuantity = newCartons;
      product.losePieces = newLosePieces;
      product.stockQuantity = stockQuantity;

      // Recompute derived totals for reporting
      const costPerPiece = Number(product.costPerPiece) || 0;
      const sellingPerPiece = Number(product.sellingPerPiece) || 0;
      product.totalUnitCost = costPerPiece * remainingPieces;
      product.perPieceProfit = sellingPerPiece - costPerPiece;
      product.totalUnitProfit = product.perPieceProfit * remainingPieces;

      await product.save();
    }

    const sale = new Sale({
      sellerId,
      sellerName,
      cashierName,
      items: saleItems,
      totalQuantity,
      totalAmount,
      discountTotal,
      netAmount,
      paymentStatus,
      paymentMethod: paymentMethod || 'Cash',
      paymentProofUrl,
      cashAmount: Number(cashAmount || 0),
      changeAmount: Number(changeAmount || 0),
      paidAmount: paidAmount || 0,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      customerName,
      customerContact,
      customerEmail,
      emailStatus: 'pending'
    });
    await sale.save();

    // Send invoice email (await so status is saved) - enhanced HTML body
    if (sale.customerEmail) {
      const subject = `Invoice #${sale.invoiceNumber || String(sale._id).slice(-8)} - New Adil Electric Concern`;
      
      // Build professional invoice HTML
      const invoiceNum = sale.invoiceNumber || String(sale._id).substr(-6);
      const itemsHaveDiscount = (sale.items || []).some(it => Number(it.discount || 0) > 0);
      const preTotalColSpan = itemsHaveDiscount ? 4 : 3; // cols before last two (label + value)
      let html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9; border: 1px solid #ddd; border-radius: 4px;">
          <div style="text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 15px;">
            <h2 style="margin: 0; color: #333;">New Adil Electric Concern</h2>
            <p style="margin: 5px 0; color: #666; font-size: 14px;">4-B, Jamiat Center, Shah Alam Market</p>
            <p style="margin: 5px 0; color: #666; font-size: 14px;">Lahore, Pakistan</p>
            <p style="margin: 5px 0; color: #666; font-size: 14px;">Phone: 0333-4263733 | Email: info@adilelectric.com</p>
            <p style="margin: 5px 0; color: #666; font-size: 14px;">Website: e-roshni.com</p>
          </div>
          
          <div style="margin-bottom: 20px;">
            <p style="margin: 5px 0;"><strong>Invoice #${invoiceNum}</strong></p>
            <p style="margin: 5px 0;">Date: ${new Date(sale.createdAt).toLocaleString()}</p>
            <p style="margin: 5px 0;">Cashier: ${sale.cashierName || '-'}</p>
          </div>
          
          <div style="margin-bottom: 20px; padding: 10px; background: #fff; border: 1px solid #ddd; border-radius: 3px;">
            <p style="margin: 5px 0;"><strong>Customer Information</strong></p>
            <p style="margin: 5px 0;">Name: ${sale.customerName || '-'}</p>
            <p style="margin: 5px 0;">Contact: ${sale.customerContact || '-'}</p>
            <p style="margin: 5px 0;">Email: ${sale.customerEmail || '-'}</p>
          </div>
          
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <thead>
              <tr style="background: #f0f0f0; border-bottom: 2px solid #333;">
                <th style="padding: 10px; text-align: left; font-weight: bold;">S/N</th>
                <th style="padding: 10px; text-align: left; font-weight: bold;">Item</th>
                <th style="padding: 10px; text-align: right; font-weight: bold;">Qty</th>
                <th style="padding: 10px; text-align: right; font-weight: bold;">Rate (Rs)</th>
                ${itemsHaveDiscount ? '<th style="padding: 10px; text-align: right; font-weight: bold;">Discount (Rs)</th>' : ''}
                <th style="padding: 10px; text-align: right; font-weight: bold;">SubTotal (Rs)</th>
              </tr>
            </thead>
            <tbody>
      `;
      
      let totalAmount = 0;
      (sale.items || []).forEach((it, idx) => {
        const itemTotal = (Number(it.perPiecePrice) * Number(it.quantity)) - (Number(it.discount) || 0);
        totalAmount += itemTotal;
        html += `
              <tr style="border-bottom: 1px solid #ddd;">
                <td style="padding: 10px; text-align: left;">${idx + 1}</td>
                <td style="padding: 10px; text-align: left; word-break: break-word;">${it.productName || ''}</td>
                <td style="padding: 10px; text-align: right;">${it.quantity}</td>
                <td style="padding: 10px; text-align: right;">Rs. ${it.perPiecePrice}</td>
                ${itemsHaveDiscount ? `<td style="padding: 10px; text-align: right;">Rs. ${it.discount || 0}</td>` : ''}
                <td style="padding: 10px; text-align: right;">Rs. ${itemTotal}</td>
              </tr>
        `;
      });
      
      html += `
            </tbody>
          </table>
          
          <div style="margin-bottom: 20px; padding: 15px; background: #f0f0f0; border-radius: 3px;">
            <table style="width: 100%;">
              <tr>
                <td style="padding: 5px; text-align: right;"><strong>Net Total:</strong></td>
                <td style="padding: 5px; text-align: right; font-weight: bold;">Rs. ${sale.netAmount}</td>
              </tr>
              <tr>
                <td style="padding: 5px; text-align: right;">Payment Method:</td>
                <td style="padding: 5px; text-align: right;">${sale.paymentMethod || '-'}</td>
              </tr>
              <tr>
                <td style="padding: 5px; text-align: right;">Payment Status:</td>
                <td style="padding: 5px; text-align: right;">${sale.paymentStatus || '-'}</td>
              </tr>
              <tr>
                <td style="padding: 5px; text-align: right;"><strong>Paid Amount:</strong></td>
                <td style="padding: 5px; text-align: right;">Rs. ${sale.paymentMethod === 'Cash' ? (sale.cashAmount || 0) : (sale.paidAmount || 0)}</td>
              </tr>
              <tr>
                <td style="padding: 5px; text-align: right;"><strong>Change Amount:</strong></td>
                <td style="padding: 5px; text-align: right;">Rs. ${sale.changeAmount || 0}</td>
              </tr>
      `;
      
      if (sale.paymentMethod === 'Cash') {
        html += `
              <tr>
                <td style="padding: 5px; text-align: right;">Cash Received:</td>
                <td style="padding: 5px; text-align: right;">Rs. ${sale.cashAmount || 0}</td>
              </tr>
              <tr>
                <td style="padding: 5px; text-align: right;">Change:</td>
                <td style="padding: 5px; text-align: right;">Rs. ${sale.changeAmount || 0}</td>
              </tr>
        `;
      } else if (sale.paymentStatus === 'Partial Paid') {
        const remaining = Math.max(0, Number(sale.netAmount) - (Number(sale.paidAmount) || 0));
        html += `
              <tr>
                <td style="padding: 5px; text-align: right;">Amount Received:</td>
                <td style="padding: 5px; text-align: right;">Rs. ${sale.paidAmount || 0}</td>
              </tr>
              <tr>
                <td style="padding: 5px; text-align: right;">Remaining:</td>
                <td style="padding: 5px; text-align: right;">Rs. ${remaining}</td>
              </tr>
        `;
      } else if (sale.paymentStatus === 'Credit') {
        html += `
              <tr>
                <td style="padding: 5px; text-align: right;">Amount Received:</td>
                <td style="padding: 5px; text-align: right;">Rs. ${sale.paidAmount || 0}</td>
              </tr>
              <tr>
                <td style="padding: 5px; text-align: right;">Due Date:</td>
                <td style="padding: 5px; text-align: right;">${sale.dueDate ? new Date(sale.dueDate).toLocaleDateString() : '-'}</td>
              </tr>
        `;
      } else {
        html += `
              <tr>
                <td style="padding: 5px; text-align: right;">Amount Paid:</td>
                <td style="padding: 5px; text-align: right;">Rs. ${sale.paidAmount || 0}</td>
              </tr>
              <tr>
                <td style="padding: 5px; text-align: right;">Change:</td>
                <td style="padding: 5px; text-align: right;">Rs. ${sale.changeAmount || 0}</td>
              </tr>
        `;
      }
      
      html += `
            </table>
          </div>
          
          <div style="text-align: center; padding: 15px; color: #666; font-size: 14px; border-top: 1px solid #ddd;">
            <p style="margin: 0;">Thank you for your business!</p>
            <p style="margin: 5px 0; font-size: 12px; color: #999;">This is an automated invoice. Please retain this email for your records.</p>
          </div>
        </div>
      `;

      // Send to customer
      // Send email in background (non-blocking) so API response returns immediately
      (async () => {
        try {
          const mailRes = await sendInvoiceEmail(sale.customerEmail, subject, html);
          if (mailRes.success) {
            const messageId = mailRes.result?.messageId || '';
            await Sale.findByIdAndUpdate(sale._id, { emailStatus: 'sent', emailError: '', emailMessageId: messageId }).catch(()=>{});
          } else {
            const errStr = typeof mailRes.error === 'string' ? mailRes.error : JSON.stringify(mailRes.error);
            await Sale.findByIdAndUpdate(sale._id, { emailStatus: 'failed', emailError: errStr }).catch(()=>{});
          }
          
          // Send to admin email
          const adminEmail = 'adilelectric17@gmail.com';
          const paidVal = sale.paymentMethod === 'Cash' ? (sale.cashAmount || 0) : (sale.paidAmount || 0);
          const adminSubject = `[ADMIN] Invoice #${invoiceNum} - ${sale.customerName || 'Unknown Customer'} - Net Rs. ${sale.netAmount} - Paid Rs. ${paidVal} - Change Rs. ${sale.changeAmount || 0}`;
          await sendInvoiceEmail(adminEmail, adminSubject, html).catch(()=>{});
        } catch (e) {
          console.error('Background email send failed:', e.message);
        }
      })();
    } else {
      // no email provided - set status immediately without awaiting
      Sale.findByIdAndUpdate(sale._id, { emailStatus: 'failed', emailError: 'No customer email provided' }).catch(()=>{});
    }

    // Return response immediately - email status updates will happen in background
    const updatedSale = await Sale.findById(sale._id).lean();
    return res.status(201).json(updatedSale);
  } catch (e) {
    res.status(500).json({ message: 'Failed to create sale', error: e.message });
  }
};

// Get all sales (Admin: all; Seller: only their own)
exports.getSales = async (req, res) => {
  try {
    const { sellerId, limit } = req.query;
    const query = sellerId ? { sellerId } : {};
    let q = Sale.find(query).sort({ createdAt: -1 });
    if (limit) {
      const l = Number(limit);
      if (!Number.isNaN(l) && l > 0) q = q.limit(l);
    }
    const sales = await q.exec();
    res.json(sales);
  } catch (e) {
    res.status(500).json({ message: 'Failed to fetch sales', error: e.message });
  }
};

// Get a single sale by ID
exports.getSaleById = async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id);
    if (!sale) return res.status(404).json({ message: 'Sale not found' });
    res.json(sale);
  } catch (e) {
    res.status(500).json({ message: 'Server error', error: e.message });
  }
};

// Update sale basic details (cashier/customer fields only)
exports.updateSale = async (req, res) => {
  try {
    const {
      cashierName, customerName, customerContact, customerEmail,
      paymentStatus, paymentMethod, paidAmount, cashAmount, changeAmount, dueDate,
      items, netAmount, totalAmount, discountTotal, totalQuantity, paymentProofUrl, edited
    } = req.body;
    const sale = await Sale.findById(req.params.id);
    if (!sale) return res.status(404).json({ message: 'Sale not found' });

    if (cashierName !== undefined) sale.cashierName = cashierName;
    if (customerName !== undefined) sale.customerName = customerName;
    if (customerContact !== undefined) sale.customerContact = customerContact;
    if (customerEmail !== undefined) sale.customerEmail = customerEmail;
    if (paymentStatus !== undefined) sale.paymentStatus = paymentStatus;
    if (paymentMethod !== undefined) sale.paymentMethod = paymentMethod;
    if (paidAmount !== undefined) sale.paidAmount = Number(paidAmount) || 0;
    if (cashAmount !== undefined) sale.cashAmount = Number(cashAmount) || 0;
    if (changeAmount !== undefined) sale.changeAmount = Number(changeAmount) || 0;
    if (dueDate !== undefined) sale.dueDate = dueDate ? new Date(dueDate) : undefined;
    if (paymentProofUrl !== undefined) sale.paymentProofUrl = paymentProofUrl;

    // If items/totals provided, update them (frontend sends computed values)
    if (Array.isArray(items)) {
      // Compute differences between existing sale items and new items and adjust product stocks accordingly
      const origMap = new Map();
      (sale.items || []).forEach(it => { origMap.set(String(it.productId), Number(it.quantity) || 0); });
      const newMap = new Map();
      items.forEach(it => { newMap.set(String(it.productId || it._id || ''), Number(it.quantity) || 0); });

      // For each product, handle restock (when newQty < origQty) and deduction (when newQty > origQty)
      const pids = new Set([...Array.from(origMap.keys()), ...Array.from(newMap.keys())]);
      for (const pid of pids) {
        const origQty = Number(origMap.get(pid) || 0);
        const newQty = Number(newMap.get(pid) || 0);
        if (newQty < origQty) {
          // Restock the difference (edit removed items)
          const diff = origQty - newQty;
          const product = await Product.findById(pid);
          if (!product) continue;
          const piecesPerCarton = Number(product.piecesPerCarton) || 0;
          const currentTotalPieces = Number(product.totalPieces) || ((Number(product.cartonQuantity) || 0) * piecesPerCarton) + (Number(product.losePieces) || 0);
          const newTotalPieces = currentTotalPieces + diff;
          let newCartons = Number(product.cartonQuantity) || 0;
          let newLosePieces = Number(product.losePieces) || 0;
          if (piecesPerCarton > 0) {
            newCartons = Math.floor(newTotalPieces / piecesPerCarton);
            newLosePieces = newTotalPieces % piecesPerCarton;
          } else {
            newLosePieces = newTotalPieces;
          }
          const stockQuantity = newCartons + (newLosePieces > 0 ? 1 : 0);
          product.totalPieces = newTotalPieces;
          product.cartonQuantity = newCartons;
          product.losePieces = newLosePieces;
          product.stockQuantity = stockQuantity;
          const costPerPiece = Number(product.costPerPiece) || 0;
          const sellingPerPiece = Number(product.sellingPerPiece) || 0;
          product.totalUnitCost = costPerPiece * newTotalPieces;
          product.perPieceProfit = sellingPerPiece - costPerPiece;
          product.totalUnitProfit = product.perPieceProfit * newTotalPieces;
          await product.save();
        } else if (newQty > origQty) {
          // Deduct additional pieces (edit added/increased items)
          const diff = newQty - origQty;
          const product = await Product.findById(pid);
          if (!product) return res.status(400).json({ message: `Product not found for adjustment: ${pid}` });
          const piecesPerCarton = Number(product.piecesPerCarton) || 0;
          const currentTotalPieces = Number(product.totalPieces) || ((Number(product.cartonQuantity) || 0) * piecesPerCarton) + (Number(product.losePieces) || 0);
          if (diff > currentTotalPieces) {
            return res.status(400).json({ message: `Insufficient stock for ${product.name}. In stock: ${currentTotalPieces}, required additional: ${diff}` });
          }
          const newTotalPieces = currentTotalPieces - diff;
          let newCartons = Number(product.cartonQuantity) || 0;
          let newLosePieces = Number(product.losePieces) || 0;
          if (piecesPerCarton > 0) {
            newCartons = Math.floor(newTotalPieces / piecesPerCarton);
            newLosePieces = newTotalPieces % piecesPerCarton;
          } else {
            newLosePieces = newTotalPieces;
          }
          const stockQuantity = newCartons + (newLosePieces > 0 ? 1 : 0);
          product.totalPieces = newTotalPieces;
          product.cartonQuantity = newCartons;
          product.losePieces = newLosePieces;
          product.stockQuantity = stockQuantity;
          const costPerPiece = Number(product.costPerPiece) || 0;
          const sellingPerPiece = Number(product.sellingPerPiece) || 0;
          product.totalUnitCost = costPerPiece * newTotalPieces;
          product.perPieceProfit = sellingPerPiece - costPerPiece;
          product.totalUnitProfit = product.perPieceProfit * newTotalPieces;
          await product.save();
        }
      }

      sale.items = items;
    }
    if (netAmount !== undefined) sale.netAmount = Number(netAmount) || 0;
    if (totalAmount !== undefined) sale.totalAmount = Number(totalAmount) || 0;
    if (discountTotal !== undefined) sale.discountTotal = Number(discountTotal) || 0;
    if (totalQuantity !== undefined) sale.totalQuantity = Number(totalQuantity) || 0;

    if (edited !== undefined) sale.edited = !!edited;

    await sale.save();
    const updated = await Sale.findById(req.params.id).lean();
    res.json(updated);
  } catch (e) {
    res.status(500).json({ message: 'Failed to update sale', error: e.message });
  }
};

// Resend sale invoice email (POST /sales/:id/resend-email)
exports.resendEmail = async (req, res) => {
  try {
    const saleId = req.params.id;
    const sale = await Sale.findById(saleId);
    if (!sale) return res.status(404).json({ message: 'Sale not found' });

    if (!sale.customerEmail) {
      await Sale.findByIdAndUpdate(saleId, { emailStatus: 'failed', emailError: 'No customer email provided' }).catch(()=>{});
      return res.status(400).json({ success: false, message: 'No customer email provided' });
    }

    // Build professional invoice HTML (same as createSale)
    const subject = `Invoice #${sale.invoiceNumber || String(sale._id).slice(-8)} - New Adil Electric Concern`;
    const invoiceNum = sale.invoiceNumber || String(sale._id).substr(-6);
    const itemsHaveDiscount = (sale.items || []).some(it => Number(it.discount || 0) > 0);
    const preTotalColSpan = itemsHaveDiscount ? 4 : 3;
    let html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9; border: 1px solid #ddd; border-radius: 4px;">
        <div style="text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 15px;">
          <h2 style="margin: 0; color: #333;">New Adil Electric Concern</h2>
          <p style="margin: 5px 0; color: #666; font-size: 14px;">4-B, Jamiat Center, Shah Alam Market</p>
          <p style="margin: 5px 0; color: #666; font-size: 14px;">Lahore, Pakistan</p>
          <p style="margin: 5px 0; color: #666; font-size: 14px;">Phone: 0333-4263733 | Email: info@adilelectric.com</p>
          <p style="margin: 5px 0; color: #666; font-size: 14px;">Website: e-roshni.com</p>
        </div>
        
        <div style="margin-bottom: 20px;">
          <p style="margin: 5px 0;"><strong>Invoice #${invoiceNum}</strong></p>
          <p style="margin: 5px 0;">Date: ${new Date(sale.createdAt).toLocaleString()}</p>
          <p style="margin: 5px 0;">Cashier: ${sale.cashierName || '-'}</p>
        </div>
        
        <div style="margin-bottom: 20px; padding: 10px; background: #fff; border: 1px solid #ddd; border-radius: 3px;">
          <p style="margin: 5px 0;"><strong>Customer Information</strong></p>
          <p style="margin: 5px 0;">Name: ${sale.customerName || '-'}</p>
          <p style="margin: 5px 0;">Contact: ${sale.customerContact || '-'}</p>
          <p style="margin: 5px 0;">Email: ${sale.customerEmail || '-'}</p>
        </div>
        
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <thead>
            <tr style="background: #f0f0f0; border-bottom: 2px solid #333;">
              <th style="padding: 10px; text-align: left; font-weight: bold;">S/N</th>
              <th style="padding: 10px; text-align: left; font-weight: bold;">Item</th>
              <th style="padding: 10px; text-align: right; font-weight: bold;">Qty</th>
              <th style="padding: 10px; text-align: right; font-weight: bold;">Rate (Rs)</th>
              ${itemsHaveDiscount ? '<th style="padding: 10px; text-align: right; font-weight: bold;">Discount (Rs)</th>' : ''}
              <th style="padding: 10px; text-align: right; font-weight: bold;">SubTotal (Rs)</th>
            </tr>
          </thead>
          <tbody>
    `;
    
    let totalAmount = 0;
    (sale.items || []).forEach((it, idx) => {
      const itemTotal = (Number(it.perPiecePrice) * Number(it.quantity)) - (Number(it.discount) || 0);
      totalAmount += itemTotal;
      html += `
            <tr style="border-bottom: 1px solid #ddd;">
              <td style="padding: 10px; text-align: left;">${idx + 1}</td>
              <td style="padding: 10px; text-align: left; word-break: break-word;">${it.productName || ''}</td>
              <td style="padding: 10px; text-align: right;">${it.quantity}</td>
              <td style="padding: 10px; text-align: right;">Rs. ${it.perPiecePrice}</td>
              ${itemsHaveDiscount ? `<td style="padding: 10px; text-align: right;">Rs. ${it.discount || 0}</td>` : ''}
              <td style="padding: 10px; text-align: right;">Rs. ${itemTotal}</td>
            </tr>
      `;
    });
    
    html += `
          </tbody>
        </table>
        
        <div style="margin-bottom: 20px; padding: 15px; background: #f0f0f0; border-radius: 3px;">
          <table style="width: 100%;">
            <tr>
              <td style="padding: 5px; text-align: right;"><strong>Net Total:</strong></td>
              <td style="padding: 5px; text-align: right; font-weight: bold;">Rs. ${sale.netAmount}</td>
            </tr>
            <tr>
              <td style="padding: 5px; text-align: right;">Payment Method:</td>
              <td style="padding: 5px; text-align: right;">${sale.paymentMethod || '-'}</td>
            </tr>
            <tr>
              <td style="padding: 5px; text-align: right;">Payment Status:</td>
              <td style="padding: 5px; text-align: right;">${sale.paymentStatus || '-'}</td>
            </tr>              <tr>
                <td style="padding: 5px; text-align: right;"><strong>Paid Amount:</strong></td>
                <td style="padding: 5px; text-align: right;">Rs. ${sale.paymentMethod === 'Cash' ? (sale.cashAmount || 0) : (sale.paidAmount || 0)}</td>
              </tr>
              <tr>
                <td style="padding: 5px; text-align: right;"><strong>Change Amount:</strong></td>
                <td style="padding: 5px; text-align: right;">Rs. ${sale.changeAmount || 0}</td>
              </tr>    `;
    
    if (sale.paymentMethod === 'Cash') {
      html += `
            <tr>
              <td style="padding: 5px; text-align: right;">Cash Received:</td>
              <td style="padding: 5px; text-align: right;">Rs. ${sale.cashAmount || 0}</td>
            </tr>
            <tr>
              <td style="padding: 5px; text-align: right;">Change:</td>
              <td style="padding: 5px; text-align: right;">Rs. ${sale.changeAmount || 0}</td>
            </tr>
      `;
    } else if (sale.paymentStatus === 'Partial Paid') {
      const remaining = Math.max(0, Number(sale.netAmount) - (Number(sale.paidAmount) || 0));
      html += `
            <tr>
              <td style="padding: 5px; text-align: right;">Amount Received:</td>
              <td style="padding: 5px; text-align: right;">Rs. ${sale.paidAmount || 0}</td>
            </tr>
            <tr>
              <td style="padding: 5px; text-align: right;">Remaining:</td>
              <td style="padding: 5px; text-align: right;">Rs. ${remaining}</td>
            </tr>
      `;
    } else if (sale.paymentStatus === 'Credit') {
      html += `
            <tr>
              <td style="padding: 5px; text-align: right;">Amount Received:</td>
              <td style="padding: 5px; text-align: right;">Rs. ${sale.paidAmount || 0}</td>
            </tr>
            <tr>
              <td style="padding: 5px; text-align: right;">Due Date:</td>
              <td style="padding: 5px; text-align: right;">${sale.dueDate ? new Date(sale.dueDate).toLocaleDateString() : '-'}</td>
            </tr>
      `;
    } else {
      html += `
            <tr>
              <td style="padding: 5px; text-align: right;">Amount Paid:</td>
              <td style="padding: 5px; text-align: right;">Rs. ${sale.paidAmount || 0}</td>
            </tr>
            <tr>
              <td style="padding: 5px; text-align: right;">Change:</td>
              <td style="padding: 5px; text-align: right;">Rs. ${sale.changeAmount || 0}</td>
            </tr>
      `;
    }
    
    html += `
          </table>
        </div>
        
        <div style="text-align: center; padding: 15px; color: #666; font-size: 14px; border-top: 1px solid #ddd;">
          <p style="margin: 0;">Thank you for your business!</p>
          <p style="margin: 5px 0; font-size: 12px; color: #999;">This is an automated invoice. Please retain this email for your records.</p>
        </div>
      </div>
    `;

    // attempt send to customer
    const mailRes = await sendInvoiceEmail(sale.customerEmail, subject, html);
    if (mailRes.success) {
      const messageId = mailRes.result?.messageId || '';
      await Sale.findByIdAndUpdate(saleId, { emailStatus: 'sent', emailError: '', emailMessageId: messageId }).catch(()=>{});
      
      // Also send to admin
      const adminEmail = 'adilelectric17@gmail.com';
      const paidVal = sale.paymentMethod === 'Cash' ? (sale.cashAmount || 0) : (sale.paidAmount || 0);
      const adminSubject = `[ADMIN] Invoice #${invoiceNum} - ${sale.customerName || 'Unknown Customer'} - Net Rs. ${sale.netAmount} - Paid Rs. ${paidVal} - Change Rs. ${sale.changeAmount || 0}`;
      
      const updated = await Sale.findById(saleId).lean();
      return res.json({ success: true, sale: updated });
    } else {
      const errStr = typeof mailRes.error === 'string' ? mailRes.error : JSON.stringify(mailRes.error);
      await Sale.findByIdAndUpdate(saleId, { emailStatus: 'failed', emailError: errStr }).catch(()=>{});
      const updated = await Sale.findById(saleId).lean();
      return res.status(500).json({ success: false, error: errStr, sale: updated });
    }
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
};

// Refund items from a sale and restock products (POST /sales/:id/refund)
exports.refundSale = async (req, res) => {
  try {
    const saleId = req.params.id;
    const { items, reason } = req.body; // items: [{ productId, quantity }]
    const user = req.user || null; // set by auth middleware
    const sale = await Sale.findById(saleId);
    if (!sale) return res.status(404).json({ success: false, message: 'Sale not found' });
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ success: false, message: 'No items specified for refund' });

    // Build a map of original sale quantities and already refunded quantities
    // Key by productId if present, otherwise by SKU (so we can handle items that stored only SKU)
    const origMap = new Map();
    (sale.items || []).forEach(it => {
      const key = String(it.productId || it.SKU || it._id || '');
      origMap.set(key, { quantity: Number(it.quantity) || 0, perPiecePrice: Number(it.perPiecePrice) || 0, productName: it.productName || '', SKU: it.SKU || '' });
    });
    const refundedSoFar = new Map();
    (sale.refunds || []).forEach(r => { (r.items||[]).forEach(it => { const k = String(it.productId || it.SKU || it._id || ''); refundedSoFar.set(k, (refundedSoFar.get(k)||0) + (Number(it.quantity)||0)); }); });

    const refundRecordItems = [];
    let totalRefundQty = 0;
    let totalRefundAmount = 0;

    for (const it of items) {
      const key = String(it.productId || it.SKU || it._id || '');
      const reqQty = Number(it.quantity) || 0;
      if (!key || reqQty <= 0) continue;
      const orig = origMap.get(key);
      if (!orig) return res.status(400).json({ success: false, message: `Product not found in sale: ${it.productName || key}` });
      const already = Number(refundedSoFar.get(key) || 0);
      const maxRefundable = Math.max(0, (Number(orig.quantity) || 0) - already);
      if (reqQty > maxRefundable) return res.status(400).json({ success: false, message: `Refund qty for ${orig.productName || key} exceeds refundable amount (${maxRefundable})` });

      refundRecordItems.push({ productId: key, productName: orig.productName, SKU: orig.SKU, quantity: reqQty, perPiecePrice: Number(orig.perPiecePrice) || 0 });
      totalRefundQty += reqQty;
      totalRefundAmount += (Number(orig.perPiecePrice) || 0) * reqQty;
    }

    if (refundRecordItems.length === 0) return res.status(400).json({ success: false, message: 'No valid refund items' });

    // Restock products and update product derived fields
    for (const rit of refundRecordItems) {
      // try find by id first, then by SKU, then by treating rit.productId as SKU
      let product = null;
      if (rit.productId) {
        try { product = await Product.findById(rit.productId); } catch (e) { product = null; }
      }
      if (!product && rit.SKU) {
        product = await Product.findOne({ SKU: rit.SKU });
      }
      if (!product && rit.productId) {
        // rit.productId might actually be an SKU string
        product = await Product.findOne({ SKU: rit.productId });
      }
      if (!product) continue; // skip if missing
      const addPieces = Number(rit.quantity) || 0;
      const piecesPerCarton = Number(product.piecesPerCarton) || 0;
      const currentTotalPieces = Number(product.totalPieces) || ((Number(product.cartonQuantity) || 0) * piecesPerCarton) + (Number(product.losePieces) || 0);
      const newTotalPieces = currentTotalPieces + addPieces;

      let newCartons = Number(product.cartonQuantity) || 0;
      let newLosePieces = Number(product.losePieces) || 0;
      if (piecesPerCarton > 0) {
        newCartons = Math.floor(newTotalPieces / piecesPerCarton);
        newLosePieces = newTotalPieces % piecesPerCarton;
      } else {
        newLosePieces = newTotalPieces;
      }
      const stockQuantity = newCartons + (newLosePieces > 0 ? 1 : 0);

      product.totalPieces = newTotalPieces;
      product.cartonQuantity = newCartons;
      product.losePieces = newLosePieces;
      product.stockQuantity = stockQuantity;

      const costPerPiece = Number(product.costPerPiece) || 0;
      const sellingPerPiece = Number(product.sellingPerPiece) || 0;
      product.totalUnitCost = costPerPiece * newTotalPieces;
      product.perPieceProfit = sellingPerPiece - costPerPiece;
      product.totalUnitProfit = product.perPieceProfit * newTotalPieces;

      await product.save();
    }

    // Append refund record to sale
    const refundRecord = {
      items: refundRecordItems.map(i => ({ productId: i.productId, productName: i.productName, SKU: i.SKU, quantity: i.quantity, perPiecePrice: i.perPiecePrice })),
      totalRefundQty: totalRefundQty,
      totalRefundAmount: totalRefundAmount,
      refundedBy: user?._id || undefined,
      refundedByName: user?.username || user?.name || (req.user && req.user.email) || 'system',
      refundedByRole: user?.role || 'seller',
      reason: reason || ''
    };
    sale.refunds = sale.refunds || [];
    sale.refunds.push(refundRecord);

    // adjust sale totals (reduce totalQuantity and netAmount)
    sale.totalQuantity = Math.max(0, Number(sale.totalQuantity || 0) - totalRefundQty);
    sale.netAmount = Math.max(0, Number(sale.netAmount || 0) - totalRefundAmount);

    await sale.save();

    const updated = await Sale.findById(saleId).lean();
    // Send refund notification email to admin with basic refund invoice
    try {
      const adminEmail = process.env.ADMIN_EMAIL || 'adilelectric17@gmail.com';
      const subject = `Refund processed - Invoice #${String(sale._id).slice(-6)}`;
      const itemsHtml = refundRecord.items.map(it => `<tr><td>${it.productName}</td><td style="text-align:right">${it.quantity}</td><td style="text-align:right">${(it.perPiecePrice||0).toFixed(2)}</td><td style="text-align:right">${((it.perPiecePrice||0)*it.quantity).toFixed(2)}</td></tr>`).join('');
      const html = `
        <div style="font-family: Arial, sans-serif; max-width:600px;">
          <h2>Refund Invoice</h2>
          <p><strong>Original Sale:</strong> ${sale._id?.toString?.() || ''}</p>
          <p><strong>Seller:</strong> ${sale.sellerName || sale.sellerId || '-'}<br/> <strong>Customer:</strong> ${sale.customerName || '-'} (${sale.customerContact || '-'})</p>
          <table style="width:100%; border-collapse:collapse;">
            <thead><tr><th style="text-align:left">Item</th><th style="text-align:right">Qty</th><th style="text-align:right">Rate</th><th style="text-align:right">Amount</th></tr></thead>
            <tbody>${itemsHtml}</tbody>
            <tfoot>
              <tr><td colspan="2"></td><td style="text-align:right"><strong>Total Refund</strong></td><td style="text-align:right"><strong>Rs. ${totalRefundAmount.toFixed(2)}</strong></td></tr>
            </tfoot>
          </table>
          <p>Reason: ${refundRecord.reason || '-'}</p>
        </div>
      `;
      // send in background
      sendInvoiceEmail(adminEmail, subject, html).catch(()=>{});
    } catch (e) {
      console.error('Failed to send refund email to admin:', e);
    }
    return res.json({ success: true, sale: updated });
  } catch (e) {
    console.error('Refund error', e);
    return res.status(500).json({ success: false, message: e.message || 'Refund failed' });
  }
};

// Claim warranty for items in a sale and reduce product stock (POST /sales/:id/warranty-claim)
exports.claimWarranty = async (req, res) => {
  try {
    const saleId = req.params.id;
    const { items, reason } = req.body; // items: [{ productId, quantity }]
    const user = req.user || null; // set by auth middleware
    const sale = await Sale.findById(saleId);
    if (!sale) return res.status(404).json({ success: false, message: 'Sale not found' });
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ success: false, message: 'No items specified for warranty claim' });

    // Build map of original sale quantities
    const origMap = new Map();
    (sale.items || []).forEach(it => {
      const key = String(it.productId || it.SKU || it._id || '');
      origMap.set(key, { quantity: Number(it.quantity) || 0, productName: it.productName || '', SKU: it.SKU || '' });
    });

    // Already claimed warranty quantities
    const claimedSoFar = new Map();
    (sale.warrantyClaims || []).forEach(wc => {
      (wc.items || []).forEach(it => {
        const k = String(it.productId || it.SKU || it._id || '');
        claimedSoFar.set(k, (claimedSoFar.get(k) || 0) + (Number(it.quantity) || 0));
      });
    });

    const claimItems = [];
    let totalWarrantyQty = 0;

    for (const it of items) {
      const key = String(it.productId || it.SKU || it._id || '');
      const reqQty = Number(it.quantity) || 0;
      if (!key || reqQty <= 0) continue;
      const orig = origMap.get(key);
      if (!orig) return res.status(400).json({ success: false, message: `Product not found in sale: ${it.productName || key}` });

      // Check warranty validity based on product warrantyMonths and sale createdAt
      let product = null;
      if (it.productId) {
        try { product = await Product.findById(it.productId); } catch (e) { product = null; }
      }
      if (!product && orig.SKU) {
        product = await Product.findOne({ SKU: orig.SKU });
      }
      if (!product) return res.status(400).json({ success: false, message: `Product not found for warranty check: ${orig.productName || key}` });

      const warrantyMonths = product.warrantyMonths == null ? 0 : Number(product.warrantyMonths);
      if (warrantyMonths <= 0) {
        return res.status(400).json({ success: false, message: `No warranty available for ${orig.productName || key}` });
      }
      const saleDate = new Date(sale.createdAt || Date.now());
      const warrantyUntil = new Date(saleDate);
      warrantyUntil.setMonth(warrantyUntil.getMonth() + warrantyMonths);
      if (new Date() > warrantyUntil) {
        return res.status(400).json({ success: false, message: `Warranty expired for ${orig.productName || key}` });
      }

      const already = Number(claimedSoFar.get(key) || 0);
      const maxClaimable = Math.max(0, (Number(orig.quantity) || 0) - already);
      if (reqQty > maxClaimable) {
        return res.status(400).json({ success: false, message: `Warranty claim qty for ${orig.productName || key} exceeds remaining claimable amount (${maxClaimable})` });
      }

      claimItems.push({ productId: it.productId || null, productName: orig.productName, SKU: orig.SKU, quantity: reqQty });
      totalWarrantyQty += reqQty;
    }

    if (claimItems.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid warranty claim items' });
    }

    // Reduce product stock for claimed items and update warrantyClaimedPieces
    for (const ci of claimItems) {
      let product = null;
      if (ci.productId) {
        try { product = await Product.findById(ci.productId); } catch (e) { product = null; }
      }
      if (!product && ci.SKU) {
        product = await Product.findOne({ SKU: ci.SKU });
      }
      if (!product && ci.productId) {
        product = await Product.findOne({ SKU: ci.productId });
      }
      if (!product) continue;

      const claimPieces = Number(ci.quantity) || 0;
      const piecesPerCarton = Number(product.piecesPerCarton) || 0;
      const currentTotalPieces = Number(product.totalPieces) || ((Number(product.cartonQuantity) || 0) * piecesPerCarton) + (Number(product.losePieces) || 0);
      if (claimPieces > currentTotalPieces) {
        return res.status(400).json({ success: false, message: `Insufficient stock for warranty claim on ${product.name}. In stock: ${currentTotalPieces}, requested: ${claimPieces}` });
      }
      const newTotalPieces = currentTotalPieces - claimPieces;

      let newCartons = Number(product.cartonQuantity) || 0;
      let newLosePieces = Number(product.losePieces) || 0;
      if (piecesPerCarton > 0) {
        newCartons = Math.floor(newTotalPieces / piecesPerCarton);
        newLosePieces = newTotalPieces % piecesPerCarton;
      } else {
        newLosePieces = newTotalPieces;
      }
      const stockQuantity = newCartons + (newLosePieces > 0 ? 1 : 0);

      product.totalPieces = newTotalPieces;
      product.cartonQuantity = newCartons;
      product.losePieces = newLosePieces;
      product.stockQuantity = stockQuantity;

      const costPerPiece = Number(product.costPerPiece) || 0;
      const sellingPerPiece = Number(product.sellingPerPiece) || 0;
      product.totalUnitCost = costPerPiece * newTotalPieces;
      product.perPieceProfit = sellingPerPiece - costPerPiece;
      product.totalUnitProfit = product.perPieceProfit * newTotalPieces;

      product.warrantyClaimedPieces = Number(product.warrantyClaimedPieces || 0) + claimPieces;

      await product.save();
    }

    const claimRecord = {
      items: claimItems.map(i => ({ productId: i.productId, productName: i.productName, SKU: i.SKU, quantity: i.quantity })),
      totalWarrantyQty,
      claimedBy: user?._id || undefined,
      claimedByName: user?.username || user?.name || (req.user && req.user.email) || 'system',
      claimedByRole: user?.role || 'seller',
      reason: reason || ''
    };

    sale.warrantyClaims = sale.warrantyClaims || [];
    sale.warrantyClaims.push(claimRecord);

    await sale.save();

    const updated = await Sale.findById(saleId).lean();
    return res.json({ success: true, sale: updated });
  } catch (e) {
    console.error('Warranty claim error', e);
    return res.status(500).json({ success: false, message: e.message || 'Warranty claim failed' });
  }
};
