import React, { useEffect, useState } from 'react';
import { Box, Typography, Paper, List, ListItem, ListItemText, Divider, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Avatar } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import API from '../api/api';
import { useDarkMode } from '../context/DarkModeContext';

const AdminSellers = () => {
  const { darkMode } = useDarkMode();
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [editSeller, setEditSeller] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');

  const fetchSellers = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await API.get('/users/sellers', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSellers(res.data);
      setLoading(false);
    } catch (err) {
      setError('Failed to fetch sellers');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSellers();
  }, []);

  const handleEditClick = (seller) => {
    setEditSeller(seller);
    setEditForm({
      shopName: seller.shopName || '',
      username: seller.username || '',
      sellingPoint: seller.sellingPoint || '',
      productCategory: seller.productCategory || ''
    });
    setEditOpen(true);
    setEditError('');
    setEditSuccess('');
  };

  const handleEditChange = (e) => {
    setEditForm({ ...editForm, [e.target.name]: e.target.value });
  };

  const handleEditSave = async () => {
    setEditLoading(true);
    setEditError('');
    setEditSuccess('');
    try {
      const token = localStorage.getItem('token');
      await API.put(`/auth/update/${editSeller._id}`, editForm, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEditSuccess('Seller updated successfully!');
      setEditLoading(false);
      setEditOpen(false);
      fetchSellers();
    } catch (err) {
      setEditError(err.response?.data?.message || 'Failed to update seller');
      setEditLoading(false);
    }
  };

  const handleEditClose = () => {
    setEditOpen(false);
    setEditSeller(null);
    setEditError('');
    setEditSuccess('');
  };

  if (loading) return <Typography>Loading sellers...</Typography>;
  if (error) return <Typography color="error">{error}</Typography>;

  return (
  <Box sx={{ mt: 2, width: '100%', backgroundColor: darkMode ? '#121212' : '#fafafa', minHeight: '100vh' }}>
      <Typography variant="h4" gutterBottom fontWeight={700} align="center">Seller List</Typography>
  <Paper elevation={4} sx={{ p: 3, width: '100%', borderRadius: 4, backgroundColor: darkMode ? '#1e1e1e' : '#fff' }}>
        <List sx={{ width: '100%' }}>
          {sellers.length === 0 && <Typography align="center">No sellers found.</Typography>}
          {sellers.map(seller => (
            <React.Fragment key={seller._id}>
              <ListItem sx={{ display: 'flex', alignItems: 'center', gap: 2, bgcolor: darkMode ? '#2a2a2a' : '#f5f5f5', borderRadius: 2, mb: 2, boxShadow: 1 }}>
                <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }}>{seller.username[0]?.toUpperCase()}</Avatar>
                <Box sx={{ flexGrow: 1 }}>
                  <Typography variant="subtitle1" fontWeight={600}>{seller.username}</Typography>
                  <Typography variant="body2" color="text.secondary">Shop: {seller.shopName || '-'}</Typography>
                  <Typography variant="body2" color="text.secondary">Selling Point: {seller.sellingPoint || '-'}</Typography>
                  <Typography variant="body2" color="text.secondary">Category: {seller.productCategory || '-'}</Typography>
                </Box>
                <IconButton color="primary" onClick={() => handleEditClick(seller)}>
                  <EditIcon />
                </IconButton>
              </ListItem>
            </React.Fragment>
          ))}
        </List>
      </Paper>
      <Dialog open={editOpen} onClose={handleEditClose} maxWidth="xs" fullWidth>
        <DialogTitle>Edit Seller Info</DialogTitle>
        <DialogContent>
          <TextField label="Shop Name" name="shopName" fullWidth margin="normal" value={editForm.shopName} onChange={handleEditChange} required />
          <TextField label="Username" name="username" fullWidth margin="normal" value={editForm.username} onChange={handleEditChange} required />
          <TextField label="Selling Point" name="sellingPoint" fullWidth margin="normal" value={editForm.sellingPoint} onChange={handleEditChange} required />
          <TextField label="Product Category" name="productCategory" fullWidth margin="normal" value={editForm.productCategory} onChange={handleEditChange} required />
          {editError && <Typography color="error" variant="body2">{editError}</Typography>}
          {editSuccess && <Typography color="success.main" variant="body2">{editSuccess}</Typography>}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleEditClose}>Cancel</Button>
          <Button onClick={handleEditSave} variant="contained" color="primary" disabled={editLoading}>{editLoading ? 'Saving...' : 'Save'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminSellers;
