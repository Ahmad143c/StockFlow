import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Grid,
  CircularProgress,
  Alert,
  Chip,
  Card,
  CardContent,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import { useParams } from 'react-router-dom';
import { useDarkMode } from '../context/DarkModeContext';
import { useSelector } from 'react-redux';
import API from '../api/api';
import PrintIcon from '@mui/icons-material/Print';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import EmailIcon from '@mui/icons-material/Email';
import PhoneIcon from '@mui/icons-material/Phone';
import Tooltip from '@mui/material/Tooltip';
import { generateInvoiceHTML as utilGenerateInvoiceHTML } from '../utils/invoiceUtils';

const SellerClientDetail = ({ sellerId: propSellerId }) => {
  const { darkMode } = useDarkMode();
  const { sellerId: routeSellerId } = useParams();

  // Resolve sellerId: prop may be an id string or an object (e.g., user), so handle both.
  // Prefer prop (when SellerDashboard passes `user?._id`), otherwise use route param from admin.
  const rawSeller = propSellerId ?? routeSellerId;
  let sellerId = null;
  if (rawSeller && typeof rawSeller === 'object') {
    sellerId = rawSeller._id || rawSeller.id || null;
  } else if (rawSeller != null) {
    sellerId = String(rawSeller).trim();
  }

  // products list from store (for warranty lookups)
  const products = useSelector(state => (state?.products?.items) ?? []);

  // Fallback: if still missing, try to read logged-in user from localStorage
  let usedFallbackUser = false;
  if (!sellerId) {
    const stored = localStorage.getItem('user');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const candidate = parsed?._id || parsed?.id || null;
        if (candidate) {
          sellerId = String(candidate);
          usedFallbackUser = true;
        }
      } catch (e) {
        // ignore parse errors
      }
    }
  }

  // If still missing, try to decode JWT token payload to get user id
  let usedFallbackToken = false;
  let tokenUserId = null;
  if (!sellerId) {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const payload = token.split('.')[1];
        if (payload) {
          // atob may not be available in all envs; use global atob if present
          const decoded = JSON.parse(window.atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
          tokenUserId = decoded?.id || decoded?._id || null;
          if (tokenUserId) {
            sellerId = String(tokenUserId);
            usedFallbackToken = true;
          }
        }
      } catch (e) {
        // ignore token parse errors
      }
    }
  }

  const [customers, setCustomers] = useState([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [contactQuery, setContactQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [invoiceQuery, setInvoiceQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [refundInvoices, setRefundInvoices] = useState([]);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [invoiceDetail, setInvoiceDetail] = useState(null);
  const [printPreviewHtml, setPrintPreviewHtml] = useState('');

  // invoice HTML generator now delegated to utility
  const generateInvoiceHTML = (invoice, productsList = []) => {
    return utilGenerateInvoiceHTML(invoice, productsList);
  };

  // Validate sellerId early - check if it's a valid, non-empty value
  const isValidSellerId = Boolean(
    sellerId &&
    String(sellerId).trim() !== '' &&
    String(sellerId).toLowerCase() !== 'undefined' &&
    String(sellerId) !== 'null'
  );

  // Debug logging (also output JSON-stringified details so copy/paste shows values)
  useEffect(() => {
    const details = {
      sellerId,
      routeSellerId,
      propSellerId,
      isValidSellerId,
      sellerIdType: typeof sellerId,
      sellerIdString: String(sellerId),
      sellerIdLength: String(sellerId).length,
    };
    console.log('SellerClientDetail component mounted/updated:', details);
    try {
      console.log('SellerClientDetail (stringified):', JSON.stringify(details));
    } catch (e) {
      console.warn('SellerClientDetail: stringify failed', e);
    }
  }, [sellerId, routeSellerId, propSellerId, isValidSellerId]);

  // Fetch customers on component mount or sellerId change
  const fetchCustomers = useCallback(async () => {
    if (!isValidSellerId) {
      setError('Invalid seller ID. Please ensure you have access to this seller.');
      setCustomers([]);
      setLoadingCustomers(false);
      return;
    }

    setLoadingCustomers(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Authentication token not found. Please log in again.');
        setCustomers([]);
        return;
      }

      try {
        // Try to fetch from sales endpoint and extract unique customers
        const res = await API.get(`/sales?sellerId=${sellerId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const allSales = Array.isArray(res.data) ? res.data : [];
        // Ensure we only include sales that belong to the specified seller (defensive filter)
        const sales = allSales.filter(s => String(s.sellerId?._id || s.sellerId) === String(sellerId));
        const map = {};
        sales.forEach(s => {
          const name = s.customerName || s.customer?.name || 'Unknown';
          const contact = s.customerContact || s.customer?.phone || s.customerPhone || '';
          const email = s.customerEmail || s.customer?.email || s.customerEmailAddress || s.customer_email || '';
          if (!map[name]) {
            map[name] = {
              name,
              contact,
              email,
              invoices: [],
            };
          }
          map[name].invoices.push(s);
        });
        setCustomers(Object.values(map));
      } catch (e) {
        const errorMsg =
          e.response?.data?.message ||
          e.message ||
          'Failed to fetch customers. Please try again.';
        setError(errorMsg);
        setCustomers([]);
      }
    } finally {
      setLoadingCustomers(false);
    }
  }, [sellerId, isValidSellerId]);

  useEffect(() => {
    if (isValidSellerId) {
      fetchCustomers();
    }
  }, [isValidSellerId, fetchCustomers]);

  // Fetch invoices with optional filters
  const fetchInvoices = useCallback(
    async (custName = null, custContact = null, invQuery = null) => {
      if (!isValidSellerId) {
        setError('Invalid seller ID. Cannot fetch invoices.');
        return;
      }

      setLoadingInvoices(true);
      setError(null);
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setError('Authentication token not found. Please log in again.');
          return;
        }

        // Always fetch all invoices for this seller and apply filters client-side.
        // Server-side `customerName` or contact filters are unreliable when data is inconsistent, so we omit them.
        const s = startDate ? `&start=${startDate}` : '';
        const e = endDate ? `&end=${endDate}` : '';
        const iq = invQuery ? `&invoice=${encodeURIComponent(invQuery)}` : '';
        const res = await API.get(
          `/sales?sellerId=${sellerId}${s}${e}${iq}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const allInvoices = Array.isArray(res.data) ? res.data : [];
        // Defensive client-side filter: only keep invoices for this seller
        let filteredInvoices = allInvoices.filter(i => String(i.sellerId?._id || i.sellerId) === String(sellerId));
        // Apply client-side date filters because backend does not support start/end query params here
        if (startDate || endDate) {
          const start = startDate ? new Date(startDate + 'T00:00:00') : null;
          const end = endDate ? new Date(endDate + 'T23:59:59') : null;
          filteredInvoices = filteredInvoices.filter(i => {
            const created = new Date(i.date || i.createdAt || Date.now());
            if (start && created < start) return false;
            if (end && created > end) return false;
            return true;
          });
        }
        // Apply customer contact filter client-side because backend ignores customerContact
        if (custContact) {
          const contactQ = String(custContact).toLowerCase();
          filteredInvoices = filteredInvoices.filter(i => {
            const contact = (i.customerContact || i.customer?.phone || i.customerPhone || '').toString().toLowerCase();
            return contact.includes(contactQ);
          });
        }
        // If a customer name filter was provided, further narrow results to that customer
        if (custName) {
          const nameQuery = String(custName).toLowerCase();
          filteredInvoices = filteredInvoices.filter(i => {
            const name = (i.customerName || i.customer?.name || i.customerNameRaw || '').toString().toLowerCase();
            return name.includes(nameQuery);
          });
        }
        // If invoice query provided, filter by invoice number or id (client-side fallback)
        if (invQuery) {
          const ql = String(invQuery).toLowerCase();
          filteredInvoices = filteredInvoices.filter(i => {
            const invNum = (i.invoiceNumber || '').toString().toLowerCase();
            const id = (i._id || i.id || '').toString().toLowerCase();
            return invNum.includes(ql) || id.includes(ql);
          });
        }

        // previously we hid any sale containing a refund from the main list.
        // that caused "No invoices found" when the only invoices had partial refunds.
        // keep all filtered invoices for display and maintain a separate refund list.
        // compute invoices that still have any non‑refunded quantity
        const regularInvoices = filteredInvoices.filter(inv => {
          if (!inv.refunds || inv.refunds.length === 0) return true;
          // determine if every item has been refunded
          const origTotal = (inv.items || []).reduce((s, it) => s + (Number(it.quantity) || 0), 0);
          const refundedTotal = (inv.refunds || []).reduce((s, r) => s + (Number(r.totalRefundQty) || 0), 0);
          return refundedTotal < origTotal;
        });
        setInvoices(regularInvoices);
        // refund list should include all invoices that ever had a refund event
        setRefundInvoices(filteredInvoices.filter(i => i.refunds && i.refunds.length > 0));
        return filteredInvoices;
      } catch (err) {
        const errorMsg =
          err.response?.data?.message ||
          err.message ||
          'Failed to fetch invoices. Please try again.';
        setError(errorMsg);
        setInvoices([]);
        setRefundInvoices([]);
      } finally {
        setLoadingInvoices(false);
      }
    },
    [sellerId, startDate, endDate, isValidSellerId]
  );

  // Open customer and fetch their invoices
  const openCustomer = useCallback(
    async (cust) => {
      setSelectedCustomer(cust);
      // Clear invoice search when opening a customer
      setInvoiceQuery('');
      // Fetch invoices for this specific customer (date filters will be applied by fetchInvoices)
      await fetchInvoices(cust.name, cust.contact, null);
    },
    [fetchInvoices]
  );

  // Search / filter invoices directly (by invoice id/number and date range)
  const handleInvoiceSearch = useCallback(async () => {
    if (!selectedCustomer) {
      alert('Please select a customer first');
      return;
    }

    const name = selectedCustomer.name || null;
    const contact = selectedCustomer.contact || null;

    // Parse multiple invoice queries (comma-separated)
    const invoiceIds = invoiceQuery.trim() ? invoiceQuery.split(',').map(i => i.trim()).filter(Boolean) : [];

    // Fetch all invoices for this customer with date filters
    let filtered = await fetchInvoices(name, contact, null);

    if (!filtered) filtered = [];

    // If specific invoices requested, filter by those ids/numbers
    if (invoiceIds.length > 0) {
      filtered = filtered.filter(inv => {
        const invNum = (inv.invoiceNumber || '').toString().toLowerCase();
        const id = (inv._id || inv.id || '').toString().toLowerCase();
        return invoiceIds.some(q => {
          const ql = q.toLowerCase();
          return invNum.includes(ql) || id.includes(ql);
        });
      });
    }

    // for search results, apply same logic as fetchInvoices: keep invoices with
    // any remaining quantity, but build a refund list containing all matched sales
    const filteredRegular = filtered.filter(inv => {
      if (!inv.refunds || inv.refunds.length === 0) return true;
      const origTotal = (inv.items || []).reduce((s, it) => s + (Number(it.quantity) || 0), 0);
      const refundedTotal = (inv.refunds || []).reduce((s, r) => s + (Number(r.totalRefundQty) || 0), 0);
      return refundedTotal < origTotal;
    });
    setInvoices(filteredRegular);
    setRefundInvoices(filtered.filter(i => i.refunds && i.refunds.length > 0));
  }, [selectedCustomer, invoiceQuery, fetchInvoices]);

  // Apply only date filters (when no invoice search is provided)
  const handleApplyDateFilter = useCallback(async () => {
    if (!selectedCustomer) {
      alert('Please select a customer first');
      return;
    }

    const name = selectedCustomer.name || null;
    const contact = selectedCustomer.contact || null;
    // pass invoiceQuery too so user can search and apply dates together
    await fetchInvoices(name, contact, invoiceQuery || null);
  }, [selectedCustomer, fetchInvoices, invoiceQuery]);

  // Handle advanced search with filters
  const handleAdvancedSearch = useCallback(async () => {
    const nameQ = query.trim() || null;
    const contactQ = contactQuery.trim() || null;
    const hasAnyFilter = Boolean(nameQ || contactQ);

    if (!hasAnyFilter) {
      // no customer filters: reset customers and invoices
      await fetchCustomers();
      setSelectedCustomer(null);
      setInvoices([]);
      return;
    }

    // Fetch invoices with name and contact filters to identify matching customers
    const results = await fetchInvoices(nameQ, contactQ, null);

    // Build customers list from returned invoices so Customer Panel shows searched customer(s)
    const map = {};
    (results || []).forEach(s => {
      const name = s.customerName || s.customer?.name || 'Unknown';
      const contact = s.customerContact || s.customer?.phone || s.customerPhone || '';
      const email = s.customerEmail || s.customer?.email || s.customerEmailAddress || s.customer_email || '';
      const key = `${name}||${contact}`;
      if (!map[key]) map[key] = { name, contact, email, invoices: [] };
      map[key].invoices.push(s);
    });
    const custs = Object.values(map);
    setCustomers(custs);

    // Important: Do NOT auto-populate invoices. Keep empty until user clicks "View" button.
    // This ensures user must explicitly select a customer to see invoices.
    setInvoices([]);
    setSelectedCustomer(null);
  }, [query, contactQuery, fetchInvoices, fetchCustomers]);

  // Clear all filters
  const handleClearFilters = useCallback(() => {
    setQuery('');
    setContactQuery('');
    setStartDate('');
    setEndDate('');
    setInvoiceQuery('');
    setSelectedCustomer(null);
    setInvoices([]);
    setRefundInvoices([]);
    fetchCustomers();
  }, [fetchCustomers]);

  // Calculate monthly and yearly totals
  const monthlyTotals = useMemo(() => {
    const m = {};
    invoices.forEach(inv => {
      const d = new Date(inv.date || inv.createdAt || Date.now());
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      m[key] = (m[key] || 0) + Number(inv.totalAmount || inv.netAmount || 0);
    });
    return Object.entries(m)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {});
  }, [invoices]);

  // Payment progress across currently shown invoices (paid / net)
  const paymentProgress = useMemo(() => {
    let totalNet = 0;
    let paidFull = 0; // fully paid invoices total
    let partialPaid = 0; // paid amounts from partial invoices
    let unpaidFull = 0; // unpaid invoices total
    let unpaidFromPartial = 0; // remaining unpaid amount from partial invoices

    invoices.forEach(inv => {
      const net = Number(inv.netAmount || inv.totalAmount || 0);
      totalNet += net;
      const status = (inv.paymentStatus || '').toString();
      if (status === 'Paid') {
        paidFull += net;
      } else if (status === 'Unpaid' || !status) {
        unpaidFull += net;
      } else if (status.toLowerCase().includes('partial')) {
        const paidAmt = Number(inv.paidAmount || inv.cashAmount || 0);
        partialPaid += paidAmt;
        unpaidFromPartial += Math.max(0, net - paidAmt);
      } else {
        // fallback: treat based on paidAmount
        const paidAmt = Number(inv.paidAmount || inv.cashAmount || 0);
        if (paidAmt >= net) paidFull += net; else if (paidAmt > 0) { partialPaid += paidAmt; unpaidFromPartial += (net - paidAmt); } else unpaidFull += net;
      }
    });

    const totalPaid = paidFull + partialPaid;
    // Calculate percentages correctly - they should add up to 100% (not overlapping)
    const percentPaidOnly = totalNet > 0 ? Math.round((paidFull / totalNet) * 100) : 0;
    const percentPartial = totalNet > 0 ? Math.round((partialPaid / totalNet) * 100) : 0;
    const percentUnpaid = totalNet > 0 ? Math.round(((unpaidFull + unpaidFromPartial) / totalNet) * 100) : 0;
    // percentPaid for circle should be paid full + partial (combined non-unpaid)
    const percentPaid = percentPaidOnly + percentPartial;
    return { totalNet, totalPaid, percentPaid, percentPartial, percentUnpaid, paidFull, partialPaid, unpaidFull, unpaidFromPartial, percentPaidOnly };
  }, [invoices]);

  const yearlyTotals = useMemo(() => {
    const y = {};
    invoices.forEach(inv => {
      const d = new Date(inv.date || inv.createdAt || Date.now());
      const key = `${d.getFullYear()}`;
      y[key] = (y[key] || 0) + Number(inv.totalAmount || inv.netAmount || 0);
    });
    return Object.entries(y)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {});
  }, [invoices]);

  // Calculate monthly payment progress (Paid/Partial/Unpaid breakdown by month)
  const monthlyPaymentProgress = useMemo(() => {
    const m = {};
    invoices.forEach(inv => {
      const d = new Date(inv.date || inv.createdAt || Date.now());
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!m[key]) m[key] = { totalNet: 0, paidFull: 0, partialPaid: 0, unpaidFull: 0, unpaidFromPartial: 0 };
      const net = Number(inv.netAmount || inv.totalAmount || 0);
      m[key].totalNet += net;
      const status = (inv.paymentStatus || '').toString();
      if (status === 'Paid') {
        m[key].paidFull += net;
      } else if (status === 'Unpaid' || !status) {
        m[key].unpaidFull += net;
      } else if (status.toLowerCase().includes('partial')) {
        const paidAmt = Number(inv.paidAmount || inv.cashAmount || 0);
        m[key].partialPaid += paidAmt;
        m[key].unpaidFromPartial += Math.max(0, net - paidAmt);
      } else {
        const paidAmt = Number(inv.paidAmount || inv.cashAmount || 0);
        if (paidAmt >= net) m[key].paidFull += net;
        else if (paidAmt > 0) { m[key].partialPaid += paidAmt; m[key].unpaidFromPartial += (net - paidAmt); }
        else m[key].unpaidFull += net;
      }
    });
    return m;
  }, [invoices]);

  // Calculate yearly payment progress (Paid/Partial/Unpaid breakdown by year)
  const yearlyPaymentProgress = useMemo(() => {
    const y = {};
    invoices.forEach(inv => {
      const d = new Date(inv.date || inv.createdAt || Date.now());
      const key = `${d.getFullYear()}`;
      if (!y[key]) y[key] = { totalNet: 0, paidFull: 0, partialPaid: 0, unpaidFull: 0, unpaidFromPartial: 0 };
      const net = Number(inv.netAmount || inv.totalAmount || 0);
      y[key].totalNet += net;
      const status = (inv.paymentStatus || '').toString();
      if (status === 'Paid') {
        y[key].paidFull += net;
      } else if (status === 'Unpaid' || !status) {
        y[key].unpaidFull += net;
      } else if (status.toLowerCase().includes('partial')) {
        const paidAmt = Number(inv.paidAmount || inv.cashAmount || 0);
        y[key].partialPaid += paidAmt;
        y[key].unpaidFromPartial += Math.max(0, net - paidAmt);
      } else {
        const paidAmt = Number(inv.paidAmount || inv.cashAmount || 0);
        if (paidAmt >= net) y[key].paidFull += net;
        else if (paidAmt > 0) { y[key].partialPaid += paidAmt; y[key].unpaidFromPartial += (net - paidAmt); }
        else y[key].unpaidFull += net;
      }
    });
    return y;
  }, [invoices]);

  const totalRevenue = useMemo(
    () => invoices.reduce((sum, inv) => sum + Number(inv.totalAmount || inv.netAmount || 0), 0),
    [invoices]
  );

  // Generate print HTML for invoices
  const generatePrintHTML = () => {
    const dateRange =
      startDate || endDate ? `From: ${startDate || 'All time'} To: ${endDate || 'Now'}` : 'All Dates';
    const customerName = selectedCustomer ? selectedCustomer.name : 'All Customers';
    const customerEmail = selectedCustomer?.email || '-';

    // Build simple table rows: each invoice has one summary row with all key info
    const invoicesHTML = invoices
      .map((inv, idx) => {
        const shortInv = inv.invoiceNumber || (inv._id ? inv._id.toString().slice(-6) : '-');
        const invDate = new Date(inv.date || inv.createdAt).toLocaleDateString() || '-';
        const itemsList = (inv.items || []).map(i => i.productName || i.SKU || 'Item').join('; ');
        const pricesList = (inv.items || []).map(i => `Rs. ${Number(i.perPiecePrice || 0).toLocaleString()}`).join('; ');
        const amount = Number(inv.totalAmount || inv.netAmount || 0);
        const status = inv.paymentStatus || '-';
        const method = inv.paymentMethod || '-';

        return `
          <tr>
            <td style="padding:10px;border-bottom:1px solid #ddd;text-align:center;">${idx + 1}</td>
            <td style="padding:10px;border-bottom:1px solid #ddd;font-weight:bold;">${shortInv}</td>
            <td style="padding:10px;border-bottom:1px solid #ddd;">${invDate}</td>
            <td style="padding:10px;border-bottom:1px solid #ddd;">${itemsList || '-'}</td>
            <td style="padding:10px;border-bottom:1px solid #ddd;font-size:11px;">${pricesList || '-'}</td>
            <td style="padding:10px;border-bottom:1px solid #ddd;">${method}</td>
            <td style="padding:10px;border-bottom:1px solid #ddd;">${status}</td>
            <td style="padding:1px;border-bottom:1px solid #ddd;text-align:right;font-weight:bold;">Rs. ${amount.toLocaleString()}</td>
          </tr>
        `;
      })
      .join('');

    const monthlyHTML = Object.entries(monthlyTotals)
      .map(
        ([month, total]) =>
          `<tr>
            <td style="padding:8px;border-bottom:1px solid #ddd;">${month}</td>
            <td style="padding:8px;border-bottom:1px solid #ddd;text-align:right;">Rs. ${total.toLocaleString()}</td>
          </tr>`
      )
      .join('');

    const yearlyHTML = Object.entries(yearlyTotals)
      .map(
        ([year, total]) =>
          `<tr>
            <td style="padding:8px;border-bottom:1px solid #ddd;">${year}</td>
            <td style="padding:8px;border-bottom:1px solid #ddd;text-align:right;">Rs. ${total.toLocaleString()}</td>
          </tr>`
      )
      .join('');

    return `
      <html>
        <head>
          <title>Client Invoices Report</title>
          <style>
            * { margin: 0; padding: 0; }
            body { font-family: 'Arial', sans-serif; background: #fff; color: #333; padding: 20px; line-height: 1.6; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #1976d2; padding-bottom: 15px; }
            .header h1 { color: #1976d2; font-size: 24px; margin-bottom: 10px; }
            .header p { font-size: 13px; margin: 4px 0; }
            .info-section { background: #f9f9f9; padding: 12px 15px; margin: 15px 0; border-left: 4px solid #1976d2; }
            .info-section p { font-size: 13px; margin: 4px 0; }
            h2 { color: #1976d2; font-size: 16px; margin-top: 20px; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 2px solid #ddd; }
            table { width: 100%; border-collapse: collapse; margin: 10px 0; }
            th { background-color: #1976d2; color: white; padding: 12px; text-align: left; font-weight: bold; font-size: 13px; }
            td { padding: 10px; font-size: 12px; }
            tr:nth-child(even) { background-color: #f9f9f9; }
            .total-row { background-color: #e8f4f8; font-weight: bold; }
            .total-row td { padding: 12px; border-top: 2px solid #1976d2; }
            .breakdown-section { display: flex; gap: 30px; margin-top: 20px; }
            .breakdown-col { flex: 1; }
            @media print {
              body { padding: 0; }
              .page-break { page-break-after: always; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Client Invoices Report</h1>
            <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
          </div>

          <div class="info-section">
            <p><strong>Customer:</strong> ${customerName} ${customerEmail && customerEmail !== '-' ? `(${customerEmail})` : ''}</p>
            <p><strong>Date Range:</strong> ${dateRange}</p>
            <p><strong>Total Invoices:</strong> ${invoices.length} | <strong>Total Revenue:</strong> Rs. ${totalRevenue.toLocaleString()}</p>
          </div>

          <h2>Invoice Details</h2>
          <table>
            <thead>
              <tr>
                <th style="width:5%">S/N</th>
                <th style="width:10%">Invoice #</th>
                <th style="width:10%">Date</th>
                <th style="width:25%">Items</th>
                <th style="width:23%">Product Prices</th>
                <th style="width:12%">Method</th>
                <th style="width:10%">Status</th>
                <th style="width:15%;text-align:right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${invoicesHTML}
              <tr class="total-row">
                <td colspan="7" style="text-align:right;padding:12px;">TOTAL</td>
                <td style="text-align:right;padding:1px;">Rs. ${totalRevenue.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>

          <h2>Monthly Breakdown</h2>
          <table>
            <thead>
              <tr>
                <th style="width:50%">Month</th>
                <th style="width:50%;text-align:right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${monthlyHTML || '<tr><td colspan="2" style="text-align:center;padding:12px;">No monthly data</td></tr>'}
            </tbody>
          </table>

          <h2>Yearly Breakdown</h2>
          <table>
            <thead>
              <tr>
                <th style="width:50%">Year</th>
                <th style="width:50%;text-align:right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${yearlyHTML || '<tr><td colspan="2" style="text-align:center;padding:12px;">No yearly data</td></tr>'}
            </tbody>
          </table>

          <div style="margin-top:30px;text-align:center;font-size:11px;color:#999;">
            <p>This is an automated report. Please verify totals before processing.</p>
          </div>
        </body>
      </html>
    `;
  };

  const generateSingleInvoicePrintHTML = (inv) => {
    const itemsHTML = (inv.items || []).map(it => {
      let warrantyText = 'No warranty';
      const prod = products.find(p => p._id === (it.productId || it._id));
      const months = prod ? Number(prod.warrantyMonths || 0) : 0;
      if (months > 0) {
        const saleDate = new Date(inv.createdAt || inv.date);
        const warrantyUntil = new Date(saleDate);
        warrantyUntil.setMonth(warrantyUntil.getMonth() + months);
        const now = new Date();
        if (now <= warrantyUntil) {
          warrantyText = `Under warranty until ${warrantyUntil.toLocaleDateString()}`;
        } else {
          warrantyText = 'Warranty expired';
        }
      }
      return `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #eee;">${it.productName || it.SKU || 'Item'}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${it.quantity}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">Rs. ${Number(it.perPiecePrice || 0).toLocaleString()}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${warrantyText}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">Rs. ${Number(it.subtotal || (it.perPiecePrice * it.quantity) || 0).toLocaleString()}</td>
      </tr>`;
    }).join('');

    return `
      <html>
        <head>
          <title>Invoice ${inv.invoiceNumber || inv._id}</title>
          <style>body{font-family:Arial,sans-serif;margin:20px;color:#333}th{background:#f5f5f5;padding:10px;text-align:left}td{padding:8px}</style>
        </head>
        <body>
          <h2>Invoice: ${inv.invoiceNumber || inv._id}</h2>
          <p><strong>Customer:</strong> ${inv.customerName || '-'}</p>
          <p><strong>Date:</strong> ${new Date(inv.date || inv.createdAt).toLocaleString()}</p>
          <table style="width:100%;border-collapse:collapse;margin-top:10px;">
            <thead>
              <tr><th>Item</th><th style="text-align:center;">Qty</th><th style="text-align:right;">Unit</th><th style="text-align:right;">Warranty</th><th style="text-align:right;">Subtotal</th></tr>
            </thead>
            <tbody>
              ${itemsHTML}
              <tr>
                <td colspan="4" style="text-align:right;padding:8px;font-weight:bold;border-top:2px solid #ddd;">Total</td>
                <td style="text-align:right;padding:8px;font-weight:bold;border-top:2px solid #ddd;">Rs. ${Number(inv.netAmount || inv.totalAmount || 0).toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </body>
      </html>
    `;
  };

  const generateRefundInvoicePrintHTML = (refundInv) => {
    // Generate HTML for refund invoices matching invoiceUtils.js style
    const invoiceNum = refundInv.invoiceNumber || (refundInv._id ? refundInv._id.toString().slice(-6) : '-');
    const totalRefundAmount = (refundInv.refunds || []).reduce((sum, r) => sum + (Number(r.totalRefundAmount) || 0), 0);
    const totalRefundQty = (refundInv.refunds || []).reduce((sum, r) => sum + (Number(r.totalRefundQty) || 0), 0);
    
    const refundRows = (refundInv.refunds || []).map((ref, idx) => {
      const refundDate = ref.createdAt ? new Date(ref.createdAt).toLocaleDateString() : '-';
      const items = (ref.items || []).map(i => `${i.productName || i.SKU} (${i.quantity})`).join(', ');
      const refAmount = Number(ref.totalRefundAmount) || 0;
      return `
        <tr>
          <td>${idx + 1}</td>
          <td>${refundDate}</td>
          <td>${items}</td>
          <td class="text-right">${ref.totalRefundQty || 0}</td>
          <td class="text-right">Rs. ${refAmount.toLocaleString()}</td>
        </tr>
      `;
    }).join('');

    return `
      <html>
        <head>
          <title>Refund Invoice #${invoiceNum}</title>
          <style>
            html, body { width: 100%; margin: 0; padding: 0; }
            body { font-family: 'Courier New', monospace; margin: 0 auto; padding: 15px; width: 80mm; color: #333; }
            html { display: flex; justify-content: center; }
            .header { text-align: center; margin-bottom: 15px; border-bottom: 2px solid #000; padding-bottom: 10px; }
            .header h1 { margin: 0 0 5px 0; font-size: 14px; font-weight: bold; color: #d32f2f; }
            .header p { margin: 2px 0; font-size: 10px; }
            .invoice-info { margin: 12px 0; font-size: 10px; }
            .invoice-info div { margin: 3px 0; }
            .invoice-info strong { font-weight: bold; }
            table { width: 100%; border-collapse: collapse; margin: 12px 0; }
            th { background: #f5f5f5; border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 6px 4px; text-align: left; font-weight: bold; font-size: 9px; }
            td { padding: 5px 4px; border-bottom: 1px solid #eee; font-size: 9px; }
            tr:last-child td { border-bottom: 1px solid #000; }
            .text-right { text-align: right !important; }
            .total-row { border-top: 2px solid #000; border-bottom: 2px solid #000; font-weight: bold; background: #f9f9f9; }
            .total-amount { font-weight: bold; font-size: 10px; }
            .summary-info { margin-top: 8px; font-size: 9px; }
            .summary-info div { margin: 2px 0; display: flex; justify-content: space-between; }
            .footer { text-align: center; margin-top: 15px; font-size: 8px; color: #666; border-top: 1px solid #000; padding-top: 8px; }
            @media print { body { margin: 0; padding: 10px; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>REFUND INVOICE</h1>
            <p>New Adil Electric Concern</p>
            <p>4-B Jamiat Center, Lahore</p>
            <p>Invoice #${invoiceNum}</p>
          </div>

          <div class="invoice-info">
            <div><strong>Original Sale:</strong> ${invoiceNum}</div>
            <div><strong>Date:</strong> ${new Date(refundInv.date || refundInv.createdAt).toLocaleDateString()}</div>
            <div><strong>Original Items:</strong> ${(refundInv.items || []).map(i => `${i.productName || i.SKU}`).join(', ')}</div>
          </div>

          <table>
            <thead>
              <tr>
                <th>S/N</th>
                <th>Date</th>
                <th>Items</th>
                <th class="text-right">Qty</th>
                <th class="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${refundRows}
              <tr class="total-row">
                <td colspan="3" class="text-right">TOTAL REFUNDED</td>
                <td class="text-right">${totalRefundQty}</td>
                <td class="text-right total-amount">Rs. ${totalRefundAmount.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>

          <div class="summary-info">
            <div><span>Total Qty:</span> <span>${totalRefundQty} pcs</span></div>
            <div><span>Total Refund:</span> <span>Rs. ${totalRefundAmount.toLocaleString()}</span></div>
            <div><span>Generated:</span> <span>${new Date().toLocaleString()}</span></div>
          </div>

          <div class="footer">
            <p>Automated refund invoice. Verify before processing.</p>
          </div>
        </body>
      </html>
    `;
  };

  const handlePrint = () => {
    if (invoices.length === 0) {
      alert('No invoices to print. Please search for invoices first.');
      return;
    }
    const printHTML = generatePrintHTML();
    const printWindow = window.open('', '_blank');
    if (!printWindow || !printWindow.document) {
      alert('Popup blocked. Please allow popups to print.');
      return;
    }
    printWindow.document.write(printHTML);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 250);
  };

  const handlePrintInvoice = (inv) => {
    const html = generateSingleInvoicePrintHTML(inv);
    const w = window.open('', '_blank');
    if (!w || !w.document) { alert('Popup blocked. Please allow popups to print.'); return; }
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 250);
  };

  const generateCustomerDetailPrintHTML = (cust) => {
    return `
      <html>
        <head>
          <title>Customer Detail - ${cust.name}</title>
          <style>
            * { margin: 0; padding: 0; }
            body { font-family: 'Arial', sans-serif; background: #fff; color: #333; padding: 30px; line-height: 1.8; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #1976d2; padding-bottom: 20px; }
            .header h1 { color: #1976d2; font-size: 26px; margin-bottom: 10px; font-weight: 800; }
            .header p { font-size: 12px; margin: 3px 0; color: #666; }
            .seller-section { background: #f0f7ff; padding: 15px; border-left: 4px solid #1976d2; margin-bottom: 25px; border-radius: 4px; }
            .seller-section h3 { color: #1976d2; font-size: 14px; margin-bottom: 8px; font-weight: 700; }
            .seller-section p { font-size: 12px; margin: 4px 0; color: #555; }
            .customer-section { background: #fff9f0; padding: 15px; border-left: 4px solid #ff9800; margin-bottom: 25px; border-radius: 4px; }
            .customer-section h3 { color: #ff9800; font-size: 14px; margin-bottom: 8px; font-weight: 700; }
            .customer-section p { font-size: 12px; margin: 4px 0; color: #555; }
            .detail-row { display: flex; margin-bottom: 8px; }
            .detail-label { font-weight: 600; width: 140px; color: #333; }
            .detail-value { flex: 1; color: #666; }
            .invoice-summary { background: #f5f5f5; padding: 15px; border-radius: 4px; margin-bottom: 20px; }
            .invoice-summary h3 { color: #333; font-size: 13px; margin-bottom: 8px; font-weight: 700; }
            .summary-stat { display: flex; justify-content: space-between; font-size: 12px; margin: 4px 0; }
            .summary-stat .label { font-weight: 600; }
            .summary-stat .value { font-weight: 700; color: #1976d2; }
            .footer { margin-top: 30px; text-align: center; font-size: 11px; color: #999; border-top: 1px solid #ddd; padding-top: 15px; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Customer Detail Report</h1>
            <p>Generated: ${new Date().toLocaleString()}</p>
          </div>

          <div class="seller-section">
            <h3>Seller Information</h3>
            <div class="detail-row">
              <div class="detail-label">Seller ID:</div>
              <div class="detail-value">${sellerId}</div>
            </div>
            <div class="detail-row">
              <div class="detail-label">Company Name:</div>
              <div class="detail-value">New Adil Electric Concern</div>
            </div>
            <div class="detail-row">
              <div class="detail-label">Address:</div>
              <div class="detail-value">4-B, Jamiat Center, Shah Alam Market, Lahore, Pakistan</div>
            </div>
          </div>

          <div class="customer-section">
            <h3>Customer Information</h3>
            <div class="detail-row">
              <div class="detail-label">Name:</div>
              <div class="detail-value">${cust.name}</div>
            </div>
            <div class="detail-row">
              <div class="detail-label">Email:</div>
              <div class="detail-value">${cust.email || 'Not provided'}</div>
            </div>
            <div class="detail-row">
              <div class="detail-label">Contact:</div>
              <div class="detail-value">${cust.contact || 'Not provided'}</div>
            </div>
            <div class="detail-row">
              <div class="detail-label">Total Invoices:</div>
              <div class="detail-value">${cust.invoices?.length || 0}</div>
            </div>
          </div>

          <div class="invoice-summary">
            <h3>Invoice Summary</h3>
            <div class="summary-stat">
              <span class="label">Total Invoices:</span>
              <span class="value">${cust.invoices?.length || 0}</span>
            </div>
            <div class="summary-stat">
              <span class="label">Total Amount:</span>
              <span class="value">Rs. ${(cust.invoices || []).reduce((s, i) => s + Number(i.totalAmount || i.netAmount || 0), 0).toLocaleString()}</span>
            </div>
            <div class="summary-stat">
              <span class="label">Paid Amount:</span>
              <span class="value">Rs. ${(cust.invoices || []).reduce((s, i) => s + Number(i.paidAmount || i.cashAmount || 0), 0).toLocaleString()}</span>
            </div>
            <div class="summary-stat">
              <span class="label">Outstanding:</span>
              <span class="value">Rs. ${(cust.invoices || []).reduce((s, i) => s + Math.max(0, Number(i.totalAmount || i.netAmount || 0) - Number(i.paidAmount || i.cashAmount || 0)), 0).toLocaleString()}</span>
            </div>
          </div>

          <div class="footer">
            <p>This is an automated customer detail report. For any discrepancies, please verify with the seller.</p>
          </div>
        </body>
      </html>
    `;
  };

  const generateAllCustomersDetailPrintHTML = () => {
    // Combine customer invoices with refund invoices, dedupe by id
    const fromCustomers = customers.flatMap(c => c.invoices || []);
    const combined = [...fromCustomers, ...(refundInvoices || [])];
    const seen = new Set();
    const allInvoices = combined.filter(inv => {
      const id = (inv._id || inv.id || inv.invoiceNumber || JSON.stringify(inv));
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
    const monthlyTotalsAll = {};
    allInvoices.forEach(inv => {
      const d = new Date(inv.date || inv.createdAt || Date.now());
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyTotalsAll[key] = (monthlyTotalsAll[key] || 0) + Number(inv.totalAmount || inv.netAmount || 0);
    });
    const sortedMonthlyTotals = Object.entries(monthlyTotalsAll).sort((a, b) => b[0].localeCompare(a[0])).reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {});
    const yearlyTotalsAll = {};
    allInvoices.forEach(inv => {
      const d = new Date(inv.date || inv.createdAt || Date.now());
      const key = `${d.getFullYear()}`;
      yearlyTotalsAll[key] = (yearlyTotalsAll[key] || 0) + Number(inv.totalAmount || inv.netAmount || 0);
    });
    const sortedYearlyTotals = Object.entries(yearlyTotalsAll).sort((a, b) => b[0].localeCompare(a[0])).reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {});
    const grandTotal = allInvoices.reduce((sum, inv) => sum + Number(inv.totalAmount || inv.netAmount || 0), 0);
    const customersHTML = customers.map((cust, idx) => {
      const custTotal = (cust.invoices || []).reduce((sum, inv) => sum + Number(inv.totalAmount || inv.netAmount || 0), 0);
      return `<tr><td style="padding:10px;border-bottom:1px solid #ddd;text-align:center;">${idx + 1}</td><td style="padding:10px;border-bottom:1px solid #ddd;font-weight:bold;">${cust.name}</td><td style="padding:10px;border-bottom:1px solid #ddd;">${cust.email || '-'}</td><td style="padding:10px;border-bottom:1px solid #ddd;">${cust.contact || '-'}</td><td style="padding:10px;border-bottom:1px solid #ddd;text-align:center;">${cust.invoices?.length || 0}</td><td style="padding:10px;border-bottom:1px solid #ddd;text-align:right;font-weight:bold;">Rs. ${custTotal.toLocaleString()}</td></tr>`;
    }).join('');
    const monthlyHTML = Object.entries(sortedMonthlyTotals).map(([month, total]) => `<tr><td style="padding:8px;border-bottom:1px solid #ddd;">${month}</td><td style="padding:8px;border-bottom:1px solid #ddd;text-align:right;font-weight:bold;">Rs. ${total.toLocaleString()}</td></tr>`).join('');
    const yearlyHTML = Object.entries(sortedYearlyTotals).map(([year, total]) => `<tr><td style="padding:8px;border-bottom:1px solid #ddd;">${year}</td><td style="padding:8px;border-bottom:1px solid #ddd;text-align:right;font-weight:bold;">Rs. ${total.toLocaleString()}</td></tr>`).join('');
    return `<html><head><title>All Customers Sales Report</title><style>* { margin: 0; padding: 0; } body { font-family: Arial, sans-serif; background: #fff; color: #333; padding: 30px; line-height: 1.8; } .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #1976d2; padding-bottom: 20px; } .header h1 { color: #1976d2; font-size: 26px; margin-bottom: 10px; font-weight: 800; } .header p { font-size: 12px; margin: 3px 0; color: #666; } .seller-section { background: #f0f7ff; padding: 15px; border-left: 4px solid #1976d2; margin-bottom: 25px; border-radius: 4px; } .seller-section h3 { color: #1976d2; font-size: 14px; margin-bottom: 8px; font-weight: 700; } .seller-section p { font-size: 12px; margin: 4px 0; color: #555; } .summary-section { background: #fff9f0; padding: 15px; border-left: 4px solid #ff9800; margin-bottom: 25px; border-radius: 4px; } .summary-section h3 { color: #ff9800; font-size: 14px; margin-bottom: 8px; font-weight: 700; } .summary-stat { display: flex; justify-content: space-between; font-size: 12px; margin: 6px 0; padding: 4px 0; border-bottom: 1px solid #ffe0b2; } .summary-stat .label { font-weight: 600; } .summary-stat .value { font-weight: 700; color: #1976d2; } h2 { color: #1976d2; font-size: 16px; margin-top: 25px; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid #ddd; } table { width: 100%; border-collapse: collapse; margin: 15px 0; } th { background-color: #1976d2; color: white; padding: 12px; text-align: left; font-weight: bold; font-size: 13px; } td { padding: 10px; font-size: 12px; } tr:nth-child(even) { background-color: #f9f9f9; } .total-row { background-color: #e8f4f8; font-weight: bold; } .total-row td { padding: 12px; border-top: 2px solid #1976d2; } .footer { margin-top: 30px; text-align: center; font-size: 11px; color: #999; border-top: 1px solid #ddd; padding-top: 15px; } @media print { body { padding: 0; } }</style></head><body><div class="header"><h1>All Customers Sales Report</h1><p>Generated: ${new Date().toLocaleString()}</p></div><div class="seller-section"><h3>Seller Information</h3><p style="font-size: 12px; margin: 4px 0; color: #555;"><strong>Seller ID:</strong> ${sellerId}</p><p style="font-size: 12px; margin: 4px 0; color: #555;"><strong>Company Name:</strong> New Adil Electric Concern</p><p style="font-size: 12px; margin: 4px 0; color: #555;"><strong>Address:</strong> 4-B, Jamiat Center, Shah Alam Market, Lahore, Pakistan</p></div><div class="summary-section"><h3>Sales Summary</h3><div class="summary-stat"><span class="label">Total Customers:</span><span class="value">${customers.length}</span></div><div class="summary-stat"><span class="label">Total Invoices:</span><span class="value">${allInvoices.length}</span></div><div class="summary-stat"><span class="label">Total Sales Amount:</span><span class="value">Rs. ${grandTotal.toLocaleString()}</span></div></div><h2>Customer Details & Sales</h2><table><thead><tr><th style="width:5%">S/N</th><th style="width:25%">Customer Name</th><th style="width:25%">Email</th><th style="width:20%">Contact</th><th style="width:10%;text-align:center;">Invoices</th><th style="width:15%;text-align:right;">Total Sales</th></tr></thead><tbody>${customersHTML}<tr class="total-row"><td colspan="5" style="text-align:right;padding:12px;">TOTAL</td><td style="text-align:right;padding:12px;">Rs. ${grandTotal.toLocaleString()}</td></tr></tbody></table><h2>Monthly Sales Breakdown</h2><table><thead><tr><th style="width:50%">Month</th><th style="width:50%;text-align:right;">Total Sales</th></tr></thead><tbody>${monthlyHTML || '<tr><td colspan="2" style="text-align:center;padding:12px;">No sales data</td></tr>'}</tbody></table><h2>Yearly Sales Breakdown</h2><table><thead><tr><th style="width:50%">Year</th><th style="width:50%;text-align:right;">Total Sales</th></tr></thead><tbody>${yearlyHTML || '<tr><td colspan="2" style="text-align:center;padding:12px;">No sales data</td></tr>'}</tbody></table><div class="footer"><p>This is an automated sales report for all customers. For any discrepancies, please verify with the seller.</p></div></body></html>`;
  };

  const handlePrintCustomerDetail = () => {
    const html = generateAllCustomersDetailPrintHTML();
    const w = window.open('', '_blank');
    if (!w || !w.document) { alert('Popup blocked. Please allow popups to print.'); return; }
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 250);
  };

  return (
    <Box
      sx={{
        mt: 2,
        width: '100%',
        backgroundColor: darkMode ? '#121212' : '#fafafa',
        minHeight: '100vh',
        
      }}
    >
      <Typography
        variant="h4"
        align="center"
        sx={{ mb: 3, fontWeight: 600, color: darkMode ? '#fff' : '#333' }}
      >
        Client Invoices & Analytics
      </Typography>

      {/* Invalid Seller ID Error */}
      {!isValidSellerId && (
        <Alert severity="error" sx={{ mb: 2 }}>
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
            Invalid Seller ID
          </Typography>
          <Typography variant="caption" display="block" sx={{ mb: 1 }}>
            The seller ID is missing or invalid. Please try one of the following:
          </Typography>
          <Box component="ul" sx={{ mb: 1, pl: 2 }}>
            <Typography variant="caption" component="li">Go back to the Seller Clients list</Typography>
            <Typography variant="caption" component="li">Click on a seller's "View Clients" button</Typography>
            <Typography variant="caption" component="li">Check the URL to ensure it has a valid seller ID (e.g., /admin/seller-clients/123abc)</Typography>
          </Box>
          <Button
            size="small"
            variant="outlined"
            onClick={() => window.history.back()}
            sx={{ mt: 1 }}
          >
            Go Back
          </Button>
        </Alert>
      )}

      {/* Error Alert */}
      {error && isValidSellerId && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Search & Filter Section */}
      {isValidSellerId && (
        <Paper
          elevation={3}
          sx={{
            p: 3,
            mb: 3,
            backgroundColor: darkMode ? '#1e1e1e' : '#fff',
            borderRadius: 2,
            border: darkMode ? '1px solid #333' : 'none',
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" sx={{ color: darkMode ? '#fff' : '#333' }}>
              Search & Filter
            </Typography>
            <Button
              size="small"
              variant="contained"
              color="primary"
              startIcon={<PrintIcon />}
              onClick={() => handlePrintCustomerDetail()}
              disabled={customers.length === 0}
              sx={{ textTransform: 'none', borderRadius: 1 }}
            >
              Print All Customers
            </Button>
          </Box>
          <Grid container spacing={2} alignItems="flex-end">
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                label="Customer Name"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search by name..."
                variant="outlined"
                size="small"
                onKeyPress={e => e.key === 'Enter' && handleAdvancedSearch()}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: darkMode ? '#2a2a2a' : '#f9f9f9',
                    '&:hover fieldset': { borderColor: '#1976d2' },
                  },
                }}
              />
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                label="Customer Contact No"
                value={contactQuery}
                onChange={e => setContactQuery(e.target.value)}
                placeholder="Search by contact..."
                variant="outlined"
                size="small"
                onKeyPress={e => e.key === 'Enter' && handleAdvancedSearch()}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: darkMode ? '#2a2a2a' : '#f9f9f9',
                    '&:hover fieldset': { borderColor: '#1976d2' },
                  },
                }}
              />
            </Grid>

            {/* Date filters removed from Customer Search section - moved to Invoices panel */}

            <Grid item xs={12} sm={6} md={2}>
              <Button
                fullWidth
                variant="contained"
                color="primary"
                startIcon={<SearchIcon />}
                onClick={handleAdvancedSearch}
                disabled={loadingInvoices}
                sx={{ height: '40px' }}
              >
                Search
              </Button>
            </Grid>

            <Grid item xs={12} sm={6} md={2}>
              <Button
                fullWidth
                variant="outlined"
                onClick={handleClearFilters}
                sx={{ height: '40px' }}
              >
                Clear
              </Button>
            </Grid>

            <Grid item xs={12} sm={6} md={1}>
              <Button
                fullWidth
                variant="outlined"
                size="small"
                startIcon={<RefreshIcon />}
                onClick={fetchCustomers}
                disabled={loadingCustomers}
                sx={{ height: '40px' }}
              >
                Refresh
              </Button>
            </Grid>
          </Grid>

          {/* Active Filters Display */}
          {(query || contactQuery) && (
            <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {query && <Chip label={`Customer: ${query}`} onDelete={() => setQuery('')} size="small" />}
              {contactQuery && <Chip label={`Contact: ${contactQuery}`} onDelete={() => setContactQuery('')} size="small" />}
            </Box>
          )}
        </Paper>
      )}

      {/* Loading State */}
      {isValidSellerId && (loadingCustomers || loadingInvoices) && (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
          <CircularProgress />
        </Box>
      )}

      {/* Customers & Invoices Grid */}
      {isValidSellerId && !loadingCustomers && !loadingInvoices && (
        <Grid container spacing={2} wrap="nowrap" sx={{ overflowX: 'auto' }}>
          {/* Customers Panel */}
          <Grid item xs={12} md={4} sx={{ flex: '0 0 360px', maxWidth: 360 }}>
            <Paper
              elevation={3}
              sx={{
                backgroundColor: darkMode ? '#1e1e1e' : '#fff',
                borderRadius: 2,
                border: darkMode ? '1px solid #333' : 'none',
                overflow: 'hidden',
              }}
            >
              <Box sx={{ p: 2, borderBottom: `2px solid ${darkMode ? '#333' : '#e0e0e0'}` }}>
                <Typography variant="h6" sx={{ color: darkMode ? '#fff' : '#333', fontWeight: 600 }}>
                  Customers ({customers.length})
                </Typography>
              </Box>

              {customers.length === 0 ? (
                <Box sx={{ p: 3, textAlign: 'center' }}>
                  <Typography variant="body2" color="textSecondary">
                    No customers found.
                  </Typography>
                </Box>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: darkMode ? '#2a2a2a' : '#f5f5f5' }}>
                        <TableCell sx={{ fontWeight: 600, color: darkMode ? '#fff' : '#333' }}>Name</TableCell>
                        <TableCell sx={{ fontWeight: 600, color: darkMode ? '#fff' : '#333', textAlign: 'center' }}>Contact Info</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 600, color: darkMode ? '#fff' : '#333' }}>Invoices</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 600, color: darkMode ? '#fff' : '#333' }}>Refunds</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {customers.map((cust, idx) => {
                        // Count refund invoices for this customer
                        const refundCount = (cust.invoices || []).filter(inv => inv.refunds && inv.refunds.length > 0).length;
                        return (
                          <TableRow
                            key={idx}
                            onClick={() => openCustomer(cust)}
                            sx={{
                              '&:hover': {
                                backgroundColor: darkMode ? '#2a2a2a' : '#f9f9f9',
                                cursor: 'pointer',
                                transition: 'background-color 0.2s ease',
                              },
                              backgroundColor: darkMode ? '#1e1e1e' : '#fff',
                              borderBottom: `1px solid ${darkMode ? '#333' : '#e0e0e0'}`,
                            }}
                          >
                            <TableCell sx={{ color: darkMode ? '#fff' : '#333' }}>
                              {cust.name}
                            </TableCell>
                            <TableCell sx={{ textAlign: 'center' }}>
                              <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', alignItems: 'center' }}>
                                {cust.email && (
                                  <Tooltip title={cust.email}>
                                    <EmailIcon sx={{ fontSize: '1.2rem', color: '#1976d2', cursor: 'pointer' }} />
                                  </Tooltip>
                                )}
                                {cust.contact && (
                                  <Tooltip title={cust.contact}>
                                    <PhoneIcon sx={{ fontSize: '1.2rem', color: '#388e3c', cursor: 'pointer' }} />
                                  </Tooltip>
                                )}
                                {!cust.email && !cust.contact && <Typography variant="caption" sx={{ color: darkMode ? '#999' : '#ccc' }}>-</Typography>}
                              </Box>
                            </TableCell>
                            <TableCell align="center" sx={{ color: darkMode ? '#fff' : '#333' }}>{(cust.invoices && cust.invoices.length) || 0}</TableCell>
                            <TableCell align="center" sx={{ color: darkMode ? '#fff' : '#333' }}>{refundCount}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Paper>
          </Grid>

          {/* Invoices & Analytics Panel */}
          <Grid item xs={12} md={8} sx={{ flex: '1 1 800px', minWidth: 600 }}>
            <Paper
              elevation={3}
              sx={{
                backgroundColor: darkMode ? '#1e1e1e' : '#fff',
                borderRadius: 2,
                border: darkMode ? '1px solid #333' : 'none',
                overflow: 'hidden',
              }}
            >
              <Box sx={{ p: 2, borderBottom: `2px solid ${darkMode ? '#333' : '#e0e0e0'}` }}>
                <Grid container alignItems="center" spacing={2} justifyContent="space-between">
                  <Grid item xs={12} md={7}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      <Typography variant="h6" sx={{ color: darkMode ? '#fff' : '#333', fontWeight: 600 }}>
                        {selectedCustomer ? `Invoices - ${selectedCustomer.name}` : 'Invoices'}
                      </Typography>

                      {selectedCustomer && (
                        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mt: 0.5, flexWrap: 'wrap' }}>
                          <Typography variant="body2" sx={{ color: darkMode ? '#ddd' : '#555' }}>Contact: {selectedCustomer.contact || '-'}</Typography>
                          <Typography variant="body2" sx={{ color: darkMode ? '#ddd' : '#555' }}>Email: {selectedCustomer.email || '-'}</Typography>
                          <Typography variant="body2" sx={{ color: darkMode ? '#ddd' : '#555' }}>Invoices: {(selectedCustomer.invoices || []).length || 0}</Typography>
                        </Box>
                      )}
                    </Box>
                  </Grid>

                  <Grid item xs={12} md={5}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1.5 }}>
                      {/* Progress Circle with Legend */}
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1 }}>
                        <Box sx={{ position: 'relative', width: 80, height: 80 }}>
                          <CircularProgress variant="determinate" value={100} size={80} thickness={6} sx={{ color: '#d32f2f' }} />
                          <Box sx={{ position: 'absolute', left: 0, top: 0 }}>
                            {/* amber circle shows paid+partial; percentPaid already includes partial */}
                            <CircularProgress variant="determinate" value={paymentProgress.percentPaid} size={80} thickness={6} sx={{ color: '#ffb300' }} />
                          </Box>
                          <Box sx={{ position: 'absolute', left: 0, top: 0 }}>
                            <CircularProgress variant="determinate" value={paymentProgress.percentPaidOnly} size={80} thickness={6} sx={{ color: '#388e3c' }} />
                          </Box>
                          <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{paymentProgress.percentPaidOnly}%</Typography>
                            <Typography variant="caption" sx={{ fontSize: '10px' }}>Paid</Typography>
                          </Box>
                        </Box>

                        {/* Horizontal Legend */}
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', ml: 1, flexDirection: 'column' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Box sx={{ width: 12, height: 12, backgroundColor: '#388e3c', borderRadius: '50%' }} />
                            <Typography variant="caption" sx={{ fontSize: '11px' }}>Paid {paymentProgress.percentPaidOnly}%</Typography>
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Box sx={{ width: 12, height: 12, backgroundColor: '#ffb300', borderRadius: '50%' }} />
                            <Typography variant="caption" sx={{ fontSize: '11px' }}>Partial {paymentProgress.percentPartial}%</Typography>
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Box sx={{ width: 12, height: 12, backgroundColor: '#d32f2f', borderRadius: '50%' }} />
                            <Typography variant="caption" sx={{ fontSize: '11px' }}>Unpaid {paymentProgress.percentUnpaid}%</Typography>
                          </Box>
                        </Box>
                      </Box>

                      {/* Print Button Below Progress Circle */}
                      <Button
                        size="small"
                        variant="contained"
                        color="primary"
                        startIcon={<PrintIcon />}
                        onClick={() => {
                          if (invoices.length === 0) {
                            alert('No invoices to print. Please select a customer first.');
                            return;
                          }
                          const printHTML = generatePrintHTML();
                          const printWindow = window.open('', '_blank');
                          if (!printWindow || !printWindow.document) {
                            alert('Popup blocked. Please allow popups to print.');
                            return;
                          }
                          printWindow.document.write(printHTML);
                          printWindow.document.close();
                          setTimeout(() => printWindow.print(), 250);
                        }}
                        disabled={invoices.length === 0}
                        sx={{ textTransform: 'none', borderRadius: 1 }}
                      >
                        Print Invoices
                      </Button>
                    </Box>
                  </Grid>
                </Grid>

                {/* Invoice-level search and date filters */}
                <Grid container spacing={2} alignItems="center" sx={{ mt: 1 }}>
                  <Grid item xs={12} md={5}>
                    <TextField
                      fullWidth
                      label="Search Invoice"
                      value={invoiceQuery}
                      onChange={e => setInvoiceQuery(e.target.value)}
                      placeholder="Search by invoice id (comma-separated, e.g., ba87b4, db5df8)..."
                      variant="outlined"
                      size="small"
                      onKeyPress={e => e.key === 'Enter' && handleInvoiceSearch()}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          backgroundColor: darkMode ? '#2a2a2a' : '#f9f9f9',
                          '&:hover fieldset': { borderColor: '#1976d2' },
                        },
                      }}
                    />
                  </Grid>

                  <Grid item xs={12} md={3}>
                    <TextField
                      fullWidth
                      type="date"
                      label="Start Date"
                      InputLabelProps={{ shrink: true }}
                      value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                      variant="outlined"
                      size="small"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          backgroundColor: darkMode ? '#2a2a2a' : '#f9f9f9',
                        },
                      }}
                    />
                  </Grid>

                  <Grid item xs={12} md={3}>
                    <TextField
                      fullWidth
                      type="date"
                      label="End Date"
                      InputLabelProps={{ shrink: true }}
                      value={endDate}
                      onChange={e => setEndDate(e.target.value)}
                      variant="outlined"
                      size="small"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          backgroundColor: darkMode ? '#2a2a2a' : '#f9f9f9',
                        },
                      }}
                    />
                  </Grid>

                  <Grid item xs={12} md={1}>
                    <Button
                      fullWidth
                      variant="contained"
                      size="small"
                      onClick={handleApplyDateFilter}
                      sx={{ height: '40px' }}
                    >
                      Apply
                    </Button>
                  </Grid>
                </Grid>
              </Box>

              {invoices.length === 0 ? (
                <Box sx={{ p: 3, textAlign: 'center' }}>
                  <Typography variant="body2" color="textSecondary">
                    {selectedCustomer || query ? 'No invoices found.' : 'Select a customer to view invoices.'}
                  </Typography>
                </Box>
              ) : (
                <>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: darkMode ? '#2a2a2a' : '#f5f5f5' }}>
                          <TableCell sx={{ fontWeight: 600, color: darkMode ? '#fff' : '#333' }}>Invoice #</TableCell>
                          <TableCell sx={{ fontWeight: 600, color: darkMode ? '#fff' : '#333' }}>Date</TableCell>
                          <TableCell sx={{ fontWeight: 600, color: darkMode ? '#fff' : '#333' }}>Items</TableCell>
                          <TableCell sx={{ fontWeight: 600, color: darkMode ? '#fff' : '#333' }}>Item Price</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600, color: darkMode ? '#fff' : '#333' }}>Qty</TableCell>
                          <TableCell sx={{ fontWeight: 600, color: darkMode ? '#fff' : '#333' }}>Payment Method</TableCell>
                          <TableCell sx={{ fontWeight: 600, color: darkMode ? '#fff' : '#333' }}>Status</TableCell>
                          <TableCell align="center" sx={{ fontWeight: 600, color: darkMode ? '#fff' : '#333' }}>Warranty</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600, color: darkMode ? '#fff' : '#333' }}>Paid Amount</TableCell>

                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {invoices.map(inv => {
                          const shortInv = inv.invoiceNumber || (inv._id ? inv._id.toString().slice(-6) : '-');
                          const itemsList = (inv.items || []).map(i => {
                            const origQty = Number(i.quantity) || 0;
                            let refunded = 0;
                            (inv.refunds || []).forEach(r => {
                              (r.items || []).forEach(it => {
                                if (String(it.productId) === String(i.productId)) {
                                  refunded += Number(it.quantity) || 0;
                                }
                              });
                            });
                            const remaining = origQty - refunded;
                            return `${i.productName || i.SKU || '-'} x${remaining}${refunded ? ` (-${refunded} ref)` : ''}`;
                          }).filter(Boolean).slice(0, 3).join(', ');
                          const priceList = (inv.items || []).map(i => Number(i.perPiecePrice || 0)).slice(0, 3).map(p => `Rs. ${p.toLocaleString()}`).join(', ');

                          // Calculate warranty status
                          const created = new Date(inv.createdAt);
                          const warrantyUntil = new Date(created);
                          warrantyUntil.setFullYear(warrantyUntil.getFullYear() + 1);
                          const underWarranty = new Date() <= warrantyUntil;

                          // Build warranty tooltip with claimed items
                          const perItem = new Map();
                          (inv.warrantyClaims || []).forEach(wc => {
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
                              key={inv._id || inv.id}
                              onClick={() => {
                                const html = generateInvoiceHTML(inv, products);
                                setPrintPreviewHtml(html);
                                setInvoiceDetail(inv);
                                setInvoiceDialogOpen(true);
                              }}
                              sx={{
                                '&:hover': { backgroundColor: darkMode ? '#2a2a2a' : '#f9f9f9', transition: 'background-color 0.2s ease', cursor: 'pointer' },
                                backgroundColor: darkMode ? '#1e1e1e' : '#fff',
                                borderBottom: `1px solid ${darkMode ? '#333' : '#e0e0e0'}`,
                              }}
                            >
                              <TableCell sx={{ color: darkMode ? '#fff' : '#333' }}>{shortInv}</TableCell>
                              <TableCell sx={{ color: darkMode ? '#fff' : '#666', fontSize: '0.875rem' }}>{new Date(inv.date || inv.createdAt).toLocaleString()}</TableCell>
                              <TableCell sx={{ color: darkMode ? '#fff' : '#333' }}>{itemsList || '-'}</TableCell>
                              <TableCell sx={{ color: darkMode ? '#fff' : '#333' }}>{priceList || '-'}</TableCell>
                              <TableCell align="right" sx={{ color: darkMode ? '#fff' : '#333' }}>{inv.totalQuantity || (inv.items || []).reduce((s, i) => s + (Number(i.quantity) || 0), 0)}</TableCell>
                              <TableCell sx={{ color: darkMode ? '#fff' : '#333' }}>{inv.paymentMethod || '-'}</TableCell>
                              <TableCell sx={{ color: darkMode ? '#fff' : '#333' }}>{inv.paymentStatus || '-'}</TableCell>
                              <TableCell align="center">
                                {underWarranty ? (
                                  <Tooltip title={warrantyTooltip} arrow>
                                    <Chip
                                      label={` ${warrantyUntil.toLocaleDateString()}`}
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
                              <TableCell align="right" sx={{ color: darkMode ? '#fff' : '#333', fontWeight: 500 }}>{(() => { const refundTotal = inv.refunds ? inv.refunds.reduce((sum, r) => sum + Number(r.totalRefundAmount || 0), 0) : 0; const actualPaid = Number(inv.totalAmount || inv.netAmount || 0) - refundTotal; return `Rs. ${actualPaid.toLocaleString()}`; })()}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>

                  {/* Summary Footer */}
                  <Box
                    sx={{
                      p: 2,
                      backgroundColor: darkMode ? '#2a2a2a' : '#f5f5f5',
                      borderTop: `1px solid ${darkMode ? '#333' : '#e0e0e0'}`,
                      textAlign: 'right',
                    }}
                  >
                    <Typography variant="body2" color="textSecondary">
                      Total Invoices: <strong>{invoices.length}</strong> | Total Amount:{' '}
                      <strong>Rs. {totalRevenue.toLocaleString()}</strong>
                    </Typography>
                  </Box>

                  {/* Invoice Detail Dialog */}
                  <Dialog open={invoiceDialogOpen} onClose={() => setInvoiceDialogOpen(false)} maxWidth="xs" fullWidth>
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
                      <Button onClick={() => setInvoiceDialogOpen(false)}>Close</Button>
                    </DialogActions>
                  </Dialog>
          
                  <Dialog>
                    <DialogActions>
                      <Button onClick={() => { if (invoiceDetail) { handlePrintInvoice(invoiceDetail); } }} startIcon={<PrintIcon />} variant="contained">Print</Button>
                      <Button onClick={() => setInvoiceDialogOpen(false)}>Close</Button>
                    </DialogActions>
                  </Dialog>

                  {/* Refund Invoices Section */}
                  {refundInvoices.length > 0 && (
                    <Box sx={{ mt: 3 }}>
                      <Box sx={{ p: 2, borderBottom: `2px solid ${darkMode ? '#333' : '#e0e0e0'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="h6" sx={{ color: darkMode ? '#fff' : '#333', fontWeight: 600 }}>
                          Refund Invoices - {selectedCustomer?.name || 'All Customers'}
                        </Typography>
                        <Button
                          size="small"
                          variant="contained"
                          color="error"
                          startIcon={<PrintIcon />}
                          onClick={() => {
                            const dateRange = startDate || endDate ? `From: ${startDate || 'All time'} To: ${endDate || 'Now'}` : 'All Dates';
                            const customerName = selectedCustomer ? selectedCustomer.name : 'All Customers';
                            const customerEmail = selectedCustomer?.email || '-';

                            const refundRowsHTML = refundInvoices.map((inv, idx) => {
                              const shortInv = inv.invoiceNumber || (inv._id ? inv._id.toString().slice(-6) : '-');
                              const refundDetails = (inv.refunds || []).map(ref => {
                                const items = (ref.items || []).map(i => i.productName || i.SKU || 'Item').join(', ');
                                return `${ref.createdAt ? new Date(ref.createdAt).toLocaleDateString() : '-'}: ${items} (${ref.totalRefundQty || 0} pcs) - Rs. ${ref.totalRefundAmount || 0}`;
                              }).join('<br/>');
                              return `
                                <tr>
                                  <td style="padding:10px;border-bottom:1px solid #ddd;text-align:center;">${idx + 1}</td>
                                  <td style="padding:10px;border-bottom:1px solid #ddd;font-weight:bold;">${shortInv}</td>
                                  <td style="padding:10px;border-bottom:1px solid #ddd;">${new Date(inv.date || inv.createdAt).toLocaleDateString()}</td>
                                  <td style="padding:10px;border-bottom:1px solid #ddd;">${(inv.items || []).map(i => i.productName).join(', ')}</td>
                                  <td style="padding:10px;border-bottom:1px solid #ddd;">${refundDetails}</td>
                                  <td style="padding:10px;border-bottom:1px solid #ddd;text-align:right;font-weight:bold;">Rs. ${(inv.refunds || []).reduce((sum, r) => sum + (r.totalRefundAmount || 0), 0).toLocaleString()}</td>
                                </tr>
                              `;
                            }).join('');

                            const html = `
                              <html>
                                <head>
                                  <title>Refund Invoices Report</title>
                                  <style>
                                    * { margin: 0; padding: 0; }
                                    body { font-family: 'Arial', sans-serif; background: #fff; color: #333; padding: 20px; line-height: 1.6; }
                                    .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #d32f2f; padding-bottom: 15px; }
                                    .header h1 { color: #d32f2f; font-size: 24px; margin-bottom: 10px; }
                                    .header p { font-size: 13px; margin: 4px 0; }
                                    .info-section { background: #f9f9f9; padding: 12px 15px; margin: 15px 0; border-left: 4px solid #d32f2f; }
                                    .info-section p { font-size: 13px; margin: 4px 0; }
                                    h2 { color: #d32f2f; font-size: 16px; margin-top: 20px; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 2px solid #ddd; }
                                    table { width: 100%; border-collapse: collapse; margin: 10px 0; }
                                    th { background-color: #d32f2f; color: white; padding: 12px; text-align: left; font-weight: bold; font-size: 13px; }
                                    td { padding: 10px; font-size: 12px; }
                                    tr:nth-child(even) { background-color: #f9f9f9; }
                                    .total-row { background-color: #ffebee; font-weight: bold; }
                                    .total-row td { padding: 12px; border-top: 2px solid #d32f2f; }
                                    @media print {
                                      body { padding: 0; }
                                      .page-break { page-break-after: always; }
                                    }
                                  </style>
                                </head>
                                <body>
                                  <div class="header">
                                    <h1>Refund Invoices Report</h1>
                                    <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
                                  </div>

                                  <div class="info-section">
                                    <p><strong>Customer:</strong> ${customerName} ${customerEmail && customerEmail !== '-' ? `(${customerEmail})` : ''}</p>
                                    <p><strong>Date Range:</strong> ${dateRange}</p>
                                    <p><strong>Total Refund Invoices:</strong> ${refundInvoices.length}</p>
                                  </div>

                                  <h2>Refund Details</h2>
                                  <table>
                                    <thead>
                                      <tr>
                                        <th style="width:5%">S/N</th>
                                        <th style="width:10%">Invoice #</th>
                                        <th style="width:10%">Date</th>
                                        <th style="width:25%">Original Items</th>
                                        <th style="width:40%">Refund Details</th>
                                        <th style="width:10%;text-align:right;">Refund Amount</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      ${refundRowsHTML}
                                      <tr class="total-row">
                                        <td colspan="5" style="text-align:right;padding:12px;">TOTAL REFUNDED</td>
                                        <td style="text-align:right;padding:12px;">Rs. ${refundInvoices.reduce((sum, inv) => sum + (inv.refunds || []).reduce((s, r) => s + (r.totalRefundAmount || 0), 0), 0).toLocaleString()}</td>
                                      </tr>
                                    </tbody>
                                  </table>

                                  <div style="margin-top:30px;text-align:center;font-size:11px;color:#999;">
                                    <p>This is an automated refund report. Please verify totals before processing.</p>
                                  </div>
                                </body>
                              </html>
                            `;
                            const printWindow = window.open('', '_blank');
                            if (!printWindow || !printWindow.document) {
                              alert('Popup blocked. Please allow popups to print.');
                              return;
                            }
                            printWindow.document.write(html);
                            printWindow.document.close();
                            setTimeout(() => printWindow.print(), 250);
                          }}
                          sx={{ textTransform: 'none', borderRadius: 1 }}
                        >
                          Print Refund Invoices
                        </Button>
                      </Box>

                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow sx={{ bgcolor: darkMode ? '#2a2a2a' : '#f5f5f5' }}>
                              <TableCell sx={{ fontWeight: 600, color: darkMode ? '#fff' : '#333' }}>Invoice #</TableCell>
                              <TableCell sx={{ fontWeight: 600, color: darkMode ? '#fff' : '#333' }}>Date</TableCell>
                              <TableCell sx={{ fontWeight: 600, color: darkMode ? '#fff' : '#333' }}>Original Items</TableCell>
                              <TableCell sx={{ fontWeight: 600, color: darkMode ? '#fff' : '#333' }}>Refund Details</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 600, color: darkMode ? '#fff' : '#333' }}>Refund Amount</TableCell>
                              <TableCell align="center" sx={{ fontWeight: 600, color: darkMode ? '#fff' : '#333' }}>Actions</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {refundInvoices.map((inv, idx) => {
                              const shortInv = inv.invoiceNumber || (inv._id ? inv._id.toString().slice(-6) : '-');
                              const originalItems = (inv.items || []).map(i => i.productName || i.SKU || '').filter(Boolean).join(', ');
                              const totalRefundAmount = (inv.refunds || []).reduce((sum, r) => sum + (Number(r.totalRefundAmount) || 0), 0);

                              return (
                                <TableRow
                                  key={inv._id || idx}
                                  sx={{
                                    '&:hover': { backgroundColor: darkMode ? '#2a2a2a' : '#f9f9f9', transition: 'background-color 0.2s ease' },
                                    backgroundColor: darkMode ? '#1e1e1e' : '#fff',
                                    borderBottom: `1px solid ${darkMode ? '#333' : '#e0e0e0'}`,
                                  }}
                                >
                                  <TableCell sx={{ color: darkMode ? '#fff' : '#333' }}>{shortInv}</TableCell>
                                  <TableCell sx={{ color: darkMode ? '#fff' : '#666', fontSize: '0.875rem' }}>{new Date(inv.date || inv.createdAt).toLocaleString()}</TableCell>
                                  <TableCell sx={{ color: darkMode ? '#fff' : '#333' }}>{originalItems || '-'}</TableCell>
                                  <TableCell sx={{ color: darkMode ? '#fff' : '#333', fontSize: '0.85rem' }}>
                                    {(inv.refunds || []).map((ref, ridx) => (
                                      <Box key={ridx} sx={{ mb: 0.5 }}>
                                        <Typography variant="caption" sx={{ display: 'block', fontWeight: 600 }}>
                                          {ref.createdAt ? new Date(ref.createdAt).toLocaleDateString() : '-'}
                                        </Typography>
                                        <Typography variant="caption" sx={{ display: 'block' }}>
                                          {(ref.items || []).map(i => i.productName || i.SKU || 'Item').join(', ')} ({ref.totalRefundQty || 0} pcs)
                                        </Typography>
                                        {ref.reason && (
                                          <Typography variant="caption" sx={{ display: 'block', color: 'error.main' }}>
                                            Reason: {ref.reason}
                                          </Typography>
                                        )}
                                      </Box>
                                    ))}
                                  </TableCell>
                                  <TableCell align="right" sx={{ color: darkMode ? '#fff' : '#333', fontWeight: 500 }}>Rs. {totalRefundAmount.toLocaleString()}</TableCell>
                                  <TableCell align="center">
                                    <Button size="small" variant="outlined" onClick={() => {
                                      const html = generateRefundInvoicePrintHTML(inv);
                                      setPrintPreviewHtml(html);
                                      setInvoiceDetail(inv);
                                      setInvoiceDialogOpen(true);
                                    }} sx={{ textTransform: 'none' }}>
                                      View
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </TableContainer>

                      <Box
                        sx={{
                          p: 2,
                          backgroundColor: darkMode ? '#2a2a2a' : '#f5f5f5',
                          borderTop: `1px solid ${darkMode ? '#333' : '#e0e0e0'}`,
                          textAlign: 'right',
                        }}
                      >
                        <Typography variant="body2" color="textSecondary">
                          Total Refund Invoices: <strong>{refundInvoices.length}</strong> | Total Refunded:{' '}
                          <strong>Rs. {refundInvoices.reduce((sum, inv) => sum + (inv.refunds || []).reduce((s, r) => s + (Number(r.totalRefundAmount) || 0), 0), 0).toLocaleString()}</strong>
                        </Typography>
                      </Box>
                    </Box>
                  )}

                  {/* Monthly & Yearly Progress Overview (moved below grid) */}
                  <Box sx={{ mt: 2, px: 2, pb: 2 }}>
                    <Paper elevation={0} sx={{ p: 2, backgroundColor: darkMode ? '#141414' : '#fafafa' }}>
                      <Typography variant="subtitle1" sx={{ mb: 1, color: darkMode ? '#fff' : '#333', fontWeight: 600 }}>Breakdown Progress</Typography>
                      <Grid container spacing={2} alignItems="center">
                        <Grid item xs={12} md={6}>
                          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                            {Object.keys(monthlyTotals).length > 0 ? (
                              <>
                                <Box sx={{ position: 'relative', width: 80, height: 80 }}>
                                  {(() => {
                                    const topMonth = Object.keys(monthlyTotals)[0];
                                    const progress = monthlyPaymentProgress[topMonth];
                                    if (!progress) return null;
                                    const totalNet = progress.totalNet;
                                    const paidTotal = progress.paidFull + progress.partialPaid;
                                    const percentPaid = totalNet > 0 ? Math.round((progress.paidFull / totalNet) * 100) : 0;
                                    const percentPartial = totalNet > 0 ? Math.round((progress.partialPaid / totalNet) * 100) : 0;
                                    const percentUnpaid = 100 - percentPaid - percentPartial;
                                    return (
                                      <>
                                        {/* Red base circle (unpaid) */}
                                        <CircularProgress variant="determinate" value={100} size={80} thickness={6} sx={{ color: '#d32f2f' }} />
                                        {/* Amber middle circle (partial + paid) */}
                                        <Box sx={{ position: 'absolute', left: 0, top: 0 }}>
                                          <CircularProgress variant="determinate" value={percentPartial + percentPaid} size={80} thickness={6} sx={{ color: '#ffb300' }} />
                                        </Box>
                                        {/* Green top circle (paid) */}
                                        <Box sx={{ position: 'absolute', left: 0, top: 0 }}>
                                          <CircularProgress variant="determinate" value={percentPaid} size={80} thickness={6} sx={{ color: '#388e3c' }} />
                                        </Box>
                                        {/* Center text */}
                                        <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                                          <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '11px' }}>{percentPaid}%</Typography>
                                          <Typography variant="caption" sx={{ fontSize: '9px' }}>Paid</Typography>
                                        </Box>
                                      </>
                                    );
                                  })()}
                                </Box>
                                <Box sx={{ flex: 1 }}>
                                  <Typography variant="caption" sx={{ mb: 1 }}>Monthly Breakdown</Typography>
                                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                    {Object.entries(monthlyTotals).map(([month, total], i) => {
                                      const progress = monthlyPaymentProgress[month];
                                      if (!progress) return null;
                                      const percentPaid = progress.totalNet > 0 ? Math.round((progress.paidFull / progress.totalNet) * 100) : 0;
                                      return (
                                        <Box key={month} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                                            <Box sx={{ width: 6, height: 6, backgroundColor: '#388e3c', borderRadius: '50%' }} />
                                            <Box sx={{ width: 6, height: 6, backgroundColor: '#ffb300', borderRadius: '50%' }} />
                                            <Box sx={{ width: 6, height: 6, backgroundColor: '#d32f2f', borderRadius: '50%' }} />
                                          </Box>
                                          <Typography variant="caption" sx={{ flex: 1, fontSize: '11px' }}>{month}</Typography>
                                          <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '11px' }}>Rs. {total.toLocaleString()}</Typography>
                                        </Box>
                                      );
                                    })}
                                  </Box>
                                </Box>
                              </>
                            ) : (
                              <Box sx={{ textAlign: 'center', width: '100%' }}>
                                <Typography variant="caption" color="textSecondary">No monthly data</Typography>
                              </Box>
                            )}
                          </Box>
                        </Grid>

                        <Grid item xs={12} md={6}>
                          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                            {Object.keys(yearlyTotals).length > 0 ? (
                              <>
                                <Box sx={{ position: 'relative', width: 80, height: 80 }}>
                                  {(() => {
                                    const topYear = Object.keys(yearlyTotals)[0];
                                    const progress = yearlyPaymentProgress[topYear];
                                    if (!progress) return null;
                                    const totalNet = progress.totalNet;
                                    const paidTotal = progress.paidFull + progress.partialPaid;
                                    const percentPaid = totalNet > 0 ? Math.round((progress.paidFull / totalNet) * 100) : 0;
                                    const percentPartial = totalNet > 0 ? Math.round((progress.partialPaid / totalNet) * 100) : 0;
                                    const percentUnpaid = 100 - percentPaid - percentPartial;
                                    return (
                                      <>
                                        {/* Red base circle (unpaid) */}
                                        <CircularProgress variant="determinate" value={100} size={80} thickness={6} sx={{ color: '#d32f2f' }} />
                                        {/* Amber middle circle (partial + paid) */}
                                        <Box sx={{ position: 'absolute', left: 0, top: 0 }}>
                                          <CircularProgress variant="determinate" value={percentPartial + percentPaid} size={80} thickness={6} sx={{ color: '#ffb300' }} />
                                        </Box>
                                        {/* Green top circle (paid) */}
                                        <Box sx={{ position: 'absolute', left: 0, top: 0 }}>
                                          <CircularProgress variant="determinate" value={percentPaid} size={80} thickness={6} sx={{ color: '#388e3c' }} />
                                        </Box>
                                        {/* Center text */}
                                        <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                                          <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '11px' }}>{percentPaid}%</Typography>
                                          <Typography variant="caption" sx={{ fontSize: '9px' }}>Paid</Typography>
                                        </Box>
                                      </>
                                    );
                                  })()}
                                </Box>
                                <Box sx={{ flex: 1 }}>
                                  <Typography variant="caption" sx={{ mb: 1 }}>Yearly Breakdown</Typography>
                                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                    {Object.entries(yearlyTotals).map(([year, total], i) => {
                                      const progress = yearlyPaymentProgress[year];
                                      if (!progress) return null;
                                      const percentPaid = progress.totalNet > 0 ? Math.round((progress.paidFull / progress.totalNet) * 100) : 0;
                                      return (
                                        <Box key={year} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                                            <Box sx={{ width: 6, height: 6, backgroundColor: '#388e3c', borderRadius: '50%' }} />
                                            <Box sx={{ width: 6, height: 6, backgroundColor: '#ffb300', borderRadius: '50%' }} />
                                            <Box sx={{ width: 6, height: 6, backgroundColor: '#d32f2f', borderRadius: '50%' }} />
                                          </Box>
                                          <Typography variant="caption" sx={{ flex: 1, fontSize: '11px' }}>{year}</Typography>
                                          <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '11px' }}>Rs. {total.toLocaleString()}</Typography>
                                        </Box>
                                      );
                                    })}
                                  </Box>
                                </Box>
                              </>
                            ) : (
                              <Box sx={{ textAlign: 'center', width: '100%' }}>
                                <Typography variant="caption" color="textSecondary">No yearly data</Typography>
                              </Box>
                            )}
                          </Box>
                        </Grid>
                      </Grid>
                    </Paper>
                  </Box>
                </>
              )}
            </Paper>
          </Grid>
        </Grid>
      )}


    </Box>
  );
};

export default SellerClientDetail;
