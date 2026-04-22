import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchProducts } from '../redux/productsSlice';
import { Grid, Card, CardContent, Typography, CardHeader, CardMedia, Fade, Box, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, IconButton, InputAdornment, Paper, Divider, Tooltip, Chip, FormControl, InputLabel, Select } from '@mui/material';
import API from '../api/api';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import EditIcon from '@mui/icons-material/Edit';
import { Alert } from '@mui/material';

const categories = [
  'Electronics', 'Clothing', 'Home Appliances', 'Books', 'Other'
];

const AdminProductList = () => {
  // Consistent close handler for Product Detail Dialog
  const handleDetailClose = () => {
    setDetailProduct(null);
    setError('');
    setImageFile(null);
  };

  // Helper for thousands separator
  const formatNum = n => n?.toLocaleString('en-IN');

  const getBarcodeImageUrl = (sku) => {
    if (!sku) return '';
    const code = encodeURIComponent(String(sku).trim());
    return `https://barcode.tec-it.com/barcode.ashx?data=${code}&code=Code128&translate-esc=on&unit=Fit&width=220&height=60&dpi=96`;
  };
  // Detail dialog state
  const [detailProduct, setDetailProduct] = useState(null);
  const dispatch = useDispatch();
  const { items, status } = useSelector(state => state.products);
  const [open, setOpen] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [form, setForm] = useState({});
  const [imageFile, setImageFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [vendors, setVendors] = useState([]);

  // Get all unique categories from products
  const allCategories = Array.from(new Set(items.map(p => p.category).filter(Boolean)));
  // If you want to include the static categories as well:
  // const allCategories = Array.from(new Set([...categories, ...items.map(p => p.category).filter(Boolean)]));

  useEffect(() => {
    dispatch(fetchProducts());
  }, [dispatch]);

  useEffect(() => {
    const onChanged = () => dispatch(fetchProducts());
    const onStorage = (e) => { if (e.key === 'products:changed' || e.key === 'sales:changed') dispatch(fetchProducts()); };
    window.addEventListener('products:changed', onChanged);
    window.addEventListener('storage', onStorage);
    return () => { window.removeEventListener('products:changed', onChanged); window.removeEventListener('storage', onStorage); };
  }, [dispatch]);

  // Fetch vendors
  useEffect(() => {
    const fetchVendors = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await API.get('/vendors', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setVendors(res.data);
      } catch (err) {
        console.error('Error fetching vendors:', err);
        setVendors([]);
      }
    };
    fetchVendors();
  }, []);

  // Analytics (fix NaN and Rs)
  const totalProducts = items.length;
  // Use carton logic for value/profit
  const totalInventoryValue = items.reduce((sum, p) => {
    const cartonQuantity = Number(p.cartonQuantity) || 0;
    const piecesPerCarton = Number(p.piecesPerCarton) || 0;
    const losePieces = Number(p.losePieces) || 0;
    const costPerPiece = Number(p.costPerPiece) || 0;
    const derivedTotalPieces = (cartonQuantity * piecesPerCarton) + losePieces;
    const totalPieces = Number(p.totalPieces) || derivedTotalPieces;
    return sum + (costPerPiece * totalPieces);
  }, 0);
  const totalProfit = items.reduce((sum, p) => {
    const cartonQuantity = Number(p.cartonQuantity) || 0;
    const piecesPerCarton = Number(p.piecesPerCarton) || 0;
    const losePieces = Number(p.losePieces) || 0;
    const costPerPiece = Number(p.costPerPiece) || 0;
    const sellingPerPiece = Number(p.sellingPerPiece) || 0;
    const derivedTotalPieces = (cartonQuantity * piecesPerCarton) + losePieces;
    const totalPieces = Number(p.totalPieces) || derivedTotalPieces;
    return sum + ((sellingPerPiece - costPerPiece) * totalPieces);
  }, 0);

  // Filtering
  const filteredItems = items.filter(product => {
    const matchesSearch =
      product.name.toLowerCase().includes(search.toLowerCase()) ||
      product.SKU.toLowerCase().includes(search.toLowerCase()) ||
      product.category.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = filterCategory ? product.category === filterCategory : true;
    return matchesSearch && matchesCategory;
  });

  const handleEditClick = (product) => {
    setEditProduct(product);
    setForm({ ...product });
    setOpen(true);
    setImageFile(null);
    setError('');
  };

  const handleClose = () => {
    setOpen(false);
    setEditProduct(null);
    setError('');
    setImageFile(null);
  };

  const handleChange = e => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleImageChange = e => {
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
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });
      setForm(prev => ({ ...prev, image: res.data.url }));
      setUploading(false);
      setError('');
    } catch (err) {
      setError('Image upload failed');
      setUploading(false);
    }
  };

  const handleUpdate = async () => {
    try {
      const token = localStorage.getItem('token');
      
      // Check if warrantyClaimedPieces is being reduced, restock the difference
      const oldClaimedPieces = Number(editProduct.warrantyClaimedPieces || 0);
      const newClaimedPieces = Number(form.warrantyClaimedPieces || 0);
      const piecesToRestock = Math.max(0, oldClaimedPieces - newClaimedPieces);
      
      let updatedForm = { ...form };
      
      if (piecesToRestock > 0) {
        const piecesPerCarton = Number(form.piecesPerCarton) || 1;
        const originalTotalPieces = Number(editProduct.totalPieces) || 0;
        const newTotalPieces = originalTotalPieces + piecesToRestock;
        
        let newCartons = Math.floor(newTotalPieces / piecesPerCarton);
        let newLosePieces = newTotalPieces % piecesPerCarton;
        const stockQuantity = newCartons + (newLosePieces > 0 ? 1 : 0);
        
        const costPerPiece = Number(form.costPerPiece) || 0;
        const sellingPerPiece = Number(form.sellingPerPiece) || 0;
        const perPieceProfit = sellingPerPiece - costPerPiece;
        const totalUnitCost = costPerPiece * newTotalPieces;
        const totalUnitProfit = perPieceProfit * newTotalPieces;
        
        updatedForm = {
          ...updatedForm,
          totalPieces: newTotalPieces,
          cartonQuantity: newCartons,
          losePieces: newLosePieces,
          stockQuantity: stockQuantity,
          perPieceProfit: perPieceProfit,
          totalUnitCost: totalUnitCost,
          totalUnitProfit: totalUnitProfit
        };
      }
      
      await API.put(`/products/${editProduct._id}`, updatedForm, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOpen(false);
      setEditProduct(null);
      setError('');
      setImageFile(null);
      dispatch(fetchProducts());
    } catch (err) {
      setError('Failed to update product');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;
    try {
      const token = localStorage.getItem('token');
      await API.delete(`/products/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      dispatch(fetchProducts());
    } catch (err) {
      alert('Failed to delete product');
    }
  };

  if (status === 'loading') return <Typography>Loading...</Typography>;

  return (
    <Fade in timeout={500}>
      <Box sx={{ mt: 2, width: '100%' }}>
        <Typography variant="h4" gutterBottom fontWeight={700}>Product List</Typography>
        {/* Analytics */}
        <Grid container spacing={2} sx={{ mb: 3, px: { xs: 1, sm: 1 }, mt: '2px', }}>
          <Grid columns={12}>
            <Paper elevation={3} sx={{ p: 2, textAlign: 'center', mb: 2, mx: '12px',}}>
              <Typography variant="subtitle2" color="text.secondary">Total Products</Typography>
              <Typography variant="h5" color="primary" fontWeight={700}>{formatNum(totalProducts)}</Typography>
            </Paper>
          </Grid>
          <Grid columns={12}>
            <Paper elevation={3} sx={{ p: 2, textAlign: 'center', mb: 2, mx: '12px', }}>
              <Typography variant="subtitle2" color="text.secondary">Total Inventory Value</Typography>
              <Typography variant="h5" color="success.main" fontWeight={700}>Rs. {formatNum(Number(totalInventoryValue.toFixed(2)))}</Typography>
            </Paper>
          </Grid>
          <Grid columns={12}>
            <Paper elevation={3} sx={{ p: 2, textAlign: 'center', mb: 2, mx: '12px',}}>
              <Typography variant="subtitle2" color="text.secondary">Total Profit</Typography>
              <Typography variant="h5" color="info.main" fontWeight={700}>Rs. {formatNum(Number(totalProfit.toFixed(2)))}</Typography>
            </Paper>
          </Grid>
        </Grid>
        <Divider sx={{ mb: 3 }} />
        {/* Filtering */}
        <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap', justifyContent: 'left' }}>
          <TextField
            label="Search by Name, Category, SKU"
            value={search}
            onChange={e => setSearch(e.target.value)}
            InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon /></InputAdornment> }}
            sx={{ minWidth: { xs: '100%', sm: 260 } }}
          />
          <TextField
            select
            label="Filter by Category"
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
            sx={{ minWidth: { xs: '100%', sm: 180 } }}
          >
            <MenuItem value="">All</MenuItem>
            {allCategories.map(cat => (
              <MenuItem key={cat} value={cat}>{cat}</MenuItem>
            ))}
          </TextField>
        </Box>
        <Grid container spacing={4} sx={{ justifyContent: 'center' }}>
          {filteredItems.map(product => {
            // Wholesale calculations
            const cartonQuantity = Number(product.cartonQuantity) || 0;
            const piecesPerCarton = Number(product.piecesPerCarton) || 0;
            const losePieces = Number(product.losePieces) || 0;
            const costPerPiece = Number(product.costPerPiece) || 0;
            const costPerCarton = (piecesPerCarton * costPerPiece) || 0; // per-carton
            const sellingPerPiece = Number(product.sellingPerPiece) || 0;
            const derivedTotalPieces = (cartonQuantity * piecesPerCarton) + losePieces;
            const totalPieces = Number(product.totalPieces) || derivedTotalPieces;
            const displayCartons = piecesPerCarton > 0 ? Math.floor(totalPieces / piecesPerCarton) : cartonQuantity;
            const displayLosePieces = piecesPerCarton > 0 ? (totalPieces % piecesPerCarton) : losePieces;
            const stockQuantity = displayCartons + (displayLosePieces > 0 ? 1 : 0);
            const perPieceProfit = sellingPerPiece - costPerPiece;
            const totalUnitProfit = perPieceProfit * totalPieces;
            const totalUnitCost = costPerPiece * totalPieces;
            const reorderLevel = Number(product.reorderLevel) || 0;
            const isLow = reorderLevel > 0 ? totalPieces <= reorderLevel : stockQuantity <= 1;
            return (
              <Grid item xs={12} sm={6} md={4} lg={3} key={product._id} sx={{ display: 'flex', justifyContent: 'center' }}>
                <Card elevation={6} sx={{ borderRadius: 3, overflow: 'hidden', position: 'relative', cursor: 'pointer', width: { xs: '100%', sm: 360, md: 385 }, minHeight: 420, boxShadow: 6 }} onClick={() => window.location.href = `/admin/product/${product._id}`}>
                  {isLow && (
                    <Box sx={{ position: 'absolute', top: 8, left: 8, zIndex: 1 }}>
                      <Chip color="error" size="small" label="Low Stock" />
                    </Box>
                  )}
                  {product.image && (
                    <CardMedia
                      component="img"
                      height="180"
                      image={product.image}
                      alt={product.name}
                      sx={{ objectFit: 'cover' }}
                    />
                  )}
                  <CardHeader
                    title={<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="h6" fontWeight={600}>{product.name}</Typography>
                      <Chip label={product.category} color="primary" size="small" />
                      {product.color && <Chip label={product.color} color="secondary" size="small" />}
                    </Box>}
                    subheader={`SKU: ${product.SKU}`}
                  />
                  <CardContent>
                    {isLow && (
                      <Alert severity="warning" sx={{ mb: 1 }}>
                        Stock low: {formatNum(totalPieces)} pcs. {reorderLevel ? `Reorder level: ${formatNum(reorderLevel)}.` : ''}
                      </Alert>
                    )}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {product.subCategory && (
                        <Chip
                          label={product.subCategory}
                          color="info"
                          size="small"
                          sx={{ mr: 0.5 }}
                        />
                      )}
                      <Typography variant="body2" color="text.secondary" component="span">
                        Brand: {product.brand}
                      </Typography>
                    </Box>
                    <Typography variant="body2">Vendor: {product.vendor}</Typography>
                    {product.warehouseAddress && <Typography variant="body2">Warehouse Address: {product.warehouseAddress}</Typography>}
                    <Typography variant="body2">Carton Quantity: {formatNum(displayCartons)}</Typography>
                    <Typography variant="body2">Pieces Per Carton: {formatNum(piecesPerCarton)}</Typography>
                    <Typography variant="body2">Lose Pieces: {formatNum(displayLosePieces)}</Typography>
                    <Typography variant="body2">Cost Per Piece: Rs. {formatNum(costPerPiece)}</Typography>
                    <Typography variant="body2">Cost Per Carton: Rs. {formatNum(costPerCarton)}</Typography>
                    <Typography variant="body2">Selling Per Piece: Rs. {formatNum(sellingPerPiece)}</Typography>
                    <Typography variant="body2">
                      Warranty:{' '}
                      {Number(product.warrantyMonths || 0) > 0
                        ? (Number(product.warrantyMonths) >= 12
                          ? `${(Number(product.warrantyMonths) / 12).toFixed(1).replace(/\\.0$/, '')} Year(s)`
                          : `${Number(product.warrantyMonths)} Month(s)`)
                        : 'No Warranty'}
                    </Typography>
                    {/* Selling Per Carton removed */}
                    <Typography variant="body2" color="primary">Total Pieces: {formatNum(totalPieces)}</Typography>
                    <Typography variant="body2" color="info.main">Stock Quantity: (Cart: {formatNum(displayCartons)}, Lose: {formatNum(displayLosePieces)})</Typography>
                    {Number(product.warrantyClaimedPieces || 0) > 0 && (
                      <Typography variant="body2" color="warning.main">
                        Warranty claimed: {formatNum(Number(product.warrantyClaimedPieces || 0))} pcs
                      </Typography>
                    )}
                    <Typography variant="body2">Date Added: {new Date(product.dateAdded).toLocaleString()}</Typography>
                    <Divider sx={{ my: 1 }} />
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      <Typography variant="body2" color="success.main" fontWeight={600}>
                        Per Piece Profit: Rs. {formatNum(perPieceProfit)}
                      </Typography>
                      <Typography variant="body2" color="success.main" fontWeight={600}>
                        Total Unit Profit: Rs. {formatNum(totalUnitProfit)}
                      </Typography>
                      <Typography variant="body2" color="info.main" fontWeight={600}>
                        Total Unit Cost: Rs. {formatNum(totalUnitCost)}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1, mt: 2, justifyContent: 'flex-end' }}>
                      <Tooltip title="Edit Product">
                        <IconButton color="primary" onClick={e => { e.stopPropagation(); handleEditClick(product); }}>
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete Product">
                        <IconButton color="error" onClick={e => { e.stopPropagation(); handleDelete(product._id); }}>
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
          <DialogTitle sx={{ fontWeight: 700, color: 'primary.main', bgcolor: '#f4f6fa', borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>Edit Product</DialogTitle>
          <DialogContent sx={{ bgcolor: '#f7f7fa', borderBottomLeftRadius: 12, borderBottomRightRadius: 12, boxShadow: 3 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, py: 1 }}>
              <TextField label="Product Name" name="name" fullWidth margin="normal" value={form.name || ''} onChange={handleChange} required variant="outlined" />
              <TextField select label="Category" name="category" fullWidth margin="normal" value={form.category || ''} onChange={handleChange} required variant="outlined">
                {allCategories.map(cat => <MenuItem key={cat} value={cat}>{cat}</MenuItem>)}
              </TextField>
              <TextField label="Sub-Category" name="subCategory" fullWidth margin="normal" value={form.subCategory || ''} onChange={handleChange} variant="outlined" />
              <TextField label="Brand / Company" name="brand" fullWidth margin="normal" value={form.brand || ''} onChange={handleChange} variant="outlined" />
              <TextField label="Color" name="color" fullWidth margin="normal" value={form.color || ''} onChange={handleChange} variant="outlined" />
              <FormControl fullWidth margin="normal" variant="outlined">
                <InputLabel>Vendor</InputLabel>
                <Select name="vendor" value={form.vendor || ''} label="Vendor" onChange={handleChange}>
                  {vendors.map(vendor => <MenuItem key={vendor._id} value={vendor.vendorName}>{vendor.vendorName}</MenuItem>)}
                </Select>
              </FormControl>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField label="Carton Quantity" name="cartonQuantity" type="number" fullWidth margin="normal" value={form.cartonQuantity || ''} onChange={handleChange} required variant="outlined" />
                <TextField label="Pieces Per Carton" name="piecesPerCarton" type="number" fullWidth margin="normal" value={form.piecesPerCarton || ''} onChange={handleChange} required variant="outlined" />
              </Box>
              <TextField label="Lose Pieces" name="losePieces" type="number" fullWidth margin="normal" value={form.losePieces || ''} onChange={handleChange} required variant="outlined" />
              <TextField label="Cost Per Piece" name="costPerPiece" type="number" fullWidth margin="normal" value={form.costPerPiece || ''} onChange={handleChange} required variant="outlined" />
              <TextField label="Selling Per Piece" name="sellingPerPiece" type="number" fullWidth margin="normal" value={form.sellingPerPiece || ''} onChange={handleChange} required variant="outlined" />
              <TextField
                label="Warranty (months)"
                name="warrantyMonths"
                type="number"
                fullWidth
                margin="normal"
                value={form.warrantyMonths ?? ''}
                onChange={handleChange}
                helperText="Default 12 = 1 year"
                variant="outlined"
              />
              <TextField label="SKU / Barcode" name="SKU" fullWidth margin="normal" value={form.SKU || ''} onChange={handleChange} required variant="outlined" />
              <TextField label="Warehouse Address" name="warehouseAddress" fullWidth margin="normal" value={form.warehouseAddress || ''} onChange={handleChange} variant="outlined" />
              <TextField label="Warranty Claimed Pieces" name="warrantyClaimedPieces" type="number" fullWidth margin="normal" value={form.warrantyClaimedPieces || ''} onChange={handleChange} variant="outlined" />
              <Button variant="outlined" component="label" fullWidth sx={{ mt: 1, borderRadius: 2 }}>
                Change Product Image
                <input type="file" accept="image/*" hidden onChange={handleImageChange} />
              </Button>
              {imageFile && (
                <Box sx={{ mt: 1, mb: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                  <Button variant="contained" color="primary" onClick={handleImageUpload} disabled={uploading} fullWidth sx={{ borderRadius: 2 }}>
                    {uploading ? 'Uploading...' : 'Upload Image'}
                  </Button>
                  {form.image && <Typography variant="body2" color="success.main">Image uploaded!</Typography>}
                </Box>
              )}
              {error && <Typography color="error" variant="body2" align="center">{error}</Typography>}
            </Box>
          </DialogContent>
          <DialogActions sx={{ bgcolor: '#f4f6fa', borderBottomLeftRadius: 12, borderBottomRightRadius: 12 }}>
            <Button onClick={handleClose} sx={{ fontWeight: 600 }}>Cancel</Button>
            <Button onClick={handleUpdate} variant="contained" color="primary" sx={{ fontWeight: 600 }}>Update</Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Fade>
  );
};

export default AdminProductList;
