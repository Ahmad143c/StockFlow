import React, { useEffect, useState, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { fetchProducts } from '../redux/productsSlice';
import API from '../api/api';
import { useDarkMode } from '../context/DarkModeContext';
import {
  Box, Paper, Typography, TextField, Button, MenuItem, FormControl, InputLabel, Select, Divider, List, ListItem, ListItemText, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Autocomplete, Chip, Grid, InputAdornment, Tooltip, Checkbox, FormControlLabel, useTheme, useMediaQuery
} from '@mui/material';

import EditIcon from '@mui/icons-material/Edit';
import PrintIcon from '@mui/icons-material/Print';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import EmailIcon from '@mui/icons-material/Email';
import DeleteIcon from '@mui/icons-material/Delete';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { generateInvoiceHTML } from '../utils/invoiceUtils';

const SellerSaleEntry = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [products, setProducts] = useState([]);
  const [items, setItems] = useState([
    { productId: '', productName: '', SKU: '', brand: '', quantity: 0, perPiecePrice: 0, discount: 0, subtotal: 0 }
  ]);

  const [customerName, setCustomerName] = useState('');
  const [customerContact, setCustomerContact] = useState('');
  const [customerEmail, setCustomerEmail] = useState(''); // New state for customer email
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [cashierName, setCashierName] = useState('');
  const [recentSales, setRecentSales] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [cashiers, setCashiers] = useState([]);
  const [editSale, setEditSale] = useState(null);
  const [editForm, setEditForm] = useState({
    cashierName: '',
    customerName: '',
    customerContact: '',
    paymentMethod: 'Cash',
    paymentStatus: 'Unpaid',
    paidAmount: 0,
    customerEmail: '',
    dueDate: '',
    discountAmount: 0,
    items: []
  });
  const [editPaymentProofFile, setEditPaymentProofFile] = useState(null);
  const [confirmDeleteIndex, setConfirmDeleteIndex] = useState(null);
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [refundItems, setRefundItems] = useState([]);
  const [refundReason, setRefundReason] = useState('');
  const [warrantyModalOpen, setWarrantyModalOpen] = useState(false);
  const [warrantyItems, setWarrantyItems] = useState([]);
  const [warrantyReason, setWarrantyReason] = useState('');
  const [receivedAmount, setReceivedAmount] = useState(0);
  const [dueDate, setDueDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paymentStatus, setPaymentStatus] = useState('Unpaid');
  const [paidAmount, setPaidAmount] = useState(0);
  const [changeAmount, setChangeAmount] = useState(0);
  const [paymentProofFile, setPaymentProofFile] = useState(null);
  const [paymentProofUrl, setPaymentProofUrl] = useState('');
  const [printPreviewOpen, setPrintPreviewOpen] = useState(false);
  const [printPreviewHtml, setPrintPreviewHtml] = useState('');
  const [discountAmount, setDiscountAmount] = useState(0);
  const { darkMode } = useDarkMode();
  const previewRef = useRef(null);

  const dispatch = useDispatch();

  // Helper to notify other windows/tabs and in-page listeners about a sale
  const notifySale = (notif) => {
    if (!notif) return;
    try {
      // history
      try {
        const raw = localStorage.getItem('sales:history');
        const hist = raw ? JSON.parse(raw) : [];
        hist.unshift(notif);
        localStorage.setItem('sales:history', JSON.stringify(hist.slice(0, 50)));
      } catch (e) { try { localStorage.setItem('sales:history', JSON.stringify([notif])); } catch (e) { } }

      // latest pointer
      localStorage.setItem('sales:latest', JSON.stringify(notif));

      // BroadcastChannel for same-origin quick delivery
      if (window.BroadcastChannel) {
        try { const ch = new BroadcastChannel('sales'); ch.postMessage({ notif }); ch.close(); } catch (e) { }
      }

      // Fire both a specialized event and the general change event
      try { window.dispatchEvent(new CustomEvent('sales:latest', { detail: notif })); } catch (e) { }
      try { window.dispatchEvent(new CustomEvent('sales:changed', { detail: { id: notif.id } })); } catch (e) { }

      // storage flag for other tabs
      try { localStorage.setItem('sales:changed', String(Date.now())); } catch (e) { }
    } catch (e) { }
  };

  // Load products from API
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await API.get('/products', { headers: { Authorization: `Bearer ${token}` } });
        setProducts(res.data);
      } catch (e) {
        setProducts([]);
      }
    };
    const fetchSales = async () => {
      try {
        const token = localStorage.getItem('token');
        const payload = JSON.parse(atob(token.split('.')[1]));
        const res = await API.get(`/sales?sellerId=${payload.id}&limit=10`, { headers: { Authorization: `Bearer ${token}` } });
        setRecentSales(Array.isArray(res.data) ? (res.data.filter(s => (Number(s.totalQuantity) || Number(s.netAmount) || 0) > 0).slice(0, 10)) : []);
      } catch {
        setRecentSales([]);
      }
    };
    const fetchCustomers = async () => {
      try {
        const token = localStorage.getItem('token');
        const payload = JSON.parse(atob(token.split('.')[1]));
        // fetch recent sales (up to 200) and derive unique customers
        const res = await API.get(`/sales?sellerId=${payload.id}&limit=200`, { headers: { Authorization: `Bearer ${token}` } });
        const sales = Array.isArray(res.data) ? res.data : [];
        const map = new Map();
        sales.forEach(s => {
          const name = (s.customerName || '').trim();
          if (!name) return;
          const key = name.toLowerCase();
          if (!map.has(key)) map.set(key, { name, contact: s.customerContact || '', email: s.customerEmail || '' });
        });
        setCustomers(Array.from(map.values()));
      } catch (e) {
        setCustomers([]);
      }
    };
    const fetchCashiers = async () => {
      try {
        const token = localStorage.getItem('token');
        const payload = JSON.parse(atob(token.split('.')[1]));
        // fetch recent sales (up to 200) and derive unique cashiers
        const res = await API.get(`/sales?sellerId=${payload.id}&limit=200`, { headers: { Authorization: `Bearer ${token}` } });
        const sales = Array.isArray(res.data) ? res.data : [];
        const setC = new Set();
        sales.forEach(s => {
          const name = (s.cashierName || '').trim();
          if (name) setC.add(name);
        });
        setCashiers(Array.from(setC).sort());
      } catch (e) {
        setCashiers([]);
      }
    };
    fetchProducts();
    fetchSales();
    fetchCustomers();
    fetchCashiers();
    const onChanged = () => { fetchSales(); fetchCustomers(); fetchCashiers(); };
    window.addEventListener('sales:changed', onChanged);
    return () => window.removeEventListener('sales:changed', onChanged);
  }, []);

  // derive distinct brands for brand filter
  const brands = React.useMemo(() => {
    const setB = new Set();
    products.forEach(p => { if (p?.brand) setB.add(p.brand); });
    return Array.from(setB).sort();
  }, [products]);

  const sortedProductsByBrandFor = React.useCallback((brand, list) => {
    if (!brand) return list;
    const matches = [];
    const others = [];
    list.forEach(p => {
      if (p?.brand === brand) matches.push(p);
      else others.push(p);
    });
    return [...matches, ...others];
  }, []);

  // Handle item change (product, qty, price, disc)
  const findProductBySKU = (sku) => {
    if (!sku || !products.length) return null;
    const normalized = String(sku).trim().toLowerCase();
    return products.find(p => p?.SKU && String(p.SKU).trim().toLowerCase() === normalized);
  };

  const handleItemChange = (idx, name, value) => {
    const newItems = [...items];
    if (name === 'brand') {
      // selecting a brand for this line: clear product selection
      newItems[idx] = {
        ...newItems[idx],
        brand: value,
        productId: '',
        productName: '',
        SKU: '',
        perPiecePrice: 0,
        quantity: 0,
        discount: 0,
        subtotal: 0
      };
    } else if (name === 'productId') {
      const prod = products.find(p => p._id === value);
      if (!prod) {
        // If product not found (e.g., when cleared), reset to empty state
        newItems[idx] = {
          ...newItems[idx],
          productId: '',
          productName: '',
          SKU: '',
          perPiecePrice: 0,
          quantity: 0,
          discount: 0,
          subtotal: 0
        };
      } else {
        newItems[idx] = {
          ...newItems[idx],
          productId: prod._id,
          productName: prod.name,
          brand: prod.brand || newItems[idx].brand || '',
          SKU: prod.SKU,
          perPiecePrice: 0, // Seller must add price manually
          quantity: 0,
          discount: 0,
          subtotal: 0
        };
      }
    } else if (name === 'SKU') {
      const enteredSKU = String(value || '').trim();
      const prod = findProductBySKU(enteredSKU);
      if (prod) {
        newItems[idx] = {
          ...newItems[idx],
          productId: prod._id,
          productName: prod.name,
          SKU: prod.SKU,
          brand: prod.brand || newItems[idx].brand || '',
          perPiecePrice: Number(prod.sellingPerPiece) || newItems[idx].perPiecePrice || 0,
          quantity: Number(newItems[idx].quantity) || 1,
          discount: Number(newItems[idx].discount) || 0,
          subtotal: ((Number(prod.sellingPerPiece) || 0) * (Number(newItems[idx].quantity) || 1)) - (Number(newItems[idx].discount) || 0)
        };
      } else {
        newItems[idx] = {
          ...newItems[idx],
          SKU: enteredSKU
        };
      }
    } else {
      if (name === 'quantity') {
        // Prevent selling more than available stock in pieces
        const prod = products.find(p => p._id === newItems[idx].productId);
        const piecesPerCarton = prod ? (Number(prod.piecesPerCarton) || 0) : 0;
        const derivedTotal = prod ? ((Number(prod.cartonQuantity) || 0) * piecesPerCarton) + (Number(prod.losePieces) || 0) : 0;
        const availablePieces = prod ? (Number(prod.totalPieces) || derivedTotal) : 0;
        const safeQty = Math.max(0, Math.min(Number(value) || 0, availablePieces));
        newItems[idx][name] = safeQty;
      } else if (name === 'perPiecePrice') {
        newItems[idx][name] = Math.max(0, Number(value) || 0);
      } else {
        newItems[idx][name] = value;
      }
      const price = Number(newItems[idx].perPiecePrice) || 0;
      const qty = Number(newItems[idx].quantity) || 0;
      const disc = Number(newItems[idx].discount) || 0;
      newItems[idx].subtotal = price * qty - disc;
    }
    setItems(newItems);
  };

  const addItem = () => {
    setItems([...items, { productId: '', productName: '', SKU: '', brand: '', quantity: 0, perPiecePrice: 0, discount: 0, subtotal: 0 }]);
  };

  const removeItem = idx => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== idx));
  };

  const totalAmount = items.reduce((sum, i) => sum + ((Number(i.perPiecePrice) * Number(i.quantity)) || 0), 0);
  const discountTotal = items.reduce((sum, i) => sum + (Number(i.discount) || 0), 0);
  const netAmount = Math.max(0, totalAmount - discountTotal - Number(discountAmount || 0));
  const totalQuantity = items.reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);

  useEffect(() => {
    const effectivePaid = paymentStatus === 'Partial Paid' ? (Number(receivedAmount) || 0) : (Number(paidAmount) || 0);
    setChangeAmount(Math.max(0, effectivePaid - netAmount));
  }, [paidAmount, receivedAmount, paymentStatus, netAmount]);

  // Automatically update paymentStatus based on amounts entered
  useEffect(() => {
    if (netAmount <= 0) return;
    let newStatus = paymentStatus;
    const paidVal = paymentStatus === 'Partial Paid' ? (Number(receivedAmount) || 0) : (Number(paidAmount) || 0);

    if (paymentStatus === 'Partial Paid') {
      if (paidVal >= netAmount) {
        newStatus = 'Paid';
      }
    } else if (paymentStatus === 'Unpaid') {
      if (paidVal >= netAmount) {
        newStatus = 'Paid';
      }
    } else if (paymentStatus === 'Paid') {
      if (paidVal < netAmount) {
        newStatus = paidVal > 0 ? 'Partial Paid' : 'Unpaid';
      }
    }

    if (newStatus !== paymentStatus) {
      setPaymentStatus(newStatus);
      if (newStatus === 'Paid') {
        // ensure paidAmount represents the full
        if (paymentStatus === 'Partial Paid') {
          setPaidAmount(paidVal);
        }
      }
    }
  }, [paidAmount, receivedAmount, paymentStatus, netAmount]);

  const uploadPaymentProof = async (fileToUpload = null) => {
    const file = fileToUpload || paymentProofFile;
    if (!file) return '';
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('image', file);
      const res = await API.post('/upload', formData, {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
      });
      return res.data.url;
    } catch {
      return '';
    }
  };

  // Helper function to check if any items have discounts
  const hasDiscounts = (itemsArray) => {
    return itemsArray && itemsArray.length > 0 && itemsArray.some(i => Number(i.discount) > 0);
  };



  const saveSale = async () => {
    setError(''); setSuccess(''); setSubmitting(true);
    const token = localStorage.getItem('token');
    try {
      // If payment proof file is selected, upload it; otherwise use existing URL
      let proofUrl = '';
      if (paymentMethod !== 'Cash') {
        if (paymentProofFile) {
          proofUrl = await uploadPaymentProof();
        } else if (paymentProofUrl && !paymentProofUrl.startsWith('data:')) {
          // Use existing URL if it's not a data URL (preview)
          proofUrl = paymentProofUrl;
        }
      }
      const payload = JSON.parse(atob(token.split('.')[1]));
      const effectivePaid = paymentStatus === 'Partial Paid' ? (Number(receivedAmount) || 0) : (Number(paidAmount) || 0);
      const res = await API.post('/sales', {
        items,
        sellerId: payload.id,
        sellerName: payload.username,
        cashierName,
        customerName,
        customerContact,
        customerEmail,
        discountAmount: Number(discountAmount) || 0,
        paidAmount: effectivePaid,
        dueDate: dueDate || '',
        paymentMethod,
        paymentStatus,
        paymentProofUrl: proofUrl,
        cashAmount: paymentMethod === 'Cash' ? effectivePaid : 0,
        changeAmount: Number(changeAmount) || 0
      }, { headers: { Authorization: `Bearer ${token}` } });
      const saved = res.data;
      setSuccess('Sale recorded!');

      // Reset form immediately
      window.dispatchEvent(new CustomEvent('products:changed'));
      setItems([{ productId: '', productName: '', SKU: '', brand: '', quantity: 0, perPiecePrice: 0, discount: 0, subtotal: 0 }]);
      setCustomerName(''); setCustomerContact(''); setCustomerEmail(''); setCashierName('');
      setPaymentMethod('Cash'); setPaymentStatus('Unpaid'); setPaidAmount(0); setChangeAmount(0); setPaymentProofFile(null); setPaymentProofUrl('');
      setReceivedAmount(0); setDueDate(''); setDiscountAmount(0);

      // Run background operations without awaiting them
      // 1. Refresh products
      dispatch(fetchProducts()).catch(e => console.error('Failed to refresh products:', e));

      // 2. Notify other tabs and in-page listeners
      try {
        const notif = { id: saved._id, sellerName: payload.username, cashierName: cashierName || payload.username, invoiceNumber: saved._id?.substr(-6), createdAt: saved.createdAt || Date.now(), ts: Date.now(), type: 'created', totalItems: Number(totalQuantity) || 0 };
        try { notifySale(notif); } catch (e) { /* continue */ }
        try { window.dispatchEvent(new CustomEvent('sales:latest', { detail: notif })); } catch (e) { }
      } catch (e) { }

      // 3. Dispatch custom events
      window.dispatchEvent(new CustomEvent('sales:changed', { detail: { id: saved._id } }));
      try { localStorage.setItem('sales:changed', String(Date.now())); } catch (e) { }

      // 4. Refresh recent sales in background (non-blocking)
      (async () => {
        try {
          const recentPayload = JSON.parse(atob(token.split('.')[1]));
          const recentRes = await API.get(`/sales?sellerId=${recentPayload.id}&limit=10`, { headers: { Authorization: `Bearer ${token}` } });
          setRecentSales(Array.isArray(recentRes.data) ? recentRes.data.filter(s => (Number(s.totalQuantity) || Number(s.netAmount) || 0) > 0).slice(0, 10) : []);
        } catch (e) { console.error('Failed to refresh recent sales:', e); }
      })();

      return saved;
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to record sale');
      return null;
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async e => {
    e.preventDefault();
    const saved = await saveSale();
    if (saved) {
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    }
  };

  const handleSaveAndPrint = async () => {
    const saved = await saveSale();
    if (!saved) return;
    const invoice = saved;
    const printContent = generateInvoiceHTML(invoice, products);

    const w = window.open('', '_blank');
    if (!w || !w.document) {
      // Popup blocked — open in-app print preview
      setPrintPreviewHtml(printContent);

      setPrintPreviewOpen(true);
      // refresh the page after 5 seconds
      setTimeout(() => {
        window.location.reload();
      }, 5000);
      return;
    }
    // output generated HTML directly (it already includes its own styles)
    w.document.write(printContent);
    w.document.close();
    setTimeout(() => {
      w.print();
      // refresh the current page after 5 seconds
      setTimeout(() => {
        window.location.reload();
      }, 5000);
    }, 250);
  };

  const openEdit = sale => {
    setEditSale(sale);
    // normalize items and populate brand from current products list when possible
    const mappedItems = sale.items ? sale.items.map(item => {
      const prod = products.find(p => p._id === (item.productId || item._id)) || null;
      return {
        productId: item.productId || item._id || '',
        productName: item.productName || item.name || '',
        SKU: item.SKU || '',
        brand: prod?.brand || item.brand || '',
        quantity: Number(item.quantity) || 0,
        perPiecePrice: Number(item.perPiecePrice) || 0,
        discount: Number(item.discount) || 0,
        subtotal: Number(item.subtotal) || 0
      };
    }) : [];

    setEditForm({
      cashierName: sale.cashierName || '',
      customerName: sale.customerName || '',
      customerContact: sale.customerContact || '',
      customerEmail: sale.customerEmail || '',
      dueDate: sale.dueDate ? new Date(sale.dueDate).toISOString().split('T')[0] : '',
      paymentMethod: sale.paymentMethod || 'Cash',
      paymentStatus: sale.paymentStatus || 'Unpaid',
      paidAmount: sale.paidAmount ?? 0,
      discountAmount: sale.discountAmount ?? 0,
      items: mappedItems
    });
    setEditPaymentProofFile(null);
  };


  const handleEditItemChange = (idx, name, value) => {
    const newItems = [...editForm.items];
    if (name === 'brand') {
      newItems[idx] = {
        ...newItems[idx],
        brand: value,
        productId: '',
        productName: '',
        SKU: '',
        perPiecePrice: 0,
        quantity: 0,
        discount: 0,
        subtotal: 0
      };
    } else if (name === 'productId') {
      const prod = products.find(p => p._id === value);
      if (!prod) {
        newItems[idx] = {
          ...newItems[idx],
          productId: '',
          productName: '',
          SKU: '',
          perPiecePrice: 0,
          quantity: 0,
          discount: 0,
          subtotal: 0
        };
      } else {
        newItems[idx] = {
          ...newItems[idx],
          productId: prod._id,
          productName: prod.name,
          brand: prod.brand || newItems[idx].brand || '',
          SKU: prod.SKU,
          perPiecePrice: newItems[idx].perPiecePrice || 0,
          quantity: newItems[idx].quantity || 0,
          discount: newItems[idx].discount || 0,
          subtotal: (newItems[idx].perPiecePrice || 0) * (newItems[idx].quantity || 0) - (newItems[idx].discount || 0)
        };
      }
    } else if (name === 'SKU') {
      const enteredSKU = String(value || '').trim();
      const prod = findProductBySKU(enteredSKU);
      if (prod) {
        newItems[idx] = {
          ...newItems[idx],
          productId: prod._id,
          productName: prod.name,
          SKU: prod.SKU,
          brand: prod.brand || newItems[idx].brand || '',
          perPiecePrice: Number(prod.sellingPerPiece) || newItems[idx].perPiecePrice || 0,
          quantity: Number(newItems[idx].quantity) || 1,
          discount: Number(newItems[idx].discount) || 0,
          subtotal: ((Number(prod.sellingPerPiece) || 0) * (Number(newItems[idx].quantity) || 1)) - (Number(newItems[idx].discount) || 0)
        };
      } else {
        newItems[idx] = {
          ...newItems[idx],
          SKU: enteredSKU
        };
      }
    } else {
      if (name === 'quantity') {
        const prod = products.find(p => p._id === newItems[idx].productId);
        const piecesPerCarton = prod ? (Number(prod.piecesPerCarton) || 0) : 0;
        const derivedTotal = prod ? ((Number(prod.cartonQuantity) || 0) * piecesPerCarton) + (Number(prod.losePieces) || 0) : 0;
        const availablePieces = prod ? (Number(prod.totalPieces) || derivedTotal) : 0;
        const safeQty = Math.max(0, Math.min(Number(value) || 0, availablePieces));
        newItems[idx][name] = safeQty;
      } else if (name === 'perPiecePrice') {
        newItems[idx][name] = Math.max(0, Number(value) || 0);
      } else {
        newItems[idx][name] = value;
      }
      const price = Number(newItems[idx].perPiecePrice) || 0;
      const qty = Number(newItems[idx].quantity) || 0;
      const disc = Number(newItems[idx].discount) || 0;
      newItems[idx].subtotal = price * qty - disc;
    }
    setEditForm({ ...editForm, items: newItems });
  };

  const addEditItem = () => {
    setEditForm({
      ...editForm,
      items: [...editForm.items, { productId: '', productName: '', SKU: '', brand: '', quantity: 0, perPiecePrice: 0, discount: 0, subtotal: 0 }]
    });
  };

  const removeEditItem = idx => {
    if (editForm.items.length === 1) return;
    setEditForm({ ...editForm, items: editForm.items.filter((_, i) => i !== idx) });
  };

  const saveEdit = async () => {
    if (!editSale) return;
    setError(''); setSuccess('');
    try {
      const token = localStorage.getItem('token');
      // If new payment proof file is selected, upload it; otherwise keep existing URL
      let proofUrl = editSale.paymentProofUrl || '';
      if (editForm.paymentMethod !== 'Cash' && editPaymentProofFile) {
        proofUrl = await uploadPaymentProof(editPaymentProofFile);
      } else if (editForm.paymentMethod === 'Cash') {
        proofUrl = ''; // Clear proof URL if changing to Cash
      }
      const itemDiscounts = editForm.items.reduce((sum, i) => sum + (Number(i.discount) || 0), 0);
      const globalDiscount = Number(editForm.discountAmount || 0);
      const totalDiscountAmount = itemDiscounts + globalDiscount;
      const editNetAmount = editForm.items.reduce((sum, i) => sum + ((Number(i.perPiecePrice) * Number(i.quantity)) - (Number(i.discount) || 0)), 0) - globalDiscount;
      const editChangeAmount = Math.max(0, (Number(editForm.paidAmount) || 0) - editNetAmount);
      if (!Array.isArray(editForm.items) || editForm.items.length === 0) { setError('Add at least one item'); return; }
      if (editForm.items.some(it => !(it.productId || it.SKU))) { setError('Please select a product for each item'); return; }
      if (!token) { setError('Not authenticated'); return; }
      // Stock adjustments for edited items are handled on the server when updating the sale.

      await API.put(`/sales/${editSale._id}`, {
        ...editForm,
        discountAmount: totalDiscountAmount,
        netAmount: editNetAmount,
        cashAmount: editForm.paymentMethod === 'Cash' ? Number(editForm.paidAmount) || 0 : 0,
        changeAmount: editChangeAmount,
        paymentProofUrl: proofUrl,
        totalQuantity: editForm.items.reduce((sum, i) => sum + (Number(i.quantity) || 0), 0),
        edited: true
      }, { headers: { Authorization: `Bearer ${token}` } });
      setEditSale(null);
      setEditForm({ cashierName: '', customerName: '', customerContact: '', paymentMethod: 'Cash', paymentStatus: 'Unpaid', paidAmount: 0, discountAmount: 0, items: [] });
      setEditPaymentProofFile(null);
      // notify other windows and the admin header about the update
      try {
        const totalEdited = (editForm.items || []).reduce((s, i) => s + (Number(i.quantity) || 0), 0);
        const notif = { id: editSale._id, sellerName: editSale.sellerName || '', cashierName: editForm.cashierName || editSale.sellerName || '', invoiceNumber: editSale._id?.substr(-6), updated: true, ts: Date.now(), type: 'updated', totalItems: Number(totalEdited) || 0 };
        try { notifySale(notif); } catch (e) { /* continue */ }
      } catch (e) { }
      window.dispatchEvent(new CustomEvent('sales:changed', { detail: { id: editSale._id } }));
      try { localStorage.setItem('sales:changed', String(Date.now())); } catch (e) { }
      dispatch(fetchProducts());
      setSuccess('Sale updated successfully!');
      // Refresh recent sales with proper filtering
      const payload = JSON.parse(atob(token.split('.')[1]));
      const res = await API.get(`/sales?sellerId=${payload.id}&limit=10`, { headers: { Authorization: `Bearer ${token}` } });
      setRecentSales(Array.isArray(res.data) ? res.data.filter(s => (Number(s.totalQuantity) || Number(s.netAmount) || 0) > 0).slice(0, 10) : []);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to update sale');
    }
  };

  // Live stock preview for first selected item
  const first = items[0];
  const selectedProduct = first?.productId ? products.find(p => p._id === first.productId) : null;
  const piecesPerCarton = selectedProduct ? (Number(selectedProduct.piecesPerCarton) || 0) : 0;
  const cartonQuantity = selectedProduct ? (Number(selectedProduct.cartonQuantity) || 0) : 0;
  const losePieces = selectedProduct ? (Number(selectedProduct.losePieces) || 0) : 0;
  const derivedTotalPieces = selectedProduct ? ((cartonQuantity * piecesPerCarton) + losePieces) : 0;
  const totalPieces = selectedProduct ? (Number(selectedProduct.totalPieces) || derivedTotalPieces) : 0;
  const qtyReq = Number(first?.quantity) || 0;
  const remainingPieces = Math.max(0, totalPieces - qtyReq);

  // Open edit from external link like /seller/sale-entry?edit=<saleId>
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const editId = params.get('edit');
    if (!editId) return;
    (async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        const res = await API.get(`/sales/${editId}`, { headers: { Authorization: `Bearer ${token}` } });
        if (res?.data) {
          openEdit(res.data);
          // remove edit param from URL so it doesn't re-open on reload
          try { window.history.replaceState({}, document.title, window.location.pathname); } catch (e) { }
        }
      } catch (e) {
        // ignore
      }
    })();
  }, []);

  // auto-adjust payment status in edit form based on paidAmount and net value
  useEffect(() => {
    const editNetAmount = editForm.items.reduce((sum, i) => sum + ((Number(i.perPiecePrice) * Number(i.quantity)) - (Number(i.discount) || 0)), 0);
    const paidVal = Number(editForm.paidAmount || 0);
    let newStatus = editForm.paymentStatus;
    if (editNetAmount > 0) {
      if (paidVal >= editNetAmount) {
        newStatus = 'Paid';
      } else if (paidVal > 0) {
        newStatus = 'Partial Paid';
      } else {
        newStatus = 'Unpaid';
      }
    }
    if (newStatus !== editForm.paymentStatus) {
      setEditForm(prev => ({ ...prev, paymentStatus: newStatus }));
    }
  }, [editForm.paidAmount, editForm.items, editForm.paymentStatus]);
  const handleResendEmail = async (sale) => {
    try {
      const token = localStorage.getItem('token');
      const emailRes = await API.post(`/sales/${sale._id}/resend-email`, {}, { headers: { Authorization: `Bearer ${token}` } });
      const returnedSale = emailRes.data.sale || {};
      const paid = returnedSale.paymentMethod === 'Cash' ? (returnedSale.cashAmount || 0) : (returnedSale.paidAmount || 0);
      const change = returnedSale.changeAmount || 0;
      setSuccess(`Email resend attempted (Paid: Rs. ${paid.toLocaleString()}, Change: Rs. ${change.toLocaleString()})`);
      // refresh recent sales
      const payload = JSON.parse(atob(token.split('.')[1]));
      const res = await API.get(`/sales?sellerId=${payload.id}&limit=10`, { headers: { Authorization: `Bearer ${token}` } });
      setRecentSales(Array.isArray(res.data) ? res.data.slice(0, 10) : []);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to resend email');
    }
  };

  return (
    <Box sx={{ mx: 'auto', px: { md: 2 }, mb: 4 }}>
      <Paper elevation={8} sx={{ p: 2, borderRadius: 3, background: darkMode ? 'linear-gradient(to bottom, #1e1e1e 0%, #121212 100%)' : 'linear-gradient(to bottom, #f8f9fa 0%, #ffffff 100%)' }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', mb: 3, pb: 2, borderBottom: `2px solid ${darkMode ? '#2a2a2a' : '#e0e0e0'}` }}>
          <Box>
            <Typography variant="h4" color="primary" sx={{ fontWeight: 700, mb: 0.5 }}>Point of Sale</Typography>
            <Typography variant="body2" color="text.secondary">Stock updates instantly after saving. Recent sales show below.</Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ textAlign: 'right', p: 2, bgcolor: 'primary.main', borderRadius: 2, color: 'white' }}>
              <Typography variant="overline" sx={{ display: 'block', opacity: 0.9 }}>Total Amount</Typography>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>Rs. {netAmount.toLocaleString()}</Typography>
            </Box>
          </Box>
        </Box>

        {error && (
          <Box sx={{ mb: 2, p: 2, bgcolor: darkMode ? '#3d2423' : '#ffebee', borderRadius: 1, border: `1px solid ${darkMode ? '#d32f2f' : '#ef5350'}` }}>
            <Typography color="error">{error}</Typography>
          </Box>
        )}
        {success && (
          <Box sx={{ mb: 2, p: 2, bgcolor: darkMode ? '#1b5e20' : '#e8f5e9', borderRadius: 1, border: `1px solid ${darkMode ? '#388e3c' : '#4caf50'}` }}>
            <Typography color="success.main">{success}</Typography>
          </Box>
        )}

        <form onSubmit={handleSubmit}>
          <Grid container>
            {/* Items Section */}
            <Grid item xs={12} sx={{ display: 'flex' }}>
              <Paper elevation={3} sx={{ p: 2, width: '100%', display: 'flex', flexDirection: 'column' }}>
                <Typography variant="h6" sx={{ mb: 3, color: 'primary.main', fontWeight: 600 }}>
                  Sale Items
                </Typography>

                {items.map((item, idx) => {
                  const prod = item.productId ? products.find(p => p._id === item.productId) : null;
                  const ppc = prod ? (Number(prod.piecesPerCarton) || 0) : 0;
                  const derived = prod ? ((Number(prod.cartonQuantity) || 0) * ppc) + (Number(prod.losePieces) || 0) : 0;
                  const totalPcs = prod ? (Number(prod.totalPieces) || derived) : 0;
                  const qty = Number(item.quantity) || 0;
                  const remaining = Math.max(0, totalPcs - qty);
                  const itemSubtotal = (Number(item.perPiecePrice) * Number(item.quantity)) - Number(item.discount || 0);
                  const rawWarranty = prod ? prod.warrantyMonths : null;
                  const warrantyMonths = rawWarranty == null ? 0 : Number(rawWarranty);
                  let warrantyExpiry = null;
                  if (warrantyMonths > 0) {
                    const d = new Date();
                    d.setMonth(d.getMonth() + warrantyMonths);
                    warrantyExpiry = d;
                  }
                  return (
                    <Box key={idx} sx={{ mb: 3, p: 1, border: `1px solid ${darkMode ? '#2a2a2a' : '#e0e0e0'}`, borderRadius: 2, bgcolor: darkMode ? '#1e1e1e' : '#ffffff' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                        <Chip label={`Item ${idx + 1}`} size="small" color="primary" />
                        {itemSubtotal > 0 && (
                          <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'primary.main' }}>
                            Subtotal: Rs. {itemSubtotal.toLocaleString()}
                          </Typography>
                        )}
                      </Box>
                      
                      <Grid container spacing={2}>
                        <Grid item xs={12} sm={6} md={2}>
                          <TextField
                            label="SKU / Barcode"
                            value={item.SKU || ''}
                            onChange={e => handleItemChange(idx, 'SKU', e.target.value)}
                            onBlur={e => handleItemChange(idx, 'SKU', e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleItemChange(idx, 'SKU', e.target.value);
                              }
                            }}
                            helperText="Enter SKU or scan barcode to auto-populate product"
                            fullWidth
                          />
                        </Grid>
                        <Grid item xs={12} sm={6} md={2}>
                          <FormControl fullWidth>
                            <InputLabel>Brand</InputLabel>
                            <Select
                              value={item.brand || ''}
                              label="Brand"
                              onChange={e => handleItemChange(idx, 'brand', e.target.value)}
                            >
                              <MenuItem value="">All Brands</MenuItem>
                              {brands.map(b => <MenuItem key={b} value={b}>{b}</MenuItem>)}
                            </Select>
                          </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={6} md={2}>
                          <Autocomplete
                            options={sortedProductsByBrandFor(item.brand, products)}
                            getOptionLabel={(option) => option?.name ? `${option.name} (${option.SKU})` : ''}
                            value={products.find(p => p._id === item.productId) || null}
                            onChange={(_, val) => handleItemChange(idx, 'productId', val?._id || '')}
                            renderInput={(params) => <TextField {...params} label="Search Product" placeholder="Type name or SKU" fullWidth />}
                            fullWidth
                          />
                        </Grid>
                        <Grid item xs={12} sm={6} md={2}>
                          <TextField
                            label="Quantity"
                            type="number"
                            value={item.quantity || ''}
                            onChange={e =>
                              handleItemChange(
                                idx,
                                'quantity',
                                Math.max(0, Number(e.target.value))
                              )
                            }
                            onWheel={(e) => e.target.blur()}   // 👈 stops scroll from changing value
                            fullWidth
                            required
                            sx={{
                              '& input[type=number]': {
                                '-moz-appearance': 'textfield',
                                '&::-webkit-outer-spin-button, &::-webkit-inner-spin-button': {
                                  '-webkit-appearance': 'none',
                                  margin: 0,
                                },
                              },
                            }}
                          />

                        </Grid>
                        <Grid item xs={12} sm={6} md={2}>
                          {(() => {
                            const suggested = prod ? (Number(prod.sellingPerPiece) || 0) : 0;
                            const priceVal = Number(item.perPiecePrice) || 0;
                            const isBelow = prod && priceVal > 0 && suggested > 0 && priceVal < suggested;
                            return (
                              <TextField
                                label="Price per Piece"
                                type="number"
                                value={item.perPiecePrice || ''}
                                onChange={e =>
                                  handleItemChange(idx, 'perPiecePrice', e.target.value)
                                }
                                onWheel={(e) => e.target.blur()}   // 👈 key line
                                fullWidth
                                required
                                error={isBelow}
                                helperText={
                                  isBelow ? `Below suggested selling price Rs. ${suggested}` : ''
                                }
                                InputProps={{
                                  inputProps: {
                                    onWheel: (e) => e.target.blur(), // 👈 safest place in MUI
                                    min: 0,
                                  },
                                  endAdornment: isBelow ? (
                                    <InputAdornment position="end">
                                      <Tooltip
                                        title={`Below suggested selling price Rs. ${suggested}`}
                                        arrow
                                      >
                                        <WarningAmberIcon color="error" />
                                      </Tooltip>
                                    </InputAdornment>
                                  ) : null,
                                }}
                                sx={{
                                  '& input[type=number]': {
                                    '-moz-appearance': 'textfield',
                                    '&::-webkit-outer-spin-button, &::-webkit-inner-spin-button': {
                                      '-webkit-appearance': 'none',
                                      margin: 0,
                                    },
                                  },
                                }}
                              />
                            );
                          })()}
                        </Grid>
                        <Grid item xs={12} sm={6} md={1}>
                          <TextField
                            label="Discount"
                            type="number"
                            value={item.discount || ''}
                            onChange={e =>
                              handleItemChange(
                                idx,
                                'discount',
                                Math.max(0, Number(e.target.value))
                              )
                            }
                            fullWidth
                            InputProps={{
                              inputProps: {
                                onWheel: (e) => e.target.blur(), // 👈 stops scroll changing value
                                min: 0,
                              },
                            }}
                            sx={{
                              '& input[type=number]': {
                                '-moz-appearance': 'textfield',
                                '&::-webkit-outer-spin-button, &::-webkit-inner-spin-button': {
                                  '-webkit-appearance': 'none',
                                  margin: 0,
                                },
                              },
                            }}
                          />

                        </Grid>
                        <Grid item xs={12} sm={6} md={1}>
                          <Button
                            color="error"
                            variant="outlined"
                            onClick={() => removeItem(idx)}
                            disabled={items.length === 1}
                            sx={{ minWidth: 0, width: '100%', height: '56px' }}
                          >
                            ×
                          </Button>
                        </Grid>
                        {prod && (
                          <Grid item xs={12} >
                            <Box sx={{ p: 1.5, mt: 1, ml: 1.5, bgcolor: darkMode ? '#1a3a52' : '#e3f2fd', borderRadius: 1 }}>
                              <Typography variant="body2" sx={{ fontWeight: 500, color: 'text.primary' }}>
                                📦 Stock: Total Pieces {totalPcs} (Cart: {ppc > 0 ? Math.floor(totalPcs / ppc) : 0}, Lose: {ppc > 0 ? (totalPcs % ppc) : totalPcs})
                                {qty > 0 && ` → After Sale: Remaining ${remaining} (Cart: ${ppc > 0 ? Math.floor(remaining / ppc) : 0}, Lose: ${ppc > 0 ? (remaining % ppc) : remaining})`}
                              </Typography>
                              {warrantyMonths > 0 && warrantyExpiry && (
                                <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
                                  🛡 Warranty:{' '}
                                  {warrantyMonths >= 12
                                    ? `${(warrantyMonths / 12).toFixed(1).replace(/\.0$/, '')} Year(s)`
                                    : `${warrantyMonths} Month(s)`}{' '}
                                  (Valid until {warrantyExpiry.toLocaleDateString()})
                                </Typography>
                              )}
                              {warrantyMonths <= 0 && (
                                <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
                                  🛡 Warranty: No Warranty
                                </Typography>
                              )}
                            </Box>
                          </Grid>
                        )}
                      </Grid>
                    </Box>
                  );
                })}
                <Button
                  variant="outlined"
                  onClick={addItem}
                  sx={{ mt: 2, width: '100%', py: 1.5 }}
                  color="primary"
                >
                  + Add Product
                </Button>
              </Paper>
            </Grid>

            {/* Customer Information Section */}
            <Grid item xs={12} my={3}>
              <Paper elevation={3} sx={{ p: 3, width: '100%', display: 'flex', flexDirection: 'column' }}>
                <Typography variant="h6" sx={{ mb: 3, color: 'primary.main', fontWeight: 600 }}>
                  Customer Information
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6} md={2}>
                    <Autocomplete
                      freeSolo
                      options={cashiers}
                      value={cashierName || ''}
                      onChange={(_, val) => setCashierName(val || '')}
                      onInputChange={(_, val) => setCashierName(val || '')}
                      renderInput={(params) => <TextField {...params} label="Cashier Name" fullWidth required />}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={2}>
                    <Autocomplete
                      freeSolo
                      options={customers.map(c => c.name)}
                      value={customerName || ''}
                      onChange={(_, val) => {
                        const name = val || '';
                        setCustomerName(name);
                        if (!name) {
                          setCustomerContact(''); setCustomerEmail('');
                          return;
                        }
                        const found = customers.find(c => c.name.toLowerCase() === name.toLowerCase());
                        if (found) {
                          setCustomerContact(found.contact || '');
                          setCustomerEmail(found.email || '');
                        }
                      }}
                      onInputChange={(_, val, reason) => {
                        setCustomerName(val || '');
                        if (!val) { setCustomerContact(''); setCustomerEmail(''); return; }
                        const found = customers.find(c => c.name.toLowerCase() === val.toLowerCase());
                        if (found) { setCustomerContact(found.contact || ''); setCustomerEmail(found.email || ''); }
                      }}
                      renderInput={(params) => <TextField {...params} label="Customer Name" fullWidth />}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <TextField
                      label="Customer Contact"
                      value={customerContact ?? ''}
                      onChange={e => setCustomerContact(e.target.value)}
                      fullWidth
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <TextField
                      label="Customer Email"
                      type="email"
                      value={customerEmail ?? ''}
                      onChange={e => setCustomerEmail(e.target.value)}
                      fullWidth
                    />
                  </Grid>
                </Grid>
              </Paper>
            </Grid>
            {/* Payment Information Section */}
            <Grid item xs={12} my={3}>
              <Paper elevation={3} sx={{ p: 3, width: '100%', display: 'flex', flexDirection: 'column' }}>
                <Typography variant="h6" sx={{ mb: 3, color: 'primary.main', fontWeight: 600 }}>
                  Payment Information
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6} md={2}>
                    <FormControl fullWidth>
                      <InputLabel>Payment Method</InputLabel>
                      <Select
                        value={paymentMethod}
                        onChange={e => setPaymentMethod(e.target.value)}
                        label="Payment Method"
                      >
                        <MenuItem value="Cash">Cash</MenuItem>
                        <MenuItem value="Jazzcash">Jazzcash</MenuItem>
                        <MenuItem value="Bank transfer">Bank transfer</MenuItem>
                        <MenuItem value="Easypaisa">Easypaisa</MenuItem>
                        <MenuItem value="Cheque">Cheque</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6} md={2}>
                    <FormControl fullWidth>
                      <InputLabel>Payment Status</InputLabel>
                      <Select
                        value={paymentStatus}
                        onChange={e => setPaymentStatus(e.target.value)}
                        label="Payment Status"
                      >
                        <MenuItem value="Paid">Paid</MenuItem>
                        <MenuItem value="Credit">Credit</MenuItem>
                        <MenuItem value="Partial Paid">Partial Paid</MenuItem>
                        <MenuItem value="Unpaid">Unpaid</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  
                  {paymentStatus === 'Partial Paid' ? (
                    <>
                      <Grid item xs={12} sm={6} md={3}>
                        <TextField
                          label="Received Payment"
                          type="number"
                          value={receivedAmount || ''}
                          onChange={(e) => setReceivedAmount(e.target.value)}
                          fullWidth
                          InputProps={{
                            inputProps: {
                              onWheel: (e) => e.target.blur(), // 👈 prevents scroll value change
                              min: 0,
                            },
                          }}
                          sx={{
                            '& input[type=number]': {
                              MozAppearance: 'textfield',
                              '&::-webkit-outer-spin-button, &::-webkit-inner-spin-button': {
                                WebkitAppearance: 'none',
                                margin: 0,
                              },
                            },
                          }}
                        />

                      </Grid>
                      <Grid item xs={12} sm={6} md={2}>
                        <TextField
                          label="Remaining Payment"
                          value={(Math.max(0, netAmount - (Number(receivedAmount) || 0))).toLocaleString()}
                          InputProps={{ readOnly: true }}
                          fullWidth
                        />
                      </Grid>
                    </>
                  ) : paymentStatus === 'Credit' ? (
                    <Grid item xs={12} sm={6} md={4}>
                      <TextField
                        label="Due Date"
                        type="date"
                        value={dueDate}
                        onChange={e => setDueDate(e.target.value)}
                        fullWidth
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                  ) : (
                    <Grid item xs={12} sm={6} md={3}>
                      {(() => {
                        const paid = Number(paidAmount || 0);
                        const total = Number(netAmount || 0);
                        const showInsufficient = paymentMethod === 'Cash' && paid > 0 && paid < total;
                        const helper = showInsufficient ? `Remaining: Rs ${(total - paid).toFixed(2)}` : '';
                        return (
                          <TextField
                            label={paymentMethod === 'Cash' ? 'Cash Amount' : 'Paid Amount'}
                            type="number"
                            value={paidAmount || ''}
                            onChange={(e) => setPaidAmount(e.target.value)}
                            fullWidth
                            required
                            error={showInsufficient}
                            helperText={helper}
                            InputProps={{
                              inputProps: {
                                onWheel: (e) => e.target.blur(), // 👈 disables scroll value change
                                min: 0,
                              },
                            }}
                            sx={{
                              '& input[type=number]': {
                                '-moz-appearance': 'textfield',
                                '&::-webkit-outer-spin-button, &::-webkit-inner-spin-button': {
                                  '-webkit-appearance': 'none',
                                  margin: 0,
                                },
                              },
                            }}
                          />
                        );
                      })()}
                    </Grid>
                  )}
                  <Grid item xs={12} sm={6} md={3}>
                    <TextField
                      label="Discount Amount"
                      type="number"
                      value={discountAmount || ''}
                      onChange={(e) => setDiscountAmount(e.target.value)}
                      fullWidth
                      InputProps={{
                        inputProps: {
                          onWheel: (e) => e.target.blur(),
                          min: 0,
                        },
                      }}
                      sx={{
                        '& input[type=number]': {
                          MozAppearance: 'textfield',
                          '&::-webkit-outer-spin-button, &::-webkit-inner-spin-button': {
                            WebkitAppearance: 'none',
                            margin: 0,
                          },
                        },
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={2}>
                    <TextField
                      label="Change"
                      value={changeAmount.toLocaleString()}
                      InputProps={{ readOnly: true }}
                      fullWidth
                      sx={{
                        '& .MuiInputBase-root': {
                          bgcolor: changeAmount > 0 ? (darkMode ? '#4a3728' : '#fff3e0') : (darkMode ? '#2a2a2a' : '#f5f5f5'),
                        }
                      }}
                    />
                  </Grid>

                  {paymentMethod !== 'Cash' && (
                    <Grid item xs={12} sm={6} md={4}>
                      <Button
                        variant="outlined"
                        component="label"
                        fullWidth
                        startIcon={<CloudUploadIcon />}
                        sx={{ height: '56px' }}
                      >
                        {paymentProofFile ? 'Change Payment Proof' : 'Upload Payment Proof'}
                        <input
                          type="file"
                          accept="image/*,.pdf,.doc,.docx"
                          hidden
                          onChange={e => {
                            const file = e.target.files[0];
                            if (file) {
                              setPaymentProofFile(file);
                              // Preview image if it's an image file
                              if (file.type.startsWith('image/')) {
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                  setPaymentProofUrl(reader.result);
                                };
                                reader.readAsDataURL(file);
                              } else {
                                setPaymentProofUrl('');
                              }
                            }
                          }}
                        />
                      </Button>
                      {paymentProofFile && (
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                          Selected: {paymentProofFile.name}
                        </Typography>
                      )}
                      {paymentProofUrl && paymentProofFile && paymentProofFile.type.startsWith('image/') && (
                        <Box sx={{ mt: 1, p: 1, border: `1px solid ${darkMode ? '#3a3a3a' : '#e0e0e0'}`, borderRadius: 1 }}>
                          <img
                            src={paymentProofUrl}
                            alt="Payment Proof Preview"
                            style={{ maxWidth: '100%', maxHeight: 150, borderRadius: 4 }}
                          />
                        </Box>
                      )}
                    </Grid>
                  )}
                </Grid>
              </Paper>
            </Grid>

            {/* Summary Section */}
            <Grid item xs={12} my={1}>
              <Paper elevation={3} sx={{ p: 3, width: '100%', display: 'flex', flexDirection: 'column' }}>
                <Typography variant="h6" sx={{ mb: 3, color: 'primary.main', fontWeight: 600 }}>
                  Sale Summary
                </Typography>
                <Grid container spacing={3}>
                  <Grid item xs={12} md={4} px={1}>
                    <Box sx={{ p: 2, bgcolor: darkMode ? '#1a3a52' : '#e3f2fd', borderRadius: 2, textAlign: 'center' }}>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        Total Quantity
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 700, color: 'primary.main' }}>
                        {totalQuantity}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} md={4} px={1}>
                    <Box sx={{ p: 2, bgcolor: darkMode ? '#4a3728' : '#fff3e0', borderRadius: 2, textAlign: 'center' }}>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        Total Discount
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 700, color: 'warning.main' }}>
                        Rs. {(discountTotal + Number(discountAmount || 0)).toLocaleString()}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} md={4} px={1}>
                    <Box sx={{ p: 2, bgcolor: darkMode ? '#1b5e20' : '#e8f5e9', borderRadius: 2, textAlign: 'center' }}>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        Net Amount
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 700, color: 'success.main' }}>
                        Rs. {netAmount.toLocaleString()}
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              </Paper>
            </Grid>

            {/* Action Buttons */}
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 2 }}>
                <Button
                  onClick={handleSaveAndPrint}
                  variant="outlined"
                  color="secondary"
                  size="large"
                  disabled={submitting}
                  sx={{ minWidth: 150, py: 1.5 }}
                >
                  {submitting ? 'Saving...' : 'Save & Print'}
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  size="large"
                  disabled={submitting}
                  sx={{ minWidth: 150, py: 1.5 }}
                >
                  {submitting ? 'Saving...' : 'Save Sale'}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </form>
        <Divider sx={{ my: 4 }} />
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 3, color: 'primary.main' }}>Recent Sales</Typography>
          <Paper elevation={2} sx={{ p: 2, bgcolor: darkMode ? '#1e1e1e' : '#f8f9fa' }}>
            <List>
              {recentSales.map(s => (
                <ListItem
                  key={s._id}
                  sx={{
                    px: 2,
                    py: 1.5,
                    mb: 1,
                    bgcolor: darkMode ? '#2a2a2a' : '#ffffff',
                    borderRadius: 1,
                    border: `1px solid ${darkMode ? '#3a3a3a' : '#e0e0e0'}`,
                    '&:hover': {
                      bgcolor: darkMode ? '#3a3a3a' : '#f5f5f5',
                      boxShadow: 2
                    }
                  }}
                  secondaryAction={!isMobile ? (
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <IconButton edge="end" aria-label="print" size="small" color="primary" onClick={(e) => {
                        e.stopPropagation();
                        const printContent = generateInvoiceHTML(s, products);
                        const w = window.open('', '_blank');
                        if (!w || !w.document) {
                          setError('Popup blocked. Please allow popups for this site to print the invoice.');
                          return;
                        }
                        w.document.write(printContent);
                        w.document.close();
                        setTimeout(() => w.print(), 250);
                      }}>
                        <PrintIcon fontSize="small" />
                      </IconButton>
                      <IconButton edge="end" aria-label="edit" size="small" color="primary" onClick={(e) => { e.currentTarget.blur(); openEdit(s); }}><EditIcon fontSize="small" /></IconButton>
                      {/* Resend Email */}
                      <IconButton edge="end" aria-label="resend-email" size="small" color="primary" onClick={(e) => { e.stopPropagation(); handleResendEmail(s); }}>
                        <EmailIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  ) : null}>

                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <Typography
                          variant="subtitle1"
                          sx={{
                            cursor: 'pointer',
                            fontWeight: 600,
                            color: 'primary.main',
                            '&:hover': { textDecoration: 'underline' }
                          }}
                          onClick={() => { window.location.href = `/seller/sales-report?highlight=${encodeURIComponent(s._id)}`; }}
                        >
                          {new Date(s.createdAt).toLocaleString()}
                        </Typography>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'success.main' }}>
                          Rs. {s.netAmount?.toLocaleString()}
                        </Typography>
                        {Array.isArray(s.warrantyClaims) && s.warrantyClaims.length > 0 && (() => {
                          const perProduct = new Map();
                          let firstClaimDate = null;
                          (s.warrantyClaims || []).forEach(wc => {
                            const claimDate = wc.createdAt ? new Date(wc.createdAt) : null;
                            (wc.items || []).forEach(ci => {
                              const key = String(ci.productName || ci.SKU || ci.productId || '');
                              const prev = perProduct.get(key) || { qty: 0, firstDate: null };
                              const qty = Number(ci.quantity) || 0;
                              prev.qty += qty;
                              if (claimDate && (!prev.firstDate || claimDate < prev.firstDate)) {
                                prev.firstDate = claimDate;
                              }
                              perProduct.set(key, prev);
                              if (claimDate && (!firstClaimDate || claimDate < firstClaimDate)) {
                                firstClaimDate = claimDate;
                              }
                            });
                          });
                          let totalQty = 0;
                          perProduct.forEach(v => { totalQty += v.qty; });
                          const tooltipContent = (
                            <Box sx={{ p: 0.5 }}>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                Warranty claims on this invoice
                              </Typography>
                              {firstClaimDate && (
                                <Typography variant="caption" display="block">
                                  First claim: {firstClaimDate.toLocaleString()}
                                </Typography>
                              )}
                              {Array.from(perProduct.entries()).map(([name, info]) => (
                                <Typography key={name} variant="caption" display="block">
                                  {name}: {info.qty} pcs
                                  {info.firstDate
                                    ? ` (first: ${info.firstDate.toLocaleString()})`
                                    : ''}
                                </Typography>
                              ))}
                              <Typography variant="caption" sx={{ mt: 0.5, fontWeight: 600 }} display="block">
                                Total claimed: {totalQty} pcs
                              </Typography>
                            </Box>
                          );
                          return (
                            <Tooltip title={tooltipContent} arrow>
                              <Chip
                                label="Warranty Claimed"
                                size="small"
                                color="warning"
                                sx={{ height: 22 }}
                              />
                            </Tooltip>
                          );
                        })()}
                        {/* Check if sale has refunds or warranty claims */}
                        {(() => {
                          const hasRefunds = (s.refunds || []).length > 0;
                          const hasWarrantyClaims = (s.warrantyClaims || []).length > 0;
                          const isEdited = s.edited || hasRefunds || hasWarrantyClaims;
                          return isEdited && <Chip label="Edited" size="small" color="primary" sx={{ height: 22 }} />;
                        })()}
                        {/* Email status indicator */}
                        {s.emailStatus === 'sent' && (
                          <Chip label="✉ Sent" size="small" sx={{ height: 22, bgcolor: darkMode ? '#388e3c' : '#4caf50', color: 'white' }} />
                        )}
                        {s.emailStatus === 'failed' && (
                          <Chip label="✉ Failed" size="small" sx={{ height: 22, bgcolor: darkMode ? '#d32f2f' : '#f44336', color: 'white' }} />
                        )}
                        {s.emailStatus === 'pending' && (
                          <Chip label="⧐ Email Pending" size="small" sx={{ height: 22, bgcolor: darkMode ? '#616161' : '#9e9e9e', color: 'white' }} />
                        )}
                      </Box>
                    }
                    secondary={
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        {s.items.map(i => {
                          const origQty = Number(i.quantity) || 0;
                          let refunded = 0;
                          (s.refunds || []).forEach(r => {
                            (r.items || []).forEach(it => {
                              if (String(it.productId) === String(i.productId)) {
                                refunded += Number(it.quantity) || 0;
                              }
                            });
                          });
                          const remaining = origQty - refunded;
                          return `${i.productName} x${remaining}${refunded ? ` (-${refunded} ref)` : ''}`;
                        }).join(', ')}
                      </Typography>
                    }
                  />
                  {isMobile && (
                    <Box sx={{ display: 'flex', gap: 1, mt: 1, justifyContent: 'flex-end' }}>
                      <IconButton aria-label="print" size="small" color="primary" onClick={(e) => {
                        e.stopPropagation();
                        const printContent = generateInvoiceHTML(s, products);
                        const w = window.open('', '_blank');
                        if (!w || !w.document) {
                          setError('Popup blocked. Please allow popups for this site to print the invoice.');
                          return;
                        }
                        w.document.write(printContent);
                        w.document.close();
                        setTimeout(() => w.print(), 250);
                      }}>
                        <PrintIcon fontSize="small" />
                      </IconButton>
                      <IconButton aria-label="edit" size="small" color="primary" onClick={(e) => { e.currentTarget.blur(); openEdit(s); }}><EditIcon fontSize="small" /></IconButton>
                      <IconButton aria-label="resend-email" size="small" color="primary" onClick={(e) => { e.stopPropagation(); handleResendEmail(s); }}>
                        <EmailIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  )}
                </ListItem>
              ))}
              {recentSales.length === 0 && (
                <Box sx={{ p: 3, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">No recent sales.</Typography>
                </Box>
              )}
            </List>
          </Paper>
          <Dialog open={!!editSale} onClose={() => setEditSale(null)} maxWidth="xl" fullWidth>
            <DialogTitle sx={{ bgcolor: 'primary.main', color: 'white', display: 'flex', alignItems: 'center' }}>
              <Typography variant="h5" component="div" sx={{ flexGrow: 1 }}>Edit Sale</Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Tooltip title="Print Invoice">
                  <IconButton
                    onClick={async () => {
                      if (!editSale) return;
                      // First save the changes
                      await saveEdit();
                      // Then print the invoice
                      const html = generateInvoiceHTML(editSale, products);
                      const w = window.open('', '_blank');
                      if (!w || !w.document) { alert('Popup blocked. Please allow popups or use the browser print.'); return; }
                      w.document.write(html);
                      w.document.close();
                      setTimeout(() => w.print(), 250);
                    }}
                    sx={{ color: 'white' }}
                  >
                    <PrintIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Send Email">
                  <IconButton
                    onClick={async () => {
                      if (!editSale) return;
                      // First save the changes
                      await saveEdit();
                      // Then send the email
                      handleResendEmail(editSale);
                    }}
                    sx={{ color: 'white' }}
                  >
                    <EmailIcon />
                  </IconButton>
                </Tooltip>
              </Box>
            </DialogTitle>
            <DialogContent sx={{ p: 3 }}>
              <Grid container spacing={1}>
                {/* Basic Information Section */}
                <Grid sx={{ width: { xs: '100%' }, mt: '20px' }}>
                  <Paper elevation={3} sx={{ p: 2, mb: 2, bgcolor: darkMode ? '#1e1e1e' : '#f8f9fa' }}>
                    <Typography variant="h6" sx={{ mb: 2, color: 'primary.main' }}>Basic Information</Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6} md={3}>
                        <Autocomplete
                          freeSolo
                          options={cashiers}
                          value={editForm.cashierName || ''}
                          onChange={(_, val) => setEditForm({ ...editForm, cashierName: val || '' })}
                          onInputChange={(_, val) => setEditForm({ ...editForm, cashierName: val || '' })}
                          renderInput={(params) => <TextField {...params} label="Cashier Name" fullWidth />}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6} md={3}>
                        <Autocomplete
                          freeSolo
                          options={customers.map(c => c.name)}
                          value={editForm.customerName || ''}
                          onChange={(_, val) => {
                            const name = val || '';
                            const updated = { ...editForm, customerName: name };
                            if (!name) { updated.customerContact = ''; updated.customerEmail = ''; setEditForm(updated); return; }
                            const found = customers.find(c => c.name.toLowerCase() === name.toLowerCase());
                            if (found) { updated.customerContact = found.contact || ''; updated.customerEmail = found.email || ''; }
                            setEditForm(updated);
                          }}
                          onInputChange={(_, val) => {
                            const updated = { ...editForm, customerName: val || '' };
                            if (!val) { updated.customerContact = ''; updated.customerEmail = ''; setEditForm(updated); return; }
                            const found = customers.find(c => c.name.toLowerCase() === val.toLowerCase());
                            if (found) { updated.customerContact = found.contact || ''; updated.customerEmail = found.email || ''; }
                            setEditForm(updated);
                          }}
                          renderInput={(params) => <TextField {...params} label="Customer Name" fullWidth />}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6} md={3}>
                        <TextField
                          fullWidth
                          label="Customer Contact"
                          value={editForm.customerContact || ''}
                          onChange={e => setEditForm({ ...editForm, customerContact: e.target.value })}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6} md={3}>
                        <TextField
                          fullWidth
                          label="Customer Email"
                          type="email"
                          value={editForm.customerEmail || ''}
                          onChange={e => setEditForm({ ...editForm, customerEmail: e.target.value })}
                        />
                      </Grid>
                    </Grid>
                  </Paper>
                </Grid>

                {/* Payment Information Section */}
                <Grid sx={{ width: { xs: '100%' } }}>
                  <Paper elevation={3} sx={{ p: 2, mb: 2, bgcolor: darkMode ? '#1e1e1e' : '#f8f9fa' }}>
                    <Typography variant="h6" sx={{ mb: 2, color: 'primary.main' }}>Payment Information</Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6} md={3}>
                        <FormControl fullWidth>
                          <InputLabel>Payment Method</InputLabel>
                          <Select
                            value={editForm.paymentMethod || 'Cash'}
                            onChange={e => setEditForm({ ...editForm, paymentMethod: e.target.value })}
                            label="Payment Method"
                          >
                            <MenuItem value="Cash">Cash</MenuItem>
                            <MenuItem value="Jazzcash">Jazzcash</MenuItem>
                            <MenuItem value="Bank transfer">Bank transfer</MenuItem>
                            <MenuItem value="Easypaisa">Easypaisa</MenuItem>
                            <MenuItem value="Cheque">Cheque</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} sm={6} md={3}>
                        <FormControl fullWidth>
                          <InputLabel>Payment Status</InputLabel>
                          <Select
                            value={editForm.paymentStatus || 'Unpaid'}
                            onChange={e => setEditForm({ ...editForm, paymentStatus: e.target.value })}
                            label="Payment Status"
                          >
                            <MenuItem value="Paid">Paid</MenuItem>
                            <MenuItem value="Credit">Credit</MenuItem>
                            <MenuItem value="Partial Paid">Partial Paid</MenuItem>
                            <MenuItem value="Unpaid">Unpaid</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                      {editForm.paymentStatus === 'Partial Paid' ? (
                        <>
                          <Grid item xs={12} sm={6} md={3}>
                            <TextField
                              fullWidth
                              label="Received Payment"
                              type="number"
                              value={editForm.paidAmount || ''}
                              onChange={(e) =>
                                setEditForm({ ...editForm, paidAmount: e.target.value })
                              }
                              InputProps={{
                                inputProps: {
                                  onWheel: (e) => e.target.blur(), // 👈 prevents scroll changing value
                                  min: 0,
                                },
                              }}
                              sx={{
                                '& input[type=number]': {
                                  MozAppearance: 'textfield',
                                  '&::-webkit-outer-spin-button, &::-webkit-inner-spin-button': {
                                    WebkitAppearance: 'none',
                                    margin: 0,
                                  },
                                },
                              }}
                            />
                          </Grid>
                          <Grid item xs={12} sm={6} md={3}>
                            <TextField
                              fullWidth
                              label="Remaining Payment"
                              value={(() => {
                                const editNetAmount = editForm.items.reduce((sum, i) => sum + ((Number(i.perPiecePrice) * Number(i.quantity)) - (Number(i.discount) || 0)), 0) - Number(editForm.discountAmount || 0);
                                return (Math.max(0, editNetAmount - (Number(editForm.paidAmount) || 0))).toLocaleString();
                              })()}
                              InputProps={{ readOnly: true }}
                            />
                          </Grid>
                          <Grid item xs={12} sm={6} md={3}>
                            <TextField
                              fullWidth
                              label="Discount Amount"
                              type="number"
                              value={editForm.discountAmount || ''}
                              onChange={(e) =>
                                setEditForm({ ...editForm, discountAmount: e.target.value })
                              }
                              InputProps={{
                                inputProps: {
                                  onWheel: (e) => e.target.blur(),
                                  min: 0,
                                },
                              }}
                              sx={{
                                '& input[type=number]': {
                                  MozAppearance: 'textfield',
                                  '&::-webkit-outer-spin-button, &::-webkit-inner-spin-button': {
                                    WebkitAppearance: 'none',
                                    margin: 0,
                                  },
                                },
                              }}
                            />
                          </Grid>
                        </>
                      ) : editForm.paymentStatus === 'Credit' ? (
                        <>
                          <Grid item xs={12} sm={6} md={3}>
                            <TextField
                              fullWidth
                              label="Due Date"
                              type="date"
                              value={editForm.dueDate || ''}
                              onChange={e => setEditForm({ ...editForm, dueDate: e.target.value })}
                              InputLabelProps={{ shrink: true }}
                            />
                          </Grid>
                          <Grid item xs={12} sm={6} md={3}>
                            <TextField
                              fullWidth
                              label="Discount Amount"
                              type="number"
                              value={editForm.discountAmount || ''}
                              onChange={(e) =>
                                setEditForm({ ...editForm, discountAmount: e.target.value })
                              }
                              InputProps={{
                                inputProps: {
                                  onWheel: (e) => e.target.blur(),
                                  min: 0,
                                },
                              }}
                              sx={{
                                '& input[type=number]': {
                                  MozAppearance: 'textfield',
                                  '&::-webkit-outer-spin-button, &::-webkit-inner-spin-button': {
                                    WebkitAppearance: 'none',
                                    margin: 0,
                                  },
                                },
                              }}
                            />
                          </Grid>
                          <Grid item xs={12} sm={6} md={3}>
                            {(() => {
                              const editNetAmount = editForm.items.reduce((sum, i) => sum + ((Number(i.perPiecePrice) * Number(i.quantity)) - (Number(i.discount) || 0)), 0) - Number(editForm.discountAmount || 0);
                              const editChangeAmount = Math.max(0, (Number(editForm.paidAmount) || 0) - editNetAmount);
                              return (
                                <TextField
                                  fullWidth
                                  label="Change"
                                  type="number"
                                  value={editChangeAmount}
                                  InputProps={{ readOnly: true }}
                                />
                              );
                            })()}
                          </Grid>
                        </>
                      ) : (
                        <>
                          <Grid item xs={12} sm={6} md={3}>
                            <TextField
                              fullWidth
                              label={
                                editForm.paymentMethod === 'Cash'
                                  ? 'Cash Amount'
                                  : 'Paid Amount'
                              }
                              type="number"
                              value={editForm.paidAmount || ''}
                              onChange={(e) =>
                                setEditForm({ ...editForm, paidAmount: e.target.value })
                              }
                              InputProps={{
                                inputProps: {
                                  onWheel: (e) => e.target.blur(), // 👈 stops scroll value change
                                  min: 0,
                                },
                              }}
                              sx={{
                                '& input[type=number]': {
                                  MozAppearance: 'textfield',
                                  '&::-webkit-outer-spin-button, &::-webkit-inner-spin-button': {
                                    WebkitAppearance: 'none',
                                    margin: 0,
                                  },
                                },
                              }}
                            />

                          </Grid>
                          <Grid item xs={12} sm={6} md={3}>
                            {(() => {
                              const editNetAmount = editForm.items.reduce((sum, i) => sum + ((Number(i.perPiecePrice) * Number(i.quantity)) - (Number(i.discount) || 0)), 0) - Number(editForm.discountAmount || 0);
                              const editChangeAmount = Math.max(0, (Number(editForm.paidAmount) || 0) - editNetAmount);
                              return (
                                <TextField
                                  fullWidth
                                  label="Change"
                                  type="number"
                                  value={editChangeAmount}
                                  InputProps={{ readOnly: true }}
                                />
                              );
                            })()}
                          </Grid>
                          <Grid item xs={12} sm={6} md={3}>
                            <TextField
                              fullWidth
                              label="Discount Amount"
                              type="number"
                              value={editForm.discountAmount || ''}
                              onChange={(e) =>
                                setEditForm({ ...editForm, discountAmount: e.target.value })
                              }
                              InputProps={{
                                inputProps: {
                                  onWheel: (e) => e.target.blur(),
                                  min: 0,
                                },
                              }}
                              sx={{
                                '& input[type=number]': {
                                  MozAppearance: 'textfield',
                                  '&::-webkit-outer-spin-button, &::-webkit-inner-spin-button': {
                                    WebkitAppearance: 'none',
                                    margin: 0,
                                  },
                                },
                              }}
                            />
                          </Grid>
                        </>
                      )}
                      {editForm.paymentMethod !== 'Cash' && (
                        <>
                          <Grid sx={{ width: { xs: '45%', md: '15%' } }}>
                            <Button variant="outlined" component="label" fullWidth startIcon={<CloudUploadIcon />}>
                              {editPaymentProofFile ? 'Change Payment Proof' : editSale?.paymentProofUrl ? 'Change Payment Proof' : 'Upload Payment Proof'}
                              <input type="file" accept="image/*,.pdf,.doc,.docx" hidden onChange={e => {
                                const file = e.target.files[0];
                                if (file) {
                                  setEditPaymentProofFile(file);
                                }
                              }} />
                            </Button>
                            {editPaymentProofFile && (
                              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                                Selected: {editPaymentProofFile.name}
                              </Typography>
                            )}
                          </Grid>
                          {editSale?.paymentProofUrl && !editPaymentProofFile && (
                            <Grid sx={{ width: { xs: '100%', md: '50%' } }}>
                              <Box sx={{ mt: 1 }}>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Current Payment Proof:</Typography>
                                {editSale.paymentProofUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                                  <img src={editSale.paymentProofUrl} alt="Payment Proof" style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 4, border: `1px solid ${darkMode ? '#3a3a3a' : '#e0e0e0'}` }} />
                                ) : (
                                  <Button variant="outlined" href={editSale.paymentProofUrl} target="_blank" rel="noopener noreferrer">
                                    View Payment Proof Document
                                  </Button>
                                )}
                              </Box>
                            </Grid>
                          )}
                        </>
                      )}
                    </Grid>
                  </Paper>
                </Grid>

                {/* Items Section */}
                <Grid sx={{ width: { xs: '100%' } }}>
                  <Paper elevation={3} sx={{ p: 2, mb: 2, bgcolor: darkMode ? '#1e1e1e' : '#f8f9fa' }}>
                    <Typography variant="h6" sx={{ mb: 2, color: 'primary.main' }}>Line Items</Typography>
                    {editForm.items.map((item, idx) => {
                      const prod = item.productId ? products.find(p => p._id === item.productId) : null;
                      const ppc = prod ? (Number(prod.piecesPerCarton) || 0) : 0;
                      const derived = prod ? ((Number(prod.cartonQuantity) || 0) * ppc) + (Number(prod.losePieces) || 0) : 0;
                      const totalPcs = prod ? (Number(prod.totalPieces) || derived) : 0;
                      const qty = Number(item.quantity) || 0;
                      const remaining = Math.max(0, totalPcs - qty);
                      const lineSubtotal = (Number(item.perPiecePrice) * Number(item.quantity || 0)) - (Number(item.discount) || 0);
                      const rawWarranty = prod ? prod.warrantyMonths : null;
                      const warrantyMonths = rawWarranty == null ? 0 : Number(rawWarranty);
                      let warrantyUntil = null;
                      let isUnderWarranty = false;
                      if (prod && warrantyMonths > 0 && editSale?.createdAt) {
                        const baseDate = new Date(editSale.createdAt);
                        const w = new Date(baseDate);
                        w.setMonth(w.getMonth() + warrantyMonths);
                        warrantyUntil = w;
                        isUnderWarranty = new Date() <= w;
                      }

                      // compute warranty claim info for this item (quantity and first claim date)
                      let claimedQty = 0;
                      let firstClaimDate = null;
                      if (Array.isArray(editSale?.warrantyClaims)) {
                        const claimRecords = editSale.warrantyClaims;
                        claimRecords.forEach(wc => {
                          const claimDate = wc.createdAt ? new Date(wc.createdAt) : null;
                          (wc.items || []).forEach(ci => {
                            const sameProduct =
                              (ci.productId && item.productId && String(ci.productId) === String(item.productId)) ||
                              (!ci.productId && ci.SKU && item.SKU && ci.SKU === item.SKU);
                            if (sameProduct) {
                              claimedQty += Number(ci.quantity) || 0;
                              if (claimDate) {
                                if (!firstClaimDate || claimDate < firstClaimDate) {
                                  firstClaimDate = claimDate;
                                }
                              }
                            }
                          });
                        });
                      }
                      const hasWarrantyClaim = claimedQty > 0;
                      return (
                        <Paper key={idx} elevation={4} sx={{ mb: 3, p: 2, borderRadius: 2, bgcolor: darkMode ? '#2a2a2a' : '#fafafa' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Chip label={`Item ${idx + 1}`} size="small" sx={{ bgcolor: 'primary.main', color: 'white' }} />
                              {hasWarrantyClaim && firstClaimDate && (
                                <Tooltip
                                  title={`First warranty claim: ${firstClaimDate.toLocaleString()}`}
                                  arrow
                                >
                                  <Chip
                                    label="Warranty Claimed"
                                    size="small"
                                    color="warning"
                                    sx={{ height: 22 }}
                                  />
                                </Tooltip>
                              )}
                            </Box>
                            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                              <Chip label={item.brand ? item.brand : 'Brand: -'} size="small" color={item.brand ? 'primary' : 'default'} />
                              {prod && (
                                <Typography variant="caption" color="text.secondary">
                                  📦 Total: {totalPcs} {(qty > 0) ? `→ After Edit: ${remaining}` : ''}
                                </Typography>
                              )}
                            </Box>
                          </Box>
                          <Grid container spacing={2}>
                            <Grid item xs={12} sm={6} md={3}>
                              <FormControl fullWidth>
                                <InputLabel>Brand</InputLabel>
                                <Select
                                  value={item.brand || ''}
                                  label="Brand"
                                  onChange={e => handleEditItemChange(idx, 'brand', e.target.value)}
                                >
                                  <MenuItem value="">All Brands</MenuItem>
                                  {brands.map(b => <MenuItem key={b} value={b}>{b}</MenuItem>)}
                                </Select>
                              </FormControl>
                            </Grid>
                            <Grid item xs={12} sm={6} md={3}>
                              <Autocomplete
                                options={sortedProductsByBrandFor(item.brand, products)}
                                getOptionLabel={(option) => option?.name ? `${option.name} (${option.SKU})` : ''}
                                value={products.find(p => p._id === item.productId) || null}
                                onChange={(_, val) => handleEditItemChange(idx, 'productId', val?._id || '')}
                                renderInput={(params) => <TextField {...params} label="Product" fullWidth />}
                                fullWidth
                              />
                            </Grid>
                            <Grid item xs={12} sm={6} md={3}>
                              <TextField
                                fullWidth
                                label="Quantity"
                                type="number"
                                value={item.quantity || ''}
                                onChange={(e) =>
                                  handleEditItemChange(
                                    idx,
                                    'quantity',
                                    Math.max(0, Number(e.target.value))
                                  )
                                }
                                InputProps={{
                                  inputProps: {
                                    onWheel: (e) => e.target.blur(), // 👈 prevents scroll value change
                                    min: 0,
                                  },
                                }}
                                sx={{
                                  '& input[type=number]': {
                                    '-moz-appearance': 'textfield',
                                    '&::-webkit-outer-spin-button, &::-webkit-inner-spin-button': {
                                      '-webkit-appearance': 'none',
                                      margin: 0,
                                    },
                                  },
                                }}
                              />
                            </Grid>
                            <Grid item xs={12} sm={6} md={3}>
                              {(() => {
                                const suggested = prod ? (Number(prod.sellingPerPiece) || 0) : 0;
                                const priceVal = Number(item.perPiecePrice) || 0;
                                const isBelow = prod && priceVal > 0 && suggested > 0 && priceVal < suggested;
                                return (
                                  <TextField
                                    fullWidth
                                    label="Price"
                                    type="number"
                                    value={item.perPiecePrice || ''}
                                    onChange={(e) =>
                                      handleEditItemChange(idx, 'perPiecePrice', e.target.value)
                                    }
                                    required
                                    error={isBelow}
                                    helperText={
                                      isBelow ? `Below suggested selling price Rs. ${suggested}` : ''
                                    }
                                    InputProps={{
                                      inputProps: {
                                        onWheel: (e) => e.target.blur(), // 👈 stops scroll changing value
                                        min: 0,
                                        step: "0.01",
                                      },
                                      endAdornment: isBelow ? (
                                        <InputAdornment position="end">
                                          <Tooltip
                                            title={`Below suggested selling price Rs. ${suggested}`}
                                            arrow
                                          >
                                            <WarningAmberIcon color="error" />
                                          </Tooltip>
                                        </InputAdornment>
                                      ) : null,
                                    }}
                                    sx={{
                                      '& input[type=number]': {
                                        MozAppearance: 'textfield',
                                        '&::-webkit-outer-spin-button, &::-webkit-inner-spin-button': {
                                          WebkitAppearance: 'none',
                                          margin: 0,
                                        },
                                      },
                                    }}
                                  />
                                );
                              })()}
                            </Grid>
                            <Grid item xs={12} sm={6} md={3}>
                              <TextField
                                fullWidth
                                label="Discount"
                                type="number"
                                value={item.discount || ''}
                                onChange={(e) =>
                                  handleEditItemChange(idx, 'discount', Math.max(0, Number(e.target.value)))
                                }
                                InputProps={{
                                  inputProps: {
                                    onWheel: (e) => e.target.blur(), // 👈 disables scroll changing value
                                    min: 0,
                                  },
                                }}
                                sx={{
                                  '& input[type=number]': {
                                    '-moz-appearance': 'textfield',
                                    '&::-webkit-outer-spin-button, &::-webkit-inner-spin-button': {
                                      '-webkit-appearance': 'none',
                                      margin: 0,
                                    },
                                  },
                                }}
                              />
                            </Grid>
                            <Grid sx={{ width: { xs: '100%', md: '8.3333%' }, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Tooltip title={editForm.items.length === 1 ? "Cannot delete last item" : "Delete item"} arrow>
                                <span>
                                  <IconButton color="error" onClick={() => setConfirmDeleteIndex(idx)} disabled={editForm.items.length === 1}>
                                    <DeleteIcon />
                                  </IconButton>
                                </span>
                              </Tooltip>
                            </Grid>
                            <Grid sx={{ width: { xs: '100%' }, mt: 1 }}>
                              <Typography variant="body2" sx={{ textAlign: 'right', fontWeight: 600 }}>
                                Subtotal: Rs. {lineSubtotal.toLocaleString()}
                              </Typography>
                            </Grid>
                            {prod && (
                              <Grid item xs={12} sm={6} md={6}>
                                <Typography variant="body2" color="text.secondary">
                                  📦 Total Pieces: {totalPcs} (Cart: {ppc > 0 ? Math.floor(totalPcs / ppc) : 0}, Lose: {ppc > 0 ? (totalPcs % ppc) : totalPcs}){qty > 0 && ` → After Edit: Remaining ${remaining} (Cart: ${ppc > 0 ? Math.floor(remaining / ppc) : 0}, Lose: ${ppc > 0 ? (remaining % ppc) : remaining})`}
                                </Typography>
                                {warrantyUntil && (
                                  <Typography
                                    variant="body2"
                                    color={isUnderWarranty ? 'success.main' : 'error.main'}
                                    sx={{ mt: 0.5 }}
                                  >
                                    🛡 Warranty:{' '}
                                    {isUnderWarranty
                                      ? `Valid until ${warrantyUntil.toLocaleDateString()}`
                                      : `Expired on ${warrantyUntil.toLocaleDateString()}`}
                                  </Typography>
                                )}
                              </Grid>
                            )}
                          </Grid>
                        </Paper>
                      );
                    })}
                    <Button variant="outlined" onClick={addEditItem} sx={{ mt: 2 }}>Add Item</Button>
                  </Paper>
                </Grid>

                {/* Summary Section */}
                <Grid item xs={12} my={3}>
                  <Paper elevation={3} sx={{ p: 3, width: '100%', display: 'flex', flexDirection: 'column' }}>
                    <Typography variant="h6" sx={{ mb: 3, color: 'primary.main', fontWeight: 600 }}>
                      Sale Summary
                    </Typography>
                    {(() => {
                      const totalQuantity = editForm.items.reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);
                      const totalBeforeDiscount = editForm.items.reduce((sum, i) => sum + (Number(i.perPiecePrice) * Number(i.quantity)), 0);
                      const itemDiscounts = editForm.items.reduce((sum, i) => sum + (Number(i.discount) || 0), 0);
                      const globalDiscount = Number(editForm.discountAmount || 0);
                      const totalDiscount = itemDiscounts + globalDiscount;
                      const netAmount = totalBeforeDiscount - totalDiscount;

                      return (
                        <Grid container spacing={3}>
                          {/* Total Quantity */}
                          <Grid item xs={12} md={3} px={1}>
                            <Box sx={{ p: 2, ml: 2, bgcolor: darkMode ? '#1a3a52' : '#e3f2fd', borderRadius: 2, textAlign: 'center' }}>
                              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                Total Quantity
                              </Typography>
                              <Typography variant="h5" sx={{ fontWeight: 700, color: 'primary.main' }}>
                                {totalQuantity}
                              </Typography>
                            </Box>
                          </Grid>

                          {/* Total Amount */}
                          <Grid item xs={12} md={3} px={1}>
                            <Box sx={{ p: 2, bgcolor: darkMode ? '#1a3a52' : '#e3f2fd', borderRadius: 2, textAlign: 'center' }}>
                              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                Total Amount
                              </Typography>
                              <Typography variant="h5" sx={{ fontWeight: 700, color: 'primary.main' }}>
                                Rs. {totalBeforeDiscount.toLocaleString()}
                              </Typography>
                            </Box>
                          </Grid>

                          {/* Total Discount */}
                          <Grid item xs={12} md={3} px={1}>
                            <Box sx={{ p: 2, bgcolor: darkMode ? '#4a3728' : '#fff3e0', borderRadius: 2, textAlign: 'center' }}>
                              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                Total Discount
                              </Typography>
                              <Typography variant="h5" sx={{ fontWeight: 700, color: 'warning.main' }}>
                                Rs. {totalDiscount.toLocaleString()}
                              </Typography>
                            </Box>
                          </Grid>

                          {/* Net Amount */}
                          <Grid item xs={12} md={3} px={1}>
                            <Box sx={{ p: 2, bgcolor: darkMode ? '#1b5e20' : '#e8f5e9', borderRadius: 2, textAlign: 'center' }}>
                              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                Net Amount
                              </Typography>
                              <Typography variant="h5" sx={{ fontWeight: 700, color: 'success.main' }}>
                                Rs. {netAmount.toLocaleString()}
                              </Typography>
                            </Box>
                          </Grid>
                        </Grid>
                      );
                    })()}
                  </Paper>
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions sx={{ p: 2 }}>
              <Button onClick={() => setEditSale(null)}>Cancel</Button>
              <Button
                color="warning"
                onClick={() => {
                  if (!editSale) return;
                  const saleDate = editSale.createdAt ? new Date(editSale.createdAt) : null;
                  const prepared = (editSale.items || []).map(i => {
                    const prod = i.productId ? products.find(p => p._id === i.productId) : null;
                    const rawWarranty = prod ? prod.warrantyMonths : null;
                    const warrantyMonths = rawWarranty == null ? 0 : Number(rawWarranty);
                    let warrantyUntil = null;
                    let underWarranty = false;
                    if (saleDate && warrantyMonths > 0) {
                      const d = new Date(saleDate);
                      d.setMonth(d.getMonth() + warrantyMonths);
                      warrantyUntil = d;
                      underWarranty = new Date() <= d;
                    }
                    return {
                      productId: i.productId,
                      SKU: i.SKU || '',
                      productName: i.productName,
                      maxQty: Number(i.quantity) || 0,
                      qty: 0,
                      warrantyUntil,
                      underWarranty
                    };
                  }).filter(i => i.underWarranty && i.maxQty > 0);
                  if (!prepared.length) {
                    alert('No items are currently under warranty for this sale.');
                    return;
                  }
                  setWarrantyItems(prepared);
                  setWarrantyReason('');
                  setWarrantyModalOpen(true);
                }}
              >
                Claim Warranty
              </Button>
              <Button
                color="error"
                onClick={() => {
                  // prepare refund items from editSale (account for previous refunds)
                  if (!editSale) return;
                  const origMap = new Map();
                  (editSale.items || []).forEach(i => {
                    origMap.set(String(i.productId || i._id || ''), Number(i.quantity) || 0);
                  });
                  const refundedMap = new Map();
                  (editSale.refunds || []).forEach(r => {
                    (r.items || []).forEach(it => {
                      const k = String(it.productId || '');
                      refundedMap.set(k, (refundedMap.get(k) || 0) + (Number(it.quantity) || 0));
                    });
                  });
                  const prepared = [];
                  origMap.forEach((origQty, pid) => {
                    const already = Number(refundedMap.get(pid) || 0);
                    const remain = Math.max(0, origQty - already);
                    if (remain > 0) {
                      const info = (editSale.items || []).find(i => String(i.productId || i._id || '') === pid) || {};
                      prepared.push({
                        productId: pid,
                        SKU: info.SKU || '',
                        productName: info.productName || info.name || '',
                        perPiecePrice: Number(info.perPiecePrice || info.price || 0) || 0,
                        maxQty: remain,
                        qty: 0,
                        full: false
                      });
                    }
                  });
                  if (prepared.length === 0) {
                    alert('No refundable quantity remaining for this sale.');
                    return;
                  }
                  setRefundItems(prepared);
                  setRefundReason('');
                  setRefundModalOpen(true);
                }}
              >
                Refund
              </Button>
              <Button variant="contained" onClick={saveEdit} color="primary">Save Changes</Button>
            </DialogActions>
          </Dialog>

          <Dialog open={refundModalOpen} onClose={() => setRefundModalOpen(false)} maxWidth="md" fullWidth>
            <DialogTitle sx={{ bgcolor: 'error.main', color: 'white' }}>Process Refund</DialogTitle>
            <DialogContent sx={{ p: 3 }}>
              <Typography variant="body1" sx={{ mb: 2, fontWeight: 600 }}>
                Select quantities to refund for each item. You may refund partially or fully.
              </Typography>
              <Button
                size="small"
                variant="outlined"
                color="error"
                onClick={() => {
                  const copy = refundItems.map(i => ({ ...i, qty: i.maxQty, full: true }));
                  setRefundItems(copy);
                }}
                sx={{ mb: 3 }}
              >
                Refund All Items
              </Button>

              {refundItems.map((ri, idx) => (
                <Paper key={idx} elevation={2} sx={{ p: 2, mb: 2, borderRadius: 2, border: `1px solid ${darkMode ? '#444' : '#e0e0e0'}` }}>
                  <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} sm={4}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{ri.productName}</Typography>
                      <Typography variant="body2" color="text.secondary">Max: {ri.maxQty} | Price: Rs. {ri.perPiecePrice.toLocaleString()}</Typography>
                    </Grid>
                    <Grid item xs={6} sm={2}>
                      <TextField
                        fullWidth
                        type="number"
                        label="Refund Qty"
                        value={ri.qty}
                        onChange={e => {
                          let v = Number(e.target.value);
                          if (isNaN(v)) v = 0;
                          if (v > ri.maxQty) v = ri.maxQty;
                          if (v < 0) v = 0;
                          const copy = [...refundItems];
                          copy[idx] = { ...ri, qty: v, full: v === ri.maxQty };
                          setRefundItems(copy);
                        }}
                        InputProps={{
                          inputProps: { min: 0, max: ri.maxQty, onWheel: e => e.target.blur() },
                        }}
                        sx={{
                          '& input[type=number]::-webkit-inner-spin-button, & input[type=number]::-webkit-outer-spin-button': {
                            '-webkit-appearance': 'none',
                            margin: 0
                          },
                          '& input[type=number]': {
                            '-moz-appearance': 'textfield'
                          }
                        }}
                        size="small"
                      />
                    </Grid>
                    <Grid item xs={6} sm={2}>
                      <Typography variant="body1" sx={{ fontWeight: 600, textAlign: 'center' }}>
                        Rs. {(ri.perPiecePrice * ri.qty).toLocaleString()}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            size="small"
                            checked={ri.full}
                            onChange={e => {
                              const copy = [...refundItems];
                              copy[idx] = { ...ri, full: e.target.checked, qty: e.target.checked ? ri.maxQty : 0 };
                              setRefundItems(copy);
                            }}
                          />
                        }
                        label="Refund All Quantity"
                      />
                    </Grid>
                  </Grid>
                </Paper>
              ))}

              <Typography variant="body2" color="text.secondary" sx={{ mt: 3, mb: 1, fontWeight: 600 }}>
                Refund Reason (optional):
              </Typography>
              <TextField
                fullWidth
                label="Reason (optional)"
                value={refundReason || ''}
                onChange={e => setRefundReason(e.target.value)}
                multiline
                rows={3}
                variant="outlined"
              />
            </DialogContent>
            <DialogActions sx={{ p: 2, bgcolor: darkMode ? '#1e1e1e' : '#f5f5f5' }}>
              <Button onClick={() => { setRefundModalOpen(false); setRefundItems([]); }}>Cancel</Button>
              <Button
                variant="contained"
                color="error"
                onClick={async () => {
                  try {
                    if (!editSale) { alert('No sale selected'); return; }
                    const token = localStorage.getItem('token');
                    const saleRes = await API.get(`/sales/${editSale._id}`, { headers: { Authorization: `Bearer ${token}` } });
                    const dbSale = saleRes.data;
                    const origMap = new Map();
                    (dbSale.items || []).forEach(it => { origMap.set(String(it.productId || it._id || ''), Number(it.quantity) || 0); });
                    const refundedSoFar = new Map();
                    (dbSale.refunds || []).forEach(r => {
                      (r.items || []).forEach(it => {
                        const k = String(it.productId || '');
                        refundedSoFar.set(k, (refundedSoFar.get(k) || 0) + (Number(it.quantity) || 0));
                      });
                    });
                    const payloadItems = [];
                    refundItems.forEach(ri => {
                      const maxRemain = Math.max(0, (origMap.get(String(ri.productId)) || 0) - (refundedSoFar.get(String(ri.productId)) || 0));
                      const qty = Math.min(Number(ri.qty) || 0, maxRemain);
                      if (qty > 0) {
                        payloadItems.push({ productId: ri.productId, SKU: ri.SKU, productName: ri.productName, quantity: qty });
                      }
                    });
                    if (payloadItems.length === 0) {
                      alert('No refundable quantity selected');
                      return;
                    }
                    const res = await API.post(`/sales/${editSale._id}/refund`, { items: payloadItems, reason: refundReason || 'Refund by seller' }, { headers: { Authorization: `Bearer ${token}` } });
                    if (res.data && res.data.success) {
                      try { window.dispatchEvent(new CustomEvent('products:changed')); } catch (e) { }
                      try { window.dispatchEvent(new CustomEvent('sales:changed', { detail: { id: editSale._id } })); } catch (e) { }
                      setRefundModalOpen(false);
                      setRefundItems([]);
                      setEditSale(null);
                      // refresh recent sales
                      try {
                        const payload = JSON.parse(atob(token.split('.')[1]));
                        const r = await API.get(`/sales?sellerId=${payload.id}&limit=10`, { headers: { Authorization: `Bearer ${token}` } });
                        setRecentSales(Array.isArray(r.data) ? (r.data.filter(s => (Number(s.totalQuantity) || Number(s.netAmount) || 0) > 0).slice(0, 10)) : []);
                      } catch (e) { }
                    } else {
                      alert(res.data?.message || 'Refund failed');
                    }
                  } catch (e) {
                    alert(e.response?.data?.message || e.message || 'Refund failed');
                  }
                }}
              >
                Process Refund
              </Button>
            </DialogActions>
          </Dialog>

          <Dialog open={warrantyModalOpen} onClose={() => setWarrantyModalOpen(false)} maxWidth="md" fullWidth>
            <DialogTitle sx={{ bgcolor: 'warning.main', color: 'white' }}>Claim Warranty</DialogTitle>
            <DialogContent sx={{ p: 3 }}>
              <Typography variant="body1" sx={{ mb: 2, fontWeight: 600 }}>
                Select quantities to claim under warranty for eligible items. Stock will be reduced accordingly.
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontWeight: 600 }}>
                Reason (optional):
              </Typography>
              <TextField
                fullWidth
                label="Reason (optional)"
                value={warrantyReason || ''}
                onChange={e => setWarrantyReason(e.target.value)}
                multiline
                rows={3}
                variant="outlined"
                sx={{ mb: 3 }}
              />
              {warrantyItems.map((it, idx) => (
                <Paper
                  key={`${it.productId || it.SKU || idx}`}
                  elevation={2}
                  sx={{ mb: 2, p: 2, borderRadius: 2, border: `1px solid ${darkMode ? '#444' : '#e0e0e0'}` }}
                >
                  <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} sm={6}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{it.productName || it.SKU || 'Product'}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Max Claimable: {it.maxQty}
                        {it.warrantyUntil && ` | Valid until: ${new Date(it.warrantyUntil).toLocaleDateString()}`}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Claim Quantity"
                        type="number"
                        value={it.qty || ''}
                        onChange={e => {
                          const val = Math.max(0, Math.min(Number(e.target.value) || 0, it.maxQty));
                          setWarrantyItems(prev =>
                            prev.map((row, i) => (i === idx ? { ...row, qty: val } : row))
                          );
                        }}
                        InputProps={{
                          inputProps: {
                            onWheel: (e) => e.target.blur(),
                            min: 0,
                            max: it.maxQty
                          }
                        }}
                        sx={{
                          '& input[type=number]::-webkit-inner-spin-button, & input[type=number]::-webkit-outer-spin-button': {
                            '-webkit-appearance': 'none',
                            margin: 0
                          },
                          '& input[type=number]': {
                            '-moz-appearance': 'textfield'
                          }
                        }}
                        size="small"
                      />
                    </Grid>
                  </Grid>
                </Paper>
              ))}
            </DialogContent>
            <DialogActions sx={{ p: 2, bgcolor: darkMode ? '#1e1e1e' : '#f5f5f5' }}>
              <Button onClick={() => setWarrantyModalOpen(false)}>Cancel</Button>
              <Button
                variant="contained"
                color="warning"
                onClick={async () => {
                  try {
                    if (!editSale) {
                      alert('No sale selected');
                      return;
                    }
                    const toSend = warrantyItems
                      .filter(i => Number(i.qty) > 0)
                      .map(i => ({
                        productId: i.productId,
                        SKU: i.SKU,
                        quantity: Number(i.qty)
                      }));
                    if (!toSend.length) {
                      alert('Please enter at least one quantity to claim.');
                      return;
                    }
                    const token = localStorage.getItem('token');
                    await API.post(
                      `/sales/${editSale._id}/warranty-claim`,
                      { items: toSend, reason: warrantyReason },
                      { headers: { Authorization: `Bearer ${token}` } }
                    );
                    setWarrantyModalOpen(false);
                    setSuccess('Warranty claim processed successfully.');
                  } catch (e) {
                    setError(e.response?.data?.message || e.response?.data?.error || 'Failed to process warranty claim');
                  }
                }}
              >
                Process Claim
              </Button>
            </DialogActions>
          </Dialog>

          {/* Confirm Delete Dialog for edit items */}
          <Dialog open={confirmDeleteIndex !== null} onClose={() => setConfirmDeleteIndex(null)}>
            <DialogTitle>Confirm Delete</DialogTitle>
            <DialogContent>
              <Typography>Are you sure you want to remove Item {confirmDeleteIndex !== null ? confirmDeleteIndex + 1 : ''}?</Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setConfirmDeleteIndex(null)}>Cancel</Button>
              <Button color="error" variant="contained" onClick={() => { removeEditItem(confirmDeleteIndex); setConfirmDeleteIndex(null); }}>Delete</Button>
            </DialogActions>
          </Dialog>

          <Dialog open={printPreviewOpen} onClose={() => setPrintPreviewOpen(false)} maxWidth="sm" fullWidth>
            <DialogTitle>Print Preview</DialogTitle>
            <DialogContent dividers>
              <div ref={previewRef} dangerouslySetInnerHTML={{ __html: printPreviewHtml }} />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setPrintPreviewOpen(false)}>Close</Button>
              <Button onClick={() => {
                const w = window.open('', '_blank');
                if (!w || !w.document) { alert('Popup blocked. Please allow popups or use the browser print.'); return; }
                w.document.write(printPreviewHtml);
                w.document.close();
                setTimeout(() => w.print(), 250);
              }} variant="contained">Print</Button>
            </DialogActions>
          </Dialog>
        </Box>
      </Paper>
    </Box>
  );
};

export default SellerSaleEntry;
