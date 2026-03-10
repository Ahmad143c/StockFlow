import React, { useState, useEffect } from 'react';
import API from '../api/api';
import { Box, Typography, TextField, Button, Paper, Grid, MenuItem, Select, InputLabel, FormControl, IconButton, Divider } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { useSelector, useDispatch } from 'react-redux';
import { fetchProducts } from '../redux/productsSlice';

const defaultUOM = ['pieces'];
const defaultStatus = ['Pending', 'Approved', 'Received', 'Partially Received', 'Cancelled'];
const paymentMethodOptions = ['Bank Transfer', 'Cheque', 'Cash Payment'];
const defaultDeliveryMethods = ['Courier', 'In-house transport'];
const defaultPurchaseTypes = ['Local', 'International'];
const defaultCurrency = ['PKR', 'DOLLAR', 'YAN'];

const AdminPurchaseOrder = () => {
  // Calculate remaining payment and PO status
  const getPaidAmount = () => {
    let paid = 0;
    if (form.paymentTerms === 'Advance Payment') {
      paid = Number(form.advanceAmount) || 0;
    } else if (form.paymentTerms === 'Partial Payment') {
      paid = (Number(form.initialPayment) || 0);
    } else if (form.paymentTerms === 'Cash Payment') {
      paid = Number(form.cashPaid) || 0;
    }
    return paid;
  };

  const getRemainingPayment = () => {
    const grandTotal = calculateTotals().grandTotal;
    const paid = getPaidAmount();
    const finalPayment = Number(form.finalPayment) || 0;
    return Math.max(grandTotal - (paid + finalPayment), 0);
  };

  const getPOStatus = () => {
    const grandTotal = calculateTotals().grandTotal;
    const paid = getPaidAmount();
    if (paid >= grandTotal && grandTotal > 0) return 'Paid';
    return form.orderStatus;
  };
  const [vendors, setVendors] = useState([]);
  useEffect(() => {
    const token = localStorage.getItem('token');
    API.get('/vendors', {
      headers: { Authorization: `Bearer ${token}` }
    }).then(res => setVendors(res.data)).catch(() => setVendors([]));
  }, []);
  const dispatch = useDispatch();
  const products = useSelector(state => state.products.items);

  useEffect(() => {
    dispatch(fetchProducts());
  }, [dispatch]);

  // Calculate due date based on payment terms and PO date
  const calculateDueDate = (paymentTerms, poDate) => {
    if (!poDate || !['Net 30', 'Net 60'].includes(paymentTerms)) return '';
    
    const date = new Date(poDate);
    const daysToAdd = paymentTerms === 'Net 30' ? 30 : 60;
    date.setDate(date.getDate() + daysToAdd);
    return date.toISOString().split('T')[0];
  };

  const [form, setForm] = useState({
    poNumber: '',
    poDate: new Date().toISOString().slice(0, 10),
    dueDate: calculateDueDate('', new Date().toISOString().slice(0, 10)),
    expectedDeliveryDate: '',
    orderStatus: 'Pending',
    paymentStatus: 'Unpaid',
    reference: '',
    vendorName: '',
    vendorId: '',
    vendorAddress: '',
    vendorPhone: '',
    vendorEmail: '',
    shipToName: '',
    shipToPhone: '',
    shipToEmail: '',
    shipToAddress: '',
    items: [
      {
        itemCode: '',
        itemName: '',
        description: '',
        quantityOrdered: '',
        uom: 'pieces',
        perPiecePrice: '',
        unitPrice: '',
        tax: '',
        discount: '',
      }
    ],
    subtotal: 0,
    taxTotal: 0,
    discountTotal: 0,
    shippingCharges: 0,
    grandTotal: 0,
    paymentMethod: '',
    deliveryMethod: '',
    deliveryLocation: '',
    paymentTerms: '',
    createdBy: '',
    approvedBy: '',
    attachments: [],
    purchaseType: 'Local',
    currency: 'PKR',
    advanceAmount: '',
    advancePaymentDateTime: '',
    advanceApprovedBy: '',
    finalPayment: '',
    finalPaymentDateTime: '',
    initialPayment: '',
    initialPaymentDateTime: '',
    creditAmount: '',
    bankReceipt: '',
    chequeReceipt: '',
    cashPaid: '',
    cashPaymentDateTime: ''
  });

  // Filter products based on selected vendor
  const filteredProducts = form.vendorName 
    ? products.filter(product => product.vendor === form.vendorName)
    : products;

  // Helper to generate PO Number
  const generatePONumber = () => {
    return 'PO-' + Date.now();
  };

  const handleChange = e => {
    // Handle payment terms change to update due date
    if (e.target.name === 'paymentTerms' || e.target.name === 'poDate') {
      const newForm = { ...form, [e.target.name]: e.target.value };
      if (['Net 30', 'Net 60'].includes(e.target.value) || e.target.name === 'poDate') {
        newForm.dueDate = calculateDueDate(
          e.target.name === 'paymentTerms' ? e.target.value : form.paymentTerms,
          e.target.name === 'poDate' ? e.target.value : form.poDate
        );
      } else {
        newForm.dueDate = '';
      }
      setForm(newForm);
      return;
    }
    
    if (e.target.name === 'vendorName') {
      const selectedVendor = vendors.find(v => v.vendorName === e.target.value);
      if (selectedVendor) {
        setForm({
          ...form,
          vendorName: selectedVendor.vendorName,
          vendorId: selectedVendor._id,
          vendorAddress: selectedVendor.address?.street || '',
          vendorPhone: selectedVendor.phone || '',
          vendorEmail: selectedVendor.email || '',
          poNumber: generatePONumber(),
          paymentTerms: selectedVendor.paymentTerms || '',
          paymentMethod: selectedVendor.paymentMethod || '',
          // Clear existing items when vendor changes to avoid incompatible products
          items: [{
            itemSource: 'ExistingProduct',
            itemCode: '',
            itemName: '',
            description: '',
            quantityOrdered: '',
            uom: 'pieces',
            perPiecePrice: '',
            unitPrice: '',
            tax: '',
            discount: '',
            totalLineAmount: 0
          }]
        });
        return;
      }
    }
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleItemChange = (idx, e) => {
    const items = [...form.items];
    items[idx][e.target.name] = e.target.value;
    // If product is selected, auto-fill itemName, perPiecePrice, etc.
    if (e.target.name === 'itemCode') {
      const selectedProduct = products.find(p => p.SKU === e.target.value);
      if (selectedProduct) {
        items[idx].itemName = selectedProduct.name;
        items[idx].perPiecePrice = selectedProduct.costPerPiece;
        items[idx].description = selectedProduct.category;
      }
    }
    // Auto-calculate unitPrice when perPiecePrice or quantityOrdered changes
    if (e.target.name === 'perPiecePrice' || e.target.name === 'quantityOrdered' || e.target.name === 'itemCode') {
      const qty = Number(items[idx].quantityOrdered) || 0;
      const perPiece = Number(items[idx].perPiecePrice) || 0;
      items[idx].unitPrice = (qty * perPiece).toFixed(2);
    }
    setForm({ ...form, items });
  };

  const addItem = () => {
    setForm({
      ...form,
      items: [...form.items, {
        itemCode: '', itemName: '', description: '', quantityOrdered: '', uom: 'pieces', unitPrice: '', tax: '', discount: ''
      }]
    });
  };

  const removeItem = idx => {
    const items = form.items.filter((_, i) => i !== idx);
    setForm({ ...form, items });
  };

  const uploadFile = async (file) => {
    const formData = new FormData();
    formData.append('image', file);
    
    try {
      const response = await fetch('http://localhost:5000/api/upload', {
        method: 'POST',
        body: formData,
        // Include your authentication headers here if needed
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}` // Adjust based on your auth setup
        }
      });
      
      if (!response.ok) throw new Error('Upload failed');
      const data = await response.json();
      return data.url; // This will be the Cloudinary URL
    } catch (error) {
      console.error('File upload error:', error);
      return null;
    }
  };

  const handleFileChange = async (e) => {
    const name = e.target.name;
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // If this input is specifically for bank or cheque receipt, upload the first file and set the specific field
    if (name === 'bankReceipt' || name === 'chequeReceipt') {
      try {
        const url = await uploadFile(files[0]);
        if (url) {
          setForm(prev => ({
            ...prev,
            [name]: url,
            attachments: [...(prev.attachments || []), url]
          }));
        }
      } catch (error) {
        console.error('Error uploading receipt:', error);
      }
      return;
    }

    // Default: upload multiple attachments and append to attachments array
    const uploadPromises = files.map(file => uploadFile(file));
    try {
      const uploadedUrls = await Promise.all(uploadPromises);
      const validUrls = uploadedUrls.filter(url => url !== null);
      setForm(prev => ({
        ...prev,
        attachments: [...(prev.attachments || []), ...validUrls]
      }));
    } catch (error) {
      console.error('Error handling files:', error);
    }
  };

  // Calculate totals
  const calculateTotals = () => {
    let subtotal = 0, taxTotal = 0, discountTotal = 0;
    form.items.forEach(item => {
      const price = Number(item.unitPrice) || 0;
      const tax = Number(item.tax) || 0;
      const discount = Number(item.discount) || 0;
      subtotal += price;
      taxTotal += tax;
      discountTotal += discount;
    });
    const shipping = Number(form.shippingCharges) || 0;
    const grandTotal = subtotal + taxTotal - discountTotal + shipping;
    return { subtotal, taxTotal, discountTotal, grandTotal, shipping };
  };

  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async e => {
    e.preventDefault();
    setSuccess('');
    setError('');
    const totals = calculateTotals();
    // Sanitize payload: ensure required fields and correct types
    const sanitizedItems = form.items
      .map(item => {
        const cleanedItem = Object.fromEntries(
          Object.entries({
            ...item,
            quantityOrdered: Number(item.quantityOrdered) || 0,
            perPiecePrice: Number(item.perPiecePrice) || 0,
            unitPrice: Number(item.unitPrice) || 0,
            tax: Number(item.tax) || 0,
            discount: Number(item.discount) || 0,
            shippingCharges: Number(form.shippingCharges) || 0
          }).filter(([_, v]) => v !== '')
        );
        return cleanedItem;
      })
      .filter(item => item.itemCode && item.itemCode.trim() !== '');
    // Validate required fields
    if (!form.poNumber || !form.vendorName || sanitizedItems.length === 0) {
      setError('PO Number, Vendor Name, and at least one valid item are required.');
      return;
    }
    // Normalize datetime fields (convert datetime-local to ISO)
    const normalizeDateTime = (v) => {
      if (!v) return '';
      try { return new Date(v).toISOString(); } catch { return v; }
    };

    // Remove undefined fields from payload
    const rawPayload = {
      ...form,
      ...totals,
      poNumber: form.poNumber,
      vendorName: form.vendorName,
      vendorId: form.vendorId,
      items: sanitizedItems,
      advanceAmount: Number(form.advanceAmount) || undefined,
      creditAmount: Number(form.creditAmount) || undefined,
      initialPayment: Number(form.initialPayment) || undefined,
      finalPayment: Number(form.finalPayment) || undefined,
      // datetime conversions
      advancePaymentDateTime: normalizeDateTime(form.advancePaymentDateTime) || undefined,
      initialPaymentDateTime: normalizeDateTime(form.initialPaymentDateTime) || undefined,
      finalPaymentDateTime: normalizeDateTime(form.finalPaymentDateTime) || undefined,
      cashPaymentDateTime: normalizeDateTime(form.cashPaymentDateTime) || undefined
    };
  const payload = Object.fromEntries(Object.entries(rawPayload).filter(([_, v]) => v !== undefined && v !== ''));
    console.log('Submitting purchase order payload:', payload);
    try {
      await API.post('/purchase-orders', payload);
      setSuccess('Purchase Order Submitted!');
      setForm({
        poNumber: '',
        poDate: new Date().toISOString().slice(0, 10),
        expectedDeliveryDate: '',
        orderStatus: 'Pending',
        reference: '',
        vendorName: '',
        vendorId: '',
        vendorAddress: '',
        vendorPhone: '',
        vendorEmail: '',
        shipToName: '',
        shipToPhone: '',
        shipToEmail: '',
        shipToAddress: '',
        items: [{ itemCode: '', itemName: '', description: '', quantityOrdered: '', uom: '', unitPrice: '', tax: '', discount: '' }],
        subtotal: 0,
        taxTotal: 0,
        discountTotal: 0,
        shippingCharges: '',
        grandTotal: 0,
        paymentTerms: '',
        paymentMethod: '',
        deliveryMethod: '',
        deliveryLocation: '',
        createdBy: '',
        approvedBy: '',
        attachments: [],
        purchaseType: 'Local',
  currency: 'PKR'
      });
  // Removed setFileList (no-undef)
    } catch (err) {
      console.error('Backend error:', err);
      if (err.response && err.response.data && err.response.data.message) {
        setError('Failed to submit order: ' + err.response.data.message);
      } else {
        setError('Failed to submit order');
      }
    }
  };

  return (
    <Box sx={{ maxWidth: 1800, mx: 'auto', mt: 4 }}>
      <Paper elevation={3} sx={{ p: 4, borderRadius: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', mb: 2 }}>
          <Box>
            <Typography variant="h4" color="primary" sx={{ fontWeight: 700 }}>Create Purchase Order</Typography>
            <Typography variant="body2" color="text.secondary">Fill in the details below to create a new purchase order</Typography>
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="overline" color="text.secondary">Grand Total</Typography>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              {calculateTotals().grandTotal.toFixed(2)} {form.currency}
            </Typography>
          </Box>
        </Box>
        <Divider sx={{ mb: 3 }} />
        <form onSubmit={handleSubmit}>
          {success && (
            <Paper variant="outlined" sx={{ p: 2, mb: 3, borderColor: 'success.light', bgcolor: 'success.lighter', color: 'success.dark' }}>
              <Typography>{success}</Typography>
            </Paper>
          )}
          {error && (
            <Paper variant="outlined" sx={{ p: 2, mb: 3, borderColor: 'error.light', bgcolor: 'error.lighter', color: 'error.dark' }}>
              <Typography>{error}</Typography>
            </Paper>
          )}
          <Grid container spacing={3}>
            {/* PO Details */}
            <Grid item xs={12}>
              <Typography variant="h6" sx={{ fontWeight: 700 }} gutterBottom>PO Details</Typography>
              <Divider sx={{ mb: 2 }} />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField label="PO Number" name="poNumber" value={form.poNumber} onChange={handleChange} fullWidth placeholder="Auto or manual" />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Payment Status</InputLabel>
                <Select 
                  name="paymentStatus" 
                  value={form.paymentStatus} 
                  label="Payment Status" 
                  onChange={handleChange}
                >
                  <MenuItem value="Unpaid">Unpaid</MenuItem>
                  <MenuItem value="Partially Paid">Partially Paid</MenuItem>
                  <MenuItem value="Paid">Paid</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField label="PO Date" name="poDate" value={form.poDate} onChange={handleChange} type="date" fullWidth InputLabelProps={{ shrink: true }} required />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField label="Expected Delivery Date" name="expectedDeliveryDate" value={form.expectedDeliveryDate} onChange={handleChange} type="date" fullWidth InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Order Status</InputLabel>
                <Select name="orderStatus" value={form.orderStatus} label="Order Status" onChange={handleChange}>
                  {defaultStatus.map(status => <MenuItem key={status} value={status}>{status}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField label="Reference/Notes" name="reference" value={form.reference} onChange={handleChange} fullWidth multiline rows={2} placeholder="Optional notes for this PO" />
            </Grid>
            <Divider sx={{ my: 1.5, width: '100%' }} />
            {/* Vendor Info */}
            <Grid item xs={12}>
              <Typography variant="h6" sx={{ fontWeight: 700 }} gutterBottom>Vendor</Typography>
              <Divider sx={{ mb: 2 }} />
            </Grid>
            <Grid item xs={12} md={4}>
              
              <FormControl fullWidth required>
                <InputLabel>Vendor</InputLabel>
                <Select
                  name="vendorName"
                  value={form.vendorName}
                  label="Vendor"
                  onChange={handleChange}
                >
                  {vendors.map(vendor => (
                    <MenuItem key={vendor._id} value={vendor.vendorName}>
                      {vendor.vendorName}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField label="Vendor ID" name="vendorId" value={form.vendorId} InputProps={{ readOnly: true }} fullWidth />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField label="Vendor Address" name="vendorAddress" value={form.vendorAddress} onChange={handleChange} fullWidth />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField label="Vendor Phone" name="vendorPhone" value={form.vendorPhone} onChange={handleChange} fullWidth />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField label="Vendor Email" name="vendorEmail" value={form.vendorEmail} onChange={handleChange} fullWidth />
            </Grid>
            <Divider sx={{ my: 1.5, width: '100%' }} />
            {/* Ship To Section */}
            <Grid item xs={12}>
              <Typography variant="h6" sx={{ fontWeight: 700 }} gutterBottom>Ship To</Typography>
              <Divider sx={{ mb: 2 }} />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField 
                label="Contact Person Name" 
                name="shipToName" 
                value={form.shipToName || ''} 
                onChange={handleChange} 
                fullWidth 
                required 
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField 
                label="Contact Number" 
                name="shipToPhone" 
                value={form.shipToPhone || ''} 
                onChange={handleChange} 
                fullWidth 
                required 
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField 
                label="Email" 
                name="shipToEmail" 
                type="email"
                value={form.shipToEmail || ''} 
                onChange={handleChange} 
                fullWidth 
                required 
              />
            </Grid>
            <Grid item xs={12}>
              <TextField 
                label="Shipping Address" 
                name="shipToAddress" 
                value={form.shipToAddress || ''} 
                onChange={handleChange} 
                fullWidth 
                multiline 
                rows={2} 
                required 
              />
            </Grid>
            <Divider sx={{ my: 1.5, width: '100%' }} />
            {/* Line Items */}
            <Grid item xs={12}>
              <Typography variant="h6" sx={{ fontWeight: 700 }} mb={1}>Items</Typography>
              {form.vendorName && (
                <Typography variant="body2" color="info.main" mb={1}>
                  Showing {filteredProducts.length} product(s) from vendor: {form.vendorName}
                </Typography>
              )}
              {!form.vendorName && (
                <Typography variant="body2" color="warning.main" mb={1}>
                  Please select a vendor first to see available products
                </Typography>
              )}
            </Grid>
            {form.items.map((item, idx) => (
              <React.Fragment key={idx}>
                <Grid item xs={12} md={2}>
                  <FormControl fullWidth>
                    <InputLabel>Item Source</InputLabel>
                    <Select
                      name="itemSource"
                      value={item.itemSource || 'AdminProductList'}
                      onChange={e => {
                        const items = [...form.items];
                        items[idx].itemSource = e.target.value;
                        // If switching to AdminProductList, clear manual fields
                        if (e.target.value === 'AdminProductList') {
                          items[idx].itemCode = '';
                          items[idx].itemName = '';
                          items[idx].description = '';
                          items[idx].perPiecePrice = '';
                        }
                        setForm({ ...form, items });
                      }}
                    >
                      <MenuItem value="AdminProductList">From AdminProductList</MenuItem>
                      <MenuItem value="NewProduct">New Product</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                {item.itemSource !== 'NewProduct' ? (
                  <Grid item xs={12} md={2}>
                    <FormControl fullWidth>
                      <InputLabel>Item Code/SKU</InputLabel>
                      <Select name="itemCode" value={item.itemCode} label="Item Code/SKU" onChange={e => handleItemChange(idx, e)} required>
                        {filteredProducts.map(p => (
                          <MenuItem key={p.SKU} value={p.SKU}>{p.SKU} - {p.name}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                ) : (
                  <Grid item xs={12} md={2}>
                    <TextField label="Item Code/SKU" name="itemCode" value={item.itemCode} onChange={e => handleItemChange(idx, e)} fullWidth required />
                  </Grid>
                )}
                <Grid item xs={12} md={2}>
                  <TextField label="Item Name" name="itemName" value={item.itemName} onChange={e => handleItemChange(idx, e)} fullWidth required />
                </Grid>
                <Grid item xs={12} md={2}>
                  <TextField label="Description" name="description" value={item.description} onChange={e => handleItemChange(idx, e)} fullWidth />
                </Grid>
                <Grid item xs={12} md={1}>
                  <TextField label="Qty" name="quantityOrdered" value={item.quantityOrdered} onChange={e => handleItemChange(idx, e)} type="number" fullWidth required />
                </Grid>
                <Grid item xs={12} md={1}>
                  <FormControl fullWidth>
                    <InputLabel>UOM</InputLabel>
                    <Select name="uom" value={item.uom} label="UOM" onChange={e => handleItemChange(idx, e)}>
                      {defaultUOM.map(u => <MenuItem key={u} value={u}>{u}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={1}>
                  <TextField label="Per Piece Price" name="perPiecePrice" value={item.perPiecePrice} onChange={e => handleItemChange(idx, e)} type="number" fullWidth required />
                </Grid>
                <Grid item xs={12} md={1}>
                  <TextField label="Unit Price" name="unitPrice" value={item.unitPrice} onChange={e => handleItemChange(idx, e)} type="number" fullWidth required InputProps={{ readOnly: true }} />
                </Grid>
                <Grid item xs={12} md={1}>
                  <TextField label="Tax (%)" name="tax" value={item.tax} onChange={e => handleItemChange(idx, e)} type="number" fullWidth />
                </Grid>
                <Grid item xs={12} md={1}>
                  <TextField label="Discount" name="discount" value={item.discount} onChange={e => handleItemChange(idx, e)} type="number" fullWidth />
                </Grid>
                <Grid item xs={12} md={1} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <IconButton color="error" onClick={() => removeItem(idx)} disabled={form.items.length === 1}><DeleteIcon /></IconButton>
                </Grid>
              </React.Fragment>
            ))}
            <Grid item xs={12}>
              <Button startIcon={<AddIcon />} onClick={addItem} variant="outlined" color="primary">Add Item</Button>
            </Grid>
            <Divider sx={{ my: 1.5, width: '100%' }} />
            {/* Totals */}
            <Grid item xs={12}>
              <Typography variant="h6" sx={{ fontWeight: 700 }} gutterBottom>Totals</Typography>
              <Divider sx={{ mb: 2 }} />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField label="Subtotal" value={calculateTotals().subtotal.toFixed(2)} fullWidth InputProps={{ readOnly: true }} />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField label="Tax Total" value={calculateTotals().taxTotal.toFixed(2)} fullWidth InputProps={{ readOnly: true }} />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField 
                label="Shipping Charges" 
                name="shippingCharges" 
                type="number"
                value={form.shippingCharges} 
                onChange={handleChange}
                fullWidth 
                inputProps={{ min: 0, step: '0.01' }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField label="Discount Total" value={calculateTotals().discountTotal.toFixed(2)} fullWidth InputProps={{ readOnly: true }} />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField 
                label="Grand Total" 
                value={calculateTotals().grandTotal.toFixed(2)} 
                fullWidth 
                InputProps={{ 
                  readOnly: true,
                  sx: { 
                    fontSize: '1.25rem',
                    fontWeight: 'bold',
                    '& input': { textAlign: 'right' }
                  } 
                }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField 
                label="Calculated Status" 
                value={getPOStatus()} 
                fullWidth 
                InputProps={{ readOnly: true }}
              />
            </Grid>
            <Divider sx={{ my: 1.5, width: '100%' }} />
            {/* Payment & Delivery */}
            <Grid item xs={12}>
              <Typography variant="h6" sx={{ fontWeight: 700 }} gutterBottom>Payment & Delivery</Typography>
              <Divider sx={{ mb: 2 }} />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Payment Terms</InputLabel>
                <Select name="paymentTerms" value={form.paymentTerms} label="Payment Terms" onChange={handleChange}>
                  <MenuItem value="Net 30">Net 30</MenuItem>
                  <MenuItem value="Net 60">Net 60</MenuItem>
                  <MenuItem value="COD">COD</MenuItem>
                  <MenuItem value="Advance Payment">Advance Payment</MenuItem>
                  <MenuItem value="Partial Payment">Partial Payment</MenuItem>
                  <MenuItem value="Cash Payment">Cash Payment</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            {(form.paymentTerms === 'Net 30' || form.paymentTerms === 'Net 60') && (
              <Grid item xs={12} md={3}>
                <TextField 
                  label="Due Date" 
                  name="dueDate" 
                  value={form.dueDate} 
                  type="date" 
                  fullWidth 
                  InputLabelProps={{ shrink: true }}
                  InputProps={{ readOnly: true }}
                />
              </Grid>
            )}
            {form.paymentTerms === 'Advance Payment' && (
              <>
                <Grid item xs={12} md={3}>
                  <TextField 
                    label="Advance Amount" 
                    name="advanceAmount" 
                    value={form.advanceAmount} 
                    onChange={handleChange} 
                    type="number" 
                    fullWidth 
                    required 
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField 
                    label="Advance Payment Date & Time" 
                    name="advancePaymentDateTime" 
                    value={form.advancePaymentDateTime || ''} 
                    onChange={handleChange} 
                    type="datetime-local" 
                    fullWidth 
                    InputLabelProps={{ shrink: true }}
                    required 
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField 
                    label="Final Payment" 
                    name="finalPayment" 
                    value={form.finalPayment || ''} 
                    onChange={handleChange} 
                    type="number" 
                    fullWidth 
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField 
                    label="Final Payment Date & Time" 
                    name="finalPaymentDateTime" 
                    value={form.finalPaymentDateTime || ''} 
                    onChange={handleChange} 
                    type="datetime-local" 
                    fullWidth 
                    InputLabelProps={{ shrink: true }} 
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField 
                    label="Remaining Payment" 
                    value={getRemainingPayment()} 
                    fullWidth 
                    InputProps={{ readOnly: true }} 
                  />
                </Grid>
              </>
            )}
            {form.paymentTerms === 'Partial Payment' && (
              <>
                <Grid item xs={12} md={3}>
                  <TextField 
                    label="Initial Payment" 
                    name="initialPayment" 
                    value={form.initialPayment || ''} 
                    onChange={handleChange} 
                    type="number" 
                    fullWidth 
                    required 
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField 
                    label="Initial Payment Date & Time" 
                    name="initialPaymentDateTime" 
                    value={form.initialPaymentDateTime || ''} 
                    onChange={handleChange} 
                    type="datetime-local" 
                    fullWidth 
                    required 
                    InputLabelProps={{ shrink: true }} 
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField 
                    label="Final Payment" 
                    name="finalPayment" 
                    value={form.finalPayment || ''} 
                    onChange={handleChange} 
                    type="number" 
                    fullWidth 
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField 
                    label="Final Payment Date & Time" 
                    name="finalPaymentDateTime" 
                    value={form.finalPaymentDateTime || ''} 
                    onChange={handleChange} 
                    type="datetime-local" 
                    fullWidth  
                    InputLabelProps={{ shrink: true }} 
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField 
                    label="Remaining Payment" 
                    value={getRemainingPayment()} 
                    fullWidth 
                    InputProps={{ readOnly: true }} 
                  />
                </Grid>
              </>
            )}
            {form.paymentTerms === 'Cash Payment' && (
              <>
                <Grid item xs={12} md={3}>
                  <TextField label="Cash Paid" name="cashPaid" value={form.cashPaid || ''} onChange={handleChange} type="number" fullWidth required />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField 
                    label="Cash Payment Date & Time" 
                    name="cashPaymentDateTime" 
                    value={form.cashPaymentDateTime || ''} 
                    onChange={handleChange} 
                    type="datetime-local" 
                    fullWidth 
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
              </>
            )}
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Payment Method</InputLabel>
                <Select 
                  name="paymentMethod" 
                  value={form.paymentMethod} 
                  label="Payment Method" 
                  onChange={handleChange}
                  required
                >
                  <MenuItem value="">
                    <em>Select Payment Method</em>
                  </MenuItem>
                  {paymentMethodOptions.map(method => (
                    <MenuItem key={method} value={method}>
                      {method}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            {form.paymentMethod === 'Bank Transfer' && (
              <Grid item xs={12} md={3}>
                <TextField name="bankReceipt" label="Upload Bank Receipt (PNG/JPG/PDF)" type="file" inputProps={{ accept: '.png,.jpg,.jpeg,.pdf' }} onChange={handleFileChange} fullWidth />
              </Grid>
            )}
            {form.paymentMethod === 'Cheque' && (
              <Grid item xs={12} md={3}>
                <TextField name="chequeReceipt" label="Upload Cheque (PNG/JPG/PDF)" type="file" inputProps={{ accept: '.png,.jpg,.jpeg,.pdf' }} onChange={handleFileChange} fullWidth />
              </Grid>
            )}
            
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Delivery Method</InputLabel>
                <Select name="deliveryMethod" value={form.deliveryMethod} label="Delivery Method" onChange={handleChange}>
                  {defaultDeliveryMethods.map(method => <MenuItem key={method} value={method}>{method}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField label="Delivery Location/Warehouse" name="deliveryLocation" value={form.deliveryLocation} onChange={handleChange} fullWidth />
            </Grid>
            <Divider sx={{ my: 1.5, width: '100%' }} />
            {/* Additional Fields */}
            <Grid item xs={12}>
              <Typography variant="h6" sx={{ fontWeight: 700 }} gutterBottom>Review & Metadata</Typography>
              <Divider sx={{ mb: 2 }} />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField label="Created By" name="createdBy" value={form.createdBy} onChange={handleChange} fullWidth />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField label="Approved By" name="approvedBy" value={form.approvedBy} onChange={handleChange} fullWidth />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Purchase Type</InputLabel>
                <Select name="purchaseType" value={form.purchaseType} label="Purchase Type" onChange={handleChange}>
                  {defaultPurchaseTypes.map(type => <MenuItem key={type} value={type}>{type}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Currency</InputLabel>
                <Select name="currency" value={form.currency} label="Currency" onChange={handleChange}>
                  {defaultCurrency.map(cur => <MenuItem key={cur} value={cur}>{cur}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
                <Button variant="outlined" color="inherit" onClick={() => window.history.back()}>Cancel</Button>
                <Button type="submit" variant="contained" color="primary" size="large" startIcon={<AddIcon />} sx={{ py: 1.25, px: 3, fontWeight: 700 }}>
                  Submit Order
                </Button>
              </Box>
            </Grid>
          </Grid>
        </form>
      </Paper>
    </Box>
  );
};

export default AdminPurchaseOrder;
