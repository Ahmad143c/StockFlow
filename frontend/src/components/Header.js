import React, { useEffect, useState } from 'react';
import axios from 'axios';
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
  const [lastSaleTimestamp, setLastSaleTimestamp] = useState(() => {
    try { return Number(localStorage.getItem('sales:lastTimestamp') || 0); } catch (e) { return 0; }
  });

  // Warranty and refund notification states
  const [warrantyNotif, setWarrantyNotif] = useState(null);
  const [warrantyHistory, setWarrantyHistory] = useState([]);
  const [refundNotif, setRefundNotif] = useState(null);
  const [refundHistory, setRefundHistory] = useState([]);
  const [warrantyLastSeen, setWarrantyLastSeen] = useState(() => {
    try { return Number(localStorage.getItem('warranty:lastSeen') || 0); } catch (e) { return 0; }
  });
  const [refundLastSeen, setRefundLastSeen] = useState(() => {
    try { return Number(localStorage.getItem('refund:lastSeen') || 0); } catch (e) { return 0; }
  });

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
      // Read warranty notifications
      try {
        const rawWarranty = localStorage.getItem('warranty:latest');
        setWarrantyNotif(rawWarranty ? JSON.parse(rawWarranty) : null);
      } catch (e) { setWarrantyNotif(null); }
      try {
        const rawWarrantyHist = localStorage.getItem('warranty:history');
        const wh = rawWarrantyHist ? JSON.parse(rawWarrantyHist) : [];
        setWarrantyHistory(Array.isArray(wh) ? wh : []);
      } catch (e) { setWarrantyHistory([]); }
      try {
        setWarrantyLastSeen(Number(localStorage.getItem('warranty:lastSeen') || 0));
      } catch (e) { setWarrantyLastSeen(0); }
      // Read refund notifications
      try {
        const rawRefund = localStorage.getItem('refunds:latest');
        setRefundNotif(rawRefund ? JSON.parse(rawRefund) : null);
      } catch (e) { setRefundNotif(null); }
      try {
        const rawRefundHist = localStorage.getItem('refunds:history');
        const rh = rawRefundHist ? JSON.parse(rawRefundHist) : [];
        setRefundHistory(Array.isArray(rh) ? rh : []);
      } catch (e) { setRefundHistory([]); }
      try {
        setRefundLastSeen(Number(localStorage.getItem('refund:lastSeen') || 0));
      } catch (e) { setRefundLastSeen(0); }
    };

    // Initial load
    readAll();

    // Storage listener for other tabs
    const onStorage = (e) => {
      if (e.key === 'sales:latest' || e.key === 'sales:changed' || e.key === 'sales:history' ||
          e.key === 'warranty:latest' || e.key === 'warranty:history' ||
          e.key === 'refunds:latest' || e.key === 'refunds:history') {
        readAll();
        if (e.key === 'sales:latest') {
          try { const raw = localStorage.getItem('sales:latest'); if (raw) showDesktopNotification(JSON.parse(raw)); } catch (err) {}
        }
        if (e.key === 'warranty:latest') {
          try { const raw = localStorage.getItem('warranty:latest'); if (raw) handleWarrantyNotification(JSON.parse(raw)); } catch (err) {}
        }
        if (e.key === 'refunds:latest') {
          try { const raw = localStorage.getItem('refunds:latest'); if (raw) handleRefundNotification(JSON.parse(raw)); } catch (err) {}
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

    // Warranty claim event listener
    const onWarranty = (e) => {
      try { if (e?.detail) { readAll(); handleWarrantyNotification(e.detail); } else readAll(); } catch (err) {}
    };
    window.addEventListener('warranty:latest', onWarranty);

    // Refund event listener
    const onRefund = (e) => {
      try { if (e?.detail) { readAll(); handleRefundNotification(e.detail); } else readAll(); } catch (err) {}
    };
    window.addEventListener('refunds:latest', onRefund);

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

    // Polling mechanism for admin users
    let pollingInterval;
    let warrantyPollingInterval;
    let refundPollingInterval;
    if (user && user.role === 'admin') {
      // Detect if running in GitHub Codespace
      const isCodespace = process.env.CODESPACE_NAME !== undefined;
      const codespaceUrl = isCodespace ? `https://${process.env.CODESPACE_NAME}-5000.app.github.dev` : null;
      const API_URL = process.env.REACT_APP_API_URL || (isCodespace ? codespaceUrl : 'http://localhost:5000');
      
      const fetchNewSales = async () => {
        try {
          const token = localStorage.getItem('token');
          // Read current timestamp from localStorage to avoid stale closure
          const currentLastTimestamp = Number(localStorage.getItem('sales:lastTimestamp') || 0);
          
          const response = await axios.get(`${API_URL}/api/sales`, {
            headers: { Authorization: `Bearer ${token}` },
            params: { limit: 10 }
          });
          
          const sales = response.data;
          
          if (sales && sales.length > 0) {
            // Get the most recent sale
            const latestSale = sales[0];
            const latestSaleTimestamp = new Date(latestSale.createdAt).getTime();
            
            // Check if this is a new sale since last check
            if (latestSaleTimestamp > currentLastTimestamp) {
              const newNotif = {
                id: latestSale._id,
                invoiceNumber: latestSale.invoiceNumber,
                sellerName: latestSale.sellerName,
                cashierName: latestSale.cashierName,
                totalItems: latestSale.totalQuantity,
                netAmount: latestSale.netAmount,
                createdAt: latestSale.createdAt,
                ts: Date.now()
              };
              
              // Update latest notification
              localStorage.setItem('sales:latest', JSON.stringify(newNotif));
              setNotif(newNotif);
              
              // Update history - prevent duplicates by filtering out existing sale ID
              const currentHistory = JSON.parse(localStorage.getItem('sales:history') || '[]');
              const filteredHistory = currentHistory.filter(item => item.id !== latestSale._id);
              const updatedHistory = [newNotif, ...filteredHistory].slice(0, 50);
              localStorage.setItem('sales:history', JSON.stringify(updatedHistory));
              setHistory(updatedHistory);
              
              // Update last timestamp
              localStorage.setItem('sales:lastTimestamp', String(latestSaleTimestamp));
              setLastSaleTimestamp(latestSaleTimestamp);
              
              // Show desktop notification
              showDesktopNotification(newNotif);
            }
          }
        } catch (e) {
          console.error('Error fetching new sales:', e);
        }
      };
      
      // Poll every 30 seconds
      pollingInterval = setInterval(fetchNewSales, 30000);
      // Initial fetch
      fetchNewSales();
    }

    // Polling for warranty notifications (for admins only)
    if (user && user.role === 'admin') {
      // Detect if running in GitHub Codespace
      const isCodespace = process.env.CODESPACE_NAME !== undefined;
      const codespaceUrl = isCodespace ? `https://${process.env.CODESPACE_NAME}-5000.app.github.dev` : null;
      const API_URL = process.env.REACT_APP_API_URL || (isCodespace ? codespaceUrl : 'http://localhost:5000');
      const fetchWarrantyClaims = async () => {
        try {
          const token = localStorage.getItem('token');
          const response = await axios.get(`${API_URL}/api/sales/warranty/recent`, {
            headers: { Authorization: `Bearer ${token}` },
            params: { limit: 10 }
          });
          const claims = response.data;
          
          if (claims && claims.length > 0) {
            const latestClaim = claims[0];
            
            if (latestClaim.ts > (warrantyLastSeen || 0)) {
              const newNotif = {
                type: 'warranty',
                id: latestClaim.id,
                saleId: latestClaim.saleId,
                invoiceNumber: latestClaim.invoiceNumber,
                customerName: latestClaim.customerName,
                items: latestClaim.items,
                reason: latestClaim.reason,
                createdAt: latestClaim.createdAt,
                ts: latestClaim.ts
              };
              handleWarrantyNotification(newNotif);
            }
          }
        } catch (e) {
          console.error('Error fetching warranty claims:', e);
        }
      };
      warrantyPollingInterval = setInterval(fetchWarrantyClaims, 30000);
      fetchWarrantyClaims();
    }

    // Polling for refund notifications (for admins only)
    if (user && user.role === 'admin') {
      // Detect if running in GitHub Codespace
      const isCodespace = process.env.CODESPACE_NAME !== undefined;
      const codespaceUrl = isCodespace ? `https://${process.env.CODESPACE_NAME}-5000.app.github.dev` : null;
      const API_URL = process.env.REACT_APP_API_URL || (isCodespace ? codespaceUrl : 'http://localhost:5000');
      const fetchRefunds = async () => {
        try {
          const token = localStorage.getItem('token');
          const response = await axios.get(`${API_URL}/api/sales/refunds/recent`, {
            headers: { Authorization: `Bearer ${token}` },
            params: { limit: 10 }
          });
          const refunds = response.data;
          
          if (refunds && refunds.length > 0) {
            const latestRefund = refunds[0];
            
            if (latestRefund.ts > (refundLastSeen || 0)) {
              const newNotif = {
                type: 'refund',
                id: latestRefund.id,
                saleId: latestRefund.saleId,
                invoiceNumber: latestRefund.invoiceNumber,
                customerName: latestRefund.customerName,
                items: latestRefund.items,
                reason: latestRefund.reason,
                createdAt: latestRefund.createdAt,
                ts: latestRefund.ts
              };
              handleRefundNotification(newNotif);
            }
          }
        } catch (e) {
          console.error('Error fetching refunds:', e);
        }
      };
      refundPollingInterval = setInterval(fetchRefunds, 30000);
      fetchRefunds();
    }

    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('sales:changed', onChanged);
      window.removeEventListener('sales:latest', onLatest);
      window.removeEventListener('sales:cleared', onCleared);
      window.removeEventListener('warranty:latest', onWarranty);
      window.removeEventListener('refunds:latest', onRefund);
      if (ch) ch.close();
      if (pollingInterval) clearInterval(pollingInterval);
      if (warrantyPollingInterval) clearInterval(warrantyPollingInterval);
      if (refundPollingInterval) clearInterval(refundPollingInterval);
    };
  }, [user]);

  const unreadCount = history ? history.filter(h => (h.ts || 0) > (lastSeen || 0)).length : 0;
  const warrantyUnreadCount = warrantyHistory ? warrantyHistory.filter(h => (h.ts || 0) > (warrantyLastSeen || 0)).length : 0;
  const refundUnreadCount = refundHistory ? refundHistory.filter(h => (h.ts || 0) > (refundLastSeen || 0)).length : 0;
  const totalUnreadCount = unreadCount + warrantyUnreadCount + refundUnreadCount;

  const handleWarrantyNotification = (n) => {
    if (!n || !n.id) return;
    try {
      setWarrantyNotif(n);
      const currentHistory = JSON.parse(localStorage.getItem('warranty:history') || '[]');
      const filteredHistory = currentHistory.filter(item => item.id !== n.id);
      const updatedHistory = [n, ...filteredHistory].slice(0, 50);
      localStorage.setItem('warranty:history', JSON.stringify(updatedHistory));
      setWarrantyHistory(updatedHistory);
      if (Notification && Notification.permission === 'granted' && user && user.role === 'admin') {
        const title = 'Warranty Claim';
        const itemsText = n.items ? ` • Items: ${n.items.length}` : '';
        const body = `Invoice: ${n.invoiceNumber || ''}${itemsText}`;
        const nt = new Notification(title, { body });
        nt.onclick = () => {
          try { window.focus(); } catch (e) {}
          try { window.location.href = `/admin/product-list?highlight=${encodeURIComponent(n.items[0]?.productId || '')}&type=warranty`; } catch (e) {}
          nt.close();
        };
      }
    } catch (e) { }
  };

  const handleRefundNotification = (n) => {
    if (!n || !n.id) return;
    try {
      setRefundNotif(n);
      const currentHistory = JSON.parse(localStorage.getItem('refunds:history') || '[]');
      const filteredHistory = currentHistory.filter(item => item.id !== n.id);
      const updatedHistory = [n, ...filteredHistory].slice(0, 50);
      localStorage.setItem('refunds:history', JSON.stringify(updatedHistory));
      setRefundHistory(updatedHistory);
      if (Notification && Notification.permission === 'granted' && user && user.role === 'admin') {
        const title = 'Refund Processed';
        const itemsText = n.items ? ` • Items: ${n.items.length}` : '';
        const body = `Invoice: ${n.invoiceNumber || ''}${itemsText}`;
        const nt = new Notification(title, { body });
        nt.onclick = () => {
          try { window.focus(); } catch (e) {}
          try { window.location.href = `/admin/refunds?highlight=${encodeURIComponent(n.saleId || '')}&type=refund`; } catch (e) {}
          nt.close();
        };
      }
    } catch (e) { }
  };

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
    try { localStorage.setItem('warranty:lastSeen', String(Date.now())); setWarrantyLastSeen(Date.now()); } catch (e) {}
    try { localStorage.setItem('refund:lastSeen', String(Date.now())); setRefundLastSeen(Date.now()); } catch (e) {}
  };

  const clearNotifications = () => {
    try {
      localStorage.removeItem('sales:latest');
      localStorage.removeItem('sales:history');
      localStorage.setItem('sales:lastSeen', String(Date.now()));
      localStorage.removeItem('warranty:latest');
      localStorage.removeItem('warranty:history');
      localStorage.setItem('warranty:lastSeen', String(Date.now()));
      localStorage.removeItem('refunds:latest');
      localStorage.removeItem('refunds:history');
      localStorage.setItem('refund:lastSeen', String(Date.now()));
    } catch (e) {}
    setHistory([]);
    setNotif(null);
    setWarrantyHistory([]);
    setWarrantyNotif(null);
    setRefundHistory([]);
    setRefundNotif(null);
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

  const handleViewWarranty = (item) => {
    const target = item || warrantyNotif;
    if (!target || !target.saleId) return;
    markAllSeen();
    setAnchorEl(null);
    // navigate to admin sales report with highlight query for the sale with warranty claim
    navigate(`/admin/sales-report?highlight=${encodeURIComponent(target.saleId)}&type=warranty`);
  };

  const handleViewRefund = (item) => {
    const target = item || refundNotif;
    if (!target || !target.saleId) return;
    markAllSeen();
    setAnchorEl(null);
    // navigate to admin refunds with highlight query
    navigate(`/admin/refunds?highlight=${encodeURIComponent(target.saleId)}&type=refund`);
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
              src={`${process.env.PUBLIC_URL || ''}/logo192.png`}
              alt="Logo"
              style={{ height: isMobile ? 32 : 40, marginRight: 10 }}
              onError={(e) => { e.target.onerror = null; e.target.src = '/logo192.png'; }}
            />
          </Button>
        </Box>

        {/* Notification bell for admin */}
        {user && user.role === 'admin' && (
          <>
            <IconButton color="inherit" onClick={(e) => { handleOpenNotif(e); requestNotificationPermission(); }}>
              <Badge color="error" badgeContent={totalUnreadCount > 0 ? totalUnreadCount : 0} showZero={false} overlap="circular">
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
              {history?.length === 0 && warrantyHistory?.length === 0 && refundHistory?.length === 0 && <MenuItem disabled><ListItemText primary="No notifications" /></MenuItem>}
              {(() => {
                const allNotifications = [
                  ...(warrantyHistory || []).map(item => ({ ...item, type: 'warranty', lastSeen: warrantyLastSeen })),
                  ...(refundHistory || []).map(item => ({ ...item, type: 'refund', lastSeen: refundLastSeen })),
                  ...(history || []).map(item => ({ ...item, type: 'sale', lastSeen }))
                ].sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, 10);
                return allNotifications.map((item, i) => {
                  if (item.type === 'warranty') {
                    const itemsText = (item.items || []).map(it => `${it.productName || it.productId}: ${it.quantity}`).join(', ');
                    return (
                      <MenuItem key={`warranty-${item.id || i}`} onClick={() => handleViewWarranty(item)} sx={{ backgroundColor: (item.ts || 0) > (item.lastSeen || 0) ? 'rgba(255,193,7,0.12)' : 'inherit' }}>
                        <ListItemText primary={`Warranty Claim • Invoice: ${item.invoiceNumber || ''}`} secondary={`Items: ${itemsText || 'None'} • ${new Date(item.createdAt).toLocaleString()}`} />
                      </MenuItem>
                    );
                  } else if (item.type === 'refund') {
                    const itemsText = (item.items || []).map(it => `${it.productName || it.productId}: ${it.quantity}`).join(', ');
                    return (
                      <MenuItem key={`refund-${item.id || i}`} onClick={() => handleViewRefund(item)} sx={{ backgroundColor: (item.ts || 0) > (item.lastSeen || 0) ? 'rgba(244,67,54,0.12)' : 'inherit' }}>
                        <ListItemText primary={`Refund Processed • Invoice: ${item.invoiceNumber || ''}`} secondary={`Items: ${itemsText || 'None'} • ${new Date(item.createdAt).toLocaleString()}`} />
                      </MenuItem>
                    );
                  } else {
                    return (
                      <MenuItem key={`sale-${item.id || i}`} onClick={() => handleViewSale(item)} sx={{ backgroundColor: (item.ts || 0) > (item.lastSeen || 0) ? 'rgba(255,235,59,0.12)' : 'inherit' }}>
                        <ListItemText primary={`Sale • Invoice: ${item.invoiceNumber || ''}`} secondary={`By ${item.cashierName || item.sellerName || 'Unknown'} • Items: ${item.totalItems || 0} • ${new Date(item.createdAt).toLocaleString()}`} />
                      </MenuItem>
                    );
                  }
                });
              })()}
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
