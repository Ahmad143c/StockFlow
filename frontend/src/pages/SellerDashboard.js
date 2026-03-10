import React from 'react';
import { Box, Toolbar } from '@mui/material';
import { Outlet } from 'react-router-dom';
import Header from '../components/Header';
import SellerSidebar from '../components/SellerSidebar';

const SellerDashboard = ({ darkMode, setDarkMode, user, handleLogout }) => {
  return (
    <Box sx={{ display: 'flex' }}>
      <Header darkMode={darkMode} setDarkMode={setDarkMode} user={user} handleLogout={handleLogout} />
      <SellerSidebar user={user} handleLogout={handleLogout} />
      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
};

export default SellerDashboard;
