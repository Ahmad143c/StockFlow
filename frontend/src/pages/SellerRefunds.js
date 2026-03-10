import React, { useEffect, useState } from 'react';
import { Box, Paper, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Button, TextField, Grid, Chip, Dialog, DialogTitle, DialogContent, DialogActions, IconButton, Alert } from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import CloseIcon from '@mui/icons-material/Close';
import API from '../api/api';
import { useDarkMode } from '../context/DarkModeContext';

const SellerRefunds = () => {
	const { darkMode } = useDarkMode();
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
			<div style="text-align: center; font-family: monospace; width: 80mm; margin: 0 auto; padding: 10px;">
				<div style="font-weight: bold; font-size: 18px; margin-bottom: 10px;">New Adil Electric Concern</div>
				<div>4-B, Jamiat Center, Shah Alam Market</div>
				<div>Lahore, Pakistan</div>
				<div>Phone: (042) 123-4567 | Email: info@adilelectric.com</div>
				<div>Website: e-roshni.com</div>
				<hr style="margin: 10px 0" />
				<div style="color: white; background-color: #ff6b6b; padding: 5px; margin-bottom: 10px; font-weight: bold; border-radius: 3px;">REFUND INVOICE</div>
				<div style="margin-bottom: 10px;">
					<div><strong>Invoice #${sale._id?.substr(-6) || ''}</strong></div>
					<div>Date: ${new Date(sale.createdAt || Date.now()).toLocaleDateString()} | Time: ${new Date(sale.createdAt || Date.now()).toLocaleTimeString()}</div>
					<div>Customer: ${sale.customerName || '-'} | Contact: ${sale.customerContact || '-'}</div>
				</div>
				<table style="width: 100%; border-collapse: collapse; margin-bottom: 10px;">
					<thead>
						<tr style="border-bottom: 1px solid #000">
							<th style="text-align: left; padding: 5px">S/N</th>
							<th style="text-align: left; padding: 5px">Item</th>
							<th style="text-align: right; padding: 5px">Qty</th>
							<th style="text-align: right; padding: 5px">Rate</th>
							<th style="text-align: right; padding: 5px">Amount</th>
							<th style="text-align: right; padding: 5px">Reason</th>
						</tr>
					</thead>
					<tbody>
						${(sale.refunds || []).map((refund, refIdx) => 
							refund.items.map((item, itemIdx) => {
								const itemPrice = Number(item.perPiecePrice || item.price || 0);
								const itemTotal = itemPrice * (Number(item.quantity || 0));
								return `
									<tr style="border-bottom: 1px solid #ccc">
										<td style="padding: 5px">${refIdx * 10 + itemIdx + 1}</td>
										<td style="padding: 5px">${item.productName || '-'}</td>
										<td style="text-align: right; padding: 5px">${item.quantity || 0}</td>
										<td style="text-align: right; padding: 5px">Rs. ${(itemPrice || 0).toFixed(2)}</td>
										<td style="text-align: right; padding: 5px">Rs. ${itemTotal.toFixed(2)}</td>
										<td style="text-align: right; padding: 5px; font-size: 10px;">${refund.reason || '-'}</td>
									</tr>
								`;
							}).join('')
						).join('')}
						<tr>
							<td colSpan="4" style="text-align: right; padding: 5px"><strong>Original Total</strong></td>
							<td style="text-align: right; padding: 5px; font-weight: bold">Rs. ${originalTotal.toFixed(2)}</td>
							<td></td>
						</tr>
						<tr style="background-color: #ffe0e0;">
							<td colSpan="4" style="text-align: right; padding: 5px"><strong>Total Refund</strong></td>
							<td style="text-align: right; padding: 5px; font-weight: bold; color: #d32f2f;">Rs. ${totalRefund.toFixed(2)}</td>
							<td></td>
						</tr>
						<tr>
							<td colSpan="4" style="text-align: right; padding: 5px"><strong>Final Total</strong></td>
							<td style="text-align: right; padding: 5px; font-weight: bold">Rs. ${(originalTotal - totalRefund).toFixed(2)}</td>
							<td></td>
						</tr>
					</tbody>
				</table>
				<div style="text-align: center; margin-top: 10px; font-size: 12px">Thank you for your business!</div>
			</div>
		`;
		
		const w = window.open('', '_blank');
		if (!w || !w.document) {
			alert('Please allow popups for printing');
			return;
		}
		w.document.write(`
			<html>
				<head>
					<title>Refund Invoice #${sale._id?.substr(-6) || ''}</title>
					<style>
						@media print {
							@page { size: 80mm auto; margin: 0; }
							body { margin: 0; padding: 10px; font-family: monospace; }
						}
						body { font-family: monospace; padding: 10px; }
						table { width: 100%; border-collapse: collapse; }
						th, td { padding: 5px; text-align: left; }
						.text-right { text-align: right; }
					</style>
				</head>
				<body>${printContent}</body>
			</html>
		`);
		w.document.close();
		setTimeout(() => w.print(), 250);
	};

	// Print filtered list
	const handlePrintList = () => {
		if (filteredRefunds.length === 0) {
			alert('No refunds to print');
			return;
		}

		const printWindow = window.open('', '', 'height=600,width=1000');
		const refundedItemsStr = filteredRefunds.map(s => {
			const refundedItems = (s.refunds || []).map(r => r.items.map(i => i.productName + ' x' + i.quantity).join(', ')).join(' | ');
			return `
							<tr>
								<td>${s.invoiceNumber || s._id?.slice(-6)}</td>
								<td>${new Date(s.createdAt).toLocaleString()}</td>
								<td>${s.customerName || '-'}</td>
								<td>${refundedItems}</td>
								<td>Rs. ${calculateTotalRefund(s).toFixed(2)}</td>
							</tr>
						`;
		}).join('');

		printWindow.document.write(`
			<!DOCTYPE html>
			<html>
			<head>
				<title>Refund List Report</title>
				<style>
					body { font-family: Arial, sans-serif; margin: 20px; }
					.header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
					.filter-info { margin: 15px 0; font-size: 12px; }
					table { width: 100%; border-collapse: collapse; }
					th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
					th { background-color: #f0f0f0; }
					.print-date { text-align: right; margin-top: 20px; font-size: 12px; }
				</style>
			</head>
			<body>
				<div class="header">
					<h1>Refund List Report</h1>
				</div>

				<div class="filter-info">
					${searchTerm ? `<p><strong>Search:</strong> ${searchTerm}</p>` : ''}
					${startDate ? `<p><strong>From:</strong> ${new Date(startDate).toLocaleDateString()}</p>` : ''}
					${endDate ? `<p><strong>To:</strong> ${new Date(endDate).toLocaleDateString()}</p>` : ''}
				</div>

				<table>
					<thead>
						<tr>
							<th>Invoice #</th>
							<th>Date</th>
							<th>Customer Name</th>
							<th>Refunded Items</th>
							<th>Total Refund</th>
						</tr>
					</thead>
					<tbody>
						${refundedItemsStr}
					</tbody>
				</table>

				<div class="print-date">
					Printed on: ${new Date().toLocaleString()}
				</div>
			</body>
			</html>
		`);
		printWindow.document.close();
		printWindow.print();
	};

	return (
		<Box sx={{ width: '100%', mx: 'auto', mb: 4, backgroundColor: darkMode ? '#121212' : '#fafafa', minHeight: '100vh' }}>
			<Paper elevation={6} sx={{ p: 4, mb: 3, borderRadius: 4, backgroundColor: darkMode ? '#1e1e1e' : '#fff' }}>
				<Typography variant="h5" color="primary" gutterBottom sx={{ mb: 3 }}>Seller - Refund Invoices</Typography>

				{/* Search and Filter Section */}
				<Paper elevation={0} sx={{ p: 3, mb: 3, bgcolor: darkMode ? '#2a2a2a' : '#f5f5f5' }}>
					<Grid container spacing={2} sx={{ mb: 2 }}>
						<Grid item xs={12} sm={6} md={4}>
							<TextField
								fullWidth
								label="Search"
								placeholder="Invoice #, Customer, or Product"
								value={searchTerm}
								onChange={(e) => setSearchTerm(e.target.value)}
								size="small"
								variant="outlined"
							/>
						</Grid>
						<Grid item xs={12} sm={6} md={3}>
							<TextField
								fullWidth
								label="Start Date"
								type="date"
								value={startDate}
								onChange={(e) => setStartDate(e.target.value)}
								size="small"
								variant="outlined"
								InputLabelProps={{ shrink: true }}
							/>
						</Grid>
						<Grid item xs={12} sm={6} md={3}>
							<TextField
								fullWidth
								label="End Date"
								type="date"
								value={endDate}
								onChange={(e) => setEndDate(e.target.value)}
								size="small"
								variant="outlined"
								InputLabelProps={{ shrink: true }}
							/>
						</Grid>
						<Grid item xs={12} sm={6} md={2}>
							<Button
								fullWidth
								variant="contained"
								color="primary"
								startIcon={<PrintIcon />}
								onClick={handlePrintList}
								sx={{ height: '40px' }}
							>
								Print List
							</Button>
						</Grid>
					</Grid>
					<Typography variant="caption" color="textSecondary">
						Results: {filteredRefunds.length} refund(s) found
					</Typography>
				</Paper>

				{/* Table Section */}
				<TableContainer>
					<Table>
						<TableHead>
						<TableRow sx={{ bgcolor: darkMode ? '#2a2a2a' : '#f5f5f5' }}>
								<TableCell><strong>Invoice</strong></TableCell>
								<TableCell><strong>Date</strong></TableCell>
								<TableCell><strong>Customer Name</strong></TableCell>
								<TableCell><strong>Refunded Items</strong></TableCell>
								<TableCell><strong>Total Refund</strong></TableCell>
								<TableCell><strong>Actions</strong></TableCell>
							</TableRow>
						</TableHead>
						<TableBody>
							{filteredRefunds.map(s => (
								<TableRow key={s._id}>
									<TableCell>{s.invoiceNumber || s._id?.slice(-6)}</TableCell>
									<TableCell>{new Date(s.createdAt).toLocaleString()}</TableCell>
									<TableCell>{s.customerName || '-'}</TableCell>
									<TableCell>{(s.refunds || []).map(r => r.items.map(i => `${i.productName} x${i.quantity}`).join(', ')).join(' | ')}</TableCell>
									<TableCell sx={{ fontWeight: 'bold', color: '#d32f2f' }}>Rs. {calculateTotalRefund(s).toFixed(2)}</TableCell>
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

			{/* View Refund Dialog */}
			<Dialog 
				open={viewDialogOpen} 
				onClose={() => setViewDialogOpen(false)}
				maxWidth="sm"
				fullWidth
			>
				<DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
					<Box>
						<Chip label="REFUND INVOICE" color="error" sx={{ mr: 1 }} />
						<Typography variant="h6" component="span">Invoice #{selectedRefund?.invoiceNumber || selectedRefund?._id?.slice(-6)}</Typography>
					</Box>
					<IconButton onClick={() => setViewDialogOpen(false)} size="small">
						<CloseIcon />
					</IconButton>
				</DialogTitle>
				<DialogContent dividers>
					{selectedRefund && (
						<Box>
							<Box sx={{ mb: 2 }}>
								<Typography><strong>Customer Name:</strong> {selectedRefund.customerName || '-'}</Typography>
								<Typography><strong>Contact:</strong> {selectedRefund.customerContact || '-'}</Typography>
								<Typography><strong>Date:</strong> {new Date(selectedRefund.createdAt).toLocaleString()}</Typography>
								<Typography><strong>Original Total:</strong> Rs. {calculateOriginalTotal(selectedRefund).toFixed(2)}</Typography>
							</Box>

							<Typography variant="h6" sx={{ mt: 3, mb: 2 }}>Refunded Items:</Typography>
							<Box sx={{ maxHeight: '300px', overflow: 'auto' }}>
								{(selectedRefund.refunds || []).map((refund, idx) => (
									<Box key={idx} sx={{ mb: 2, p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
										{refund.items.map((item, itemIdx) => {
											const price = Number(item.perPiecePrice || item.price || 0);
											const qty = Number(item.quantity || 0);
											return (
												<Box key={itemIdx} sx={{ mb: 1 }}>
													<Typography>
														<strong>{item.productName}</strong> × {qty}
													</Typography>
													<Typography variant="body2" color="textSecondary">
														Price: Rs. {price.toFixed(2)} | Total: Rs. {(price * qty).toFixed(2)}
													</Typography>
												</Box>
											);
										})}
										{refund.reason && (
											<Typography variant="body2" sx={{ mt: 1, pt: 1, borderTop: '1px solid #ddd' }}>
												<strong>Reason:</strong> {refund.reason}
											</Typography>
										)}
										{refund.totalRefundAmount !== undefined && (
											<Typography variant="body2" sx={{ mt: 1 }}><strong>Refund Total:</strong> Rs. {Number(refund.totalRefundAmount).toFixed(2)}</Typography>
										)}
									</Box>
								))}
							</Box>

							<Box sx={{ mt: 3, p: 2, bgcolor: '#fff3e0', borderRadius: 1 }}>
								<Typography variant="h6">
									Total Refund: <span style={{ color: '#d32f2f' }}>Rs. {calculateTotalRefund(selectedRefund).toFixed(2)}</span>
								</Typography>
								<Typography variant="body2" sx={{ mt: 1 }}>
									Final Total: Rs. {(calculateOriginalTotal(selectedRefund) - calculateTotalRefund(selectedRefund)).toFixed(2)}
								</Typography>
							</Box>
						</Box>
					)}
				</DialogContent>
				<DialogActions>
					<Button onClick={() => setViewDialogOpen(false)}>Close</Button>
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
		</Box>
	);
};

export default SellerRefunds;
