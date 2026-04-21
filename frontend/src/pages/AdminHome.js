import React, { useEffect, useState, useMemo } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Fade,
  Chip,
  LinearProgress,
  Divider,
  List,
  ListItem,
  ListItemText,
  Button,
} from '@mui/material';
import API from '../api/api';
import { useDarkMode } from '../context/DarkModeContext';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import PeopleIcon from '@mui/icons-material/People';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import ReplayIcon from '@mui/icons-material/Replay';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';

const AdminHome = () => {
  const { darkMode } = useDarkMode();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [sellers, setSellers] = useState([]);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setError('Authentication token not found. Please log in again.');
          setLoading(false);
          return;
        }

        const headers = { Authorization: `Bearer ${token}` };
        const [salesRes, productsRes, sellersRes] = await Promise.all([
          API.get('/sales', { headers }),
          API.get('/products', { headers }),
          API.get('/users/sellers', { headers }),
        ]);

        setSales(Array.isArray(salesRes.data) ? salesRes.data : []);
        setProducts(Array.isArray(productsRes.data) ? productsRes.data : []);
        setSellers(Array.isArray(sellersRes.data) ? sellersRes.data : []);
      } catch (e) {
        setError(
          e.response?.data?.message ||
          e.message ||
          'Failed to load dashboard data. Please try again.'
        );
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, []);

  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);
  const monthKey = `${now.getFullYear()}-${String(
    now.getMonth() + 1
  ).padStart(2, '0')}`;

  const summary = useMemo(() => {
    let totalRevenue = 0;
    let totalOrders = 0;
    let todayRevenue = 0;
    let monthRevenue = 0;
    let totalRefund = 0;

    const revenueByDay = {};

    sales.forEach((s) => {
      const net = Number(s.netAmount || s.totalAmount || 0);
      const created = new Date(s.createdAt || s.date || Date.now());
      const dayKey = created.toISOString().slice(0, 10);
      const mKey = `${created.getFullYear()}-${String(
        created.getMonth() + 1
      ).padStart(2, '0')}`;

      totalRevenue += net;
      totalOrders += 1;
      revenueByDay[dayKey] = (revenueByDay[dayKey] || 0) + net;
      if (dayKey === todayKey) todayRevenue += net;
      if (mKey === monthKey) monthRevenue += net;

      if (Array.isArray(s.refunds) && s.refunds.length > 0) {
        s.refunds.forEach((r) => {
          if (r && (Number(r.totalRefundAmount) || 0) > 0) {
            totalRefund += Number(r.totalRefundAmount || 0);
          } else {
            totalRefund += (r.items || []).reduce((tt, it) => {
              const price = Number(it.perPiecePrice || it.price || 0);
              const qty = Number(it.quantity || 0);
              return tt + price * qty;
            }, 0);
          }
        });
      }
    });

    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const k = d.toISOString().slice(0, 10);
      last7Days.push({ date: k, value: revenueByDay[k] || 0 });
    }

    return {
      totalRevenue,
      totalOrders,
      todayRevenue,
      monthRevenue,
      totalRefund,
      last7Days,
    };
  }, [sales, todayKey, monthKey]);

  const lowStockProducts = useMemo(
    () =>
      products
        .filter((p) => {
          const cartonQuantity = Number(p.cartonQuantity) || 0;
          const piecesPerCarton = Number(p.piecesPerCarton) || 0;
          const losePieces = Number(p.losePieces) || 0;
          const totalPieces = cartonQuantity * piecesPerCarton + losePieces;
          const reorderLevel = Number(p.reorderLevel) || 0;
          const isLow = reorderLevel > 0 ? totalPieces <= reorderLevel : (cartonQuantity + (losePieces > 0 ? 1 : 0)) <= 1;
          return isLow;
        })
        .slice(0, 5),
    [products]
  );

  const latestSales = useMemo(
    () =>
      [...sales]
        .sort(
          (a, b) =>
            new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date)
        )
        .slice(0, 5),
    [sales]
  );

  return (
    <Fade in timeout={500}>
      <Box sx={{ width: '100%', maxWidth: 1800, mx: 'auto', mt: 2, mb: 4, px: { xs: 1, md: 2 } }}>
        {loading && (
          <Box sx={{ mb: 2 }}>
            <LinearProgress />
          </Box>
        )}
        {error && (
          <Paper
            elevation={3}
            sx={{ mb: 2, p: 2, borderLeft: '4px solid #d32f2f' }}
          >
            <Typography color="error" variant="body2">
              {error}
            </Typography>
          </Paper>
        )}

        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12} md={8}>
            <Typography
              variant="h4"
              sx={{ fontWeight: 700, mb: 0.5, color: darkMode ? '#fff' : '#333' }}
            >
              Admin Overview
            </Typography>
            <Typography variant="body2" color="text.secondary">
              High level snapshot of products, sellers, and sales performance.
            </Typography>
          </Grid>
          <Grid
            item
            xs={12}
            md={4}
            sx={{ display: 'flex', justifyContent: { xs: 'flex-start', md: 'flex-end' }, alignItems: 'center', gap: 1, flexWrap: 'wrap' }}
          >
            <Chip
              icon={<PeopleIcon />}
              label={`Sellers: ${sellers.length}`}
              color="primary"
              variant="outlined"
            />
            <Chip
              icon={<Inventory2Icon />}
              label={`Products: ${products.length}`}
              color="primary"
              variant="outlined"
            />
            <Chip
              icon={<TrendingUpIcon />}
              label={`Orders: ${summary.totalOrders}`}
              color="success"
              variant="outlined"
            />
          </Grid>
        </Grid>

        {/* KPI cards */}
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Paper elevation={3} sx={{ p: 2, borderRadius: 3 }}>
              <Typography variant="caption" color="text.secondary">
                Total Revenue
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5 }}>
                Rs. {summary.totalRevenue.toLocaleString()}
              </Typography>
              <Typography variant="caption" color="success.main">
                All time
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Paper elevation={3} sx={{ p: 2, borderRadius: 3 }}>
              <Typography variant="caption" color="text.secondary">
                Today&apos;s Revenue
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5 }}>
                Rs. {summary.todayRevenue.toLocaleString()}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {todayKey}
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Paper elevation={3} sx={{ p: 2, borderRadius: 3 }}>
              <Typography variant="caption" color="text.secondary">
                This Month
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5 }}>
                Rs. {summary.monthRevenue.toLocaleString()}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {monthKey}
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Paper elevation={3} sx={{ p: 2, borderRadius: 3 }}>
              <Typography variant="caption" color="text.secondary">
                Total Refunds
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5 }}>
                Rs. {summary.totalRefund.toLocaleString()}
              </Typography>
              <Typography variant="caption" color="error.main">
                Money returned to customers
              </Typography>
            </Paper>
          </Grid>
        </Grid>

        <Grid container spacing={2}>
          {/* Revenue trend */}
          <Grid item xs={12} md={8}>
            <Paper elevation={3} sx={{ p: 2.5, borderRadius: 3, height: '100%' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography
                  variant="subtitle1"
                  sx={{ fontWeight: 600, color: darkMode ? '#fff' : '#333' }}
                >
                  Last 7 Days Revenue
                </Typography>
                <Chip
                  size="small"
                  icon={<TrendingUpIcon fontSize="small" />}
                  label="Overview"
                  variant="outlined"
                />
              </Box>
              <Divider sx={{ mb: 1.5 }} />
              {summary.last7Days.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No sales data yet.
                </Typography>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {summary.last7Days.map((d) => {
                    const pct =
                      summary.monthRevenue > 0
                        ? Math.min(
                          100,
                          Math.round((d.value / summary.monthRevenue) * 100)
                        )
                        : d.value > 0
                          ? 60
                          : 0;
                    return (
                      <Box key={d.date}>
                        <Box
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            mb: 0.3,
                          }}
                        >
                          <Typography variant="caption">{d.date}</Typography>
                          <Typography variant="caption">
                            Rs. {d.value.toLocaleString()}
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={pct}
                          sx={{ height: 6, borderRadius: 3 }}
                        />
                      </Box>
                    );
                  })}
                </Box>
              )}
            </Paper>
          </Grid>

          {/* Right column: latest & low stock */}
          <Grid item xs={12} md={4}>
            <Paper
              elevation={3}
              sx={{ p: 2.5, borderRadius: 3, mb: 2, maxHeight: 260, overflow: 'hidden' }}
            >
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  mb: 1,
                }}
              >
                <Typography
                  variant="subtitle1"
                  sx={{ fontWeight: 600, color: darkMode ? '#fff' : '#333' }}
                >
                  Latest Orders
                </Typography>
                <Chip
                  size="small"
                  icon={<ReceiptLongIcon fontSize="small" />}
                  label={latestSales.length}
                />
              </Box>
              <Divider sx={{ mb: 1 }} />
              {latestSales.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No recent orders.
                </Typography>
              ) : (
                <List dense sx={{ maxHeight: 190, overflowY: 'auto' }}>
                  {latestSales.map((s) => (
                    <ListItem key={s._id} disablePadding sx={{ mb: 0.5 }}>
                      <ListItemText
                        primary={
                          <Typography variant="body2">
                            #{s.invoiceNumber || (s._id || '').toString().slice(-6)} ·{' '}
                            {s.customerName || 'Walk-in'}
                          </Typography>
                        }
                        secondary={
                          <Typography variant="caption" color="text.secondary">
                            {new Date(s.createdAt || s.date).toLocaleString()} · Rs.{' '}
                            {(s.netAmount || s.totalAmount || 0).toLocaleString()}
                          </Typography>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </Paper>

            <Paper elevation={3} sx={{ p: 2.5, borderRadius: 3 }}>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  mb: 1,
                }}
              >
                <Typography
                  variant="subtitle1"
                  sx={{ fontWeight: 600, color: darkMode ? '#fff' : '#333' }}
                >
                  Low Stock Alerts
                </Typography>
                <Chip
                  size="small"
                  icon={<ReplayIcon fontSize="small" />}
                  label={lowStockProducts.length}
                  color={lowStockProducts.length ? 'warning' : 'default'}
                />
              </Box>
              <Divider sx={{ mb: 1 }} />
              {lowStockProducts.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  All products are sufficiently stocked.
                </Typography>
              ) : (
                <List dense>
                  {lowStockProducts.map((p) => {
                    const cartonQuantity = Number(p.cartonQuantity) || 0;
                    const piecesPerCarton = Number(p.piecesPerCarton) || 0;
                    const losePieces = Number(p.losePieces) || 0;
                    const totalPieces = cartonQuantity * piecesPerCarton + losePieces;
                    const reorderLevel = Number(p.reorderLevel) || 0;
                    return (
                      <ListItem key={p._id || p.id} disablePadding sx={{ mb: 0.5 }}>
                        <ListItemText
                          primary={
                            <Typography variant="body2">{p.name || p.productName}</Typography>
                          }
                          secondary={
                            <Typography variant="caption" color="text.secondary">
                              Stock: {totalPieces} pcs {reorderLevel > 0 ? `(Reorder: ${reorderLevel})` : ''}
                            </Typography>
                          }
                        />
                      </ListItem>
                    );
                  })}
                </List>
              )}
            </Paper>
          </Grid>
        </Grid>
      </Box>
    </Fade>
  );
};

export default AdminHome;

