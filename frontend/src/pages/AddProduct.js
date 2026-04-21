import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Fade,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  InputAdornment,
  CircularProgress,
  useTheme,
  useMediaQuery,
  Alert,
  Stack,
  Avatar,
  Card,
  CardContent
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
import { useDarkMode } from '../context/DarkModeContext';

const defaultCategories = [
  'Wall Light',
  'Cilling Light',
  'Electrical Equipment',
  'Brakers',
  'Volt Meter'
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
    warehouseAddress: '',
  });
  const [imageFile, setImageFile] = useState(null);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [categories, setCategories] = useState(() => {
    // Load categories from localStorage or use defaults
    const savedCategories = localStorage.getItem('productCategories');
    return savedCategories ? JSON.parse(savedCategories) : defaultCategories;
  });
  const [addCatOpen, setAddCatOpen] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [vendors, setVendors] = useState([]);

  // Fetch vendors and categories on component mount
  useEffect(() => {
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
          ...defaultCategories,
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

  const generateSKU = (name = '') => {
    const prefix = (String(name).trim().slice(0, 3) || 'PRD').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const randomPart = Math.random().toString(36).slice(2, 7).toUpperCase();
    const timestamp = Date.now().toString().slice(-6);
    return `${prefix}-${randomPart}-${timestamp}`;
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

      const skuValue = String(form.SKU || '').trim() || generateSKU(form.name);

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
          SKU: skuValue,
          image: form.image,
          warrantyMonths: Number(form.warrantyMonths) || 12,
          warehouseAddress: form.warehouseAddress,
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setSuccess(`Product added successfully! SKU:${skuValue}`);
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
        warehouseAddress: '',
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
      const updatedCategories = [...categories, newCategory];
      setCategories(updatedCategories);
      localStorage.setItem('productCategories', JSON.stringify(updatedCategories));
      setNewCategory('');
      setAddCatOpen(false);
      if (onCategoryAdded) onCategoryAdded(newCategory);
    }
  };

  const theme = useTheme();
  const isSm = useMediaQuery(theme.breakpoints.down('sm'));
  const isMobile = isSm;
  const { darkMode } = useDarkMode();

  return (
    <Fade in timeout={500}>
      <Box sx={{ minHeight: '100vh' }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', minHeight: '100vh' }}>
          <Paper
            elevation={24}
            sx={{
              p: { xs: 3, sm: 4, md: 5 },
              borderRadius: { xs: 3, md: 4 },
              width: { xs: '100%', sm: '90%', md: '100%' },
              maxWidth: '1800px',
              background: darkMode ? 'rgba(30, 30, 30, 0.95)' : 'rgba(255, 255, 255, 0.98)',
              backdropFilter: 'blur(10px)',
              border: darkMode ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(255, 255, 255, 0.2)',
              boxShadow: darkMode ? '0 20px 40px rgba(0, 0, 0, 0.5)' : '0 20px 40px rgba(0, 0, 0, 0.1)',
              mt: { xs: 2, sm: 4, md: 2 }
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', mb: { xs: 3, md: 4 }, textAlign: { xs: 'center', md: 'left' }, flexDirection: { xs: 'column', md: 'row' } }}>
              <Avatar sx={{ bgcolor: 'primary.main', width: { xs: 56, md: 64 }, height: { xs: 56, md: 64 }, mr: { xs: 0, md: 3 }, mb: { xs: 2, md: 0 } }}>
                <InventoryIcon sx={{ fontSize: { xs: 32, md: 36 } }} />
              </Avatar>
              <Box>
                <Typography
                  variant={isMobile ? 'h5' : 'h4'}
                  fontWeight={700}
                  color={darkMode ? 'primary.light' : 'primary.main'}
                  gutterBottom
                  sx={{
                    background: darkMode ? 'linear-gradient(45deg, #90caf9, #64b5f6)' : 'linear-gradient(45deg, #1976d2, #42a5f5)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text'
                  }}
                >
                  Add New Product
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    fontSize: { xs: '0.875rem', md: '1rem' },
                    color: darkMode ? 'rgba(255, 255, 255, 0.75)' : 'text.secondary'
                  }}
                >
                  Enter product details to manage your inventory and pricing efficiently.
                </Typography>
              </Box>
            </Box>

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
              <Grid container spacing={{ xs: 2, sm: 3 }}>
                <Grid item xs={12}>
                  <Card
                    sx={{
                      mb: 2,
                      borderRadius: 2,
                      boxShadow: darkMode ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.05)',
                      background: darkMode ? 'rgba(40, 40, 40, 0.8)' : 'background.paper'
                    }}
                  >
                    <CardContent sx={{ p: { xs: 2, md: 3 } }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <InventoryIcon color={darkMode ? 'secondary' : 'primary'} sx={{ mr: 1 }} />
                        <Typography variant="h6" fontWeight={600} color="text.primary">
                          Product Details
                        </Typography>
                      </Box>
                      <Grid container spacing={2}>
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
                              )
                            }}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
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
                              )
                            }}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
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
                              )
                            }}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
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
                              )
                            }}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
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
                              )
                            }}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
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
                              )
                            }}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                          />
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12}>
                  <Card
                    sx={{
                      mb: 2,
                      borderRadius: 2,
                      boxShadow: darkMode ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.05)',
                      background: darkMode ? 'rgba(40, 40, 40, 0.8)' : 'background.paper'
                    }}
                  >
                    <CardContent sx={{ p: { xs: 2, md: 3 } }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <AttachFileIcon color={darkMode ? 'secondary' : 'primary'} sx={{ mr: 1 }} />
                        <Typography variant="h6" fontWeight={600} color="text.primary">
                          Pricing & Stock
                        </Typography>
                      </Box>
                      <Grid container spacing={2}>
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
                                <InputAdornment position="start">Rs
                                </InputAdornment>
                              )
                            }}
                            inputProps={{ min: 0, sx: { '&::-webkit-outer-spin-button, &::-webkit-inner-spin-button': { display: 'none' }, '&[type=number]': { MozAppearance: 'textfield' } } }}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
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
                                <InputAdornment position="start">Rs
                                </InputAdornment>
                              )
                            }}
                            inputProps={{ min: 0, sx: { '&::-webkit-outer-spin-button, &::-webkit-inner-spin-button': { display: 'none' }, '&[type=number]': { MozAppearance: 'textfield' } } }}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
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
                            inputProps={{ min: 0, sx: { '&::-webkit-outer-spin-button, &::-webkit-inner-spin-button': { display: 'none' }, '&[type=number]': { MozAppearance: 'textfield' } } }}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
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
                            inputProps={{ min: 0, sx: { '&::-webkit-outer-spin-button, &::-webkit-inner-spin-button': { display: 'none' }, '&[type=number]': { MozAppearance: 'textfield' } } }}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
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
                            inputProps={{ min: 0, sx: { '&::-webkit-outer-spin-button, &::-webkit-inner-spin-button': { display: 'none' }, '&[type=number]': { MozAppearance: 'textfield' } } }}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
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
                            inputProps={{ min: 0, sx: { '&::-webkit-outer-spin-button, &::-webkit-inner-spin-button': { display: 'none' }, '&[type=number]': { MozAppearance: 'textfield' } } }}
                            variant="outlined"
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
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
                              )
                            }}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                          />
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <TextField
                            label="Warehouse Address"
                            name="warehouseAddress"
                            fullWidth
                            value={form.warehouseAddress}
                            onChange={handleChange}
                            variant="outlined"
                            placeholder="Enter warehouse address"
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                          />
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12}>
                  <Card
                    sx={{
                      mb: 2,
                      borderRadius: 2,
                      boxShadow: darkMode ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.05)',
                      background: darkMode ? 'rgba(40, 40, 40, 0.8)' : 'background.paper'
                    }}
                  >
                    <CardContent sx={{ p: { xs: 2, md: 3 } }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <AttachFileIcon color={darkMode ? 'secondary' : 'primary'} sx={{ mr: 1 }} />
                        <Typography variant="h6" fontWeight={600} color="text.primary">
                          Product Image
                        </Typography>
                      </Box>
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
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12}>
                  <Button
                    type="submit"
                    variant="contained"
                    fullWidth
                    size={isMobile ? 'medium' : 'large'}
                    sx={{
                      py: { xs: 1.5, md: 2 },
                      borderRadius: 2,
                      fontSize: { xs: '1rem', md: '1.1rem' },
                      fontWeight: 600,
                      background: darkMode ? 'linear-gradient(45deg, #90caf9, #64b5f6)' : '#1976D2',
                      boxShadow: darkMode ? '0 4px 15px rgba(144, 202, 249, 0.3)' : '0 4px 15px rgba(102, 126, 234, 0.4)',
                      '&:hover': {
                        background: darkMode ? 'linear-gradient(45deg, #64b5f6, #42a5f5)' : '#1976D2',
                        boxShadow: darkMode ? '0 6px 20px rgba(144, 202, 249, 0.4)' : '0 6px 20px rgba(102, 126, 234, 0.5)',
                        transform: 'translateY(-2px)'
                      },
                      transition: 'all 0.3s ease'
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
    </Fade>
  );
};

export default AddProduct;
