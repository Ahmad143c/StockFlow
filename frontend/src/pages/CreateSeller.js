import React, { useState } from 'react';
import {
  Box,
  Button,
  TextField,
  Typography,
  Fade,
  Paper,
  Avatar,
  Card,
  CardContent,
  Grid,
  useTheme,
  useMediaQuery,
  Alert
} from '@mui/material';
import BusinessIcon from '@mui/icons-material/Business';
import API from '../api/api';
import { useDarkMode } from '../context/DarkModeContext';

const CreateSeller = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [shopName, setShopName] = useState('');
  const [sellingPoint, setSellingPoint] = useState('');
  const [productCategory, setProductCategory] = useState('');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { darkMode } = useDarkMode();

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
    <Fade in timeout={500}>
      <Box sx={{ minHeight: '100vh' }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', minHeight: '100vh' }}>
          <Paper
            elevation={24}
            sx={{
              p: { xs: 3, sm: 4, md: 5 },
              borderRadius: { xs: 3, md: 4 },
              width: { xs: '100%', sm: '90%', md: 500 },
              maxWidth: '100%',
              background: darkMode ? 'rgba(30, 30, 30, 0.95)' : 'rgba(255, 255, 255, 0.98)',
              backdropFilter: 'blur(10px)',
              border: darkMode ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(255, 255, 255, 0.2)',
              boxShadow: darkMode ? '0 20px 40px rgba(0, 0, 0, 0.5)' : '0 20px 40px rgba(0, 0, 0, 0.1)',
              mt: { xs: 2, sm: 4, md: 2 }
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', mb: { xs: 3, md: 4 }, textAlign: { xs: 'center', md: 'left' }, flexDirection: { xs: 'column', md: 'row' } }}>
              <Avatar sx={{ bgcolor: 'primary.main', width: { xs: 56, md: 64 }, height: { xs: 56, md: 64 }, mr: { xs: 0, md: 3 }, mb: { xs: 2, md: 0 } }}>
                <BusinessIcon sx={{ fontSize: { xs: 32, md: 36 } }} />
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
                  Create Seller Account
                </Typography>
                <Typography variant="body2" sx={{ fontSize: { xs: '0.875rem', md: '1rem' }, color: darkMode ? 'rgba(255, 255, 255, 0.7)' : 'text.secondary' }}>
                  Add seller details to manage sales and inventory.
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

            <form onSubmit={handleCreate}>
              <Grid container spacing={{ xs: 2, sm: 3 }}>
                <Grid item xs={12}>
                  <Card sx={{
                    mb: 2,
                    borderRadius: 2,
                    boxShadow: darkMode ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.05)',
                    background: darkMode ? 'rgba(40, 40, 40, 0.8)' : 'background.paper'
                  }}>
                    <CardContent sx={{ p: { xs: 2, md: 3 } }}>
                      <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                        Seller Details
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={12}>
                          <TextField label="Shop Name" fullWidth value={shopName} onChange={e => setShopName(e.target.value)} required variant="outlined" size={isMobile ? 'small' : 'medium'} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField label="Username" fullWidth value={username} onChange={e => setUsername(e.target.value)} required variant="outlined" size={isMobile ? 'small' : 'medium'} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField label="Password" type="password" fullWidth value={password} onChange={e => setPassword(e.target.value)} required variant="outlined" size={isMobile ? 'small' : 'medium'} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
                        </Grid>
                        <Grid item xs={12}>
                          <TextField label="Selling Point" fullWidth value={sellingPoint} onChange={e => setSellingPoint(e.target.value)} required variant="outlined" size={isMobile ? 'small' : 'medium'} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
                        </Grid>
                        <Grid item xs={12}>
                          <TextField label="Product Selling Category" fullWidth value={productCategory} onChange={e => setProductCategory(e.target.value)} required variant="outlined" size={isMobile ? 'small' : 'medium'} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12}>
                  <Button type="submit" variant="contained" fullWidth size={isMobile ? 'medium' : 'large'} sx={{
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
                  }}>
                    Create Seller
                  </Button>
                </Grid>
              </Grid>
            </form>
          </Paper>
        </Box>
      </Box>
    </Fade>
  );
};

export default CreateSeller;
