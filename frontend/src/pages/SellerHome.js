import React, { useEffect, useState, useMemo } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
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
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import ReplayIcon from '@mui/icons-material/Replay';

const SellerHome = () => {
  const { darkMode } = useDarkMode();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sales, setSales] = useState([]);

  useEffect(() => {
    const fetchSales = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setError('Authentication token not found. Please log in again.');
          setLoading(false);
          return;
        }
        const payload = JSON.parse(atob(token.split('.')[1]));
        const res = await API.get(`/sales?sellerId=${payload.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setSales(Array.isArray(res.data) ? res.data : []);
      } catch (e) {
        setError(
          e.response?.data?.message ||
          e.message ||
          'Failed to load seller dashboard data. Please try again.'
        );
        setSales([]);
      } finally {
        setLoading(false);
      }
    };

    fetchSales();
  }, []);

  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);
  const monthKey = `${now.getFullYear()}-${String(
    now.getMonth() + 1
  ).padStart(2, '0')}`;

  const summary = useMemo(() => {
    let totalRevenue = 0;
    let todayRevenue = 0;
    let monthRevenue = 0;
    let totalOrders = 0;
    let unpaidAmount = 0;

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

      const status = (s.paymentStatus || '').toString();
      if (status === 'Unpaid' || status.toLowerCase().includes('partial')) {
        const paid = Number(s.paidAmount || s.cashAmount || 0);
        unpaidAmount += Math.max(0, net - paid);
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
      todayRevenue,
      monthRevenue,
      totalOrders,
      unpaidAmount,
      last7Days,
    };
  }, [sales, todayKey, monthKey]);

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

  const frequentCustomers = useMemo(() => {
    const map = new Map();
    sales.forEach((s) => {
      const key = (s.customerName || 'Walk-in').toString();
      map.set(key, (map.get(key) || 0) + 1);
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));
  }, [sales]);

  return (
    <Box sx={{ width: '100%', mx: 'auto', mb: 4, px: { xs: 1, md: 2 } }}>
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
            Seller Overview
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Quick view of your sales performance, customers, and open dues.
          </Typography>
        </Grid>
        <Grid
          item
          xs={12}
          md={4}
          sx={{ display: 'flex', justifyContent: { xs: 'flex-start', md: 'flex-end' }, alignItems: 'center', gap: 1, flexWrap: 'wrap' }}
        >
          <Chip
            icon={<TrendingUpIcon />}
            label={`Orders: ${summary.totalOrders}`}
            color="primary"
            variant="outlined"
          />
        </Grid>
      </Grid>

      {/* KPI row */}
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
              Outstanding Amount
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5 }}>
              Rs. {summary.unpaidAmount.toLocaleString()}
            </Typography>
            <Typography variant="caption" color="warning.main">
              Follow up with customers
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        {/* Left: last 7 days */}
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
                label="Personal Sales"
                variant="outlined"
              />
            </Box>
            <Divider sx={{ mb: 1.5 }} />
            {summary.last7Days.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No sales yet.
              </Typography>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {summary.last7Days.map((d) => {
                  const max =
                    summary.last7Days.reduce(
                      (m, r) => (r.value > m ? r.value : m),
                      0
                    ) || 1;
                  const pct = Math.round((d.value / max) * 100);
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

        {/* Right: latest sales & frequent customers */}
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
                Latest Bills
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
                No recent bills.
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
                Frequent Customers
              </Typography>
              <Chip
                size="small"
                icon={<ReplayIcon fontSize="small" />}
                label={frequentCustomers.length}
                variant="outlined"
              />
            </Box>
            <Divider sx={{ mb: 1 }} />
            {frequentCustomers.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No repeat customers yet.
              </Typography>
            ) : (
              <List dense>
                {frequentCustomers.map((c) => (
                  <ListItem key={c.name} disablePadding sx={{ mb: 0.5 }}>
                    <ListItemText
                      primary={<Typography variant="body2">{c.name}</Typography>}
                      secondary={
                        <Typography variant="caption" color="text.secondary">
                          {c.count} invoice(s)
                        </Typography>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default SellerHome;

