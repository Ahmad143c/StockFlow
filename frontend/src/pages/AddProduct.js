import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Container,
  Grid,
  InputAdornment,
  CircularProgress,
  useTheme,
  useMediaQuery,
  Alert,
  Stack
} from '@mui/material';
import CategoryIcon from '@mui/icons-material/Category';
import BrandingWatermarkIcon from '@mui/icons-material/BrandingWatermark';
import ColorLensIcon from '@mui/icons-material/ColorLens';
import InventoryIcon from '@mui/icons-material/Inventory';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import StorefrontIcon from '@mui/icons-material/Storefront';
import QrCodeIcon from '@mui/icons-material/QrCode';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import API from '../api/api';

const defaultCategories = [
  'Electronics',
  'Clothing',
  'Home Appliances',
  'Books',
  'Other'
];

const AddProduct = ({ onCategoryAdded }) => {
  const [form, setForm] = useState({
    name: '',
    category: '',
    subCategory: '',
    brand: '',
    vendor: '',
    color: '',
    costPerPiece: '',
    sellingPerPiece: '',
    cartonQuantity: '',
    piecesPerCarton: '',
    losePieces: '',
    SKU: '',
    image: '',
    warrantyMonths: '12',
  });
  const [imageFile, setImageFile] = useState(null);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [categories, setCategories] = useState(defaultCategories);
  const [addCatOpen, setAddCatOpen] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [vendors, setVendors] = useState([]);

  // Fetch vendors on component mount
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

  const handleSubmit = async e => {
    e.preventDefault();
    if (imageFile && !form.image) {
      setError('Please upload the image first');
      return;
    }
    try {
      const token = localStorage.getItem('token');
      // Calculate stockQuantity, totalPieces, analytics
      const cartonQty = Number(form.cartonQuantity) || 0;
      const piecesPerCarton = Number(form.piecesPerCarton) || 0;
  const losePieces = Number(form.losePieces) || 0;
  const totalPieces = (cartonQty * piecesPerCarton) + losePieces;
  const stockQuantity = cartonQty + (losePieces > 0 ? 1 : 0);
      const costPerPiece = Number(form.costPerPiece) || 0;
  const costPerCarton = (cartonQty * piecesPerCarton * costPerPiece) || 0;
      const sellingPerPiece = Number(form.sellingPerPiece) || 0;
  const sellingPerCarton = (piecesPerCarton * sellingPerPiece) || 0;
      const perPieceProfit = sellingPerPiece - costPerPiece;
      const totalUnitProfit = perPieceProfit * totalPieces;
      const totalUnitCost = costPerPiece * totalPieces;
      await API.post(
        '/products',
        {
          name: form.name,
          category: form.category,
          subCategory: form.subCategory,
          brand: form.brand,
          vendor: form.vendor,
          color: form.color,
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
          SKU: form.SKU,
          image: form.image,
          warrantyMonths: Number(form.warrantyMonths) || 12,
        },
        {
        headers: { Authorization: `Bearer ${token}` }
        }
      );
      setSuccess('Product added successfully!');
      setForm({
        name: '',
        category: '',
        subCategory: '',
        brand: '',
        vendor: '',
        color: '',
        costPerPiece: '',
        sellingPerPiece: '',
        cartonQuantity: '',
        piecesPerCarton: '',
        losePieces: '',
        SKU: '',
        image: '',
        warrantyMonths: '12',
      });
      setImageFile(null);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add product');
      setSuccess('');
    }
  };

  const handleAddCategory = () => {
    if (newCategory && !categories.includes(newCategory)) {
      setCategories([...categories, newCategory]);
      setNewCategory('');
      setAddCatOpen(false);
      if (onCategoryAdded) onCategoryAdded(newCategory);
    }
  };

  const theme = useTheme();
  const isSm = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Box sx={{ bgcolor: '#f4f6fa', py: 6, minHeight: '90vh' }}>
      {/* use full width container on mobile, limit max width on larger screens */}
      <Box sx={{ mx: 'auto', width: '100%', maxWidth: 1800, px: { xs: 1, sm: 2, md: 3 } }}>
        <Paper
          elevation={2}
          sx={{
            borderRadius: 4,
            p: { xs: 3, sm: 4, md: 6 },
            backdropFilter: 'blur(8px)',
            backgroundColor: 'background.paper',
            width: '100%',
          }}
        >
          <Typography
            variant={isSm ? 'h5' : 'h4'}
            align="center"
            fontWeight={700}
            color="primary"
            gutterBottom
          >
            Add New Product
          </Typography>

          {success && (
            <Alert severity="success" sx={{ mb: 2 }}>
              {success}
            </Alert>
          )}
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <Grid container spacing={2}>
              {/* Basic Info */}
              <Grid item xs={12} md={6}>
                <TextField
                  label="Product Name"
                  name="name"
                  fullWidth
                  value={form.name}
                  onChange={handleChange}
                  required
                  variant="outlined"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <InventoryIcon />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  select
                  label="Category"
                  name="category"
                  fullWidth
                  value={form.category}
                  onChange={handleChange}
                  required
                  variant="outlined"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <CategoryIcon />
                      </InputAdornment>
                    ),
                  }}
                >
                  {categories.map((cat) => (
                    <MenuItem key={cat} value={cat}>
                      {cat}
                    </MenuItem>
                  ))}
                  <MenuItem
                    value="add-category"
                    onClick={() => setAddCatOpen(true)}
                  >
                    <strong>+ Add Category</strong>
                  </MenuItem>
                </TextField>
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  label="Sub-Category"
                  name="subCategory"
                  fullWidth
                  value={form.subCategory}
                  onChange={handleChange}
                  variant="outlined"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <AccountTreeIcon />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  label="Brand / Company"
                  name="brand"
                  fullWidth
                  value={form.brand}
                  onChange={handleChange}
                  variant="outlined"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <BrandingWatermarkIcon />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  select
                  label="Vendor"
                  name="vendor"
                  fullWidth
                  value={form.vendor}
                  onChange={handleChange}
                  required
                  variant="outlined"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <StorefrontIcon />
                      </InputAdornment>
                    ),
                  }}
                >
                  {vendors.map((vendor) => (
                    <MenuItem key={vendor._id} value={vendor.vendorName}>
                      {vendor.vendorName}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  label="Color"
                  name="color"
                  fullWidth
                  value={form.color}
                  onChange={handleChange}
                  variant="outlined"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <ColorLensIcon />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>

              {/* Pricing & Stock */}
              <Grid item xs={12} md={4}>
                <TextField
                  label="Cost Per Piece"
                  name="costPerPiece"
                  type="number"
                  fullWidth
                  value={form.costPerPiece}
                  onChange={handleChange}
                  required
                  variant="outlined"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        $
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <TextField
                  label="Selling Per Piece"
                  name="sellingPerPiece"
                  type="number"
                  fullWidth
                  value={form.sellingPerPiece}
                  onChange={handleChange}
                  required
                  variant="outlined"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        $
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <TextField
                  label="Carton Quantity"
                  name="cartonQuantity"
                  type="number"
                  fullWidth
                  value={form.cartonQuantity}
                  onChange={handleChange}
                  required
                  variant="outlined"
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <TextField
                  label="Pieces Per Carton"
                  name="piecesPerCarton"
                  type="number"
                  fullWidth
                  value={form.piecesPerCarton}
                  onChange={handleChange}
                  required
                  variant="outlined"
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <TextField
                  label="Lose Pieces"
                  name="losePieces"
                  type="number"
                  fullWidth
                  value={form.losePieces}
                  onChange={handleChange}
                  required
                  variant="outlined"
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <TextField
                  label="Warranty (months)"
                  name="warrantyMonths"
                  type="number"
                  fullWidth
                  value={form.warrantyMonths}
                  onChange={handleChange}
                  helperText="Default is 12 months (1 year)"
                  variant="outlined"
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  label="SKU / Barcode"
                  name="SKU"
                  fullWidth
                  value={form.SKU}
                  onChange={handleChange}
                  required
                  variant="outlined"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <QrCodeIcon />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>

              {/* Image Upload */}
              <Grid item xs={12} md={6}>
                <Stack spacing={1} sx={{ width: '100%' }}>
                  <Button
                    variant="outlined"
                    component="label"
                    fullWidth
                    startIcon={<AttachFileIcon />}
                    sx={{ borderRadius: 2, py: 1.5 }}
                  >
                    Select Image
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={handleImageChange}
                    />
                  </Button>
                  {imageFile && (
                    <Button
                      variant="contained"
                      color="primary"
                      onClick={handleImageUpload}
                      disabled={uploading}
                      fullWidth
                      sx={{ borderRadius: 2, py: 1.5 }}
                    >
                      {uploading ? (
                        <CircularProgress size={20} color="inherit" />
                      ) : (
                        'Upload'
                      )}
                    </Button>
                  )}
                  {form.image && (
                    <Typography variant="body2" color="success.main" align="center">
                      Image uploaded!
                    </Typography>
                  )}
                </Stack>
              </Grid>

              {/* Submit Button */}
              <Grid item xs={12}>
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  fullWidth
                  sx={{
                    borderRadius: 2,
                    fontWeight: 600,
                    fontSize: 16,
                    py: 1.5,
                  }}
                >
                  Add Product
                </Button>
              </Grid>
            </Grid>
          </form>
        </Paper>
      </Box>

        <Dialog open={addCatOpen} onClose={() => setAddCatOpen(false)}>
          <DialogTitle>Add New Category</DialogTitle>
          <DialogContent>
            <TextField
              label="Category Name"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              fullWidth
              autoFocus
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

export default AddProduct;
