import React, { useEffect, useState } from 'react';
import { Box, Paper, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Button, TextField, Grid, Chip, Dialog, DialogTitle, DialogContent, DialogActions, IconButton, Alert, useTheme, useMediaQuery, InputAdornment } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import PrintIcon from '@mui/icons-material/Print';
import CloseIcon from '@mui/icons-material/Close';
import API from '../api/api';
import { useDarkMode } from '../context/DarkModeContext';

const SellerRefunds = () => {
	const { darkMode } = useDarkMode();
	const theme = useTheme();
	const isSm = useMediaQuery(theme.breakpoints.down('sm'));
	const [refundSales, setRefundSales] = useState([]);
	const [searchTerm, setSearchTerm] = useState('');
	const [startDate, setStartDate] = useState('');
	const [endDate, setEndDate] = useState('');
	const [filteredRefunds, setFilteredRefunds] = useState([]);
	const [viewDialogOpen, setViewDialogOpen] = useState(false);
	const [selectedRefund, setSelectedRefund] = useState(null);

	useEffect(() => {
		const fetch = async () => {
			try {
				const token = localStorage.getItem('token');
				const payload = JSON.parse(atob(token.split('.')[1]));
				const res = await API.get(`/sales?sellerId=${payload.id}&limit=500`, { headers: { Authorization: `Bearer ${token}` } });
				const list = Array.isArray(res.data) ? res.data : [];
				const filtered = list.filter(s => Array.isArray(s.refunds) && s.refunds.length > 0);
				console.log('Seller Refund Sales:', filtered);
				setRefundSales(filtered);
			} catch (e) {
				console.error('Error fetching seller refunds:', e);
				setRefundSales([]);
			}
		};
		fetch();
		const onChanged = () => fetch();
		window.addEventListener('sales:changed', onChanged);
		return () => window.removeEventListener('sales:changed', onChanged);
	}, []);

	// Filter refunds based on search and date range
	useEffect(() => {
		let filtered = refundSales;

		// Apply search filter
		if (searchTerm.trim()) {
			const term = searchTerm.toLowerCase();
			filtered = filtered.filter(s => {
				const invoiceMatch = String(s.invoiceNumber || s._id).toLowerCase().includes(term);
				const customerMatch = (s.customerName || '').toLowerCase().includes(term);
				const productsMatch = (s.refunds || []).some(r =>
					r.items.some(i => (i.productName || '').toLowerCase().includes(term))
				);
				return invoiceMatch || customerMatch || productsMatch;
			});
		}

		// Apply date filter
		if (startDate) {
			const start = new Date(startDate);
			start.setHours(0, 0, 0, 0);
			filtered = filtered.filter(s => new Date(s.createdAt) >= start);
		}
		if (endDate) {
			const end = new Date(endDate);
			end.setHours(23, 59, 59, 999);
			filtered = filtered.filter(s => new Date(s.createdAt) <= end);
		}

		setFilteredRefunds(filtered);
	}, [searchTerm, startDate, endDate, refundSales]);

	// Calculate total refund price for a sale (use stored totalRefundAmount when present)
	const calculateTotalRefund = (sale) => {
		return (sale.refunds || []).reduce((total, refund) => {
			if (refund && (Number(refund.totalRefundAmount) || 0) > 0) return total + Number(refund.totalRefundAmount || 0);
			return total + (refund.items || []).reduce((itemTotal, item) => {
				const price = Number(item.perPiecePrice || item.price || 0);
				const qty = Number(item.quantity || 0);
				return itemTotal + (price * qty);
			}, 0);
		}, 0);
	};

	// Calculate original invoice total
	const calculateOriginalTotal = (sale) => {
		return (sale.items || []).reduce((total, item) => {
			return total + (item.perPiecePrice * item.quantity - (item.discount || 0));
		}, 0);
	};

	// Handle view refund dialog
	const handleViewRefund = (refund) => {
		setSelectedRefund(refund);
		setViewDialogOpen(true);
	};

	// Print refund invoice
	const handlePrintRefund = (sale) => {
		const totalRefund = calculateTotalRefund(sale);
		const originalTotal = calculateOriginalTotal(sale);

		const printContent = `
      <html>
        <head>
          <title>Refund Invoice #${sale._id?.substr(-6) || ''}</title>
          <style>
            /* Base styles for all media */
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            
            html {
              display: flex;
              justify-content: center;
              background: #f0f0f0;
            }
            
            body {
              font-family: 'Courier New', monospace;
              margin: 0;
              padding: 8px;
              color: #333;
              background: white;
            }
            
            .header {
              text-align: center;
              margin-bottom: 12px;
              border-bottom: 2px solid #000;
              padding-bottom: 8px;
            }
            
            .header h1 {
              margin: 0 0 4px 0;
              font-size: 14px;
              font-weight: bold;
            }
            
            .header p {
              margin: 2px 0;
              font-size: 9px;
            }
            
            .invoice-info {
              margin: 8px 0;
              font-size: 9px;
            }
            
            .invoice-info div {
              margin: 2px 0;
            }
            
            .invoice-info strong {
              font-weight: bold;
            }
            
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 8px 0;
              font-size: 9px;
            }
            
            th {
              background: #f5f5f5;
              border-top: 1px solid #000;
              border-bottom: 1px solid #000;
              padding: 4px 2px;
              text-align: left;
              font-weight: bold;
              font-size: 8px;
            }
            
            td {
              padding: 4px 2px;
              border-bottom: 1px solid #eee;
              font-size: 8px;
            }
            
            tr:last-child td {
              border-bottom: 1px solid #000;
            }
            
            .text-right {
              text-align: right !important;
            }
            
            .total-row {
              border-top: 2px solid #000;
              border-bottom: 2px solid #000;
              font-weight: bold;
              background: #f9f9f9;
            }
            
            .total-amount {
              font-weight: bold;
              font-size: 10px;
            }
            
            .payment-info {
              margin-top: 8px;
            }
            
            .payment-info div {
              margin: 2px 0;
              font-size: 9px;
              display: flex;
              justify-content: space-between;
            }
            
            .footer {
              text-align: center;
              margin-top: 12px;
              font-size: 10px;
              font-weight: bold;
            }
            
            /* PRINT STYLES - 80mm Thermal Printer */
            @media print {
              @page {
                size: 80mm auto;
                margin: 0mm;
              }
              
              html {
                background: white;
                display: block;
              }
              
              body {
                width: 80mm;
                margin: 0;
                padding: 3px 2px;
                font-size: 10px;
                background: white;
              }
              
              .header h1 {
                font-size: 12px;
              }
              
              .header p {
                font-size: 8px;
              }
              
              .invoice-info {
                font-size: 8px;
              }
              
              table {
                font-size: 8px;
              }
              
              th, td {
                padding: 3px 1px;
                font-size: 7px;
              }
              
              .payment-info div {
                font-size: 8px;
              }
              
              .footer {
                font-size: 8px;
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>New Adil Electric Concern</h1>
            <p>4-B, Jamiat Center, Shah Alam Market</p>
            <p>Lahore, Pakistan</p>
            <p>Phone: 0333-4263733 | Email: info@adilelectric.com</p>
            <p>Website: e-roshni.com</p>
          </div>

          <div class="invoice-info">
            <div><strong>Refund Invoice #</strong>${sale._id?.substr(-6) || ''}</div>
            <div><strong>Date:</strong> ${new Date(sale.createdAt || Date.now()).toLocaleDateString()} <strong>Time:</strong> ${new Date(sale.createdAt || Date.now()).toLocaleTimeString()}</div>
            <div><strong>Customer:</strong> ${sale.customerName || '-'} | <strong>Contact:</strong> ${sale.customerContact || '-'}</div>
          </div>

          <table>
            <thead>
              <tr>
                <th>S/N</th>
                <th>Item</th>
                <th class="text-right">Qty</th>
                <th class="text-right">Rate</th>
                <th class="text-right"> Amount</th>
                <th class="text-right">Reason</th>
              </tr>
            </thead>
            <tbody>
              ${(sale.refunds || []).map((refund, refIdx) =>
			refund.items.map((item, itemIdx) => {
				const itemPrice = Number(item.perPiecePrice || item.price || 0);
				const itemTotal = itemPrice * (Number(item.quantity || 0));
				return `
                    <tr>
                      <td>${refIdx * 10 + itemIdx + 1}</td>
                      <td>${item.productName || '-'}</td>
                      <td class="text-right">${item.quantity || 0}</td>
                      <td class="text-right">${Number(itemPrice || 0).toLocaleString()}</td>
                      <td class="text-right"> ${Number(itemTotal).toLocaleString()}</td>
                      <td class="text-right"style="font-size: 7px;">${refund.reason || '-'}</td>
                    </tr>
                  `;
			}).join('')
		).join('')}
              
              <tr class="total-row">
                <td colspan="5">Original Total</td>
                <td class="text-right total-amount">Rs.${Number(originalTotal).toLocaleString()}</td>
                <td></td>
              </tr>
              <tr class="total-row">
                <td colspan="5">Total Refund</td>
                <td class="text-right total-amount" style="color: #d32f2f;">Rs.${Number(totalRefund).toLocaleString()}</td>
                <td></td>
              </tr>
              <tr class="total-row">
                <td colspan="5">Final Total</td>
                <td class="text-right total-amount">Rs.${Number(originalTotal - totalRefund).toLocaleString()}</td>
                <td></td>
              </tr>
            </tbody>
          </table>

          <div class="footer">Thank you for your business!</div>
        </body>
      </html>
    `;

		const w = window.open('', '_blank');
		if (!w || !w.document) {
			alert('Please allow popups for printing');
			return;
		}
		w.document.write(printContent);
		w.document.close();
		setTimeout(() => w.print(), 250);
	};

	// Print filtered list
	const handlePrintList = () => {
		if (filteredRefunds.length === 0) {
			alert('No refunds to print');
			return;
		}

		const dateRange = startDate || endDate
			? `From: ${startDate || 'All time'} To: ${endDate || 'Now'}`
			: 'All Dates';

		const refundsHTML = filteredRefunds.map((s, idx) => {
			const refundedItems = (s.refunds || []).map(r => r.items.map(i => i.productName + ' x' + i.quantity).join(', ')).join(' | ');
			return `
				<tr>
					<td style="padding:10px;border-bottom:1px solid #ddd;text-align:center;">${idx + 1}</td>
					<td style="padding:10px;border-bottom:1px solid #ddd;font-weight:bold;">${s.invoiceNumber || s._id?.slice(-6)}</td>
					<td style="padding:10px;border-bottom:1px solid #ddd;">${new Date(s.createdAt).toLocaleDateString()}</td>
					<td style="padding:10px;border-bottom:1px solid #ddd;">${s.customerName || '-'}</td>
					<td style="padding:10px;border-bottom:1px solid #ddd;font-size:11px;">${refundedItems || '-'}</td>
					<td style="padding:10px;border-bottom:1px solid #ddd;text-align:right;font-weight:bold;color:#d32f2f;">Rs. ${calculateTotalRefund(s).toLocaleString()}</td>
				</tr>	
			`;
		}).join('');

		const printWindow = window.open('', '_blank');
		if (!printWindow || !printWindow.document) {
			alert('Please allow popups for printing');
			return;
		}

		printWindow.document.write(`
			<html>
				<head>
					<title>Refunds Report</title>
					<style>
						* { margin: 0; padding: 0; }
						body { font-family: 'Arial', sans-serif; background: #fff; color: #333; padding: 20px; line-height: 1.6; }
						.header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #d32f2f; padding-bottom: 15px; }
						.header h1 { color: #d32f2f; font-size: 24px; margin-bottom: 10px; }
						.header p { font-size: 13px; margin: 4px 0; }
						.info-section { background: #f9f9f9; padding: 12px 15px; margin: 15px 0; border-left: 4px solid #d32f2f; }
						.info-section p { font-size: 13px; margin: 4px 0; }
						h2 { color: #d32f2f; font-size: 16px; margin-top: 20px; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 2px solid #ddd; }
						table { width: 100%; border-collapse: collapse; margin: 10px 0; }
						th { background-color: #d32f2f; color: white; padding: 12px; text-align: left; font-weight: bold; font-size: 13px; }
						td { padding: 10px; font-size: 12px; }
						tr:nth-child(even) { background-color: #f9f9f9; }
						.total-row { background-color: #ffe0e0; font-weight: bold; }
						.total-row td { padding: 12px; border-top: 2px solid #d32f2f; }
						@media print { body { padding: 0; } }
					</style>
				</head>
				<body>
					<div class="header">
						<h1>Refunds Report</h1>
						<p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
					</div>

					<div class="info-section">
						<p><strong>Date Range:</strong> ${dateRange}</p>
						<p><strong>Total Refunds:</strong> ${filteredRefunds.length}</p>
					</div>

					<h2>Refund Details</h2>
					<table>
						<thead>
							<tr>
								<th style="width:5%">S/N</th>
								<th style="width:10%">Invoice #</th>
								<th style="width:12%">Date</th>
								<th style="width:18%">Customer</th>
								<th style="width:40%">Refunded Items</th>
								<th style="width:15%;text-align:right;">Amount</th>
							</tr>
						</thead>
						<tbody>
							${refundsHTML}
							<tr class="total-row">
								<td colspan="5" style="text-align:right;padding:12px;">TOTAL REFUNDS</td>
								<td style="text-align:right;padding:12px;">Rs. ${filteredRefunds.reduce((sum, s) => sum + calculateTotalRefund(s), 0).toLocaleString()}</td>
							</tr>
						</tbody>
					</table>

					<div style="margin-top:30px;text-align:center;font-size:11px;color:#999;">
						<p>This is an automated report. Please verify with sales records.</p>
					</div>
				</body>
			</html>
		`);
		printWindow.document.close();
		setTimeout(() => printWindow.print(), 250);
	};

	const cellSx = {
		maxWidth: { xs: 80, sm: 120, md: 160, lg: 240 },
		overflow: 'hidden',
		textOverflow: 'ellipsis',
		whiteSpace: 'nowrap',
		fontSize: { xs: '0.75rem', sm: '0.875rem' },
		padding: { xs: '6px 8px', sm: '12px 16px' }
	};

	return (
		<>
			<Box sx={{
				maxWidth: { xs: '100%', lg: 1800 },
				minWidth: 0,
				boxSizing: 'border-box',
				overflowX: 'hidden',
				px: { xs: 1, sm: 1, md: 2 },
				mt: { xs: 1, sm: 2, md: 3 },
				pb: 1,
				background: `linear-gradient(135deg, ${darkMode ? '#1a1a2e' : '#f8f9fa'} 0%, ${darkMode ? '#16213e' : '#e9ecef'} 100%)`,
				minHeight: '100vh',
				mx: 'auto',
				position: 'relative',
				'&::before': {
					content: '""',
					position: 'absolute',
					top: 0,
					left: 0,
					right: 0,
					height: '4px',
					background: 'linear-gradient(90deg, #1976d2 0%, #42a5f5 50%, #1976d2 100%)',
					zIndex: 1
				}
			}}>
				<Paper elevation={6} sx={{
					p: { xs: 1, sm: 2, md: 4 },
					borderRadius: { xs: 3, sm: 2, md: 6 },
					background: `linear-gradient(135deg, ${darkMode ? '#2a2a2a' : '#ffffff'} 0%, ${darkMode ? '#1e1e1e' : '#f8f9fa'} 100%)`,
					boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15), 0 10px 20px rgba(0, 0, 0, 0.1)',
					maxWidth: { xs: 'calc(90vw - 16px)', sm: '100%', md: 'calc(106vw - 300px)' },
					width: '100%',
					overflowX: 'hidden',
					mx: 'auto',
					minWidth: 0,
					position: 'relative',
					border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'}`,
					'&::before': {
						content: '""',
						position: 'absolute',
						top: 0,
						left: 0,
						right: 0,
						height: '3px',
						background: 'linear-gradient(90deg, #1976d2 0%, #42a5f5 50%, #1976d2 100%)',
						borderRadius: '3px 3px 0 0'
					}
				}}>

					{/* Header Section - Responsive */}
					<Box sx={{
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'space-between',
						mb: { xs: 1.5, sm: 2 },
						gap: { xs: 1, sm: 2 },
						flexWrap: 'wrap',
						flexDirection: { xs: 'column', sm: 'row' },
						textAlign: { xs: 'center', sm: 'left' },
						p: { xs: 2, sm: 3 },
						borderRadius: { xs: 2, sm: 3 },
						background: `linear-gradient(135deg, ${darkMode ? 'rgba(25, 118, 210, 0.1)' : 'rgba(255, 255, 255, 0.9)'} 0%, ${darkMode ? 'rgba(66, 165, 245, 0.05)' : 'rgba(248, 249, 250, 0.8)'} 100%)`,
						backdropFilter: 'blur(10px)',
						border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'}`,
						boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
						position: 'relative',
						overflow: 'hidden'
					}}>
						<img src="/Inventorylogo.png" alt="Inventory Logo" style={{ height: 40, marginRight: 12 }} />						<Typography
							variant={isSm ? 'h6' : 'h4'}
							color="primary"
							sx={{
								fontWeight: 700,
								fontSize: { xs: '1.1rem', sm: '1.5rem', md: '2rem' }
							}}
						>
							Seller - Refund Invoices
						</Typography>
					</Box>

					{/* Search Field */}
					<TextField
						placeholder="Search Invoice #, Customer, or Product..."
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
						fullWidth
						sx={{
							mb: 2,
							'& .MuiInputBase-root': {
								fontSize: { xs: '0.875rem', sm: '1rem' }
							}
						}}
						InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }}
					/>

					{/* Filters Section - Responsive Grid */}
					<Box sx={{
						display: 'grid',
						gridTemplateColumns: {
							xs: '1fr',
							sm: 'repeat(2, 1fr)',
							md: 'repeat(3, auto)'
						},
						gap: { xs: 1.5, sm: 2 },
						mb: 2,
						alignItems: 'center'
					}}>
						<TextField
							label="Start Date"
							type="date"
							value={startDate}
							onChange={(e) => setStartDate(e.target.value)}
							InputLabelProps={{ shrink: true }}
							size={isSm ? "small" : "medium"}
							sx={{
								width: '100%',
								'& .MuiInputBase-root': {
									fontSize: { xs: '0.875rem', sm: '1rem' }
								}
							}}
						/>

						<TextField
							label="End Date"
							type="date"
							value={endDate}
							onChange={(e) => setEndDate(e.target.value)}
							InputLabelProps={{ shrink: true }}
							size={isSm ? "small" : "medium"}
							sx={{
								width: '100%',
								'& .MuiInputBase-root': {
									fontSize: { xs: '0.875rem', sm: '1rem' }
								}
							}}
						/>

						<Button
							variant="contained"
							startIcon={<PrintIcon />}
							onClick={handlePrintList}
							sx={{
								gridColumn: { xs: '1', sm: 'span 2', md: 'auto' },
								width: { xs: '100%', sm: '200px' },
								py: { xs: 1, sm: 1.5 },
								background: darkMode ? 'linear-gradient(45deg, #90caf9, #64b5f6)' : 'linear-gradient(45deg, #1976d2, #42a5f5)',
								color: '#fff',
								'&:hover': {
									background: darkMode ? 'linear-gradient(45deg, #64b5f6, #42a5f5)' : 'linear-gradient(45deg, #1565c0, #2196f3)',
									transform: 'translateY(-1px)'
								},
								transition: 'all 0.3s ease'
							}}
						>
							Print List
						</Button>
					</Box>

					<Typography variant="caption" color="textSecondary" sx={{ mb: 2 }}>
						Results: {filteredRefunds.length} refund(s) found
					</Typography>

					{/* Table Container with Horizontal Scroll */}
					<TableContainer
						component={Paper}
						sx={{
							mb: 2,
							width: '100%',
							maxWidth: {
								xs: 'calc(80vw - 10px)',
								sm: '100%',
								md: 'calc(103vw - 300px)'
							},
							minWidth: 0,
							overflowX: 'auto',
							overflowY: 'hidden',
							WebkitOverflowScrolling: 'touch',
							position: 'relative',
							borderRadius: 2,
							boxSizing: 'border-box',
							backgroundColor: darkMode ? '#2a2a2a' : '#fff',
							border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'}`,
							'&::-webkit-scrollbar': {
								height: { xs: '4px', sm: '6px' },
							},
							'&::-webkit-scrollbar-track': {
								backgroundColor: darkMode ? '#1e1e1e' : '#f1f1f1',
								borderRadius: '3px',
							},
							'&::-webkit-scrollbar-thumb': {
								backgroundColor: darkMode ? '#666' : '#888',
								borderRadius: '3px',
							},
						}}
					>
						<Table
							stickyHeader
							sx={{
								minWidth: { xs: 800, sm: '100%', md: '100%' },
								width: '100%',
								tableLayout: { xs: 'auto', sm: 'auto', md: 'auto' },
								whiteSpace: { xs: 'nowrap', sm: 'nowrap', md: 'nowrap' },
								minHeight: 1,
							}}
						>
							<TableHead>
								<TableRow>
									<TableCell sx={{
										fontWeight: 'bold',
										fontSize: { xs: '0.75rem', sm: '0.875rem' },
										padding: { xs: '8px 6px', sm: '12px 16px' },
										position: 'sticky',
										left: 0,
										backgroundColor: darkMode ? '#1e1e1e' : '#fff',
										zIndex: 3,
										boxShadow: '2px 0 5px -2px rgba(0,0,0,0.1)',
										minWidth: { xs: 80, sm: 100 }
									}}>Invoice</TableCell>
									<TableCell sx={{ fontWeight: 'bold', fontSize: { xs: '0.75rem', sm: '0.875rem' }, padding: { xs: '8px 6px', sm: '12px 16px' } }}>Date</TableCell>
									<TableCell sx={{ fontWeight: 'bold', fontSize: { xs: '0.75rem', sm: '0.875rem' }, padding: { xs: '8px 6px', sm: '12px 16px' } }}>Customer Name</TableCell>
									<TableCell sx={{ fontWeight: 'bold', fontSize: { xs: '0.75rem', sm: '0.875rem' }, padding: { xs: '8px 6px', sm: '12px 16px' } }}>Refunded Items</TableCell>
									<TableCell sx={{ fontWeight: 'bold', fontSize: { xs: '0.75rem', sm: '0.875rem' }, padding: { xs: '8px 6px', sm: '12px 16px' } }}>Total Refund</TableCell>
									<TableCell sx={{ fontWeight: 'bold', fontSize: { xs: '0.75rem', sm: '0.875rem' }, padding: { xs: '8px 6px', sm: '12px 16px' } }}>Actions</TableCell>
								</TableRow>
							</TableHead>
							<TableBody>
								{filteredRefunds.map(s => (
									<TableRow key={s._id}>
										<TableCell sx={{
											...cellSx,
											position: 'sticky',
											left: 0,
											backgroundColor: darkMode ? '#1e1e1e' : '#fff',
											zIndex: 1,
											boxShadow: '2px 0 5px -2px rgba(0,0,0,0.1)',
											minWidth: { xs: 80, sm: 100 }
										}}>{s.invoiceNumber || s._id?.slice(-6)}</TableCell>
										<TableCell sx={cellSx}>{new Date(s.createdAt).toLocaleString()}</TableCell>
										<TableCell sx={cellSx}>{s.customerName || '-'}</TableCell>
										<TableCell sx={cellSx}>{(s.refunds || []).map(r => r.items.map(i => `${i.productName} x${i.quantity}`).join(', ')).join(' | ')}</TableCell>
										<TableCell sx={{ ...cellSx, fontWeight: 'bold', color: '#d32f2f' }}>Rs. {calculateTotalRefund(s).toFixed(2)}</TableCell>
										<TableCell>
											<Box sx={{ display: 'flex', gap: 1 }}>
												<Button
													size="small"
													variant="outlined"
													onClick={() => handleViewRefund(s)}
												>
													View
												</Button>
												<IconButton
													size="small"
													color="primary"
													onClick={() => handlePrintRefund(s)}
													title="Print Refund Invoice"
												>
													<PrintIcon fontSize="small" />
												</IconButton>
											</Box>
										</TableCell>
									</TableRow>
								))}
								{filteredRefunds.length === 0 && (
									<TableRow>
										<TableCell colSpan={6} align="center" sx={{ py: 3 }}>
											<Typography color="textSecondary">No refund invoices found.</Typography>
										</TableCell>
									</TableRow>
								)}
							</TableBody>
						</Table>
					</TableContainer>
				</Paper>
			</Box>

			{/* View Refund Dialog */}
			<Dialog
				open={viewDialogOpen}
				onClose={() => setViewDialogOpen(false)}
				maxWidth="sm"
				fullWidth
				PaperProps={{
					sx: {
						background: darkMode ? '#1e1e1e' : '#fff',
						border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'}`
					}
				}}
			>
				<DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: darkMode ? '#fff' : 'inherit' }}>
					<Box>
						<Chip label="REFUND INVOICE" color="error" sx={{ mr: 1 }} />
						<Typography variant="h6" component="span" sx={{ color: darkMode ? '#fff' : 'inherit' }}>Invoice #{selectedRefund?.invoiceNumber || selectedRefund?._id?.slice(-6)}</Typography>
					</Box>
					<IconButton onClick={() => setViewDialogOpen(false)} size="small" sx={{ color: darkMode ? '#fff' : 'inherit' }}>
						<CloseIcon />
					</IconButton>
				</DialogTitle>
				<DialogContent dividers sx={{ bgcolor: darkMode ? '#1e1e1e' : '#fff', color: darkMode ? '#fff' : 'inherit' }}>
					{selectedRefund && (
						<Box>
							<Box sx={{ mb: 2 }}>
								<Typography sx={{ color: darkMode ? '#fff' : 'inherit' }}><strong>Customer Name:</strong> {selectedRefund.customerName || '-'}</Typography>
								<Typography sx={{ color: darkMode ? '#fff' : 'inherit' }}><strong>Contact:</strong> {selectedRefund.customerContact || '-'}</Typography>
								<Typography sx={{ color: darkMode ? '#fff' : 'inherit' }}><strong>Date:</strong> {new Date(selectedRefund.createdAt).toLocaleString()}</Typography>
								<Typography sx={{ color: darkMode ? '#fff' : 'inherit' }}><strong>Original Total:</strong> Rs. {calculateOriginalTotal(selectedRefund).toFixed(2)}</Typography>
							</Box>

							<Typography variant="h6" sx={{ mt: 3, mb: 2, color: darkMode ? '#fff' : 'inherit' }}>Refunded Items:</Typography>
							<Box sx={{ maxHeight: '300px', overflow: 'auto' }}>
								{(selectedRefund.refunds || []).map((refund, idx) => (
									<Box key={idx} sx={{ mb: 2, p: 2, bgcolor: darkMode ? '#2a2a2a' : '#f5f5f5', borderRadius: 1 }}>
										{refund.items.map((item, itemIdx) => {
											const price = Number(item.perPiecePrice || item.price || 0);
											const qty = Number(item.quantity || 0);
											return (
												<Box key={itemIdx} sx={{ mb: 1 }}>
													<Typography sx={{ color: darkMode ? '#fff' : 'inherit' }}>
														<strong>{item.productName}</strong> × {qty}
													</Typography>
													<Typography variant="body2" sx={{ color: darkMode ? '#aaa' : 'textSecondary' }}>
														Price: Rs. {price.toFixed(2)} | Total: Rs. {(price * qty).toFixed(2)}
													</Typography>
												</Box>
											);
										})}
										{refund.reason && (
											<Typography variant="body2" sx={{ mt: 1, pt: 1, borderTop: `1px solid ${darkMode ? '#333' : '#ddd'}`, color: darkMode ? '#fff' : 'inherit' }}>
												<strong>Reason:</strong> {refund.reason}
											</Typography>
										)}
										{refund.totalRefundAmount !== undefined && (
											<Typography variant="body2" sx={{ mt: 1, color: darkMode ? '#fff' : 'inherit' }}><strong>Refund Total:</strong> Rs. {Number(refund.totalRefundAmount).toFixed(2)}</Typography>
										)}
									</Box>
								))}
							</Box>

							<Box sx={{ mt: 3, p: 2, bgcolor: darkMode ? 'rgba(211, 47, 47, 0.1)' : '#fff3e0', borderRadius: 1 }}>
								<Typography variant="h6" sx={{ color: darkMode ? '#fff' : 'inherit' }}>
									Total Refund: <span style={{ color: darkMode ? '#ef5350' : '#d32f2f' }}>Rs. {calculateTotalRefund(selectedRefund).toFixed(2)}</span>
								</Typography>
								<Typography variant="body2" sx={{ mt: 1, color: darkMode ? '#fff' : 'inherit' }}>
									Final Total: Rs. {(calculateOriginalTotal(selectedRefund) - calculateTotalRefund(selectedRefund)).toFixed(2)}
								</Typography>
							</Box>
						</Box>
					)}
				</DialogContent>
				<DialogActions sx={{ bgcolor: darkMode ? '#1e1e1e' : '#fff' }}>
					<Button onClick={() => setViewDialogOpen(false)} sx={{ color: darkMode ? '#fff' : 'inherit' }}>Close</Button>
					<Button
						variant="contained"
						color="primary"
						startIcon={<PrintIcon />}
						onClick={() => {
							handlePrintRefund(selectedRefund);
							setViewDialogOpen(false);
						}}
					>
						Print Invoice
					</Button>
				</DialogActions>
			</Dialog>
		</>
	);
};

export default SellerRefunds;
