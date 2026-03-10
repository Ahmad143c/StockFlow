import React from 'react';
import { Box, Toolbar } from '@mui/material';
import Header from '../components/Header';
import AdminSidebar from '../components/AdminSidebar';
import { Outlet } from 'react-router-dom';

const AdminDashboard = ({ darkMode, setDarkMode, user, handleLogout }) => {
  return (
    <Box sx={{ display: 'flex' }}>
      <Header darkMode={darkMode} setDarkMode={setDarkMode} user={user} handleLogout={handleLogout} />
      <AdminSidebar user={user} handleLogout={handleLogout} />
      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
};

export default AdminDashboard;
