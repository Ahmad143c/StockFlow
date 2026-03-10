import React from 'react';
import { Box, Typography, Button, Grid, Paper } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { useDarkMode } from '../context/DarkModeContext';

const HomePage = () => {
  const navigate = useNavigate();
  const { darkMode, setDarkMode } = useDarkMode();
  return (
    <>
      <Header darkMode={darkMode} setDarkMode={setDarkMode} user={null} handleLogout={() => {}} />
      <Box sx={{ minHeight: '100vh', background: darkMode ? 'linear-gradient(135deg, #1e1e1e 0%, #121212 100%)' : 'linear-gradient(135deg, #e3f2fd 0%, #fff 100%)', py: 8, backgroundColor: 'background.default' }}>
        <Grid container justifyContent="center" alignItems="center">
          <Grid item xs={12} md={8}>
            <Paper elevation={6} sx={{ p: 6, borderRadius: 6, textAlign: 'center', background: darkMode ? 'rgba(30,30,30,0.95)' : 'rgba(255,255,255,0.95)', mt: 8, backgroundColor: 'background.paper'}}>
              <Box sx={{ mb: 3 }}>
                <Button onClick={() => navigate('/')} sx={{ p: 0, minWidth: 0 }}>
                  <img src={process.env.PUBLIC_URL + '/Inventory logo.png'} alt="Inventory Logo" style={{ height: 80 }} />
                </Button>
              </Box>
              <Typography variant="h2" fontWeight={700} color="primary" gutterBottom>
                Welcome to StockFlow
              </Typography>
              <Typography variant="h5" color="text.secondary" mb={4}>
                The Professional Inventory Management Solution for Modern Businesses
              </Typography>
              <Typography variant="body1" color="text.secondary" mb={4}>
                Easily manage products, vendors, purchase orders, and sales with a secure, user-friendly dashboard.
                <br/>Designed for admins and sellers to streamline operations, track inventory, and boost business efficiency.
              </Typography>
              <Grid container spacing={2} justifyContent="center" sx={{ mb: 2 }}>
                <Grid item>
                  <Button variant="contained" color="primary" size="large" onClick={() => navigate('/login')}>
                    Login
                  </Button>
                </Grid>
                <Grid item>
                  <Button variant="outlined" color="primary" size="large" onClick={() => navigate('/admin/products')}>
                    Explore Products
                  </Button>
                </Grid>
              </Grid>
              <Typography variant="caption" color="text.secondary">
                &copy; {new Date().getFullYear()} StockFlow. All rights reserved.
              </Typography>
            </Paper>
          </Grid>
        </Grid>
      </Box>
    </>
  );
};

export default HomePage;
