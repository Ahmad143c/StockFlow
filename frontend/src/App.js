import HomePage from './pages/HomePage';
import React, { useState, useEffect } from 'react';
import { Provider, useDispatch } from 'react-redux';
import store from './redux/store';
import { CssBaseline, Box } from '@mui/material';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { Routes, Route, useNavigate, useParams } from 'react-router-dom';
import { fetchProducts } from './redux/productsSlice';
import AdminDashboard from './pages/AdminDashboard';
import SellerDashboard from './pages/SellerDashboard';
import AdminHome from './pages/AdminHome';
import SellerHome from './pages/SellerHome';
import Login from './pages/Login';
import Header from './components/Header';
import './App.css';
import AddProduct from './pages/AddProduct';
import AdminProductList from './pages/AdminProductList';
import AdminProductProfile from './pages/AdminProductProfile';
import AdminPurchaseOrder from './pages/AdminPurchaseOrder';
import AdminPurchaseReport from './pages/AdminPurchaseReport';
import AdminSellerClients from './pages/AdminSellerClients';
import VendorForm from './pages/VendorForm';
import ViewVendors from './pages/ViewVendors';
import AdminSellers from './pages/AdminSellers';
import CreateSeller from './pages/CreateSeller';
import SellerProductList from './pages/SellerProductList';
import SellerSaleEntry from './pages/SellerSaleEntry';
import SellerSalesReport from './pages/SellerSalesReport';
import SellerRefunds from './pages/SellerRefunds';
import SellerInvoiceGenerator from './pages/SellerInvoiceGenerator';
import SellerClientDetail from './pages/SellerClientDetail';
import AdminSalesReport from './pages/AdminSalesReport';
import AdminRefunds from './pages/AdminRefunds';
import { DarkModeProvider, useDarkMode } from './context/DarkModeContext';

function AppContent() {
  const { darkMode, setDarkMode } = useDarkMode();
  const dispatch = useDispatch();
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });

  const theme = createTheme({
    palette: {
      mode: darkMode ? 'dark' : 'light',
      primary: { main: '#1976d2' },
      background: {
        default: darkMode ? '#121212' : '#fafafa',
        paper: darkMode ? '#1e1e1e' : '#fff',
      },
    },
    typography: {
      fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    },
  });

  const navigate = useNavigate();
  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    navigate('/login');
  };

  useEffect(() => {
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
    }
  }, [user]);

  // Load products from Redux on app startup
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      dispatch(fetchProducts()).catch(e => {
        console.error('Failed to load products:', e);
      });
    }
  }, [dispatch]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ width: '100%', p: { xs: 1, md: 2 } }}>
        <Header darkMode={darkMode} setDarkMode={setDarkMode} user={user} handleLogout={handleLogout} />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<Login setUser={setUser} />} />
          <Route path="/admin/*" element={user?.role === 'admin' ? <AdminDashboard darkMode={darkMode} setDarkMode={setDarkMode} user={user} handleLogout={handleLogout} /> : <Login setUser={setUser} /> }>
            <Route index element={<AdminHome />} />
            <Route path="products" element={<AdminProductList />} />
            <Route path="product/:productId" element={<AdminProductProfile />} />
            <Route path="add-product" element={<AddProduct />} />
            <Route path="add-purchase" element={<AdminPurchaseOrder />} />
            <Route path="purchases-report" element={<AdminPurchaseReport />} />
            <Route path="sellers" element={<AdminSellers />} />
            <Route path="seller-clients" element={<AdminSellerClients />} />
            <Route path="seller-clients/:sellerId" element={<SellerClientDetailWrapper />} />
            <Route path="vendors/add" element={<VendorForm />} />
            <Route path="vendors" element={<ViewVendors />} />
            <Route path="create-seller" element={<CreateSeller />} />
            <Route path="sales-report" element={<AdminSalesReport />} />
            <Route path="refunds" element={<AdminRefunds />} />
          </Route>
          <Route path="/seller/*" element={user?.role === 'staff' ? <SellerDashboard darkMode={darkMode} setDarkMode={setDarkMode} user={user} handleLogout={handleLogout} /> : <Login setUser={setUser} /> }>
            <Route index element={<SellerHome />} />
            <Route path="product-list" element={<SellerProductList />} />
            <Route path="sale-entry" element={<SellerSaleEntry />} />
            <Route path="sales-report" element={<SellerSalesReport />} />
            <Route path="refunds" element={<SellerRefunds />} />
            <Route path="generate-invoice" element={<SellerInvoiceGenerator />} />
            <Route path="clients" element={<SellerClientDetail sellerId={user?._id} />} />
          </Route>
          <Route path="*" element={<Login setUser={setUser} />} />
        </Routes>
      </Box>
    </ThemeProvider>
  );
}

function SellerClientDetailWrapper() {
  const { sellerId } = useParams();
  
  // Debug logging
  if (!sellerId) {
    console.warn('SellerClientDetailWrapper: sellerId is undefined or empty', { sellerId });
  } else {
    console.log('SellerClientDetailWrapper: sellerId received', { sellerId });
  }
  
  return <SellerClientDetail sellerId={sellerId} />;
}

function App() {
  return (
    <Provider store={store}>
      <DarkModeProvider>
        <AppContent />
      </DarkModeProvider>
    </Provider>
  );
}

export default App;
