import React, { useState } from 'react';
import { Box, Paper, Typography, TextField, Button, MenuItem, Grid, Select, InputLabel, FormControl } from '@mui/material';
import API from '../api/api';

const currencies = ['USD', 'PKR', 'EUR', 'GBP', 'CNY'];
const paymentTermsOptions = ['Net 30', 'Net 60', 'COD', 'Advance', 'Cash on Delivery', 'Credit'];
const statusOptions = ['Active', 'Inactive'];

const VendorForm = ({ onSuccess }) => {
  const [form, setForm] = useState({
    vendorName: '',
    email: '',
    phone: '',
    companyName: '',
    address: {
      street: '',
      city: '',
      state: '',
      country: '',
      postalCode: '',
    },
    website: '',
    taxNumber: '',
    paymentTerms: '',
    preferredCurrency: 'USD',
    notes: '',
    status: 'Active',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChange = e => {
    const { name, value } = e.target;
    if (name in form.address) {
      setForm({ ...form, address: { ...form.address, [name]: value } });
    } else {
      setForm({ ...form, [name]: value });
    }
  };

  const handleSubmit = async e => {
    e.preventDefault();
    if (!form.vendorName) {
      setError('Vendor Name is required');
      return;
    }
    try {
      const token = localStorage.getItem('token');
  await API.post('/vendors', form, {
        headers: { Authorization: `Bearer ${token}` }
      });
  setSuccess('Vendor added successfully!');
      setError('');
      setForm({
  vendorName: '', contactPerson: '', email: '', phone: '', companyName: '', address: { street: '', city: '', state: '', country: '', postalCode: '' }, website: '', taxNumber: '', paymentTerms: '', preferredCurrency: 'USD', notes: '', status: 'Active',
      });
      if (onSuccess) onSuccess();
    } catch (err) {
  setError(err.response?.data?.message || 'Error adding vendor');
      setSuccess('');
    }
  };

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
      <Paper elevation={4} sx={{ p: 4, minWidth: 400, borderRadius: 3 }}>
  <Typography variant="h5" fontWeight={700} color="primary" gutterBottom>Add Vendor</Typography>
        <form onSubmit={handleSubmit}>
          <Grid container spacing={2}>
            <Grid item xs={12}><TextField label="Vendor Name *" name="vendorName" value={form.vendorName} onChange={handleChange} required fullWidth /></Grid>
            <Grid item xs={12}><TextField label="Email Address" name="email" value={form.email} onChange={handleChange} type="email" fullWidth /></Grid>
            <Grid item xs={12}><TextField label="Phone Number" name="phone" value={form.phone} onChange={handleChange} fullWidth /></Grid>
            <Grid item xs={12}><TextField label="Company Name" name="companyName" value={form.companyName} onChange={handleChange} fullWidth /></Grid>
            <Grid item xs={12}><TextField label="Street" name="street" value={form.address.street} onChange={handleChange} fullWidth /></Grid>
            <Grid item xs={6}><TextField label="City" name="city" value={form.address.city} onChange={handleChange} fullWidth /></Grid>
            <Grid item xs={6}><TextField label="State/Province" name="state" value={form.address.state} onChange={handleChange} fullWidth /></Grid>
            <Grid item xs={6}><TextField label="Country" name="country" value={form.address.country} onChange={handleChange} fullWidth /></Grid>
            <Grid item xs={6}><TextField label="Postal Code" name="postalCode" value={form.address.postalCode} onChange={handleChange} fullWidth /></Grid>
            <Grid item xs={12}><TextField label="Website" name="website" value={form.website} onChange={handleChange} fullWidth /></Grid>
            <Grid item xs={12}><TextField label="Tax/VAT/NTN Number" name="taxNumber" value={form.taxNumber} onChange={handleChange} fullWidth /></Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Payment Terms</InputLabel>
                <Select name="paymentTerms" value={form.paymentTerms} label="Payment Terms" onChange={handleChange}>
                  {paymentTermsOptions.map(term => <MenuItem key={term} value={term}>{term}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Preferred Currency</InputLabel>
                <Select name="preferredCurrency" value={form.preferredCurrency} label="Preferred Currency" onChange={handleChange}>
                  {currencies.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select name="status" value={form.status} label="Status" onChange={handleChange}>
                  {statusOptions.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}><TextField label="Notes" name="notes" value={form.notes} onChange={handleChange} multiline rows={2} fullWidth /></Grid>
            <Grid item xs={12} sx={{ mt: 2 }}>
              <Button type="submit" variant="contained" color="primary" fullWidth size="large">Add Vendor</Button>
            </Grid>
            {error && <Grid item xs={12}><Typography color="error" align="center">{error}</Typography></Grid>}
            {success && <Grid item xs={12}><Typography color="success.main" align="center">{success}</Typography></Grid>}
          </Grid>
        </form>
      </Paper>
    </Box>
  );
};

export default VendorForm;
