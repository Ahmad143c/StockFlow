import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  Fade,
  TableHead,
  TableRow,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  InputAdornment,
  MenuItem,
  Select,
  InputLabel,
  FormControl,
  Divider,
  Grid,
  Chip,
  Avatar,
  Card,
  CardContent,
  CircularProgress,
  Stack,
  Alert,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useDarkMode } from '../context/DarkModeContext';

// Icons
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import SearchIcon from '@mui/icons-material/Search';
import PrintIcon from '@mui/icons-material/Print';
import CategoryIcon from '@mui/icons-material/Category';
import BrandingWatermarkIcon from '@mui/icons-material/BrandingWatermark';
import ColorLensIcon from '@mui/icons-material/ColorLens';
import InventoryIcon from '@mui/icons-material/Inventory';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import StorefrontIcon from '@mui/icons-material/Storefront';
import QrCodeIcon from '@mui/icons-material/QrCode';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CloseIcon from '@mui/icons-material/Close';

import jsPDF from 'jspdf';
import API from '../api/api';

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_UOM = ['pieces', 'boxes', 'kg', 'liters'];
const DEFAULT_STATUS = ['Pending', 'Approved', 'Received', 'Partially Received', 'Cancelled'];
const PAYMENT_TERMS_OPTIONS = ['Net 30', 'Net 60', 'COD', 'Advance Payment', 'Partial Payment', 'Cash Payment'];
const PAYMENT_METHOD_OPTIONS = ['Bank Transfer', 'Cheque', 'Cash Payment'];
const DEFAULT_DELIVERY_METHODS = ['Courier', 'In-house transport'];
const DEFAULT_PURCHASE_TYPES = ['Local', 'International'];
const DEFAULT_CURRENCY = ['PKR', 'DOLLAR', 'YAN'];

const DEFAULT_CATEGORIES = [
  'Electronics',
  'Clothing',
  'Home Appliances',
  'Books',
  'Other',
];

const ROWS_PER_PAGE = 10;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatDateTimeForInput = (dateTime) => {
  if (!dateTime) return '';
  try {
    const date = new Date(dateTime);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch {
    return '';
  }
};

const convertToISOString = (dateTimeStr) => {
  if (!dateTimeStr) return '';
  try {
    return new Date(dateTimeStr).toISOString();
  } catch {
    return '';
  }
};

const calculateDueDate = (paymentTerms, poDate) => {
  if (!poDate || !['Net 30', 'Net 60'].includes(paymentTerms)) return '';
  const date = new Date(poDate);
  date.setDate(date.getDate() + (paymentTerms === 'Net 30' ? 30 : 60));
  return date.toISOString().split('T')[0];
};

const getStatusColor = (status) => {
  switch (status?.toLowerCase()) {
    case 'approved':           return '#2e7d32';
    case 'pending':            return '#fb8c00';
    case 'cancelled':          return '#c62828';
    case 'received':           return '#2e7d32';
    case 'partially received': return '#ff9800';
    default:                   return '#1e88e5';
  }
};

const hexToRgb = (hex) => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

const formatDateTimeCell = (dateStr) => {
  if (!dateStr) return '-';
  return (
    <Box sx={{ fontSize: '0.75rem' }}>
      <Box>{new Date(dateStr).toLocaleDateString()}</Box>
      <Box sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
        {new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </Box>
    </Box>
  );
};

/** Sort list so the most recently dated PO appears first. */
const sortByMostRecent = (list) =>
  [...list].sort((a, b) => {
    const da = a.poDate ? new Date(a.poDate).getTime() : 0;
    const db = b.poDate ? new Date(b.poDate).getTime() : 0;
    if (db !== da) return db - da;
    // Tie-break by _id (MongoDB ObjectId encodes creation time)
    return (b._id || '').localeCompare(a._id || '');
  });

// ─── Empty form state for Add Product dialog ──────────────────────────────────

const EMPTY_PRODUCT_FORM = {
  name: '',
  category: '',
  subCategory: '',
  brand: '',
  vendor: '',
  color: '',
  costPerPiece: '',
  sellingPerPiece: '',
  piecesPerCarton: '',
  SKU: '',
  image: '',
  warrantyMonths: '12',
  warehouseAddress: '',
};

// ─── Additional Helpers ───────────────────────────────────────────────────────

const generateSKU = (name = '') => {
  const prefix = (String(name).trim().slice(0, 3) || 'PRD')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  const randomPart = Math.random().toString(36).slice(2, 7).toUpperCase();
  const timestamp = Date.now().toString().slice(-6);
  return `${prefix}-${randomPart}-${timestamp}`;
};

// ─── PDF Generator ────────────────────────────────────────────────────────────

const generatePDF = (order) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // ── Reusable table header drawer ──
  const drawTableHeader = (yPosition) => {
    const tableWidth = pageWidth - 28;
    doc.setFillColor(15, 37, 110);
    doc.roundedRect(14, yPosition, tableWidth, 10, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('S/N',        18,              yPosition + 6);
    doc.text('ITEM',       28,              yPosition + 6);
    doc.text('DESCRIPTION',50,              yPosition + 6);
    doc.text('CO',         87,              yPosition + 6);
    doc.text('QTY',        115,             yPosition + 6, { align: 'right' });
    doc.text('UNIT PRICE', 145,             yPosition + 6, { align: 'right' });
    doc.text('TOTAL',      pageWidth - 17,  yPosition + 6, { align: 'right' });
    return yPosition + 15;
  };

  // ── Reusable footer drawer ──
  const drawFooter = () => {
    const footerY = pageHeight - 18;
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.line(14, footerY - 1, pageWidth - 14, footerY - 1);

    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.setFont('helvetica', 'italic');
    doc.text('Thank you for your business!', pageWidth / 2, footerY + 4, { align: 'center' });

    const genTime = `${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.text(`Generated: ${genTime}`, 14, footerY + 10);
  };

  // ── Page header ──
  doc.setFillColor(15, 37, 110);
  doc.rect(0, 0, pageWidth, 25, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('PURCHASE ORDER', pageWidth / 2, 15, { align: 'center' });
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.3);
  doc.line(14, 19, pageWidth - 14, 19);

  // ── Company info box ──
  doc.setFillColor(245, 248, 255);
  doc.roundedRect(14, 32, 85, 42, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 37, 110);
  doc.text('NEW ADIL ELECTRIC CONCERN', 17, 40);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(70, 70, 70);
  doc.text('4-B, Jamiat Center, Sha Alam Market', 17, 47);
  doc.text('Lahore, Pakistan',           17, 52);
  doc.text('Phone: (042) 123-4567',      17, 57);
  doc.text('Email: info@adilelectric.com', 17, 62);

  // ── PO info box ──
  doc.setFillColor(250, 250, 250);
  doc.roundedRect(pageWidth - 90, 32, 80, 42, 2, 2, 'FD');
  doc.setDrawColor(200, 200, 200);
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text('PO NUMBER', pageWidth - 85, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 37, 110);
  doc.text(order.poNumber || 'N/A', pageWidth - 17, 42, { align: 'right' });

  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text('PO DATE', pageWidth - 85, 50);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text(order.poDate?.slice(0, 10) || 'N/A', pageWidth - 17, 50, { align: 'right' });

  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text('PO STATUS', pageWidth - 85, 58);

  // Status badge
  const statusColor = getStatusColor(order.orderStatus);
  const [r, g, b] = hexToRgb(statusColor);
  const statusText = (order.orderStatus || 'PENDING').toUpperCase();
  const statusWidth = Math.max(35, doc.getTextWidth(statusText) + 12);
  doc.setFillColor(r, g, b);
  doc.roundedRect(pageWidth - 17 - statusWidth, 56, statusWidth, 8, 2, 2, 'F');
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.3);
  doc.roundedRect(pageWidth - 17 - statusWidth, 56, statusWidth, 8, 2, 2, 'D');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text(statusText, pageWidth - 17 - statusWidth / 2, 61, { align: 'center' });

  // ── Vendor & Ship To sections ──
  const sectionY = 82;
  const sectionWidth = (pageWidth - 28 - 4) / 2;
  const sectionGap = 4;

  const drawInfoSection = (x, label, name, phone, email, address) => {
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(x, sectionY, sectionWidth, 38, 2, 2, 'FD');
    doc.setDrawColor(15, 37, 110);
    doc.setLineWidth(0.3);
    doc.line(x, sectionY + 9, x + sectionWidth, sectionY + 9);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 37, 110);
    doc.text(label, x + 3, sectionY + 7);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.text(name || 'N/A', x + 3, sectionY + 14);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(`Phone: ${phone || 'N/A'}`,   x + 3, sectionY + 19);
    doc.text(`Email: ${email || 'N/A'}`,   x + 3, sectionY + 24);
    doc.text(`Address: ${address || 'N/A'}`, x + 3, sectionY + 29, { maxWidth: sectionWidth - 6 });
  };

  drawInfoSection(14,                            'VENDOR',   order.vendorName,  order.vendorPhone,  order.vendorEmail,  order.vendorAddress);
  drawInfoSection(14 + sectionWidth + sectionGap, 'SHIP TO', order.shipToName, order.shipToPhone, order.shipToEmail, order.shipToAddress);

  // ── Items table ──
  let currentY = drawTableHeader(128);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  const baseRowHeight = 10;
  const minRowHeight  = 8;

  if (order.items?.length > 0) {
    order.items.forEach((item, index) => {
      try {
        const desc = item.itemName || '-';
        const descLines = doc.splitTextToSize(desc, 40);
        const descHeight = Math.max(1, descLines.length) * 4;
        const rowHeight  = Math.max(minRowHeight, descHeight + 4);

        if (currentY + rowHeight + 80 > pageHeight - 30) {
          doc.addPage();
          currentY = drawTableHeader(25);
        }

        const textY = currentY + rowHeight / 2 - 1;

        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text(String(index + 1), 18, textY);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text(item.itemCode || '-', 28, textY);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        const descStartY = currentY + (rowHeight - descLines.length * 4) / 2 + 2;
        doc.text(descLines, 50, descStartY);

        const brandText = item.brand || item.vendor || item.company || 'N/A';
        doc.text(brandText, 87, textY);

        doc.setFontSize(8);
        doc.text(String(item.quantityOrdered || '0'), 115, textY, { align: 'right' });
        doc.text(`${Number(item.perPiecePrice || 0).toFixed(2)}`, 145, textY, { align: 'right' });

        const total = (Number(item.quantityOrdered || 0) * Number(item.perPiecePrice || 0)).toFixed(2);
        doc.setFont('helvetica', 'bold');
        doc.text(total, pageWidth - 17, textY, { align: 'right' });

        currentY += rowHeight + 2;

        if (index < order.items.length - 1) {
          doc.setDrawColor(230, 230, 230);
          doc.setLineWidth(0.2);
          doc.line(14, currentY - 1, pageWidth - 14, currentY - 1);
        }
      } catch (error) {
        console.error('Error rendering item:', item, error);
        currentY += baseRowHeight;
      }
    });
  } else {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(150, 150, 150);
    doc.text('No items in this order', 50, currentY);
    currentY += baseRowHeight;
  }

  // ── Totals section ──
  const footerHeight  = 30;
  const totalsHeight  = 50;
  let totalsStartY    = pageHeight - footerHeight - totalsHeight - 5;

  if (currentY + 15 > totalsStartY) {
    doc.addPage();
    totalsStartY = pageHeight - footerHeight - totalsHeight - 5;
  }

  const bottomSectionWidth = (pageWidth - 28 - 4) / 2;
  const bottomSectionGap   = 4;

  // Payment details (left)
  doc.setFillColor(248, 249, 252);
  doc.roundedRect(14, totalsStartY, bottomSectionWidth, totalsHeight, 2, 2, 'FD');
  doc.setDrawColor(220, 220, 220);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 37, 110);
  doc.text('PAYMENT DETAILS', 17, totalsStartY + 8);
  doc.setDrawColor(15, 37, 110);
  doc.setLineWidth(0.3);
  doc.line(17, totalsStartY + 10, 14 + bottomSectionWidth - 3, totalsStartY + 10);

  doc.setFontSize(8);
  doc.setTextColor(70, 70, 70);
  doc.setFont('helvetica', 'normal');
  doc.text('Payment Terms:', 17, totalsStartY + 18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(order.paymentTerms || 'Net 30', 17, totalsStartY + 25);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(70, 70, 70);
  doc.text('Payment Method:', 17, totalsStartY + 33);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(order.paymentMethod || 'Bank Transfer', 17, totalsStartY + 40);

  // Order totals (right)
  const totalsBoxX = 14 + bottomSectionWidth + bottomSectionGap;
  doc.setFillColor(250, 250, 250);
  doc.roundedRect(totalsBoxX, totalsStartY, bottomSectionWidth, totalsHeight, 2, 2, 'FD');
  doc.setDrawColor(220, 220, 220);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 37, 110);
  doc.text('ORDER TOTALS', totalsBoxX + 3, totalsStartY + 8);
  doc.setDrawColor(15, 37, 110);
  doc.setLineWidth(0.3);
  doc.line(totalsBoxX + 3, totalsStartY + 10, totalsBoxX + bottomSectionWidth - 3, totalsStartY + 10);

  const drawTotalRow = (label, value, y) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(70, 70, 70);
    doc.text(label, totalsBoxX + 3, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(`${value}`, totalsBoxX + bottomSectionWidth - 3, y, { align: 'right' });
  };

  drawTotalRow('Subtotal:',  Number(order.subtotal       || 0).toFixed(2), totalsStartY + 18);
  drawTotalRow('Tax:',       Number(order.taxTotal       || 0).toFixed(2), totalsStartY + 25);
  drawTotalRow('Discount:',  Number(order.discountTotal  || 0).toFixed(2), totalsStartY + 32);
  drawTotalRow('Shipping:',  Number(order.shippingCharges|| 0).toFixed(2), totalsStartY + 39);

  // Grand total bar
  const grandTotalY = totalsStartY + totalsHeight + 2;
  doc.setFillColor(15, 37, 110);
  doc.roundedRect(14, grandTotalY, pageWidth - 28, 12, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text('GRAND TOTAL:', 17, grandTotalY + 8);
  doc.text(`${Number(order.grandTotal || 0).toFixed(2)}`, pageWidth - 17, grandTotalY + 8, { align: 'right' });

  // ── Footer on every page ──
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    drawFooter();
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.setFont('helvetica', 'normal');
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 14, pageHeight - 5, { align: 'right' });
  }

  doc.save(`PO_${order.poNumber || 'order'}_${new Date().toISOString().slice(0, 10)}.pdf`);
};

// ─── AddProductDialog Component ───────────────────────────────────────────────

const AddProductDialog = ({ open, onClose, onProductAdded, vendorName, darkMode }) => {
  const [productForm, setProductForm]   = useState({ ...EMPTY_PRODUCT_FORM });
  const [imageFile, setImageFile]       = useState(null);
  const [uploading, setUploading]       = useState(false);
  const [categories, setCategories]     = useState(() => {
    const saved = localStorage.getItem('productCategories');
    return saved ? JSON.parse(saved) : DEFAULT_CATEGORIES;
  });
  const [addCatOpen, setAddCatOpen]     = useState(false);
  const [newCategory, setNewCategory]   = useState('');
  const [vendors, setVendors]           = useState([]);
  const [success, setSuccess]           = useState('');
  const [error, setError]               = useState('');

  // Pre-fill vendor from the parent PO
  useEffect(() => {
    if (open && vendorName) {
      setProductForm((prev) => ({ ...prev, vendor: vendorName }));
    }
  }, [open, vendorName]);

  // Reset form on close
  useEffect(() => {
    if (!open) {
      setProductForm({ ...EMPTY_PRODUCT_FORM });
      setImageFile(null);
      setSuccess('');
      setError('');
    }
  }, [open]);

  // Fetch vendors + existing product categories
  useEffect(() => {
    if (!open) return;
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');

        const vendorsRes = await API.get('/vendors', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setVendors(vendorsRes.data);

        const productsRes = await API.get('/products', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const productCategories = Array.from(
          new Set(productsRes.data.map((p) => p.category).filter(Boolean))
        );

        const savedCategories   = localStorage.getItem('productCategories');
        const userAdded         = savedCategories ? JSON.parse(savedCategories) : [];
        const allCategories     = Array.from(
          new Set([...DEFAULT_CATEGORIES, ...productCategories, ...userAdded])
        );
        setCategories(allCategories);
      } catch (err) {
        console.error('Error fetching data:', err);
        setVendors([]);
      }
    };
    fetchData();
  }, [open]);

  const handleChange = (e) => {
    setProductForm({ ...productForm, [e.target.name]: e.target.value });
  };

  const handleImageChange = (e) => {
    setImageFile(e.target.files[0]);
  };

  const handleImageUpload = async () => {
    if (!imageFile) return;
    setUploading(true);
    const token     = localStorage.getItem('token');
    const formData  = new FormData();
    formData.append('image', imageFile);
    try {
      const res = await API.post('/upload', formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });
      setProductForm((prev) => ({ ...prev, image: res.data.url }));
      setUploading(false);
      setError('');
    } catch {
      setError('Image upload failed');
      setUploading(false);
    }
  };

  const handleAddCategory = () => {
    if (newCategory && !categories.includes(newCategory)) {
      const updated = [...categories, newCategory];
      setCategories(updated);
      localStorage.setItem('productCategories', JSON.stringify(updated));
      setNewCategory('');
      setAddCatOpen(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (imageFile && !productForm.image) {
      setError('Please upload the image first before submitting.');
      return;
    }
    try {
      const token          = localStorage.getItem('token');
      const piecesPerCarton = Number(productForm.piecesPerCarton) || 0;
      const costPerPiece    = Number(productForm.costPerPiece) || 0;
      const sellingPerPiece = Number(productForm.sellingPerPiece) || 0;
      const sellingPerCarton = piecesPerCarton * sellingPerPiece || 0;
      const perPieceProfit   = sellingPerPiece - costPerPiece;
      const skuValue         = String(productForm.SKU || '').trim() || generateSKU(productForm.name);

      const res = await API.post(
        '/products',
        {
          name:            productForm.name,
          category:        productForm.category,
          subCategory:     productForm.subCategory,
          brand:           productForm.brand,
          vendor:          productForm.vendor,
          color:           productForm.color,
          costPerPiece,
          costPerCarton:   0,
          sellingPerPiece,
          sellingPerCarton,
          cartonQuantity:  0,
          piecesPerCarton,
          losePieces:      0,
          stockQuantity:   0,
          totalPieces:     0,
          perPieceProfit,
          totalUnitProfit: 0,
          totalUnitCost:   0,
          SKU:             skuValue,
          image:           productForm.image,
          warrantyMonths:  Number(productForm.warrantyMonths) || 12,
          warehouseAddress: productForm.warehouseAddress,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const createdProduct = res.data;
      setSuccess(`Product "${productForm.name}" added with zero stock! SKU: ${skuValue}`);
      setError('');

      if (onProductAdded) onProductAdded(createdProduct || { ...productForm, SKU: skuValue });

      // Auto-close after brief success display
      setTimeout(() => onClose(), 1800);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add product. Please try again.');
      setSuccess('');
    }
  };

  // ── Shared styles ──
  const fieldSx = { '& .MuiOutlinedInput-root': { borderRadius: 2 } };

  const sectionCardSx = {
    mb: 2,
    borderRadius: 2,
    boxShadow: darkMode ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.06)',
    background: darkMode ? 'rgba(40,40,40,0.85)' : '#fafafa',
    border:     darkMode ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(0,0,0,0.06)',
  };

  return (
    <Box>
      {/* ── Main Add Product Dialog ── */}
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="md"
        fullWidth
        scroll="paper"
        PaperProps={{
          sx: {
            borderRadius: 3,
            background: darkMode ? 'rgba(24,24,24,0.98)' : '#fff',
            boxShadow: darkMode
              ? '0 24px 64px rgba(0,0,0,0.7)'
              : '0 24px 64px rgba(0,0,0,0.15)',
          },
        }}
      >
        {/* Title */}
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            pb: 1,
            borderBottom: darkMode
              ? '1px solid rgba(255,255,255,0.08)'
              : '1px solid rgba(0,0,0,0.08)',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar sx={{ bgcolor: 'primary.main', width: 44, height: 44 }}>
              <InventoryIcon />
            </Avatar>
            <Box>
              <Typography variant="h6" fontWeight={700}>
                Add New Product
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Fill in the details — the product will be saved and auto-filled into your order
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        {/* Content */}
        <DialogContent sx={{ pt: 2 }}>
          {vendorName && (
            <Alert
              severity="info"
              icon={<StorefrontIcon fontSize="inherit" />}
              sx={{ mb: 2, borderRadius: 2 }}
            >
              Vendor pre-filled as <strong>{vendorName}</strong> from your purchase order.
            </Alert>
          )}

          {success && (
            <Alert
              severity="success"
              icon={<CheckCircleOutlineIcon fontSize="inherit" />}
              sx={{ mb: 2, borderRadius: 2 }}
            >
              {success}
            </Alert>
          )}

          {error && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
              {error}
            </Alert>
          )}

          <form id="add-product-dialog-form" onSubmit={handleSubmit}>
            <Grid container spacing={2}>

              {/* Product Details */}
              <Grid item xs={12}>
                <Card sx={sectionCardSx}>
                  <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <InventoryIcon color={darkMode ? 'secondary' : 'primary'} sx={{ mr: 1 }} />
                      <Typography variant="subtitle1" fontWeight={600}>
                        Product Details
                      </Typography>
                    </Box>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={6}>
                        <TextField
                          label="Product Name"
                          name="name"
                          fullWidth
                          value={productForm.name}
                          onChange={handleChange}
                          required
                          variant="outlined"
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <InventoryIcon fontSize="small" />
                              </InputAdornment>
                            ),
                          }}
                          sx={fieldSx}
                        />
                      </Grid>

                      <Grid item xs={12} md={6}>
                        <TextField
                          select
                          label="Category"
                          name="category"
                          fullWidth
                          value={productForm.category}
                          onChange={handleChange}
                          required
                          variant="outlined"
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <CategoryIcon fontSize="small" />
                              </InputAdornment>
                            ),
                          }}
                          sx={fieldSx}
                        >
                          {categories.map((cat) => (
                            <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                          ))}
                          <MenuItem value="add-category" onClick={() => setAddCatOpen(true)}>
                            <strong>+ Add Category</strong>
                          </MenuItem>
                        </TextField>
                      </Grid>

                      <Grid item xs={12} md={6}>
                        <TextField
                          label="Sub-Category"
                          name="subCategory"
                          fullWidth
                          value={productForm.subCategory}
                          onChange={handleChange}
                          variant="outlined"
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <AccountTreeIcon fontSize="small" />
                              </InputAdornment>
                            ),
                          }}
                          sx={fieldSx}
                        />
                      </Grid>

                      <Grid item xs={12} md={6}>
                        <TextField
                          label="Brand / Company"
                          name="brand"
                          fullWidth
                          value={productForm.brand}
                          onChange={handleChange}
                          variant="outlined"
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <BrandingWatermarkIcon fontSize="small" />
                              </InputAdornment>
                            ),
                          }}
                          sx={fieldSx}
                        />
                      </Grid>

                      <Grid item xs={12} md={6}>
                        <TextField
                          select
                          label="Vendor"
                          name="vendor"
                          fullWidth
                          value={productForm.vendor}
                          onChange={handleChange}
                          required
                          variant="outlined"
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <StorefrontIcon fontSize="small" />
                              </InputAdornment>
                            ),
                          }}
                          sx={fieldSx}
                        >
                          {vendors.map((v) => (
                            <MenuItem key={v._id} value={v.vendorName}>
                              {v.vendorName}
                            </MenuItem>
                          ))}
                        </TextField>
                      </Grid>

                      <Grid item xs={12} md={6}>
                        <TextField
                          label="Color"
                          name="color"
                          fullWidth
                          value={productForm.color}
                          onChange={handleChange}
                          variant="outlined"
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <ColorLensIcon fontSize="small" />
                              </InputAdornment>
                            ),
                          }}
                          sx={fieldSx}
                        />
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>

              {/* Pricing & Stock */}
              <Grid item xs={12}>
                <Card sx={sectionCardSx}>
                  <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <AttachFileIcon color={darkMode ? 'secondary' : 'primary'} sx={{ mr: 1 }} />
                      <Typography variant="subtitle1" fontWeight={600}>
                        Pricing & Stock
                      </Typography>
                    </Box>
                    <Alert severity="info" sx={{ mb: 2, borderRadius: 2, py: 0.5 }}>
                      Product will be saved with <strong>zero stock</strong>. Carton Qty &amp; Lose
                      Pieces are entered in the Items section below — stock updates automatically
                      when order status is set to <strong>Received</strong>.
                    </Alert>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={4}>
                        <TextField
                          label="Cost Per Piece"
                          name="costPerPiece"
                          type="number"
                          fullWidth
                          value={productForm.costPerPiece}
                          onChange={handleChange}
                          required
                          variant="outlined"
                          InputProps={{ startAdornment: <InputAdornment position="start">Rs</InputAdornment> }}
                          inputProps={{
                            min: 0,
                            sx: {
                              '&::-webkit-outer-spin-button, &::-webkit-inner-spin-button': { display: 'none' },
                              '&[type=number]': { appearance: 'textfield' },
                            },
                          }}
                          sx={fieldSx}
                        />
                      </Grid>

                      <Grid item xs={12} md={4}>
                        <TextField
                          label="Selling Per Piece"
                          name="sellingPerPiece"
                          type="number"
                          fullWidth
                          value={productForm.sellingPerPiece}
                          onChange={handleChange}
                          required
                          variant="outlined"
                          InputProps={{ startAdornment: <InputAdornment position="start">Rs</InputAdornment> }}
                          inputProps={{
                            min: 0,
                            sx: {
                              '&::-webkit-outer-spin-button, &::-webkit-inner-spin-button': { display: 'none' },
                              '&[type=number]': { appearance: 'textfield' },
                            },
                          }}
                          sx={fieldSx}
                        />
                      </Grid>

                      <Grid item xs={12} md={4}>
                        <TextField
                          label="Pieces Per Carton"
                          name="piecesPerCarton"
                          type="number"
                          fullWidth
                          value={productForm.piecesPerCarton}
                          onChange={handleChange}
                          required
                          variant="outlined"
                          inputProps={{
                            min: 0,
                            sx: {
                              '&::-webkit-outer-spin-button, &::-webkit-inner-spin-button': { display: 'none' },
                              '&[type=number]': { appearance: 'textfield' },
                            },
                          }}
                          sx={fieldSx}
                        />
                      </Grid>

                      <Grid item xs={12} md={4}>
                        <TextField
                          label="Warranty (months)"
                          name="warrantyMonths"
                          type="number"
                          fullWidth
                          value={productForm.warrantyMonths}
                          onChange={handleChange}
                          helperText="Default: 12 months"
                          variant="outlined"
                          inputProps={{
                            min: 0,
                            sx: {
                              '&::-webkit-outer-spin-button, &::-webkit-inner-spin-button': { display: 'none' },
                              '&[type=number]': { appearance: 'textfield' },
                            },
                          }}
                          sx={fieldSx}
                        />
                      </Grid>

                      <Grid item xs={12} md={4}>
                        <TextField
                          label="SKU / Barcode"
                          name="SKU"
                          fullWidth
                          value={productForm.SKU}
                          onChange={handleChange}
                          required
                          variant="outlined"
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <QrCodeIcon fontSize="small" />
                              </InputAdornment>
                            ),
                          }}
                          sx={fieldSx}
                        />
                      </Grid>

                      <Grid item xs={12} md={4}>
                        <TextField
                          label="Warehouse Address"
                          name="warehouseAddress"
                          fullWidth
                          value={productForm.warehouseAddress}
                          onChange={handleChange}
                          variant="outlined"
                          placeholder="Enter warehouse address"
                          sx={fieldSx}
                        />
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>

              {/* Product Image */}
              <Grid item xs={12}>
                <Card sx={sectionCardSx}>
                  <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <AttachFileIcon color={darkMode ? 'secondary' : 'primary'} sx={{ mr: 1 }} />
                      <Typography variant="subtitle1" fontWeight={600}>
                        Product Image
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                        (optional)
                      </Typography>
                    </Box>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="center">
                      <Button
                        variant="outlined"
                        component="label"
                        startIcon={<AttachFileIcon />}
                        sx={{ borderRadius: 2, py: 1.5, flex: 1, minWidth: 160 }}
                      >
                        {imageFile ? imageFile.name : 'Select Image'}
                        <input type="file" accept="image/*" hidden onChange={handleImageChange} />
                      </Button>

                      {imageFile && (
                        <Button
                          variant="contained"
                          color="primary"
                          onClick={handleImageUpload}
                          disabled={uploading}
                          sx={{ borderRadius: 2, py: 1.5, minWidth: 110 }}
                        >
                          {uploading ? <CircularProgress size={20} color="inherit" /> : 'Upload'}
                        </Button>
                      )}

                      {productForm.image && (
                        <Chip label="Uploaded ✓" color="success" variant="outlined" size="small" />
                      )}
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>

            </Grid>
          </form>
        </DialogContent>

        {/* Actions */}
        <DialogActions
          sx={{
            px: 3,
            py: 2,
            borderTop: darkMode
              ? '1px solid rgba(255,255,255,0.08)'
              : '1px solid rgba(0,0,0,0.08)',
            gap: 1,
          }}
        >
          <Button onClick={onClose} variant="outlined" color="inherit" sx={{ borderRadius: 2 }}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="add-product-dialog-form"
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            sx={{
              borderRadius: 2,
              fontWeight: 700,
              background: darkMode
                ? 'linear-gradient(45deg, #90caf9, #64b5f6)'
                : 'linear-gradient(45deg, #1976d2, #42a5f5)',
              '&:hover': {
                background: darkMode
                  ? 'linear-gradient(45deg, #64b5f6, #42a5f5)'
                  : 'linear-gradient(45deg, #1565c0, #2196f3)',
              },
            }}
          >
            Add Product
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Nested: Add Category Dialog ── */}
      <Dialog open={addCatOpen} onClose={() => setAddCatOpen(false)}>
        <DialogTitle>Add New Category</DialogTitle>
        <DialogContent>
          <TextField
            label="Category Name"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            fullWidth
            autoFocus
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddCatOpen(false)}>Cancel</Button>
          <Button onClick={handleAddCategory} variant="contained" color="primary">
            Add
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

// ─── AdminPurchaseReport Component ───────────────────────────────────────────

const AdminPurchaseReport = () => {
  const { darkMode } = useDarkMode();
  const theme        = useTheme();
  const isSm         = useMediaQuery(theme.breakpoints.down('sm'));
  const isMd         = useMediaQuery(theme.breakpoints.down('md'));

  // ── State ──
  const [currentDate]    = useState(new Date());
  const [orders, setOrders]               = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [page, setPage]                   = useState(0);
  const [vendors, setVendors]             = useState([]);
  const [products, setProducts]           = useState([]);
  const [search, setSearch]               = useState('');
  const [vendorFilter, setVendorFilter]   = useState('');
  const [statusFilter, setStatusFilter]   = useState('');
  const [startDate, setStartDate]         = useState('');
  const [endDate, setEndDate]             = useState('');

  const [editOpen, setEditOpen]                   = useState(false);
  const [editOrder, setEditOrder]                 = useState(null);
  const [originalItemCount, setOriginalItemCount] = useState(0);
  const [showCashAmount, setShowCashAmount]       = useState(false);
  const [showNetDueDate, setShowNetDueDate]       = useState(false);
  const [netDueDate, setNetDueDate]               = useState('');
  const [remainingDays, setRemainingDays]         = useState(0);

  // Highlight a PO row via URL ?highlight= param
  const [highlightPo, setHighlightPo]       = useState('');
  const [highlightUntil, setHighlightUntil] = useState(0);
  const rowRefs = useRef({});

  // Add Product dialog
  const [addProductDialogOpen, setAddProductDialogOpen] = useState(false);
  const [addProductTargetIdx, setAddProductTargetIdx]   = useState(null);

  // ── Helpers ──

  /** Returns true when total payments are less than grand total. */
  const arePaymentsInsufficient = () => {
    if (!editOrder?.grandTotal) return false;
    const totalPaid =
      Number(editOrder.advanceAmount  || 0) +
      Number(editOrder.initialPayment || 0) +
      Number(editOrder.finalPayment   || 0) +
      Number(editOrder.cashPaid       || 0);
    return totalPaid < Number(editOrder.grandTotal);
  };

  // ── Shared cell styles ──
  const cellSx = {
    maxWidth:      { xs: 80, sm: 120, md: 160, lg: 240 },
    overflow:      'hidden',
    textOverflow:  'ellipsis',
    whiteSpace:    'nowrap',
    fontSize:      { xs: '0.75rem', sm: '0.875rem' },
    padding:       { xs: '6px 8px', sm: '12px 16px' },
  };

  const headerCellSx = {
    fontSize: { xs: '0.75rem', sm: '0.875rem' },
    padding:  { xs: '8px 6px', sm: '12px 16px' },
  };

  // ─── Effects ─────────────────────────────────────────────────────────────

  // Read ?highlight= param from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const h      = params.get('highlight');
    if (h) {
      setHighlightPo(h);
      setHighlightUntil(Date.now() + 6000);
      const url = new URL(window.location.href);
      url.searchParams.delete('highlight');
      window.history.replaceState({}, '', url.toString());
    }
  }, []);

  // Scroll highlighted row into view
  useEffect(() => {
    if (!highlightPo || !orders?.length) return;
    const idx        = orders.findIndex((o) => o.poNumber === highlightPo);
    if (idx === -1) return;
    const targetPage = Math.floor(idx / ROWS_PER_PAGE);
    if (page !== targetPage) {
      setPage(targetPage);
      setTimeout(() => {
        rowRefs.current[highlightPo]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    } else {
      rowRefs.current[highlightPo]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [orders, highlightPo]);

  // Fetch vendors
  useEffect(() => {
    const token = localStorage.getItem('token');
    API.get('/vendors', { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => setVendors(res.data))
      .catch(() => setVendors([]));
  }, []);

  // Fetch purchase orders and products
  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const res    = await API.get('/purchase-orders');
        const list   = Array.isArray(res.data) ? res.data : [];
        const sorted = sortByMostRecent(list);
        setOrders(sorted);
        setFilteredOrders(sorted);

        // Fetch products for SKU dropdown
        try {
          const productsRes = await API.get('/products');
          setProducts(Array.isArray(productsRes.data) ? productsRes.data : []);
        } catch (err) {
          console.error('Error fetching products:', err);
          setProducts([]);
        }

        // Hydrate each order with full detail
        const detailed = await Promise.all(
          list.map(async (o) => {
            try {
              const r = await API.get(`/purchase-orders/${o._id}`);
              return r.data || o;
            } catch {
              return o;
            }
          })
        );
        const sortedDetailed = sortByMostRecent(detailed);
        setOrders(sortedDetailed);
        setFilteredOrders(sortedDetailed);
      } catch {
        setOrders([]);
        setFilteredOrders([]);
      }
    };
    fetchOrders();
  }, []);

  // Recalculate payment visibility when editOrder changes
  useEffect(() => {
    if (editOrder) {
      const showCash = checkShowCashAmount(editOrder.paymentTerms, editOrder.poDate);
      setShowCashAmount(showCash);
      if (['Net 30', 'Net 60'].includes(editOrder.paymentTerms) && editOrder.poDate) {
        calculateNetDueDate(editOrder.paymentTerms, editOrder.poDate);
      }
    }
  }, [editOrder]);

  // Filter orders whenever filter state changes
  useEffect(() => {
    let f = Array.isArray(orders) ? [...orders] : [];

    if (search) {
      const q = search.toLowerCase();
      f = f.filter(
        (o) =>
          (o.poNumber    || '').toLowerCase().includes(q) ||
          (o.vendorName  || '').toLowerCase().includes(q) ||
          (o.orderStatus || '').toLowerCase().includes(q) ||
          (o.poDate      || '').toLowerCase().includes(q)
      );
    }
    if (vendorFilter) f = f.filter((o) => (o.vendorName  || '').toLowerCase() === vendorFilter.toLowerCase());
    if (statusFilter) f = f.filter((o) => (o.orderStatus || '').toLowerCase() === statusFilter.toLowerCase());
    if (startDate)    f = f.filter((o) => o.poDate && new Date(o.poDate) >= new Date(startDate + 'T00:00:00'));
    if (endDate)      f = f.filter((o) => o.poDate && new Date(o.poDate) <= new Date(endDate   + 'T23:59:59'));

    setFilteredOrders(sortByMostRecent(f));
    setPage(0);
  }, [search, orders, vendorFilter, statusFilter, startDate, endDate]);

  // ─── Calculations ─────────────────────────────────────────────────────────

  const calculateNetDueDate = (paymentTerms, poDate) => {
    if (!paymentTerms || !poDate || !['Net 30', 'Net 60'].includes(paymentTerms)) {
      setShowNetDueDate(false);
      return;
    }
    const dueDate = new Date(poDate);
    dueDate.setDate(dueDate.getDate() + (paymentTerms === 'Net 30' ? 30 : 60));
    setNetDueDate(dueDate.toISOString().split('T')[0]);
    setRemainingDays(Math.ceil((dueDate - new Date()) / (1000 * 60 * 60 * 24)));
    setShowNetDueDate(true);
  };

  const checkShowCashAmount = (paymentTerms, poDate) => {
    if (!paymentTerms || !poDate) return false;
    const dueDate = new Date(poDate);
    if      (paymentTerms === 'Net 30') dueDate.setDate(dueDate.getDate() + 30);
    else if (paymentTerms === 'Net 60') dueDate.setDate(dueDate.getDate() + 60);
    else { setShowNetDueDate(false); return false; }
    calculateNetDueDate(paymentTerms, poDate);
    return currentDate >= dueDate;
  };

  const calculateDialogTotals = () => {
    let subtotal = 0, taxTotal = 0, discountTotal = 0;
    editOrder?.items?.forEach((item) => {
      subtotal      += Number(item.unitPrice) || 0;
      taxTotal      += Number(item.tax)       || 0;
      discountTotal += Number(item.discount)  || 0;
    });
    const shipping = Number(editOrder?.shippingCharges) || 0;
    return { subtotal, taxTotal, discountTotal, grandTotal: subtotal + taxTotal - discountTotal + shipping };
  };

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleDelete = async (orderId) => {
    if (!window.confirm('Are you sure you want to delete this Purchase Order?')) return;
    await API.delete(`/purchase-orders/${orderId}`);
    setOrders((prev)         => prev.filter((o) => o._id !== orderId));
    setFilteredOrders((prev) => prev.filter((o) => o._id !== orderId));
  };

  const handleEdit = (order) => {
    const fullOrder = order;
    setEditOrder({
      ...fullOrder,
      poDate:               fullOrder.poDate               ? fullOrder.poDate.split('T')[0]               : new Date().toISOString().split('T')[0],
      expectedDeliveryDate: fullOrder.expectedDeliveryDate ? fullOrder.expectedDeliveryDate.split('T')[0] : '',
      orderStatus:          fullOrder.orderStatus   || 'Pending',
      paymentStatus:        fullOrder.paymentStatus || 'Unpaid',
      paymentTerms:         fullOrder.paymentTerms  || 'Net 30',
      paymentMethod:        fullOrder.paymentMethod || 'Bank Transfer',
      purchaseType:         fullOrder.purchaseType  || 'Local',
      currency:             fullOrder.currency      || 'PKR',
      items: fullOrder.items?.map((item) => {
        const product = products.find((p) => p.SKU === item.itemCode);
        return {
          ...item,
          itemSource:      item.itemSource  || 'AdminProductList',
          cartonQuantity:  item.cartonQuantity  ?? '',
          piecesPerCarton: product?.piecesPerCarton ?? item.piecesPerCarton ?? '',
          losePieces:      item.losePieces  ?? '',
          quantityOrdered: item.quantityOrdered || 0,
          perPiecePrice:   item.perPiecePrice   || 0,
          unitPrice:       item.unitPrice        || 0,
          tax:             item.tax              || 0,
          discount:        item.discount         || 0,
          uom:             item.uom              || 'pieces',
          description:     item.description      || '',
        };
      }) || [],
      vendorName:       fullOrder.vendorName    || '',
      vendorId:         fullOrder.vendorId      || '',
      vendorAddress:    fullOrder.vendorAddress || '',
      vendorPhone:      fullOrder.vendorPhone   || '',
      vendorEmail:      fullOrder.vendorEmail   || '',
      shipToName:       fullOrder.shipToName    || '',
      shipToPhone:      fullOrder.shipToPhone   || '',
      shipToEmail:      fullOrder.shipToEmail   || '',
      shipToAddress:    fullOrder.shipToAddress || '',
      deliveryMethod:   fullOrder.deliveryMethod  || '',
      deliveryLocation: fullOrder.deliveryLocation || '',
      reference:        fullOrder.reference        || '',
      subtotal:         fullOrder.subtotal         || 0,
      taxTotal:         fullOrder.taxTotal         || 0,
      discountTotal:    fullOrder.discountTotal    || 0,
      shippingCharges:  fullOrder.shippingCharges  || 0,
      grandTotal:       fullOrder.grandTotal       || 0,
      advanceAmount:    fullOrder.advanceAmount    || 0,
      advanceDateTime:  formatDateTimeForInput(fullOrder.advancePaymentDateTime || fullOrder.advanceDateTime),
      initialPayment:   fullOrder.initialPayment   || 0,
      initialPaymentDateTime: formatDateTimeForInput(fullOrder.initialPaymentDateTime),
      finalPayment:     fullOrder.finalPayment     || 0,
      finalPaymentDateTime: formatDateTimeForInput(fullOrder.finalPaymentDateTime),
      cashPaid:         fullOrder.cashPaid         || 0,
      cashPaymentDateTime: formatDateTimeForInput(fullOrder.cashPaymentDateTime),
      attachments:      fullOrder.attachments      || [],
      creditAmount:     fullOrder.creditAmount     || 0,
      advanceApprovedBy: fullOrder.advanceApprovedBy || '',
    });

    // Pre-calculate remaining payment if missing
    if (!fullOrder.remainingPayment && fullOrder.grandTotal) {
      const totalPaid =
        Number(fullOrder.advanceAmount  || 0) +
        Number(fullOrder.initialPayment || 0) +
        Number(fullOrder.finalPayment   || 0);
      const remaining = Math.max(0, Number(fullOrder.grandTotal) - totalPaid);
      setEditOrder((prev) => ({ ...prev, remainingPayment: remaining.toFixed(2) }));
    }

    setOriginalItemCount(fullOrder.items?.length || 0);
    setEditOpen(true);
  };

  const handleEditChange = (e) => {
    const { name, value }   = e.target;
    const updatedOrder      = { ...editOrder, [name]: value };

    // Recalculate totals when items change
    if (name === 'items') {
      const items = value;
      let subtotal = 0, taxTotal = 0, discountTotal = 0;
      items.forEach((item) => {
        const qty           = Number(item.quantityOrdered) || 0;
        const perPiece      = Number(item.perPiecePrice)   || 0;
        const itemSubtotal  = qty * perPiece;
        item.unitPrice      = itemSubtotal.toFixed(2);
        subtotal      += itemSubtotal;
        taxTotal      += Number(item.tax)      || 0;
        discountTotal += Number(item.discount) || 0;
      });
      const shipping          = Number(updatedOrder.shippingCharges) || 0;
      updatedOrder.items          = items;
      updatedOrder.subtotal       = subtotal.toFixed(2);
      updatedOrder.taxTotal       = taxTotal.toFixed(2);
      updatedOrder.discountTotal  = discountTotal.toFixed(2);
      updatedOrder.grandTotal     = (subtotal + taxTotal - discountTotal + shipping).toFixed(2);
    }

    // Recalculate remaining payment & auto-set payment status
    if (['advanceAmount', 'initialPayment', 'finalPayment', 'cashPaid', 'paymentTerms', 'grandTotal', 'items'].includes(name)) {
      const grandTotal     = Number(updatedOrder.grandTotal || 0);
      const advanceAmount  = name === 'advanceAmount'  ? Number(value || 0) : Number(editOrder.advanceAmount  || 0);
      const initialPayment = name === 'initialPayment' ? Number(value || 0) : Number(editOrder.initialPayment || 0);
      const finalPayment   = name === 'finalPayment'   ? Number(value || 0) : Number(editOrder.finalPayment   || 0);
      const cashPaid       = name === 'cashPaid'       ? Number(value || 0) : Number(editOrder.cashPaid       || 0);
      const totalPaid      = advanceAmount + initialPayment + finalPayment + cashPaid;
      const remaining      = Math.max(0, grandTotal - totalPaid);
      updatedOrder.remainingPayment = remaining.toFixed(2);

      // Auto-stamp datetime for first-time payment entry
      const now = new Date().toISOString().slice(0, 16);
      if (name === 'advanceAmount'  && value > 0 && !updatedOrder.advanceDateTime)        updatedOrder.advanceDateTime        = now;
      if (name === 'initialPayment' && value > 0 && !updatedOrder.initialPaymentDateTime) updatedOrder.initialPaymentDateTime = now;
      if (name === 'finalPayment'   && value > 0 && !updatedOrder.finalPaymentDateTime)   updatedOrder.finalPaymentDateTime   = now;
      if (name === 'cashPaid'       && value > 0 && !updatedOrder.cashPaymentDateTime)    updatedOrder.cashPaymentDateTime    = now;

      if      (totalPaid === 0)    updatedOrder.paymentStatus = 'Unpaid';
      else if (remaining <= 0)     updatedOrder.paymentStatus = 'Paid';
      else                         updatedOrder.paymentStatus = 'Partially Paid';
    }

    // Update numeric fields that affect grand total
    if (['shippingCharges', 'advanceAmount', 'initialPayment', 'cashAmount'].includes(name)) {
      updatedOrder[name] = parseFloat(value) || 0;
      if (name === 'shippingCharges') {
        const sub  = parseFloat(updatedOrder.subtotal)      || 0;
        const tax  = parseFloat(updatedOrder.taxTotal)      || 0;
        const disc = parseFloat(updatedOrder.discountTotal) || 0;
        updatedOrder.grandTotal = (sub + tax - disc + parseFloat(value || 0)).toFixed(2);
      }
    }

    // Show/hide net due date based on payment terms / PO date
    if (name === 'paymentTerms' || name === 'poDate') {
      const paymentTerms = name === 'paymentTerms' ? value : updatedOrder.paymentTerms;
      const poDate       = name === 'poDate'       ? value : updatedOrder.poDate;
      setShowCashAmount(checkShowCashAmount(paymentTerms, poDate));
      if (['Net 30', 'Net 60'].includes(paymentTerms) && poDate) {
        calculateNetDueDate(paymentTerms, poDate);
      } else {
        setShowNetDueDate(false);
      }
    }

    setEditOrder(updatedOrder);
  };

  /** Recalculate quantityOrdered and unitPrice for a single item. */
  const recalcItem = (item) => {
    const cartons  = Number(item.cartonQuantity)  || 0;
    const ppc      = Number(item.piecesPerCarton) || 1;
    const loose    = Number(item.losePieces)      || 0;
    const qty      = cartons * ppc + loose;
    const perPiece = Number(item.perPiecePrice)   || 0;
    return {
      ...item,
      quantityOrdered: qty,
      unitPrice: (qty * perPiece).toFixed(2),
    };
  };

  const handleEditItemFieldChange = (idx, field, value) => {
    const items   = [...editOrder.items];
    items[idx]    = { ...items[idx], [field]: value };

    if (['cartonQuantity', 'losePieces', 'piecesPerCarton', 'perPiecePrice'].includes(field)) {
      items[idx] = recalcItem(items[idx]);
    }

    // Ensure unitPrice updates when only perPiecePrice changes
    if (field === 'perPiecePrice') {
      const qty      = Number(items[idx].quantityOrdered) || 0;
      const perPiece = Number(value) || 0;
      items[idx].unitPrice = (qty * perPiece).toFixed(2);
    }

    handleEditChange({ target: { name: 'items', value: items } });
  };

  const handleItemSourceChange = (idx, value) => {
    const items = [...editOrder.items];
    items[idx]  = {
      ...items[idx],
      itemSource: value,
      ...(value === 'AdminProductList' && {
        itemCode:    '',
        itemName:    '',
        description: '',
        perPiecePrice: '',
      }),
    };
    handleEditChange({ target: { name: 'items', value: items } });

    // Open Add Product dialog when switching to NewProduct
    if (value === 'NewProduct') {
      setAddProductTargetIdx(idx);
      setAddProductDialogOpen(true);
    }
  };

  /** Called when a product is successfully created in AddProductDialog. */
  const handleProductAdded = (newProduct) => {
    if (addProductTargetIdx !== null) {
      const items        = [...editOrder.items];
      const piecesPerCarton = Number(newProduct.piecesPerCarton) || 1;
      const cartons      = Number(items[addProductTargetIdx].cartonQuantity) || 0;
      const loose        = Number(items[addProductTargetIdx].losePieces)     || 0;
      const qty          = cartons * piecesPerCarton + loose;
      const perPiece     = Number(newProduct.costPerPiece) || 0;

      items[addProductTargetIdx] = {
        ...items[addProductTargetIdx],
        itemCode:       newProduct.SKU          || '',
        itemName:       newProduct.name         || '',
        description:    newProduct.category     || '',
        perPiecePrice:  newProduct.costPerPiece || '',
        piecesPerCarton: newProduct.piecesPerCarton || '',
        quantityOrdered: qty,
        unitPrice: qty && perPiece ? (qty * perPiece).toFixed(2) : '',
      };
      handleEditChange({ target: { name: 'items', value: items } });
    }
    setAddProductTargetIdx(null);
  };

  const addEditItem = () => {
    setEditOrder((prev) => ({
      ...prev,
      items: [
        ...(prev?.items || []),
        {
          itemSource:     'AdminProductList',
          itemCode:       '',
          itemName:       '',
          description:    '',
          cartonQuantity: '',
          piecesPerCarton:'',
          losePieces:     '',
          quantityOrdered: 0,
          uom:            'pieces',
          perPiecePrice:  '',
          unitPrice:      '',
          tax:            '',
          discount:       '',
        },
      ],
    }));
  };

  const handleEditSave = async () => {
    try {
      const token        = localStorage.getItem('token');
      const currentItems = editOrder.items || [];
      const newItems     = currentItems.length > originalItemCount
        ? currentItems.slice(originalItemCount)
        : [];

      const dataToSend = {
        ...editOrder,
        advancePaymentDateTime: convertToISOString(editOrder.advanceDateTime),
        initialPaymentDateTime: convertToISOString(editOrder.initialPaymentDateTime),
        finalPaymentDateTime:   convertToISOString(editOrder.finalPaymentDateTime),
        cashPaymentDateTime:    convertToISOString(editOrder.cashPaymentDateTime),
        // Only restock newly added items when order is already Received
        newItems: (editOrder.orderStatus || '').toLowerCase() === 'received' ? newItems : [],
      };

      const response = await API.put(`/purchase-orders/${editOrder._id}`, dataToSend, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });

      if (response.data) {
        const updatedOrder = response.data;
        const updater      = (list) =>
          sortByMostRecent(list.map((o) => (o._id === updatedOrder._id ? updatedOrder : o)));
        setOrders(updater);
        setFilteredOrders(updater);
        setEditOpen(false);
        alert('Purchase Order updated successfully');
      }
    } catch (error) {
      console.error('Error updating order:', error);
      alert(error.response?.data?.message || 'Error updating purchase order. Please try again.');
    }
  };

  const handleEditFileUpload = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('image', file);
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/upload`, {
        method:  'POST',
        body:    formData,
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!response.ok) throw new Error('Upload failed');
      const data = await response.json();
      setEditOrder((prev) => ({
        ...prev,
        [type]:      data.url,
        attachments: prev.attachments
          ? prev.attachments.filter((url) => !url.includes(type))
          : [],
      }));
    } catch (error) {
      console.error('File upload error:', error);
    }
  };

  const handleDownloadPDF = async (order) => {
    try {
      const response = await API.get(`/purchase-orders/${order._id}`);
      generatePDF(response.data);
    } catch (error) {
      console.error('Error fetching fresh order data:', error);
      generatePDF(order);
    }
  };

  const handlePrintReport = () => {
    const rows        = filteredOrders || [];
    const start       = startDate   || 'All time';
    const end         = endDate     || 'Now';
    const vendor      = vendorFilter || 'All vendors';
    const status      = statusFilter || 'All';
    const totalAmount = rows.reduce((sum, r) => sum + Number(r.grandTotal || 0), 0);
    const dateRange   = startDate || endDate ? `From: ${start} To: ${end}` : 'All Dates';

    const rowsHtml = rows.map((r, idx) => `
      <tr>
        <td style="padding:10px;border-bottom:1px solid #ddd;text-align:center;">${idx + 1}</td>
        <td style="padding:10px;border-bottom:1px solid #ddd;font-weight:bold;">${r.poNumber || ''}</td>
        <td style="padding:10px;border-bottom:1px solid #ddd;">${r.poDate ? (r.poDate.slice ? r.poDate.slice(0, 10) : new Date(r.poDate).toLocaleDateString()) : ''}</td>
        <td style="padding:10px;border-bottom:1px solid #ddd;">${r.vendorName || ''}</td>
        <td style="padding:10px;border-bottom:1px solid #ddd;">${r.orderStatus || ''}</td>
        <td style="padding:10px;border-bottom:1px solid #ddd;">${r.paymentStatus || ''}</td>
        <td style="padding:10px;border-bottom:1px solid #ddd;text-align:right;font-weight:bold;">Rs. ${Number(r.grandTotal || 0).toLocaleString()}</td>
      </tr>
    `).join('');

    const html = `
      <html>
        <head>
          <title>Purchase Orders Report</title>
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
            <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
          </div>
          <div class="info-section">
            <p><strong>Date Range:</strong> ${dateRange}</p>
            <p><strong>Vendor Filter:</strong> ${vendor} | <strong>Status Filter:</strong> ${status}</p>
            <p><strong>Total Purchase Orders:</strong> ${rows.length} | <strong>Total Amount:</strong> Rs. ${totalAmount.toLocaleString()}</p>
          </div>
          <h2>Purchase Orders Details</h2>
          <table>
            <thead>
              <tr>
                <th style="width:5%">S/N</th>
                <th style="width:10%">PO #</th>
                <th style="width:12%">Date</th>
                <th style="width:20%">Vendor</th>
                <th style="width:15%">Order Status</th>
                <th style="width:15%">Payment Status</th>
                <th style="width:15%;text-align:right;">Total Amount</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
              <tr class="total-row">
                <td colspan="6" style="text-align:right;padding:12px;">GRAND TOTAL</td>
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
    if (!w?.document) { alert('Popup blocked. Allow popups to print.'); return; }
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 250);
  };

  // ─── Sub-renders ──────────────────────────────────────────────────────────

  const renderPaymentAdornment = () => ({
    startAdornment: (
      <InputAdornment position="start">{editOrder?.currency || 'PKR'}</InputAdornment>
    ),
  });

  const renderReadOnlyAmount = (label, value) => (
    <Grid item xs={12} sm={6}>
      <TextField
        fullWidth
        label={label}
        value={value || 0}
        InputProps={{ readOnly: true, ...renderPaymentAdornment() }}
      />
    </Grid>
  );

  const renderDateTimeField = (label, name, disabledWhen) => (
    <Grid item xs={12} sm={6}>
      <TextField
        fullWidth
        type="datetime-local"
        name={name}
        label={label}
        value={editOrder?.[name] || ''}
        onChange={handleEditChange}
        InputLabelProps={{ shrink: true }}
        disabled={disabledWhen}
      />
    </Grid>
  );

  // ── Edit Dialog ────────────────────────────────────────────────────────────

  const renderEditDialog = () => {
    const renderSectionHeader = (title) => (
      <Grid item xs={12}>
        <Typography variant="h6" sx={{ fontWeight: 700 }} gutterBottom>{title}</Typography>
        <Divider sx={{ mb: 2 }} />
      </Grid>
    );

    // ── Shared input sx for "insufficient payment" error highlight ──
    const makePaymentFieldSx = (fieldValue) => ({
      '& .MuiOutlinedInput-root': {
        '& fieldset':          { borderColor: arePaymentsInsufficient() && fieldValue ? 'error.main' : undefined },
        '&:hover fieldset':    { borderColor: arePaymentsInsufficient() && fieldValue ? 'error.main' : undefined },
        '&.Mui-focused fieldset': { borderColor: arePaymentsInsufficient() && fieldValue ? 'error.main' : undefined },
      },
      '& .MuiInputLabel-root': { color: arePaymentsInsufficient() && fieldValue ? 'error.main' : undefined },
    });

    const noSpinnerInputProps = {
      sx: {
        '&::-webkit-outer-spin-button, &::-webkit-inner-spin-button': { display: 'none' },
        '&[type=number]': { MozAppearance: 'textfield' },
      },
    };

    const remainingPaymentField = (
      <Grid item xs={12} sm={6} md={3}>
        <TextField
          label="Remaining Payment"
          value={editOrder?.remainingPayment || 0}
          fullWidth
          InputProps={{
            readOnly: true,
            sx: {
              color:      arePaymentsInsufficient() ? 'error.main' : 'text.primary',
              fontWeight: arePaymentsInsufficient() ? 'bold' : 'normal',
            },
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              '& fieldset': { borderColor: arePaymentsInsufficient() ? 'error.main' : undefined },
            },
            '& .MuiInputLabel-root': { color: arePaymentsInsufficient() ? 'error.main' : undefined },
          }}
        />
      </Grid>
    );

    const renderAdvancePaymentFields = () => (
      <>
        <Grid item xs={12} sm={6} md={3}>
          <TextField
            label="Advance Amount"
            name="advanceAmount"
            value={editOrder?.advanceAmount || ''}
            onChange={handleEditChange}
            type="number"
            fullWidth
            required
            sx={makePaymentFieldSx(editOrder?.advanceAmount)}
            inputProps={noSpinnerInputProps}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <TextField
            label="Advance Payment Date & Time"
            name="advancePaymentDateTime"
            value={editOrder?.advancePaymentDateTime || ''}
            onChange={handleEditChange}
            type="datetime-local"
            fullWidth
            InputLabelProps={{ shrink: true }}
            required
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <TextField
            label="Final Payment"
            name="finalPayment"
            value={editOrder?.finalPayment || ''}
            onChange={handleEditChange}
            type="number"
            fullWidth
            sx={{
              ...makePaymentFieldSx(editOrder?.finalPayment),
              '& .MuiInputBase-input': { color: 'red' },
            }}
            inputProps={noSpinnerInputProps}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <TextField
            label="Final Payment Date & Time"
            name="finalPaymentDateTime"
            value={editOrder?.finalPaymentDateTime || ''}
            onChange={handleEditChange}
            type="datetime-local"
            fullWidth
            InputLabelProps={{ shrink: true }}
          />
        </Grid>
        {remainingPaymentField}
      </>
    );

    const renderPartialPaymentFields = () => (
      <>
        <Grid item xs={12} sm={6} md={3}>
          <TextField
            label="Initial Payment"
            name="initialPayment"
            value={editOrder?.initialPayment || ''}
            onChange={handleEditChange}
            type="number"
            fullWidth
            required
            sx={makePaymentFieldSx(editOrder?.initialPayment)}
            inputProps={noSpinnerInputProps}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <TextField
            label="Initial Payment Date & Time"
            name="initialPaymentDateTime"
            value={editOrder?.initialPaymentDateTime || ''}
            onChange={handleEditChange}
            type="datetime-local"
            fullWidth
            required
            InputLabelProps={{ shrink: true }}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <TextField
            label="Final Payment"
            name="finalPayment"
            value={editOrder?.finalPayment || ''}
            onChange={handleEditChange}
            type="number"
            fullWidth
            sx={makePaymentFieldSx(editOrder?.finalPayment)}
            inputProps={noSpinnerInputProps}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <TextField
            label="Final Payment Date & Time"
            name="finalPaymentDateTime"
            value={editOrder?.finalPaymentDateTime || ''}
            onChange={handleEditChange}
            type="datetime-local"
            fullWidth
            InputLabelProps={{ shrink: true }}
          />
        </Grid>
        {remainingPaymentField}
      </>
    );

    // ── Item totals calculation ──
    const calculateTotals = () => {
      let subtotal = 0, taxTotal = 0, discountTotal = 0;
      editOrder?.items?.forEach((item) => {
        subtotal      += Number(item.unitPrice) || 0;
        taxTotal      += Number(item.tax)       || 0;
        discountTotal += Number(item.discount)  || 0;
      });
      const shipping   = Number(editOrder?.shippingCharges) || 0;
      const grandTotal = subtotal + taxTotal - discountTotal + shipping;
      return { subtotal, taxTotal, discountTotal, grandTotal, shipping };
    };

    const totals = calculateTotals();

    // ── Item card styles ──
    const itemCardSx = {
      border:     darkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(25,118,210,0.18)',
      borderRadius: 2,
      p:          2,
      mb:         1,
      background: darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(25,118,210,0.02)',
      position:   'relative',
    };

    const itemHeaderSx = {
      display:       'flex',
      alignItems:    'center',
      justifyContent:'space-between',
      mb:            1.5,
      pb:            1,
      borderBottom:  darkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(25,118,210,0.12)',
    };

    return (
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ bgcolor: 'primary.main', color: 'white', display: 'flex', alignItems: 'center' }}>
          <Typography variant="h5" component="div" sx={{ flexGrow: 1 }}>
            Edit Purchase Order
          </Typography>
        </DialogTitle>

        <DialogContent sx={{ p: 3 }}>
          <Grid container spacing={{ xs: 2, sm: 3 }} sx={{ width: '100%' }}>

            {/* ── PO Details ── */}
            {renderSectionHeader('PO Details')}

            <Grid item xs={12} sm={6} md={3}>
              <TextField
                label="PO Number"
                name="poNumber"
                value={editOrder?.poNumber || ''}
                onChange={handleEditChange}
                fullWidth
                placeholder="Auto or manual"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>Payment Status</InputLabel>
                <Select
                  name="paymentStatus"
                  value={editOrder?.paymentStatus || 'Unpaid'}
                  label="Payment Status"
                  onChange={handleEditChange}
                >
                  <MenuItem value="Unpaid">Unpaid</MenuItem>
                  <MenuItem value="Partially Paid">Partially Paid</MenuItem>
                  <MenuItem value="Paid">Paid</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                label="PO Date"
                name="poDate"
                value={editOrder?.poDate || ''}
                onChange={handleEditChange}
                type="date"
                fullWidth
                InputLabelProps={{ shrink: true }}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                label="Expected Delivery Date"
                name="expectedDeliveryDate"
                value={editOrder?.expectedDeliveryDate || ''}
                onChange={handleEditChange}
                type="date"
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>Order Status</InputLabel>
                <Select
                  name="orderStatus"
                  value={editOrder?.orderStatus || 'Pending'}
                  label="Order Status"
                  onChange={handleEditChange}
                >
                  {DEFAULT_STATUS.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Reference/Notes"
                name="reference"
                value={editOrder?.reference || ''}
                onChange={handleEditChange}
                fullWidth
                multiline
                rows={2}
                placeholder="Optional notes for this PO"
              />
            </Grid>

            <Divider sx={{ my: 1.5, width: '100%' }} />

            {/* ── Vendor ── */}
            {renderSectionHeader('Vendor')}

            <Grid item xs={12} sm={6} md={4}>
              <FormControl fullWidth required>
                <InputLabel>Vendor</InputLabel>
                <Select
                  name="vendorName"
                  value={editOrder?.vendorName || ''}
                  label="Vendor"
                  onChange={handleEditChange}
                >
                  {vendors?.map((v) => (
                    <MenuItem key={v._id} value={v.vendorName}>{v.vendorName}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                label="Vendor ID"
                name="vendorId"
                value={editOrder?.vendorId || ''}
                InputProps={{ readOnly: true }}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Vendor Address"
                name="vendorAddress"
                value={editOrder?.vendorAddress || ''}
                onChange={handleEditChange}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                label="Vendor Phone"
                name="vendorPhone"
                value={editOrder?.vendorPhone || ''}
                onChange={handleEditChange}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                label="Vendor Email"
                name="vendorEmail"
                value={editOrder?.vendorEmail || ''}
                onChange={handleEditChange}
                fullWidth
              />
            </Grid>

            <Divider sx={{ my: 1.5, width: '100%' }} />

            {/* ── Ship To ── */}
            {renderSectionHeader('Ship To')}

            <Grid item xs={12} sm={6} md={4}>
              <TextField
                label="Contact Person Name"
                name="shipToName"
                value={editOrder?.shipToName || ''}
                onChange={handleEditChange}
                fullWidth
                required
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                label="Contact Number"
                name="shipToPhone"
                value={editOrder?.shipToPhone || ''}
                onChange={handleEditChange}
                fullWidth
                required
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                label="Email"
                name="shipToEmail"
                type="email"
                value={editOrder?.shipToEmail || ''}
                onChange={handleEditChange}
                fullWidth
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Shipping Address"
                name="shipToAddress"
                value={editOrder?.shipToAddress || ''}
                onChange={handleEditChange}
                fullWidth
                multiline
                rows={2}
                required
              />
            </Grid>

            <Divider sx={{ my: 1.5, width: '100%' }} />

            {/* ── Line Items ── */}
            <Grid item xs={12}>
              <Typography variant="h6" sx={{ fontWeight: 700 }} gutterBottom>Items</Typography>
              <Divider sx={{ mb: 2 }} />
            </Grid>

            {editOrder?.items?.map((item, idx) => (
              <Grid item xs={12} key={idx}>
                <Box sx={itemCardSx}>
                  {/* Item header */}
                  <Box sx={itemHeaderSx}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{
                        width: 28, height: 28, borderRadius: '50%',
                        bgcolor: 'primary.main', color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, fontSize: '0.8rem', flexShrink: 0,
                      }}>
                        {idx + 1}
                      </Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'primary.main' }}>
                        Item {idx + 1}
                      </Typography>
                      {item.itemCode && (
                        <Chip
                          label={item.itemCode}
                          size="small"
                          variant="outlined"
                          color="primary"
                          sx={{ ml: 0.5 }}
                        />
                      )}
                    </Box>
                    <IconButton
                      color="error"
                      size="small"
                      onClick={() => {
                        const items = editOrder.items.filter((_, i) => i !== idx);
                        handleEditChange({ target: { name: 'items', value: items } });
                      }}
                      disabled={editOrder.items.length === 1}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>

                  {/* Item fields */}
                  <Grid container spacing={2}>

                    {/* Row 1: Source + SKU + Name + Description */}
                    <Grid item xs={12} sm={6} md={3}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Item Source</InputLabel>
                        <Select
                          value={item.itemSource || 'AdminProductList'}
                          label="Item Source"
                          onChange={(e) => handleItemSourceChange(idx, e.target.value)}
                        >
                          <MenuItem value="AdminProductList">From AdminProductList</MenuItem>
                          <MenuItem value="NewProduct">New Product</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>

                    <Grid item xs={12} sm={6} md={3}>
                      {item.itemSource === 'AdminProductList' ? (
                        <FormControl fullWidth size="small" required>
                          <InputLabel>Item Code / SKU</InputLabel>
                          <Select
                            value={item.itemCode || ''}
                            label="Item Code / SKU"
                            onChange={(e) => {
                              const selectedSKU     = e.target.value;
                              const selectedProduct = products.find((p) => p.SKU === selectedSKU);
                              const items           = [...editOrder.items];
                              items[idx] = {
                                ...items[idx],
                                itemCode: selectedSKU,
                                ...(selectedProduct ? {
                                  itemName:        selectedProduct.name          || '',
                                  description:     selectedProduct.category      || '',
                                  perPiecePrice:   selectedProduct.costPerPiece  || '',
                                  piecesPerCarton: selectedProduct.piecesPerCarton || '',
                                } : {}),
                              };
                              if (selectedProduct?.costPerPiece) {
                                const qty      = Number(items[idx].quantityOrdered) || 0;
                                const perPiece = Number(selectedProduct.costPerPiece) || 0;
                                items[idx].unitPrice = (qty * perPiece).toFixed(2);
                              }
                              handleEditChange({ target: { name: 'items', value: items } });
                            }}
                          >
                            {products
                              .filter((product) =>
                                !editOrder.vendorName || product.vendor === editOrder.vendorName
                              )
                              .map((product) => (
                                <MenuItem key={product._id || product.SKU} value={product.SKU}>
                                  {product.SKU} - {product.name}
                                </MenuItem>
                              ))}
                          </Select>
                        </FormControl>
                      ) : (
                        <TextField
                          label="Item Code / SKU"
                          value={item.itemCode || ''}
                          size="small"
                          fullWidth
                          required
                          onChange={(e) => handleEditItemFieldChange(idx, 'itemCode', e.target.value)}
                        />
                      )}
                    </Grid>

                    <Grid item xs={12} sm={6} md={3}>
                      <TextField
                        label="Item Name"
                        value={item.itemName || ''}
                        size="small"
                        fullWidth
                        required
                        onChange={(e) => handleEditItemFieldChange(idx, 'itemName', e.target.value)}
                      />
                    </Grid>

                    <Grid item xs={12} sm={6} md={3}>
                      <TextField
                        label="Description"
                        value={item.description || ''}
                        size="small"
                        fullWidth
                        onChange={(e) => handleEditItemFieldChange(idx, 'description', e.target.value)}
                      />
                    </Grid>

                    {/* Row 2: Carton Qty + Pcs/Carton + Lose Pcs + Total Qty + UOM */}
                    <Grid item xs={6} sm={4} md={2}>
                      <TextField
                        label="Carton Qty"
                        value={item.cartonQuantity ?? ''}
                        size="small"
                        type="number"
                        fullWidth
                        inputProps={{ min: 0, sx: { '&::-webkit-outer-spin-button, &::-webkit-inner-spin-button': { display: 'none' }, '&[type=number]': { MozAppearance: 'textfield' } } }}
                        onChange={(e) => handleEditItemFieldChange(idx, 'cartonQuantity', e.target.value)}
                      />
                    </Grid>

                    <Grid item xs={6} sm={4} md={2}>
                      <TextField
                        label="Pcs / Carton"
                        value={item.piecesPerCarton ?? ''}
                        size="small"
                        type="number"
                        fullWidth
                        inputProps={{ min: 0, sx: { '&::-webkit-outer-spin-button, &::-webkit-inner-spin-button': { display: 'none' }, '&[type=number]': { MozAppearance: 'textfield' } } }}
                        onChange={(e) => handleEditItemFieldChange(idx, 'piecesPerCarton', e.target.value)}
                      />
                    </Grid>

                    <Grid item xs={6} sm={4} md={2}>
                      <TextField
                        label="Lose Pcs"
                        value={item.losePieces ?? ''}
                        size="small"
                        type="number"
                        fullWidth
                        inputProps={{ min: 0, sx: { '&::-webkit-outer-spin-button, &::-webkit-inner-spin-button': { display: 'none' }, '&[type=number]': { MozAppearance: 'textfield' } } }}
                        onChange={(e) => handleEditItemFieldChange(idx, 'losePieces', e.target.value)}
                      />
                    </Grid>

                    <Grid item xs={6} sm={4} md={2}>
                      <TextField
                        label="Total Qty"
                        value={item.quantityOrdered ?? 0}
                        size="small"
                        fullWidth
                        InputProps={{ readOnly: true }}
                        helperText="Auto-calculated"
                        sx={{ '& .MuiInputBase-input': { color: 'primary.main', fontWeight: 700 } }}
                      />
                    </Grid>

                    <Grid item xs={6} sm={4} md={2}>
                      <FormControl fullWidth size="small">
                        <InputLabel>UOM</InputLabel>
                        <Select
                          value={item.uom || 'pieces'}
                          label="UOM"
                          onChange={(e) => handleEditItemFieldChange(idx, 'uom', e.target.value)}
                        >
                          {DEFAULT_UOM.map((u) => <MenuItem key={u} value={u}>{u}</MenuItem>)}
                        </Select>
                      </FormControl>
                    </Grid>

                    {/* Row 3: Per Piece Price + Unit Price + Tax + Discount */}
                    <Grid item xs={6} sm={4} md={2}>
                      <TextField
                        label="Per Piece Price"
                        value={item.perPiecePrice ?? ''}
                        size="small"
                        type="number"
                        fullWidth
                        required
                        inputProps={{ sx: { '&::-webkit-outer-spin-button, &::-webkit-inner-spin-button': { display: 'none' }, '&[type=number]': { MozAppearance: 'textfield' } } }}
                        onChange={(e) => handleEditItemFieldChange(idx, 'perPiecePrice', e.target.value)}
                      />
                    </Grid>

                    <Grid item xs={6} sm={4} md={2}>
                      <TextField
                        label="Unit Price"
                        value={item.unitPrice ?? ''}
                        size="small"
                        fullWidth
                        InputProps={{ readOnly: true }}
                        sx={{ '& .MuiInputBase-input': { fontWeight: 700 } }}
                      />
                    </Grid>

                    <Grid item xs={6} sm={4} md={2}>
                      <TextField
                        label="Tax (%)"
                        value={item.tax ?? ''}
                        size="small"
                        type="number"
                        fullWidth
                        inputProps={{ sx: { '&::-webkit-outer-spin-button, &::-webkit-inner-spin-button': { display: 'none' }, '&[type=number]': { MozAppearance: 'textfield' } } }}
                        onChange={(e) => handleEditItemFieldChange(idx, 'tax', e.target.value)}
                      />
                    </Grid>

                    <Grid item xs={6} sm={4} md={2}>
                      <TextField
                        label="Discount"
                        value={item.discount ?? ''}
                        size="small"
                        type="number"
                        fullWidth
                        inputProps={{ sx: { '&::-webkit-outer-spin-button, &::-webkit-inner-spin-button': { display: 'none' }, '&[type=number]': { MozAppearance: 'textfield' } } }}
                        onChange={(e) => handleEditItemFieldChange(idx, 'discount', e.target.value)}
                      />
                    </Grid>

                    {/* Re-open Add Product dialog if source is NewProduct and no code yet */}
                    {item.itemSource === 'NewProduct' && !item.itemCode && (
                      <Grid item xs={12} sm={6} md={2}>
                        <Button
                          variant="outlined"
                          color="primary"
                          fullWidth
                          startIcon={<AddIcon />}
                          onClick={() => {
                            setAddProductTargetIdx(idx);
                            setAddProductDialogOpen(true);
                          }}
                          sx={{ height: '56px', borderRadius: 2, borderStyle: 'dashed' }}
                        >
                          Fill Product Info
                        </Button>
                      </Grid>
                    )}

                  </Grid>
                </Box>
              </Grid>
            ))}

            <Grid item xs={12}>
              <Button
                startIcon={<AddIcon />}
                onClick={addEditItem}
                variant="outlined"
                color="primary"
                sx={{
                  borderStyle: 'dashed',
                  '&:hover': { borderStyle: 'solid' },
                  transition: 'all 0.2s',
                }}
              >
                Add Item
              </Button>
            </Grid>

            <Divider sx={{ my: 1.5, width: '100%' }} />

            {/* ── Totals ── */}
            {renderSectionHeader('Totals')}

            <Grid item xs={12} sm={6} md={3}>
              <TextField label="Subtotal"       value={totals.subtotal.toFixed(2)}      fullWidth InputProps={{ readOnly: true }} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField label="Tax Total"      value={totals.taxTotal.toFixed(2)}      fullWidth InputProps={{ readOnly: true }} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                label="Shipping Charges"
                name="shippingCharges"
                type="number"
                value={editOrder?.shippingCharges || ''}
                onChange={handleEditChange}
                fullWidth
                inputProps={{
                  min: 0,
                  step: '0.01',
                  sx: {
                    '&::-webkit-outer-spin-button, &::-webkit-inner-spin-button': { display: 'none' },
                    '&[type=number]': { MozAppearance: 'textfield' },
                  },
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField label="Discount Total" value={totals.discountTotal.toFixed(2)} fullWidth InputProps={{ readOnly: true }} />
            </Grid>
            <Grid item xs={12} sm={6} md={6}>
              <TextField
                label="Grand Total"
                value={totals.grandTotal.toFixed(2)}
                fullWidth
                InputProps={{
                  readOnly: true,
                  sx: { fontSize: '1.25rem', fontWeight: 'bold', '& input': { textAlign: 'right' } },
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={6}>
              <TextField
                label="Calculated Status"
                value={editOrder?.paymentStatus || 'Unpaid'}
                fullWidth
                InputProps={{ readOnly: true }}
              />
            </Grid>

            <Divider sx={{ my: 1.5, width: '100%' }} />

            {/* ── Payment & Delivery ── */}
            {renderSectionHeader('Payment & Delivery')}

            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>Payment Terms</InputLabel>
                <Select
                  name="paymentTerms"
                  value={editOrder?.paymentTerms || ''}
                  label="Payment Terms"
                  onChange={handleEditChange}
                >
                  {['Net 30', 'Net 60', 'COD', 'Advance Payment', 'Partial Payment', 'Cash Payment'].map((t) => (
                    <MenuItem key={t} value={t}>{t}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {['Net 30', 'Net 60'].includes(editOrder?.paymentTerms) && (
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  label="Due Date"
                  name="dueDate"
                  value={editOrder?.dueDate || ''}
                  type="date"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  InputProps={{ readOnly: true }}
                />
              </Grid>
            )}

            {editOrder?.paymentTerms === 'Advance Payment' && renderAdvancePaymentFields()}
            {editOrder?.paymentTerms === 'Partial Payment' && renderPartialPaymentFields()}

            {editOrder?.paymentTerms === 'Cash Payment' && (
              <>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    label="Cash Paid"
                    name="cashPaid"
                    value={editOrder?.cashPaid || ''}
                    onChange={handleEditChange}
                    type="number"
                    fullWidth
                    required
                    sx={makePaymentFieldSx(editOrder?.cashPaid)}
                    inputProps={noSpinnerInputProps}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    label="Cash Payment Date & Time"
                    name="cashPaymentDateTime"
                    value={editOrder?.cashPaymentDateTime || ''}
                    onChange={handleEditChange}
                    type="datetime-local"
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                {remainingPaymentField}
              </>
            )}

            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>Payment Method</InputLabel>
                <Select
                  name="paymentMethod"
                  value={editOrder?.paymentMethod || ''}
                  label="Payment Method"
                  onChange={handleEditChange}
                  required
                >
                  <MenuItem value=""><em>Select Payment Method</em></MenuItem>
                  {PAYMENT_METHOD_OPTIONS.map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>

            {editOrder?.paymentMethod === 'Bank Transfer' && (
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  name="bankReceipt"
                  label="Upload Bank Receipt (PNG/JPG/PDF)"
                  type="file"
                  inputProps={{ accept: '.png,.jpg,.jpeg,.pdf' }}
                  onChange={(e) => handleEditFileUpload(e, 'bankReceipt')}
                  fullWidth
                />
              </Grid>
            )}

            {editOrder?.paymentMethod === 'Cheque' && (
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  name="chequeReceipt"
                  label="Upload Cheque (PNG/JPG/PDF)"
                  type="file"
                  inputProps={{ accept: '.png,.jpg,.jpeg,.pdf' }}
                  onChange={(e) => handleEditFileUpload(e, 'chequeReceipt')}
                  fullWidth
                />
              </Grid>
            )}

            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>Delivery Method</InputLabel>
                <Select
                  name="deliveryMethod"
                  value={editOrder?.deliveryMethod || ''}
                  label="Delivery Method"
                  onChange={handleEditChange}
                >
                  {DEFAULT_DELIVERY_METHODS.map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <TextField
                label="Delivery Location/Warehouse"
                name="deliveryLocation"
                value={editOrder?.deliveryLocation || ''}
                onChange={handleEditChange}
                fullWidth
              />
            </Grid>

            <Divider sx={{ my: 1.5, width: '100%' }} />

            {/* ── Review & Metadata ── */}
            {renderSectionHeader('Review & Metadata')}

            <Grid item xs={12} sm={6} md={3}>
              <TextField label="Created By"       name="createdBy"       value={editOrder?.createdBy       || ''} onChange={handleEditChange} fullWidth />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField label="Approved By"      name="approvedBy"      value={editOrder?.approvedBy      || ''} onChange={handleEditChange} fullWidth />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField label="Advance Approved By" name="advanceApprovedBy" value={editOrder?.advanceApprovedBy || ''} onChange={handleEditChange} fullWidth />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                label="Credit Amount"
                name="creditAmount"
                value={editOrder?.creditAmount || ''}
                onChange={handleEditChange}
                type="number"
                fullWidth
                inputProps={{ sx: { '&::-webkit-outer-spin-button, &::-webkit-inner-spin-button': { display: 'none' }, '&[type=number]': { MozAppearance: 'textfield' } } }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>Purchase Type</InputLabel>
                <Select
                  name="purchaseType"
                  value={editOrder?.purchaseType || 'Local'}
                  label="Purchase Type"
                  onChange={handleEditChange}
                >
                  {DEFAULT_PURCHASE_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>Currency</InputLabel>
                <Select
                  name="currency"
                  value={editOrder?.currency || 'PKR'}
                  label="Currency"
                  onChange={handleEditChange}
                >
                  {DEFAULT_CURRENCY.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>

          </Grid>
        </DialogContent>

        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setEditOpen(false)} variant="outlined" color="inherit">
            Cancel
          </Button>
          <Button onClick={handleEditSave} variant="contained" color="primary" size="large">
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>
    );
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  const paginatedOrders = filteredOrders.slice(page * ROWS_PER_PAGE, (page + 1) * ROWS_PER_PAGE);
  const totalPages      = Math.ceil(filteredOrders.length / ROWS_PER_PAGE);

  return (
    <Fade in timeout={500}>
      <Box sx={{
        maxWidth:   { xs: '100%', lg: 1800 },
        minWidth:   0,
        boxSizing:  'border-box',
        overflowX:  'hidden',
        px:         { xs: 1, sm: 1, md: 2 },
        mt:         { xs: 1, sm: 2, md: 1 },
        pb:         1,
        background: `linear-gradient(135deg, ${darkMode ? '#1a1a2e' : '#f8f9fa'} 0%, ${darkMode ? '#16213e' : '#e9ecef'} 100%)`,
        minHeight:  '100vh',
        mx:         'auto',
        position:   'relative',
        '&::before': {
          content:    '""',
          position:   'absolute',
          top: 0, left: 0, right: 0,
          height:     '4px',
          background: 'linear-gradient(90deg, #1976d2 0%, #42a5f5 50%, #1976d2 100%)',
          zIndex:     1,
        },
      }}>
        <Paper elevation={6} sx={{
          p:          { xs: 1, sm: 2, md: 4 },
          borderRadius:{ xs: 3, sm: 2, md: 6 },
          background: `linear-gradient(135deg, ${darkMode ? '#2a2a2a' : '#ffffff'} 0%, ${darkMode ? '#1e1e1e' : '#f8f9fa'} 100%)`,
          boxShadow:  '0 20px 40px rgba(0,0,0,0.15), 0 10px 20px rgba(0,0,0,0.1)',
          maxWidth:   { xs: 'calc(90vw - 16px)', sm: '100%', md: 'calc(106vw - 300px)' },
          width:      '100%',
          overflowX:  'hidden',
          overflowY:  'visible',
          mx:         'auto',
          minWidth:   0,
          position:   'relative',
          border:     `1px solid ${darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}`,
          '&::before': {
            content:     '""',
            position:    'absolute',
            top: 0, left: 0, right: 0,
            height:      '3px',
            background:  'linear-gradient(90deg, #1976d2 0%, #42a5f5 50%, #1976d2 100%)',
            borderRadius:'3px 3px 0 0',
          },
        }}>

          {/* ── Header ── */}
          <Box sx={{
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'space-between',
            mb:             { xs: 1.5, sm: 2 },
            gap:            { xs: 1, sm: 2 },
            flexWrap:       'wrap',
            flexDirection:  { xs: 'column', sm: 'row' },
            textAlign:      { xs: 'center', sm: 'left' },
            p:              { xs: 2, sm: 3 },
            borderRadius:   { xs: 2, sm: 3 },
            background: `linear-gradient(135deg, ${darkMode ? 'rgba(25,118,210,0.1)' : 'rgba(255,255,255,0.9)'} 0%, ${darkMode ? 'rgba(66,165,245,0.05)' : 'rgba(248,249,250,0.8)'} 100%)`,
            backdropFilter: 'blur(10px)',
            border:   `1px solid ${darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}`,
            boxShadow:'0 8px 32px rgba(0,0,0,0.1)',
            position: 'relative',
            overflow: 'hidden',
          }}>
            <img src="/Inventorylogo.png" alt="Inventory Logo" style={{ height: 40, marginRight: 12 }} />
            <Typography
              variant={isSm ? 'h6' : 'h4'}
              color="primary"
              sx={{ fontWeight: 700, fontSize: { xs: '1.1rem', sm: '1.5rem', md: '2rem' } }}
            >
              Purchase Orders Report
            </Typography>
          </Box>

          {/* ── Search ── */}
          <TextField
            placeholder="Search by PO Number, Vendor, Status, Date..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            fullWidth
            sx={{ mb: 2, '& .MuiInputBase-root': { fontSize: { xs: '0.875rem', sm: '1rem' } } }}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }}
          />

          {/* ── Filters ── */}
          <Box sx={{
            display:             'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(6, auto)' },
            gap:                 { xs: 1.5, sm: 2 },
            mb:                  2,
            alignItems:          'center',
          }}>
            <TextField
              select
              label="Vendor"
              value={vendorFilter}
              onChange={(e) => setVendorFilter(e.target.value)}
              size={isSm ? 'small' : 'medium'}
              sx={{ width: '100%' }}
            >
              <MenuItem value="">All</MenuItem>
              {vendors?.map((v) => <MenuItem key={v._id} value={v.vendorName}>{v.vendorName}</MenuItem>)}
            </TextField>

            <TextField
              select
              label="Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              size={isSm ? 'small' : 'medium'}
              sx={{ width: '100%' }}
            >
              <MenuItem value="">All</MenuItem>
              {DEFAULT_STATUS.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </TextField>

            <TextField
              label="Start Date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              size={isSm ? 'small' : 'medium'}
              sx={{ width: '100%' }}
            />
            <TextField
              label="End Date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              size={isSm ? 'small' : 'medium'}
              sx={{ width: '100%' }}
            />

            <Button
              variant="contained"
              startIcon={<PrintIcon />}
              onClick={handlePrintReport}
              sx={{
                gridColumn: { xs: '1', sm: 'span 2', md: 'auto' },
                width:      { xs: '100%', sm: '200px' },
                py:         { xs: 1, sm: 1.5 },
                background: darkMode
                  ? 'linear-gradient(45deg, #90caf9, #64b5f6)'
                  : 'linear-gradient(45deg, #1976d2, #42a5f5)',
                color:     '#fff',
                boxShadow: darkMode
                  ? '0 4px 15px rgba(144,202,249,0.3)'
                  : '0 4px 15px rgba(25,118,210,0.3)',
                '&:hover': {
                  background: darkMode
                    ? 'linear-gradient(45deg, #64b5f6, #42a5f5)'
                    : 'linear-gradient(45deg, #1565c0, #2196f3)',
                  transform: 'translateY(-1px)',
                },
                transition: 'all 0.3s ease',
              }}
            >
              Print Report
            </Button>
          </Box>

          {/* ── Table ── */}
          <TableContainer component={Paper} sx={{
            mb:         2,
            width:      '100%',
            maxWidth:   { xs: 'calc(80vw - 10px)', sm: '100%', md: 'calc(103vw - 300px)' },
            minWidth:   0,
            overflowX:  'auto',
            overflowY:  'hidden',
            WebkitOverflowScrolling: 'touch',
            position:   'relative',
            borderRadius: 2,
            boxSizing:  'border-box',
            border:     `1px solid ${darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}`,
            '&::-webkit-scrollbar':       { height: { xs: '4px', sm: '6px' } },
            '&::-webkit-scrollbar-track': { backgroundColor: darkMode ? '#2a2a2a' : '#f1f1f1', borderRadius: '3px' },
            '&::-webkit-scrollbar-thumb': { backgroundColor: darkMode ? '#555'    : '#888',    borderRadius: '3px' },
          }}>
            <Table
              stickyHeader
              sx={{
                minWidth:    { xs: 100, sm: 900, md: 1000, lg: 1200 },
                width:       '100%',
                tableLayout: 'auto',
                whiteSpace:  'nowrap',
                minHeight:   1,
              }}
            >
              <TableHead>
                <TableRow>
                  <TableCell sx={{
                    ...headerCellSx,
                    position:        'sticky',
                    left:            0,
                    backgroundColor: darkMode ? '#1e1e1e' : '#fff',
                    zIndex:          3,
                    boxShadow:       '2px 0 5px -2px rgba(0,0,0,0.1)',
                    fontWeight:      'bold',
                    minWidth:        { xs: 100, sm: 120 },
                  }}>
                    PO Number
                  </TableCell>
                  {[
                    'PO Date', 'Vendor', 'Ship To', 'Status', 'Grand Total',
                    'Payment Terms', 'Payment Method', 'Payment Status',
                    'Cash Amount', 'Cash Date & Time',
                    'Advance Amount', 'Advance Date & Time',
                    'Initial Payment', 'Initial Date & Time',
                    'Final Payment', 'Final Date & Time',
                    'Remaining Amount', 'Bank/Cheque Receipt',
                    'Delivery Location', 'Created By',
                    'Edit', 'Delete', 'PDF',
                  ].map((col) => (
                    <TableCell key={col} sx={headerCellSx}>{col}</TableCell>
                  ))}
                </TableRow>
              </TableHead>

              <TableBody>
                {paginatedOrders.map((order) => {
                  const isHighlighted = highlightPo && order.poNumber === highlightPo && Date.now() < highlightUntil;
                  const statusColor   = getStatusColor(order.orderStatus);
                  const remaining     = (
                    Number(order.grandTotal     || 0) -
                    Number((order.cashPaid ?? order.cashAmount) || 0) -
                    Number(order.initialPayment || 0) -
                    Number(order.advanceAmount  || 0) -
                    Number(order.finalPayment   || 0)
                  ).toFixed(2);

                  return (
                    <TableRow
                      key={order._id}
                      ref={(el) => { if (order.poNumber) rowRefs.current[order.poNumber] = el; }}
                      sx={{
                        ...(isHighlighted ? {
                          animation: 'blinkBg 1s linear infinite',
                          '@keyframes blinkBg': {
                            '0%':   { backgroundColor: '#fffde7' },
                            '50%':  { backgroundColor: '#fff59d' },
                            '100%': { backgroundColor: '#fffde7' },
                          },
                        } : {}),
                        '&:hover': { backgroundColor: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)' },
                      }}
                    >
                      {/* Sticky PO Number column */}
                      <TableCell
                        sx={{
                          ...cellSx,
                          position:        'sticky',
                          left:            0,
                          backgroundColor: darkMode ? '#1e1e1e' : '#fff',
                          zIndex:          1,
                          boxShadow:       '2px 0 5px -2px rgba(0,0,0,0.1)',
                          fontWeight:      'medium',
                        }}
                        title={order.poNumber}
                      >
                        {order.poNumber}
                      </TableCell>

                      <TableCell sx={cellSx} title={order.poDate?.slice(0, 10)}>{order.poDate?.slice(0, 10)}</TableCell>
                      <TableCell sx={cellSx} title={order.vendorName}>{order.vendorName  || 'N/A'}</TableCell>
                      <TableCell sx={cellSx} title={order.shipToName}>{order.shipToName  || 'N/A'}</TableCell>

                      {/* Status badge */}
                      <TableCell>
                        <Box sx={{
                          display:         'inline-block',
                          padding:         '4px 8px',
                          borderRadius:    '12px',
                          backgroundColor: `${statusColor}1A`,
                          color:           statusColor,
                          fontWeight:      500,
                          fontSize:        '0.75rem',
                          textTransform:   'capitalize',
                          whiteSpace:      'nowrap',
                        }}>
                          {order.orderStatus || 'Pending'}
                        </Box>
                      </TableCell>

                      <TableCell sx={{ fontWeight: 'bold', minWidth: 140 }}>
                        Rs{Number(order.grandTotal || 0).toFixed(2)}
                      </TableCell>
                      <TableCell sx={cellSx} title={order.paymentTerms}>{order.paymentTerms  || 'N/A'}</TableCell>
                      <TableCell sx={cellSx} title={order.paymentMethod}>{order.paymentMethod || 'N/A'}</TableCell>
                      <TableCell sx={{ minWidth: 120 }}>{order.paymentStatus || 'Unpaid'}</TableCell>
                      <TableCell sx={{ minWidth: 120 }}>Rs{Number((order.cashPaid ?? order.cashAmount) || 0).toFixed(2)}</TableCell>
                      <TableCell sx={{ minWidth: 160 }}>{formatDateTimeCell(order.cashPaymentDateTime)}</TableCell>
                      <TableCell sx={{ minWidth: 120 }}>Rs{Number(order.advanceAmount  || 0).toFixed(2)}</TableCell>
                      <TableCell sx={{ minWidth: 140 }}>{formatDateTimeCell(order.advancePaymentDateTime || order.advanceDateTime)}</TableCell>
                      <TableCell sx={{ minWidth: 120 }}>Rs{Number(order.initialPayment || 0).toFixed(2)}</TableCell>
                      <TableCell sx={{ minWidth: 140 }}>{formatDateTimeCell(order.initialPaymentDateTime)}</TableCell>
                      <TableCell sx={{ minWidth: 120 }}>Rs{Number(order.finalPayment   || 0).toFixed(2)}</TableCell>
                      <TableCell sx={{ minWidth: 140 }}>{formatDateTimeCell(order.finalPaymentDateTime)}</TableCell>
                      <TableCell sx={{ minWidth: 140 }}>Rs{remaining}</TableCell>

                      {/* Attachments */}
                      <TableCell>
                        {(order.bankReceipt || order.chequeReceipt || order.attachments?.length > 0) ? (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {order.bankReceipt && (
                              <Button variant="outlined" size="small" onClick={() => window.open(order.bankReceipt, '_blank')}>Bank</Button>
                            )}
                            {order.chequeReceipt && (
                              <Button variant="outlined" size="small" onClick={() => window.open(order.chequeReceipt, '_blank')}>Cheque</Button>
                            )}
                            {order.attachments
                              ?.filter((u) => u !== order.bankReceipt && u !== order.chequeReceipt)
                              .map((url, i) => (
                                <Button key={i} variant="outlined" size="small" onClick={() => window.open(url, '_blank')}>
                                  File {i + 1}
                                </Button>
                              ))}
                          </Box>
                        ) : '-'}
                      </TableCell>

                      <TableCell sx={cellSx} title={order.deliveryLocation}>{order.deliveryLocation}</TableCell>
                      <TableCell sx={cellSx} title={order.createdBy}>{order.createdBy}</TableCell>

                      {/* Actions */}
                      <TableCell>
                        <IconButton size="small" onClick={() => handleEdit(order)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                      <TableCell>
                        <IconButton size="small" color="error" onClick={() => handleDelete(order._id)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                      <TableCell>
                        <IconButton size="small" color="primary" onClick={() => handleDownloadPDF(order)}>
                          <PictureAsPdfIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>

          {/* ── Pagination ── */}
          <Box sx={{
            display:        'flex',
            justifyContent: { xs: 'center', sm: 'flex-end' },
            alignItems:     'center',
            mb:             2,
            gap:            1,
            flexWrap:       'wrap',
          }}>
            <Button
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
              size={isSm ? 'small' : 'medium'}
            >
              Previous
            </Button>
            <Typography sx={{ mx: { xs: 1, sm: 2 }, fontSize: { xs: '0.875rem', sm: '1rem' } }}>
              Page {page + 1} of {totalPages}
            </Typography>
            <Button
              disabled={page >= totalPages - 1}
              onClick={() => setPage(page + 1)}
              size={isSm ? 'small' : 'medium'}
            >
              Next
            </Button>
          </Box>

          {/* Dialogs */}
          {renderEditDialog()}

          <AddProductDialog
            open={addProductDialogOpen}
            onClose={() => setAddProductDialogOpen(false)}
            onProductAdded={handleProductAdded}
            vendorName={editOrder?.vendorName}
            darkMode={darkMode}
          />

        </Paper>
      </Box>
    </Fade>
  );
};

export default AdminPurchaseReport;
