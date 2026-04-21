import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchProducts } from '../redux/productsSlice';
import { 
  Grid, 
  Card, 
  CardContent, 
  Typography, 
  CardHeader, 
  CardMedia, 
  Box, 
  Divider, 
  TextField, 
  InputAdornment,
  Container
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';

const SellerProductList = () => {
  const dispatch = useDispatch();
  const { items, status } = useSelector(state => state.products);
  const [searchQuery, setSearchQuery] = useState('');

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

  const getBarcodeImageUrl = sku => {
    if (!sku) return '';
    const code = encodeURIComponent(String(sku).trim());
    return `https://barcode.tec-it.com/barcode.ashx?data=${code}&code=Code128&translate-esc=on&unit=Fit&width=220&height=60&dpi=96`;
  };

  // Filter products based on search query
  const filteredProducts = items.filter(product => {
    const query = searchQuery.toLowerCase();
    return (
      product.name?.toLowerCase().includes(query) ||
      product.SKU?.toLowerCase().includes(query) ||
      product.brand?.toLowerCase().includes(query) ||
      product.category?.toLowerCase().includes(query) ||
      product.subCategory?.toLowerCase().includes(query) ||
      product.vendor?.toLowerCase().includes(query)
    );
  });

  if (status === 'loading') return <Typography>Loading...</Typography>;

  return (
    <Container maxWidth="100%" sx={{ mt: 3, mb: 4, px: { xs: 1, md: 2 } }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
          Product List
        </Typography>
        <TextField
          fullWidth
          variant="outlined"
          placeholder="Search products by name, SKU, brand, category, or vendor..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="action" />
              </InputAdornment>
            ),
          }}
          sx={{
            mb: 3,
            '& .MuiOutlinedInput-root': {
              borderRadius: 2,
              backgroundColor: 'background.paper',
            },
          }}
        />
      </Box>
      {filteredProducts.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h6" color="text.secondary">
            {searchQuery ? 'No products found matching your search.' : 'No products available.'}
          </Typography>
        </Box>
      ) : (
        <Grid container spacing={3} justifyContent="center">
          {filteredProducts.map(product => {
          const cartonQuantity = Number(product.cartonQuantity) || 0;
          const piecesPerCarton = Number(product.piecesPerCarton) || 0;
          const losePieces = Number(product.losePieces) || 0;
          const sellingPerPiece = Number(product.sellingPerPiece) || 0;
          // Prefer backend-maintained total pieces when available (accounts for receipts/sales),
          // otherwise derive from cartons and loose pieces
          const derivedTotalPieces = (cartonQuantity * piecesPerCarton) + losePieces;
          const totalPieces = Number(product.totalPieces) || derivedTotalPieces;
          // Normalize displayed cartons/loose from total pieces to reflect decrements accurately
          const displayCartons = piecesPerCarton > 0 ? Math.floor(totalPieces / piecesPerCarton) : cartonQuantity;
          const displayLosePieces = piecesPerCarton > 0 ? (totalPieces % piecesPerCarton) : losePieces;
          return (
            <Grid item xs={12} sm={6} md={4} lg={3} xl={2.4} key={product._id}>
              <Card 
                sx={{ 
                  height: '100%',
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 6,
                  },
                  borderRadius: 2,
                  overflow: 'hidden',
                }}
              >
                {product.image && (
                  <CardMedia
                    component="img"
                    height="200"
                    image={product.image}
                    alt={product.name}
                    sx={{ objectFit: 'cover' }}
                  />
                )}
                <CardHeader 
                  title={
                    <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1.1rem' }}>
                      {product.name}
                    </Typography>
                  }
                  subheader={
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.85rem' }}>
                      SKU: {product.SKU}
                    </Typography>
                  }
                  sx={{ pb: 1 }}
                />
                <CardContent sx={{ flexGrow: 1, pt: 0 }}>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5, fontSize: '0.9rem' }}>
                      <strong>Category:</strong> {product.category} {product.subCategory && `> ${product.subCategory}`}
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 0.5, fontSize: '0.9rem' }}>
                      <strong>Brand:</strong> {product.brand}
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 0.5, fontSize: '0.9rem' }}>
                      <strong>Vendor:</strong> {product.vendor}
                    </Typography>
                    {product.warehouseAddress && <Typography variant="body2" sx={{ mb: 0.5, fontSize: '0.9rem' }}>
                      <strong>Warehouse Address:</strong> {product.warehouseAddress}
                    </Typography>}
                    <Typography variant="body2" sx={{ fontSize: '0.9rem' }}>
                      <strong>Warranty:</strong>{' '}
                      {Number(product.warrantyMonths || 0) > 0
                        ? (Number(product.warrantyMonths) >= 12
                            ? `${(Number(product.warrantyMonths) / 12).toFixed(1).replace(/\\.0$/, '')} Year(s)`
                            : `${Number(product.warrantyMonths)} Month(s)`)
                        : 'No Warranty'}
                    </Typography>
                  </Box>
                  
                  <Divider sx={{ my: 1.5 }} />
                  
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" sx={{ mb: 0.5, fontSize: '0.9rem' }}>
                      <strong>Carton Quantity:</strong> {displayCartons}
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 0.5, fontSize: '0.9rem' }}>
                      <strong>Pieces Per Carton:</strong> {piecesPerCarton}
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1, fontSize: '0.9rem' }}>
                      <strong>Lose Pieces:</strong> {displayLosePieces}
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1, fontSize: '0.9rem', color: 'success.main', fontWeight: 500 }}>
                      <strong>Selling Per Piece:</strong> Rs. {sellingPerPiece}
                    </Typography>
                  </Box>
                  
                  <Divider sx={{ my: 1.5 }} />
                  
                  <Box sx={{ mb: 1 }}>
                    <Typography variant="body2" color="primary" sx={{ fontWeight: 600, mb: 0.5, fontSize: '0.95rem' }}>
                      <strong>Total Pieces:</strong> {totalPieces}
                    </Typography>
                    <Typography variant="body2" color="info.main" sx={{ fontSize: '0.9rem' }}>
                      <strong>Stock:</strong> (Cart: {displayCartons}, Lose: {displayLosePieces})
                    </Typography>
                    {Number(product.warrantyClaimedPieces || 0) > 0 && (
                      <Typography variant="body2" color="warning.main" sx={{ fontSize: '0.9rem', mt: 0.5 }}>
                        <strong>Warranty claimed:</strong> {Number(product.warrantyClaimedPieces || 0)}
                      </Typography>
                    )}
                  </Box>
                  
                  <Divider sx={{ my: 1.5 }} />
                  
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                    Added: {new Date(product.dateAdded).toLocaleDateString()}
                  </Typography>
                  {product.SKU && (
                    <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
                      <img
                        src={getBarcodeImageUrl(product.SKU)}
                        alt={`Barcode for ${product.SKU}`}
                        style={{ width: '100%', maxWidth: '210px', height: 'auto', background: '#fff', padding: '2px', borderRadius: 4 }}
                      />
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                        {product.SKU}
                      </Typography>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>
          );
        })}
        </Grid>
      )}
    </Container>
  );
};

export default SellerProductList;
