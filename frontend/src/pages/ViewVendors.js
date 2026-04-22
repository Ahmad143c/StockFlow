import React, { useState } from 'react';
import { Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Button, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Grid, useTheme, Chip, Divider as MuiDivider, Alert } from '@mui/material';
import Divider from '@mui/material/Divider';
import EditIcon from '@mui/icons-material/Edit';
import PrintIcon from '@mui/icons-material/Print';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import { useDarkMode } from '../context/DarkModeContext';
import API from '../api/api';

const ViewVendors = () => {
  const [vendors, setVendors] = useState([]);
  const [editVendor, setEditVendor] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [vendorPOs, setVendorPOs] = useState([]);
  const [poDialogOpen, setPoDialogOpen] = useState(false);
  const [loadingPOs, setLoadingPOs] = useState(false);
  const [vendorPOCounts, setVendorPOCounts] = useState({});
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteVendor, setDeleteVendor] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const { darkMode } = useDarkMode();
  const theme = useTheme();

  // Helper function for consistent TextField styling
  const getTextFieldSx = () => ({
    '& .MuiOutlinedInput-root': {
      backgroundColor: darkMode ? '#2a2a2a' : '#f9f9f9',
      '&:hover fieldset': { borderColor: darkMode ? '#90caf9' : '#1976d2' },
      '&.Mui-focused fieldset': { 
        borderColor: darkMode ? '#90caf9' : '#1976d2',
        boxShadow: darkMode ? '0 0 0 2px rgba(144, 202, 249, 0.2)' : '0 0 0 2px rgba(25, 118, 210, 0.2)'
      },
      transition: 'all 0.3s ease',
      '& input': { color: darkMode ? '#fff' : 'inherit' },
      '& textarea': { color: darkMode ? '#fff' : 'inherit' }
    },
    '& .MuiInputLabel-root': {
      color: darkMode ? '#aaa' : '#666',
      '&.Mui-focused': { color: darkMode ? '#90caf9' : '#1976d2' }
    }
  });

  // Define cellSx for consistent styling
  const cellSx = {
    maxWidth: { xs: 80, sm: 120, md: 160, lg: 240 },
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: { xs: '0.75rem', sm: '0.875rem' },
    padding: { xs: '6px 8px', sm: '12px 16px' }
  };

  React.useEffect(() => {
    // Fetch vendors from API
    API.get('/vendors')
      .then(res => {
        setVendors(res.data);
        // Fetch PO counts for each vendor
        fetchPOCounts(res.data);
      }).catch(() => setVendors([]));
  }, []);

  const fetchPOCounts = async (vendorsList) => {
    const counts = {};
    for (const vendor of vendorsList) {
      try {
        const res = await API.get(`/purchase-orders?vendorId=${vendor._id}`);
        counts[vendor._id] = res.data.length;
      } catch (error) {
        counts[vendor._id] = 0;
      }
    }
    setVendorPOCounts(counts);
  };

  const handleEdit = vendor => {
    setEditVendor({ ...vendor });
    setEditOpen(true);
  };

  const handleEditChange = e => {
    const { name, value } = e.target;
    if (name in editVendor.address) {
      setEditVendor({ ...editVendor, address: { ...editVendor.address, [name]: value } });
    } else {
      setEditVendor({ ...editVendor, [name]: value });
    }
  };

  const handleEditSave = async () => {
    try {
      const res = await API.put(`/vendors/${editVendor._id}`, editVendor);
      setVendors(vendors.map(v => v._id === res.data._id ? res.data : v));
      setEditOpen(false);
      alert('Vendor updated successfully!');
    } catch (error) {
      alert('Failed to update vendor. Please try again.');
    }
  };

  const handleDeleteClick = (vendor) => {
    setDeleteVendor(vendor);
    setDeleteOpen(true);
  };

  const handleDeleteClose = () => {
    setDeleteOpen(false);
    setDeleteVendor(null);
  };

  const handleDeleteConfirm = async () => {
    setDeleteLoading(true);
    try {
      await API.delete(`/vendors/${deleteVendor._id}`);
      setVendors(vendors.filter(v => v._id !== deleteVendor._id));
      setDeleteOpen(false);
      setDeleteVendor(null);
      alert('Vendor deleted successfully!');
    } catch (error) {
      alert('Failed to delete vendor. Please try again.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleRowClick = async (vendor, event) => {
    // Don't open PO dialog if clicking on Edit icon
    if (event.target.closest('[data-edit-icon]')) {
      return;
    }

    setSelectedVendor(vendor);
    setLoadingPOs(true);
    setPoDialogOpen(true);

    try {
      const res = await API.get(`/purchase-orders?vendorId=${vendor._id}`);
      const detailedPOs = await Promise.all(
        res.data.map(async (po) => {
          try {
            const detail = await API.get(`/purchase-orders/${po._id}`);
            return detail.data;
          } catch {
            return po;
          }
        })
      );
      setVendorPOs(detailedPOs);
    } catch (error) {
      setVendorPOs([]);
    } finally {
      setLoadingPOs(false);
    }
  };

  const handlePORowClick = (po) => {
    // Navigate to AdminPurchaseReport with highlight parameter
    if (po.poNumber) {
      const url = `/admin/purchases-report?highlight=${encodeURIComponent(po.poNumber)}`;
      window.location.href = url;
    }
  };

  const handlePrintVendorPOs = () => {
    if (!selectedVendor || vendorPOs.length === 0) {
      alert('No purchase orders found for this vendor.');
      return;
    }

    const rows = vendorPOs;
    const totalAmount = rows.reduce((sum, r) => sum + Number(r.grandTotal || 0), 0);

    const rowsHtml = rows.map((r, idx) => `
      <tr>
        <td style="padding:10px;border-bottom:1px solid #ddd;text-align:center;">${idx + 1}</td>
        <td style="padding:10px;border-bottom:1px solid #ddd;font-weight:bold;">${r.poNumber || ''}</td>
        <td style="padding:10px;border-bottom:1px solid #ddd;">${r.poDate ? (r.poDate.slice ? r.poDate.slice(0, 10) : new Date(r.poDate).toLocaleDateString()) : ''}</td>
        <td style="padding:10px;border-bottom:1px solid #ddd;">${r.vendorName || selectedVendor.vendorName || ''}</td>
        <td style="padding:10px;border-bottom:1px solid #ddd;">${r.orderStatus || ''}</td>
        <td style="padding:10px;border-bottom:1px solid #ddd;">${r.paymentTerms || 'N/A'}</td>
        <td style="padding:10px;border-bottom:1px solid #ddd;">${r.paymentStatus || ''}</td>
        <td style="padding:10px;border-bottom:1px solid #ddd;text-align:right;font-weight:bold;">Rs. ${Number(r.grandTotal || 0).toLocaleString()}</td>
      </tr>
    `).join('');

    const html = `
      <html>
        <head>
          <title>Purchase Orders Report - ${selectedVendor.vendorName || selectedVendor.companyName}</title>
          <style>
            * { margin: 0; padding: 0; }
            body { font-family: 'Arial', sans-serif; background: #fff; color: #333; padding: 20px; line-height: 1.6; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #1976d2; padding-bottom: 15px; }
            .header h1 { color: #1976d2; font-size: 24px; margin-bottom: 10px; }
            .header p { font-size: 13px; margin: 4px 0; }
            .info-section { background: #f9f9f9; padding: 12px 15px; margin: 15px 0; border-left: 4px solid #1976d2; }
            .info-section p { font-size: 13px; margin: 4px 0; }
            h2 { color: #1976d2; font-size: 16px; margin-top: 20px; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 2px solid #ddd; }
            table { width: 100%; border-collapse: collapse; margin: 10px 0; }
            th { background-color: #1976d2; color: white; padding: 12px; text-align: left; font-weight: bold; font-size: 13px; }
            td { padding: 10px; font-size: 12px; }
            tr:nth-child(even) { background-color: #f9f9f9; }
            .total-row { background-color: #e8f4f8; font-weight: bold; }
            .total-row td { padding: 12px; border-top: 2px solid #1976d2; }
            @media print { body { padding: 0; } .page-break { page-break-after: always; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Purchase Orders Report</h1>
            <p><strong>Vendor:</strong> ${selectedVendor.vendorName || selectedVendor.companyName}</p>
            <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
          </div>

          <div class="info-section">
            <p><strong>Vendor Details:</strong> ${selectedVendor.companyName || 'N/A'} | <strong>Email:</strong> ${selectedVendor.email || 'N/A'}</p>
            <p><strong>Phone:</strong> ${selectedVendor.phone || 'N/A'} | <strong>Status:</strong> ${selectedVendor.status || 'Active'}</p>
            <p><strong>Total Purchase Orders:</strong> ${rows.length} | <strong>Total Amount:</strong> Rs. ${totalAmount.toLocaleString()}</p>
          </div>

          <h2>Purchase Orders Details</h2>
          <table>
            <thead>
              <tr>
                <th style="width:5%">S/N</th>
                <th style="width:10%">PO #</th>
                <th style="width:12%">Date</th>
                <th style="width:15%">Vendor</th>
                <th style="width:12%">Order Status</th>
                <th style="width:12%">Payment Terms</th>
                <th style="width:12%">Payment Status</th>
                <th style="width:15%;text-align:right;">Total Amount</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
              <tr class="total-row">
                <td colspan="7" style="text-align:right;padding:12px;">GRAND TOTAL</td>
                <td style="text-align:right;padding:12px;">Rs. ${totalAmount.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>

          <div style="margin-top:30px;text-align:center;font-size:11px;color:#999;">
            <p>This is an automated report. Please verify with procurement records.</p>
          </div>
        </body>
      </html>
    `;
    const w = window.open('', '_blank');
    if (!w || !w.document) { alert('Popup blocked. Allow popups to print.'); return; }
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 250);
  };

  const handlePrintVendorsReport = () => {
    const rows = vendors;
    
    const rowsHtml = rows.map((vendor, idx) => {
      const bgColor = idx % 2 === 0 ? '#fff' : '#f9f9f9';
      const address = vendor.address ? 
        `${vendor.address.street || ''}, ${vendor.address.city || ''}, ${vendor.address.state || ''}, ${vendor.address.country || ''} ${vendor.address.postalCode || ''}`.replace(/,\s*$/, '') 
        : '-';
      return `
        <tr style="background-color: ${bgColor};">
          <td style="text-align: center;">${idx + 1}</td>
          <td>${new Date(vendor.createdAt).toLocaleDateString()}</td>
          <td>${vendor.vendorName || '-'}</td>
          <td>${vendor.companyName || '-'}</td>
          <td>${vendor.email || '-'}</td>
          <td>${vendor.phone || '-'}</td>
          <td>${vendor.website ? `<a href="${vendor.website.startsWith('http') ? vendor.website : 'https://' + vendor.website}" target="_blank">${vendor.website}</a>` : '-'}</td>
          <td>${vendor.taxNumber || '-'}</td>
          <td>${vendor.paymentTerms || '-'}</td>
          <td>${vendor.preferredCurrency || 'USD'}</td>
          <td>${address}</td>
          <td style="text-align: center;">
            <span style="
              background-color: ${vendor.status === 'Active' ? '#e8f5e8' : '#ffebee'};
              color: ${vendor.status === 'Active' ? '#2e7d32' : '#c62828'};
              padding: 4px 8px;
              border-radius: 4px;
              font-size: 11px;
              font-weight: 600;
              border: 1px solid ${vendor.status === 'Active' ? '#4caf50' : '#f44336'};
            ">
              ${vendor.status || 'Active'}
            </span>
          </td>
          <td style="text-align: center; font-weight: 600; color: #1976d2;"><strong>${vendorPOCounts[vendor._id] || 0}</strong></td>
          <td>${vendor.notes || '-'}</td>
        </tr>
      `;
    }).join('');
    
    const html = `
      <html><head>
        <title>Vendors Report - ${new Date().toLocaleDateString()}</title>
        <style>
          body { 
            font-family: Arial, sans-serif;
            padding: 30px;
            margin: 0;
            background-color: #fff;
          }
          .header {
            text-align: center;
            border-bottom: 3px solid #1976d2;
            padding-bottom: 8px;
            margin-bottom: 10px;
          }
          .header h1 {
            margin: 0 0 2px 0;
            color: #1976d2;
            font-size: 20px;
          }
          .header p {
            margin: 2px 0;
            color: #666;
            font-size: 11px;
          }
          .info-section {
            background-color: #f9f9f9;
            border-left: 4px solid #1976d2;
            padding: 8px;
            margin-bottom: 10px;
            border-radius: 2px;
          }
          .info-section .info-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 4px;
            font-size: 12px;
          }
          .info-section .info-row:last-child {
            margin-bottom: 0;
          }
          .info-label {
            font-weight: 600;
            color: #333;
          }
          .info-value {
            color: #666;
          }
          table { 
            width: 100%; 
            border-collapse: collapse;
            margin-bottom: 10px;
            font-size: 11px;
          }
          th {
            background-color: #1976d2;
            color: white;
            padding: 8px;
            text-align: left;
            font-weight: 600;
            border: none;
            white-space: nowrap;
          }
          td { 
            padding: 6px 8px;
            border-bottom: 1px solid #e0e0e0;
            vertical-align: top;
          }
          .total-row {
            background-color: #e3f2fd;
            font-weight: 600;
            border-top: 2px solid #1976d2;
            border-bottom: 2px solid #1976d2;
          }
          .total-row td {
            padding: 12px;
            color: #1976d2;
          }
          .center { text-align: center; }
          .right { text-align: right; }
          a {
            color: #1976d2;
            text-decoration: none;
          }
          a:hover {
            text-decoration: underline;
          }
          @media print {
            body { padding: 15px; margin: 0; }
            .header { page-break-inside: avoid; padding-bottom: 5px; margin-bottom: 5px; }
            .info-section { page-break-inside: avoid; }
            table { page-break-inside: auto; }
            tr { page-break-inside: avoid; }
            th { font-size: 10px; padding: 6px; }
            td { font-size: 10px; padding: 4px 6px; }
          }
        </style>
      </head><body>
        <div class="header">
          <h1>Vendors Report</h1>
          <p>Generated on ${new Date().toLocaleString()}</p>
        </div>
        <div class="info-section">
          <div class="info-row">
            <span class="info-label">Total Vendors:</span>
            <span class="info-value">${rows.length}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Active Vendors:</span>
            <span class="info-value">${rows.filter(v => v.status === 'Active').length}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Inactive Vendors:</span>
            <span class="info-value">${rows.filter(v => v.status === 'Inactive').length}</span>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 3%;">S/N</th>
              <th style="width: 8%;">Added Date</th>
              <th style="width: 10%;">Vendor Name</th>
              <th style="width: 10%;">Company Name</th>
              <th style="width: 10%;">Email</th>
              <th style="width: 8%;">Phone</th>
              <th style="width: 8%;">Website</th>
              <th style="width: 7%;">Tax Number</th>
              <th style="width: 8%;">Payment Terms</th>
              <th style="width: 5%;">Currency</th>
              <th style="width: 12%;">Address</th>
              <th style="width: 5%;" class="center">Status</th>
              <th style="width: 5%;" class="center">PO Count</th>
              <th style="width: 10%;">Notes</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </body></html>
    `;
    const w = window.open('', '_blank');
    if (!w || !w.document) { alert('Popup blocked. Allow popups to print.'); return; }
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 250);
  };

  return (
    <Box
      sx={{
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
      }}
    >
      {/* Header Section */}
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
        <Typography 
          variant="h4" 
          fontWeight={700} 
          color="primary" 
          sx={{ 
            fontSize: { xs: '1.1rem', sm: '1.5rem', md: '2rem' },
            textAlign: { xs: 'center', sm: 'left' }
          }}
        >
          Vendor Management
        </Typography>
        <Button 
          variant="contained" 
          startIcon={<PrintIcon />} 
          onClick={handlePrintVendorsReport}
          sx={{
            background: darkMode 
              ? 'linear-gradient(45deg, #90caf9, #64b5f6)'
              : 'linear-gradient(45deg, #1976d2, #42a5f5)',
            color: '#fff',
            fontWeight: 600,
            px: { xs: 2, sm: 3 },
            py: { xs: 1, sm: 1.5 },
            borderRadius: 2,
            boxShadow: darkMode
              ? '0 4px 15px rgba(144, 202, 249, 0.3)'
              : '0 4px 15px rgba(25, 118, 210, 0.3)',
            '&:hover': {
              background: darkMode
                ? 'linear-gradient(45deg, #64b5f6, #42a5f5)'
                : 'linear-gradient(45deg, #1565c0, #2196f3)',
              transform: 'translateY(-2px)',
              boxShadow: darkMode
                ? '0 6px 20px rgba(144, 202, 249, 0.4)'
                : '0 6px 20px rgba(25, 118, 210, 0.4)',
            },
            transition: 'all 0.3s ease'
          }}
        >
          Print Report
        </Button>
      </Box>
      <Paper
        elevation={6}
        sx={{
          p: { xs: 1, sm: 2, md: 4 },
          borderRadius: { xs: 3, sm: 2, md: 6 },
          background: `linear-gradient(135deg, ${darkMode ? '#2a2a2a' : '#ffffff'} 0%, ${darkMode ? '#1e1e1e' : '#f8f9fa'} 100%)`,
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15), 0 10px 20px rgba(0, 0, 0, 0.1)',
          maxWidth: {
            xs: 'calc(90vw - 16px)',
            sm: '100%',
            md: 'calc(106vw - 300px)'
          },
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
        }}
      >
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
            overflowX: 'auto', // Scrollable for all screen sizes including desktop
            overflowY: 'hidden',
            WebkitOverflowScrolling: 'touch',
            position: 'relative',
            borderRadius: 2,
            boxSizing: 'border-box',
            '&::-webkit-scrollbar': {
              height: { xs: '4px', sm: '6px' },
            },
            '&::-webkit-scrollbar-track': {
              backgroundColor: darkMode ? '#2a2a2a' : '#f1f1f1',
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
              minWidth: { xs: 1200, sm: 1400, md: 1600 }, // Increased minWidth for all columns
              width: '100%', // Full width for all screen sizes
              tableLayout: { xs: 'auto', sm: 'auto', md: 'auto' }, // Auto layout for all sizes
              whiteSpace: { xs: 'nowrap', sm: 'nowrap', md: 'nowrap' },
              minHeight: 1,
            }}
          >
              <TableHead>
                <TableRow sx={{ bgcolor: darkMode ? '#2a2a2a' : '#f5f5f5', borderBottom: '2px solid #1976d2' }}>
                  <TableCell sx={{ 
                    fontWeight: 'bold',
                    fontSize: { xs: '0.75rem', sm: '0.875rem' }, 
                    padding: { xs: '8px 6px', sm: '12px 16px' },
                    position: 'sticky',
                    left: 0,
                    backgroundColor: darkMode ? '#2a2a2a' : '#f5f5f5',
                    zIndex: 3,
                    boxShadow: '2px 0 5px -2px rgba(0,0,0,0.1)',
                    minWidth: { xs: 10, sm: 100 }
                  }}>Vendor Name</TableCell>
                  <TableCell sx={{ 
                    fontWeight: 'bold',
                    fontSize: { xs: '0.75rem', sm: '0.875rem' }, 
                    padding: { xs: '8px 6px', sm: '12px 16px' },
                    position: 'sticky',
                    left: { xs: 50, sm: 100 },
                    backgroundColor: darkMode ? '#2a2a2a' : '#f5f5f5',
                    zIndex: 3,
                    boxShadow: '2px 0 5px -2px rgba(0,0,0,0.1)',
                    minWidth: { xs: 50, sm: 120 }
                  }}>Company Name</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', fontSize: { xs: '0.75rem', sm: '0.875rem' }, padding: { xs: '8px 6px', sm: '12px 16px' }, minWidth: { xs: 80, sm: 150 } }}>Email</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', fontSize: { xs: '0.75rem', sm: '0.875rem' }, padding: { xs: '8px 6px', sm: '12px 16px' }, minWidth: { xs: 80, sm: 120 } }}>Phone</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', fontSize: { xs: '0.75rem', sm: '0.875rem' }, padding: { xs: '8px 6px', sm: '12px 16px' }, minWidth: { xs: 100, sm: 150 } }}>Website</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', fontSize: { xs: '0.75rem', sm: '0.875rem' }, padding: { xs: '8px 6px', sm: '12px 16px' }, minWidth: { xs: 80, sm: 120 } }}>Tax Number</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', fontSize: { xs: '0.75rem', sm: '0.875rem' }, padding: { xs: '8px 6px', sm: '12px 16px' }, minWidth: { xs: 100, sm: 120 } }}>Payment Terms</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', fontSize: { xs: '0.75rem', sm: '0.875rem' }, padding: { xs: '8px 6px', sm: '12px 16px' }, minWidth: { xs: 80, sm: 100 } }}>Currency</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', fontSize: { xs: '0.75rem', sm: '0.875rem' }, padding: { xs: '8px 6px', sm: '12px 16px' }, minWidth: { xs: 200, sm: 250 } }}>Address</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', fontSize: { xs: '0.75rem', sm: '0.875rem' }, padding: { xs: '8px 6px', sm: '12px 16px' }, minWidth: { xs: 60, sm: 80 } }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', fontSize: { xs: '0.75rem', sm: '0.875rem' }, padding: { xs: '8px 6px', sm: '12px 16px' }, textAlign: 'center', minWidth: { xs: 50, sm: 70 } }}>PO Count</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', fontSize: { xs: '0.75rem', sm: '0.875rem' }, padding: { xs: '8px 6px', sm: '12px 16px' }, minWidth: { xs: 150, sm: 200 } }}>Notes</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', fontSize: { xs: '0.75rem', sm: '0.875rem' }, padding: { xs: '8px 6px', sm: '12px 16px' }, textAlign: 'center', minWidth: { xs: 60, sm: 80 } }}>Edit</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', fontSize: { xs: '0.75rem', sm: '0.875rem' }, padding: { xs: '8px 6px', sm: '12px 16px' }, textAlign: 'center', minWidth: { xs: 60, sm: 80 } }}>Delete</TableCell>
                </TableRow>
              </TableHead>
            <TableBody>
              {vendors.map(vendor => (
                <TableRow
                  key={vendor._id}
                  sx={{
                    '&:hover': {
                      backgroundColor: darkMode ? '#2a2a2a' : '#f9f9f9',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s ease',
                    },
                    backgroundColor: darkMode ? '#1e1e1e' : '#fff',
                    borderBottom: `1px solid ${darkMode ? '#333' : '#e0e0e0'}`,
                  }}
                  onClick={(e) => handleRowClick(vendor, e)}
                >
                  <TableCell sx={{
                    ...cellSx,
                    position: 'sticky',
                    left: 0,
                    backgroundColor: darkMode ? '#1e1e1e' : '#fff',
                    zIndex: 1,
                    boxShadow: '2px 0 5px -2px rgba(0,0,0,0.1)',
                    minWidth: { xs: 10, sm: 100 },
                    color: darkMode ? '#fff' : 'inherit'
                  }}>
                    {vendor.vendorName || '-'}
                  </TableCell>
                  <TableCell sx={{
                    ...cellSx,
                    position: 'sticky',
                    left: { xs: 51, sm: 100 },
                    backgroundColor: darkMode ? '#1e1e1e' : '#fff',
                    zIndex: 1,
                    boxShadow: '2px 0 5px -2px rgba(0,0,0,0.1)',
                    minWidth: { xs: 50, sm: 120 },
                    color: darkMode ? '#fff' : 'inherit'
                  }}>
                    {vendor.companyName || '-'}
                  </TableCell>
                  <TableCell sx={{ ...cellSx, color: darkMode ? '#fff' : 'inherit' }}>
                    {vendor.email || '-'}
                  </TableCell>
                  <TableCell sx={{ ...cellSx, color: darkMode ? '#fff' : 'inherit' }}>
                    {vendor.phone || '-'}
                  </TableCell>
                  <TableCell sx={{ ...cellSx, color: darkMode ? '#fff' : 'inherit' }}>
                    {vendor.website ? (
                      <a 
                        href={vendor.website.startsWith('http') ? vendor.website : `https://${vendor.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ 
                          color: darkMode ? '#90caf9' : '#1976d2',
                          textDecoration: 'none'
                        }}
                        onMouseEnter={(e) => e.target.style.textDecoration = 'underline'}
                        onMouseLeave={(e) => e.target.style.textDecoration = 'none'}
                      >
                        {vendor.website}
                      </a>
                    ) : '-'}
                  </TableCell>
                  <TableCell sx={{ ...cellSx, color: darkMode ? '#fff' : 'inherit' }}>
                    {vendor.taxNumber || '-'}
                  </TableCell>
                  <TableCell sx={{ ...cellSx, color: darkMode ? '#fff' : 'inherit' }}>
                    {vendor.paymentTerms || '-'}
                  </TableCell>
                  <TableCell sx={{ ...cellSx, color: darkMode ? '#fff' : 'inherit' }}>
                    {vendor.preferredCurrency || 'USD'}
                  </TableCell>
                  <TableCell sx={{ ...cellSx, color: darkMode ? '#fff' : 'inherit' }}>
                    {vendor.address ? 
                      `${vendor.address.street || ''}, ${vendor.address.city || ''}, ${vendor.address.state || ''}, ${vendor.address.country || ''} ${vendor.address.postalCode || ''}`.replace(/,\s*$/, '') 
                      : '-'
                    }
                  </TableCell>
                  <TableCell sx={{ ...cellSx, color: darkMode ? '#fff' : 'inherit' }}>
                    <Box
                      sx={{
                        display: 'inline-block',
                        px: 1,
                        py: 0.5,
                        borderRadius: 1,
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        backgroundColor: vendor.status === 'Active' 
                          ? (darkMode ? 'rgba(76, 175, 80, 0.3)' : 'rgba(76, 175, 80, 0.1)')
                          : (darkMode ? 'rgba(244, 67, 54, 0.3)' : 'rgba(244, 67, 54, 0.1)'),
                        color: vendor.status === 'Active'
                          ? (darkMode ? '#81c784' : '#2e7d32')
                          : (darkMode ? '#e57373' : '#c62828'),
                        border: `1px solid ${
                          vendor.status === 'Active'
                            ? (darkMode ? 'rgba(76, 175, 80, 0.5)' : 'rgba(76, 175, 80, 0.3)')
                            : (darkMode ? 'rgba(244, 67, 54, 0.5)' : 'rgba(244, 67, 54, 0.3)')
                        }`
                      }}
                    >
                      {vendor.status || 'Active'}
                    </Box>
                  </TableCell>
                  <TableCell sx={{ ...cellSx, textAlign: 'center', color: darkMode ? '#fff' : 'inherit', fontWeight: 600 }}>
                    <Box
                      sx={{
                        display: 'inline-block',
                        px: 1.5,
                        py: 0.5,
                        borderRadius: 1,
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        backgroundColor: darkMode ? 'rgba(66, 165, 245, 0.3)' : 'rgba(25, 118, 210, 0.1)',
                        color: darkMode ? '#64b5f6' : '#1976d2',
                        border: `1px solid ${darkMode ? 'rgba(66, 165, 245, 0.5)' : 'rgba(25, 118, 210, 0.3)'}`
                      }}
                    >
                      {vendorPOCounts[vendor._id] || 0}
                    </Box>
                  </TableCell>
                  <TableCell sx={{ 
                    ...cellSx, 
                    color: darkMode ? '#fff' : 'inherit',
                    maxWidth: { xs: 60, sm: 150, md: 200 }
                  }}>
                    <Box sx={{ 
                      overflow: 'hidden', 
                      textOverflow: 'ellipsis', 
                      whiteSpace: 'nowrap',
                      fontSize: { xs: '0.7rem', sm: '0.8rem' }
                    }}>
                      {vendor.notes || '-'}
                    </Box>
                  </TableCell>
                  <TableCell sx={{ textAlign: 'center', padding: { xs: '6px 8px', sm: '12px 16px' } }}>
                    <IconButton 
                      data-edit-icon
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(vendor);
                      }}
                      sx={{
                        color: darkMode ? '#90caf9' : '#1976d2',
                        '&:hover': {
                          backgroundColor: darkMode ? 'rgba(144, 202, 249, 0.1)' : 'rgba(25, 118, 210, 0.1)',
                          transform: 'scale(1.1)'
                        },
                        transition: 'all 0.3s ease'
                      }}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                  <TableCell sx={{ textAlign: 'center', padding: { xs: '6px 8px', sm: '12px 16px' } }}>
                    <IconButton 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClick(vendor);
                      }}
                      sx={{
                        color: darkMode ? '#ef5350' : '#d32f2f',
                        '&:hover': {
                          backgroundColor: darkMode ? 'rgba(239, 83, 80, 0.1)' : 'rgba(211, 47, 47, 0.1)',
                          transform: 'scale(1.1)'
                        },
                        transition: 'all 0.3s ease'
                      }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
      <Dialog 
        open={editOpen} 
        onClose={() => setEditOpen(false)} 
        maxWidth="lg" 
        fullWidth
        PaperProps={{
          sx: {
            m: { xs: 1, sm: 2 },
            borderRadius: { xs: 2, sm: 3 },
            background: darkMode 
              ? 'linear-gradient(135deg, #2a2a2a 0%, #1e1e1e 100%)'
              : 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
            boxShadow: darkMode
              ? '0 20px 40px rgba(0, 0, 0, 0.5)'
              : '0 20px 40px rgba(0, 0, 0, 0.15)',
            border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'}`
          }
        }}
      >
        <DialogTitle 
          sx={{ 
            background: darkMode 
              ? 'linear-gradient(135deg, rgba(25, 118, 210, 0.1) 0%, rgba(66, 165, 245, 0.05) 100%)'
              : 'linear-gradient(135deg, rgba(25, 118, 210, 0.05) 0%, rgba(66, 165, 245, 0.02) 100%)',
            borderBottom: `2px solid ${darkMode ? '#333' : '#e0e0e0'}`,
            fontSize: { xs: '1.1rem', sm: '1.25rem', md: '1.5rem' },
            fontWeight: 600,
            color: darkMode ? '#fff' : 'inherit'
          }}
        >
          Edit Vendor
        </DialogTitle>
        <DialogContent>
          {editVendor && (
            <Box sx={{ p: { xs: 0, sm: 1 } }}>
              <Paper 
                elevation={0} 
                sx={{ 
                  p: { xs: 1, sm: 2 }, 
                  borderRadius: 3, 
                  background: darkMode 
                    ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%)'
                    : 'linear-gradient(135deg, #f7f9fc 0%, #ffffff 100%)',
                  maxWidth: { xs: '100%', sm: 1200 }, 
                  mx: 'auto',
                  border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'}`
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, flexDirection: { xs: 'column', sm: 'row' }, textAlign: { xs: 'center', sm: 'left' } }}>
                  <EditIcon color={darkMode ? "secondary" : "primary"} sx={{ mr: { xs: 0, sm: 1 }, mb: { xs: 1, sm: 0 } }} />
                  <Typography variant="h6" fontWeight={700} color={darkMode ? "primary" : "primary"} sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>Edit Vendor Details</Typography>
                </Box>
                <Divider sx={{ mb: 2, borderColor: darkMode ? '#333' : '#e0e0e0' }} />
                <Typography variant="subtitle2" fontWeight={600} gutterBottom sx={{ fontSize: { xs: '0.9rem', sm: '1rem' }, color: darkMode ? '#fff' : 'inherit' }}>Basic Information</Typography>
                <Grid container spacing={{ xs: 1, sm: 2 }}>
                  <Grid item xs={12} sm={6}>
                    <TextField 
                      label="Vendor Name" 
                      name="vendorName" 
                      value={editVendor.vendorName || ''} 
                      onChange={handleEditChange} 
                      fullWidth 
                      required
                      size="small"
                      sx={getTextFieldSx()}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField 
                      label="Company Name" 
                      name="companyName" 
                      value={editVendor.companyName || ''} 
                      onChange={handleEditChange} 
                      fullWidth 
                      size="small"
                      sx={getTextFieldSx()}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField 
                      label="Email" 
                      name="email" 
                      value={editVendor.email || ''} 
                      onChange={handleEditChange} 
                      fullWidth 
                      size="small"
                      sx={getTextFieldSx()}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField 
                      label="Phone" 
                      name="phone" 
                      value={editVendor.phone || ''} 
                      onChange={handleEditChange} 
                      fullWidth 
                      size="small"
                      sx={getTextFieldSx()}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField 
                      label="Website" 
                      name="website" 
                      value={editVendor.website || ''} 
                      onChange={handleEditChange} 
                      fullWidth 
                      size="small"
                      sx={getTextFieldSx()}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField 
                      label="Tax Number" 
                      name="taxNumber" 
                      value={editVendor.taxNumber || ''} 
                      onChange={handleEditChange} 
                      fullWidth 
                      size="small"
                      sx={getTextFieldSx()}
                    />
                  </Grid>
                </Grid>
                <Divider sx={{ mb: 2, borderColor: darkMode ? '#333' : '#e0e0e0' }} />
                <Typography variant="subtitle2" fontWeight={600} gutterBottom sx={{ fontSize: { xs: '0.9rem', sm: '1rem' }, color: darkMode ? '#fff' : 'inherit' }}>Payment & Status</Typography>
                <Grid container spacing={{ xs: 1, sm: 2 }}>
                  <Grid item xs={12} sm={6}>
                    <TextField 
                      label="Payment Terms" 
                      name="paymentTerms" 
                      value={editVendor.paymentTerms || ''} 
                      onChange={handleEditChange} 
                      fullWidth 
                      size="small"
                      sx={getTextFieldSx()}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField 
                      label="Preferred Currency" 
                      name="preferredCurrency" 
                      value={editVendor.preferredCurrency || ''} 
                      onChange={handleEditChange} 
                      fullWidth 
                      size="small"
                      sx={getTextFieldSx()}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField 
                      label="Status" 
                      name="status" 
                      value={editVendor.status || ''} 
                      onChange={handleEditChange} 
                      fullWidth 
                      size="small"
                      sx={getTextFieldSx()}
                    />
                  </Grid>
                </Grid>
                <Divider sx={{ mb: 2, borderColor: darkMode ? '#333' : '#e0e0e0' }} />
                <Typography variant="subtitle2" fontWeight={600} gutterBottom sx={{ fontSize: { xs: '0.9rem', sm: '1rem' }, color: darkMode ? '#fff' : 'inherit' }}>Address</Typography>
                <Grid container spacing={{ xs: 1, sm: 2 }}>
                  <Grid item xs={12} sm={6}>
                    <TextField 
                      label="Street" 
                      name="street" 
                      value={editVendor.address?.street || ''} 
                      onChange={handleEditChange} 
                      fullWidth 
                      size="small"
                      sx={getTextFieldSx()}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField 
                      label="City" 
                      name="city" 
                      value={editVendor.address?.city || ''} 
                      onChange={handleEditChange} 
                      fullWidth 
                      size="small"
                      sx={getTextFieldSx()}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField 
                      label="State" 
                      name="state" 
                      value={editVendor.address?.state || ''} 
                      onChange={handleEditChange} 
                      fullWidth 
                      size="small"
                      sx={getTextFieldSx()}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField 
                      label="Country" 
                      name="country" 
                      value={editVendor.address?.country || ''} 
                      onChange={handleEditChange} 
                      fullWidth 
                      size="small"
                      sx={getTextFieldSx()}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField 
                      label="Postal Code" 
                      name="postalCode" 
                      value={editVendor.address?.postalCode || ''} 
                      onChange={handleEditChange} 
                      fullWidth 
                      size="small"
                      sx={getTextFieldSx()}
                    />
                  </Grid>
                </Grid>
                <Divider sx={{ mb: 2, borderColor: darkMode ? '#333' : '#e0e0e0' }} />
                <Typography variant="subtitle2" fontWeight={600} gutterBottom sx={{ fontSize: { xs: '0.9rem', sm: '1rem' }, color: darkMode ? '#fff' : 'inherit' }}>Notes</Typography>
                <TextField 
                  label="Notes" 
                  name="notes" 
                  value={editVendor.notes || ''} 
                  onChange={handleEditChange} 
                  multiline 
                  rows={2} 
                  fullWidth 
                  size="small"
                  sx={{ 
                    mt: 1,
                    ...getTextFieldSx()
                  }} 
                />
              </Paper>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ flexDirection: { xs: 'column', sm: 'row' }, gap: { xs: 1, sm: 2 }, p: { xs: 2, sm: 3 } }}>
          <Button 
            onClick={() => setEditOpen(false)} 
            sx={{ 
              width: { xs: '100%', sm: 'auto' },
              height: { xs: 40, sm: 45 },
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 500,
              border: '2px solid',
              borderColor: '#1976d2',
              color: '#1976d2',
              backgroundColor: 'transparent',
              transition: 'all 0.3s ease',
              '&:hover': {
                backgroundColor: '#1976d2',
                color: '#fff',
                transform: 'translateY(-2px)',
                boxShadow: '0 8px 16px rgba(25, 118, 210, 0.3)'
              },
              '&:active': {
                transform: 'translateY(0)',
                boxShadow: '0 4px 8px rgba(25, 118, 210, 0.3)'
              }
            }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleEditSave} 
            variant="contained" 
            color="primary" 
            sx={{ 
              width: { xs: '100%', sm: 'auto' },
              height: { xs: 40, sm: 45 },
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 600,
              background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)',
              boxShadow: '0 4px 12px rgba(25, 118, 210, 0.3)',
              transition: 'all 0.3s ease',
              '&:hover': {
                background: 'linear-gradient(135deg, #1565c0 0%, #2196f3 100%)',
                transform: 'translateY(-2px)',
                boxShadow: '0 8px 20px rgba(25, 118, 210, 0.4)'
              },
              '&:active': {
                transform: 'translateY(0)',
                boxShadow: '0 4px 12px rgba(25, 118, 210, 0.3)'
              }
            }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Vendor PO Details Dialog */}
      <Dialog
        open={poDialogOpen}
        onClose={() => setPoDialogOpen(false)}
        maxWidth="lg"
        fullWidth
        sx={{
          '& .MuiDialog-paper': {
            borderRadius: { xs: 2, sm: 3 },
            background: darkMode
              ? 'linear-gradient(135deg, #1e1e1e 0%, #2a2a2a 100%)'
              : 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
            boxShadow: darkMode
              ? '0 20px 40px rgba(0, 0, 0, 0.5)'
              : '0 20px 40px rgba(0, 0, 0, 0.15)',
            border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'}`,
            maxHeight: { xs: '95vh', sm: '90vh' },
            m: { xs: 1, sm: 2 },
            width: { xs: 'calc(100% - 16px)', sm: 'auto' }
          }
        }}
      >
        <DialogTitle
          sx={{
            background: darkMode
              ? 'linear-gradient(135deg, rgba(25, 118, 210, 0.1) 0%, rgba(66, 165, 245, 0.05) 100%)'
              : 'linear-gradient(135deg, rgba(25, 118, 210, 0.05) 0%, rgba(66, 165, 245, 0.02) 100%)',
            borderBottom: `2px solid ${darkMode ? '#333' : '#e0e0e0'}`,
            fontSize: { xs: '1rem', sm: '1.25rem', md: '1.5rem' },
            fontWeight: 600,
            color: darkMode ? '#fff' : 'inherit',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: { xs: 'wrap', sm: 'nowrap' },
            gap: { xs: 1, sm: 2 },
            p: { xs: 1.5, sm: 2 }
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
            <VisibilityIcon color="primary" sx={{ fontSize: { xs: '1.5rem', sm: '1.75rem' } }} />
            <Typography variant="h6" sx={{ fontWeight: 600, fontSize: { xs: '0.95rem', sm: '1rem', md: '1.25rem' }, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              POs - {selectedVendor?.vendorName || selectedVendor?.companyName}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5, ml: { xs: 'auto', sm: 0 } }}>
            <Button
              variant="outlined"
              startIcon={<PrintIcon />}
              onClick={handlePrintVendorPOs}
              disabled={vendorPOs.length === 0}
              sx={{
                fontSize: { xs: '0.65rem', sm: '0.75rem', md: '0.875rem' },
                px: { xs: 0.75, sm: 1.5 },
                py: { xs: 0.3, sm: 0.75 },
                minWidth: 'auto',
                textTransform: 'none',
                fontWeight: 500
              }}
            >
              <span sx={{ display: { xs: 'none', sm: 'inline' } }}>Print</span>
            </Button>
            <IconButton
              onClick={() => setPoDialogOpen(false)}
              sx={{ color: darkMode ? '#fff' : 'inherit', p: { xs: 0.5, sm: 1 } }}
            >
              <CloseIcon sx={{ fontSize: { xs: '1rem', sm: '1.5rem' } }} />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p: { xs: 1, sm: 2, md: 3 }, overflow: 'auto' }}>
          {selectedVendor && (
            <Box sx={{ mb: { xs: 2, sm: 3 } }}>
              <Paper
                elevation={2}
                sx={{
                  p: { xs: 1.5, sm: 2 },
                  background: darkMode
                    ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%)'
                    : 'linear-gradient(135deg, #f7f9fc 0%, #ffffff 100%)',
                  border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'}`,
                  borderRadius: 2
                }}
              >
                <Typography variant="h6" gutterBottom sx={{ color: darkMode ? '#fff' : 'inherit', fontWeight: 600, fontSize: { xs: '0.95rem', sm: '1rem', md: '1.1rem' } }}>
                  Vendor Information
                </Typography>
                <Grid container spacing={{ xs: 1, sm: 2 }}>
                  <Grid item xs={12} sm={6} md={3}>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: darkMode ? '#aaa' : '#666', fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                      Vendor Name:
                    </Typography>
                    <Typography variant="body1" sx={{ color: darkMode ? '#fff' : 'inherit', fontSize: { xs: '0.85rem', sm: '0.95rem' } }}>
                      {selectedVendor.vendorName || 'N/A'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: darkMode ? '#aaa' : '#666', fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                      Company:
                    </Typography>
                    <Typography variant="body1" sx={{ color: darkMode ? '#fff' : 'inherit', fontSize: { xs: '0.85rem', sm: '0.95rem' } }}>
                      {selectedVendor.companyName || 'N/A'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: darkMode ? '#aaa' : '#666', fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                      Email:
                    </Typography>
                    <Typography variant="body1" sx={{ color: darkMode ? '#fff' : 'inherit', fontSize: { xs: '0.85rem', sm: '0.95rem' }, wordBreak: 'break-word' }}>
                      {selectedVendor.email || 'N/A'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: darkMode ? '#aaa' : '#666', fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                      Phone:
                    </Typography>
                    <Typography variant="body1" sx={{ color: darkMode ? '#fff' : 'inherit', fontSize: { xs: '0.85rem', sm: '0.95rem' } }}>
                      {selectedVendor.phone || 'N/A'}
                    </Typography>
                  </Grid>
                </Grid>
              </Paper>
            </Box>
          )}

          {loadingPOs ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: { xs: 2, sm: 4 } }}>
              <Typography sx={{ color: darkMode ? '#fff' : 'inherit', fontSize: { xs: '0.9rem', sm: '1rem' } }}>
                Loading purchase orders...
              </Typography>
            </Box>
          ) : vendorPOs.length === 0 ? (
            <Alert severity="info" sx={{ mb: 2, fontSize: { xs: '0.85rem', sm: '0.95rem' } }}>
              No purchase orders found for this vendor.
            </Alert>
          ) : (
            <Box sx={{
              overflowX: 'auto',
              WebkitOverflowScrolling: 'touch',
              borderRadius: 2,
              border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'}`,
              '&::-webkit-scrollbar': {
                height: '6px',
              },
              '&::-webkit-scrollbar-track': {
                backgroundColor: darkMode ? '#2a2a2a' : '#f1f1f1',
                borderRadius: '3px',
              },
              '&::-webkit-scrollbar-thumb': {
                backgroundColor: darkMode ? '#666' : '#888',
                borderRadius: '3px',
              }
            }}>
              <Table stickyHeader sx={{ minWidth: { xs: 600, sm: 800, md: 1000 } }}>
                <TableHead>
                  <TableRow sx={{ bgcolor: darkMode ? '#2a2a2a' : '#f5f5f5' }}>
                    <TableCell sx={{ fontWeight: 'bold', fontSize: { xs: '0.7rem', sm: '0.8rem', md: '0.875rem' }, padding: { xs: '6px', sm: '12px' }, minWidth: 70, bgcolor: darkMode ? '#2a2a2a' : '#f5f5f5' }}>PO #</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', fontSize: { xs: '0.7rem', sm: '0.8rem', md: '0.875rem' }, padding: { xs: '6px', sm: '12px' }, minWidth: 90, bgcolor: darkMode ? '#2a2a2a' : '#f5f5f5' }}>Date</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', fontSize: { xs: '0.7rem', sm: '0.8rem', md: '0.875rem' }, padding: { xs: '6px', sm: '12px' }, minWidth: 100, bgcolor: darkMode ? '#2a2a2a' : '#f5f5f5' }}>Delivery</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', fontSize: { xs: '0.7rem', sm: '0.8rem', md: '0.875rem' }, padding: { xs: '6px', sm: '12px' }, minWidth: 80, bgcolor: darkMode ? '#2a2a2a' : '#f5f5f5' }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', fontSize: { xs: '0.7rem', sm: '0.8rem', md: '0.875rem' }, padding: { xs: '6px', sm: '12px' }, minWidth: 100, bgcolor: darkMode ? '#2a2a2a' : '#f5f5f5' }}>Terms</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', fontSize: { xs: '0.7rem', sm: '0.8rem', md: '0.875rem' }, padding: { xs: '6px', sm: '12px' }, minWidth: 100, bgcolor: darkMode ? '#2a2a2a' : '#f5f5f5' }}>Pay Status</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', fontSize: { xs: '0.7rem', sm: '0.8rem', md: '0.875rem' }, padding: { xs: '6px', sm: '12px' }, minWidth: 90, bgcolor: darkMode ? '#2a2a2a' : '#f5f5f5', textAlign: 'right' }}>Amount</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', fontSize: { xs: '0.7rem', sm: '0.8rem', md: '0.875rem' }, padding: { xs: '6px', sm: '12px' }, minWidth: 150, bgcolor: darkMode ? '#2a2a2a' : '#f5f5f5' }}>Items</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {vendorPOs.map((po, index) => (
                    <TableRow 
                      key={po._id} 
                      sx={{ 
                        '&:hover': { 
                          backgroundColor: darkMode ? '#333' : '#f9f9f9',
                          cursor: 'pointer'
                        },
                        cursor: 'pointer',
                        borderBottom: `1px solid ${darkMode ? '#333' : '#e0e0e0'}`
                      }}
                      onClick={() => handlePORowClick(po)}
                    >
                      <TableCell sx={{ fontSize: { xs: '0.7rem', sm: '0.8rem', md: '0.875rem' }, color: darkMode ? '#fff' : 'inherit', padding: { xs: '6px', sm: '12px' }, fontWeight: 600 }}>
                        {po.poNumber || po._id?.slice(-8)}
                      </TableCell>
                      <TableCell sx={{ fontSize: { xs: '0.7rem', sm: '0.8rem', md: '0.875rem' }, color: darkMode ? '#fff' : 'inherit', padding: { xs: '6px', sm: '12px' } }}>
                        {po.poDate?.slice(0, 10)}
                      </TableCell>
                      <TableCell sx={{ fontSize: { xs: '0.7rem', sm: '0.8rem', md: '0.875rem' }, color: darkMode ? '#fff' : 'inherit', padding: { xs: '6px', sm: '12px' } }}>
                        {po.expectedDeliveryDate ? new Date(po.expectedDeliveryDate).toLocaleDateString() : 'N/A'}
                      </TableCell>
                      <TableCell sx={{ padding: { xs: '4px', sm: '12px' } }}>
                        <Chip
                          label={po.orderStatus || 'Pending'}
                          size="small"
                          sx={{
                            fontSize: { xs: '0.6rem', sm: '0.7rem', md: '0.75rem' },
                            backgroundColor: po.orderStatus === 'Completed' ? '#4caf50' :
                                           po.orderStatus === 'Pending' ? '#ff9800' :
                                           po.orderStatus === 'Cancelled' ? '#f44336' : '#2196f3',
                            color: 'white',
                            height: { xs: '20px', sm: '24px' }
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ fontSize: { xs: '0.7rem', sm: '0.8rem', md: '0.875rem' }, color: darkMode ? '#fff' : 'inherit', padding: { xs: '6px', sm: '12px' } }}>
                        {po.paymentTerms || 'N/A'}
                      </TableCell>
                      <TableCell sx={{ padding: { xs: '4px', sm: '12px' } }}>
                        <Chip
                          label={po.paymentStatus || 'Unpaid'}
                          size="small"
                          sx={{
                            fontSize: { xs: '0.6rem', sm: '0.7rem', md: '0.75rem' },
                            backgroundColor: po.paymentStatus === 'Paid' ? '#4caf50' :
                                           po.paymentStatus === 'Partially Paid' ? '#ff9800' :
                                           po.paymentStatus === 'Unpaid' ? '#f44336' : '#2196f3',
                            color: 'white',
                            height: { xs: '20px', sm: '24px' }
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ fontSize: { xs: '0.7rem', sm: '0.8rem', md: '0.875rem' }, fontWeight: 600, color: '#d32f2f', padding: { xs: '6px', sm: '12px' }, textAlign: 'right' }}>
                        Rs. {po.grandTotal ? po.grandTotal.toFixed(2) : '0.00'}
                      </TableCell>
                      <TableCell sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem', md: '0.85rem' }, color: darkMode ? '#fff' : 'inherit', padding: { xs: '6px', sm: '12px' } }}>
                        {po.items && po.items.length > 0 ? (
                          <Box>
                            {po.items.slice(0, 2).map((item, idx) => (
                              <Box key={idx} sx={{ mb: 0.5, lineHeight: 1.2 }}>
                                {item.itemCode || item.productName || 'N/A'} x{item.quantityOrdered || item.quantity || 0}
                              </Box>
                            ))}
                            {po.items.length > 2 && (
                              <Typography variant="caption" sx={{ color: darkMode ? '#aaa' : '#666', display: 'block' }}>
                                +{po.items.length - 2} more
                              </Typography>
                            )}
                          </Box>
                        ) : (
                          'No items'
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={deleteOpen}
        onClose={handleDeleteClose}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            m: { xs: 1, sm: 2 },
            borderRadius: { xs: 2, sm: 3 },
            background: darkMode
              ? 'linear-gradient(135deg, #2a2a2a 0%, #1e1e1e 100%)'
              : 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
            boxShadow: darkMode
              ? '0 20px 40px rgba(0, 0, 0, 0.5)'
              : '0 20px 40px rgba(0, 0, 0, 0.15)',
            border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'}`
          }
        }}
      >
        <DialogTitle
          sx={{
            background: darkMode
              ? 'linear-gradient(135deg, rgba(211, 47, 47, 0.1) 0%, rgba(244, 67, 54, 0.05) 100%)'
              : 'linear-gradient(135deg, rgba(211, 47, 47, 0.05) 0%, rgba(244, 67, 54, 0.02) 100%)',
            borderBottom: `2px solid ${darkMode ? '#333' : '#e0e0e0'}`,
            fontSize: { xs: '1.1rem', sm: '1.25rem', md: '1.5rem' },
            fontWeight: 600,
            color: darkMode ? '#fff' : 'inherit'
          }}
        >
          Confirm Delete
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ color: darkMode ? '#fff' : 'inherit', mt: 1 }}>
            Are you sure you want to delete the vendor <strong>{deleteVendor?.vendorName || deleteVendor?.companyName}</strong>? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: { xs: 2, sm: 3 }, flexDirection: { xs: 'column', sm: 'row' }, gap: { xs: 1, sm: 2 } }}>
          <Button
            onClick={handleDeleteClose}
            fullWidth={false}
            sx={{
              minWidth: { xs: '100%', sm: 'auto' },
              color: darkMode ? '#fff' : 'inherit'
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            variant="contained"
            color="error"
            disabled={deleteLoading}
            fullWidth={false}
            sx={{
              minWidth: { xs: '100%', sm: 'auto' },
              background: darkMode
                ? 'linear-gradient(45deg, #ef5350, #f44336)'
                : 'linear-gradient(45deg, #d32f2f, #c62828)',
              '&:hover': {
                background: darkMode
                  ? 'linear-gradient(45deg, #f44336, #e53935)'
                  : 'linear-gradient(45deg, #c62828, #b71c1c)'
              }
            }}
          >
            {deleteLoading ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ViewVendors;
