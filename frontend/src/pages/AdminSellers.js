import React, { useEffect, useState } from 'react';
import { Box, Typography, Paper, List, ListItem, ListItemText, Fade, Divider, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Avatar } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
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
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteSeller, setDeleteSeller] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const ADMIN_PASSWORD = 'admin123'; // Change this to your desired password

  useEffect(() => {
    setPasswordOpen(true);
  }, []);

  const handlePasswordSubmit = () => {
    if (passwordInput === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      setPasswordOpen(false);
      setPasswordError('');
    } else {
      setPasswordError('Incorrect password');
    }
  };

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
      productCategory: seller.productCategory || '',
      password: ''
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

  const handleDeleteClick = (seller) => {
    setDeleteSeller(seller);
    setDeleteOpen(true);
  };

  const handleDeleteClose = () => {
    setDeleteOpen(false);
    setDeleteSeller(null);
  };

  const handleDeleteConfirm = async () => {
    setDeleteLoading(true);
    try {
      const token = localStorage.getItem('token');
      await API.delete(`/auth/delete/${deleteSeller._id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDeleteLoading(false);
      setDeleteOpen(false);
      setDeleteSeller(null);
      fetchSellers();
    } catch (err) {
      setDeleteLoading(false);
      alert(err.response?.data?.message || 'Failed to delete seller');
    }
  };

  if (loading) return <Typography>Loading sellers...</Typography>;
  if (error) return <Typography color="error">{error}</Typography>;

  if (!isAuthenticated) {
    return (
      <Dialog open={passwordOpen} maxWidth="xs" fullWidth>
        <DialogTitle>Enter Password</DialogTitle>
        <DialogContent>
          <TextField
            label="Password"
            type="password"
            fullWidth
            margin="normal"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            error={!!passwordError}
            helperText={passwordError}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handlePasswordSubmit();
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handlePasswordSubmit} variant="contained">Submit</Button>
        </DialogActions>
      </Dialog>
    );
  }

  return (
    <Fade in timeout={500}>
      <Box sx={{ mt: 2, width: '100%', backgroundColor: darkMode ? '#121212' : '#fafafa', minHeight: '100vh', px: { xs: 1, sm: 2 } }}>
        <Typography variant="h4" gutterBottom fontWeight={700} align="center" sx={{ fontSize: { xs: '1.5rem', md: '2.125rem' } }}>Seller List</Typography>
        <Paper elevation={4} sx={{ p: { xs: 2, md: 3 }, width: '100%', borderRadius: 4, backgroundColor: darkMode ? '#1e1e1e' : '#fff' }}>
          <List sx={{ width: '100%' }}>
            {sellers.length === 0 && <Typography align="center">No sellers found.</Typography>}
            {sellers.map(seller => (
              <React.Fragment key={seller._id}>
                <ListItem sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'flex-start', sm: 'center' }, gap: { xs: 1, sm: 2 }, bgcolor: darkMode ? '#2a2a2a' : '#f5f5f5', borderRadius: 2, mb: 2, boxShadow: 1, p: { xs: 2, sm: 3 } }}>
                  <Avatar sx={{ bgcolor: 'primary.main', mb: { xs: 1, sm: 0 }, mr: { xs: 0, sm: 2 } }}>{seller.username[0]?.toUpperCase()}</Avatar>
                  <Box sx={{ flexGrow: 1, width: '100%' }}>
                    <Typography variant="subtitle1" fontWeight={600} sx={{ wordBreak: 'break-word' }}>{seller.username}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-word' }}>Shop: {seller.shopName || '-'}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-word' }}>Selling Point: {seller.sellingPoint || '-'}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-word' }}>Category: {seller.productCategory || '-'}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1, alignSelf: { xs: 'flex-end', sm: 'center' } }}>
                    <IconButton color="primary" onClick={() => handleEditClick(seller)}>
                      <EditIcon />
                    </IconButton>
                    <IconButton color="error" onClick={() => handleDeleteClick(seller)}>
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                </ListItem>
              </React.Fragment>
            ))}
          </List>
        </Paper>
        <Dialog open={editOpen} onClose={handleEditClose} maxWidth="sm" fullWidth sx={{ '& .MuiDialog-paper': { m: { xs: 1, sm: 2 } } }}>
          <DialogTitle sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>Edit Seller Info</DialogTitle>
          <DialogContent>
            <TextField label="Shop Name" name="shopName" fullWidth margin="normal" value={editForm.shopName} onChange={handleEditChange} required />
            <TextField label="Username" name="username" fullWidth margin="normal" value={editForm.username} onChange={handleEditChange} required />
            <TextField label="Selling Point" name="sellingPoint" fullWidth margin="normal" value={editForm.sellingPoint} onChange={handleEditChange} required />
            <TextField label="Product Category" name="productCategory" fullWidth margin="normal" value={editForm.productCategory} onChange={handleEditChange} required />
            <TextField
              label="New Password (leave blank to keep current)"
              name="password"
              type="password"
              fullWidth
              margin="normal"
              value={editForm.password}
              onChange={handleEditChange}
              helperText="Enter new password to change, leave blank to keep current password"
            />
            {editError && <Typography color="error" variant="body2">{editError}</Typography>}
            {editSuccess && <Typography color="success.main" variant="body2">{editSuccess}</Typography>}
          </DialogContent>
          <DialogActions sx={{ flexDirection: { xs: 'column', sm: 'row' }, gap: { xs: 1, sm: 2 } }}>
            <Button onClick={handleEditClose} fullWidth={false} sx={{ minWidth: { xs: '100%', sm: 'auto' } }}>Cancel</Button>
            <Button onClick={handleEditSave} variant="contained" color="primary" disabled={editLoading} fullWidth={false} sx={{ minWidth: { xs: '100%', sm: 'auto' } }}>{editLoading ? 'Saving...' : 'Save'}</Button>
          </DialogActions>
        </Dialog>
        <Dialog open={deleteOpen} onClose={handleDeleteClose} maxWidth="xs" fullWidth sx={{ '& .MuiDialog-paper': { m: { xs: 1, sm: 2 } } }}>
          <DialogTitle>Confirm Delete</DialogTitle>
          <DialogContent>
            <Typography variant="body1">
              Are you sure you want to delete the seller <strong>{deleteSeller?.username}</strong>? This action cannot be undone.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ flexDirection: { xs: 'column', sm: 'row' }, gap: { xs: 1, sm: 2 } }}>
            <Button onClick={handleDeleteClose} fullWidth={false} sx={{ minWidth: { xs: '100%', sm: 'auto' } }}>Cancel</Button>
            <Button onClick={handleDeleteConfirm} variant="contained" color="error" disabled={deleteLoading} fullWidth={false} sx={{ minWidth: { xs: '100%', sm: 'auto' } }}>{deleteLoading ? 'Deleting...' : 'Delete'}</Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Fade>
  );
};

export default AdminSellers;
