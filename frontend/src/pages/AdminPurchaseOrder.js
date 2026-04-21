import React, { useState, useEffect } from 'react';
import {
  Box, Typography, TextField, Button, Paper, Grid, MenuItem,
  Fade, Select, InputLabel, FormControl, IconButton, Divider,
  Avatar, Card, CardContent,
  // Dialog imports
  Dialog, DialogTitle, DialogContent, DialogActions,
  InputAdornment, CircularProgress, Stack, Alert,
  Chip
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useSelector, useDispatch } from 'react-redux';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ReceiptIcon from '@mui/icons-material/Receipt';
// AddProduct dialog icons
import CategoryIcon from '@mui/icons-material/Category';
import BrandingWatermarkIcon from '@mui/icons-material/BrandingWatermark';
import ColorLensIcon from '@mui/icons-material/ColorLens';
import InventoryIcon from '@mui/icons-material/Inventory';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import StorefrontIcon from '@mui/icons-material/Storefront';
import QrCodeIcon from '@mui/icons-material/QrCode';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CloseIcon from '@mui/icons-material/Close';

import API from '../api/api';
import { useDarkMode } from '../context/DarkModeContext';
import { fetchProducts } from '../redux/productsSlice';

// ─── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_UOM = ['pieces'];
const DEFAULT_STATUS = ['Pending', 'Approved', 'Received', 'Partially Received', 'Cancelled'];
const PAYMENT_METHOD_OPTIONS = ['Bank Transfer', 'Cheque', 'Cash Payment'];
const DEFAULT_DELIVERY_METHODS = ['Courier', 'In-house transport'];
const DEFAULT_PURCHASE_TYPES = ['Local', 'International'];
const DEFAULT_CURRENCY = ['PKR', 'DOLLAR', 'YAN'];

const DEFAULT_CATEGORIES = [
  'Electronics', 'Clothing', 'Home Appliances', 'Books', 'Other',
];

const EMPTY_ITEM = {
  itemSource: 'AdminProductList',
  itemCode: '',
  itemName: '',
  description: '',
  cartonQuantity: '',
  losePieces: '',
  quantityOrdered: '',
  uom: 'pieces',
  perPiecePrice: '',
  unitPrice: '',
  tax: '',
  discount: '',
  totalLineAmount: 0,
};

const INITIAL_FORM = {
  poNumber: '',
  poDate: new Date().toISOString().slice(0, 10),
  dueDate: '',
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
  items: [{ ...EMPTY_ITEM }],
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
  cashPaymentDateTime: '',
};

// ─── Empty Add-Product form state ─────────────────────────────────────────────

const EMPTY_PRODUCT_FORM = {
  name: '',
  category: '',
  subCategory: '',
  brand: '',
  vendor: '',
  color: '',
  costPerPiece: '',
  sellingPerPiece: '',
  piecesPerCarton: '',
  SKU: '',
  image: '',
  warrantyMonths: '12',
  warehouseAddress: '',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const generatePONumber = () => `PO-${Date.now()}`;

const calculateDueDate = (paymentTerms, poDate) => {
  if (!poDate || !['Net 30', 'Net 60'].includes(paymentTerms)) return '';
  const date = new Date(poDate);
  date.setDate(date.getDate() + (paymentTerms === 'Net 30' ? 30 : 60));
  return date.toISOString().split('T')[0];
};

const normalizeDateTime = (v) => {
  if (!v) return '';
  try { return new Date(v).toISOString(); } catch { return v; }
};

const uploadFile = async (file) => {
  const formData = new FormData();
  formData.append('image', file);
  try {
    const response = await fetch('http://localhost:5000/api/upload', {
      method: 'POST',
      body: formData,
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    if (!response.ok) throw new Error('Upload failed');
    const data = await response.json();
    return data.url;
  } catch (error) {
    console.error('File upload error:', error);
    return null;
  }
};

const generateSKU = (name = '') => {
  const prefix = (String(name).trim().slice(0, 3) || 'PRD').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const randomPart = Math.random().toString(36).slice(2, 7).toUpperCase();
  const timestamp = Date.now().toString().slice(-6);
  return `${prefix}-${randomPart}-${timestamp}`;
};

// ─── Add Product Dialog Component ─────────────────────────────────────────────

const AddProductDialog = ({ open, onClose, onProductAdded, vendorName, darkMode }) => {
  const [productForm, setProductForm] = useState({ ...EMPTY_PRODUCT_FORM });
  const [imageFile, setImageFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [categories, setCategories] = useState(() => {
    // Load categories from localStorage or use defaults
    const savedCategories = localStorage.getItem('productCategories');
    return savedCategories ? JSON.parse(savedCategories) : DEFAULT_CATEGORIES;
  });
  const [addCatOpen, setAddCatOpen] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [vendors, setVendors] = useState([]);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // Pre-fill vendor if one is selected in the PO
  useEffect(() => {
    if (open && vendorName) {
      setProductForm((prev) => ({ ...prev, vendor: vendorName }));
    }
  }, [open, vendorName]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setProductForm({ ...EMPTY_PRODUCT_FORM });
      setImageFile(null);
      setSuccess('');
      setError('');
    }
  }, [open]);

  // Fetch vendors and categories for the dialog dropdown
  useEffect(() => {
    if (!open) return;
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');
        
        // Fetch vendors
        const vendorsRes = await API.get('/vendors', { 
          headers: { Authorization: `Bearer ${token}` } 
        });
        setVendors(vendorsRes.data);
        
        // Fetch products to get existing categories
        const productsRes = await API.get('/products', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const productCategories = Array.from(new Set(productsRes.data.map(p => p.category).filter(Boolean)));
        
        // Get saved categories from localStorage
        const savedCategories = localStorage.getItem('productCategories');
        const userAddedCategories = savedCategories ? JSON.parse(savedCategories) : [];
        
        // Combine all categories and remove duplicates
        const allCategories = Array.from(new Set([
          ...DEFAULT_CATEGORIES,
          ...productCategories,
          ...userAddedCategories
        ]));
        
        setCategories(allCategories);
        
      } catch (err) {
        console.error('Error fetching data:', err);
        setVendors([]);
      }
    };
    fetchData();
  }, [open]);

  const handleChange = (e) => {
    setProductForm({ ...productForm, [e.target.name]: e.target.value });
  };

  const handleImageChange = (e) => {
    setImageFile(e.target.files[0]);
  };

  const handleImageUpload = async () => {
    if (!imageFile) return;
    setUploading(true);
    const token = localStorage.getItem('token');
    const formData = new FormData();
    formData.append('image', imageFile);
    try {
      const res = await API.post('/upload', formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });
      setProductForm((prev) => ({ ...prev, image: res.data.url }));
      setUploading(false);
      setError('');
    } catch {
      setError('Image upload failed');
      setUploading(false);
    }
  };

  const handleAddCategory = () => {
    if (newCategory && !categories.includes(newCategory)) {
      const updatedCategories = [...categories, newCategory];
      setCategories(updatedCategories);
      localStorage.setItem('productCategories', JSON.stringify(updatedCategories));
      setNewCategory('');
      setAddCatOpen(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (imageFile && !productForm.image) {
      setError('Please upload the image first before submitting.');
      return;
    }
    try {
      const token = localStorage.getItem('token');
      // Saved with zero stock — quantity will be updated when PO order status becomes Received
      const cartonQty = 0;
      const losePieces = 0;
      const piecesPerCarton = Number(productForm.piecesPerCarton) || 0;
      const totalPieces = 0;
      const stockQuantity = 0;
      const costPerPiece = Number(productForm.costPerPiece) || 0;
      const costPerCarton = 0;
      const sellingPerPiece = Number(productForm.sellingPerPiece) || 0;
      const sellingPerCarton = piecesPerCarton * sellingPerPiece || 0;
      const perPieceProfit = sellingPerPiece - costPerPiece;
      const totalUnitProfit = 0;
      const totalUnitCost = 0;
      const skuValue = String(productForm.SKU || '').trim() || generateSKU(productForm.name);

      const res = await API.post(
        '/products',
        {
          name: productForm.name,
          category: productForm.category,
          subCategory: productForm.subCategory,
          brand: productForm.brand,
          vendor: productForm.vendor,
          color: productForm.color,
          costPerPiece,
          costPerCarton,
          sellingPerPiece,
          sellingPerCarton,
          cartonQuantity: cartonQty,
          piecesPerCarton,
          losePieces,
          stockQuantity,
          totalPieces,
          perPieceProfit,
          totalUnitProfit,
          totalUnitCost,
          SKU: skuValue,
          image: productForm.image,
          warrantyMonths: Number(productForm.warrantyMonths) || 12,
          warehouseAddress: productForm.warehouseAddress,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const createdProduct = res.data;
      setSuccess(`Product "${productForm.name}" added with zero stock! SKU: ${skuValue}`);
      setError('');

      // Notify parent with the created product so it can auto-fill item row
      if (onProductAdded) onProductAdded(createdProduct || { ...productForm, SKU: skuValue });

      // Auto-close after brief success display
      setTimeout(() => {
        onClose();
      }, 1800);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add product. Please try again.');
      setSuccess('');
    }
  };

  const fieldSx = { '& .MuiOutlinedInput-root': { borderRadius: 2 } };

  const sectionCardSx = {
    mb: 2,
    borderRadius: 2,
    boxShadow: darkMode ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.06)',
    background: darkMode ? 'rgba(40,40,40,0.85)' : '#fafafa',
    border: darkMode ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(0,0,0,0.06)',
  };

  return (
    <Box>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="md"
        fullWidth
        scroll="paper"
        PaperProps={{
          sx: {
            borderRadius: 3,
            background: darkMode ? 'rgba(24,24,24,0.98)' : '#fff',
            boxShadow: darkMode
              ? '0 24px 64px rgba(0,0,0,0.7)'
              : '0 24px 64px rgba(0,0,0,0.15)',
          },
        }}
      >
        {/* ── Dialog Title ── */}
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            pb: 1,
            borderBottom: darkMode
              ? '1px solid rgba(255,255,255,0.08)'
              : '1px solid rgba(0,0,0,0.08)',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar sx={{ bgcolor: 'primary.main', width: 44, height: 44 }}>
              <InventoryIcon />
            </Avatar>
            <Box>
              <Typography variant="h6" fontWeight={700}>
                Add New Product
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Fill in the details — the product will be saved and auto-filled into your order
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        {/* ── Dialog Content ── */}
        <DialogContent sx={{ pt: 2 }}>
          {/* Vendor pre-fill notice */}
          {vendorName && (
            <Alert
              severity="info"
              icon={<StorefrontIcon fontSize="inherit" />}
              sx={{ mb: 2, borderRadius: 2 }}
            >
              Vendor pre-filled as <strong>{vendorName}</strong> from your purchase order.
            </Alert>
          )}

          {success && (
            <Alert
              severity="success"
              icon={<CheckCircleOutlineIcon fontSize="inherit" />}
              sx={{ mb: 2, borderRadius: 2 }}
            >
              {success}
            </Alert>
          )}
          {error && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
              {error}
            </Alert>
          )}

          <form id="add-product-dialog-form" onSubmit={handleSubmit}>
            <Grid container spacing={2}>

              {/* ── Product Details Card ── */}
              <Grid item xs={12}>
                <Card sx={sectionCardSx}>
                  <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <InventoryIcon color={darkMode ? 'secondary' : 'primary'} sx={{ mr: 1 }} />
                      <Typography variant="subtitle1" fontWeight={600}>
                        Product Details
                      </Typography>
                    </Box>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={6}>
                        <TextField
                          label="Product Name"
                          name="name"
                          fullWidth
                          value={productForm.name}
                          onChange={handleChange}
                          required
                          variant="outlined"
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <InventoryIcon fontSize="small" />
                              </InputAdornment>
                            ),
                          }}
                          sx={fieldSx}
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <TextField
                          select
                          label="Category"
                          name="category"
                          fullWidth
                          value={productForm.category}
                          onChange={handleChange}
                          required
                          variant="outlined"
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <CategoryIcon fontSize="small" />
                              </InputAdornment>
                            ),
                          }}
                          sx={fieldSx}
                        >
                          {categories.map((cat) => (
                            <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                          ))}
                          <MenuItem value="add-category" onClick={() => setAddCatOpen(true)}>
                            <strong>+ Add Category</strong>
                          </MenuItem>
                        </TextField>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <TextField
                          label="Sub-Category"
                          name="subCategory"
                          fullWidth
                          value={productForm.subCategory}
                          onChange={handleChange}
                          variant="outlined"
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <AccountTreeIcon fontSize="small" />
                              </InputAdornment>
                            ),
                          }}
                          sx={fieldSx}
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <TextField
                          label="Brand / Company"
                          name="brand"
                          fullWidth
                          value={productForm.brand}
                          onChange={handleChange}
                          variant="outlined"
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <BrandingWatermarkIcon fontSize="small" />
                              </InputAdornment>
                            ),
                          }}
                          sx={fieldSx}
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <TextField
                          select
                          label="Vendor"
                          name="vendor"
                          fullWidth
                          value={productForm.vendor}
                          onChange={handleChange}
                          required
                          variant="outlined"
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <StorefrontIcon fontSize="small" />
                              </InputAdornment>
                            ),
                          }}
                          sx={fieldSx}
                        >
                          {vendors.map((v) => (
                            <MenuItem key={v._id} value={v.vendorName}>
                              {v.vendorName}
                            </MenuItem>
                          ))}
                        </TextField>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <TextField
                          label="Color"
                          name="color"
                          fullWidth
                          value={productForm.color}
                          onChange={handleChange}
                          variant="outlined"
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <ColorLensIcon fontSize="small" />
                              </InputAdornment>
                            ),
                          }}
                          sx={fieldSx}
                        />
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>

              {/* ── Pricing & Stock Card ── */}
              <Grid item xs={12}>
                <Card sx={sectionCardSx}>
                  <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <AttachFileIcon color={darkMode ? 'secondary' : 'primary'} sx={{ mr: 1 }} />
                      <Typography variant="subtitle1" fontWeight={600}>
                        Pricing & Stock
                      </Typography>
                    </Box>
                    <Alert severity="info" sx={{ mb: 2, borderRadius: 2, py: 0.5 }}>
                      Product will be saved with <strong>zero stock</strong>. Carton Qty &amp; Lose Pieces are entered in the Items section below — stock updates automatically when order status is set to <strong>Received</strong>.
                    </Alert>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={4}>
                        <TextField
                          label="Cost Per Piece"
                          name="costPerPiece"
                          type="number"
                          fullWidth
                          value={productForm.costPerPiece}
                          onChange={handleChange}
                          required
                          variant="outlined"
                          InputProps={{ startAdornment: <InputAdornment position="start">Rs</InputAdornment> }}
                          inputProps={{ min: 0, sx: { '&::-webkit-outer-spin-button, &::-webkit-inner-spin-button': { display: 'none' }, '&[type=number]': { MozAppearance: 'textfield' } } }}
                          sx={fieldSx}
                        />
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <TextField
                          label="Selling Per Piece"
                          name="sellingPerPiece"
                          type="number"
                          fullWidth
                          value={productForm.sellingPerPiece}
                          onChange={handleChange}
                          required
                          variant="outlined"
                          InputProps={{ startAdornment: <InputAdornment position="start">Rs</InputAdornment> }}
                          inputProps={{ min: 0, sx: { '&::-webkit-outer-spin-button, &::-webkit-inner-spin-button': { display: 'none' }, '&[type=number]': { MozAppearance: 'textfield' } } }}
                          sx={fieldSx}
                        />
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <TextField
                          label="Pieces Per Carton"
                          name="piecesPerCarton"
                          type="number"
                          fullWidth
                          value={productForm.piecesPerCarton}
                          onChange={handleChange}
                          required
                          variant="outlined"
                          inputProps={{ min: 0, sx: { '&::-webkit-outer-spin-button, &::-webkit-inner-spin-button': { display: 'none' }, '&[type=number]': { MozAppearance: 'textfield' } } }}
                          sx={fieldSx}
                        />
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <TextField
                          label="Warranty (months)"
                          name="warrantyMonths"
                          type="number"
                          fullWidth
                          value={productForm.warrantyMonths}
                          onChange={handleChange}
                          helperText="Default: 12 months"
                          variant="outlined"
                          inputProps={{ min: 0, sx: { '&::-webkit-outer-spin-button, &::-webkit-inner-spin-button': { display: 'none' }, '&[type=number]': { MozAppearance: 'textfield' } } }}
                          sx={fieldSx}
                        />
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <TextField
                          label="SKU / Barcode"
                          name="SKU"
                          fullWidth
                          value={productForm.SKU}
                          onChange={handleChange}
                          required
                          variant="outlined"
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <QrCodeIcon fontSize="small" />
                              </InputAdornment>
                            ),
                          }}
                          sx={fieldSx}
                        />
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <TextField
                          label="Warehouse Address"
                          name="warehouseAddress"
                          fullWidth
                          value={productForm.warehouseAddress}
                          onChange={handleChange}
                          variant="outlined"
                          placeholder="Enter warehouse address"
                          sx={fieldSx}
                        />
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>

              {/* ── Product Image Card ── */}
              <Grid item xs={12}>
                <Card sx={sectionCardSx}>
                  <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <AttachFileIcon color={darkMode ? 'secondary' : 'primary'} sx={{ mr: 1 }} />
                      <Typography variant="subtitle1" fontWeight={600}>
                        Product Image
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                        (optional)
                      </Typography>
                    </Box>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="center">
                      <Button
                        variant="outlined"
                        component="label"
                        startIcon={<AttachFileIcon />}
                        sx={{ borderRadius: 2, py: 1.5, flex: 1, minWidth: 160 }}
                      >
                        {imageFile ? imageFile.name : 'Select Image'}
                        <input type="file" accept="image/*" hidden onChange={handleImageChange} />
                      </Button>
                      {imageFile && (
                        <Button
                          variant="contained"
                          color="primary"
                          onClick={handleImageUpload}
                          disabled={uploading}
                          sx={{ borderRadius: 2, py: 1.5, minWidth: 110 }}
                        >
                          {uploading ? <CircularProgress size={20} color="inherit" /> : 'Upload'}
                        </Button>
                      )}
                      {productForm.image && (
                        <Chip
                          label="Uploaded ✓"
                          color="success"
                          variant="outlined"
                          size="small"
                        />
                      )}
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>

            </Grid>
          </form>
        </DialogContent>

        {/* ── Dialog Actions ── */}
        <DialogActions
          sx={{
            px: 3,
            py: 2,
            borderTop: darkMode
              ? '1px solid rgba(255,255,255,0.08)'
              : '1px solid rgba(0,0,0,0.08)',
            gap: 1,
          }}
        >
          <Button
            onClick={onClose}
            variant="outlined"
            color="inherit"
            sx={{ borderRadius: 2 }}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="add-product-dialog-form"
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            sx={{
              borderRadius: 2,
              fontWeight: 700,
              background: darkMode
                ? 'linear-gradient(45deg, #90caf9, #64b5f6)'
                : 'linear-gradient(45deg, #1976d2, #42a5f5)',
              '&:hover': {
                background: darkMode
                  ? 'linear-gradient(45deg, #64b5f6, #42a5f5)'
                  : 'linear-gradient(45deg, #1565c0, #2196f3)',
              },
            }}
          >
            Add Product
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Nested: Add Category Dialog ── */}
      <Dialog open={addCatOpen} onClose={() => setAddCatOpen(false)}>
        <DialogTitle>Add New Category</DialogTitle>
        <DialogContent>
          <TextField
            label="Category Name"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            fullWidth
            autoFocus
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddCatOpen(false)}>Cancel</Button>
          <Button onClick={handleAddCategory} variant="contained" color="primary">
            Add
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const AdminPurchaseOrder = () => {
  const { darkMode } = useDarkMode();
  const dispatch = useDispatch();
  const products = useSelector((state) => state.products.items);
  const theme = useTheme();
  const isSm = useMediaQuery(theme.breakpoints.down('sm'));
  const isMd = useMediaQuery(theme.breakpoints.down('md'));

  const [form, setForm] = useState(INITIAL_FORM);
  const [vendors, setVendors] = useState([]);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // ── Add Product Dialog state ──
  const [addProductDialogOpen, setAddProductDialogOpen] = useState(false);
  const [addProductTargetIdx, setAddProductTargetIdx] = useState(null);

  // ─── Effects ───────────────────────────────────────────────────────────────

  useEffect(() => {
    const token = localStorage.getItem('token');
    API.get('/vendors', { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => setVendors(res.data))
      .catch(() => setVendors([]));
  }, []);

  useEffect(() => {
    dispatch(fetchProducts());
  }, [dispatch]);

  // ─── Derived State ─────────────────────────────────────────────────────────

  const filteredProducts = form.vendorName
    ? products.filter((p) => p.vendor === form.vendorName)
    : products;

  // ─── Calculations ──────────────────────────────────────────────────────────

  const calculateTotals = () => {
    let subtotal = 0, taxTotal = 0, discountTotal = 0;
    form.items.forEach((item) => {
      subtotal += Number(item.unitPrice) || 0;
      taxTotal += Number(item.tax) || 0;
      discountTotal += Number(item.discount) || 0;
    });
    const shipping = Number(form.shippingCharges) || 0;
    const grandTotal = subtotal + taxTotal - discountTotal + shipping;
    return { subtotal, taxTotal, discountTotal, grandTotal, shipping };
  };

  const getPaidAmount = () => {
    if (form.paymentTerms === 'Advance Payment') return Number(form.advanceAmount) || 0;
    if (form.paymentTerms === 'Partial Payment') return Number(form.initialPayment) || 0;
    if (form.paymentTerms === 'Cash Payment') return Number(form.cashPaid) || 0;
    return 0;
  };

  const getRemainingPayment = () => {
    const { grandTotal } = calculateTotals();
    const paid = getPaidAmount();
    const finalPayment = Number(form.finalPayment) || 0;
    return Math.max(grandTotal - (paid + finalPayment), 0);
  };

  const getPOStatus = () => {
    const { grandTotal } = calculateTotals();
    const paid = getPaidAmount();
    if (paid >= grandTotal && grandTotal > 0) return 'Paid';
    return form.orderStatus;
  };

  // Helper function to check if payments are insufficient
  const arePaymentsInsufficient = () => {
    const { grandTotal } = calculateTotals();
    if (!grandTotal) return false;
    const cashPaid = Number(form.cashPaid) || 0;
    return cashPaid < grandTotal;
  };

  // Item section styles
  const itemCardSx = {
    border: darkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(25,118,210,0.18)',
    borderRadius: 2,
    p: 2,
    mb: 1,
    background: darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(25,118,210,0.02)',
    position: 'relative',
  };

  const itemHeaderSx = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    mb: 1.5,
    pb: 1,
    borderBottom: darkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(25,118,210,0.12)',
  };

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === 'paymentTerms' || name === 'poDate') {
      const newForm = { ...form, [name]: value };
      newForm.dueDate = calculateDueDate(
        name === 'paymentTerms' ? value : form.paymentTerms,
        name === 'poDate' ? value : form.poDate
      );
      setForm(newForm);
      return;
    }

    if (name === 'vendorName') {
      const selectedVendor = vendors.find((v) => v.vendorName === value);
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
          items: [{ ...EMPTY_ITEM }],
        });
        return;
      }
    }

    setForm({ ...form, [name]: value });
  };

  const handleItemChange = (idx, e) => {
    const { name, value } = e.target;
    const items = [...form.items];
    items[idx] = { ...items[idx], [name]: value };

    if (name === 'itemCode') {
      const selected = products.find((p) => p.SKU === value);
      if (selected) {
        items[idx].itemName = selected.name;
        items[idx].perPiecePrice = selected.costPerPiece;
        items[idx].description = selected.category;
        items[idx].piecesPerCarton = selected.piecesPerCarton || '';
      }
    }

    // Recalculate quantityOrdered and unitPrice whenever relevant fields change
    if (['cartonQuantity', 'losePieces', 'piecesPerCarton', 'perPiecePrice', 'itemCode'].includes(name)) {
      const cartons = Number(items[idx].cartonQuantity) || 0;
      const piecesPerCarton = Number(items[idx].piecesPerCarton) || 1;
      const loose = Number(items[idx].losePieces) || 0;
      const qty = cartons * piecesPerCarton + loose;
      items[idx].quantityOrdered = qty;
      const perPiece = Number(items[idx].perPiecePrice) || 0;
      items[idx].unitPrice = (qty * perPiece).toFixed(2);
    }

    setForm({ ...form, items });
  };

  const handleItemSourceChange = (idx, value) => {
    const items = [...form.items];
    items[idx] = {
      ...items[idx],
      itemSource: value,
      ...(value === 'AdminProductList' && {
        itemCode: '',
        itemName: '',
        description: '',
        perPiecePrice: '',
      }),
    };
    setForm({ ...form, items });

    // Open Add Product dialog when user switches to "NewProduct"
    if (value === 'NewProduct') {
      setAddProductTargetIdx(idx);
      setAddProductDialogOpen(true);
    }
  };

  const addItem = () => {
    setForm({ ...form, items: [...form.items, { ...EMPTY_ITEM }] });
  };

  const removeItem = (idx) => {
    setForm({ ...form, items: form.items.filter((_, i) => i !== idx) });
  };

  const handleFileChange = async (e) => {
    const { name } = e.target;
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    if (name === 'bankReceipt' || name === 'chequeReceipt') {
      try {
        const url = await uploadFile(files[0]);
        if (url) {
          setForm((prev) => ({
            ...prev,
            [name]: url,
            attachments: [...(prev.attachments || []), url],
          }));
        }
      } catch (err) {
        console.error('Error uploading receipt:', err);
      }
      return;
    }

    try {
      const urls = await Promise.all(files.map(uploadFile));
      const validUrls = urls.filter(Boolean);
      setForm((prev) => ({
        ...prev,
        attachments: [...(prev.attachments || []), ...validUrls],
      }));
    } catch (err) {
      console.error('Error handling files:', err);
    }
  };

  // Called when a product is successfully created inside the dialog
  const handleProductAdded = (newProduct) => {
    dispatch(fetchProducts()); // refresh redux store

    if (addProductTargetIdx !== null) {
      const items = [...form.items];
      const piecesPerCarton = Number(newProduct.piecesPerCarton) || 1;
      const cartons = Number(items[addProductTargetIdx].cartonQuantity) || 0;
      const loose = Number(items[addProductTargetIdx].losePieces) || 0;
      const qty = cartons * piecesPerCarton + loose;
      const perPiece = Number(newProduct.costPerPiece) || 0;
      items[addProductTargetIdx] = {
        ...items[addProductTargetIdx],
        itemCode: newProduct.SKU || '',
        itemName: newProduct.name || '',
        description: newProduct.category || '',
        perPiecePrice: newProduct.costPerPiece || '',
        piecesPerCarton: newProduct.piecesPerCarton || '',
        quantityOrdered: qty,
        unitPrice: qty && perPiece ? (qty * perPiece).toFixed(2) : '',
      };
      setForm({ ...form, items });
    }

    setAddProductTargetIdx(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccess('');
    setError('');

    const totals = calculateTotals();

    const sanitizedItems = form.items
      .map((item) =>
        Object.fromEntries(
          Object.entries({
            ...item,
            quantityOrdered: Number(item.quantityOrdered) || 0,
            perPiecePrice: Number(item.perPiecePrice) || 0,
            unitPrice: Number(item.unitPrice) || 0,
            tax: Number(item.tax) || 0,
            discount: Number(item.discount) || 0,
            shippingCharges: Number(form.shippingCharges) || 0,
            cartonQuantity: Number(item.cartonQuantity) || 0,
            losePieces: Number(item.losePieces) || 0,
            piecesPerCarton: Number(item.piecesPerCarton) || 0,
          }).filter(([, v]) => v !== '')
        )
      )
      .filter((item) => item.itemCode?.trim());

    if (!form.poNumber || !form.vendorName || !sanitizedItems.length) {
      setError('PO Number, Vendor Name, and at least one valid item are required.');
      return;
    }

    const rawPayload = {
      ...form,
      ...totals,
      items: sanitizedItems,
      advanceAmount: Number(form.advanceAmount) || undefined,
      creditAmount: Number(form.creditAmount) || undefined,
      initialPayment: Number(form.initialPayment) || undefined,
      finalPayment: Number(form.finalPayment) || undefined,
      advancePaymentDateTime: normalizeDateTime(form.advancePaymentDateTime) || undefined,
      initialPaymentDateTime: normalizeDateTime(form.initialPaymentDateTime) || undefined,
      finalPaymentDateTime: normalizeDateTime(form.finalPaymentDateTime) || undefined,
      cashPaymentDateTime: normalizeDateTime(form.cashPaymentDateTime) || undefined,
    };

    const payload = Object.fromEntries(
      Object.entries(rawPayload).filter(([, v]) => v !== undefined && v !== '')
    );

    try {
      await API.post('/purchase-orders', payload);
      setSuccess('Purchase Order Submitted!');
      setForm({ ...INITIAL_FORM, items: [{ ...EMPTY_ITEM }] });
    } catch (err) {
      console.error('Backend error:', err);
      const msg = err.response?.data?.message;
      setError(msg ? `Failed to submit order: ${msg}` : 'Failed to submit order');
    }
  };

  // ─── Styles ────────────────────────────────────────────────────────────────

  const paperSx = {
    width: '100%',
    maxWidth: '1800px',
    p: { xs: 2, sm: 4 },
    borderRadius: 4,
    background: darkMode ? 'rgba(30, 30, 30, 0.95)' : 'rgba(255, 255, 255, 0.98)',
    backdropFilter: 'blur(10px)',
    border: darkMode ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(255, 255, 255, 0.2)',
    boxShadow: darkMode ? '0 20px 40px rgba(0,0,0,0.5)' : '0 20px 40px rgba(0,0,0,0.1)',
  };

  const headerSx = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexDirection: { xs: 'column', sm: 'row' },
    gap: 2,
    mb: 2,
    p: { xs: 2, sm: 3 },
    borderRadius: { xs: 2, sm: 3 },
    background: `linear-gradient(135deg, ${darkMode ? 'rgba(25,118,210,0.1)' : 'rgba(255,255,255,0.9)'} 0%, ${darkMode ? 'rgba(66,165,245,0.05)' : 'rgba(248,249,250,0.8)'} 100%)`,
    backdropFilter: 'blur(10px)',
    border: `1px solid ${darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}`,
    boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
    position: 'relative',
    overflow: 'hidden',
  };

  const submitBtnSx = {
    py: 1.25,
    px: 3,
    fontWeight: 700,
    width: { xs: '100%', sm: 'auto' },
    background: darkMode
      ? 'linear-gradient(45deg, #90caf9, #64b5f6)'
      : 'linear-gradient(45deg, #1976d2, #42a5f5)',
    color: '#fff',
    '&:hover': {
      background: darkMode
        ? 'linear-gradient(45deg, #64b5f6, #42a5f5)'
        : 'linear-gradient(45deg, #1565c0, #2196f3)',
      transform: 'translateY(-1px)',
    },
    transition: 'all 0.3s ease',
  };

  const addItemBtnSx = {
    borderColor: darkMode ? 'rgba(144,202,249,0.6)' : undefined,
    color: darkMode ? '#90caf9' : undefined,
    '&:hover': {
      borderColor: darkMode ? '#64b5f6' : undefined,
      backgroundColor: darkMode ? 'rgba(100,181,246,0.08)' : 'rgba(25,118,210,0.08)',
      transform: 'translateY(-1px)',
    },
    transition: 'all 0.3s ease',
  };

  // ─── Sub-renders ───────────────────────────────────────────────────────────

  const renderSectionHeader = (title) => (
    <Grid item xs={12}>
      <Typography variant="h6" sx={{ fontWeight: 700 }} gutterBottom>{title}</Typography>
      <Divider sx={{ mb: 2 }} />
    </Grid>
  );

  const renderAdvancePaymentFields = () => (
    <>
      <Grid item xs={12} sm={6} md={3}>
        <TextField label="Advance Amount" name="advanceAmount" value={form.advanceAmount} onChange={handleChange} type="number" fullWidth required inputProps={{ min: 0, sx: { '&::-webkit-outer-spin-button, &::-webkit-inner-spin-button': { display: 'none' }, '&[type=number]': { MozAppearance: 'textfield' } } }} />
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <TextField label="Advance Payment Date & Time" name="advancePaymentDateTime" value={form.advancePaymentDateTime} onChange={handleChange} type="datetime-local" fullWidth InputLabelProps={{ shrink: true }} required />
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <TextField label="Final Payment" name="finalPayment" value={form.finalPayment} onChange={handleChange} type="number" fullWidth inputProps={{ min: 0, sx: { '&::-webkit-outer-spin-button, &::-webkit-inner-spin-button': { display: 'none' }, '&[type=number]': { MozAppearance: 'textfield' } } }} />
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <TextField label="Final Payment Date & Time" name="finalPaymentDateTime" value={form.finalPaymentDateTime} onChange={handleChange} type="datetime-local" fullWidth InputLabelProps={{ shrink: true }} />
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <TextField label="Remaining Payment" value={getRemainingPayment()} fullWidth InputProps={{ readOnly: true }} />
      </Grid>
    </>
  );

  const renderPartialPaymentFields = () => (
    <>
      <Grid item xs={12} sm={6} md={3}>
        <TextField label="Initial Payment" name="initialPayment" value={form.initialPayment} onChange={handleChange} type="number" fullWidth required inputProps={{ min: 0, sx: { '&::-webkit-outer-spin-button, &::-webkit-inner-spin-button': { display: 'none' }, '&[type=number]': { MozAppearance: 'textfield' } } }} />
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <TextField label="Initial Payment Date & Time" name="initialPaymentDateTime" value={form.initialPaymentDateTime} onChange={handleChange} type="datetime-local" fullWidth required InputLabelProps={{ shrink: true }} />
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <TextField label="Final Payment" name="finalPayment" value={form.finalPayment} onChange={handleChange} type="number" fullWidth inputProps={{ min: 0, sx: { '&::-webkit-outer-spin-button, &::-webkit-inner-spin-button': { display: 'none' }, '&[type=number]': { MozAppearance: 'textfield' } } }} />
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <TextField label="Final Payment Date & Time" name="finalPaymentDateTime" value={form.finalPaymentDateTime} onChange={handleChange} type="datetime-local" fullWidth InputLabelProps={{ shrink: true }} />
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <TextField label="Remaining Payment" value={getRemainingPayment()} fullWidth InputProps={{ readOnly: true }} />
      </Grid>
    </>
  );

  const totals = calculateTotals();

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <Fade in timeout={500}>
      <Box sx={{ minHeight: '100vh', background: darkMode ? '#0d1117' : '#f4f6fa' }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', minHeight: '100vh', px: { xs: 1, sm: 1, md: 2 }, py: { xs: 2, sm: 3 } }}>
          <Paper elevation={24} sx={paperSx}>

            {/* ── Header ── */}
            <Box sx={headerSx}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: { xs: '100%', sm: 'auto' }, textAlign: { xs: 'center', sm: 'left' }, flexDirection: { xs: 'column', sm: 'row' } }}>
                <Avatar sx={{ bgcolor: 'primary.main', width: { xs: 56, md: 64 }, height: { xs: 56, md: 64 } }}>
                  <ReceiptIcon sx={{ fontSize: { xs: 32, md: 36 } }} />
                </Avatar>
                <Box>
                  <Typography variant="h4" color="primary" sx={{ fontWeight: 700, fontSize: { xs: '1.5rem', sm: '2.25rem' } }}>
                    Create Purchase Order
                  </Typography>
                  <Typography variant="body2" color={darkMode ? 'rgba(255,255,255,0.75)' : 'text.secondary'}>
                    Fill in the details below to create a new purchase order
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ textAlign: { xs: 'center', sm: 'right' }, width: { xs: '100%', sm: 'auto' } }}>
                <Typography variant="overline" color="text.secondary">Grand Total</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>
                  {totals.grandTotal.toFixed(2)} {form.currency}
                </Typography>
              </Box>
            </Box>

            <Divider sx={{ mb: 3 }} />

            <form onSubmit={handleSubmit}>

              {/* ── Alerts ── */}
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

              <Grid container spacing={{ xs: 2, sm: 3 }} sx={{ width: '100%' }}>

                {/* ── PO Details ── */}
                {renderSectionHeader('PO Details')}

                <Grid item xs={12} sm={6} md={3}>
                  <TextField label="PO Number" name="poNumber" value={form.poNumber} onChange={handleChange} fullWidth placeholder="Auto or manual" />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth>
                    <InputLabel>Payment Status</InputLabel>
                    <Select name="paymentStatus" value={form.paymentStatus} label="Payment Status" onChange={handleChange}>
                      <MenuItem value="Unpaid">Unpaid</MenuItem>
                      <MenuItem value="Partially Paid">Partially Paid</MenuItem>
                      <MenuItem value="Paid">Paid</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField label="PO Date" name="poDate" value={form.poDate} onChange={handleChange} type="date" fullWidth InputLabelProps={{ shrink: true }} required />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField label="Expected Delivery Date" name="expectedDeliveryDate" value={form.expectedDeliveryDate} onChange={handleChange} type="date" fullWidth InputLabelProps={{ shrink: true }} />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth>
                    <InputLabel>Order Status</InputLabel>
                    <Select name="orderStatus" value={form.orderStatus} label="Order Status" onChange={handleChange}>
                      {DEFAULT_STATUS.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <TextField label="Reference/Notes" name="reference" value={form.reference} onChange={handleChange} fullWidth multiline rows={2} placeholder="Optional notes for this PO" />
                </Grid>

                <Divider sx={{ my: 1.5, width: '100%' }} />

                {/* ── Vendor ── */}
                {renderSectionHeader('Vendor')}

                <Grid item xs={12} sm={6} md={4}>
                  <FormControl fullWidth required>
                    <InputLabel>Vendor</InputLabel>
                    <Select name="vendorName" value={form.vendorName} label="Vendor" onChange={handleChange}>
                      {vendors.map((v) => (
                        <MenuItem key={v._id} value={v.vendorName}>{v.vendorName}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <TextField label="Vendor ID" name="vendorId" value={form.vendorId} InputProps={{ readOnly: true }} fullWidth />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField label="Vendor Address" name="vendorAddress" value={form.vendorAddress} onChange={handleChange} fullWidth />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField label="Vendor Phone" name="vendorPhone" value={form.vendorPhone} onChange={handleChange} fullWidth />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField label="Vendor Email" name="vendorEmail" value={form.vendorEmail} onChange={handleChange} fullWidth />
                </Grid>

                <Divider sx={{ my: 1.5, width: '100%' }} />

                {/* ── Ship To ── */}
                {renderSectionHeader('Ship To')}

                <Grid item xs={12} sm={6} md={4}>
                  <TextField label="Contact Person Name" name="shipToName" value={form.shipToName} onChange={handleChange} fullWidth required />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <TextField label="Contact Number" name="shipToPhone" value={form.shipToPhone} onChange={handleChange} fullWidth required />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <TextField label="Email" name="shipToEmail" type="email" value={form.shipToEmail} onChange={handleChange} fullWidth required />
                </Grid>
                <Grid item xs={12}>
                  <TextField label="Shipping Address" name="shipToAddress" value={form.shipToAddress} onChange={handleChange} fullWidth multiline rows={2} required />
                </Grid>

                <Divider sx={{ my: 1.5, width: '100%' }} />

                {/* ── Line Items ── */}
                <Grid item xs={12}>
                  <Typography variant="h6" sx={{ fontWeight: 700 }} mb={1}>Items</Typography>
                  {form.vendorName
                    ? <Typography variant="body2" color="info.main" mb={1}>Showing {filteredProducts.length} product(s) from vendor: {form.vendorName}</Typography>
                    : <Typography variant="body2" color="warning.main" mb={1}>Please select a vendor first to see available products</Typography>
                  }
                </Grid>

                {form.items.map((item, idx) => (
                  <Grid item xs={12} key={idx}>
                    <Box sx={itemCardSx}>
                      {/* Item header row */}
                      <Box sx={itemHeaderSx}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{
                            width: 28, height: 28, borderRadius: '50%',
                            bgcolor: 'primary.main', color: '#fff',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 700, fontSize: '0.8rem', flexShrink: 0,
                          }}>
                            {idx + 1}
                          </Box>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'primary.main' }}>
                            Item {idx + 1}
                          </Typography>
                          {item.itemCode && (
                            <Chip label={item.itemCode} size="small" variant="outlined" color="primary" sx={{ ml: 0.5 }} />
                          )}
                        </Box>
                        <IconButton
                          onClick={() => removeItem(idx)}
                          color="error"
                          size="small"
                          disabled={form.items.length === 1}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                      <Grid container spacing={1.5}>
                        <Grid item xs={12} sm={6} md={2}>
                          <FormControl fullWidth>
                            <InputLabel>Item Source</InputLabel>
                            <Select
                              name="itemSource"
                              value={item.itemSource || 'AdminProductList'}
                              label="Item Source"
                              onChange={(e) => handleItemSourceChange(idx, e.target.value)}
                            >
                              <MenuItem value="AdminProductList">From AdminProductList</MenuItem>
                              <MenuItem value="NewProduct">New Product</MenuItem>
                            </Select>
                          </FormControl>
                        </Grid>

                    {/* Re-open dialog button if source is NewProduct and no item code yet */}
                    {item.itemSource === 'NewProduct' && !item.itemCode && (
                      <Grid item xs={12} sm={6} md={2}>
                        <Button
                          variant="outlined"
                          color="primary"
                          fullWidth
                          startIcon={<AddIcon />}
                          onClick={() => {
                            setAddProductTargetIdx(idx);
                            setAddProductDialogOpen(true);
                          }}
                          sx={{ height: '56px', borderRadius: 2, borderStyle: 'dashed' }}
                        >
                          Fill Product Info
                        </Button>
                      </Grid>
                    )}

                    <Grid item xs={12} sm={6} md={2}>
                      {item.itemSource !== 'NewProduct' ? (
                        <FormControl fullWidth>
                          <InputLabel>Item Code/SKU</InputLabel>
                          <Select name="itemCode" value={item.itemCode} label="Item Code/SKU" onChange={(e) => handleItemChange(idx, e)} required>
                            {filteredProducts.map((p) => (
                              <MenuItem key={p.SKU} value={p.SKU}>{p.SKU} - {p.name}</MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      ) : (
                        <TextField
                          label="Item Code/SKU"
                          name="itemCode"
                          value={item.itemCode}
                          onChange={(e) => handleItemChange(idx, e)}
                          fullWidth
                          required
                          InputProps={{
                            readOnly: !!item.itemCode,
                            endAdornment: item.itemCode
                              ? (
                                <InputAdornment position="end">
                                  <Chip label="Auto-filled" size="small" color="success" variant="outlined" />
                                </InputAdornment>
                              )
                              : null,
                          }}
                        />
                      )}
                    </Grid>

                    <Grid item xs={12} sm={6} md={2}>
                      <TextField label="Item Name" name="itemName" value={item.itemName} onChange={(e) => handleItemChange(idx, e)} fullWidth required />
                    </Grid>
                    <Grid item xs={12} sm={6} md={2}>
                      <TextField label="Description" name="description" value={item.description} onChange={(e) => handleItemChange(idx, e)} fullWidth />
                    </Grid>
                    <Grid item xs={6} sm={4} md={1}>
                      <TextField
                        label="Carton Qty"
                        name="cartonQuantity"
                        value={item.cartonQuantity}
                        onChange={(e) => handleItemChange(idx, e)}
                        type="number"
                        fullWidth
                        inputProps={{ min: 0, sx: { '&::-webkit-outer-spin-button, &::-webkit-inner-spin-button': { display: 'none' }, '&[type=number]': { MozAppearance: 'textfield' } } }}
                      />
                    </Grid>
                    <Grid item xs={6} sm={4} md={1}>
                      <TextField
                        label="Pcs/Carton"
                        name="piecesPerCarton"
                        value={item.piecesPerCarton || ''}
                        onChange={(e) => handleItemChange(idx, e)}
                        type="number"
                        fullWidth
                        inputProps={{ min: 0, sx: { '&::-webkit-outer-spin-button, &::-webkit-inner-spin-button': { display: 'none' }, '&[type=number]': { MozAppearance: 'textfield' } } }}
                      />
                    </Grid>
                    <Grid item xs={6} sm={4} md={1}>
                      <TextField
                        label="Lose Pcs"
                        name="losePieces"
                        value={item.losePieces}
                        onChange={(e) => handleItemChange(idx, e)}
                        type="number"
                        fullWidth
                        inputProps={{ min: 0, sx: { '&::-webkit-outer-spin-button, &::-webkit-inner-spin-button': { display: 'none' }, '&[type=number]': { MozAppearance: 'textfield' } } }}
                      />
                    </Grid>
                    <Grid item xs={6} sm={4} md={1}>
                      <TextField
                        label="Total Qty"
                        name="quantityOrdered"
                        value={item.quantityOrdered}
                        fullWidth
                        InputProps={{ readOnly: true }}
                        helperText="Auto"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={1}>
                      <FormControl fullWidth>
                        <InputLabel>UOM</InputLabel>
                        <Select name="uom" value={item.uom} label="UOM" onChange={(e) => handleItemChange(idx, e)}>
                          {DEFAULT_UOM.map((u) => <MenuItem key={u} value={u}>{u}</MenuItem>)}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={6} md={1}>
                      <TextField label="Per Piece Price" name="perPiecePrice" value={item.perPiecePrice} onChange={(e) => handleItemChange(idx, e)} type="number" fullWidth required />
                    </Grid>
                    <Grid item xs={12} sm={6} md={1}>
                      <TextField label="Unit Price" name="unitPrice" value={item.unitPrice} onChange={(e) => handleItemChange(idx, e)} type="number" fullWidth required InputProps={{ readOnly: true }} />
                    </Grid>
                    <Grid item xs={12} sm={6} md={1}>
                      <TextField label="Tax (%)" name="tax" value={item.tax} onChange={(e) => handleItemChange(idx, e)} type="number" fullWidth />
                    </Grid>
                    <Grid item xs={12} sm={6} md={1}>
                      <TextField label="Discount" name="discount" value={item.discount} onChange={(e) => handleItemChange(idx, e)} type="number" fullWidth />
                    </Grid>
                      </Grid>
                    </Box>
                  </Grid>
                ))}

                <Grid item xs={12}>
                  <Button startIcon={<AddIcon />} onClick={addItem} variant="outlined" color="primary" sx={addItemBtnSx}>
                    Add Item
                  </Button>
                </Grid>

                <Divider sx={{ my: 1.5, width: '100%' }} />

                {/* ── Totals ── */}
                {renderSectionHeader('Totals')}

                <Grid item xs={12} sm={6} md={3}>
                  <TextField label="Subtotal" value={totals.subtotal.toFixed(2)} fullWidth InputProps={{ readOnly: true }} />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField label="Tax Total" value={totals.taxTotal.toFixed(2)} fullWidth InputProps={{ readOnly: true }} />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField label="Shipping Charges" name="shippingCharges" type="number" value={form.shippingCharges} onChange={handleChange} fullWidth inputProps={{ min: 0, step: '0.01', sx: { '&::-webkit-outer-spin-button, &::-webkit-inner-spin-button': { display: 'none' }, '&[type=number]': { MozAppearance: 'textfield' } } }} />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField label="Discount Total" value={totals.discountTotal.toFixed(2)} fullWidth InputProps={{ readOnly: true }} />
                </Grid>
                <Grid item xs={12} sm={6} md={6}>
                  <TextField label="Grand Total" value={totals.grandTotal.toFixed(2)} fullWidth InputProps={{ readOnly: true, sx: { fontSize: '1.25rem', fontWeight: 'bold', '& input': { textAlign: 'right' } } }} />
                </Grid>
                <Grid item xs={12} sm={6} md={6}>
                  <TextField label="Calculated Status" value={getPOStatus()} fullWidth InputProps={{ readOnly: true }} />
                </Grid>

                <Divider sx={{ my: 1.5, width: '100%' }} />

                {/* ── Payment & Delivery ── */}
                {renderSectionHeader('Payment & Delivery')}

                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth>
                    <InputLabel>Payment Terms</InputLabel>
                    <Select name="paymentTerms" value={form.paymentTerms} label="Payment Terms" onChange={handleChange}>
                      {['Net 30', 'Net 60', 'COD', 'Advance Payment', 'Partial Payment', 'Cash Payment'].map((t) => (
                        <MenuItem key={t} value={t}>{t}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                {['Net 30', 'Net 60'].includes(form.paymentTerms) && (
                  <Grid item xs={12} sm={6} md={3}>
                    <TextField label="Due Date" name="dueDate" value={form.dueDate} type="date" fullWidth InputLabelProps={{ shrink: true }} InputProps={{ readOnly: true }} />
                  </Grid>
                )}

                {form.paymentTerms === 'Advance Payment' && renderAdvancePaymentFields()}
                {form.paymentTerms === 'Partial Payment' && renderPartialPaymentFields()}

                {form.paymentTerms === 'Cash Payment' && (
                  <>
                    <Grid item xs={12} sm={6} md={3}>
                      <TextField 
                        label="Cash Paid" 
                        name="cashPaid" 
                        value={form.cashPaid} 
                        onChange={handleChange} 
                        type="number" 
                        fullWidth 
                        required 
                        inputProps={{ 
                          min: 0, 
                          sx: { 
                            '&::-webkit-outer-spin-button, &::-webkit-inner-spin-button': { display: 'none' }, 
                            '&[type=number]': { MozAppearance: 'textfield' },
                            color: arePaymentsInsufficient() && form.cashPaid ? 'error.main' : undefined,
                          } 
                        }} 
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            '& fieldset': {
                              borderColor: arePaymentsInsufficient() && form.cashPaid ? 'error.main' : undefined,
                            },
                            '&:hover fieldset': {
                              borderColor: arePaymentsInsufficient() && form.cashPaid ? 'error.main' : undefined,
                            },
                            '&.Mui-focused fieldset': {
                              borderColor: arePaymentsInsufficient() && form.cashPaid ? 'error.main' : undefined,
                            },
                          },
                          '& .MuiInputLabel-root': {
                            color: arePaymentsInsufficient() && form.cashPaid ? 'error.main' : undefined,
                          },
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <TextField label="Cash Payment Date & Time" name="cashPaymentDateTime" value={form.cashPaymentDateTime} onChange={handleChange} type="datetime-local" fullWidth InputLabelProps={{ shrink: true }} />
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <TextField 
                        label="Remaining Payment" 
                        value={getRemainingPayment()} 
                        fullWidth 
                        InputProps={{ 
                          readOnly: true,
                          sx: {
                            color: arePaymentsInsufficient() ? 'error.main' : 'text.primary',
                            fontWeight: arePaymentsInsufficient() ? 'bold' : 'normal',
                          }
                        }}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            '& fieldset': {
                              borderColor: arePaymentsInsufficient() ? 'error.main' : undefined,
                            },
                          },
                          '& .MuiInputLabel-root': {
                            color: arePaymentsInsufficient() ? 'error.main' : undefined,
                          },
                        }}
                      />
                    </Grid>
                  </>
                )}

                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth>
                    <InputLabel>Payment Method</InputLabel>
                    <Select name="paymentMethod" value={form.paymentMethod} label="Payment Method" onChange={handleChange} required>
                      <MenuItem value=""><em>Select Payment Method</em></MenuItem>
                      {PAYMENT_METHOD_OPTIONS.map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>

                {form.paymentMethod === 'Bank Transfer' && (
                  <Grid item xs={12} sm={6} md={3}>
                    <TextField name="bankReceipt" label="Upload Bank Receipt (PNG/JPG/PDF)" type="file" inputProps={{ accept: '.png,.jpg,.jpeg,.pdf' }} onChange={handleFileChange} fullWidth />
                  </Grid>
                )}
                {form.paymentMethod === 'Cheque' && (
                  <Grid item xs={12} sm={6} md={3}>
                    <TextField name="chequeReceipt" label="Upload Cheque (PNG/JPG/PDF)" type="file" inputProps={{ accept: '.png,.jpg,.jpeg,.pdf' }} onChange={handleFileChange} fullWidth />
                  </Grid>
                )}

                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth>
                    <InputLabel>Delivery Method</InputLabel>
                    <Select name="deliveryMethod" value={form.deliveryMethod} label="Delivery Method" onChange={handleChange}>
                      {DEFAULT_DELIVERY_METHODS.map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField label="Delivery Location/Warehouse" name="deliveryLocation" value={form.deliveryLocation} onChange={handleChange} fullWidth />
                </Grid>

                <Divider sx={{ my: 1.5, width: '100%' }} />

                {/* ── Review & Metadata ── */}
                {renderSectionHeader('Review & Metadata')}

                <Grid item xs={12} sm={6} md={3}>
                  <TextField label="Created By" name="createdBy" value={form.createdBy} onChange={handleChange} fullWidth />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField label="Approved By" name="approvedBy" value={form.approvedBy} onChange={handleChange} fullWidth />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth>
                    <InputLabel>Purchase Type</InputLabel>
                    <Select name="purchaseType" value={form.purchaseType} label="Purchase Type" onChange={handleChange}>
                      {DEFAULT_PURCHASE_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth>
                    <InputLabel>Currency</InputLabel>
                    <Select name="currency" value={form.currency} label="Currency" onChange={handleChange}>
                      {DEFAULT_CURRENCY.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>

                {/* ── Actions ── */}
                <Grid item xs={12}>
                  <Divider sx={{ my: 2 }} />
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'stretch', sm: 'center' } }}>
                    <Button variant="outlined" color="inherit" onClick={() => window.history.back()} sx={{ py: 1.25, width: { xs: '100%', sm: 'auto' } }}>
                      Cancel
                    </Button>
                    <Button type="submit" variant="contained" color="primary" size="large" startIcon={<AddIcon />} sx={submitBtnSx}>
                      Submit Order
                    </Button>
                  </Box>
                </Grid>

              </Grid>
            </form>
          </Paper>
        </Box>

        {/* ── Add Product Dialog ── */}
        <AddProductDialog
          open={addProductDialogOpen}
          onClose={() => setAddProductDialogOpen(false)}
          onProductAdded={handleProductAdded}
          vendorName={form.vendorName}
          darkMode={darkMode}
        />
      </Box>
    </Fade>
  );
};

export default AdminPurchaseOrder;