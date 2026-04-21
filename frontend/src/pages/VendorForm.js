import React, { useState } from 'react';
import {
  Box, Paper, Typography, TextField, Button, MenuItem, Grid, Select,
  InputLabel, FormControl, Divider, Avatar, useTheme, useMediaQuery,
  Card, CardContent, Fade, Alert, Snackbar
} from '@mui/material';
import { Business, Email, Phone, LocationOn, Language, Receipt, AccountBalance } from '@mui/icons-material';
import API from '../api/api';
import { useDarkMode } from '../context/DarkModeContext';

const currencies = ['USD', 'PKR', 'EUR', 'GBP', 'CNY'];
const paymentTermsOptions = ['Net 30', 'Net 60', 'COD', 'Advance', 'Cash on Delivery', 'Credit'];
const statusOptions = ['Active', 'Inactive'];

const VendorForm = ({ onSuccess }) => {
  const theme = useTheme();
  const { darkMode } = useDarkMode();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
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
  const [showSnackbar, setShowSnackbar] = useState(false);

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
      setShowSnackbar(true);
      setForm({
        vendorName: '', contactPerson: '', email: '', phone: '', companyName: '', address: { street: '', city: '', state: '', country: '', postalCode: '' }, website: '', taxNumber: '', paymentTerms: '', preferredCurrency: 'USD', notes: '', status: 'Active',
      });
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err.response?.data?.message || 'Error adding vendor');
      setSuccess('');
      setShowSnackbar(true);
    }
  };

  return (
    <Fade in timeout={500}>
      <Box sx={{
        minHeight: '100vh',

      }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', minHeight: '100vh' }}>
          <Paper
            elevation={24}
            sx={{
              p: { xs: 3, sm: 4, md: 5 },
              borderRadius: { xs: 3, md: 4 },
              width: { xs: '100%', sm: '90%', md: '100%' },
              maxWidth: '1800px',
              background: darkMode
                ? 'rgba(30, 30, 30, 0.95)'
                : 'rgba(255, 255, 255, 0.98)',
              backdropFilter: 'blur(10px)',
              border: darkMode
                ? '1px solid rgba(255, 255, 255, 0.1)'
                : '1px solid rgba(255, 255, 255, 0.2)',
              boxShadow: darkMode
                ? '0 20px 40px rgba(0, 0, 0, 0.5)'
                : '0 20px 40px rgba(0, 0, 0, 0.1)',
              mt: { xs: 2, sm: 4, md: 2 }
            }}
          >
            {/* Header Section */}
            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              mb: { xs: 3, md: 4 },
              textAlign: { xs: 'center', md: 'left' },
              flexDirection: { xs: 'column', md: 'row' }
            }}>
              <Avatar
                sx={{
                  bgcolor: 'primary.main',
                  width: { xs: 56, md: 64 },
                  height: { xs: 56, md: 64 },
                  mr: { xs: 0, md: 3 },
                  mb: { xs: 2, md: 0 }
                }}
              >
                <Business sx={{ fontSize: { xs: 32, md: 36 } }} />
              </Avatar>
              <Box>
                <Typography
                  variant={isMobile ? "h5" : "h4"}
                  fontWeight={700}
                  color={darkMode ? "primary.light" : "primary.main"}
                  gutterBottom
                  sx={{
                    background: darkMode
                      ? 'linear-gradient(45deg, #90caf9, #64b5f6)'
                      : 'linear-gradient(45deg, #1976d2, #42a5f5)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text'
                  }}
                >
                  Add New Vendor
                </Typography>
                <Typography
                  variant="body2"
                  color={darkMode ? "text.secondary" : "text.secondary"}
                  sx={{
                    fontSize: { xs: '0.875rem', md: '1rem' },
                    color: darkMode ? 'rgba(255, 255, 255, 0.7)' : 'text.secondary'
                  }}
                >
                  Enter vendor information to manage your business relationships
                </Typography>
              </Box>
            </Box>

            <form onSubmit={handleSubmit}>
              <Grid container spacing={{ xs: 2, sm: 3 }}>

                {/* Basic Information Section */}
                <Grid item xs={12}>
                  <Card sx={{
                    mb: 2,
                    borderRadius: 2,
                    boxShadow: darkMode
                      ? '0 2px 8px rgba(0,0,0,0.3)'
                      : '0 2px 8px rgba(0,0,0,0.05)',
                    background: darkMode
                      ? 'rgba(40, 40, 40, 0.8)'
                      : 'background.paper'
                  }}>
                    <CardContent sx={{ p: { xs: 2, md: 3 } }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <Business color={darkMode ? "secondary" : "primary"} sx={{ mr: 1 }} />
                        <Typography variant="h6" fontWeight={600} color={darkMode ? "text.primary" : "text.primary"}>
                          Basic Information
                        </Typography>
                      </Box>
                      <Grid container spacing={2}>
                        <Grid item xs={12}>
                          <TextField
                            label="Vendor Name *"
                            name="vendorName"
                            value={form.vendorName}
                            onChange={handleChange}
                            required
                            fullWidth
                            variant="outlined"
                            size={isMobile ? "small" : "medium"}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            label="Email Address"
                            name="email"
                            value={form.email}
                            onChange={handleChange}
                            type="email"
                            fullWidth
                            variant="outlined"
                            size={isMobile ? "small" : "medium"}
                            InputProps={{
                              startAdornment: <Email sx={{ mr: 1, color: 'text.secondary' }} />
                            }}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            label="Phone Number"
                            name="phone"
                            value={form.phone}
                            onChange={handleChange}
                            fullWidth
                            variant="outlined"
                            size={isMobile ? "small" : "medium"}
                            InputProps={{
                              startAdornment: <Phone sx={{ mr: 1, color: 'text.secondary' }} />
                            }}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                          />
                        </Grid>
                        <Grid item xs={12}>
                          <TextField
                            label="Company Name"
                            name="companyName"
                            value={form.companyName}
                            onChange={handleChange}
                            fullWidth
                            variant="outlined"
                            size={isMobile ? "small" : "medium"}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                          />
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Address Section */}
                <Grid item xs={12}>
                  <Card sx={{
                    mb: 2,
                    borderRadius: 2,
                    boxShadow: darkMode
                      ? '0 2px 8px rgba(0,0,0,0.3)'
                      : '0 2px 8px rgba(0,0,0,0.05)',
                    background: darkMode
                      ? 'rgba(40, 40, 40, 0.8)'
                      : 'background.paper'
                  }}>
                    <CardContent sx={{ p: { xs: 2, md: 3 } }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <LocationOn color={darkMode ? "secondary" : "primary"} sx={{ mr: 1 }} />
                        <Typography variant="h6" fontWeight={600} color={darkMode ? "text.primary" : "text.primary"}>
                          Address Information
                        </Typography>
                      </Box>
                      <Grid container spacing={2}>
                        <Grid item xs={12}>
                          <TextField
                            label="Street Address"
                            name="street"
                            value={form.address.street}
                            onChange={handleChange}
                            fullWidth
                            variant="outlined"
                            size={isMobile ? "small" : "medium"}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            label="City"
                            name="city"
                            value={form.address.city}
                            onChange={handleChange}
                            fullWidth
                            variant="outlined"
                            size={isMobile ? "small" : "medium"}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            label="State/Province"
                            name="state"
                            value={form.address.state}
                            onChange={handleChange}
                            fullWidth
                            variant="outlined"
                            size={isMobile ? "small" : "medium"}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            label="Country"
                            name="country"
                            value={form.address.country}
                            onChange={handleChange}
                            fullWidth
                            variant="outlined"
                            size={isMobile ? "small" : "medium"}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            label="Postal Code"
                            name="postalCode"
                            value={form.address.postalCode}
                            onChange={handleChange}
                            fullWidth
                            variant="outlined"
                            size={isMobile ? "small" : "medium"}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                          />
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Business Details Section */}
                <Grid item xs={12}>
                  <Card sx={{
                    mb: 2,
                    borderRadius: 2,
                    boxShadow: darkMode
                      ? '0 2px 8px rgba(0,0,0,0.3)'
                      : '0 2px 8px rgba(0,0,0,0.05)',
                    background: darkMode
                      ? 'rgba(40, 40, 40, 0.8)'
                      : 'background.paper'
                  }}>
                    <CardContent sx={{ p: { xs: 2, md: 3 } }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <Receipt color={darkMode ? "secondary" : "primary"} sx={{ mr: 1 }} />
                        <Typography variant="h6" fontWeight={600} color={darkMode ? "text.primary" : "text.primary"}>
                          Business Details
                        </Typography>
                      </Box>
                      <Grid container spacing={2}>
                        <Grid item xs={12}>
                          <TextField
                            label="Website"
                            name="website"
                            value={form.website}
                            onChange={handleChange}
                            fullWidth
                            variant="outlined"
                            size={isMobile ? "small" : "medium"}
                            InputProps={{
                              startAdornment: <Language sx={{ mr: 1, color: 'text.secondary' }} />
                            }}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                          />
                        </Grid>
                        <Grid item xs={12}>
                          <TextField
                            label="Tax/VAT/NTN Number"
                            name="taxNumber"
                            value={form.taxNumber}
                            onChange={handleChange}
                            fullWidth
                            variant="outlined"
                            size={isMobile ? "small" : "medium"}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                          />
                        </Grid>
                        <Grid item xs={12}>
                          <FormControl fullWidth variant="outlined" size={isMobile ? "small" : "medium"}>
                            <InputLabel>Payment Terms</InputLabel>
                            <Select
                              name="paymentTerms"
                              value={form.paymentTerms}
                              label="Payment Terms"
                              onChange={handleChange}
                              sx={{ borderRadius: 2 }}
                            >
                              {paymentTermsOptions.map(term => (
                                <MenuItem key={term} value={term}>{term}</MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <FormControl fullWidth variant="outlined" size={isMobile ? "small" : "medium"}>
                            <InputLabel>Preferred Currency</InputLabel>
                            <Select
                              name="preferredCurrency"
                              value={form.preferredCurrency}
                              label="Preferred Currency"
                              onChange={handleChange}
                              sx={{ borderRadius: 2 }}
                            >
                              {currencies.map(c => (
                                <MenuItem key={c} value={c}>{c}</MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <FormControl fullWidth variant="outlined" size={isMobile ? "small" : "medium"}>
                            <InputLabel>Status</InputLabel>
                            <Select
                              name="status"
                              value={form.status}
                              label="Status"
                              onChange={handleChange}
                              sx={{ borderRadius: 2 }}
                            >
                              {statusOptions.map(s => (
                                <MenuItem key={s} value={s}>{s}</MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Notes Section */}
                <Grid item xs={12}>
                  <Card sx={{
                    mb: 3,
                    borderRadius: 2,
                    boxShadow: darkMode
                      ? '0 2px 8px rgba(0,0,0,0.3)'
                      : '0 2px 8px rgba(0,0,0,0.05)',
                    background: darkMode
                      ? 'rgba(40, 40, 40, 0.8)'
                      : 'background.paper'
                  }}>
                    <CardContent sx={{ p: { xs: 2, md: 3 } }}>
                      <TextField
                        label="Additional Notes"
                        name="notes"
                        value={form.notes}
                        onChange={handleChange}
                        multiline
                        rows={isMobile ? 3 : 4}
                        fullWidth
                        variant="outlined"
                        size={isMobile ? "small" : "medium"}
                        placeholder="Enter any additional information about this vendor..."
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderRadius: 2,
                            backgroundColor: darkMode ? 'rgba(50, 50, 50, 0.8)' : 'background.paper'
                          },
                          '& .MuiInputLabel-root': {
                            color: darkMode ? 'rgba(255, 255, 255, 0.7)' : 'text.secondary'
                          },
                          '& .MuiOutlinedInput-input': {
                            color: darkMode ? 'text.primary' : 'text.primary'
                          }
                        }}
                      />
                    </CardContent>
                  </Card>
                </Grid>

                {/* Submit Button */}
                <Grid item xs={12}>
                  <Button
                    type="submit"
                    variant="contained"
                    color="primary"
                    fullWidth
                    size={isMobile ? "medium" : "large"}
                    sx={{
                      py: { xs: 1.5, md: 2 },
                      borderRadius: 2,
                      fontSize: { xs: '1rem', md: '1.1rem' },
                      fontWeight: 600,
                      background: darkMode
                        ? 'linear-gradient(45deg, #90caf9, #64b5f6)'
                        : '#1976D2',
                      boxShadow: darkMode
                        ? '0 4px 15px rgba(144, 202, 249, 0.3)'
                        : '0 4px 15px rgba(102, 126, 234, 0.4)',
                      '&:hover': {
                        background: darkMode
                          ? 'linear-gradient(45deg, #64b5f6, #42a5f5)'
                          : '#1976D2',
                        boxShadow: darkMode
                          ? '0 6px 20px rgba(144, 202, 249, 0.4)'
                          : '0 6px 20px rgba(102, 126, 234, 0.5)',
                        transform: 'translateY(-2px)'
                      },
                      transition: 'all 0.3s ease'
                    }}
                  >
                    Add Vendor
                  </Button>
                </Grid>
              </Grid>
            </form>
          </Paper>
        </Box>

        {/* Snackbar for notifications */}
        <Snackbar
          open={showSnackbar}
          autoHideDuration={6000}
          onClose={() => setShowSnackbar(false)}
          anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          <Alert
            onClose={() => setShowSnackbar(false)}
            severity={error ? 'error' : 'success'}
            sx={{ width: '100%' }}
          >
            {error || success}
          </Alert>
        </Snackbar>
      </Box>
    </Fade>
  );
};

export default VendorForm;
