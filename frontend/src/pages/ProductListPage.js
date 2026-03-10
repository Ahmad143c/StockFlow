import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchProducts } from '../redux/productsSlice';
import { Grid, Card, CardContent, Typography, CardHeader, CardMedia, Box } from '@mui/material';

const ProductListPage = () => {
  const dispatch = useDispatch();
  const { items, status } = useSelector(state => state.products);

  useEffect(() => {
    dispatch(fetchProducts());
  }, [dispatch]);

  if (status === 'loading') return <Typography>Loading...</Typography>;

  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="h5" gutterBottom>Product List</Typography>
      <Grid container spacing={3}>
        {items.map(product => (
          <Grid item xs={12} sm={6} md={4} key={product._id}>
            <Card>
              {product.image && (
                <CardMedia
                  component="img"
                  height="180"
                  image={product.image}
                  alt={product.name}
                />
              )}
              <CardHeader title={product.name} subheader={`SKU: ${product.SKU}`} />
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  Category: {product.category} {product.subCategory && `> ${product.subCategory}`}
                </Typography>
                <Typography variant="body2">Brand: {product.brand}</Typography>
                <Typography variant="body2">Vendor: {product.vendor}</Typography>
                <Typography variant="body2">Cost Price: ${product.costPerPiece}</Typography>
                <Typography variant="body2">Selling Price: ${product.sellingPerPiece}</Typography>
                <Typography variant="body2">Stock Quantity: {product.stockQuantity}</Typography>
                <Typography variant="body2">Date Added: {new Date(product.dateAdded).toLocaleString()}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default ProductListPage;
