import React from 'react';
import { Box, Typography, Button, Grid, Paper, useTheme, useMediaQuery } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { useDarkMode } from '../context/DarkModeContext';

const HomePage = () => {
  const navigate = useNavigate();
  const { darkMode, setDarkMode } = useDarkMode();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  return (
    <>
      <Header darkMode={darkMode} setDarkMode={setDarkMode} user={null} handleLogout={() => {}} />
      <Box sx={{ 
        minHeight: '100vh', 
        background: darkMode ? 'linear-gradient(135deg, #1e1e1e 0%, #121212 100%)' : 'linear-gradient(135deg, #e3f2fd 0%, #fff 100%)', 
        py: { xs: 4, sm: 6, md: 8 }, 
        px: { xs: 2, sm: 3 },
        backgroundColor: 'background.default' 
      }}>
        <Grid container justifyContent="center" alignItems="center">
          <Grid item xs={12} sm={10} md={8} lg={6}>
            <Paper elevation={6} sx={{ 
              p: { xs: 3, sm: 4, md: 6 }, 
              borderRadius: { xs: 4, md: 6 }, 
              textAlign: 'center', 
              background: darkMode ? 'rgba(30,30,30,0.95)' : 'rgba(255,255,255,0.95)', 
              mt: { xs: 4, sm: 6, md: 8 }, 
              mb: { xs: 2, md: 0 },
              backgroundColor: 'background.paper',
              mx: { xs: 1, sm: 'auto' }
            }}>
              <Box sx={{ mb: { xs: 2, sm: 3 } }}>
                <Button onClick={() => navigate('/')} sx={{ p: 0, minWidth: 0 }}>
                  <img
                    src={process.env.PUBLIC_URL + '/Inventorylogo.png'}
                    alt="Inventory Logo" 
                    style={{ 
                      height: isMobile ? 50 : isTablet ? 65 : 80,
                      maxWidth: '100%',
                      objectFit: 'contain'
                    }} 
                  />
                </Button>
              </Box>
              <Typography 
                variant={isMobile ? "h4" : isTablet ? "h3" : "h2"} 
                fontWeight={700} 
                color="primary" 
                gutterBottom
                sx={{ 
                  fontSize: { xs: '2rem', sm: '2.5rem', md: '3.5rem' },
                  lineHeight: { xs: 1.2, md: 1.3 }
                }}
              >
                Welcome to StockFlow
              </Typography>
              <Typography 
                variant={isMobile ? "h6" : "h5"} 
                color="text.secondary" 
                mb={{ xs: 3, md: 4 }}
                sx={{ 
                  fontSize: { xs: '1.1rem', sm: '1.25rem', md: '1.5rem' },
                  px: { xs: 1, sm: 0 }
                }}
              >
                The Professional Inventory Management Solution for Modern Businesses
              </Typography>
              <Typography 
                variant="body1" 
                color="text.secondary" 
                mb={{ xs: 3, md: 4 }}
                sx={{ 
                  fontSize: { xs: '0.95rem', sm: '1rem' },
                  lineHeight: 1.6,
                  px: { xs: 2, sm: 0 }
                }}
              >
                Easily manage products, vendors, purchase orders, and sales with a secure, user-friendly dashboard.
                {!isMobile && <br/>}Designed for admins and sellers to streamline operations, track inventory, and boost business efficiency.
              </Typography>
              <Grid 
                container 
                spacing={{ xs: 2, sm: 2 }} 
                justifyContent="center" 
                sx={{ mb: { xs: 3, md: 2 }, flexDirection: { xs: 'column', sm: 'row' } }}
              >
                <Grid item xs={12} sm="auto">
                  <Button 
                    variant="contained" 
                    color="primary" 
                    size={isMobile ? "medium" : "large"} 
                    onClick={() => navigate('/login')}
                    fullWidth={isMobile}
                    sx={{ 
                      minWidth: { xs: '100%', sm: '140px' },
                      py: { xs: 1.5, sm: 1.5 }
                    }}
                  >
                    Login
                  </Button>
                </Grid>
                <Grid item xs={12} sm="auto">
                  <Button 
                    variant="outlined" 
                    color="primary" 
                    size={isMobile ? "medium" : "large"} 
                    onClick={() => navigate('/admin/products')}
                    fullWidth={isMobile}
                    sx={{ 
                      minWidth: { xs: '100%', sm: '140px' },
                      py: { xs: 1.5, sm: 1.5 }
                    }}
                  >
                    Explore Products
                  </Button>
                </Grid>
              </Grid>
              <Typography 
                variant="caption" 
                color="text.secondary"
                sx={{ 
                  fontSize: { xs: '0.75rem', sm: '0.8rem' },
                  px: { xs: 2, sm: 0 },
                  mt: { xs: 2, md: 1 }
                }}
              >
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
