import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Box, Typography, Divider, Chip, Paper, Grid, Button, Tooltip, Alert, LinearProgress, Dialog, DialogTitle, DialogContent, DialogActions, IconButton, Stack, useTheme, useMediaQuery } from '@mui/material';
import API from '../api/api';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import PeopleIcon from '@mui/icons-material/People';
import InventoryIcon from '@mui/icons-material/Inventory';
import CloseIcon from '@mui/icons-material/Close';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';
import StarIcon from '@mui/icons-material/Star';

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
      // sum from items
      sale.items.forEach(it => {
        const matches = it.productId === productId || (!it.productId && product && product.SKU && it.SKU === product.SKU);
        if (matches) {
          map[name].quantity += Number(it.quantity) || 0;
          map[name].revenue += Number(it.subtotal) || 0;
        }
      });
      // subtract refunds
      if (Array.isArray(sale.refunds)) {
        sale.refunds.forEach(r => {
          r.items.forEach(it => {
            const matches = it.productId === productId || (!it.productId && product && product.SKU && it.SKU === product.SKU);
            if (matches) {
              const qty = Number(it.quantity) || 0;
              const amt = qty * (Number(it.perPiecePrice) || 0);
              map[name].quantity -= qty;
              map[name].revenue -= amt;
            }
          });
        });
      }
    });
    const arr = Object.entries(map).map(([name, data]) => ({ name, ...data }));
    arr.sort((a, b) => b.revenue - a.revenue);
    return arr.slice(0, 5);
  }, [relatedSales, product, productId]);

  const insights = useMemo(() => {
    const list = [];
    if (analytics) {
      const {
        thisMonthRevenue = 0,
        prevMonthRevenue = 0,
        totalSold = 0,
        totalRevenue = 0,
        totalRefundQty = 0,
        totalRefundAmount = 0,
        totalWarrantyQty = 0,
      } = analytics;

      if (prevMonthRevenue > 0) {
        if (analytics.growthPercent > 0) {
          list.push('Revenue up month-over-month (positive momentum).');
        } else if (analytics.growthPercent < 0) {
          list.push('Revenue declining compared to last month (action required).');
        } else {
          list.push('Revenue stable compared to last month.');
        }
      } else if (thisMonthRevenue > 0) {
        list.push('New revenue generated this month.');
      } else {
        list.push('No recent revenue activity.');
      }

      if (totalSold > 0) {
        const avgPrice = totalRevenue / totalSold;
        list.push(`Average selling price per unit: Rs. ${formatNum(avgPrice.toFixed(2))}.`);
      }

      if (totalRefundQty > 0) {
        const refundRate = ((totalRefundQty / (totalSold || 1)) * 100).toFixed(1);
        list.push(`Refund rate: ${refundRate}% (${formatNum(totalRefundQty)} unit(s) refunded).`);
      }

      if (totalWarrantyQty > 0) {
        const warrantyRate = ((totalWarrantyQty / (totalSold || 1)) * 100).toFixed(1);
        list.push(`Warranty claim rate: ${warrantyRate}% (${formatNum(totalWarrantyQty)} unit(s)).`);
      }

      if (thisMonthRevenue >= prevMonthRevenue * 1.5 && prevMonthRevenue > 0) {
        list.push('Strong growth: 50%+ increase over last month.');
      }

      if (thisMonthRevenue < prevMonthRevenue * 0.8 && prevMonthRevenue > 0) {
        list.push('Important: Monthly revenue dropped >20% - review promotions or stock.');
      }
    }

    if (relatedPOs.length > 3) {
      list.push('High reorder frequency detected (expected for fast-moving products).');
    }

    if (relatedPOs.length <= 1) {
      list.push('Few recent purchase orders (single/missing restock history).');
    }

    // low stock insight reused from earlier stock low calculation
    if (product) {
      const cartonQuantity = Number(product.cartonQuantity) || 0;
      const piecesPerCarton = Number(product.piecesPerCarton) || 0;
      const losePieces = Number(product.losePieces) || 0;
      const totalPieces = cartonQuantity * piecesPerCarton + losePieces;
      const reorderLevel = Number(product.reorderLevel) || 0;
      const isLow = reorderLevel > 0 ? totalPieces <= reorderLevel : (cartonQuantity + (losePieces > 0 ? 1 : 0)) <= 1;
      if (isLow) list.push('Low stock risk based on current inventory and reorder level.');
      if (!isLow && totalPieces < ((reorderLevel || piecesPerCarton * 2) || 10)) {
        list.push('Inventory is okay, but keep close watch for rapid sales events.');
      }
    }

    if (list.length === 0) {
      list.push('No specific insights available yet. Check back after more sales/log data.');
    }

    return list;
  }, [analytics, relatedPOs, product]);

  const theme = useTheme();
  const isSm = useMediaQuery(theme.breakpoints.down('sm'));

  const monthlyProgress = useMemo(() => {
    if (!analytics) return 0;
    const { thisMonthRevenue = 0, prevMonthRevenue = 0 } = analytics;
    if (prevMonthRevenue <= 0) {
      return thisMonthRevenue > 0 ? 100 : 0;
    }
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
    // first pass gross
    relatedSales.forEach(sale => {
      const created = new Date(sale.createdAt);
      const key = `${created.getFullYear()}-${created.getMonth()}`;
      sale.items.forEach(it => {
        const matches = it.productId === productId || (!it.productId && product && product.SKU && it.SKU === product.SKU);
        if (matches && map[key]) {
          map[key].revenue += Number(it.subtotal) || 0;
        }
      });
    });
    // second pass refunds
    relatedSales.forEach(sale => {
      if (Array.isArray(sale.refunds)) {
        sale.refunds.forEach(r => {
          const refDate = new Date(r.createdAt);
          const key = `${refDate.getFullYear()}-${refDate.getMonth()}`;
          r.items.forEach(it => {
            const matches = it.productId === productId || (!it.productId && product && product.SKU && it.SKU === product.SKU);
            if (matches && map[key]) {
              const amt = (Number(it.quantity) || 0) * (Number(it.perPiecePrice) || 0);
              map[key].revenue -= amt;
            }
          });
        });
      }
    });
    return Object.values(map);
  }, [relatedSales, product, productId]);

  // Build monthly PO value series (last 6 months)
  const monthlyPOValue = useMemo(() => {
    if (!relatedPOs.length) return [];
    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      months.push({ key, label: d.toLocaleString('default', { month: 'short', year: 'numeric' }), value: 0 });
    }
    const map = Object.fromEntries(months.map(m => [m.key, m]));
    relatedPOs.forEach(po => {
      const created = new Date(po.poDate);
      const key = `${created.getFullYear()}-${created.getMonth()}`;
      if (map[key]) {
        const poValue = po.items.reduce((sum, it) => {
          if (it.itemCode === product.SKU) {
            return sum + (Number(it.quantity) || 0) * (Number(it.unitCost) || 0);
          }
          return sum;
        }, 0);
        map[key].value += poValue;
      }
    });
    return Object.values(map);
  }, [relatedPOs, product]);

  // Friendly growth label (handles zero previous month)
  const growthLabel = useMemo(() => {
    if (!analytics) return '-';
    const { thisMonthRevenue = 0, prevMonthRevenue = 0 } = analytics;
    if (prevMonthRevenue > 0) {
      const percent = analytics.growthPercent;
      return percent > 0 ? `+${percent}%` : `${percent}%`;
    } else if (thisMonthRevenue > 0) {
      return `New: Rs. ${formatNum(thisMonthRevenue)}`;
    } else {
      return 'No change';
    }
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
        let grossTotalSold = 0;
        let grossTotalRevenue = 0;
        let grossThisMonthRevenue = 0;
        let grossPrevMonthRevenue = 0;
        let totalRefundQty = 0;
        let totalRefundAmount = 0;
        let totalWarrantyQty = 0;
        const now = new Date();
        const startThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0);

        // First pass: gross revenue
        salesForProduct.forEach(sale => {
          const created = new Date(sale.createdAt);
          sale.items.forEach(it => {
            if (!(it.productId === productId || (sku && it.SKU === sku))) return;
            const qty = Number(it.quantity) || 0;
            const sub = Number(it.subtotal) || 0;
            grossTotalSold += qty;
            grossTotalRevenue += sub;
            if (created >= startThisMonth) {
              grossThisMonthRevenue += sub;
            } else if (created >= startPrevMonth && created <= endPrevMonth) {
              grossPrevMonthRevenue += sub;
            }
          });

          // handle warranty claims (no revenue impact)
          if (Array.isArray(sale.warrantyClaims)) {
            sale.warrantyClaims.forEach(w => {
              w.items.forEach(it => {
                if (it.productId === productId || (sku && it.SKU === sku)) {
                  totalWarrantyQty += Number(it.quantity) || 0;
                }
              });
            });
          }
        });

        // Second pass: refunds
        salesForProduct.forEach(sale => {
          if (Array.isArray(sale.refunds)) {
            sale.refunds.forEach(r => {
              const refDate = new Date(r.createdAt);
              r.items.forEach(it => {
                if (it.productId === productId || (sku && it.SKU === sku)) {
                  const qty = Number(it.quantity) || 0;
                  const amt = qty * (Number(it.perPiecePrice) || 0);
                  totalRefundQty += qty;
                  totalRefundAmount += amt;
                  // subtract from monthly gross based on refund date
                  if (refDate >= startThisMonth) {
                    grossThisMonthRevenue -= amt;
                  } else if (refDate >= startPrevMonth && refDate <= endPrevMonth) {
                    grossPrevMonthRevenue -= amt;
                  }
                }
              });
            });
          }
        });

        const totalRevenue = grossTotalRevenue - totalRefundAmount;
        const thisMonthRevenue = grossThisMonthRevenue;
        const prevMonthRevenue = grossPrevMonthRevenue;
        const growthPercent = prevMonthRevenue > 0 ? Number((((thisMonthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100).toFixed(2)) : 0;
        setAnalytics({ totalSold: grossTotalSold, totalRevenue, growthPercent, thisMonthRevenue, prevMonthRevenue, totalRefundQty, totalRefundAmount, totalWarrantyQty });

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
              {product.SKU && (
                <Box sx={{ mt: 1, mb: 2, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1 }}>
                  <img
                    src={`https://barcode.tec-it.com/barcode.ashx?data=${encodeURIComponent(String(product.SKU).trim())}&code=Code128&translate-esc=on&unit=Fit&width=220&height=60&dpi=96`}
                    alt={`Barcode ${product.SKU}`}
                    style={{ maxWidth: '220px', width: '100%', height: 'auto', background: '#fff', border: '1px solid #e0e0e0', borderRadius: 4 }}
                  />
                  <Typography variant="caption" color="text.secondary">Scan this barcode in POS sale entry via SKU field</Typography>
                </Box>
              )}
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
                <img src={product.image} alt={product.name} style={{ maxWidth: '100%', maxHeight: 320, borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.12)', width: 'auto', height: 'auto' }} />
              )}
            </Box>
          </Grid>
        </Grid>
        {/* additional dashboard cards */}
        <Grid container spacing={{ xs: 2, md: 4 }} sx={{ pt: 4 }}>
          <Grid item xs={12} md={4}>
            <Paper elevation={3} sx={{ p: 2, background: 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)', borderRadius: 3 }}>
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
                  <Typography variant="body2" sx={{ display:'flex', alignItems:'center', gap:1, color: analytics.growthPercent > 0 ? 'success.main' : analytics.growthPercent < 0 ? 'error.main' : 'text.secondary' }}>
                    {growthLabel.startsWith('New:') ? <StarIcon fontSize="small" /> : analytics.growthPercent > 0 ? <TrendingUpIcon fontSize="small" /> : analytics.growthPercent < 0 ? <TrendingDownIcon fontSize="small" /> : <TrendingFlatIcon fontSize="small" />}
                    Growth: <b>{growthLabel}</b>
                  </Typography>
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="caption">This month vs last</Typography>
                    <LinearProgress variant="determinate" value={monthlyProgress} color={monthlyProgress >= 100 ? 'success' : monthlyProgress >= 50 ? 'warning' : 'error'} sx={{ height: 8, borderRadius: 4, mt: 1 }} />
                    <Typography variant="caption">{monthlyProgress}%</Typography>
                  </Box>
                </>
              ) : (
                <Typography variant="body2" color="text.secondary">No revenue data</Typography>
              )}
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper elevation={3} sx={{ p: 2, cursor: 'pointer', transition: 'box-shadow 0.3s', '&:hover': { boxShadow: 6 }, background: 'linear-gradient(135deg, #f3e5f5 0%, #ce93d8 100%)', borderRadius: 3 }} onClick={() => setActivityOpen(true)}>
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
            <Paper elevation={3} sx={{ p: 2, background: 'linear-gradient(135deg, #e8f5e8 0%, #a5d6a7 100%)', borderRadius: 3 }}>
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
          <Paper elevation={3} sx={{ p: 2, mt: 4, background: 'linear-gradient(135deg, #fff3e0 0%, #ffcc02 100%)', borderRadius: 3 }}>
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
            <Box>
              <Typography variant="h6">Product Activity & Charts</Typography>
              <Typography variant="body2" color="text.secondary">{product?.name}</Typography>
            </Box>
            <IconButton onClick={() => setActivityOpen(false)} size="small">
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent dividers>
            <Grid container spacing={2}>
              <Grid item xs={12} md={7}>
                <Paper sx={{ p: 2, background: 'linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%)', borderRadius: 3 }} elevation={1}>
                  <Typography variant="subtitle1" gutterBottom>PO vs Sales Trend (last 6 months)</Typography>
                  {/* Legend */}
                  <Box sx={{ display: 'flex', gap: 2, mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Box sx={{ width: 12, height: 12, backgroundColor: '#667eea' }} />
                      <Typography variant="caption">Sales Revenue</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Box sx={{ width: 12, height: 12, backgroundColor: '#ff9800' }} />
                      <Typography variant="caption">PO Value</Typography>
                    </Box>
                  </Box>
                  {/* SVG grouped bar chart */}
                  <Box sx={{ position: 'relative', height: 180 }}>
                    <svg width="100%" height="160" viewBox="0 0 400 160">
                      {(() => {
                        const allValues = [...monthlyRevenue.map(m => m.revenue), ...monthlyPOValue.map(m => m.value)];
                        const maxVal = Math.max(...allValues, 1);
                        const barWidth = 30;
                        const groupWidth = 60;
                        const startX = 20;
                        return monthlyRevenue.map((m, i) => {
                          const x = startX + i * groupWidth;
                          const salesHeight = (m.revenue / maxVal) * 120;
                          const poHeight = (monthlyPOValue[i]?.value / maxVal) * 120;
                          return (
                            <g key={m.key}>
                              <rect x={x} y={140 - salesHeight} width={barWidth} height={salesHeight} fill="#667eea" title={`Sales: Rs. ${formatNum(m.revenue)}`} />
                              <rect x={x + barWidth} y={140 - poHeight} width={barWidth} height={poHeight} fill="#ff9800" title={`PO: Rs. ${formatNum(monthlyPOValue[i]?.value || 0)}`} />
                              <text x={x + barWidth} y={155} textAnchor="middle" fontSize="10">{m.label.split(' ')[0]}</text>
                            </g>
                          );
                        });
                      })()}
                      {/* Y-axis max */}
                      <text x="5" y="10" fontSize="10" fill="text.secondary">Rs. {formatNum(Math.max(...[...monthlyRevenue.map(m => m.revenue), ...monthlyPOValue.map(m => m.value)], 1))}</text>
                    </svg>
                  </Box>
                </Paper>
              </Grid>
              <Grid item xs={12} md={5}>
                <Stack spacing={2}>
                  <Paper sx={{ p: 2, background: 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)', borderRadius: 3 }} elevation={1}>
                    <Typography variant="subtitle1">Recent Sales</Typography>
                    {relatedSales.length > 0 ? relatedSales.slice(0, 8).map(sale => (
                      <Box key={sale._id} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                        <Typography variant="body2">{String(sale.invoiceNumber || sale._id).slice(-8)}</Typography>
                        <Button size="small" onClick={() => window.location.href = `/admin/sales-report?highlight=${encodeURIComponent(sale._id)}`}>Open</Button>
                      </Box>
                    )) : <Typography variant="body2" color="text.secondary">No sales available</Typography>}
                  </Paper>
                  <Paper sx={{ p: 2, background: 'linear-gradient(135deg, #f3e5f5 0%, #ce93d8 100%)', borderRadius: 3 }} elevation={1}>
                    <Typography variant="subtitle1">Recent POs</Typography>
                    {relatedPOs.length > 0 ? relatedPOs.slice(0, 8).map(po => (
                      <Box key={po._id || po.poNumber} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                        <Typography variant="body2">PO {po.poNumber}</Typography>
                        <Button size="small" onClick={() => window.location.href = `/admin/purchases-report?highlight=${encodeURIComponent(po.poNumber)}`}>Open</Button>
                      </Box>
                    )) : <Typography variant="body2" color="text.secondary">No POs available</Typography>}
                  </Paper>
                  <Paper sx={{ p: 2, background: 'linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%)', borderRadius: 3 }} elevation={1}>
                    <Typography variant="subtitle1">Refunds</Typography>
                    {refundEvents.length > 0 ? refundEvents.slice(0,8).map((r,i) => (
                      <Box key={i} sx={{ display:'flex', justifyContent:'space-between', py:0.5 }}>
                        <Typography variant="body2">Rs. {formatNum(r.amount)}</Typography>
                        <Typography variant="caption">{new Date(r.date).toLocaleDateString()}</Typography>
                      </Box>
                    )) : <Typography variant="body2" color="text.secondary">No refunds</Typography>}
                  </Paper>
                  <Paper sx={{ p: 2, background: 'linear-gradient(135deg, #fff3e0 0%, #ffcc02 100%)', borderRadius: 3 }} elevation={1}>
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
