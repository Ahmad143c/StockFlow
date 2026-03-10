import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Box, Typography, Divider, Chip, Paper, Grid, Button, Tooltip, Alert, LinearProgress, Dialog, DialogTitle, DialogContent, DialogActions, IconButton, Stack, useTheme, useMediaQuery } from '@mui/material';
import API from '../api/api';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import PeopleIcon from '@mui/icons-material/People';
import InventoryIcon from '@mui/icons-material/Inventory';
import CloseIcon from '@mui/icons-material/Close';

const formatNum = n => n?.toLocaleString('en-IN');

const AdminProductProfile = () => {
  const { productId } = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // analytics will now include month revenue values
  const [analytics, setAnalytics] = useState(null);
  const [relatedPOs, setRelatedPOs] = useState([]);
  const [relatedSales, setRelatedSales] = useState([]);
  const [activityOpen, setActivityOpen] = useState(false);

  // derived values
  const topCustomers = useMemo(() => {
    if (!relatedSales.length) return [];
    const map = {};
    relatedSales.forEach(sale => {
      const name = sale.customerName || 'Unknown';
      if (!map[name]) map[name] = { quantity: 0, revenue: 0 };
      sale.items.forEach(it => {
        if (it.productId === productId || (product && product.SKU && it.SKU === product.SKU)) {
          map[name].quantity += Number(it.quantity) || 0;
          map[name].revenue += Number(it.subtotal) || 0;
        }
      });
    });
    const arr = Object.entries(map).map(([name, data]) => ({ name, ...data }));
    arr.sort((a, b) => b.revenue - a.revenue);
    return arr.slice(0, 5);
  }, [relatedSales, product, productId]);

  const insights = useMemo(() => {
    const list = [];
    if (analytics) {
      if (analytics.growthPercent > 0) {
        list.push('This product performs best in the current month');
      } else if (analytics.growthPercent < 0) {
        list.push('Revenue declining compared to last month');
      }
    }
    if (relatedPOs.length > 3) {
      list.push('High reorder frequency detected');
    }
    // low stock insight reused from earlier stock low calculation
    if (product) {
      const cartonQuantity = Number(product.cartonQuantity) || 0;
      const piecesPerCarton = Number(product.piecesPerCarton) || 0;
      const losePieces = Number(product.losePieces) || 0;
      const totalPieces = cartonQuantity * piecesPerCarton + losePieces;
      const reorderLevel = Number(product.reorderLevel) || 0;
      const isLow = reorderLevel > 0 ? totalPieces <= reorderLevel : (cartonQuantity + (losePieces > 0 ? 1 : 0)) <= 1;
      if (isLow) list.push('Low stock risk based on sales velocity');
    }
    return list;
  }, [analytics, relatedPOs, product]);

  const theme = useTheme();
  const isSm = useMediaQuery(theme.breakpoints.down('sm'));

  const monthlyProgress = useMemo(() => {
    if (!analytics) return 0;
    const { thisMonthRevenue = 0, prevMonthRevenue = 0 } = analytics;
    if (prevMonthRevenue <= 0) return 0;
    return Math.min(100, Math.round((thisMonthRevenue / prevMonthRevenue) * 100));
  }, [analytics]);

  // Build monthly revenue series (last 6 months) for a simple bar chart
  const monthlyRevenue = useMemo(() => {
    if (!relatedSales.length) return [];
    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      months.push({ key, label: d.toLocaleString('default', { month: 'short', year: 'numeric' }), revenue: 0 });
    }
    const map = Object.fromEntries(months.map(m => [m.key, m]));
    relatedSales.forEach(sale => {
      const created = new Date(sale.createdAt);
      const key = `${created.getFullYear()}-${created.getMonth()}`;
      sale.items.forEach(it => {
        if (it.productId === productId || (product && product.SKU && it.SKU === product.SKU)) {
          if (map[key]) map[key].revenue += Number(it.subtotal) || 0;
        }
      });
    });
    return Object.values(map);
  }, [relatedSales, product, productId]);

  // Friendly growth label (handles zero previous month)
  const growthLabel = useMemo(() => {
    if (!analytics) return '-';
    const { thisMonthRevenue = 0, prevMonthRevenue = 0 } = analytics;
    if (prevMonthRevenue <= 0) {
      return thisMonthRevenue > 0 ? 'New (no previous month)' : 'No change';
    }
    return `${analytics.growthPercent}%`;
  }, [analytics]);

  // create flat lists of individual refund and warranty events for display
  const refundEvents = useMemo(() => {
    const list = [];
    relatedSales.forEach(sale => {
      if (Array.isArray(sale.refunds)) {
        sale.refunds.forEach(ref => {
          ref.items.forEach(it => {
            if (it.productId === productId || (product && product.SKU && it.SKU === product.SKU)) {
              list.push({
                saleId: sale._id,
                qty: it.quantity,
                amount: (Number(it.quantity) || 0) * (Number(it.perPiecePrice) || 0),
                date: ref.createdAt,
                reason: ref.reason || ''
              });
            }
          });
        });
      }
    });
    return list.sort((a,b)=> new Date(b.date)-new Date(a.date));
  }, [relatedSales, product, productId]);

  const warrantyEvents = useMemo(() => {
    const list = [];
    relatedSales.forEach(sale => {
      if (Array.isArray(sale.warrantyClaims)) {
        sale.warrantyClaims.forEach(wc => {
          wc.items.forEach(it => {
            if (it.productId === productId || (product && product.SKU && it.SKU === product.SKU)) {
              list.push({
                saleId: sale._id,
                qty: it.quantity,
                date: wc.createdAt,
                reason: wc.reason || ''
              });
            }
          });
        });
      }
    });
    return list.sort((a,b)=> new Date(b.date)-new Date(a.date));
  }, [relatedSales, product, productId]);

  // fetch product details whenever productId changes
  useEffect(() => {
    const fetchProduct = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        const res = await API.get(`/products/${productId}`, { headers: { Authorization: `Bearer ${token}` } });
        setProduct(res.data);
      } catch (err) {
        setError('Failed to load product info');
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [productId]);

  // when product changes, fetch sales and POs related to it
  useEffect(() => {
    if (!product) return;

    const sku = product.SKU;
    const fetchActivity = async () => {
      try {
        const token = localStorage.getItem('token');
        const salesRes = await API.get('/sales', { headers: { Authorization: `Bearer ${token}` } });
        const allSales = Array.isArray(salesRes.data) ? salesRes.data : [];
        // filter by productId or SKU
        const salesForProduct = allSales.filter(sale =>
          Array.isArray(sale.items) &&
          sale.items.some(it => it.productId === productId || (sku && it.SKU === sku))
        );

        // compute analytics and totals (including refunds & warranty)
        let totalSold = 0;
        let totalRevenue = 0;
        let thisMonthRevenue = 0;
        let prevMonthRevenue = 0;
        let totalRefundQty = 0;
        let totalRefundAmount = 0;
        let totalWarrantyQty = 0;
        const now = new Date();
        const startThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0);

        salesForProduct.forEach(sale => {
          sale.items.forEach(it => {
            if (!(it.productId === productId || (sku && it.SKU === sku))) return;
            totalSold += Number(it.quantity) || 0;
            totalRevenue += Number(it.subtotal) || 0;
          });

          // handle refunds in this sale
          if (Array.isArray(sale.refunds)) {
            sale.refunds.forEach(r => {
              r.items.forEach(it => {
                if (it.productId === productId || (sku && it.SKU === sku)) {
                  const qty = Number(it.quantity) || 0;
                  const amt = qty * (Number(it.perPiecePrice) || 0);
                  totalRefundQty += qty;
                  totalRefundAmount += amt;
                  totalRevenue -= amt; // reduce revenue
                }
              });
            });
          }
          // handle warranty claims
          if (Array.isArray(sale.warrantyClaims)) {
            sale.warrantyClaims.forEach(w => {
              w.items.forEach(it => {
                if (it.productId === productId || (sku && it.SKU === sku)) {
                  totalWarrantyQty += Number(it.quantity) || 0;
                }
              });
            });
          }

          const created = new Date(sale.createdAt);
          if (created >= startThisMonth) {
            sale.items.forEach(it => {
              if (!(it.productId === productId || (sku && it.SKU === sku))) return;
              thisMonthRevenue += Number(it.subtotal) || 0;
            });
          } else if (created >= startPrevMonth && created <= endPrevMonth) {
            sale.items.forEach(it => {
              if (!(it.productId === productId || (sku && it.SKU === sku))) return;
              prevMonthRevenue += Number(it.subtotal) || 0;
            });
          }
        });
        const growthPercent = prevMonthRevenue > 0 ? Number((((thisMonthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100).toFixed(2)) : 0;
        setAnalytics({ totalSold, totalRevenue, growthPercent, thisMonthRevenue, prevMonthRevenue, totalRefundQty, totalRefundAmount, totalWarrantyQty });

        salesForProduct.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setRelatedSales(salesForProduct.slice(0, 10));
      } catch (err) {
        setAnalytics({ totalSold: 0, totalRevenue: 0, growthPercent: 0, thisMonthRevenue: 0, prevMonthRevenue: 0 });
        setRelatedSales([]);
      }

      // fetch related purchase orders
      try {
        const token = localStorage.getItem('token');
        const poRes = await API.get('/purchase-orders', { headers: { Authorization: `Bearer ${token}` } });
        const list = Array.isArray(poRes.data) ? poRes.data : [];
        const filtered = list.filter(po =>
          Array.isArray(po.items) && po.items.some(it => it.itemCode === sku)
        );
        filtered.sort((a, b) => new Date(b.poDate) - new Date(a.poDate));
        setRelatedPOs(filtered);
      } catch (err) {
        setRelatedPOs([]);
      }
    };

    fetchActivity();
  }, [product, productId]);

  // update profile when sales or products are changed elsewhere (refunds, stock adjustments etc.)
  useEffect(() => {
    const handler = () => {
      if (!productId) return;
      (async () => {
        try {
          const token = localStorage.getItem('token');
          const res = await API.get(`/products/${productId}`, { headers: { Authorization: `Bearer ${token}` } });
          setProduct(res.data);
        } catch (err) {
          // silently ignore
        }
      })();
    };
    window.addEventListener('sales:changed', handler);
    window.addEventListener('products:changed', handler);
    return () => {
      window.removeEventListener('sales:changed', handler);
      window.removeEventListener('products:changed', handler);
    };
  }, [productId]);

  if (loading) return <Typography>Loading...</Typography>;
  if (error) return <Typography color="error">{error}</Typography>;
  if (!product) return <Typography>No product found.</Typography>;

  return (
    <Box sx={{ maxWidth: { xs: '100%', md: 1100 }, mx: 'auto', mt: 4, px: { xs:1, sm:2, md:0 } }}>
      <Paper elevation={6} sx={{ p: { xs: 3, sm:4, md:6 }, borderRadius: 6, boxShadow: 8 }}>        <Grid container spacing={4}>
          <Grid item xs={12} md={7}>
            <Box>
              <Typography variant="h4" fontWeight={700} color="primary" gutterBottom>{product.name}</Typography>
              <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                <Chip label={product.category} color="primary" />
                {product.color && <Chip label={product.color} color="secondary" />}
                {product.subCategory && <Chip label={product.subCategory} color="info" />}
              </Box>
              <Divider sx={{ mb: 2 }} />
              <Typography variant="body1" gutterBottom>Brand: <b>{product.brand}</b></Typography>
              <Typography variant="body1" gutterBottom>Vendor: <b>{product.vendor}</b></Typography>
              <Typography variant="body1" gutterBottom>SKU: <b>{product.SKU}</b></Typography>
              <Typography variant="body1" gutterBottom>Color: <b>{product.color}</b></Typography>
              <Divider sx={{ my: 2 }} />
              {(() => {
                const cartonQuantity = Number(product.cartonQuantity) || 0;
                const piecesPerCarton = Number(product.piecesPerCarton) || 0;
                const losePieces = Number(product.losePieces) || 0;
                const totalPieces = cartonQuantity * piecesPerCarton + losePieces;
                const reorderLevel = Number(product.reorderLevel) || 0;
                const isLow = reorderLevel > 0 ? totalPieces <= reorderLevel : (cartonQuantity + (losePieces > 0 ? 1 : 0)) <= 1;
                return isLow ? (
                  <Alert severity="warning" sx={{ mb: 2 }}>
                    Stock low: {formatNum(totalPieces)} pcs. {reorderLevel ? `Reorder level: ${formatNum(reorderLevel)}.` : ''}
                  </Alert>
                ) : null;
              })()}
              <Typography variant="body2">Carton Quantity: <b>{formatNum(product.cartonQuantity)}</b></Typography>
              <Typography variant="body2">Pieces Per Carton: <b>{formatNum(product.piecesPerCarton)}</b></Typography>
              <Typography variant="body2">Lose Pieces: <b>{formatNum(product.losePieces)}</b></Typography>
              <Typography variant="body2">Cost Per Piece: <b>Rs. {formatNum(product.costPerPiece)}</b></Typography>
              <Typography variant="body2">Cost Per Carton: <b>Rs. {formatNum((Number(product.cartonQuantity)||0) * (Number(product.piecesPerCarton)||0) * (Number(product.costPerPiece)||0))}</b></Typography>
              <Typography variant="body2">Selling Per Piece: <b>Rs. {formatNum(product.sellingPerPiece)}</b></Typography>
              <Typography variant="body2">Total Pieces: <b>{formatNum((Number(product.cartonQuantity)||0) * (Number(product.piecesPerCarton)||0) + (Number(product.losePieces)||0))}</b></Typography>
              <Typography variant="body2">Stock Quantity: <b>Cart: {formatNum(product.cartonQuantity)}, Lose: {formatNum(product.losePieces)}</b></Typography>
              <Divider sx={{ my: 2 }} />
              <Typography variant="body2" color="success.main" fontWeight={600}>Per Piece Profit: <b>Rs. {formatNum((Number(product.sellingPerPiece)||0) - (Number(product.costPerPiece)||0))}</b></Typography>
              <Typography variant="body2" color="success.main" fontWeight={600}>Total Unit Profit: <b>Rs. {formatNum((((Number(product.sellingPerPiece)||0) - (Number(product.costPerPiece)||0)) * (((Number(product.cartonQuantity)||0) * (Number(product.piecesPerCarton)||0)) + (Number(product.losePieces)||0))))}</b></Typography>
              <Typography variant="body2" color="info.main" fontWeight={600}>Total Unit Cost: <b>Rs. {formatNum((Number(product.costPerPiece)||0) * (((Number(product.cartonQuantity)||0) * (Number(product.piecesPerCarton)||0)) + (Number(product.losePieces)||0)))}</b></Typography>
              <Typography variant="body2">Date Added: <b>{new Date(product.dateAdded).toLocaleString()}</b></Typography>
            </Box>
          </Grid>
          <Grid item xs={12} md={5}>
            <Box sx={{ textAlign: 'center', position: 'relative' }}>
              {product.image && (
                <img src={product.image} alt={product.name} style={{ maxWidth: 320, maxHeight: 320, borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.12)' }} />
              )}
            </Box>
          </Grid>
        </Grid>
        {/* additional dashboard cards */}
        <Grid container spacing={4} sx={{ mt: 4, px: { xs: 1, sm: 2 } }}>
          <Grid item xs={12} md={4}>
            <Paper elevation={3} sx={{ p: 2 }}>
              <Typography variant="h6" fontWeight={700} gutterBottom sx={{display:'flex',alignItems:'center',gap:1}}><AttachMoneyIcon fontSize="small" />Revenue Overview</Typography>
              {analytics ? (
                <>
                  <Typography variant="body2">Total Revenue: <b>Rs. {formatNum(analytics.totalRevenue)}</b></Typography>
                  {analytics.totalRefundAmount > 0 && (
                    <Typography variant="body2" color="error">Refunded: Rs. {formatNum(analytics.totalRefundAmount)}</Typography>
                  )}
                  {analytics.totalWarrantyQty > 0 && (
                    <Typography variant="body2" color="warning.main">Warranty Qty: {formatNum(analytics.totalWarrantyQty)}</Typography>
                  )}
                  <Typography variant="body2">Units Sold: <b>{formatNum(analytics.totalSold)}</b></Typography>
                  <Typography variant="body2" sx={{ display:'flex', alignItems:'center', gap:1, color: analytics && analytics.growthPercent < 0 ? 'error.main' : 'success.main' }}>
                    <TrendingUpIcon fontSize="small" /> Growth: <b>{growthLabel}</b>
                  </Typography>
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="caption">This month vs last</Typography>
                    <LinearProgress variant="determinate" value={monthlyProgress} sx={{ height: 8, borderRadius: 4, mt: 1 }} />
                    <Typography variant="caption">{monthlyProgress}%</Typography>
                  </Box>
                </>
              ) : (
                <Typography variant="body2" color="text.secondary">No revenue data</Typography>
              )}
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper elevation={3} sx={{ p: 2, cursor: 'pointer', transition: 'box-shadow 0.3s', '&:hover': { boxShadow: 6 } }} onClick={() => setActivityOpen(true)}>
              <Typography variant="h6" fontWeight={700} gutterBottom sx={{display:'flex',alignItems:'center',gap:1}}><InventoryIcon fontSize="small" />Product Activity</Typography>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Recent Sales</Typography>
              {relatedSales.length > 0 ? relatedSales.slice(0, 3).map(sale => (
                <Box key={sale._id} sx={{ mb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2">{String(sale.invoiceNumber || sale._id).slice(-6)}</Typography>
                  <Typography variant="caption">Rs. {formatNum(sale.netAmount)}</Typography>
                </Box>
              )) : <Typography variant="body2" color="text.secondary">No Sales</Typography>}
              <Divider sx={{ my: 1 }} />
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Recent POs</Typography>
              {relatedPOs.length > 0 ? relatedPOs.slice(0, 3).map(po => (
                <Box key={po._id || po.poNumber} sx={{ mb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2">{`PO ${po.poNumber}`}</Typography>
                  <Typography variant="caption">{new Date(po.poDate).toLocaleDateString()}</Typography>
                </Box>
              )) : <Typography variant="body2" color="text.secondary">No POs</Typography>}
              <Divider sx={{ my: 1 }} />
              <Typography variant="caption" color="text.secondary">Click to view charts & full activity</Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper elevation={3} sx={{ p: 2 }}>
              <Typography variant="h6" fontWeight={700} gutterBottom sx={{display:'flex',alignItems:'center',gap:1}}><PeopleIcon fontSize="small" />Top Customers</Typography>
              {topCustomers.length > 0 ? topCustomers.map(c => (
                <Box key={c.name} sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <PeopleIcon sx={{ mr: 1 }} />
                  <Typography variant="body2">{c.name}: {formatNum(c.quantity)} pcs, Rs. {formatNum(c.revenue)}</Typography>
                </Box>
              )) : <Typography variant="body2" color="text.secondary">No customers</Typography>}
            </Paper>
          </Grid>
        </Grid>
        {insights.length > 0 && (
          <Paper elevation={3} sx={{ p: 2, mt: 4 }}>
            <Typography variant="h6" fontWeight={700} gutterBottom>Product Insights</Typography>
            <ul>
              {insights.map((i, idx) => (
                <li key={idx}><Typography variant="body2">{i}</Typography></li>
              ))}
            </ul>
          </Paper>
        )}
        {/* Activity dialog shows charts and detailed lists */}
        <Dialog fullWidth maxWidth="md" fullScreen={isSm} open={activityOpen} onClose={() => setActivityOpen(false)}>
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            Product Activity & Charts
            <IconButton onClick={() => setActivityOpen(false)} size="small">
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent dividers>
            <Grid container spacing={2}>
              <Grid item xs={12} md={7}>
                <Paper sx={{ p: 2 }} elevation={1}>
                  <Typography variant="subtitle1" gutterBottom>Revenue Trend (last 6 months)</Typography>
                  {/* simple bar chart using divs */}
                  <Box sx={{ display: 'flex', alignItems: 'end', gap: 1, height: 140, py: 1 }}>
                    {monthlyRevenue.map((m) => {
                      const max = Math.max(...monthlyRevenue.map(x => x.revenue), 1);
                      const h = Math.round((m.revenue / max) * 100);
                      return (
                        <Box key={m.key} sx={{ flex: 1, textAlign: 'center' }}>
                          <Box sx={{ height: `${h}%`, background: 'linear-gradient(180deg,#667eea,#764ba2)', borderRadius: 1, mb: 0.5 }} />
                          <Typography variant="caption">{m.label.split(' ')[0]}</Typography>
                        </Box>
                      );
                    })}
                  </Box>
                </Paper>
              </Grid>
              <Grid item xs={12} md={5}>
                <Stack spacing={2}>
                  <Paper sx={{ p: 2 }} elevation={1}>
                    <Typography variant="subtitle1">Recent Sales</Typography>
                    {relatedSales.length > 0 ? relatedSales.slice(0, 8).map(sale => (
                      <Box key={sale._id} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                        <Typography variant="body2">{String(sale.invoiceNumber || sale._id).slice(-8)}</Typography>
                        <Button size="small" onClick={() => window.location.href = `/admin/sales-report?highlight=${encodeURIComponent(sale._id)}`}>Open</Button>
                      </Box>
                    )) : <Typography variant="body2" color="text.secondary">No sales available</Typography>}
                  </Paper>
                  <Paper sx={{ p: 2 }} elevation={1}>
                    <Typography variant="subtitle1">Recent POs</Typography>
                    {relatedPOs.length > 0 ? relatedPOs.slice(0, 8).map(po => (
                      <Box key={po._id || po.poNumber} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                        <Typography variant="body2">PO {po.poNumber}</Typography>
                        <Button size="small" onClick={() => window.location.href = `/admin/purchases-report?highlight=${encodeURIComponent(po.poNumber)}`}>Open</Button>
                      </Box>
                    )) : <Typography variant="body2" color="text.secondary">No POs available</Typography>}
                  </Paper>
                  <Paper sx={{ p: 2 }} elevation={1}>
                    <Typography variant="subtitle1">Refunds</Typography>
                    {refundEvents.length > 0 ? refundEvents.slice(0,8).map((r,i) => (
                      <Box key={i} sx={{ display:'flex', justifyContent:'space-between', py:0.5 }}>
                        <Typography variant="body2">Rs. {formatNum(r.amount)}</Typography>
                        <Typography variant="caption">{new Date(r.date).toLocaleDateString()}</Typography>
                      </Box>
                    )) : <Typography variant="body2" color="text.secondary">No refunds</Typography>}
                  </Paper>
                  <Paper sx={{ p: 2 }} elevation={1}>
                    <Typography variant="subtitle1">Warranty Claims</Typography>
                    {warrantyEvents.length > 0 ? warrantyEvents.slice(0,8).map((w,i) => (
                      <Box key={i} sx={{ display:'flex', justifyContent:'space-between', py:0.5 }}>
                        <Typography variant="body2">Qty {w.qty}</Typography>
                        <Typography variant="caption">{new Date(w.date).toLocaleDateString()}</Typography>
                      </Box>
                    )) : <Typography variant="body2" color="text.secondary">No claims</Typography>}
                  </Paper>
                </Stack>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setActivityOpen(false)}>Close</Button>
          </DialogActions>
        </Dialog>
        <Box sx={{ mt: 4, display: 'flex', justifyContent: 'space-between' }}>
          <Button variant="outlined" color="primary" onClick={() => window.location.href = '/admin/products'}>Back to Product List</Button>
          <Button variant="contained" color="primary">Sell Product</Button>
        </Box>
      </Paper>
    </Box>
  );
};

export default AdminProductProfile;
