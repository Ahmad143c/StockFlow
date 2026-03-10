
import React, { useEffect, useMemo, useRef, useState } from 'react';
import API from '../api/api';
import { Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Button, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, TextField, InputAdornment, MenuItem, Select, InputLabel, FormControl, Divider, Grid, Chip } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useDarkMode } from '../context/DarkModeContext';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import SearchIcon from '@mui/icons-material/Search';
import PrintIcon from '@mui/icons-material/Print';
import jsPDF from 'jspdf';

const AdminPurchaseReport = () => {
  const { darkMode } = useDarkMode();
  const [currentDate] = useState(new Date());
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [page, setPage] = useState(0);
  const rowsPerPage = 10;
  // Highlight handling via URL param
  const [highlightPo, setHighlightPo] = useState('');
  const [highlightUntil, setHighlightUntil] = useState(0);
  const rowRefs = useRef({});

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const h = params.get('highlight');
    if (h) {
      setHighlightPo(h);
      setHighlightUntil(Date.now() + 6000); // blink for 6s
      // remove the param from URL without reloading
      const url = new URL(window.location.href);
      url.searchParams.delete('highlight');
      window.history.replaceState({}, '', url.toString());
    }
  }, []);

  // When orders are loaded and a highlight PO exists, move to the correct page and scroll into view
  useEffect(() => {
    if (!highlightPo || !orders || orders.length === 0) return;
    const idx = orders.findIndex(o => o.poNumber === highlightPo);
    if (idx === -1) return;
    const targetPage = Math.floor(idx / rowsPerPage);
    if (page !== targetPage) {
      setPage(targetPage);
      // delay to allow table to render new page
      setTimeout(() => {
        const el = rowRefs.current[highlightPo];
        if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    } else {
      const el = rowRefs.current[highlightPo];
      if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [orders, highlightPo, page]);
  const [editOpen, setEditOpen] = useState(false);
  const [editOrder, setEditOrder] = useState(null);
  const [showCashAmount, setShowCashAmount] = useState(false);
  const [showNetDueDate, setShowNetDueDate] = useState(false);
  const [netDueDate, setNetDueDate] = useState('');
  const [remainingDays, setRemainingDays] = useState(0);
  const [search, setSearch] = useState('');
  const [vendors, setVendors] = useState([]);
  const [vendorFilter, setVendorFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  

  // Responsive helpers
  const theme = useTheme();
  const isSm = useMediaQuery(theme.breakpoints.down('sm'));
  const isMd = useMediaQuery(theme.breakpoints.down('md'));
  const cellSx = {
    maxWidth: isSm ? 120 : isMd ? 160 : 240,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  };
  const defaultUOM = ['pieces', 'boxes', 'kg', 'liters'];
  const defaultStatus = ['Pending', 'Approved', 'Received', 'Partially Received', 'Cancelled'];
  const paymentTermsOptions = ['Net 30', 'Net 60', 'COD', 'Advance Payment', 'Partial Payment', 'Cash Payment'];
  const paymentMethodOptions = ['Bank Transfer', 'Cheque', 'Cash Payment'];
  const defaultDeliveryMethods = ['Courier', 'In-house transport'];
  const defaultPurchaseTypes = ['Local', 'International'];
  const defaultCurrency = ['PKR', 'DOLLAR', 'YAN'];

  // Calculate due date and remaining days for Net payment terms
  const calculateNetDueDate = (paymentTerms, poDate) => {
    if (!paymentTerms || !poDate || !['Net 30', 'Net 60'].includes(paymentTerms)) {
      setShowNetDueDate(false);
      return;
    }
    
    const dueDate = new Date(poDate);
    const daysToAdd = paymentTerms === 'Net 30' ? 30 : 60;
    dueDate.setDate(dueDate.getDate() + daysToAdd);
    
    // Format date as YYYY-MM-DD
    const formattedDate = dueDate.toISOString().split('T')[0];
    setNetDueDate(formattedDate);
    
    // Calculate remaining days
    const today = new Date();
    const diffTime = dueDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    setRemainingDays(diffDays);
    
    setShowNetDueDate(true);
  };

  // Check if cash amount should be shown based on payment terms and due date
  const checkShowCashAmount = (paymentTerms, poDate) => {
    if (!paymentTerms || !poDate) return false;
    
    const dueDate = new Date(poDate);
    
    if (paymentTerms === 'Net 30') {
      dueDate.setDate(dueDate.getDate() + 30);
    } else if (paymentTerms === 'Net 60') {
      dueDate.setDate(dueDate.getDate() + 60);
    } else {
      setShowNetDueDate(false);
      return false;
    }
    
    const isPastDue = currentDate >= dueDate;
    calculateNetDueDate(paymentTerms, poDate);
    return isPastDue;
  };

  // Update payment-related states when editOrder changes
  useEffect(() => {
    if (editOrder) {
      const showCash = checkShowCashAmount(editOrder.paymentTerms, editOrder.poDate);
      setShowCashAmount(showCash);
      
      if (['Net 30', 'Net 60'].includes(editOrder.paymentTerms) && editOrder.poDate) {
        calculateNetDueDate(editOrder.paymentTerms, editOrder.poDate);
      }
    }
  }, [editOrder]);
  // Delete PO
  const handleDelete = async (orderId) => {
    if (window.confirm('Are you sure you want to delete this Purchase Order?')) {
      await API.delete(`/purchase-orders/${orderId}`);
      setOrders(orders.filter(o => o._id !== orderId));
      setFilteredOrders(filteredOrders.filter(o => o._id !== orderId));
    }
  };

  // Fetch vendors
  useEffect(() => {
    const token = localStorage.getItem('token');
    API.get('/vendors', {
      headers: { Authorization: `Bearer ${token}` }
    }).then(res => setVendors(res.data)).catch(() => setVendors([]));
  }, []);

  // Fetch purchase orders (list), then hydrate with full details per PO
  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const res = await API.get('/purchase-orders');
        const list = Array.isArray(res.data) ? res.data : [];
        setOrders(list);
        setFilteredOrders(list);

        // Fetch full details for each PO to populate all table cells
        const detailed = await Promise.all(
          list.map(async (o) => {
            try {
              const r = await API.get(`/purchase-orders/${o._id}`);
              return r.data || o;
            } catch {
              return o;
            }
          })
        );

        setOrders(detailed);
        setFilteredOrders(detailed);
      } catch (e) {
        // Keep empty/default state on error
        setOrders([]);
        setFilteredOrders([]);
      }
    };
    fetchOrders();
  }, []);

  useEffect(() => {
    // Apply combined filters: text search, vendor, status, start/end date
    let f = Array.isArray(orders) ? [...orders] : [];

    // Text search across PO number, vendor name, status, and date string
    if (search) {
      const q = search.toLowerCase();
      f = f.filter(order => (
        (order.poNumber || '').toLowerCase().includes(q) ||
        (order.vendorName || '').toLowerCase().includes(q) ||
        (order.orderStatus || '').toLowerCase().includes(q) ||
        (order.poDate || '').toLowerCase().includes(q)
      ));
    }

    // Vendor filter
    if (vendorFilter) {
      f = f.filter(o => (o.vendorName || '').toLowerCase() === vendorFilter.toLowerCase());
    }

    // Status filter
    if (statusFilter) {
      f = f.filter(o => (o.orderStatus || '').toLowerCase() === statusFilter.toLowerCase());
    }

    // Date range filters (inclusive)
    if (startDate) {
      f = f.filter(o => {
        if (!o.poDate) return false;
        const created = new Date(o.poDate);
        return created >= new Date(startDate + 'T00:00:00');
      });
    }
    if (endDate) {
      f = f.filter(o => {
        if (!o.poDate) return false;
        const created = new Date(o.poDate);
        return created <= new Date(endDate + 'T23:59:59');
      });
    }

    setFilteredOrders(f);
    setPage(0);
  }, [search, orders, vendorFilter, statusFilter, startDate, endDate]);

  // Helper function to format datetime for datetime-local input
  const formatDateTimeForInput = (dateTime) => {
    if (!dateTime) return '';
    try {
      const date = new Date(dateTime);
      // Convert to local datetime string format YYYY-MM-DDTHH:MM
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    } catch {
      return '';
    }
  };

  const handleEdit = async order => {
    try {
      // Fetch the full PO data with all fields
      const response = await API.get(`/purchase-orders/${order._id}`);
      const fullOrder = response.data;
      
      // Ensure all required fields are present with default values if missing
      const updatedOrder = {
        ...fullOrder,
        poDate: fullOrder.poDate ? fullOrder.poDate.split('T')[0] : new Date().toISOString().split('T')[0],
        expectedDeliveryDate: fullOrder.expectedDeliveryDate ? fullOrder.expectedDeliveryDate.split('T')[0] : '',
        orderStatus: fullOrder.orderStatus || 'Pending',
        paymentStatus: fullOrder.paymentStatus || 'Unpaid',
        paymentTerms: fullOrder.paymentTerms || 'Net 30',
        paymentMethod: fullOrder.paymentMethod || 'Bank Transfer',
        purchaseType: fullOrder.purchaseType || 'Local',
        currency: fullOrder.currency || 'PKR',
        items: fullOrder.items?.map(item => ({
          ...item,
          quantityOrdered: item.quantityOrdered || 0,
          perPiecePrice: item.perPiecePrice || 0,
          unitPrice: item.unitPrice || 0,
          tax: item.tax || 0,
          discount: item.discount || 0,
          uom: item.uom || 'pieces'
        })) || [],
        vendorName: fullOrder.vendorName || '',
        vendorId: fullOrder.vendorId || '',
        vendorAddress: fullOrder.vendorAddress || '',
        vendorPhone: fullOrder.vendorPhone || '',
        vendorEmail: fullOrder.vendorEmail || '',
        shipToName: fullOrder.shipToName || '',
        shipToPhone: fullOrder.shipToPhone || '',
        shipToEmail: fullOrder.shipToEmail || '',
        shipToAddress: fullOrder.shipToAddress || '',
        deliveryMethod: fullOrder.deliveryMethod || '',
        deliveryLocation: fullOrder.deliveryLocation || '',
        reference: fullOrder.reference || '',
        subtotal: fullOrder.subtotal || 0,
        taxTotal: fullOrder.taxTotal || 0,
        discountTotal: fullOrder.discountTotal || 0,
        shippingCharges: fullOrder.shippingCharges || 0,
        grandTotal: fullOrder.grandTotal || 0,
        advanceAmount: fullOrder.advanceAmount || 0,
        advanceDateTime: formatDateTimeForInput(fullOrder.advancePaymentDateTime || fullOrder.advanceDateTime),
        initialPayment: fullOrder.initialPayment || 0,
        initialPaymentDateTime: formatDateTimeForInput(fullOrder.initialPaymentDateTime),
        finalPayment: fullOrder.finalPayment || 0,
        finalPaymentDateTime: formatDateTimeForInput(fullOrder.finalPaymentDateTime),
        cashPaid: fullOrder.cashPaid || 0,
        cashPaymentDateTime: formatDateTimeForInput(fullOrder.cashPaymentDateTime),
        attachments: fullOrder.attachments || []
      };
      
      setEditOrder(updatedOrder);
      setEditOpen(true);
    } catch (error) {
      console.error('Error fetching PO details:', error);
      // Fallback to the original order data if API call fails
      setEditOrder({
        ...order,
        poDate: order.poDate ? order.poDate.split('T')[0] : new Date().toISOString().split('T')[0],
        expectedDeliveryDate: order.expectedDeliveryDate ? order.expectedDeliveryDate.split('T')[0] : ''
      });
      setEditOpen(true);
    }
  };

  const handleEditChange = e => {
    const { name, value } = e.target;
    const updatedOrder = { ...editOrder, [name]: value };

    // Handle items array updates and recalculate totals
    if (name === 'items') {
      const items = value;
      let subtotal = 0, taxTotal = 0, discountTotal = 0;
      
      items.forEach(item => {
        const qty = Number(item.quantityOrdered) || 0;
        const perPiece = Number(item.perPiecePrice) || 0;
        const itemSubtotal = qty * perPiece;
        
        item.unitPrice = itemSubtotal.toFixed(2);
        
        subtotal += itemSubtotal;
        taxTotal += Number(item.tax) || 0;
        discountTotal += Number(item.discount) || 0;
      });
      
      const shipping = Number(updatedOrder.shippingCharges) || 0;
      const grandTotal = subtotal + taxTotal - discountTotal + shipping;
      
      updatedOrder.items = items;
      updatedOrder.subtotal = subtotal.toFixed(2);
      updatedOrder.taxTotal = taxTotal.toFixed(2);
      updatedOrder.discountTotal = discountTotal.toFixed(2);
      updatedOrder.grandTotal = grandTotal.toFixed(2);
    }

    // Calculate remaining payment when payments change
    if (['advanceAmount', 'initialPayment', 'finalPayment', 'paymentTerms', 'grandTotal'].includes(name)) {
      const grandTotal = Number(updatedOrder.grandTotal || 0);
      const advanceAmount = name === 'advanceAmount' ? Number(value || 0) : Number(editOrder.advanceAmount || 0);
      const initialPayment = name === 'initialPayment' ? Number(value || 0) : Number(editOrder.initialPayment || 0);
      const finalPayment = name === 'finalPayment' ? Number(value || 0) : Number(editOrder.finalPayment || 0);
      
      // Calculate total paid and remaining payment
      const totalPaid = advanceAmount + initialPayment + finalPayment;
      const remainingPayment = Math.max(0, grandTotal - totalPaid);
      
      updatedOrder.remainingPayment = remainingPayment.toFixed(2);

      // Auto-fill payment date/time if not set
      const now = new Date().toISOString().slice(0, 16);
      if (name === 'advanceAmount' && value > 0 && !updatedOrder.advanceDateTime) {
        updatedOrder.advanceDateTime = now;
      }
      if (name === 'initialPayment' && value > 0 && !updatedOrder.initialPaymentDateTime) {
        updatedOrder.initialPaymentDateTime = now;
      }
      if (name === 'finalPayment' && value > 0 && !updatedOrder.finalPaymentDateTime) {
        updatedOrder.finalPaymentDateTime = now;
      }

      // Update payment status based on remaining payment
      if (totalPaid === 0) {
        updatedOrder.paymentStatus = 'Unpaid';
      } else if (remainingPayment <= 0) {
        updatedOrder.paymentStatus = 'Paid';
      } else {
        updatedOrder.paymentStatus = 'Partially Paid';
      }
    }
    
    // Handle numeric fields
    if (['shippingCharges', 'advanceAmount', 'initialPayment', 'cashAmount'].includes(name)) {
      updatedOrder[name] = parseFloat(value) || 0;
      
      // Recalculate grand total if shipping charges change
      if (name === 'shippingCharges') {
        const subtotal = parseFloat(updatedOrder.subtotal) || 0;
        const taxTotal = parseFloat(updatedOrder.taxTotal) || 0;
        const discountTotal = parseFloat(updatedOrder.discountTotal) || 0;
        updatedOrder.grandTotal = (subtotal + taxTotal - discountTotal + parseFloat(value || 0)).toFixed(2);
      }
    }
    
    // Handle payment terms and date changes
    if (name === 'paymentTerms' || name === 'poDate') {
      const paymentTerms = name === 'paymentTerms' ? value : updatedOrder.paymentTerms;
      const poDate = name === 'poDate' ? value : updatedOrder.poDate;
      
      setShowCashAmount(checkShowCashAmount(paymentTerms, poDate));
      
      // Update due date if payment terms are Net 30/60
      if (['Net 30', 'Net 60'].includes(paymentTerms) && poDate) {
        calculateNetDueDate(paymentTerms, poDate);
      } else {
        setShowNetDueDate(false);
      }
    }
    
    setEditOrder(updatedOrder);
  };

  // Helper function to convert datetime-local format to ISO string
  const convertToISOString = (dateTimeStr) => {
    if (!dateTimeStr) return '';
    try {
      const date = new Date(dateTimeStr);
      return date.toISOString();
    } catch {
      return '';
    }
  };

  const handleEditSave = async () => {
    try {
      const token = localStorage.getItem('token');
      
      // Prepare the data to send, converting datetime-local format to ISO strings
      const dataToSend = {
        ...editOrder,
        advancePaymentDateTime: convertToISOString(editOrder.advanceDateTime),
        initialPaymentDateTime: convertToISOString(editOrder.initialPaymentDateTime),
        finalPaymentDateTime: convertToISOString(editOrder.finalPaymentDateTime),
        cashPaymentDateTime: convertToISOString(editOrder.cashPaymentDateTime)
      };
      
      // Send the update request with authorization header
      const response = await API.put(
        `/purchase-orders/${editOrder._id}`,
        dataToSend,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data) {
        // Update local state with the returned data from server
        const updatedOrder = response.data;
        setOrders(orders.map(order => 
          order._id === updatedOrder._id ? updatedOrder : order
        ));
        setFilteredOrders(filteredOrders.map(order => 
          order._id === updatedOrder._id ? updatedOrder : order
        ));
        setEditOpen(false);
        // Show success message
        alert('Purchase Order updated successfully');
      }
    } catch (error) {
      console.error('Error updating order:', error);
      // Show error message to user
      alert(error.response?.data?.message || 'Error updating purchase order. Please try again.');
    }
  };

  // Calculate due date based on payment terms and PO date
  const calculateDueDate = (paymentTerms, poDate) => {
    if (!poDate || !['Net 30', 'Net 60'].includes(paymentTerms)) return '';
    
    const date = new Date(poDate);
    const daysToAdd = paymentTerms === 'Net 30' ? 30 : 60;
    date.setDate(date.getDate() + daysToAdd);
    return date.toISOString().split('T')[0];
  };

  // Calculate totals for edit dialog
  const calculateDialogTotals = () => {
    let subtotal = 0, taxTotal = 0, discountTotal = 0;
    if (editOrder?.items) {
      editOrder.items.forEach(item => {
        const price = Number(item.unitPrice) || 0;
        const tax = Number(item.tax) || 0;
        const discount = Number(item.discount) || 0;
        subtotal += price;
        taxTotal += tax;
        discountTotal += discount;
      });
    }
    const shipping = Number(editOrder?.shippingCharges) || 0;
    const grandTotal = subtotal + taxTotal - discountTotal + shipping;
    return { subtotal, taxTotal, discountTotal, grandTotal };
  };

  // Handle file uploads in edit dialog
  const handleEditFileUpload = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('image', file);
    
    try {
      const response = await fetch('http://localhost:5000/api/upload', {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) throw new Error('Upload failed');
      const data = await response.json();
      
      // Update the editOrder state with the new file URL, replacing any existing file
      setEditOrder(prev => ({
        ...prev,
        [type]: data.url,
        // Replace the old file with the new one instead of appending
        attachments: prev.attachments 
          ? prev.attachments.filter(url => !url.includes(type)) // Remove old file of same type
          : []
      }));
    } catch (error) {
      console.error('File upload error:', error);
    }
  };

  // Dialog content for editing PO
  const renderEditDialog = () => (
    <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="xl" fullWidth>
      <DialogTitle sx={{ bgcolor: 'primary.main', color: 'white', display: 'flex', alignItems: 'center' }}>
        <Typography variant="h5" component="div" sx={{ flexGrow: 1 }}>Edit Purchase Order</Typography>
      </DialogTitle>
      <DialogContent sx={{ p: 3 }}>
        <Grid container spacing={3}>
          {/* Basic PO Information */}
          <Grid item xs={12}>
            <Paper elevation={3} sx={{ p: 2, mb: 2, bgcolor: '#f8f9fa' }}>
              <Typography variant="h6" sx={{ mb: 2, color: 'primary.main' }}>Basic Information</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={3}>
                  <TextField
                    fullWidth
                    name="poNumber"
                    label="PO Number"
                    value={editOrder?.poNumber || ''}
                    onChange={handleEditChange}
                    disabled
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField
                    fullWidth
                    type="date"
                    name="poDate"
                    label="PO Date"
                    value={editOrder?.poDate || ''}
                    onChange={handleEditChange}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <FormControl fullWidth>
                    <InputLabel>Order Status</InputLabel>
                    <Select
                      name="orderStatus"
                      value={editOrder?.orderStatus || 'Pending'}
                      onChange={handleEditChange}
                      label="Order Status"
                    >
                      {defaultStatus.map(status => (
                        <MenuItem key={status} value={status}>{status}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={3}>
                  <FormControl fullWidth>
                    <InputLabel>Payment Status</InputLabel>
                    <Select
                      name="paymentStatus"
                      value={editOrder?.paymentStatus || 'Unpaid'}
                      onChange={handleEditChange}
                      label="Payment Status"
                    >
                      <MenuItem value="Unpaid">Unpaid</MenuItem>
                      <MenuItem value="Partially Paid">Partially Paid</MenuItem>
                      <MenuItem value="Paid">Paid</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={3}>
                  <FormControl fullWidth>
                    <InputLabel>Payment Terms</InputLabel>
                    <Select
                      name="paymentTerms"
                      value={editOrder?.paymentTerms || ''}
                      onChange={(e) => {
                        const newValue = e.target.value;
                        const newDueDate = calculateDueDate(newValue, editOrder?.poDate);
                        handleEditChange({
                          target: {
                            name: 'paymentTerms',
                            value: newValue
                          }
                        });
                        if (newDueDate) {
                          handleEditChange({
                            target: {
                              name: 'dueDate',
                              value: newDueDate
                            }
                          });
                        }
                      }}
                      label="Payment Terms"
                    >
                      <MenuItem value="Net 30">Net 30</MenuItem>
                      <MenuItem value="Net 60">Net 60</MenuItem>
                      <MenuItem value="COD">COD</MenuItem>
                      <MenuItem value="Advance Payment">Advance Payment</MenuItem>
                      <MenuItem value="Partial Payment">Partial Payment</MenuItem>
                      <MenuItem value="Cash Payment">Cash Payment</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                {['Net 30', 'Net 60'].includes(editOrder?.paymentTerms) && (
                  <Grid item xs={12} sm={3}>
                    <TextField
                      fullWidth
                      label="Due Date"
                      name="dueDate"
                      value={editOrder?.dueDate || ''}
                      type="date"
                      InputLabelProps={{ shrink: true }}
                      InputProps={{ readOnly: true }}
                    />
                  </Grid>
                )}
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    name="reference"
                    label="Reference/Notes"
                    value={editOrder?.reference || ''}
                    onChange={handleEditChange}
                    multiline
                    rows={2}
                  />
                </Grid>
              </Grid>
            </Paper>
          </Grid>

          {/* Vendor Information Section */}
          <Grid item xs={12}>
            <Paper elevation={3} sx={{ p: 2, mb: 2, bgcolor: '#f8f9fa' }}>
              <Typography variant="h6" sx={{ mb: 2, color: 'primary.main' }}>Vendor Information</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Vendor</InputLabel>
                    <Select
                      name="vendorName"
                      value={editOrder?.vendorName || ''}
                      onChange={handleEditChange}
                      label="Vendor"
                    >
                      {vendors?.map(vendor => (
                        <MenuItem key={vendor._id} value={vendor.vendorName}>
                          {vendor.vendorName}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    name="vendorId"
                    label="Vendor ID"
                    value={editOrder?.vendorId || ''}
                    InputProps={{ readOnly: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    name="vendorPhone"
                    label="Vendor Phone"
                    value={editOrder?.vendorPhone || ''}
                    onChange={handleEditChange}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    name="vendorEmail"
                    label="Vendor Email"
                    value={editOrder?.vendorEmail || ''}
                    onChange={handleEditChange}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    name="vendorAddress"
                    label="Vendor Address"
                    value={editOrder?.vendorAddress || ''}
                    onChange={handleEditChange}
                    multiline
                    rows={2}
                  />
                </Grid>
              </Grid>
            </Paper>
          </Grid>

          {/* Ship To & Delivery Information Section */}
          <Grid item xs={12}>
            <Paper elevation={3} sx={{ p: 2, mb: 2, bgcolor: '#f8f9fa' }}>
              <Typography variant="h6" sx={{ mb: 2, color: 'primary.main' }}>Ship To & Delivery Information</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    name="shipToName"
                    label="Ship To Name"
                    value={editOrder?.shipToName || ''}
                    onChange={handleEditChange}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    name="shipToPhone"
                    label="Ship To Phone"
                    value={editOrder?.shipToPhone || ''}
                    onChange={handleEditChange}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    name="shipToEmail"
                    label="Ship To Email"
                    value={editOrder?.shipToEmail || ''}
                    onChange={handleEditChange}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    type="date"
                    name="expectedDeliveryDate"
                    label="Expected Delivery Date"
                    value={editOrder?.expectedDeliveryDate || ''}
                    onChange={handleEditChange}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    name="shipToAddress"
                    label="Ship To Address"
                    value={editOrder?.shipToAddress || ''}
                    onChange={handleEditChange}
                    multiline
                    rows={2}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Delivery Method</InputLabel>
                    <Select
                      name="deliveryMethod"
                      value={editOrder?.deliveryMethod || ''}
                      onChange={handleEditChange}
                      label="Delivery Method"
                    >
                      {defaultDeliveryMethods.map(method => (
                        <MenuItem key={method} value={method}>{method}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    name="deliveryLocation"
                    label="Delivery Location"
                    value={editOrder?.deliveryLocation || ''}
                    onChange={handleEditChange}
                  />
                </Grid>
              </Grid>
            </Paper>
          </Grid>

          {/* Line Items Section */}
          <Grid item xs={12}>
            <Paper elevation={3} sx={{ p: 2, mb: 2, bgcolor: '#f8f9fa' }}>
              <Typography variant="h6" sx={{ mb: 2, color: 'primary.main' }}>Line Items</Typography>
              {editOrder?.items?.map((item, idx) => (
                <Box key={idx} sx={{ mb: 3, p: 2, border: '1px solid #e0e0e0', borderRadius: 2, bgcolor: '#fafafa' }}>
                  <Divider sx={{ mb: 2 }}>
                    <Chip label={`Item ${idx + 1}`} size="small" />
                  </Divider>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6} md={3}>
                      <TextField
                        fullWidth
                        name="itemCode"
                        label="Item Code"
                        value={item.itemCode || ''}
                        onChange={(e) => {
                          const items = [...editOrder.items];
                          items[idx] = { ...items[idx], itemCode: e.target.value };
                          handleEditChange({ target: { name: 'items', value: items }});
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <TextField
                        fullWidth
                        name="itemName"
                        label="Item Name"
                        value={item.itemName || ''}
                        onChange={(e) => {
                          const items = [...editOrder.items];
                          items[idx] = { ...items[idx], itemName: e.target.value };
                          handleEditChange({ target: { name: 'items', value: items }});
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={2}>
                      <TextField
                        fullWidth
                        name="quantityOrdered"
                        label="Quantity"
                        type="number"
                        value={item.quantityOrdered || ''}
                        onChange={(e) => {
                          const items = [...editOrder.items];
                          const qty = Number(e.target.value) || 0;
                          const perPiece = Number(items[idx].perPiecePrice) || 0;
                          items[idx] = { 
                            ...items[idx], 
                            quantityOrdered: e.target.value,
                            unitPrice: (qty * perPiece).toFixed(2)
                          };
                          handleEditChange({ target: { name: 'items', value: items }});
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={2}>
                      <FormControl fullWidth>
                        <InputLabel>UOM</InputLabel>
                        <Select
                          name="uom"
                          value={item.uom || ''}
                          label="UOM"
                          onChange={(e) => {
                            const items = [...editOrder.items];
                            items[idx] = { ...items[idx], uom: e.target.value };
                            handleEditChange({ target: { name: 'items', value: items }});
                          }}
                        >
                          {defaultUOM.map(u => (
                            <MenuItem key={u} value={u}>{u}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={6} md={2}>
                      <TextField
                        fullWidth
                        name="perPiecePrice"
                        label="Per Piece Price"
                        type="number"
                        value={item.perPiecePrice || ''}
                        onChange={(e) => {
                          const items = [...editOrder.items];
                          const perPiece = Number(e.target.value) || 0;
                          const qty = Number(items[idx].quantityOrdered) || 0;
                          items[idx] = { 
                            ...items[idx], 
                            perPiecePrice: e.target.value,
                            unitPrice: (qty * perPiece).toFixed(2)
                          };
                          handleEditChange({ target: { name: 'items', value: items }});
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={2}>
                      <TextField
                        fullWidth
                        name="tax"
                        label="Tax"
                        type="number"
                        value={item.tax || ''}
                        onChange={(e) => {
                          const items = [...editOrder.items];
                          items[idx] = { ...items[idx], tax: e.target.value };
                          handleEditChange({ target: { name: 'items', value: items }});
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={2}>
                      <TextField
                        fullWidth
                        name="discount"
                        label="Discount"
                        type="number"
                        value={item.discount || ''}
                        onChange={(e) => {
                          const items = [...editOrder.items];
                          items[idx] = { ...items[idx], discount: e.target.value };
                          handleEditChange({ target: { name: 'items', value: items }});
                        }}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        name="unitPrice"
                        label="Total Item Price (Calculated)"
                        type="number"
                        value={item.unitPrice || '0.00'}
                        InputProps={{ 
                          readOnly: true,
                          sx: { fontWeight: 'bold', color: 'primary.main' }
                        }}
                      />
                    </Grid>
                  </Grid>
                </Box>
              ))}
            </Paper>
          </Grid>

          {/* Payment Section */}
          <Grid item xs={12} md={6}>
            <Paper elevation={3} sx={{ p: 2, mb: 2, bgcolor: '#f8f9fa', height: '100%' }}>
              <Typography variant="h6" sx={{ mb: 2, color: 'primary.main' }}>Payment Details</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Payment Method</InputLabel>
                    <Select
                      name="paymentMethod"
                      value={editOrder?.paymentMethod || ''}
                      onChange={handleEditChange}
                      label="Payment Method"
                    >
                      {paymentMethodOptions.map(method => (
                        <MenuItem key={method} value={method}>{method}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Currency</InputLabel>
                    <Select
                      name="currency"
                      value={editOrder?.currency || 'PKR'}
                      onChange={handleEditChange}
                      label="Currency"
                    >
                      {defaultCurrency.map(curr => (
                        <MenuItem key={curr} value={curr}>{curr}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                {/* Conditional Payment Fields based on Payment Terms */}
                {editOrder?.paymentTerms === 'Advance Payment' && (
                  <>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        type="number"
                        name="advanceAmount"
                        label="Advance Amount"
                        value={editOrder?.advanceAmount || ''}
                        onChange={handleEditChange}
                        InputProps={{
                          startAdornment: <InputAdornment position="start">{editOrder?.currency || 'PKR'}</InputAdornment>
                        }}
                      />
                    </Grid>
                    
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        type="datetime-local"
                        name="advanceDateTime"
                        label="Advance Date & Time"
                        value={editOrder?.advanceDateTime || ''}
                        onChange={handleEditChange}
                        InputLabelProps={{ shrink: true }}
                        disabled={!editOrder?.advanceAmount}
                      />
                    </Grid>

                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        type="number"
                        name="finalPayment"
                        label="Final Payment"
                        value={editOrder?.finalPayment || ''}
                        onChange={handleEditChange}
                        InputProps={{
                          startAdornment: <InputAdornment position="start">{editOrder?.currency || 'PKR'}</InputAdornment>
                        }}
                      />
                    </Grid>
                    
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        type="datetime-local"
                        name="finalPaymentDateTime"
                        label="Final Payment Date & Time"
                        value={editOrder?.finalPaymentDateTime || ''}
                        onChange={handleEditChange}
                        InputLabelProps={{ shrink: true }}
                        disabled={!editOrder?.finalPayment}
                      />
                    </Grid>

                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        type="number"
                        name="remainingPayment"
                        label="Remaining Payment"
                        value={editOrder?.remainingPayment || (editOrder?.grandTotal - (editOrder?.advanceAmount || 0)).toFixed(2)}
                        InputProps={{
                          readOnly: true,
                          startAdornment: <InputAdornment position="start">{editOrder?.currency || 'PKR'}</InputAdornment>
                        }}
                      />
                    </Grid>
                  </>
                )}

                {editOrder?.paymentTerms === 'Partial Payment' && (
                  <>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        type="number"
                        name="initialPayment"
                        label="Initial Payment"
                        value={editOrder?.initialPayment || ''}
                        onChange={handleEditChange}
                        InputProps={{
                          startAdornment: <InputAdornment position="start">{editOrder?.currency || 'PKR'}</InputAdornment>
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        type="datetime-local"
                        name="initialPaymentDateTime"
                        label="Initial Payment Date & Time"
                        value={editOrder?.initialPaymentDateTime || ''}
                        onChange={handleEditChange}
                        InputLabelProps={{ shrink: true }}
                        disabled={!editOrder?.initialPayment}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        type="number"
                        name="finalPayment"
                        label="Final Payment"
                        value={editOrder?.finalPayment || ''}
                        onChange={handleEditChange}
                        InputProps={{
                          startAdornment: <InputAdornment position="start">{editOrder?.currency || 'PKR'}</InputAdornment>
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        type="datetime-local"
                        name="finalPaymentDateTime"
                        label="Final Payment Date & Time"
                        value={editOrder?.finalPaymentDateTime || ''}
                        onChange={handleEditChange}
                        InputLabelProps={{ shrink: true }}
                        disabled={!editOrder?.finalPayment}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        type="number"
                        name="remainingPayment"
                        label="Remaining Payment"
                        value={editOrder?.remainingPayment || editOrder?.grandTotal || '0.00'}
                        InputProps={{
                          readOnly: true,
                          startAdornment: <InputAdornment position="start">{editOrder?.currency || 'PKR'}</InputAdornment>
                        }}
                      />
                    </Grid>
                  </>
                )}

                {editOrder?.paymentTerms === 'Cash Payment' && (
                  <>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        type="number"
                        name="cashPaid"
                        label="Cash Paid"
                        value={editOrder?.cashPaid || ''}
                        onChange={handleEditChange}
                        InputProps={{
                          startAdornment: <InputAdornment position="start">{editOrder?.currency || 'PKR'}</InputAdornment>
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        type="datetime-local"
                        name="cashPaymentDateTime"
                        label="Cash Payment Date & Time"
                        value={editOrder?.cashPaymentDateTime || ''}
                        onChange={handleEditChange}
                        InputLabelProps={{ shrink: true }}
                        disabled={!editOrder?.cashPaid}
                      />
                    </Grid>
                  </>
                )}

                {/* File Upload Fields based on Payment Method */}
                {editOrder?.paymentMethod === 'Bank Transfer' && (
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      type="file"
                      name="bankReceipt"
                      label="Upload Bank Receipt"
                      onChange={(e) => handleEditFileUpload(e, 'bankReceipt')}
                      InputLabelProps={{ shrink: true }}
                      inputProps={{ accept: '.png,.jpg,.jpeg,.pdf' }}
                    />
                    {editOrder?.bankReceipt && (
                      <Button
                        size="small"
                        onClick={() => window.open(editOrder.bankReceipt, '_blank')}
                        sx={{ mt: 1 }}
                      >
                        View Receipt
                      </Button>
                    )}
                  </Grid>
                )}

                {editOrder?.paymentMethod === 'Cheque' && (
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      type="file"
                      name="chequeReceipt"
                      label="Upload Cheque"
                      onChange={(e) => handleEditFileUpload(e, 'chequeReceipt')}
                      InputLabelProps={{ shrink: true }}
                      inputProps={{ accept: '.png,.jpg,.jpeg,.pdf' }}
                    />
                    {editOrder?.chequeReceipt && (
                      <Button
                        size="small"
                        onClick={() => window.open(editOrder.chequeReceipt, '_blank')}
                        sx={{ mt: 1 }}
                      >
                        View Cheque
                      </Button>
                    )}
                  </Grid>
                )}
              </Grid>
            </Paper>
          </Grid>

          {/* Totals Section */}
          <Grid item xs={12} md={6}>
            <Paper elevation={3} sx={{ p: 2, mb: 2, bgcolor: '#f8f9fa', height: '100%' }}>
              <Typography variant="h6" sx={{ mb: 2, color: 'primary.main' }}>Order Totals</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Subtotal"
                    value={editOrder?.subtotal || 0}
                    InputProps={{
                      readOnly: true,
                      startAdornment: <InputAdornment position="start">{editOrder?.currency || 'PKR'}</InputAdornment>
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Tax Total"
                    value={editOrder?.taxTotal || 0}
                    InputProps={{
                      readOnly: true,
                      startAdornment: <InputAdornment position="start">{editOrder?.currency || 'PKR'}</InputAdornment>
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    name="shippingCharges"
                    label="Shipping Charges"
                    type="number"
                    value={editOrder?.shippingCharges || ''}
                    onChange={handleEditChange}
                    InputProps={{
                      startAdornment: <InputAdornment position="start">{editOrder?.currency || 'PKR'}</InputAdornment>
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Discount Total"
                    value={editOrder?.discountTotal || 0}
                    InputProps={{
                      readOnly: true,
                      startAdornment: <InputAdornment position="start">{editOrder?.currency || 'PKR'}</InputAdornment>
                    }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Grand Total"
                    value={editOrder?.grandTotal || 0}
                    InputProps={{
                      readOnly: true,
                      startAdornment: <InputAdornment position="start">{editOrder?.currency || 'PKR'}</InputAdornment>,
                      sx: { 
                        '& input': {
                          fontWeight: 'bold',
                          fontSize: '1.2rem',
                          color: 'primary.main'
                        }
                      }
                    }}
                  />
                </Grid>
              </Grid>
            </Paper>
          </Grid>

          {/* Additional Information */}
          <Grid item xs={12}>
            <Paper elevation={3} sx={{ p: 2, mb: 2, bgcolor: '#f8f9fa' }}>
              <Typography variant="h6" sx={{ mb: 2, color: 'primary.main' }}>Additional Information</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    name="createdBy"
                    label="Created by"
                    value={editOrder?.createdBy || ''}
                    onChange={handleEditChange}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    name="approvedBy"
                    label="Approved by"
                    value={editOrder?.approvedBy || ''}
                    onChange={handleEditChange}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <FormControl fullWidth>
                    <InputLabel>Purchase Type</InputLabel>
                    <Select
                      name="purchaseType"
                      value={editOrder?.purchaseType || 'Local'}
                      onChange={handleEditChange}
                      label="Purchase Type"
                    >
                      {defaultPurchaseTypes.map(type => (
                        <MenuItem key={type} value={type}>{type}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </Paper>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ p: 3, bgcolor: '#f8f9fa' }}>
        <Button onClick={() => setEditOpen(false)} variant="outlined" color="secondary">
          Cancel
        </Button>
        <Button onClick={handleEditSave} variant="contained" color="primary">
          Save Changes
        </Button>
      </DialogActions>
    </Dialog>
  );

  const handleDownloadPDF = async (order) => {
    // Fetch fresh order data with brand information before generating PDF
    try {
      const response = await API.get(`/purchase-orders/${order._id}`);
      const freshOrder = response.data;
      generatePDF(freshOrder);
    } catch (error) {
      console.error('Error fetching fresh order data:', error);
      // Fallback to original order data
      generatePDF(order);
    }
  };

  const generatePDF = (order) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    // Helper function to convert hex to RGB
    const hexToRgb = (hex) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return [r, g, b];
    };

    // Helper function to draw table header
    const drawTableHeader = (yPosition) => {
      const tableWidth = pageWidth - 28; // Match footer line width
      doc.setFillColor(15, 37, 110);
      doc.roundedRect(14, yPosition, tableWidth, 10, 2, 2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('S/N', 18, yPosition + 6);
      doc.text('ITEM', 28, yPosition + 6);
      doc.text('DESCRIPTION', 50, yPosition + 6);
      doc.text('CO', 87, yPosition + 6); // Company/Brand column
      doc.text('QTY', 115, yPosition + 6, { align: 'right' });
      doc.text('UNIT PRICE', 145, yPosition + 6, { align: 'right' });
      doc.text('TOTAL', pageWidth - 17, yPosition + 6, { align: 'right' }); // Align with right edge
      return yPosition + 15; // Return the Y position after header
    };

    // Helper function to draw footer on each page
    const drawFooter = () => {
      const footerY = pageHeight - 18;
      
      // Footer border - matches all other element widths
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.5);
      doc.line(14, footerY - 1, pageWidth - 14, footerY - 1);
      
      // Footer text
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.setFont('helvetica', 'italic');
      doc.text('Thank you for your business!', pageWidth / 2, footerY + 4, { align: 'center' });
      
      // Generated timestamp - left side
      const genTime = new Date().toLocaleDateString() + ' at ' + new Date().toLocaleTimeString();
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(120, 120, 120);
      doc.text(`Generated: ${genTime}`, 14, footerY + 10);
    };
    
    // Professional Header with Gradient Effect
    doc.setFillColor(15, 37, 110);
    doc.rect(0, 0, pageWidth, 25, 'F');
    
    // Header text
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('PURCHASE ORDER', pageWidth / 2, 15, { align: 'center' });
    
    // Sub-header line
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.3);
    doc.line(14, 19, pageWidth - 14, 19);
    
    // Company Information (Left side with accent) - more compact
    doc.setFillColor(245, 248, 255);
    doc.roundedRect(14, 32, 85, 42, 2, 2, 'F');
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 37, 110);
    doc.text('NEW ADIL ELECTRIC CONCERN', 17, 40);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(70, 70, 70);
    doc.text('4-B, Jamiat Center, Sha Alam Market', 17, 47);
    doc.text('Lahore, Pakistan', 17, 52);
    doc.text('Phone: (042) 123-4567', 17, 57);
    doc.text('Email: info@adilelectric.com', 17, 62);
    
    // PO Information Box (Right side) - more compact
    doc.setFillColor(250, 250, 250);
    doc.roundedRect(pageWidth - 90, 32, 80, 42, 2, 2, 'FD');
    doc.setDrawColor(200, 200, 200);
    
    // PO Number
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text('PO NUMBER', pageWidth - 85, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 37, 110);
    doc.text(order.poNumber || 'N/A', pageWidth - 17, 42, { align: 'right' });
    
    // PO Date
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text('PO DATE', pageWidth - 85, 50);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(order.poDate?.slice(0,10) || 'N/A', pageWidth - 17, 50, { align: 'right' });
    
    // PO Status Label and Badge - aligned on same line
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text('PO STATUS', pageWidth - 85, 58);
    
    // Status Badge - Smaller size, aligned with text
    const getStatusColor = (status) => {
      switch(status?.toLowerCase()) {
        case 'approved': return '#2e7d32';
        case 'pending': return '#fb8c00';  // Fixed: Orange for pending
        case 'cancelled': return '#c62828';
        case 'received': return '#2e7d32';
        case 'partially received': return '#ff9800';
        default: return '#1e88e5';
      }
    };
    
    const statusColor = getStatusColor(order.orderStatus);
    const [r, g, b] = hexToRgb(statusColor);
    
    // Draw smaller status badge aligned with text
    const statusText = (order.orderStatus || 'PENDING').toUpperCase();
    const statusWidth = Math.max(35, doc.getTextWidth(statusText) + 12); // Smaller width
    
    doc.setFillColor(r, g, b);
    doc.roundedRect(pageWidth - 17 - statusWidth, 56, statusWidth, 8, 2, 2, 'F'); // Smaller height, aligned with text
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.3);
    doc.roundedRect(pageWidth - 17 - statusWidth, 56, statusWidth, 8, 2, 2, 'D');
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7); // Smaller font
    doc.setTextColor(255, 255, 255);
    doc.text(
      statusText,
      pageWidth - 17 - (statusWidth / 2),
      61, // Aligned with text line
      { align: 'center' }
    );
    
    // Vendor & Ship To Section (Side by side) - Equal widths matching footer line
    const sectionY = 82;
    const sectionWidth = (pageWidth - 28 - 4) / 2; // Equal widths with gap, matching footer line width
    const sectionGap = 4;
    
    // Vendor Section
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(14, sectionY, sectionWidth, 38, 2, 2, 'FD');
    doc.setDrawColor(15, 37, 110);
    doc.setLineWidth(0.3);
    doc.line(14, sectionY + 9, 14 + sectionWidth, sectionY + 9);
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 37, 110);
    doc.text('VENDOR', 17, sectionY + 7);
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.text(order.vendorName || 'N/A', 17, sectionY + 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(`Phone: ${order.vendorPhone || 'N/A'}`, 17, sectionY + 19);
    doc.text(`Email: ${order.vendorEmail || 'N/A'}`, 17, sectionY + 24);
    doc.text(`Address: ${order.vendorAddress || 'N/A'}`, 17, sectionY + 29, { maxWidth: sectionWidth - 6 });
    
    // Ship To Section
    const shipToX = 14 + sectionWidth + sectionGap;
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(shipToX, sectionY, sectionWidth, 38, 2, 2, 'FD');
    doc.setDrawColor(15, 37, 110);
    doc.setLineWidth(0.3);
    doc.line(shipToX, sectionY + 9, shipToX + sectionWidth, sectionY + 9);
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 37, 110);
    doc.text('SHIP TO', shipToX + 3, sectionY + 7);
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.text(order.shipToName || 'N/A', shipToX + 3, sectionY + 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(`Phone: ${order.shipToPhone || 'N/A'}`, shipToX + 3, sectionY + 19);
    doc.text(`Email: ${order.shipToEmail || 'N/A'}`, shipToX + 3, sectionY + 24);
    doc.text(`Address: ${order.shipToAddress || 'N/A'}`, shipToX + 3, sectionY + 29, { maxWidth: sectionWidth - 6 });
    
    // Items Table Section - Start with better positioning
    const tableStartY = 128;
    let currentY = drawTableHeader(tableStartY);
    
    // Table Rows with dynamic page breaks
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    const baseRowHeight = 10;
    const minRowHeight = 8;
    
    if (order.items && order.items.length > 0) {
      order.items.forEach((item, index) => {
        try {
          // Calculate description height
          const desc = item.itemName || '-';
          const descLines = doc.splitTextToSize(desc, 40); // Adjusted width for CO column
          const descHeight = Math.max(1, descLines.length) * 4;
          const rowHeight = Math.max(minRowHeight, descHeight + 4);
          
          // Check if row will exceed page boundary (leaving space for totals and footer)
          const spaceNeeded = rowHeight + 80; // Extra space for totals section
          if (currentY + spaceNeeded > pageHeight - 30) {
            doc.addPage();
            currentY = drawTableHeader(25); // Start new table on new page
          }
          
          // No alternating row colors - removed for cleaner look
          
          // Calculate vertical center for single-line content
          const textY = currentY + (rowHeight / 2) - 1;
          
          // Serial Number (vertically centered)
          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          doc.text(String(index + 1), 18, textY);
          
          // Item code (vertically centered)
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.text(item.itemCode || '-', 28, textY);
          
          // Item description (multi-line support, vertically centered)
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7);
          const descStartY = currentY + (rowHeight - (descLines.length * 4)) / 2 + 2;
          doc.text(descLines, 50, descStartY);
          
          // Company/Brand (CO) column - aligned with header at position 87
          doc.setFontSize(7);
          const brandText = item.brand || item.vendor || item.company || 'N/A';
          console.log(`PDF Debug - Item: ${item.itemCode}, Brand: ${item.brand}, Vendor: ${item.vendor}, Final: ${brandText}`);
          doc.text(brandText, 87, textY);
          
          // Quantity (vertically centered) - adjusted position for CO column
          doc.setFontSize(8);
          doc.text(String(item.quantityOrdered || '0'), 115, textY, { align: 'right' });
          
          // Unit Price (vertically centered) - adjusted position for CO column
          doc.text(`${Number(item.perPiecePrice || 0).toFixed(2)}`, 145, textY, { align: 'right' });
          
          // Total (vertically centered, bold)
          const total = (Number(item.quantityOrdered || 0) * Number(item.perPiecePrice || 0)).toFixed(2);
          doc.setFont('helvetica', 'bold');
          doc.text(total, pageWidth - 17, textY, { align: 'right' }); // Align with right edge
          
          // Move to next row
          currentY += rowHeight + 2;
          
          // Row separator (subtle)
          if (index < order.items.length - 1) {
            doc.setDrawColor(230, 230, 230);
            doc.setLineWidth(0.2);
            doc.line(14, currentY - 1, pageWidth - 14, currentY - 1);
          }
        } catch (error) {
          console.error('Error rendering item:', item, error);
          currentY += baseRowHeight;
        }
      });
    } else {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.setTextColor(150, 150, 150);
      doc.text('No items in this order', 50, currentY);
      currentY += baseRowHeight;
    }
    
    // Totals Section - Positioned at bottom above footer with equal widths
    const footerHeight = 30;
    const totalsHeight = 50;
    let totalsStartY = pageHeight - footerHeight - totalsHeight - 5;
    
    // Check if totals section will fit on current page after items
    if (currentY + 15 > totalsStartY) {
      doc.addPage();
      totalsStartY = pageHeight - footerHeight - totalsHeight - 5;
    }
    
    // Equal width calculations matching footer line
    const bottomSectionWidth = (pageWidth - 28 - 4) / 2; // Equal widths with gap, matching footer line width
    const bottomSectionGap = 4;
    
    // Payment Information (Left side) - Equal width with footer line
    doc.setFillColor(248, 249, 252);
    doc.roundedRect(14, totalsStartY, bottomSectionWidth, totalsHeight, 2, 2, 'FD');
    doc.setDrawColor(220, 220, 220);
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 37, 110);
    doc.text('PAYMENT DETAILS', 17, totalsStartY + 8);
    
    doc.setDrawColor(15, 37, 110);
    doc.setLineWidth(0.3);
    doc.line(17, totalsStartY + 10, 14 + bottomSectionWidth - 3, totalsStartY + 10);
    
    doc.setFontSize(8);
    doc.setTextColor(70, 70, 70);
    doc.setFont('helvetica', 'normal');
    doc.text('Payment Terms:', 17, totalsStartY + 18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(order.paymentTerms || 'Net 30', 17, totalsStartY + 25);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(70, 70, 70);
    doc.text('Payment Method:', 17, totalsStartY + 33);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(order.paymentMethod || 'Bank Transfer', 17, totalsStartY + 40);
    
    // ORDER TOTALS Section (Right side) - Equal width with footer line
    const totalsBoxX = 14 + bottomSectionWidth + bottomSectionGap;
    
    // Background box
    doc.setFillColor(250, 250, 250);
    doc.roundedRect(totalsBoxX, totalsStartY, bottomSectionWidth, totalsHeight, 2, 2, 'FD');
    doc.setDrawColor(220, 220, 220);
    
    // ORDER TOTALS header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 37, 110);
    doc.text('ORDER TOTALS', totalsBoxX + 3, totalsStartY + 8);
    
    doc.setDrawColor(15, 37, 110);
    doc.setLineWidth(0.3);
    doc.line(totalsBoxX + 3, totalsStartY + 10, totalsBoxX + bottomSectionWidth - 3, totalsStartY + 10);
    
    // Subtotals with better spacing
    doc.setFontSize(8);
    doc.setTextColor(70, 70, 70);
    
    // Subtotal
    doc.setFont('helvetica', 'normal');
    doc.text('Subtotal:', totalsBoxX + 3, totalsStartY + 18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(`${Number(order.subtotal || 0).toFixed(2)}`, totalsBoxX + bottomSectionWidth - 3, totalsStartY + 18, { align: 'right' });
    
    // Tax
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(70, 70, 70);
    doc.text('Tax:', totalsBoxX + 3, totalsStartY + 25);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(`${Number(order.taxTotal || 0).toFixed(2)}`, totalsBoxX + bottomSectionWidth - 3, totalsStartY + 25, { align: 'right' });
    
    // Discount
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(70, 70, 70);
    doc.text('Discount:', totalsBoxX + 3, totalsStartY + 32);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(`${Number(order.discountTotal || 0).toFixed(2)}`, totalsBoxX + bottomSectionWidth - 3, totalsStartY + 32, { align: 'right' });
    
    // Shipping
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(70, 70, 70);
    doc.text('Shipping:', totalsBoxX + 3, totalsStartY + 39);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(`${Number(order.shippingCharges || 0).toFixed(2)}`, totalsBoxX + bottomSectionWidth - 3, totalsStartY + 39, { align: 'right' });
    
    // Grand Total with emphasis - spans full width below both sections
    const grandTotalY = totalsStartY + totalsHeight + 2;
    doc.setFillColor(15, 37, 110);
    doc.roundedRect(14, grandTotalY, pageWidth - 28, 12, 2, 2, 'F');
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text('GRAND TOTAL:', 17, grandTotalY + 8);
    doc.text(`${Number(order.grandTotal || 0).toFixed(2)}`, pageWidth - 17, grandTotalY + 8, { align: 'right' });
    
    // Draw footer on all pages
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      drawFooter();
      
      // Page number - right side
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.setFont('helvetica', 'normal');
      doc.text(
        `Page ${i} of ${pageCount}`,
        pageWidth - 14,
        pageHeight - 5,
        { align: 'right' }
      );
    }

    // Save the PDF
    doc.save(`PO_${order.poNumber || 'order'}_${new Date().toISOString().slice(0,10)}.pdf`);
  };

  const handlePrintReport = () => {
    const rows = filteredOrders || [];
    const start = startDate || 'All time';
    const end = endDate || 'Now';
    const vendor = vendorFilter || 'All vendors';
    const status = statusFilter || 'All';

    const rowsHtml = rows.map(r => `
      <tr>
        <td>${r.poNumber || ''}</td>
        <td>${r.poDate ? (r.poDate.slice ? r.poDate.slice(0,10) : new Date(r.poDate).toLocaleDateString()) : ''}</td>
        <td>${r.vendorName || ''}</td>
        <td>${r.orderStatus || ''}</td>
        <td style="text-align:right">Rs${Number(r.grandTotal || 0).toFixed(2)}</td>
        <td>${r.paymentStatus || ''}</td>
      </tr>
    `).join('');

    const html = `
      <html><head><title>Purchase Report ${start} - ${end}</title>
        <style>table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px;text-align:left}</style>
        </head><body>
        <h3>Purchase Orders Report</h3>
        <div>From: ${start} To: ${end}</div>
        <div>Vendor: ${vendor} | Status: ${status}</div>
        <table><thead><tr><th>PO#</th><th>Date</th><th>Vendor</th><th>Status</th><th style="text-align:right">Total</th><th>Payment Status</th></tr></thead><tbody>${rowsHtml}</tbody></table>
      </body></html>
    `;

    const w = window.open('', '_blank');
    if (!w || !w.document) { alert('Popup blocked. Allow popups to print.'); return; }
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 250);
  };

  return (
  <Box sx={{ width: '100%', boxSizing: 'border-box', px: { xs: 1, sm: 2, md: 3 }, mt: 3, pb: 4, backgroundColor: darkMode ? '#121212' : '#fafafa', minHeight: '100vh' }}>
      <Paper elevation={6} sx={{
        p: { xs: 1.5, sm: 2.5, md: 4 },
        borderRadius: { xs: 2, md: 6 },
        boxShadow: 8,
        background: darkMode ? 'linear-gradient(135deg, #1e1e1e 0%, #121212 100%)' : 'linear-gradient(135deg, #e3f2fd 0%, #fff 100%)',
        width: '100%',
        maxWidth: { xs: '100%', md: 'calc(100vw - 300px)' },
        mx: 'auto',
        backgroundColor: darkMode ? '#1e1e1e' : '#fff'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 2, flexWrap: 'wrap' }}>
          <img src={process.env.PUBLIC_URL + '/Inventory logo.png'} alt="Inventory Logo" style={{ height: 40, marginRight: 12 }} />
          <Typography variant={isSm ? 'h6' : 'h4'} color="primary" sx={{ fontWeight: 700 }}>Purchase Orders Report</Typography>
        </Box>
        <TextField
          placeholder="Search by PO Number, Vendor, Status, Date..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          fullWidth
          sx={{ mb: 2 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }}
        />
        <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextField select label="Vendor" value={vendorFilter} onChange={e => setVendorFilter(e.target.value)} sx={{ minWidth: 180 }}>
            <MenuItem value="">All</MenuItem>
            {vendors?.map(v => (
              <MenuItem key={v._id} value={v.vendorName}>{v.vendorName}</MenuItem>
            ))}
          </TextField>

          <TextField select label="Status" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} sx={{ minWidth: 160 }}>
            <MenuItem value="">All</MenuItem>
            {defaultStatus.map(s => (
              <MenuItem key={s} value={s}>{s}</MenuItem>
            ))}
          </TextField>

          <TextField
            label="Start Date"
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />

          <TextField
            label="End Date"
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />

          <Button variant="contained" startIcon={<PrintIcon />} onClick={handlePrintReport} sx={{ ml: 'auto' }}>Print Report</Button>
        </Box>
        <TableContainer component={Paper} sx={{ mb: 2, width: '100%', overflowX: 'auto' }}>
          <Table stickyHeader sx={{ minWidth: isSm ? 700 : isMd ? 1000 : 1300, tableLayout: 'auto' }}>
            <TableHead>
              <TableRow sx={{ background: darkMode ? '#2a2a2a' : '#e3f2fd' }}>
                <TableCell>PO Number</TableCell>
                <TableCell>PO Date</TableCell>
                <TableCell>Vendor</TableCell>
                <TableCell>Ship To</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Grand Total</TableCell>
                {!isSm && <TableCell>Payment Terms</TableCell>}
                {!isSm && <TableCell>Payment Method</TableCell>}
                <TableCell>Payment Status</TableCell>
                {!isSm && <TableCell>Cash Amount</TableCell>}
                {!isSm && <TableCell>Cash Date & Time</TableCell>}
                {!isSm && <TableCell>Advance Amount</TableCell>}
                {!isSm && <TableCell>Advance Date & Time</TableCell>}
                {!isSm && <TableCell>Initial Payment</TableCell>}
                {!isSm && <TableCell>Initial Date & Time</TableCell>}
                <TableCell>Final Payment</TableCell>
                <TableCell>Final Date & Time</TableCell>
                <TableCell>Remaining Amount</TableCell>
                <TableCell>Bank/Cheque Receipt</TableCell>
                {!isSm && <TableCell>Delivery Location</TableCell>}
                {!isSm && <TableCell>Created By</TableCell>}
                <TableCell>Edit</TableCell>
                <TableCell>Delete</TableCell>
                {!isSm && <TableCell>PDF</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredOrders.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map(order => (
                <TableRow key={order._id}
                  ref={el => { if (order.poNumber) rowRefs.current[order.poNumber] = el; }}
                  sx={{
                    ...(highlightPo && order.poNumber === highlightPo && Date.now() < highlightUntil
                      ? {
                          animation: 'blinkBg 1s linear infinite',
                          '@keyframes blinkBg': {
                            '0%': { backgroundColor: '#fffde7' },
                            '50%': { backgroundColor: '#fff59d' },
                            '100%': { backgroundColor: '#fffde7' }
                          }
                        }
                      : {})
                  }}
                >
                  <TableCell sx={cellSx} title={order.poNumber}>{order.poNumber}</TableCell>
                  <TableCell sx={cellSx} title={order.poDate?.slice(0,10)}>{order.poDate?.slice(0,10)}</TableCell>
                  <TableCell sx={cellSx} title={order.vendorName}>{order.vendorName || 'N/A'}</TableCell>
                  <TableCell sx={cellSx} title={order.shipToName}>{order.shipToName || 'N/A'}</TableCell>
                  <TableCell>
                    <Box 
                      sx={{
                        display: 'inline-block',
                        padding: '4px 8px',
                        borderRadius: '12px',
                        backgroundColor: 
                          order.orderStatus === 'Approved' ? 'rgba(46, 125, 50, 0.1)' :
                          order.orderStatus === 'Pending' ? 'rgba(251, 140, 0, 0.1)' :
                          order.orderStatus === 'Cancelled' ? 'rgba(198, 40, 40, 0.1)' :
                          'rgba(30, 136, 229, 0.1)',
                        color: 
                          order.orderStatus === 'Approved' ? '#2e7d32' :
                          order.orderStatus === 'Pending' ? '#fb8c00' :
                          order.orderStatus === 'Cancelled' ? '#c62828' :
                          '#1e88e5',
                        fontWeight: '500',
                        fontSize: '0.75rem',
                        textTransform: 'capitalize'
                      }}
                    >
                      {order.orderStatus || 'Pending'}
                    </Box>
                  </TableCell>
                  <TableCell sx={{ fontWeight: 'bold', minWidth: 140 }}>Rs{Number(order.grandTotal || 0).toFixed(2)}</TableCell>
                  {!isSm && <TableCell sx={cellSx} title={order.paymentTerms}>{order.paymentTerms || 'N/A'}</TableCell>}
                  {!isSm && <TableCell sx={cellSx} title={order.paymentMethod}>{order.paymentMethod || 'N/A'}</TableCell>}
                  <TableCell sx={{ minWidth: 120 }}>{order.paymentStatus || 'Unpaid'}</TableCell>
                  {!isSm && <TableCell sx={{ minWidth: 120 }}>Rs{Number((order.cashPaid ?? order.cashAmount) || 0).toFixed(2)}</TableCell>}
                  {!isSm && (
                    <TableCell sx={{ minWidth: 160 }}>
                      {order.cashPaymentDateTime ? (
                        <Box sx={{ fontSize: '0.75rem' }}>
                          <Box>{new Date(order.cashPaymentDateTime).toLocaleDateString()}</Box>
                          <Box sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                            {new Date(order.cashPaymentDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </Box>
                        </Box>
                      ) : '-'}
                    </TableCell>
                  )}
                  {!isSm && <TableCell sx={{ minWidth: 120 }}>Rs{Number(order.advanceAmount || 0).toFixed(2)}</TableCell>}
                  {!isSm && (
                    <TableCell sx={{ minWidth: 140 }}>
                      {(order.advancePaymentDateTime || order.advanceDateTime) ? (
                        <Box sx={{ fontSize: '0.75rem' }}>
                          <Box>{new Date(order.advancePaymentDateTime || order.advanceDateTime).toLocaleDateString()}</Box>
                          <Box sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                            {new Date(order.advancePaymentDateTime || order.advanceDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </Box>
                        </Box>
                      ) : '-'}
                    </TableCell>
                  )}
                  {!isSm && <TableCell sx={{ minWidth: 120 }}>Rs{Number(order.initialPayment || 0).toFixed(2)}</TableCell>}
                  {!isSm && (
                    <TableCell sx={{ minWidth: 140 }}>
                      {order.initialPaymentDateTime ? (
                        <Box sx={{ fontSize: '0.75rem' }}>
                          <Box>{new Date(order.initialPaymentDateTime).toLocaleDateString()}</Box>
                          <Box sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                            {new Date(order.initialPaymentDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </Box>
                        </Box>
                      ) : '-'}
                    </TableCell>
                  )}
                  <TableCell sx={{ minWidth: 120 }}>Rs{Number(order.finalPayment || 0).toFixed(2)}</TableCell>
                  <TableCell sx={{ minWidth: 140 }}>
                    {order.finalPaymentDateTime ? (
                      <Box sx={{ fontSize: '0.75rem' }}>
                        <Box>{new Date(order.finalPaymentDateTime).toLocaleDateString()}</Box>
                        <Box sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                          {new Date(order.finalPaymentDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Box>
                      </Box>
                    ) : '-'}
                  </TableCell>
                  <TableCell sx={{ minWidth: 140 }}>Rs{(
                    Number(order.grandTotal || 0)
                    - Number((order.cashPaid ?? order.cashAmount) || 0)
                    - Number(order.initialPayment || 0)
                    - Number(order.advanceAmount || 0)
                    - Number(order.finalPayment || 0)
                  ).toFixed(2)}</TableCell>
                  <TableCell>
                    {(order.bankReceipt || order.chequeReceipt || (order.attachments && order.attachments.length > 0)) ? (
                      <>
                        {order.bankReceipt && (
                          <Button variant="outlined" size="small" sx={{ mr: 1 }} onClick={() => window.open(order.bankReceipt, '_blank')}>
                            Bank Receipt
                          </Button>
                        )}
                        {order.chequeReceipt && (
                          <Button variant="outlined" size="small" sx={{ mr: 1 }} onClick={() => window.open(order.chequeReceipt, '_blank')}>
                            Cheque Receipt
                          </Button>
                        )}
                        {/* Show other attachments that are not the bank/cheque receipts */}
                        {order.attachments && order.attachments.filter(url => url !== order.bankReceipt && url !== order.chequeReceipt).map((fileUrl, idx) => (
                          <Button key={idx} variant="outlined" size="small" sx={{ mr: 1 }} onClick={() => window.open(fileUrl, '_blank')}>
                            View {idx + 1}
                          </Button>
                        ))}
                      </>
                    ) : '-'}
                  </TableCell>
                  {!isSm && <TableCell sx={cellSx} title={order.deliveryLocation}>{order.deliveryLocation}</TableCell>}
                  {!isSm && <TableCell sx={cellSx} title={order.createdBy}>{order.createdBy}</TableCell>}
                  <TableCell>
                    <IconButton onClick={() => handleEdit(order)}><EditIcon /></IconButton>
                  </TableCell>
                  <TableCell>
                    <IconButton color="error" onClick={() => handleDelete(order._id)}><DeleteIcon /></IconButton>
                  </TableCell>
                  <TableCell>
                    <IconButton color="primary" onClick={() => handleDownloadPDF(order)}><PictureAsPdfIcon /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        {/* Pagination */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', mb: 2 }}>
          <Button disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
          <Typography sx={{ mx: 2 }}>Page {page + 1} of {Math.ceil(filteredOrders.length / rowsPerPage)}</Typography>
          <Button disabled={page >= Math.ceil(filteredOrders.length / rowsPerPage) - 1} onClick={() => setPage(page + 1)}>Next</Button>
        </Box>
        {renderEditDialog()}
      </Paper>
    </Box>
  );
};

export default AdminPurchaseReport;
