import React, { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  TextField,
  Grid,
  CircularProgress,
  Alert,
  Chip,
} from '@mui/material';
import { useDarkMode } from '../context/DarkModeContext';
import API from '../api/api';
import PrintIcon from '@mui/icons-material/Print';
import VisibilityIcon from '@mui/icons-material/Visibility';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useNavigate } from 'react-router-dom';

const AdminSellerClients = () => {
  const { darkMode } = useDarkMode();
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedSellerDetail, setSelectedSellerDetail] = useState(null);
  const [sellerClients, setSellerClients] = useState([]);
  const [sellerRefundInvoices, setSellerRefundInvoices] = useState([]);
  const [loadingSellerDetail, setLoadingSellerDetail] = useState(false);
  const navigate = useNavigate();

  const fetchSellers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Authentication token not found. Please log in.');
        return;
      }
      const res = await API.get('/users/sellers', { headers: { Authorization: `Bearer ${token}` } });
      setSellers(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      const errorMsg = e.response?.data?.message || e.message || 'Failed to fetch sellers. Please try again.';
      setError(errorMsg);
      setSellers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSellers();
  }, [fetchSellers]);

  const getFilteredSellers = useCallback(() => {
    return sellers.filter(s => {
      const queryLower = query.toLowerCase();
      const matchesSearch =
        (s.username?.toLowerCase().includes(queryLower) || false) ||
        (s.shopName?.toLowerCase().includes(queryLower) || false) ||
        (s.email?.toLowerCase().includes(queryLower) || false) ||
        (s.contact?.toLowerCase().includes(queryLower) || false);

      if (!matchesSearch) return false;

      // Apply date range filtering on createdAt
      if (startDate || endDate) {
        const sellerCreatedDate = s.createdAt ? new Date(s.createdAt) : null;
        if (!sellerCreatedDate) return false;

        if (startDate) {
          const start = new Date(startDate + 'T00:00:00');
          if (sellerCreatedDate < start) return false;
        }

        if (endDate) {
          const end = new Date(endDate + 'T23:59:59');
          if (sellerCreatedDate > end) return false;
        }
      }

      return true;
    });
  }, [sellers, query, startDate, endDate]);

  const filteredSellers = getFilteredSellers();

  const handlePrintList = async () => {
    const originalLoading = loading;
    try {
      const printContent = await generatePrintHTML();
      const printWindow = window.open('', '_blank');
      if (!printWindow || !printWindow.document) {
        alert('Popup blocked. Please allow popups to print.');
        return;
      }
      printWindow.document.write(printContent);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 250);
    } catch (e) {
      alert('Error generating print report: ' + (e.message || 'Unknown error'));
      console.error('Print error:', e);
    }
  };

  const generatePrintHTML = async () => {
    const token = localStorage.getItem('token');
    const dateRange = startDate || endDate
      ? `From: ${startDate || 'All time'} To: ${endDate || 'Now'}`
      : 'All Sellers';

    let grandTotalSales = 0;
    let sellersDataHTML = '';
    let errorLog = [];

    console.log('Starting print generation for', filteredSellers.length, 'sellers');

    // Fetch customer and sales data for each seller
    for (let seller of filteredSellers) {
      try {
        console.log(`Fetching sales for seller: ${seller.username} (${seller._id})`);
        const salesRes = await API.get(`/sales?sellerId=${seller._id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        
        const allSales = Array.isArray(salesRes.data) ? salesRes.data : [];
        console.log(`Fetched ${allSales.length} sales records for seller ${seller.username}`);
        
        // Extract unique customers from sales data
        const customersMap = {};
        allSales.forEach(sale => {
          const customerName = sale.customerName || sale.customer?.name || 'Unknown';
          const customerEmail = sale.customerEmail || sale.customer?.email || sale.customerEmailAddress || sale.customer_email || '';
          const customerContact = sale.customerContact || sale.customer?.phone || sale.customerPhone || '';
          
          if (!customersMap[customerName]) {
            customersMap[customerName] = {
              name: customerName,
              email: customerEmail,
              contact: customerContact,
              invoices: [],
            };
          }
          customersMap[customerName].invoices.push({
            totalAmount: sale.totalAmount || sale.netAmount || 0,
            netAmount: sale.netAmount || sale.totalAmount || 0,
            date: sale.date || sale.createdAt || new Date(),
          });
        });
        
        const customers = Object.values(customersMap);
        console.log(`Extracted ${customers.length} unique customers for seller ${seller.username}`);

        // Calculate seller's total sales
        const allInvoices = customers.flatMap(c => c.invoices || []);
        const sellerTotalSales = allInvoices.reduce(
          (sum, inv) => sum + Number(inv.totalAmount || inv.netAmount || 0),
          0
        );
        grandTotalSales += sellerTotalSales;

        console.log(`Seller ${seller.username}: ${allInvoices.length} invoices, Total Sales: ${sellerTotalSales}`);

        // Generate customer rows for this seller
        const customersRowsHTML = customers.length > 0 ? customers.map((cust, custIdx) => {
          const custTotal = (cust.invoices || []).reduce(
            (sum, inv) => sum + Number(inv.totalAmount || inv.netAmount || 0),
            0
          );
          return `
            <tr>
              <td style="padding: 5px; border-bottom: 1px solid #ddd; font-size: 10px;">${custIdx + 1}</td>
              <td style="padding: 5px; border-bottom: 1px solid #ddd; font-size: 10px;">${cust.name || '-'}</td>
              <td style="padding: 5px; border-bottom: 1px solid #ddd; font-size: 10px;">${cust.email || '-'}</td>
              <td style="padding: 5px; border-bottom: 1px solid #ddd; font-size: 10px;">${cust.contact || '-'}</td>
              <td style="padding: 5px; border-bottom: 1px solid #ddd; text-align: center; font-size: 10px;">${cust.invoices?.length || 0}</td>
              <td style="padding: 5px; border-bottom: 1px solid #ddd; text-align: right; font-weight: bold; font-size: 10px;">Rs. ${custTotal.toLocaleString()}</td>
            </tr>
          `;
        }).join('') : `<tr><td colspan="6" style="padding: 8px; text-align: center; color: #999; font-size: 10px;">No customers found</td></tr>`;

        // Generate seller section
        sellersDataHTML += `
          <div style="page-break-inside: avoid; margin-bottom: 10px; border: 2px solid #1976d2; padding: 8px; border-radius: 4px;">
            <h3 style="color: #1976d2; margin-top: 0; margin-bottom: 3px; border-bottom: 2px solid #ff9800; padding-bottom: 2px; font-size: 12px;">
              Seller: ${seller.username || '-'}
            </h3>
            
            <div style="background: #f0f7ff; padding: 5px; border-radius: 4px; margin-bottom: 5px;">
              <p style="margin: 1px 0; font-size: 10px;"><strong>Seller ID:</strong> ${seller._id || '-'}</p>
              <p style="margin: 1px 0; font-size: 10px;"><strong>Shop Name:</strong> ${seller.shopName || '-'}</p>
              <p style="margin: 1px 0; font-size: 10px;"><strong>Email:</strong> ${seller.email || '-'}</p>
              <p style="margin: 1px 0; font-size: 10px;"><strong>Contact:</strong> ${seller.contact || '-'}</p>
              <p style="margin: 1px 0; font-size: 10px;"><strong>Member Since:</strong> ${seller.createdAt ? new Date(seller.createdAt).toLocaleDateString() : '-'}</p>
            </div>

            <div style="background: #fff9f0; padding: 5px; border-radius: 4px; margin-bottom: 5px; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <p style="margin: 1px 0; font-size: 10px;"><strong>Total Customers:</strong> ${customers.length}</p>
                <p style="margin: 1px 0; font-size: 10px;"><strong>Total Invoices:</strong> ${allInvoices.length}</p>
              </div>
              <div style="text-align: right;">
                <p style="margin: 1px 0; font-size: 11px; font-weight: bold; color: #ff9800;">
                  Total Sales: Rs. ${sellerTotalSales.toLocaleString()}
                </p>
              </div>
            </div>

            <h4 style="color: #333; border-bottom: 1px solid #ddd; padding-bottom: 2px; margin: 3px 0 5px 0; font-size: 11px;">Customers & Sales Details</h4>
            <table style="width: 100%; border-collapse: collapse; font-size: 10px; line-height: 1.2;">
              <thead>
                <tr style="background-color: #1976d2; color: white;">
                  <th style="padding: 3px; text-align: left; font-size: 9px;">S/N</th>
                  <th style="padding: 3px; text-align: left; font-size: 9px;">Customer Name</th>
                  <th style="padding: 3px; text-align: left; font-size: 9px;">Email</th>
                  <th style="padding: 3px; text-align: left; font-size: 9px;">Contact</th>
                  <th style="padding: 3px; text-align: center; font-size: 9px;">Invoices</th>
                  <th style="padding: 3px; text-align: right; font-size: 9px;">Total Sales</th>
                </tr>
              </thead>
              <tbody>
                ${customersRowsHTML}
                <tr style="background-color: #e8f4f8; font-weight: bold; border-top: 2px solid #1976d2;">
                  <td colspan="5" style="padding: 3px; text-align: right; font-size: 10px;">SELLER TOTAL</td>
                  <td style="padding: 3px; text-align: right; font-size: 10px;">Rs. ${sellerTotalSales.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </div>
        `;
      } catch (e) {
        const errorMsg = `Error fetching data for seller ${seller.username}: ${e.message}`;
        console.error(errorMsg, e);
        errorLog.push(errorMsg);
        
        // Still generate seller section with available data
        sellersDataHTML += `
          <div style="page-break-inside: avoid; margin-bottom: 15px; border: 2px solid #ff6b6b; padding: 12px; border-radius: 4px; background: #ffe0e0;">
            <h3 style="color: #ff6b6b; margin-top: 0; border-bottom: 2px solid #ff6b6b; padding-bottom: 5px; font-size: 13px;">
              Seller: ${seller.username || '-'} (⚠ Data Load Error)
            </h3>
            
            <div style="background: #f0f7ff; padding: 8px; border-radius: 4px; margin-bottom: 8px;">
              <p style="margin: 2px 0; font-size: 11px;"><strong>Seller ID:</strong> ${seller._id || '-'}</p>
              <p style="margin: 2px 0; font-size: 11px;"><strong>Shop Name:</strong> ${seller.shopName || '-'}</p>
              <p style="margin: 2px 0; font-size: 11px;"><strong>Email:</strong> ${seller.email || '-'}</p>
              <p style="margin: 2px 0; font-size: 11px;"><strong>Contact:</strong> ${seller.contact || '-'}</p>
              <p style="margin: 2px 0; font-size: 11px;"><strong>Member Since:</strong> ${seller.createdAt ? new Date(seller.createdAt).toLocaleDateString() : '-'}</p>
            </div>
            
            <div style="background: #ffe0e0; padding: 8px; border-radius: 4px; border-left: 4px solid #ff6b6b;">
              <p style="margin: 0; font-size: 10px; color: #c71c1c;"><strong>⚠ Warning:</strong> Could not load customer data. ${e.message}</p>
            </div>
          </div>
        `;
      }
    }

    if (errorLog.length > 0) {
      console.warn('Print generation completed with errors:', errorLog);
    }

    console.log('Print generation complete. Grand total sales:', grandTotalSales);

    return `
      <html>
        <head>
          <title>Comprehensive Sellers & Customers Report</title>
          <style>
            * { margin: 0; padding: 0; }
            body { 
              font-family: 'Arial', sans-serif; 
              background: #fff; 
              color: #333; 
              padding: 5px; 
              line-height: 1.4;
              margin: 0;
            }
            .header {
              text-align: center;
              margin-bottom: 8px;
              border-bottom: 3px solid #1976d2;
              padding-bottom: 5px;
            }
            .header h1 {
              color: #1976d2;
              font-size: 20px;
              margin-bottom: 2px;
              font-weight: 800;
            }
            .header p {
              font-size: 10px;
              margin: 1px 0;
              color: #666;
            }
            .summary-section {
              background: #fff9f0;
              padding: 5px;
              border-left: 4px solid #ff9800;
              margin-bottom: 5px;
              border-radius: 4px;
            }
            .summary-section h3 {
              color: #ff9800;
              font-size: 12px;
              margin-bottom: 3px;
              margin-top: 0;
              font-weight: 700;
            }
            .summary-stat {
              display: flex;
              justify-content: space-between;
              font-size: 10px;
              margin: 2px 0;
              padding: 1px 0;
              border-bottom: 1px solid #ffe0b2;
            }
            .summary-stat .label {
              font-weight: 600;
            }
            .summary-stat .value {
              font-weight: 700;
              color: #1976d2;
            }
            h2 {
              color: #1976d2;
              font-size: 16px;
              margin-top: 20px;
              margin-bottom: 10px;
              padding-bottom: 8px;
              border-bottom: 2px solid #ddd;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 15px 0;
            }
            th {
              background-color: #1976d2;
              color: white;
              padding: 12px;
              text-align: left;
              font-weight: bold;
              font-size: 13px;
            }
            td {
              padding: 10px;
              font-size: 12px;
            }
            tr:nth-child(even) {
              background-color: #f9f9f9;
            }
            .footer {
              margin-top: 5px;
              text-align: center;
              font-size: 9px;
              color: #999;
              border-top: 1px solid #ddd;
              padding-top: 5px;
            }
            @media print {
              * { margin: 0 !important; padding: 0 !important; }
              html { margin: 0; padding: 0; }
              body { 
                margin: 0 !important; 
                padding: 5px !important;
                line-height: 1.2 !important;
              }
              .header { 
                margin: 0 0 5px 0 !important; 
                padding: 2px 0 3px 0 !important;
              }
              .summary-section { 
                margin: 0 0 5px 0 !important; 
                padding: 4px !important;
              }
              div[style*="page-break-inside"] { 
                page-break-inside: avoid !important;
                margin: 0 0 5px 0 !important;
                padding: 5px !important;
              }
              .footer { 
                margin: 5px 0 0 0 !important; 
                padding: 3px 0 0 0 !important;
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Comprehensive Sellers & Customers Report</h1>
            <p>Generated: ${new Date().toLocaleString()}</p>
            <p><strong>Date Range:</strong> ${dateRange}</p>
          </div>

          <div class="summary-section">
            <h3>Report Summary</h3>
            <div class="summary-stat">
              <span class="label">Total Sellers:</span>
              <span class="value">${filteredSellers.length}</span>
            </div>
            <div class="summary-stat">
              <span class="label">Total Sales Amount (All Sellers):</span>
              <span class="value">Rs. ${grandTotalSales.toLocaleString()}</span>
            </div>
          </div>

          ${sellersDataHTML}

          <div class="footer">
            <p>This is an automated comprehensive report of all sellers and their customers with sales details. For any discrepancies, please verify with the administration.</p>
          </div>
        </body>
      </html>
    `;
  };

  const openSellerClients = (seller) => {
    if (!seller || !seller._id) {
      alert('Invalid seller. Please ensure the seller has a valid ID.');
      console.error('Invalid seller object:', seller);
      return;
    }
    console.log('Navigating to seller clients:', { sellerId: seller._id, seller });
    navigate(`/admin/seller-clients/${seller._id}`);
  };

  // Fetch all clients and refunds for a specific seller
  const fetchSellerDetails = useCallback(async (seller) => {
    setLoadingSellerDetail(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Authentication token not found. Please log in.');
        return;
      }

      // Fetch all sales for this seller
      const salesRes = await API.get(`/sales?sellerId=${seller._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const allSales = Array.isArray(salesRes.data) ? salesRes.data : [];

      // Extract unique customers
      const customersMap = {};
      const refundInvoicesList = [];

      allSales.forEach(sale => {
        const customerName = sale.customerName || sale.customer?.name || 'Unknown';
        const customerEmail = sale.customerEmail || sale.customer?.email || '';
        const customerContact = sale.customerContact || sale.customer?.phone || '';

        if (!customersMap[customerName]) {
          customersMap[customerName] = {
            name: customerName,
            email: customerEmail,
            contact: customerContact,
            invoices: [],
          };
        }
        customersMap[customerName].invoices.push(sale);

        // Collect refund invoices
        if (sale.refunds && sale.refunds.length > 0) {
          refundInvoicesList.push({
            ...sale,
            invoiceNumber: sale.invoiceNumber || (sale._id ? sale._id.toString().slice(-6) : '-'),
            customerName,
            customerEmail,
            customerContact,
          });
        }
      });

      setSellerClients(Object.values(customersMap));
      setSellerRefundInvoices(refundInvoicesList);
      setSelectedSellerDetail(seller);
    } catch (e) {
      const errorMsg = e.response?.data?.message || e.message || 'Failed to fetch seller details.';
      setError(errorMsg);
      setSellerClients([]);
      setSellerRefundInvoices([]);
    } finally {
      setLoadingSellerDetail(false);
    }
  }, []);

  const handlePrintAllSellerClients = () => {
    if (!selectedSellerDetail || sellerClients.length === 0) {
      alert('No client data available to print.');
      return;
    }

    const seller = selectedSellerDetail;
    const allInvoices = sellerClients.flatMap(c => c.invoices || []);
    const grandTotal = allInvoices.reduce((sum, inv) => sum + Number(inv.totalAmount || inv.netAmount || 0), 0);

    const customersRowsHTML = sellerClients.map((cust, custIdx) => {
      const custTotal = (cust.invoices || []).reduce((sum, inv) => sum + Number(inv.totalAmount || inv.netAmount || 0), 0);
      return `
        <tr>
          <td style="padding: 5px; border-bottom: 1px solid #ddd; font-size: 10px;">${custIdx + 1}</td>
          <td style="padding: 5px; border-bottom: 1px solid #ddd; font-size: 10px;">${cust.name || '-'}</td>
          <td style="padding: 5px; border-bottom: 1px solid #ddd; font-size: 10px;">${cust.email || '-'}</td>
          <td style="padding: 5px; border-bottom: 1px solid #ddd; font-size: 10px;">${cust.contact || '-'}</td>
          <td style="padding: 5px; border-bottom: 1px solid #ddd; text-align: center; font-size: 10px;">${cust.invoices?.length || 0}</td>
          <td style="padding: 5px; border-bottom: 1px solid #ddd; text-align: right; font-weight: bold; font-size: 10px;">Rs. ${custTotal.toLocaleString()}</td>
        </tr>
      `;
    }).join('');

    // Generate refund invoices table
    const refundRowsHTML = sellerRefundInvoices.map((inv, idx) => {
      const totalRefundAmount = (inv.refunds || []).reduce((sum, r) => sum + (r.totalRefundAmount || 0), 0);
      const refundDetails = (inv.refunds || []).map(ref => {
        const items = (ref.items || []).map(i => i.productName || i.SKU || 'Item').join(', ');
        return `${ref.createdAt ? new Date(ref.createdAt).toLocaleDateString() : '-'}: ${items} (${ref.totalRefundQty || 0} pcs)`;
      }).join('<br/>');
      return `
        <tr>
          <td style="padding: 5px; border-bottom: 1px solid #ddd; font-size: 10px;">${idx + 1}</td>
          <td style="padding: 5px; border-bottom: 1px solid #ddd; font-size: 10px;">${inv.invoiceNumber}</td>
          <td style="padding: 5px; border-bottom: 1px solid #ddd; font-size: 10px;">${new Date(inv.createdAt).toLocaleDateString()}</td>
          <td style="padding: 5px; border-bottom: 1px solid #ddd; font-size: 10px;">${inv.customerName}</td>
          <td style="padding: 5px; border-bottom: 1px solid #ddd; font-size: 9px;">${refundDetails}</td>
          <td style="padding: 5px; border-bottom: 1px solid #ddd; text-align: right; font-weight: bold; font-size: 10px;">Rs. ${totalRefundAmount.toLocaleString()}</td>
        </tr>
      `;
    }).join('');

    const html = `
      <html>
        <head>
          <title>${seller.username} - Clients & Refunds Report</title>
          <style>
            * { margin: 0; padding: 0; }
            body { 
              font-family: 'Arial', sans-serif; 
              background: #fff; 
              color: #333; 
              padding: 5px; 
              line-height: 1.4;
            }
            .header {
              text-align: center;
              margin-bottom: 8px;
              border-bottom: 3px solid #1976d2;
              padding-bottom: 5px;
            }
            .header h1 {
              color: #1976d2;
              font-size: 20px;
              margin-bottom: 2px;
              font-weight: 800;
            }
            .header p {
              font-size: 10px;
              margin: 1px 0;
              color: #666;
            }
            .seller-section {
              background: #f0f7ff;
              padding: 5px;
              border-left: 4px solid #1976d2;
              margin-bottom: 5px;
              border-radius: 4px;
            }
            .seller-section h3 {
              color: #1976d2;
              font-size: 11px;
              margin-bottom: 3px;
              margin-top: 0;
              font-weight: 700;
            }
            .seller-section p {
              margin: 1px 0;
              font-size: 9px;
              color: #555;
            }
            .summary-section {
              background: #fff9f0;
              padding: 5px;
              border-left: 4px solid #ff9800;
              margin-bottom: 5px;
              border-radius: 4px;
            }
            .summary-section h3 {
              color: #ff9800;
              font-size: 11px;
              margin-bottom: 3px;
              margin-top: 0;
              font-weight: 700;
            }
            .summary-stat {
              display: flex;
              justify-content: space-between;
              font-size: 9px;
              margin: 1px 0;
              padding: 1px 0;
              border-bottom: 1px solid #ffe0b2;
            }
            .summary-stat .label {
              font-weight: 600;
            }
            .summary-stat .value {
              font-weight: 700;
              color: #1976d2;
            }
            h2 {
              color: #1976d2;
              font-size: 13px;
              margin-top: 10px;
              margin-bottom: 5px;
              padding-bottom: 3px;
              border-bottom: 2px solid #ddd;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 5px 0;
              font-size: 9px;
            }
            th {
              background-color: #1976d2;
              color: white;
              padding: 3px;
              text-align: left;
              font-weight: bold;
              font-size: 8px;
            }
            td {
              padding: 3px;
              font-size: 8px;
            }
            tr:nth-child(even) {
              background-color: #f9f9f9;
            }
            .total-row {
              background-color: #e8f4f8;
              font-weight: bold;
            }
            .total-row td {
              padding: 3px;
              border-top: 1px solid #1976d2;
            }
            .footer {
              margin-top: 5px;
              text-align: center;
              font-size: 8px;
              color: #999;
              border-top: 1px solid #ddd;
              padding-top: 3px;
            }
            @media print {
              * { margin: 0 !important; padding: 0 !important; }
              body { padding: 2px !important; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>All Seller Clients & Refunds Report</h1>
            <p>Generated: ${new Date().toLocaleString()}</p>
          </div>

          <div class="seller-section">
            <h3>Seller Information</h3>
            <p><strong>Seller ID:</strong> ${seller._id}</p>
            <p><strong>Seller Name:</strong> ${seller.username || '-'}</p>
            <p><strong>Shop Name:</strong> ${seller.shopName || '-'}</p>
            <p><strong>Email:</strong> ${seller.email || '-'}</p>
            <p><strong>Contact:</strong> ${seller.contact || '-'}</p>
          </div>

          <div class="summary-section">
            <h3>Sales Summary</h3>
            <div class="summary-stat">
              <span class="label">Total Customers:</span>
              <span class="value">${sellerClients.length}</span>
            </div>
            <div class="summary-stat">
              <span class="label">Total Invoices:</span>
              <span class="value">${allInvoices.length}</span>
            </div>
            <div class="summary-stat">
              <span class="label">Total Sales:</span>
              <span class="value">Rs. ${grandTotal.toLocaleString()}</span>
            </div>
            <div class="summary-stat">
              <span class="label">Total Refund Invoices:</span>
              <span class="value">${sellerRefundInvoices.length}</span>
            </div>
          </div>

          <h2>Customer Details & Sales</h2>
          <table>
            <thead>
              <tr>
                <th style="width:5%">S/N</th>
                <th style="width:25%">Customer Name</th>
                <th style="width:25%">Email</th>
                <th style="width:20%">Contact</th>
                <th style="width:10%;text-align:center;">Invoices</th>
                <th style="width:15%;text-align:right;">Total Sales</th>
              </tr>
            </thead>
            <tbody>
              ${customersRowsHTML}
              <tr class="total-row">
                <td colspan="5" style="text-align:right;padding:3px;">SELLER TOTAL</td>
                <td style="text-align:right;padding:3px;">Rs. ${grandTotal.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>

          ${sellerRefundInvoices.length > 0 ? `
          <h2>Refund Invoices</h2>
          <table>
            <thead>
              <tr>
                <th style="width:5%">S/N</th>
                <th style="width:10%">Invoice #</th>
                <th style="width:10%">Date</th>
                <th style="width:20%">Customer</th>
                <th style="width:40%">Refund Details</th>
                <th style="width:15%;text-align:right;">Refund Amount</th>
              </tr>
            </thead>
            <tbody>
              ${refundRowsHTML}
              <tr class="total-row">
                <td colspan="5" style="text-align:right;padding:3px;">TOTAL REFUNDED</td>
                <td style="text-align:right;padding:3px;">Rs. ${sellerRefundInvoices.reduce((sum, inv) => sum + (inv.refunds || []).reduce((s, r) => s + (r.totalRefundAmount || 0), 0), 0).toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
          ` : ''}

          <div class="footer">
            <p>This is an automated seller clients and refunds report. For any discrepancies, please verify with the administration.</p>
          </div>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (!printWindow || !printWindow.document) {
      alert('Popup blocked. Please allow popups to print.');
      return;
    }
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 250);
  };

  const handleClearFilters = () => {
    setQuery('');
    setStartDate('');
    setEndDate('');
  };

  return (
    <Box
      sx={{
        mt: 2,
        width: '100%',
        backgroundColor: darkMode ? '#121212' : '#fafafa',
        minHeight: '100vh',
        p: 2,
      }}
    >
      <Typography variant="h4" align="center" sx={{ mb: 3, fontWeight: 600, color: darkMode ? '#fff' : '#333' }}>
        Seller Clients Management
      </Typography>

      {/* Filters Paper */}
      <Paper
        elevation={3}
        sx={{
          p: 3,
          mb: 3,
          backgroundColor: darkMode ? '#1e1e1e' : '#fff',
          borderRadius: 2,
          border: darkMode ? '1px solid #333' : 'none',
        }}
      >
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              label="Search (Name, Shop, Email)"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Type to search..."
              variant="outlined"
              size="small"
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: darkMode ? '#2a2a2a' : '#f9f9f9',
                  '&:hover fieldset': { borderColor: '#1976d2' },
                },
              }}
            />
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <TextField
              fullWidth
              type="date"
              label="Start Date"
              InputLabelProps={{ shrink: true }}
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              variant="outlined"
              size="small"
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: darkMode ? '#2a2a2a' : '#f9f9f9',
                },
              }}
            />
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <TextField
              fullWidth
              type="date"
              label="End Date"
              InputLabelProps={{ shrink: true }}
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              variant="outlined"
              size="small"
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: darkMode ? '#2a2a2a' : '#f9f9f9',
                },
              }}
            />
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <Button
              fullWidth
              variant="outlined"
              size="small"
              onClick={handleClearFilters}
              sx={{ height: '40px' }}
            >
              Clear
            </Button>
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <Button
              fullWidth
              variant="contained"
              color="primary"
              startIcon={<PrintIcon />}
              onClick={handlePrintList}
              disabled={filteredSellers.length === 0}
              sx={{ height: '40px' }}
            >
              Print
            </Button>
          </Grid>

          <Grid item xs={12} sm={6} md={1}>
            <Button
              fullWidth
              variant="outlined"
              size="small"
              startIcon={<RefreshIcon />}
              onClick={fetchSellers}
              disabled={loading}
              sx={{ height: '40px' }}
            >
              Refresh
            </Button>
          </Grid>
        </Grid>

        {(query || startDate || endDate) && (
          <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {query && <Chip label={`Search: ${query}`} onDelete={() => setQuery('')} size="small" />}
            {startDate && <Chip label={`From: ${startDate}`} onDelete={() => setStartDate('')} size="small" />}
            {endDate && <Chip label={`To: ${endDate}`} onDelete={() => setEndDate('')} size="small" />}
          </Box>
        )}
      </Paper>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Loading State */}
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
          <CircularProgress />
        </Box>
      )}

      {/* Data Table */}
      {!loading && (
        <Paper
          elevation={3}
          sx={{
            backgroundColor: darkMode ? '#1e1e1e' : '#fff',
            borderRadius: 2,
            border: darkMode ? '1px solid #333' : 'none',
            overflow: 'hidden',
          }}
        >
          {filteredSellers.length === 0 ? (
            <Box
              sx={{
                p: 4,
                textAlign: 'center',
                backgroundColor: darkMode ? '#1e1e1e' : '#fafafa',
              }}
            >
              <Typography variant="h6" color="textSecondary" sx={{ mb: 1 }}>
                No sellers found
              </Typography>
              <Typography variant="body2" color="textSecondary">
                {sellers.length === 0 ? 'No sellers available.' : 'Try adjusting your search filters.'}
              </Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: darkMode ? '#2a2a2a' : '#f5f5f5', borderBottom: '2px solid #1976d2' }}>
                    <TableCell sx={{ fontWeight: 600, color: darkMode ? '#fff' : '#333' }}>S/N</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: darkMode ? '#fff' : '#333' }}>Seller Name</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: darkMode ? '#fff' : '#333' }}>Shop Name</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: darkMode ? '#fff' : '#333' }}>Contact</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: darkMode ? '#fff' : '#333' }}>Created Date</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: darkMode ? '#fff' : '#333', textAlign: 'center' }}>
                      Actions
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredSellers.map((seller, idx) => (
                    <TableRow
                      key={seller._id}
                      sx={{
                        '&:hover': {
                          backgroundColor: darkMode ? '#2a2a2a' : '#f9f9f9',
                          cursor: 'pointer',
                          transition: 'background-color 0.2s ease',
                        },
                        backgroundColor: darkMode ? '#1e1e1e' : '#fff',
                        borderBottom: `1px solid ${darkMode ? '#333' : '#e0e0e0'}`,
                      }}
                    >
                      <TableCell sx={{ color: darkMode ? '#fff' : '#333', fontWeight: 500 }}>
                        {idx + 1}
                      </TableCell>
                      <TableCell sx={{ color: darkMode ? '#fff' : '#333' }}>
                        {seller.username || '-'}
                      </TableCell>
                      <TableCell sx={{ color: darkMode ? '#fff' : '#333' }}>
                        {seller.shopName ? (
                          <Chip label={seller.shopName} size="small" variant="outlined" />
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell sx={{ color: darkMode ? '#fff' : '#333' }}>
                        {seller.contact || seller.email || '-'}
                      </TableCell>
                      <TableCell sx={{ color: darkMode ? '#fff' : '#666', fontSize: '0.875rem' }}>
                        {seller.createdAt ? new Date(seller.createdAt).toLocaleDateString() : '-'}
                      </TableCell>
                      <TableCell sx={{ textAlign: 'center', display: 'flex', gap: 1, justifyContent: 'center' }}>
                        <Button
                          size="small"
                          variant="outlined"
                          color="secondary"
                          startIcon={<PrintIcon />}
                          onClick={() => fetchSellerDetails(seller)}
                          sx={{
                            textTransform: 'none',
                            borderRadius: 1,
                          }}
                        >
                          All Clients
                        </Button>
                        <Button
                          size="small"
                          variant="contained"
                          color="primary"
                          startIcon={<VisibilityIcon />}
                          onClick={() => openSellerClients(seller)}
                          sx={{
                            textTransform: 'none',
                            borderRadius: 1,
                            '&:hover': { boxShadow: 2 },
                          }}
                        >
                          View Clients
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {/* Footer with Summary */}
          {filteredSellers.length > 0 && (
            <Box
              sx={{
                p: 2,
                backgroundColor: darkMode ? '#2a2a2a' : '#f5f5f5',
                borderTop: `1px solid ${darkMode ? '#333' : '#e0e0e0'}`,
                textAlign: 'right',
              }}
            >
              <Typography variant="body2" color="textSecondary">
                Showing <strong>{filteredSellers.length}</strong> of <strong>{sellers.length}</strong> sellers
              </Typography>
            </Box>
          )}
        </Paper>
      )}

      {/* Seller Details Modal */}
      {selectedSellerDetail && (
        <Paper
          elevation={6}
          sx={{
            p: 3,
            mb: 3,
            backgroundColor: darkMode ? '#1e1e1e' : '#fff',
            borderRadius: 2,
            border: darkMode ? '1px solid #333' : 'none',
            marginTop: 3,
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h5" sx={{ color: darkMode ? '#fff' : '#333', fontWeight: 600 }}>
              {selectedSellerDetail.username} - All Clients & Refunds
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="contained"
                color="primary"
                startIcon={<PrintIcon />}
                onClick={handlePrintAllSellerClients}
                disabled={sellerClients.length === 0}
                sx={{ textTransform: 'none', borderRadius: 1 }}
              >
                Print Report
              </Button>
              <Button
                variant="outlined"
                onClick={() => {
                  setSelectedSellerDetail(null);
                  setSellerClients([]);
                  setSellerRefundInvoices([]);
                }}
                sx={{ textTransform: 'none', borderRadius: 1 }}
              >
                Close
              </Button>
            </Box>
          </Box>

          {/* Seller Info */}
          <Paper sx={{ p: 2, mb: 2, backgroundColor: darkMode ? '#2a2a2a' : '#f0f7ff', borderLeft: '4px solid #1976d2' }}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="caption" sx={{ color: darkMode ? '#ddd' : '#666', fontWeight: 600 }}>
                  Seller Name
                </Typography>
                <Typography variant="body2" sx={{ color: darkMode ? '#fff' : '#333' }}>
                  {selectedSellerDetail.username || '-'}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="caption" sx={{ color: darkMode ? '#ddd' : '#666', fontWeight: 600 }}>
                  Shop Name
                </Typography>
                <Typography variant="body2" sx={{ color: darkMode ? '#fff' : '#333' }}>
                  {selectedSellerDetail.shopName || '-'}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="caption" sx={{ color: darkMode ? '#ddd' : '#666', fontWeight: 600 }}>
                  Email
                </Typography>
                <Typography variant="body2" sx={{ color: darkMode ? '#fff' : '#333' }}>
                  {selectedSellerDetail.email || '-'}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="caption" sx={{ color: darkMode ? '#ddd' : '#666', fontWeight: 600 }}>
                  Contact
                </Typography>
                <Typography variant="body2" sx={{ color: darkMode ? '#fff' : '#333' }}>
                  {selectedSellerDetail.contact || '-'}
                </Typography>
              </Grid>
            </Grid>
          </Paper>

          {loadingSellerDetail ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              {/* Clients Table */}
              {sellerClients.length > 0 && (
                <>
                  <Typography variant="h6" sx={{ mb: 2, color: darkMode ? '#fff' : '#333', fontWeight: 600 }}>
                    Customers ({sellerClients.length})
                  </Typography>
                  <TableContainer sx={{ mb: 3 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: darkMode ? '#2a2a2a' : '#f5f5f5' }}>
                          <TableCell sx={{ fontWeight: 600, color: darkMode ? '#fff' : '#333' }}>S/N</TableCell>
                          <TableCell sx={{ fontWeight: 600, color: darkMode ? '#fff' : '#333' }}>Name</TableCell>
                          <TableCell sx={{ fontWeight: 600, color: darkMode ? '#fff' : '#333' }}>Email</TableCell>
                          <TableCell sx={{ fontWeight: 600, color: darkMode ? '#fff' : '#333' }}>Contact</TableCell>
                          <TableCell align="center" sx={{ fontWeight: 600, color: darkMode ? '#fff' : '#333' }}>Invoices</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600, color: darkMode ? '#fff' : '#333' }}>Total Sales</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {sellerClients.map((cust, idx) => {
                          const custTotal = (cust.invoices || []).reduce((sum, inv) => sum + Number(inv.totalAmount || inv.netAmount || 0), 0);
                          return (
                            <TableRow
                              key={idx}
                              sx={{
                                '&:hover': {
                                  backgroundColor: darkMode ? '#2a2a2a' : '#f9f9f9',
                                  transition: 'background-color 0.2s ease',
                                },
                                backgroundColor: darkMode ? '#1e1e1e' : '#fff',
                                borderBottom: `1px solid ${darkMode ? '#333' : '#e0e0e0'}`,
                              }}
                            >
                              <TableCell sx={{ color: darkMode ? '#fff' : '#333', fontWeight: 500 }}>
                                {idx + 1}
                              </TableCell>
                              <TableCell sx={{ color: darkMode ? '#fff' : '#333' }}>
                                {cust.name || '-'}
                              </TableCell>
                              <TableCell sx={{ color: darkMode ? '#fff' : '#333' }}>
                                {cust.email || '-'}
                              </TableCell>
                              <TableCell sx={{ color: darkMode ? '#fff' : '#333' }}>
                                {cust.contact || '-'}
                              </TableCell>
                              <TableCell align="center" sx={{ color: darkMode ? '#fff' : '#333' }}>
                                {cust.invoices?.length || 0}
                              </TableCell>
                              <TableCell align="right" sx={{ color: darkMode ? '#fff' : '#333', fontWeight: 500 }}>
                                Rs. {custTotal.toLocaleString()}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                        <TableRow sx={{ bgcolor: darkMode ? '#2a2a2a' : '#f5f5f5', fontWeight: 'bold' }}>
                          <TableCell colSpan={5} sx={{ fontWeight: 600 }}>
                            TOTAL
                          </TableCell>
                          <TableCell align="right" sx={{ color: darkMode ? '#fff' : '#333', fontWeight: 600 }}>
                            Rs. {sellerClients.reduce((sum, c) => sum + (c.invoices || []).reduce((s, inv) => s + Number(inv.totalAmount || inv.netAmount || 0), 0), 0).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TableContainer>
                </>
              )}

              {/* Refund Invoices Table */}
              {sellerRefundInvoices.length > 0 && (
                <>
                  <Typography variant="h6" sx={{ mb: 2, color: darkMode ? '#fff' : '#333', fontWeight: 600 }}>
                    Refund Invoices ({sellerRefundInvoices.length})
                  </Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: darkMode ? '#2a2a2a' : '#f5f5f5' }}>
                          <TableCell sx={{ fontWeight: 600, color: darkMode ? '#fff' : '#333' }}>S/N</TableCell>
                          <TableCell sx={{ fontWeight: 600, color: darkMode ? '#fff' : '#333' }}>Invoice #</TableCell>
                          <TableCell sx={{ fontWeight: 600, color: darkMode ? '#fff' : '#333' }}>Date</TableCell>
                          <TableCell sx={{ fontWeight: 600, color: darkMode ? '#fff' : '#333' }}>Customer</TableCell>
                          <TableCell sx={{ fontWeight: 600, color: darkMode ? '#fff' : '#333' }}>Refund Details</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600, color: darkMode ? '#fff' : '#333' }}>Refund Amount</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {sellerRefundInvoices.map((inv, idx) => {
                          const totalRefundAmount = (inv.refunds || []).reduce((sum, r) => sum + (r.totalRefundAmount || 0), 0);
                          return (
                            <TableRow
                              key={idx}
                              sx={{
                                '&:hover': {
                                  backgroundColor: darkMode ? '#2a2a2a' : '#f9f9f9',
                                  transition: 'background-color 0.2s ease',
                                },
                                backgroundColor: darkMode ? '#1e1e1e' : '#fff',
                                borderBottom: `1px solid ${darkMode ? '#333' : '#e0e0e0'}`,
                              }}
                            >
                              <TableCell sx={{ color: darkMode ? '#fff' : '#333', fontWeight: 500 }}>
                                {idx + 1}
                              </TableCell>
                              <TableCell sx={{ color: darkMode ? '#fff' : '#333' }}>
                                {inv.invoiceNumber || '-'}
                              </TableCell>
                              <TableCell sx={{ color: darkMode ? '#fff' : '#333' }}>
                                {new Date(inv.createdAt).toLocaleDateString()}
                              </TableCell>
                              <TableCell sx={{ color: darkMode ? '#fff' : '#333' }}>
                                {inv.customerName || '-'}
                              </TableCell>
                              <TableCell sx={{ color: darkMode ? '#fff' : '#333', fontSize: '0.85rem' }}>
                                {(inv.refunds || []).map((ref, ridx) => (
                                  <Box key={ridx} sx={{ mb: 0.5 }}>
                                    <Typography variant="caption" sx={{ display: 'block', fontWeight: 600 }}>
                                      {ref.createdAt ? new Date(ref.createdAt).toLocaleDateString() : '-'}
                                    </Typography>
                                    <Typography variant="caption" sx={{ display: 'block' }}>
                                      {(ref.items || []).map(i => i.productName || i.SKU || 'Item').join(', ')} ({ref.totalRefundQty || 0} pcs)
                                    </Typography>
                                  </Box>
                                ))}
                              </TableCell>
                              <TableCell align="right" sx={{ color: darkMode ? '#fff' : '#333', fontWeight: 500 }}>
                                Rs. {totalRefundAmount.toLocaleString()}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                        <TableRow sx={{ bgcolor: darkMode ? '#2a2a2a' : '#f5f5f5', fontWeight: 'bold' }}>
                          <TableCell colSpan={5} sx={{ fontWeight: 600 }}>
                            TOTAL REFUNDED
                          </TableCell>
                          <TableCell align="right" sx={{ color: darkMode ? '#fff' : '#333', fontWeight: 600 }}>
                            Rs. {sellerRefundInvoices.reduce((sum, inv) => sum + (inv.refunds || []).reduce((s, r) => s + (r.totalRefundAmount || 0), 0), 0).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TableContainer>
                </>
              )}

              {sellerClients.length === 0 && sellerRefundInvoices.length === 0 && (
                <Box sx={{ p: 3, textAlign: 'center' }}>
                  <Typography variant="body2" color="textSecondary">
                    No customers or refund invoices found for this seller.
                  </Typography>
                </Box>
              )}
            </>
          )}
        </Paper>
      )}
    </Box>
  );
};

export default AdminSellerClients;
