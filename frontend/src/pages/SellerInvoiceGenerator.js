import React, { useRef } from 'react';
import { Box, Typography, Table, TableBody, TableCell, TableRow, Paper, Button, Divider } from '@mui/material';
import jsPDF from 'jspdf';

// Replace with real sale data (for testing)
const dummySale = {
  _id: 'abcdef123456',
  createdAt: new Date().toISOString(),
  sellerName: 'Seller One',
  customerName: 'Ali',
  customerContact: '0300-1234567',
  items: [
    { productName: 'Light Bulb', quantity: 10, perPiecePrice: 150, discount: 0, subtotal: 1500 },
    { productName: 'Fan', quantity: 2, perPiecePrice: 3500, discount: 200, subtotal: 6800 },
  ],
  totalQuantity: 12,
  totalAmount: 8300,
  discountTotal: 200,
  netAmount: 8100,
  paymentStatus: 'Paid',
};

const COMPANY = {
  name: 'New Adil Electric Concern',
  address: '4-B, Jamiat Center, Sha Alam Market',
  city: 'Lahore, Pakistan',
  phone: '(042) 123-4567',
  email: 'info@adilelectric.com',
};

const SellerInvoiceGenerator = ({ sale = dummySale }) => {
  const printRef = useRef();

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(15);
    doc.text(COMPANY.name, 14, 16);
    doc.setFontSize(10);
    doc.text(COMPANY.address, 14, 22);
    doc.text(COMPANY.city, 14, 27);
    doc.text(`Phone: ${COMPANY.phone}`, 14, 32);
    doc.text(`Email: ${COMPANY.email}`, 14, 37);
    doc.setFontSize(12);
    doc.text(`Invoice #${sale._id?.slice(-6) || ''}`, 160, 16);
    doc.text(`Date: ${new Date(sale.createdAt).toLocaleDateString()}`, 160, 22);
    doc.text(`Seller: ${sale.sellerName}`, 14, 48);
    doc.text(`Customer: ${sale.customerName || '-'}`, 14, 54);
    doc.text(`Contact: ${sale.customerContact || '-'}`, 14, 60);
    let y = 68;
    doc.setFontSize(11);
    doc.text('Product', 14, y);
    doc.text('Qty', 84, y);
    doc.text('Rate', 110, y);
    doc.text('Disc.', 130, y);
    doc.text('Subtotal', 160, y);
    y += 7;
    sale.items.forEach((item) => {
      doc.text(String(item.productName), 14, y);
      doc.text(String(item.quantity), 84, y);
      doc.text(`Rs. ${item.perPiecePrice}`, 110, y);
      doc.text(`Rs. ${item.discount || 0}`, 130, y);
      doc.text(`Rs. ${item.subtotal}`, 160, y);
      y += 7;
    });
    y += 5;
    doc.text(`Total Qty: ${sale.totalQuantity}`, 14, y);
    doc.text(`Gross: Rs. ${sale.totalAmount}`, 110, y);
    y += 6;
    doc.text(`Total Discount: Rs. ${sale.discountTotal}`, 110, y);
    y += 6;
    doc.setFontSize(13);
    doc.text(`Net Payable: Rs. ${sale.netAmount}`, 110, y);
    y += 8;
    doc.setFontSize(11);
    doc.text(`Payment Status: ${sale.paymentStatus}`, 14, y);
    doc.save(`Invoice_${sale._id?.slice(-6) || ''}_${new Date(sale.createdAt).toLocaleDateString()}.pdf`);
  };

  return (
    <Box ref={printRef} sx={{ maxWidth: 680, mx: 'auto', mt: 5 }}>
      <Paper sx={{ p: 4, borderRadius: 3, mb: 4 }}>
        {/* Company Header */}
        <Box sx={{ textAlign: 'center', mb: 2 }}>
          <Typography variant="h4" fontWeight="bold">{COMPANY.name}</Typography>
          <Typography>{COMPANY.address}, {COMPANY.city}</Typography>
          <Typography>Phone: {COMPANY.phone} | Email: {COMPANY.email}</Typography>
        </Box>
        <Divider sx={{ my: 2 }} />
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="subtitle1">Invoice #{sale._id?.slice(-6)}</Typography>
          <Typography variant="subtitle1">Date: {new Date(sale.createdAt).toLocaleDateString()}</Typography>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="subtitle2">Seller: {sale.sellerName}</Typography>
          <Typography variant="subtitle2">Customer: {sale.customerName || '-'}</Typography>
          <Typography variant="subtitle2">Contact: {sale.customerContact || '-'}</Typography>
        </Box>
        <Divider sx={{ my: 1 }} />
        <Table>
          <TableBody>
            <TableRow>
              <TableCell><strong>Product</strong></TableCell>
              <TableCell align="right"><strong>Qty</strong></TableCell>
              <TableCell align="right"><strong>Rate</strong></TableCell>
              <TableCell align="right"><strong>Disc.</strong></TableCell>
              <TableCell align="right"><strong>Subtotal</strong></TableCell>
            </TableRow>
            {sale.items.map((item, idx) => (
              <TableRow key={idx}>
                <TableCell>{item.productName}</TableCell>
                <TableCell align="right">{item.quantity}</TableCell>
                <TableCell align="right">Rs. {item.perPiecePrice}</TableCell>
                <TableCell align="right">Rs. {item.discount || 0}</TableCell>
                <TableCell align="right">Rs. {item.subtotal}</TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell colSpan={3}></TableCell>
              <TableCell><strong>Total:</strong></TableCell>
              <TableCell align="right">Rs. {sale.totalAmount}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell colSpan={3}></TableCell>
              <TableCell><strong>Discount:</strong></TableCell>
              <TableCell align="right">Rs. {sale.discountTotal}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell colSpan={3}></TableCell>
              <TableCell><strong>Net Payable:</strong></TableCell>
              <TableCell align="right"><strong>Rs. {sale.netAmount}</strong></TableCell>
            </TableRow>
            <TableRow>
              <TableCell colSpan={3}></TableCell>
              <TableCell><strong>Status:</strong></TableCell>
              <TableCell align="right">{sale.paymentStatus}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <Divider sx={{ my: 2 }} />
        <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
          <Button variant="contained" color="primary" onClick={handlePrint}>Print Invoice</Button>
          <Button variant="outlined" color="secondary" onClick={handleDownloadPDF}>Download PDF</Button>
        </Box>
      </Paper>
    </Box>
  );
};

export default SellerInvoiceGenerator;
