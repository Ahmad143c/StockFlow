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
  Fade,
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
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import EditIcon from '@mui/icons-material/Edit';
import PrintIcon from '@mui/icons-material/Print';
import ReceiptIcon from '@mui/icons-material/Receipt';
import MoneyOffIcon from '@mui/icons-material/MoneyOff';
import { generateInvoiceHTML } from '../utils/invoiceUtils';
import { useDarkMode } from '../context/DarkModeContext';

const AdminSalesReport = () => {
  const theme = useTheme();
  const isSm = useMediaQuery(theme.breakpoints.down('sm'));
  const { darkMode } = useDarkMode();
  const [sales, setSales] = useState([]);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [highlightId, setHighlightId] = useState('');
  const [highlightUntil, setHighlightUntil] = useState(0);
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [refundTarget, setRefundTarget] = useState(null);
  const [refundItems, setRefundItems] = useState([]);
  const [refundReason, setRefundReason] = useState('');
  const [sellersById, setSellersById] = useState({});
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [printPreviewOpen, setPrintPreviewOpen] = useState(false);
  const [printPreviewHtml, setPrintPreviewHtml] = useState('');
  const previewRef = useRef(null);
  const products = useSelector(state => (state?.products?.items) ?? []);

  const productsMap = useMemo(() => {
    const map = {};
    products.forEach(p => {
      map[p._id] = p.costPerPiece || 0;
    });
    return map;
  }, [products]);

  const fetchSales = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await API.get('/sales', { headers: { Authorization: `Bearer ${token}` } });
      setSales(res.data);
      // Handle deep-link highlight
      const params = new URLSearchParams(window.location.search);
      const highlight = params.get('highlight');
      const type = params.get('type');
      if (highlight) {
        const match = res.data.find(s => s._id === highlight || String(s.invoiceNumber) === highlight);
        if (match) {
          setHighlightId(match._id);
          setHighlightUntil(Date.now() + 6000); // blink for 6s
          setTimeout(() => {
            const el = document.getElementById(`sale-${match._id}`);
            if (el && typeof el.scrollIntoView === 'function') {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }, 100);
          // Clear highlight after the blink period
          setTimeout(() => setHighlightId(''), 6000);
        }
      }
    } catch {
      setSales([]);
    }
  }, []);

  const fetchSellers = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      // Fetch only sellers
      const res = await API.get('/users/sellers', { headers: { Authorization: `Bearer ${token}` } });
      const list = Array.isArray(res.data) ? res.data : [];
      const map = {};
      // accept either _id or id fields as keys
      list.forEach(u => {
        const key = u?._id || u?.id;
        if (key) map[key] = u;
      });
      setSellersById(map);
    } catch {
      setSellersById({});
    }
  }, []);

  const handleIncomingNotif = useCallback((n) => {
    if (!n) return;
    const id = n.id || n;
    if (!id) return;
    // Refresh data and highlight the incoming sale
    fetchSales();
    setHighlightId(id);
    setHighlightUntil(Date.now() + 6000);
    setTimeout(() => {
      const el = document.getElementById(`sale-${id}`);
      if (el && typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 150);
    // clear after blink
    setTimeout(() => setHighlightId(''), 6000);
  }, [fetchSales]);

  const onCleared = useCallback(() => {
    fetchSales();
    setHighlightId('');
  }, [fetchSales]);

  const onChanged = useCallback((e) => {
    // If the event carries an id, use it to highlight directly
    try { if (e?.detail?.id) handleIncomingNotif(e.detail.id); } catch (err) { }
    fetchSales();
  }, [fetchSales, handleIncomingNotif]);

  const onStorage = useCallback((e) => {
    if (e.key === 'sales:changed') { fetchSales(); return; }
    if (e.key === 'sales:latest') {
      try { const raw = localStorage.getItem('sales:latest'); if (raw) handleIncomingNotif(JSON.parse(raw)); } catch (err) { }
    }
  }, [fetchSales, handleIncomingNotif]);

  const onLatest = useCallback((e) => { try { if (e?.detail) handleIncomingNotif(e.detail); } catch (err) { } }, [handleIncomingNotif]);

  useEffect(() => {
    fetchSales();
    fetchSellers();

    // BroadcastChannel for fast cross-tab delivery
    let ch = null;
    try {
      if (window.BroadcastChannel) {
        ch = new BroadcastChannel('sales');
        ch.onmessage = (ev) => { if (ev?.data?.notif) handleIncomingNotif(ev.data.notif); };
      }
    } catch (e) { }

    window.addEventListener('sales:changed', onChanged);
    window.addEventListener('sales:latest', onLatest);
    window.addEventListener('sales:cleared', onCleared);
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', fetchSales);
    return () => {
      window.removeEventListener('sales:changed', onChanged);
      window.removeEventListener('sales:latest', onLatest);
      window.removeEventListener('sales:cleared', onCleared);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', fetchSales);
      try { if (ch) ch.close(); } catch (e) { }
    };
  }, [fetchSales, fetchSellers, handleIncomingNotif, onCleared, onChanged, onStorage, onLatest]);

  const filteredSales = useMemo(() => {
    return sales.filter(sale => {
      const q = (search || '').toString().trim().toLowerCase();
      const matchesSearch = !q || (
        (sale.items || []).some(i => i.productName?.toLowerCase().includes(q)) ||
        (sale.sellerName || '').toLowerCase().includes(q) ||
        (sale.cashierName || '').toLowerCase().includes(q) ||
        (sale.customerName || '').toLowerCase().includes(q) ||
        String(sale.invoiceNumber || '').toLowerCase().includes(q) ||
        (sale._id || '').toLowerCase().includes(q)
      );
      const matchesStatus = !status || sale.paymentStatus === status;
      const created = new Date(sale.createdAt);
      const matchesStart = !startDate || created >= new Date(startDate + 'T00:00:00');
      const matchesEnd = !endDate || created <= new Date(endDate + 'T23:59:59');
      const hasActive = (Number(sale.totalQuantity) || Number(sale.netAmount) || 0) > 0;
      return hasActive && matchesSearch && matchesStatus && matchesStart && matchesEnd;
    });
  }, [sales, search, status, startDate, endDate]);

  // KPI (Summary) - memoized
  const { totalRevenue, totalSales, totalQty } = useMemo(() => {
    return {
      totalRevenue: filteredSales.reduce((sum, s) => sum + Number(s.netAmount), 0),
      totalSales: filteredSales.length,
      totalQty: filteredSales.reduce((sum, s) => sum + Number(s.totalQuantity), 0)
    };
  }, [filteredSales]);

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

  // Helper: calculate profit for a sale
  const calculateSaleProfit = useCallback((sale, productsMap) => {
    const totalCost = sale.items.reduce((sum, item) => {
      const cost = productsMap[item.productId] || 0;
      const refundedQty = calculateRefundedQty(sale, item.productId);
      const soldQty = Number(item.quantity || 0) - refundedQty;
      return sum + (cost * soldQty);
    }, 0);
    return sale.netAmount - totalCost;
  }, [calculateRefundedQty]);

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
    const grandTotalProfit = rows.reduce((sum, r) => {
      return sum + calculateSaleProfit(r, productsMap);
    }, 0);

    const rowsHtml = rows.map((r, idx) => {
      const invoice = r.invoiceNumber || (r._id ? r._id.substr(-6) : '');
      const items = Array.isArray(r.items) ? r.items.map(i => i.productName).join(', ') : '';
      const profit = calculateSaleProfit(r, productsMap);
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
          <td style="text-align: right;">${profit.toFixed(2)}</td>
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
              <th style="width: 22%;">Items</th>
              <th style="width: 8%;" class="right">Qty</th>
              <th style="width: 10%;" class="right">Revenue</th>
              <th style="width: 10%;" class="right">Discount</th>
              <th style="width: 10%;" class="right">Profit</th>
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
              <td class="right">Rs. ${grandTotalProfit.toFixed(2)}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </body></html>
    `;
    const w = window.open('', '_blank');
    if (!w || !w.document) { alert('Popup blocked. Allow popups to print.'); return; }
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 250);
  }, [filteredSales, productsMap, calculateRefundedQty, calculateSaleProfit]);

  // Memoize event handlers
  const handleViewInvoice = useCallback((sale) => {
    const html = generateInvoiceHTML(sale, products);
    setPrintPreviewHtml(html);
    setPrintPreviewOpen(true);
  }, [products]);

  const handleRefundClick = useCallback((sale) => {
    setRefundTarget(sale);
    setRefundModalOpen(true);
  }, []);

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
    <Fade in timeout={500}>
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
          overflowY: 'visible',
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
            borderRadius: '3px 3px 0 0'
          }
        }}>

          {/* Header Section - Responsive */}
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: { xs: 1.5, sm: 2 },
            gap: { xs: 1, sm: 2 },
            flexWrap: 'wrap',
            flexDirection: { xs: 'column', sm: 'row' },
            textAlign: { xs: 'center', sm: 'left' },
            p: { xs: 2, sm: 3 },
            borderRadius: { xs: 2, sm: 3 },
            background: `linear-gradient(135deg, ${darkMode ? 'rgba(25, 118, 210, 0.1)' : 'rgba(255, 255, 255, 0.9)'} 0%, ${darkMode ? 'rgba(66, 165, 245, 0.05)' : 'rgba(248, 249, 250, 0.8)'} 100%)`,
            backdropFilter: 'blur(10px)',
            border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'}`,
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <img src={process.env.PUBLIC_URL + '/Inventory logo.png'} alt="Inventory Logo" style={{ height: isSm ? 50 : 60, maxWidth: '100%', objectFit: 'contain', marginRight: 12 }} />
            <Typography
              variant={isSm ? 'h6' : 'h4'}
              color="primary"
              sx={{
                fontWeight: 700,
                fontSize: { xs: '1.1rem', sm: '1.5rem', md: '2rem' }
              }}
            >
              Sales Report (All Sellers)
            </Typography>
          </Box>

          {/* Summary Stats */}
          <Grid container spacing={1} mb={2}>
            <Grid item xs={12} sm={6} md={1}>
              <Typography variant={isSm ? 'body2' : 'body1'}>Total Sales: {totalSales}</Typography>
            </Grid>
            <Grid item xs={12} sm={6} md={1}>
              <Typography variant={isSm ? 'body2' : 'body1'}>Total Qty: {totalQty}</Typography>
            </Grid>
            <Grid item xs={12} sm={12} md={3}>
              <Typography variant={isSm ? 'body2' : 'body1'}>Total Revenue: Rs. {totalRevenue}</Typography>
            </Grid>
          </Grid>

          {/* Search Field */}
          <TextField
            placeholder="Search Product/Seller/Cashier/Customer/Invoice..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            fullWidth
            sx={{
              mb: 2,
              '& .MuiInputBase-root': {
                fontSize: { xs: '0.875rem', sm: '1rem' }
              }
            }}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }}
          />

          {/* Filters Section - Responsive Grid */}
          <Box sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, 1fr)',
              md: 'repeat(5, auto)'
            },
            gap: { xs: 1.5, sm: 2 },
            mb: 2,
            alignItems: 'center'
          }}>
            <TextField
              select
              label="Status"
              value={status}
              onChange={e => setStatus(e.target.value)}
              size={isSm ? "small" : "medium"}
              sx={{
                width: '100%',
                '& .MuiInputBase-root': {
                  fontSize: { xs: '0.875rem', sm: '1rem' }
                }
              }}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="Paid">Paid</MenuItem>
              <MenuItem value="Partial">Partial</MenuItem>
              <MenuItem value="Unpaid">Unpaid</MenuItem>
            </TextField>

            <TextField
              label="Start Date"
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              size={isSm ? "small" : "medium"}
              sx={{
                width: '100%',
                '& .MuiInputBase-root': {
                  fontSize: { xs: '0.875rem', sm: '1rem' }
                }
              }}
            />

            <TextField
              label="End Date"
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              size={isSm ? "small" : "medium"}
              sx={{
                width: '100%',
                '& .MuiInputBase-root': {
                  fontSize: { xs: '0.875rem', sm: '1rem' }
                }
              }}
            />

            <Button
              variant="contained"
              startIcon={<PrintIcon />}
              onClick={() => handlePrintReport()}
              sx={{
                gridColumn: { xs: '1', sm: 'span 2', md: 'auto' },
                width: { xs: '100%', sm: '200px' },
                py: { xs: 1, sm: 1.5 },
                background: darkMode ? 'linear-gradient(45deg, #90caf9, #64b5f6)' : 'linear-gradient(45deg, #1976d2, #42a5f5)',
                color: '#fff',
                '&:hover': {
                  background: darkMode ? 'linear-gradient(45deg, #64b5f6, #42a5f5)' : 'linear-gradient(45deg, #1565c0, #2196f3)',
                  transform: 'translateY(-1px)'
                },
                transition: 'all 0.3s ease'
              }}
            >
              Print Report
            </Button>
          </Box>

          {/* Table Container with Horizontal Scroll ONLY for mobile */}
          <TableContainer
            component={Paper}
            sx={{
              mb: 2,
              width: '100%',
              maxWidth: {
                xs: 'calc(80vw - 10px)',
                sm: '100%',
                md: 'calc(103vw - 300px)'
              },
              minWidth: 0,
              overflowX: 'auto', // Scrollable for all screen sizes including desktop
              overflowY: 'hidden',
              WebkitOverflowScrolling: 'touch',
              position: 'relative',
              borderRadius: 2,
              boxSizing: 'border-box',
              backgroundColor: darkMode ? '#2a2a2a' : '#fff',
              border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'}`,
              '&::-webkit-scrollbar': {
                height: { xs: '4px', sm: '6px' },
              },
              '&::-webkit-scrollbar-track': {
                backgroundColor: darkMode ? '#1e1e1e' : '#f1f1f1',
                borderRadius: '3px',
              },
              '&::-webkit-scrollbar-thumb': {
                backgroundColor: darkMode ? '#666' : '#888',
                borderRadius: '3px',
              },
            }}
          >
            <Table
              stickyHeader
              sx={{
                minWidth: { xs: 800, sm: '100%', md: '100%' }, // Only set minWidth for mobile
                width: '100%', // Full width for all screen sizes
                tableLayout: { xs: 'auto', sm: 'auto', md: 'auto' }, // Auto layout for all sizes
                whiteSpace: { xs: 'nowrap', sm: 'nowrap', md: 'nowrap' },
                minHeight: 1,
              }}
            >
              <TableHead>
                <TableRow>
                  <TableCell sx={{
                    fontWeight: 'bold',
                    fontSize: { xs: '0.75rem', sm: '0.875rem' },
                    padding: { xs: '8px 6px', sm: '12px 16px' },
                    position: 'sticky',
                    left: 0,
                    backgroundColor: darkMode ? '#2a2a2a' : '#fff',
                    zIndex: 3,
                    boxShadow: '2px 0 5px -2px rgba(0,0,0,0.1)',
                    minWidth: { xs: 10, sm: 100 }
                  }}>S/N</TableCell>
                  <TableCell sx={{
                    fontWeight: 'bold',
                    fontSize: { xs: '0.75rem', sm: '0.875rem' },
                    padding: { xs: '8px 6px', sm: '12px 16px' },
                    position: 'sticky',
                    left: { xs: 36, sm: 100 },
                    backgroundColor: darkMode ? '#2a2a2a' : '#fff',
                    zIndex: 3,
                    boxShadow: '2px 0 5px -2px rgba(0,0,0,0.1)',
                    minWidth: { xs: 50, sm: 120 }
                  }}>Invoice</TableCell>
                  <TableCell sx={headerCellSx}>Date</TableCell>
                  <TableCell sx={headerCellSx}>Seller</TableCell>
                  <TableCell sx={headerCellSx}>Cashier</TableCell>
                  <TableCell sx={headerCellSx}>Items</TableCell>
                  <TableCell sx={headerCellSx}>Item Price</TableCell>
                  <TableCell sx={headerCellSx}>Customer</TableCell>
                  <TableCell sx={headerCellSx}>Customer No</TableCell>
                  <TableCell sx={headerCellSx} align="right">Qty</TableCell>
                  <TableCell sx={headerCellSx} align="right">Total (Rs)</TableCell>
                  <TableCell sx={headerCellSx} align="right">Discount (Rs)</TableCell>
                  <TableCell sx={headerCellSx} align="right">Profit (Rs)</TableCell>
                  <TableCell sx={headerCellSx}>Status</TableCell>
                  <TableCell sx={headerCellSx} align="center">Warranty</TableCell>
                  <TableCell sx={headerCellSx} align="center">Invoice</TableCell>
                  <TableCell sx={headerCellSx}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredSales.map((sale, idx) => {
                  const seller = sellersById[sale.sellerId];
                  const sellerDisplay = sale.sellerName || seller?.username || seller?.name || seller?.fullName || '-';
                  const isBlink = highlightId && sale._id === highlightId && Date.now() < highlightUntil;
                  const rowSx = isBlink ? {
                    animation: 'blinkBg 1s linear infinite',
                    '@keyframes blinkBg': {
                      '0%': { backgroundColor: '#fffde7' },
                      '50%': { backgroundColor: '#fff59d' },
                      '100%': { backgroundColor: '#fffde7' }
                    }
                  } : { backgroundColor: 'inherit', transition: 'background-color 0.3s' };

                  const created = new Date(sale.createdAt);
                  const warrantyUntil = new Date(created);
                  warrantyUntil.setFullYear(warrantyUntil.getFullYear() + 1);
                  const underWarranty = new Date() <= warrantyUntil;

                  const perItem = new Map();
                  let totalClaimedQty = 0;
                  (sale.warrantyClaims || []).forEach(wc => {
                    (wc.items || []).forEach(ci => {
                      const key = String(ci.productName || ci.SKU || ci.productId || '');
                      if (!key) return;
                      const prev = perItem.get(key) || { claimed: 0, firstClaim: null };
                      const q = Number(ci.quantity) || 0;
                      prev.claimed += q;
                      totalClaimedQty += q;
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

                  const profit = calculateSaleProfit(sale, productsMap);

                  return (
                    <TableRow key={sale._id} id={`sale-${sale._id}`} sx={rowSx}>
                      <TableCell sx={{
                        ...cellSx,
                        position: 'sticky',
                        left: 0,
                        backgroundColor: darkMode ? '#2a2a2a' : '#fff',
                        zIndex: 1,
                        boxShadow: '2px 0 5px -2px rgba(0,0,0,0.1)',
                        minWidth: { xs: 10, sm: 100 }
                      }}>{idx + 1}</TableCell>

                      <TableCell sx={{
                        ...cellSx,
                        position: 'sticky',
                        left: { xs: 36, sm: 100 },
                        backgroundColor: darkMode ? '#2a2a2a' : '#fff',
                        zIndex: 1,
                        boxShadow: '2px 0 5px -2px rgba(0,0,0,0.1)',
                        minWidth: { xs: 50, sm: 120 }
                      }}>{sale.invoiceNumber || (sale._id ? sale._id.substr(-6) : '')}</TableCell>
                      <TableCell sx={cellSx}>{new Date(sale.createdAt).toLocaleString()}</TableCell>
                      <TableCell sx={cellSx}>{sellerDisplay}</TableCell>
                      <TableCell sx={cellSx}>{sale.cashierName || '-'}</TableCell>
                      <TableCell sx={cellSx}>
                        <Tooltip
                          title={
                            <Box sx={{ p: 0.5 }}>
                              {sale.items.map(i => {
                                const origQty = Number(i.quantity) || 0;
                                const refunded = calculateRefundedQty(sale, i.productId);
                                const remaining = origQty - refunded;
                                return (
                                  <Typography key={i.productId} variant="caption" display="block">
                                    {i.productName || '-'} x{remaining}{refunded ? ` (-${refunded} ref)` : ''}
                                  </Typography>
                                );
                              })}
                            </Box>
                          }
                          arrow
                        >
                          <Chip
                            label={`${sale.items.length} Products`}
                            size="small"
                            sx={{ cursor: 'pointer', height: 24 }}
                          />
                        </Tooltip>
                      </TableCell>
                      <TableCell sx={cellSx}>
                        <Tooltip
                          title={
                            <Box sx={{ p: 0.5 }}>
                              {sale.items.map(i => (
                                <Typography key={i.productId} variant="caption" display="block">
                                  {i.productName || '-'}: Rs. {Number(i.perPiecePrice || 0).toLocaleString()}
                                </Typography>
                              ))}
                            </Box>
                          }
                          arrow
                        >
                          <Chip
                            label={sale.items.slice(0, 2).map(i => `Rs. ${Number(i.perPiecePrice || 0).toLocaleString()}`).join(', ') + (sale.items.length > 2 ? '...' : '')}
                            size="small"
                            sx={{ cursor: 'pointer', height: 24 }}
                          />
                        </Tooltip>
                      </TableCell>
                      <TableCell sx={cellSx}>{sale.customerName || '-'}</TableCell>
                      <TableCell sx={cellSx}>{sale.customerContact || '-'}</TableCell>
                      <TableCell sx={cellSx} align="right">
                        {sale.items.reduce((sum, item) => {
                          const refundedQty = calculateRefundedQty(sale, item.productId);
                          const remaining = Number(item.quantity || 0) - refundedQty;
                          return sum + Math.max(0, remaining);
                        }, 0)}
                      </TableCell>
                      <TableCell sx={cellSx} align="right">{sale.netAmount}</TableCell>
                      <TableCell sx={cellSx} align="right">
                        <Typography sx={{ color: 'warning.main', fontWeight: 500 }}>
                          Rs. {(Number(sale.discountAmount) || 0).toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell sx={cellSx} align="right">
                        <Typography sx={{
                          color: profit < 0 ? 'error.main' : 'success.main',
                          fontWeight: 600
                        }}>
                          {profit.toFixed(2)}
                        </Typography>
                      </TableCell>
                      <TableCell sx={cellSx}>{sale.paymentStatus}</TableCell>
                      <TableCell sx={cellSx}>
                        {underWarranty ? (
                          <Tooltip title={warrantyTooltip} arrow>
                            <Box sx={{ position: 'relative', display: 'inline-block' }}>
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
                              {totalClaimedQty > 0 && (
                                <Box
                                  sx={{
                                    position: 'absolute',
                                    top: -12,
                                    right: -8,
                                    backgroundColor: '#f44336',
                                    color: 'white',
                                    borderRadius: '50%',
                                    width: 25,
                                    height: 25,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '0.70rem',
                                    fontWeight: 'bold',
                                    border: '2px solid white',
                                  }}
                                >
                                  {totalClaimedQty}
                                </Box>
                              )}
                            </Box>
                          </Tooltip>
                        ) : (
                          <Chip
                            label="No Warranty"
                            size="small"
                            color="default"
                            sx={{
                              height: 35,
                              fontSize: '0.7rem',
                              '& .MuiChip-label': { whiteSpace: 'pre-line' },
                            }}
                          />
                        )}
                      </TableCell>
                      <TableCell sx={cellSx}>
                        <Tooltip title="View Invoice">
                          <IconButton
                            onClick={() => handleViewInvoice(sale)}
                            size="small"
                            sx={{ color: darkMode ? '#90caf9' : '#1976d2' }}
                          >
                            <ReceiptIcon />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                      <TableCell sx={cellSx}>
                        <IconButton
                          onClick={() => handleRefundClick(sale)}
                          sx={{
                            color: darkMode ? '#ef5350' : '#f44336',
                            '&:hover': {
                              backgroundColor: darkMode ? 'rgba(239, 83, 80, 0.1)' : 'rgba(244, 67, 54, 0.1)',
                              transform: 'scale(1.1)'
                            },
                            transition: 'all 0.3s ease'
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
                style={{ width: '100%', maxWidth: '500px', height: '50vh', border: 'none' }}
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

          <Dialog open={refundModalOpen} onClose={() => setRefundModalOpen(false)} maxWidth="sm" fullWidth>
            <DialogTitle>Refund Items</DialogTitle>
            <DialogContent>
              <Typography variant="body2" sx={{ mb: 1 }}>Select quantities to refund for invoice.</Typography>
              {refundItems.map((ri, idx) => (
                <Box key={idx} sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 1, flexDirection: { xs: 'column', sm: 'row' } }}>
                  <Typography sx={{ width: { xs: '100%', sm: '50%' } }}>{ri.productName}</Typography>
                  <TextField type="number" label={`Qty (max ${ri.maxQty})`} value={ri.qty || ''} onChange={e => {
                    const v = Math.max(0, Math.min(Number(e.target.value) || 0, ri.maxQty));
                    const copy = [...refundItems]; copy[idx] = { ...ri, qty: v }; setRefundItems(copy);
                  }} sx={{ width: { xs: '100%', sm: 120 } }} />
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
                    try { window.dispatchEvent(new CustomEvent('products:changed')); } catch (e) { }
                    try { window.dispatchEvent(new CustomEvent('sales:changed', { detail: { id: refundTarget._id } })); } catch (e) { }
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
        </Paper>
      </Box>
    </Fade>
  );
};

export default AdminSalesReport;



