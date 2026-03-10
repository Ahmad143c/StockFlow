import React, { useState } from 'react';
import { Drawer, List, ListItem, ListItemIcon, ListItemText, Toolbar, Collapse, ListItemButton, Box, Tooltip, IconButton, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useLocation } from 'react-router-dom';
import DashboardIcon from '@mui/icons-material/Dashboard';
import InventoryIcon from '@mui/icons-material/Inventory';
import ReceiptIcon from '@mui/icons-material/Receipt';
import AssessmentIcon from '@mui/icons-material/Assessment';
import ListAltIcon from '@mui/icons-material/ListAlt';
import DescriptionIcon from '@mui/icons-material/Description';
import PersonIcon from '@mui/icons-material/Person';
import AddBoxIcon from '@mui/icons-material/AddBox';
import MoneyOffIcon from '@mui/icons-material/MoneyOff';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';
import { Link } from 'react-router-dom';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';

const drawerWidth = 220;
const closedWidth = 60;

const SellerSidebar = ({ user, handleLogout }) => {
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isActive = (path) => location.pathname === path;
  const startsWith = (prefix) => location.pathname.startsWith(prefix);

  const activeSx = {
    '&.Mui-selected': {
      backgroundColor: '#1976d2',
      color: '#fff',
      '& .MuiListItemIcon-root': { color: '#fff' },
    },
  };

  const hoverSx = {
    '&:hover': {
      backgroundColor: '#1565c0',
    },
  };

  const [openProducts, setOpenProducts] = useState(
    startsWith('/seller/product-list') || startsWith('/seller/product-report')
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mobileVisible, setMobileVisible] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState(false);

  React.useEffect(() => {
    setOpenProducts(startsWith('/seller/product-list') || startsWith('/seller/product-report'));
  }, [location]);

  // Custom style for icon and text spacing
  const iconTextStyle = {
    minWidth: 32,
  };

  const handleMouseEnter = () => {
    if (!isMobile) setSidebarOpen(true);
  };

  const handleMouseLeave = () => {
    if (!isMobile) setSidebarOpen(false);
  };

  const handleDrawerToggle = () => {
    if (isMobile) {
      setMobileVisible(v => {
        const next = !v;
        setMobileExpanded(false);
        return next;
      });
    }
  };

  const linkProps = isMobile ? { onClick: handleDrawerToggle } : {};
  const showLabels = sidebarOpen || (isMobile && mobileVisible && mobileExpanded);

  React.useEffect(() => {
    const handler = () => {
      if (isMobile) setMobileVisible(v => { setMobileExpanded(false); return !v; });
    };
    window.addEventListener('toggleSidebar', handler);
    return () => window.removeEventListener('toggleSidebar', handler);
  }, [isMobile]);

  const handleLogoutClick = () => {
    if (isMobile) handleDrawerToggle();
    try { if (typeof handleLogout === 'function') handleLogout(); } catch (e) {}
  };

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
          <ListItemButton sx={{ pl: 1.5, justifyContent: 'center' }} onClick={() => {
              if (isMobile) {
                if (!mobileVisible) {
                  handleDrawerToggle();
                } else {
                  setMobileExpanded(e => !e);
                }
              } else {
                setSidebarOpen(s => !s);
              }
            }}>
            <ListItemIcon sx={{ ...iconTextStyle, justifyContent: 'center' }}>
              {sidebarOpen ? <CloseIcon /> : <MenuIcon />}
            </ListItemIcon>
          </ListItemButton>
        </ListItem>

        <Tooltip title={!sidebarOpen ? "Seller Dashboard" : ""} placement="right">
          <ListItem disablePadding>
            <ListItemButton
              component={Link} {...linkProps}
              to="/seller"
              key="SellerDashboard"
              selected={isActive('/seller')}
              sx={{ ...activeSx, ...hoverSx }}
            >
              <ListItemIcon sx={iconTextStyle}><DashboardIcon /></ListItemIcon>
              <ListItemText primary="Seller Dashboard" sx={{ display: showLabels ? 'block' : 'none' }} />
            </ListItemButton>
          </ListItem>
        </Tooltip>
        
        <Tooltip title={!sidebarOpen ? "Client Detail" : ""} placement="right">
          <ListItem disablePadding>
            <ListItemButton
              component={Link} {...linkProps}
              to="/seller/clients"
              key="ClientDetail"
              selected={isActive('/seller/clients')}
              sx={{ ...activeSx, ...hoverSx }}
            >
              <ListItemIcon sx={iconTextStyle}><PersonIcon /></ListItemIcon>
              <ListItemText primary="Client Detail" sx={{ display: showLabels ? 'block' : 'none' }} />
            </ListItemButton>
          </ListItem>
        </Tooltip>
        {/* Products Section */}
        <Tooltip title={!sidebarOpen ? "Products" : ""} placement="right">
          <ListItem disablePadding>
            <ListItemButton onClick={() => setOpenProducts(!openProducts)}>
              <ListItemIcon sx={iconTextStyle}><InventoryIcon /></ListItemIcon>
              <ListItemText primary="Products" sx={{ display: showLabels ? 'block' : 'none' }} />
              {sidebarOpen && (openProducts ? <ExpandLess /> : <ExpandMore />)}
            </ListItemButton>
          </ListItem>
        </Tooltip>
        <Collapse in={openProducts} timeout="auto" unmountOnExit>
          <List component="div" disablePadding>
            <ListItem disablePadding>
              <ListItemButton
                component={Link} {...linkProps}
                to="/seller/product-list"
                selected={isActive('/seller/product-list')}
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
            <ListItem disablePadding>
              <ListItemButton
                component={Link} {...linkProps}
                to="/seller/product-report"
                selected={isActive('/seller/product-report')}
                sx={{
                  ...activeSx,
                  ...hoverSx,
                  pl: sidebarOpen ? 4 : 1.5,
                  justifyContent: sidebarOpen ? 'flex-start' : 'center',
                }}
              >
                <ListItemIcon sx={iconTextStyle}><DescriptionIcon /></ListItemIcon>
                <ListItemText primary="Product Report" sx={{ display: showLabels ? 'block' : 'none' }} />
              </ListItemButton>
            </ListItem>
          </List>
        </Collapse>
        <Tooltip title={!sidebarOpen ? "Point Of Sale" : ""} placement="right">
          <ListItem disablePadding>
            <ListItemButton
              component={Link} {...linkProps}
              to="/seller/sale-entry"
              key="SaleEntry"
              selected={isActive('/seller/sale-entry')}
              sx={{ ...activeSx, ...hoverSx }}
            >
              <ListItemIcon sx={iconTextStyle}><ReceiptIcon /></ListItemIcon>
              <ListItemText primary="Point Of Sale" sx={{ display: showLabels ? 'block' : 'none' }} />
            </ListItemButton>
          </ListItem>
        </Tooltip>
        
        <Tooltip title={!sidebarOpen ? "Sales Report" : ""} placement="right">
          <ListItem disablePadding>
            <ListItemButton
              component={Link} {...linkProps}
              to="/seller/sales-report"
              key="SalesReport"
              selected={isActive('/seller/sales-report')}
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
              to="/seller/refunds"
              key="Refunds"
              selected={isActive('/seller/refunds')}
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

export default SellerSidebar;
