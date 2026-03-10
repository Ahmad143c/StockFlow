import React, { useState } from 'react';
import { Box, Button, TextField, Typography, Paper } from '@mui/material';
import API from '../api/api';

const CreateSeller = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [shopName, setShopName] = useState('');
  const [sellingPoint, setSellingPoint] = useState('');
  const [productCategory, setProductCategory] = useState('');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await API.post('/auth/register', {
        username,
        password,
        role: 'staff',
        shopName,
        sellingPoint,
        productCategory
      });
      setSuccess('Seller created successfully!');
      setUsername('');
      setPassword('');
      setShopName('');
      setSellingPoint('');
      setProductCategory('');
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create seller');
      setSuccess('');
    }
  };

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <Paper sx={{ p: 4, width: 450}} elevation={3}>
        <Typography variant="h6" align="center" gutterBottom>Create Seller Account</Typography>
        <form onSubmit={handleCreate}>
          <TextField label="Shop Name" fullWidth margin="normal" value={shopName} onChange={e => setShopName(e.target.value)} required />
          <TextField label="Username" fullWidth margin="normal" value={username} onChange={e => setUsername(e.target.value)} required />
          <TextField label="Password" type="password" fullWidth margin="normal" value={password} onChange={e => setPassword(e.target.value)} required />
          <TextField label="Selling Point" fullWidth margin="normal" value={sellingPoint} onChange={e => setSellingPoint(e.target.value)} required />
          <TextField label="Product Selling Category" fullWidth margin="normal" value={productCategory} onChange={e => setProductCategory(e.target.value)} required />
          {success && <Typography color="success.main" variant="body2">{success}</Typography>}
          {error && <Typography color="error" variant="body2">{error}</Typography>}
          <Button type="submit" variant="contained" color="primary" fullWidth sx={{ mt: 2 }}>Create Seller</Button>
        </form>
      </Paper>
    </Box>
  );
};

export default CreateSeller;
