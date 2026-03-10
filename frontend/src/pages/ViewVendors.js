import React, { useState } from 'react';
import { Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Button, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Grid } from '@mui/material';
import Divider from '@mui/material/Divider';
import EditIcon from '@mui/icons-material/Edit';

const ViewVendors = () => {
  const [vendors, setVendors] = useState([]);
  const [editVendor, setEditVendor] = useState(null);
  const [editOpen, setEditOpen] = useState(false);

  React.useEffect(() => {
    // Fetch vendors from API
    import('../api/api').then(({ default: API }) => {
      API.get('/vendors', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
        .then(res => setVendors(res.data)).catch(() => setVendors([]));
    });
  }, []);

  const handleEdit = vendor => {
    setEditVendor({ ...vendor });
    setEditOpen(true);
  };

  const handleEditChange = e => {
    const { name, value } = e.target;
    if (name in editVendor.address) {
      setEditVendor({ ...editVendor, address: { ...editVendor.address, [name]: value } });
    } else {
      setEditVendor({ ...editVendor, [name]: value });
    }
  };

  const handleEditSave = async () => {
    // Implement vendor update logic
    setEditOpen(false);
  };

  return (
    <Box sx={{ mt: 2, width: '100%' }}>
      <Typography variant="h5" fontWeight={700} color="primary" gutterBottom>Vendor List</Typography>
      <Paper elevation={4} sx={{ p: 3, width: '100%', borderRadius: 4 }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Vendor Name</TableCell>
                <TableCell>Company Name</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Phone</TableCell>
                <TableCell>Address</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Edit</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {vendors.map(vendor => (
                <TableRow key={vendor._id}>
                  <TableCell>{vendor.vendorName}</TableCell>
                  <TableCell>{vendor.companyName}</TableCell>
                  <TableCell>{vendor.email}</TableCell>
                  <TableCell>{vendor.phone}</TableCell>
                  <TableCell>{vendor.address ? `${vendor.address.street || ''}, ${vendor.address.city || ''}, ${vendor.address.state || ''}, ${vendor.address.country || ''}, ${vendor.address.postalCode || ''}` : ''}</TableCell>
                  <TableCell>{vendor.status || 'Active'}</TableCell>
                  <TableCell>
                    <IconButton onClick={() => handleEdit(vendor)}><EditIcon /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
  <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Edit Vendor</DialogTitle>
        <DialogContent>
          {editVendor && (
            <Box sx={{ p: 1 }}>
              <Paper elevation={0} sx={{ p: 2, borderRadius: 3, background: '#f7f9fc', maxWidth: 900, mx: 'auto' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <EditIcon color="primary" sx={{ mr: 1 }} />
                  <Typography variant="h6" fontWeight={700} color="primary">Edit Vendor Details</Typography>
                </Box>
                <Divider sx={{ mb: 2 }} />
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>Basic Information</Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}><TextField label="Vendor Name" name="vendorName" value={editVendor.vendorName || ''} onChange={handleEditChange} fullWidth required /></Grid>
                  <Grid item xs={6}><TextField label="Company Name" name="companyName" value={editVendor.companyName || ''} onChange={handleEditChange} fullWidth /></Grid>
                  <Grid item xs={6}><TextField label="Email" name="email" value={editVendor.email || ''} onChange={handleEditChange} fullWidth /></Grid>
                  <Grid item xs={6}><TextField label="Phone" name="phone" value={editVendor.phone || ''} onChange={handleEditChange} fullWidth /></Grid>
                  <Grid item xs={6}><TextField label="Website" name="website" value={editVendor.website || ''} onChange={handleEditChange} fullWidth /></Grid>
                  <Grid item xs={6}><TextField label="Tax Number" name="taxNumber" value={editVendor.taxNumber || ''} onChange={handleEditChange} fullWidth /></Grid>
                </Grid>
                <Divider sx={{ my: 3 }} />
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>Payment & Status</Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}><TextField label="Payment Terms" name="paymentTerms" value={editVendor.paymentTerms || ''} onChange={handleEditChange} fullWidth /></Grid>
                  <Grid item xs={6}><TextField label="Preferred Currency" name="preferredCurrency" value={editVendor.preferredCurrency || ''} onChange={handleEditChange} fullWidth /></Grid>
                  <Grid item xs={6}><TextField label="Status" name="status" value={editVendor.status || ''} onChange={handleEditChange} fullWidth /></Grid>
                </Grid>
                <Divider sx={{ my: 3 }} />
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>Address</Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}><TextField label="Street" name="street" value={editVendor.address?.street || ''} onChange={handleEditChange} fullWidth /></Grid>
                  <Grid item xs={6}><TextField label="City" name="city" value={editVendor.address?.city || ''} onChange={handleEditChange} fullWidth /></Grid>
                  <Grid item xs={6}><TextField label="State" name="state" value={editVendor.address?.state || ''} onChange={handleEditChange} fullWidth /></Grid>
                  <Grid item xs={6}><TextField label="Country" name="country" value={editVendor.address?.country || ''} onChange={handleEditChange} fullWidth /></Grid>
                  <Grid item xs={6}><TextField label="Postal Code" name="postalCode" value={editVendor.address?.postalCode || ''} onChange={handleEditChange} fullWidth /></Grid>
                </Grid>
                <Divider sx={{ my: 3 }} />
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>Notes</Typography>
                <TextField label="Notes" name="notes" value={editVendor.notes || ''} onChange={handleEditChange} multiline rows={2} fullWidth sx={{ mt: 1 }} />
              </Paper>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>Cancel</Button>
          <Button onClick={handleEditSave} variant="contained" color="primary">Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ViewVendors;
