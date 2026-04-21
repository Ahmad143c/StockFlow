import React, { useState, useMemo, useCallback } from 'react';
import { Drawer, List, ListItem, ListItemIcon, ListItemText, Toolbar, Collapse, ListItemButton, Box, IconButton, Tooltip, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useLocation } from 'react-router-dom';
import DashboardIcon from '@mui/icons-material/Dashboard';
import InventoryIcon from '@mui/icons-material/Inventory';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import PeopleIcon from '@mui/icons-material/People';
import AddBoxIcon from '@mui/icons-material/AddBox';
import ListAltIcon from '@mui/icons-material/ListAlt';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import ReceiptIcon from '@mui/icons-material/Receipt';
import AssessmentIcon from '@mui/icons-material/Assessment';
import MoneyOffIcon from '@mui/icons-material/MoneyOff';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';
import { Link } from 'react-router-dom';
import ListIcon from '@mui/icons-material/List';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';

const drawerWidth = 220;
const closedWidth = 60;

const AdminSidebar = ({ user, handleLogout }) => {
  const location = useLocation();

  const theme = useTheme();
  // treat small and tablets as mobile for drawer behaviour
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // helpers - memoized
  const isActive = useCallback((path) => location.pathname === path, [location.pathname]);
  const startsWith = useCallback((prefix) => location.pathname.startsWith(prefix), [location.pathname]);

  const activeSx = useMemo(() => ({
    '&.Mui-selected': {
      backgroundColor: '#1976d2',
      color: '#fff',
      '& .MuiListItemIcon-root': { color: '#fff' },
    },
    '&.Mui-selected:hover': {
      backgroundColor: '#1976d2',
    },
  }), []);

  const hoverSx = useMemo(() => ({
    '&:hover': {
      backgroundColor: '#1565c0',
    },
  }), []);

  const [openProduct, setOpenProduct] = useState(startsWith('/admin/add-product') || startsWith('/admin/products'));
  const [openSeller, setOpenSeller] = useState(
    startsWith('/admin/create-seller') || startsWith('/admin/sellers') || startsWith('/admin/seller-clients')
  );
  const [openVendors, setOpenVendors] = useState(startsWith('/admin/vendors'));
  const [openInventory, setOpenInventory] = useState(
    startsWith('/admin/add-purchase') || startsWith('/admin/purchases-report')
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mobileVisible, setMobileVisible] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState(false);

  // update collapses whenever location changes

  // update collapses whenever location changes
  React.useEffect(() => {
    setOpenProduct(startsWith('/admin/add-product') || startsWith('/admin/products'));
    setOpenSeller(
      startsWith('/admin/create-seller') || startsWith('/admin/sellers') || startsWith('/admin/seller-clients')
    );
    setOpenVendors(startsWith('/admin/vendors'));
    setOpenInventory(startsWith('/admin/add-purchase') || startsWith('/admin/purchases-report'));
  }, [location]);

  // Custom style for icon and text spacing - memoized
  const iconTextStyle = useMemo(() => ({
    minWidth: 32,
  }), []);

  const handleMouseEnter = useCallback(() => {
    if (!isMobile) setSidebarOpen(true);
  }, [isMobile]);

  const handleMouseLeave = useCallback(() => {
    if (!isMobile) setSidebarOpen(false);
  }, [isMobile]);

  const handleDrawerToggle = useCallback(() => {
    if (isMobile) {
      setMobileVisible(v => {
        const next = !v;
        // reset expanded state when toggling (open or close)
        setMobileExpanded(false);
        return next;
      });
    }
  }, [isMobile]);

  const linkProps = useMemo(() => isMobile ? { onClick: handleDrawerToggle } : {}, [isMobile, handleDrawerToggle]);

  const showLabels = useMemo(() => sidebarOpen || (isMobile && mobileVisible && mobileExpanded), [sidebarOpen, isMobile, mobileVisible, mobileExpanded]);

  React.useEffect(() => {
    const handler = () => {
      if (isMobile) setMobileVisible(v => { setMobileExpanded(false); return !v; });
    };
    window.addEventListener('toggleSidebar', handler);
    return () => window.removeEventListener('toggleSidebar', handler);
  }, [isMobile]);

  const handleLogoutClick = useCallback(() => {
    if (isMobile) handleDrawerToggle();
    try { if (typeof handleLogout === 'function') handleLogout(); } catch (e) {}
  }, [isMobile, handleDrawerToggle]);

  const handleToggleClick = useCallback(() => {
    if (isMobile) {
      if (!mobileVisible) {
        handleDrawerToggle();
      } else {
        setMobileExpanded(e => !e);
      }
    } else {
      setSidebarOpen(s => !s);
    }
  }, [isMobile, mobileVisible, handleDrawerToggle]);

  const handleProductToggle = useCallback(() => setOpenProduct(p => !p), []);
  const handleSellerToggle = useCallback(() => setOpenSeller(p => !p), []);
  const handleVendorsToggle = useCallback(() => setOpenVendors(p => !p), []);
  const handleInventoryToggle = useCallback(() => setOpenInventory(p => !p), []);

  return (
    <Box
      sx={{
        display: 'flex',
        position: 'relative',
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <Drawer
        variant={isMobile ? 'temporary' : 'permanent'}
        open={isMobile ? mobileVisible : true}
        onClose={handleDrawerToggle}
        ModalProps={{ keepMounted: true }}
        sx={{
          width: isMobile ? (mobileVisible ? (mobileExpanded ? drawerWidth : closedWidth) : closedWidth) : (sidebarOpen ? drawerWidth : closedWidth),
          flexShrink: 0,
          transition: 'width 0.3s ease',
          [`& .MuiDrawer-paper`]: {
            width: isMobile ? (mobileVisible ? (mobileExpanded ? drawerWidth : closedWidth) : closedWidth) : (sidebarOpen ? drawerWidth : closedWidth),
            boxSizing: 'border-box',
            transition: 'width 0.3s ease',
            overflow: 'visible',
          },
        }}
      >
      <Toolbar />
      <List>
        {/* Toggle Button */}
        <ListItem disablePadding>
          <ListItemButton sx={{ pl: 1.5, justifyContent: 'center' }} onClick={handleToggleClick}>
            <ListItemIcon sx={{ ...iconTextStyle, justifyContent: 'center' }}>
              {sidebarOpen ? <CloseIcon /> : <MenuIcon />}
            </ListItemIcon>
          </ListItemButton>
        </ListItem>

        {/* Dashboard */}
        <Tooltip title={!sidebarOpen ? "Dashboard" : ""} placement="right">
          <ListItem disablePadding>
            <ListItemButton
              component={Link} {...linkProps}
              to="/admin"
              selected={isActive('/admin')}
              sx={{ ...activeSx, ...hoverSx }}
            >
              <ListItemIcon sx={iconTextStyle}><DashboardIcon /></ListItemIcon>
              <ListItemText primary="Dashboard" sx={{ display: showLabels ? 'block' : 'none' }} />
            </ListItemButton>
          </ListItem>
        </Tooltip>

        {/* Product Section */}
  <Tooltip title={!sidebarOpen ? "Product" : ""} placement="right">
    <ListItem disablePadding>
          <ListItemButton onClick={handleProductToggle}>
            <ListItemIcon sx={iconTextStyle}><InventoryIcon /></ListItemIcon>
            <ListItemText primary="Product" sx={{ display: showLabels ? 'block' : 'none' }} />
            {sidebarOpen && (openProduct ? <ExpandLess /> : <ExpandMore />)}
          </ListItemButton>
        </ListItem>
    </Tooltip>
        <Collapse in={openProduct} timeout="auto" unmountOnExit>
          <List component="div" disablePadding>
            <ListItem disablePadding>
                <ListItemButton
                  component={Link} {...linkProps}
                  to="/admin/add-product"
                  selected={isActive('/admin/add-product')}
                  sx={{
                    ...activeSx,
                    ...hoverSx,
                    pl: sidebarOpen ? 4 : 1.5,
                    justifyContent: sidebarOpen ? 'flex-start' : 'center',
                  }}
                >
                  <ListItemIcon sx={iconTextStyle}><AddBoxIcon /></ListItemIcon>
                  <ListItemText primary="Add Product" sx={{ display: showLabels ? 'block' : 'none' }} />
                </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton
                component={Link} {...linkProps}
                to="/admin/products"
                selected={isActive('/admin/products')}
                sx={{
                  ...activeSx,
                  ...hoverSx,
                  pl: sidebarOpen ? 4 : 1.5,
                  justifyContent: sidebarOpen ? 'flex-start' : 'center',
                }}
              >
                <ListItemIcon sx={iconTextStyle}><ListAltIcon /></ListItemIcon>
                <ListItemText primary="Product List" sx={{ display: showLabels ? 'block' : 'none' }} />
              </ListItemButton>
            </ListItem>
          </List>
        </Collapse>
        {/* Seller Section */}
  <Tooltip title={!sidebarOpen ? "Seller" : ""} placement="right">
    <ListItem disablePadding>
          <ListItemButton onClick={handleSellerToggle}>
            <ListItemIcon sx={iconTextStyle}><PeopleIcon /></ListItemIcon>
            <ListItemText primary="Seller" sx={{ display: showLabels ? 'block' : 'none' }} />
            {sidebarOpen && (openSeller ? <ExpandLess /> : <ExpandMore />)}
          </ListItemButton>
        </ListItem>
    </Tooltip>
        <Collapse in={openSeller} timeout="auto" unmountOnExit>
          <List component="div" disablePadding>
            <ListItem disablePadding>
              <ListItemButton
                component={Link} {...linkProps}
                to="/admin/create-seller"
                selected={isActive('/admin/create-seller')}
                sx={{
                  ...activeSx,
                  pl: sidebarOpen ? 4 : 1.5,
                  justifyContent: sidebarOpen ? 'flex-start' : 'center',
                }}
              >
                <ListItemIcon sx={iconTextStyle}><PersonAddIcon /></ListItemIcon>
                <ListItemText primary="Create Seller" sx={{ display: showLabels ? 'block' : 'none' }} />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton
                component={Link} {...linkProps}
                to="/admin/sellers"
                selected={isActive('/admin/sellers')}
                sx={{
                  ...activeSx,
                  pl: sidebarOpen ? 4 : 1.5,
                  justifyContent: sidebarOpen ? 'flex-start' : 'center',
                }}
              >
                <ListItemIcon sx={iconTextStyle}><PeopleIcon /></ListItemIcon>
                <ListItemText primary="Seller List" sx={{ display: showLabels ? 'block' : 'none' }} />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton
                component={Link} {...linkProps}
                to="/admin/seller-clients"
                selected={isActive('/admin/seller-clients')}
                sx={{
                  ...activeSx,
                  pl: sidebarOpen ? 4 : 1.5,
                  justifyContent: sidebarOpen ? 'flex-start' : 'center',
                }}
              >
                <ListItemIcon sx={iconTextStyle}><PeopleIcon /></ListItemIcon>
                <ListItemText primary="Seller Clients" sx={{ display: showLabels ? 'block' : 'none' }} />
              </ListItemButton>
            </ListItem>
          </List>
        </Collapse>
        {/* Vendors Section */}
        <Tooltip title={!sidebarOpen ? "Vendors" : ""} placement="right">
          <ListItem disablePadding>
            <ListItemButton onClick={handleVendorsToggle}>
              <ListItemIcon sx={iconTextStyle}><PeopleIcon /></ListItemIcon>
              <ListItemText primary="Vendors" sx={{ display: showLabels ? 'block' : 'none' }} />
              {sidebarOpen && (openVendors ? <ExpandLess /> : <ExpandMore />)}
            </ListItemButton>
          </ListItem>
        </Tooltip>
        <Collapse in={openVendors} timeout="auto" unmountOnExit>
          <List component="div" disablePadding>
            <ListItem disablePadding>
              <ListItemButton
                component={Link} {...linkProps}
                to="/admin/vendors/add"
                selected={isActive('/admin/vendors/add')}
                sx={{
                  ...activeSx,
                  pl: sidebarOpen ? 4 : 1.5,
                  justifyContent: sidebarOpen ? 'flex-start' : 'center',
                }}
              >
                <ListItemIcon sx={iconTextStyle}><PersonAddIcon /></ListItemIcon>
                <ListItemText primary="Add New Vendor" sx={{ display: showLabels ? 'block' : 'none' }} />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton
                component={Link} {...linkProps}
                to="/admin/vendors"
                selected={isActive('/admin/vendors')}
                sx={{
                  ...activeSx,
                  pl: sidebarOpen ? 4 : 1.5,
                  justifyContent: sidebarOpen ? 'flex-start' : 'center',
                }}
              >
                <ListItemIcon sx={iconTextStyle}><ListIcon /></ListItemIcon>
                <ListItemText primary="View Vendors" sx={{ display: showLabels ? 'block' : 'none' }} />
              </ListItemButton>
            </ListItem>
          </List>
        </Collapse>
        
        {/* Inventory Purchases Section */}
        <Tooltip title={!sidebarOpen ? "Inventory Purchases" : ""} placement="right">
          <ListItem disablePadding>
            <ListItemButton onClick={handleInventoryToggle}>
              <ListItemIcon sx={iconTextStyle}><ShoppingCartIcon /></ListItemIcon>
              <ListItemText primary="Inventory Purchases" sx={{ display: showLabels ? 'block' : 'none' }} />
              {sidebarOpen && (openInventory ? <ExpandLess /> : <ExpandMore />)}
            </ListItemButton>
          </ListItem>
        </Tooltip>
        <Collapse in={openInventory} timeout="auto" unmountOnExit>
          <List component="div" disablePadding>
            <ListItem disablePadding>
              <ListItemButton
                component={Link} {...linkProps}
                to="/admin/add-purchase"
                selected={isActive('/admin/add-purchase')}
                sx={{
                  ...activeSx,
                  pl: sidebarOpen ? 4 : 1.5,
                  justifyContent: sidebarOpen ? 'flex-start' : 'center',
                }}
              >
                <ListItemIcon sx={iconTextStyle}><AddBoxIcon /></ListItemIcon>
                <ListItemText primary="Add Purchase Order" sx={{ display: showLabels ? 'block' : 'none' }} />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton
                component={Link} {...linkProps}
                to="/admin/purchases-report"
                selected={isActive('/admin/purchases-report')}
                sx={{
                  ...activeSx,
                  pl: sidebarOpen ? 4 : 1.5,
                  justifyContent: sidebarOpen ? 'flex-start' : 'center',
                }}
              >
                <ListItemIcon sx={iconTextStyle}><ReceiptIcon /></ListItemIcon>
                <ListItemText primary="Purchases Report" sx={{ display: showLabels ? 'block' : 'none' }} />
              </ListItemButton>
            </ListItem>
          </List>
        </Collapse>
        {/* Sales Report Section */}
  <Tooltip title={!sidebarOpen ? "Sales Report" : ""} placement="right">
    <ListItem disablePadding>
          <ListItemButton
            component={Link} {...linkProps}
            to="/admin/sales-report"
            selected={isActive('/admin/sales-report')}
            sx={{ ...activeSx, ...hoverSx }}
          >
            <ListItemIcon sx={iconTextStyle}><AssessmentIcon /></ListItemIcon>
            <ListItemText primary="Sales Report" sx={{ display: showLabels ? 'block' : 'none' }} />
          </ListItemButton>
        </ListItem>
    </Tooltip>
        <Tooltip title={!sidebarOpen ? "Refunds" : ""} placement="right">
          <ListItem disablePadding>
            <ListItemButton
              component={Link} {...linkProps}
              to="/admin/refunds"
              selected={isActive('/admin/refunds')}
              sx={{ ...activeSx, ...hoverSx }}
            >
              <ListItemIcon sx={iconTextStyle}><MoneyOffIcon /></ListItemIcon>
              <ListItemText primary="Refunds" sx={{ display: showLabels ? 'block' : 'none' }} />
            </ListItemButton>
          </ListItem>
        </Tooltip>
        {/* Logout */}
        {typeof handleLogout === 'function' && (
          <Tooltip title={!sidebarOpen ? "Logout" : ""} placement="right">
            <ListItem disablePadding>
              <ListItemButton onClick={handleLogoutClick} sx={{ ...hoverSx }}>
                <ListItemIcon sx={iconTextStyle}><ExitToAppIcon /></ListItemIcon>
                <ListItemText primary="Logout" sx={{ display: showLabels ? 'block' : 'none' }} />
              </ListItemButton>
            </ListItem>
          </Tooltip>
        )}
      </List>
    </Drawer>
    </Box>
  );
};

export default React.memo(AdminSidebar);
