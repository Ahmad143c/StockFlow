import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useSelector } from 'react-redux';
import API from '../api/api';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  TextField,
  MenuItem,
  Grid,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Chip,
  Tooltip,
  useTheme,
  useMediaQuery,
  InputAdornment,
  Alert,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import EditIcon from '@mui/icons-material/Edit';
import PrintIcon from '@mui/icons-material/Print';
import ReceiptIcon from '@mui/icons-material/Receipt';
import EmailIcon from '@mui/icons-material/Email';
import MoneyOffIcon from '@mui/icons-material/MoneyOff';
import { generateInvoiceHTML } from '../utils/invoiceUtils';
import { useDarkMode } from '../context/DarkModeContext';

const SellerSalesReport = () => {
  const theme = useTheme();
  const isSm = useMediaQuery(theme.breakpoints.down('sm'));
  const { darkMode } = useDarkMode();
  const [sales, setSales] = useState([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [refundTarget, setRefundTarget] = useState(null);
  const [refundItems, setRefundItems] = useState([]);
  const [refundReason, setRefundReason] = useState('');
  const [highlightId, setHighlightId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [printPreviewOpen, setPrintPreviewOpen] = useState(false);
  const [printPreviewHtml, setPrintPreviewHtml] = useState('');
  // feedback messages for the user
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const products = useSelector(state => (state?.products?.items) ?? []);
  const previewRef = useRef(null);

  // move fetchSales to component scope so other handlers can reuse it
  const fetchSales = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const payload = JSON.parse(atob(token.split('.')[1]));
      const res = await API.get(`/sales?sellerId=${payload.id}`, { headers: { Authorization: `Bearer ${token}` } });
      setSales(res.data);
      const params = new URLSearchParams(window.location.search);
      const highlight = params.get('highlight');
      if (highlight) {
        const match = res.data.find(s => s._id === highlight || String(s.invoiceNumber) === highlight);
        if (match) {
          setHighlightId(match._id);
          setTimeout(() => {
            const el = document.getElementById(`seller-sale-${match._id}`);
            if (el?.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 100);
          setTimeout(() => setHighlightId(''), 4000);
        }
      }
    } catch {
      setSales([]);
    }
  }, []);

  const onChanged = useCallback(() => fetchSales(), [fetchSales]);
  const onStorage = useCallback((e) => { if (e.key === 'sales:changed') fetchSales(); }, [fetchSales]);
  const onFocus = useCallback(() => fetchSales(), [fetchSales]);

  useEffect(() => {
    fetchSales();
    window.addEventListener('sales:changed', onChanged);
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', onFocus);
    return () => { window.removeEventListener('sales:changed', onChanged); window.removeEventListener('storage', onStorage); window.removeEventListener('focus', onFocus); };
  }, [fetchSales, onChanged, onStorage, onFocus]);

  const filteredSales = useMemo(() => {
    return sales.filter(sale => {
      const hasActive = (Number(sale.totalQuantity) || Number(sale.netAmount) || 0) > 0;
      const q = (search || '').toString().trim().toLowerCase();
      const matchesSearch = !q || (
        (sale.items || []).some(i => i.productName?.toLowerCase().includes(q)) ||
        (sale.cashierName || '').toLowerCase().includes(q) ||
        (sale.customerName || '').toLowerCase().includes(q) ||
        String(sale.invoiceNumber || '').toLowerCase().includes(q) ||
        (sale._id || '').toLowerCase().includes(q)
      );
      const matchesStatus = !status || sale.paymentStatus === status;
      const created = new Date(sale.createdAt);
      const matchesStart = !startDate || created >= new Date(startDate + 'T00:00:00');
      const matchesEnd = !endDate || created <= new Date(endDate + 'T23:59:59');
      return hasActive && matchesSearch && matchesStatus && matchesStart && matchesEnd;
    });
  }, [sales, search, status, startDate, endDate]);

  // Helper: calculate refunded quantity for an item
  const calculateRefundedQty = useCallback((sale, productId) => {
    let refundedQty = 0;
    (sale.refunds || []).forEach(refund => {
      (refund.items || []).forEach(refundItem => {
        if (String(refundItem.productId) === String(productId)) {
          refundedQty += Number(refundItem.quantity) || 0;
        }
      });
    });
    return refundedQty;
  }, []);

  const handlePrintReport = useCallback(() => {
    const rows = filteredSales;
    const start = startDate || 'All time';
    const end = endDate || 'Now';

    const grandTotalRevenue = rows.reduce((sum, r) => sum + Number(r.netAmount), 0);
    const grandTotalDiscount = rows.reduce((sum, r) => sum + Number(r.discountAmount || 0), 0);
    const grandTotalQty = rows.reduce((sum, r) => {
      return sum + r.items.reduce((itemSum, item) => {
        const refundedQty = calculateRefundedQty(r, item.productId);
        return itemSum + Math.max(0, Number(item.quantity || 0) - refundedQty);
      }, 0);
    }, 0);

    const rowsHtml = rows.map((r, idx) => {
      const invoice = r.invoiceNumber || (r._id ? r._id.substr(-6) : '');
      const items = r.items.map(i => i.productName).join(', ');
      const qty = r.items.reduce((sum, item) => {
        const refundedQty = calculateRefundedQty(r, item.productId);
        return sum + Math.max(0, Number(item.quantity || 0) - refundedQty);
      }, 0);
      const bgColor = idx % 2 === 0 ? '#fff' : '#f9f9f9';
      return `
        <tr style="background-color: ${bgColor};">
          <td style="text-align: center;">${idx + 1}</td>
          <td>${new Date(r.createdAt).toLocaleDateString()}</td>
          <td>${invoice}</td>
          <td>${items.length > 20 ? items.substring(0, 20) + '...' : items}</td>
          <td style="text-align: right;">${qty}</td>
          <td style="text-align: right;">${Number(r.netAmount).toFixed(2)}</td>
          <td style="text-align: right;">${Number(r.discountAmount || 0).toFixed(2)}</td>
          <td>${r.paymentStatus}</td>
        </tr>
      `;
    }).join('');

    const html = `
      <html><head>
        <title>Sales Report ${start} - ${end}</title>
        <style>
          body { 
            font-family: Arial, sans-serif;
            padding: 30px;
            margin: 0;
            background-color: #fff;
          }
          .header {
            text-align: center;
            border-bottom: 3px solid #1976d2;
            padding-bottom: 8px;
            margin-bottom: 10px;
          }
          .header h1 {
            margin: 0 0 2px 0;
            color: #1976d2;
            font-size: 20px;
          }
          .header p {
            margin: 2px 0;
            color: #666;
            font-size: 11px;
          }
          .info-section {
            background-color: #f9f9f9;
            border-left: 4px solid #1976d2;
            padding: 8px;
            margin-bottom: 10px;
            border-radius: 2px;
          }
          .info-section .info-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 4px;
            font-size: 12px;
          }
          .info-section .info-row:last-child {
            margin-bottom: 0;
          }
          .info-label {
            font-weight: 600;
            color: #333;
          }
          .info-value {
            color: #666;
          }
          table { 
            width: 100%; 
            border-collapse: collapse;
            margin-bottom: 10px;
            font-size: 12px;
          }
          th {
            background-color: #1976d2;
            color: white;
            padding: 8px;
            text-align: left;
            font-weight: 600;
            border: none;
          }
          td { 
            padding: 6px 8px;
            border-bottom: 1px solid #e0e0e0;
          }
          .total-row {
            background-color: #e3f2fd;
            font-weight: 600;
            border-top: 2px solid #1976d2;
            border-bottom: 2px solid #1976d2;
          }
          .total-row td {
            padding: 12px;
            color: #1976d2;
          }
          .right { text-align: right; }
          @media print {
            body { padding: 15px; margin: 0; }
            .header { page-break-inside: avoid; padding-bottom: 5px; margin-bottom: 5px; }
            .info-section { page-break-inside: avoid; }
            table { page-break-inside: auto; }
            tr { page-break-inside: avoid; }
          }
        </style>
      </head><body>
        <div class="header">
          <h1>Sales Report</h1>
          <p>Generated on ${new Date().toLocaleString()}</p>
        </div>
        <div class="info-section">
          <div class="info-row">
            <span class="info-label">Period:</span>
            <span class="info-value">${start} to ${end}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Total Sales:</span>
            <span class="info-value">${rows.length}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Total Revenue:</span>
            <span class="info-value">Rs. ${grandTotalRevenue.toFixed(2)}</span>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 6%;">S/N</th>
              <th style="width: 12%;">Date</th>
              <th style="width: 10%;">Invoice</th>
              <th style="width: 26%;">Items</th>
              <th style="width: 8%;" class="right">Qty</th>
              <th style="width: 10%;" class="right">Revenue</th>
              <th style="width: 10%;" class="right">Discount</th>
              <th style="width: 12%;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
            <tr class="total-row">
              <td colspan="4" style="text-align: right;">Grand Total:</td>
              <td class="right">${grandTotalQty}</td>
              <td class="right">Rs. ${grandTotalRevenue.toFixed(2)}</td>
              <td class="right">Rs. ${grandTotalDiscount.toFixed(2)}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </body></html>
    `;
    const w = window.open('', '_blank');
    if (!w || !w.document) {
      alert('Popup blocked. Allow popups to print.');
      return;
    }
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 250);
  }, [filteredSales, calculateRefundedQty]);

  const handleViewInvoice = useCallback((sale) => {
    const html = generateInvoiceHTML(sale, products);
    setPrintPreviewHtml(html);
    setPrintPreviewOpen(true);
  }, [products]);

  const handleResendEmail = useCallback(async (saleId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await API.post(`/sales/${saleId}/resend-email`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data && res.data.success) {
        setSuccess('Invoice email resent successfully');
        await fetchSales();
      } else {
        setError(res.data?.message || 'Failed to resend email');
      }
    } catch (e) {
      setError(e.response?.data?.message || e.message || 'Failed to resend email');
    }
  }, [fetchSales]);

  const cellSx = useMemo(() => ({
    maxWidth: { xs: 80, sm: 120, md: 160, lg: 240 },
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: { xs: '0.75rem', sm: '0.875rem' },
    padding: { xs: '6px 8px', sm: '12px 16px' },
    color: darkMode ? '#fff' : 'inherit'
  }), [darkMode]);

  const headerCellSx = useMemo(() => ({
    fontWeight: 'bold',
    fontSize: { xs: '0.75rem', sm: '0.875rem' },
    padding: { xs: '8px 6px', sm: '12px 16px' },
    backgroundColor: darkMode ? '#2a2a2a' : '#fff',
    color: darkMode ? '#fff' : 'inherit'
  }), [darkMode]);

  return (
    <>
      <Box sx={{
        maxWidth: { xs: '100%', lg: 1800 },
        minWidth: 0,
        boxSizing: 'border-box',
        overflowX: 'hidden',
        px: { xs: 1, sm: 1, md: 2 },
        mt: { xs: 1, sm: 2, md: 3 },
        pb: 1,
        background: `linear-gradient(135deg, ${darkMode ? '#1a1a2e' : '#f8f9fa'} 0%, ${darkMode ? '#16213e' : '#e9ecef'} 100%)`,
        minHeight: '100vh',
        mx: 'auto',
        position: 'relative',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '4px',
          background: 'linear-gradient(90deg, #1976d2 0%, #42a5f5 50%, #1976d2 100%)',
          zIndex: 1
        }
      }}>
        <Paper elevation={6} sx={{
          p: { xs: 1, sm: 2, md: 4 },
          borderRadius: { xs: 3, sm: 2, md: 6 },
          background: `linear-gradient(135deg, ${darkMode ? '#2a2a2a' : '#ffffff'} 0%, ${darkMode ? '#1e1e1e' : '#f8f9fa'} 100%)`,
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15), 0 10px 20px rgba(0, 0, 0, 0.1)',
          maxWidth: { xs: 'calc(90vw - 16px)', sm: '100%', md: 'calc(106vw - 300px)' },
          width: '100%',
          overflowX: 'hidden',
          mx: 'auto',
          minWidth: 0,
          position: 'relative',
          border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'}`,
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '3px',
            background: 'linear-gradient(90deg, #1976d2 0%, #42a5f5 50%, #1976d2 100%)',
            borderRadius: '3px 3px 0 0',
          }
        }}>
        <Typography variant="h4" mb={3} color="primary">Sales Report</Typography>
        {success && <Alert severity="success" onClose={() => setSuccess('')} sx={{ mb:2 }}>{success}</Alert>}
        {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb:2 }}>{error}</Alert>}
        <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextField label="Search Product/Cashier/Customer/Invoice" value={search} onChange={e => setSearch(e.target.value)}  />
          <TextField select label="Status" value={status} onChange={e => setStatus(e.target.value)} sx={{ minWidth: 140 }}>
            <MenuItem value="">All</MenuItem>
            <MenuItem value="Paid">Paid</MenuItem>
            <MenuItem value="Partial">Partial</MenuItem>
            <MenuItem value="Unpaid">Unpaid</MenuItem>
          </TextField>
          <TextField label="Start Date" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} InputLabelProps={{ shrink: true }} />
          <TextField label="End Date" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} InputLabelProps={{ shrink: true }} />
          <Button variant="contained" startIcon={<PrintIcon />} onClick={() => handlePrintReport()} sx={{ ml: 'auto' }}>Print Report</Button>
        </Box>

        {/* Insert actions header */}
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>S/N</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Date</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Invoice #</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Customer</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Cashier</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Items</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Item Price</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }} align="right">Qty</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }} align="right">Total (Rs)</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }} align="center">Warranty</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Email</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }} align="center">Invoice</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }} align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredSales.map((sale, idx) => {
                const created = new Date(sale.createdAt);
                const warrantyUntil = new Date(created);
                warrantyUntil.setFullYear(warrantyUntil.getFullYear() + 1);
                const underWarranty = new Date() <= warrantyUntil;

                const perItem = new Map();
                (sale.warrantyClaims || []).forEach(wc => {
                  (wc.items || []).forEach(ci => {
                    const key = String(ci.productName || ci.SKU || ci.productId || '');
                    if (!key) return;
                    const prev = perItem.get(key) || { claimed: 0, firstClaim: null };
                    const q = Number(ci.quantity) || 0;
                    prev.claimed += q;
                    const claimDate = wc.createdAt ? new Date(wc.createdAt) : null;
                    if (claimDate && (!prev.firstClaim || claimDate < prev.firstClaim)) {
                      prev.firstClaim = claimDate;
                    }
                    perItem.set(key, prev);
                  });
                });

                const warrantyTooltip = (
                  <Box sx={{ p: 0.5 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      Warranty details for this invoice
                    </Typography>
                    {perItem.size === 0 ? (
                      <Typography variant="caption" display="block">
                        No warranty claims on this invoice.
                      </Typography>
                    ) : (
                      Array.from(perItem.entries()).map(([name, info]) => (
                        <Typography key={name} variant="caption" display="block">
                          {name}: warranty claimed {info.claimed} pcs
                          {info.firstClaim
                            ? ` (first claim: ${info.firstClaim.toLocaleString()})`
                            : ''}
                        </Typography>
                      ))
                    )}
                  </Box>
                );

                return (
                  <TableRow
                    key={sale._id}
                    id={`seller-sale-${sale._id}`}
                    sx={{ backgroundColor: sale._id === highlightId ? 'rgba(255, 235, 59, 0.35)' : 'inherit' }}
                  >
                    <TableCell>{idx + 1}</TableCell>
                    <TableCell>{new Date(sale.createdAt).toLocaleString()}</TableCell>
                    <TableCell>{sale.invoiceNumber || (sale._id ? sale._id.substr(-6) : '')}</TableCell>
                    <TableCell>{sale.customerName || '-'}</TableCell>
                    <TableCell>{sale.cashierName || '-'}</TableCell>
                    <TableCell>{sale.items.map(i => {
                      const origQty = Number(i.quantity) || 0;
                      let refunded = 0;
                      (sale.refunds || []).forEach(r => {
                        (r.items || []).forEach(it => {
                          if (String(it.productId) === String(i.productId)) {
                            refunded += Number(it.quantity) || 0;
                          }
                        });
                      });
                      const remaining = origQty - refunded;
                      return `${i.productName || '-'} x${remaining}${refunded ? ` (-${refunded} ref)` : ''}`;
                    }).join(', ')}</TableCell>
                    <TableCell>{sale.items.map(i => `Rs. ${Number(i.perPiecePrice||0).toLocaleString()}`).join(', ')}</TableCell>
                    <TableCell align="right">{sale.totalQuantity}</TableCell>
                    <TableCell align="right">{sale.netAmount}</TableCell>
                    <TableCell>{sale.paymentStatus}</TableCell>
                    <TableCell>
                      {underWarranty ? (
                        <Tooltip title={warrantyTooltip} arrow>
                          <Chip
                            label={`${warrantyUntil.toLocaleDateString()}`}
                            size="small"
                            color="success"
                            sx={{
                              height: 35,
                              fontSize: '0.7rem',
                              '& .MuiChip-label': { whiteSpace: 'pre-line' },
                            }}
                          />
                        </Tooltip>
                      ) : (
                        <Tooltip title="Warranty expired" arrow>
                          <Chip
                            label="Warranty expired"
                            size="small"
                            color="default"
                            sx={{ height: 22, fontSize: '0.7rem' }}
                          />
                        </Tooltip>
                      )}
                    </TableCell>
                    <TableCell>
                      {sale.emailStatus === 'sent' && <Box sx={{ color: '#4caf50', fontWeight: 600 }}>✉ Sent</Box>}
                      {sale.emailStatus === 'failed' && (
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                          <Box sx={{ color: '#f44336', fontWeight: 600 }}>✉ Failed</Box>
                          <Button size="small" onClick={() => handleResendEmail(sale._id)} variant="outlined">
                            Resend
                          </Button>
                        </Box>
                      )}
                      {sale.emailStatus === 'pending' && (
                        <Box sx={{ color: '#9e9e9e', fontWeight: 600 }}>⧐ Pending</Box>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        onClick={() => {
                          const html = generateInvoiceHTML(sale, products);
                          setPrintPreviewHtml(html);
                          setPrintPreviewOpen(true);
                        }}
                        variant="outlined"
                      >
                        View Invoice
                      </Button>
                    </TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => {
                          window.location.href = `/seller/sale-entry?edit=${encodeURIComponent(sale._id)}`;
                        }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={async () => {
                          if (!window.confirm('Refund all refundable items for this invoice and restock the products?')) return;
                          try {
                            const token = localStorage.getItem('token');
                            const latest = await API.get(`/sales/${sale._id}`, {
                              headers: { Authorization: `Bearer ${token}` },
                            });
                            const dbSale = latest.data;
                            const origMap = new Map();
                            (dbSale.items || []).forEach(it => {
                              origMap.set(String(it.productId || it._id || ''), Number(it.quantity) || 0);
                            });
                            const refundedSoFar = new Map();
                            (dbSale.refunds || []).forEach(r => {
                              (r.items || []).forEach(it => {
                                const k = String(it.productId);
                                refundedSoFar.set(
                                  k,
                                  (refundedSoFar.get(k) || 0) + (Number(it.quantity) || 0)
                                );
                              });
                            });
                            const itemsPayload = [];
                            for (const [pid, origQty] of origMap.entries()) {
                              const already = Number(refundedSoFar.get(pid) || 0);
                              const remaining = Math.max(0, Number(origQty) - already);
                              if (remaining > 0) itemsPayload.push({ productId: pid, quantity: remaining });
                            }
                            if (itemsPayload.length === 0) {
                              alert('No refundable quantity remaining for this invoice');
                              return;
                            }
                            const res = await API.post(
                              `/sales/${sale._id}/refund`,
                              { items: itemsPayload, reason: 'Full refund by seller' },
                              { headers: { Authorization: `Bearer ${token}` } }
                            );
                            if (res.data && res.data.success) {
                              try {
                                window.dispatchEvent(new CustomEvent('products:changed'));
                              } catch (e) {}
                              try {
                                window.dispatchEvent(
                                  new CustomEvent('sales:changed', { detail: { id: sale._id } })
                                );
                              } catch (e) {}
                              await fetchSales();
                              setSuccess('Invoice refunded and products restocked');
                            } else {
                              alert(res.data?.message || 'Refund failed');
                            }
                          } catch (e) {
                            alert(e.response?.data?.message || e.message || 'Refund failed');
                          }
                        }}
                      >
                        <MoneyOffIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredSales.length === 0 && (
                <TableRow>
                  <TableCell colSpan={14}>No sales found.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* invoice preview dialog */}
        <Dialog open={printPreviewOpen} onClose={() => setPrintPreviewOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle>Print Preview</DialogTitle>
          <DialogContent dividers sx={{ display: 'flex', justifyContent: 'center' }}>
            <iframe
              title="invoice-preview"
              srcDoc={printPreviewHtml}
              style={{ width: '500px', height: '50vh', border: 'none' }}
            />
          </DialogContent>
          <DialogActions>
            <Button variant="contained" color="primary" startIcon={<PrintIcon />} onClick={() => {
              const w = window.open('', '_blank');
              if (!w || !w.document) { alert('Popup blocked. Please allow popups to print.'); return; }
              w.document.write(printPreviewHtml);
              w.document.close();
              setTimeout(() => w.print(), 250);
            }}>Print</Button>
            <Button onClick={() => setPrintPreviewOpen(false)}>Close</Button>
          </DialogActions>
        </Dialog>
      </Paper>
    </Box>
    <Dialog open={refundModalOpen} onClose={() => setRefundModalOpen(false)} maxWidth="sm" fullWidth>
      <DialogTitle>Refund Items</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 1 }}>Select quantities to refund for invoice.</Typography>
        {refundItems.map((ri, idx) => (
          <Box key={idx} sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 1 }}>
            <Typography sx={{ width: 1/2 }}>{ri.productName}</Typography>
            <TextField type="number" label={`Qty (max ${ri.maxQty})`} value={ri.qty || ''} onChange={e => {
              const v = Math.max(0, Math.min(Number(e.target.value) || 0, ri.maxQty));
              const copy = [...refundItems]; copy[idx] = { ...ri, qty: v }; setRefundItems(copy);
            }} sx={{ width: 120 }} />
          </Box>
        ))}
        <TextField fullWidth label="Reason (optional)" value={refundReason} onChange={e => setRefundReason(e.target.value)} multiline rows={2} sx={{ mt: 2 }} />
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setRefundModalOpen(false)}>Cancel</Button>
        <Button variant="contained" color="error" onClick={async () => {
          try {
            const payloadItems = (refundItems || []).filter(i => (Number(i.qty) || 0) > 0).map(i => ({ productId: i.productId, SKU: i.SKU, productName: i.productName, quantity: Number(i.qty) }));
            if (payloadItems.length === 0) { alert('Select at least one item to refund'); return; }
            const token = localStorage.getItem('token');
            const res = await API.post(`/sales/${refundTarget._id}/refund`, { items: payloadItems, reason: refundReason }, { headers: { Authorization: `Bearer ${token}` } });
            if (res.data && res.data.success) {
              try { window.dispatchEvent(new CustomEvent('products:changed')); } catch (e) {}
              try { window.dispatchEvent(new CustomEvent('sales:changed', { detail: { id: refundTarget._id } })); } catch (e) {}
              setRefundModalOpen(false);
            } else {
              alert(res.data?.message || 'Refund failed');
            }
          } catch (e) {
            alert(e.response?.data?.message || e.message || 'Refund failed');
          }
        }}>Process Refund</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default SellerSalesReport;
