import React, { useEffect, useState } from 'react';
import { AppBar, Toolbar, IconButton, Box, Button, Switch, Badge, Menu, MenuItem, ListItemText, Typography, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import NotificationsIcon from '@mui/icons-material/Notifications';
import MenuIcon from '@mui/icons-material/Menu';
import { useNavigate } from 'react-router-dom';

const Header = ({ darkMode = false, setDarkMode = () => {}, user, handleLogout }) => {
  const navigate = useNavigate();
  const theme = useTheme();
  // treat small and tablet screens as mobile to collapse controls
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [notif, setNotif] = useState(null);
  const [history, setHistory] = useState([]);
  const [lastSeen, setLastSeen] = useState(() => {
    try { return Number(localStorage.getItem('sales:lastSeen') || 0); } catch (e) { return 0; }
  });
  const [anchorEl, setAnchorEl] = useState(null);

  useEffect(() => {
    const readAll = () => {
      try {
        const raw = localStorage.getItem('sales:latest');
        setNotif(raw ? JSON.parse(raw) : null);
      } catch (e) { setNotif(null); }
      try {
        const rawHist = localStorage.getItem('sales:history');
        const h = rawHist ? JSON.parse(rawHist) : [];
        setHistory(Array.isArray(h) ? h : []);
      } catch (e) { setHistory([]); }
      try {
        setLastSeen(Number(localStorage.getItem('sales:lastSeen') || 0));
      } catch (e) { setLastSeen(0); }
    };

    // Initial load
    readAll();

    // Storage listener for other tabs
    const onStorage = (e) => {
      if (e.key === 'sales:latest' || e.key === 'sales:changed' || e.key === 'sales:history') {
        readAll();
        if (e.key === 'sales:latest') {
          try { const raw = localStorage.getItem('sales:latest'); if (raw) showDesktopNotification(JSON.parse(raw)); } catch (err) {}
        }
      }
      if (e.key === 'app:theme') {}
    };
    window.addEventListener('storage', onStorage);

    // Custom event listener for in-page updates
    const onChanged = (e) => {
      try { if (e?.detail?.id) showDesktopNotification({ id: e.detail.id }); } catch (err) {}
      readAll();
    };
    window.addEventListener('sales:changed', onChanged);

    // BroadcastChannel for immediate cross-tab messaging
    let ch;
    try {
      if (window.BroadcastChannel) {
        ch = new BroadcastChannel('sales');
        ch.onmessage = (ev) => {
          if (ev?.data?.notif) {
            readAll();
            showDesktopNotification(ev.data.notif);
          }
        };
      }
    } catch (e) {}

    // Also listen for in-page 'sales:latest' for immediate updates within same tab
    const onLatest = (e) => {
      try { if (e?.detail) { readAll(); showDesktopNotification(e.detail); } else readAll(); } catch (err) {}
    };
    window.addEventListener('sales:latest', onLatest);

    // Listen for cleared notifications (from other tabs or this tab)
    const onCleared = () => { readAll(); };
    window.addEventListener('sales:cleared', onCleared);

    return () => { window.removeEventListener('storage', onStorage); window.removeEventListener('sales:changed', onChanged); window.removeEventListener('sales:latest', onLatest); window.removeEventListener('sales:cleared', onCleared); if (ch) ch.close(); };
  }, []);

  const unreadCount = history ? history.filter(h => (h.ts || 0) > (lastSeen || 0)).length : 0;

  const handleOpenNotif = (e) => {
    setAnchorEl(e.currentTarget);
  };
  const handleCloseNotif = () => setAnchorEl(null);

  // toggles sidebar on mobile
  const handleSidebarToggle = () => {
    window.dispatchEvent(new Event('toggleSidebar'));
  };

  const markAllSeen = () => {
    try { localStorage.setItem('sales:lastSeen', String(Date.now())); setLastSeen(Date.now()); } catch (e) {}
  };

  const clearNotifications = () => {
    try {
      localStorage.removeItem('sales:latest');
      localStorage.removeItem('sales:history');
      localStorage.setItem('sales:lastSeen', String(Date.now()));
    } catch (e) {}
    setHistory([]);
    setNotif(null);
    setAnchorEl(null);
    try { window.dispatchEvent(new CustomEvent('sales:cleared')); window.dispatchEvent(new CustomEvent('sales:changed')); } catch (e) {}
  };

  const handleViewSale = (item) => {
    const target = item || notif;
    if (!target || !target.id) return;
    markAllSeen();
    setAnchorEl(null);
    // navigate to admin sales report with highlight query
    navigate(`/admin/sales-report?highlight=${encodeURIComponent(target.id)}`);
    // Notify report if already open
    try { window.dispatchEvent(new CustomEvent('sales:changed', { detail: { id: target.id } })); } catch (e) {}
  };

  const requestNotificationPermission = async () => {
    try {
      if (Notification && Notification.permission !== 'granted') {
        await Notification.requestPermission();
      }
    } catch (e) {}
  };

  const showDesktopNotification = (n) => {
    if (!n || !(n.id)) return;
    try {
      if (Notification && Notification.permission === 'granted' && user && user.role === 'admin') {
        const title = 'New Sale Recorded';
        const by = n.cashierName || n.sellerName || 'Seller';
        const itemsText = n.totalItems ? ` • Items: ${n.totalItems}` : '';
        const body = `By ${by} • Inv: ${n.invoiceNumber || ''}${itemsText}`;
        const nt = new Notification(title, { body });
        nt.onclick = () => {
          try { window.focus(); } catch (e) {}
          try { window.location.href = `/admin/sales-report?highlight=${encodeURIComponent(n.id)}`; } catch (e) {}
          nt.close();
        };
      }
    } catch (e) { }
  };

  return (
    <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
      <Toolbar>
        <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center' }}>
          {isMobile && (
            <IconButton color="inherit" onClick={handleSidebarToggle} sx={{ mr: 1 }}>
              <MenuIcon />
            </IconButton>
          )}
          <Button onClick={() => navigate('/')} sx={{ p: 0, minWidth: 0 }}>
            <img
              src={process.env.PUBLIC_URL + 'logo192.png'}
              alt="Logo"
              style={{ height: isMobile ? 32 : 40, marginRight: 10 }}
            />
          </Button>
        </Box>

        {/* Notification bell for admin */}
        {user && user.role === 'admin' && (
          <>
            <IconButton color="inherit" onClick={(e) => { handleOpenNotif(e); requestNotificationPermission(); }}>
              <Badge color="error" badgeContent={unreadCount > 0 ? unreadCount : 0} showZero={false} overlap="circular">
                <NotificationsIcon />
              </Badge>
            </IconButton>
            <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => { handleCloseNotif(); markAllSeen(); }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1 }}>
                <ListItemText primary="Notifications" />
                <Box>
                  <Button size="small" onClick={(e) => { e.stopPropagation(); markAllSeen(); }} sx={{ mr: 1 }}>Mark all read</Button>
                  <Button size="small" color="error" onClick={(e) => { e.stopPropagation(); clearNotifications(); }}>Clear</Button>
                </Box>
              </Box>
              {history?.length === 0 && <MenuItem disabled><ListItemText primary="No notifications" /></MenuItem>}
              {history?.slice(0, 10).map((item, i) => (
                <MenuItem key={item.id || i} onClick={() => handleViewSale(item)} sx={{ backgroundColor: (item.ts || 0) > (lastSeen || 0) ? 'rgba(255,235,59,0.12)' : 'inherit' }}>
                  <ListItemText primary={`Sale by ${item.cashierName || item.sellerName || 'Unknown'}`} secondary={`Invoice #${item.invoiceNumber || ''} • Items: ${item.totalItems || 0} • ${new Date(item.createdAt).toLocaleString()}`} />
                </MenuItem>
              ))}
            </Menu>
          </>
        )}

        <IconButton color="inherit" onClick={() => setDarkMode(!darkMode)}>
          {darkMode ? <Brightness7Icon /> : <Brightness4Icon />}
        </IconButton>
        <Switch checked={darkMode} onChange={() => setDarkMode(!darkMode)} color="default" />
      </Toolbar>
    </AppBar>
  );
};

export default Header;
