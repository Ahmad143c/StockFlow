import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API from '../api/api';

export const fetchProducts = createAsyncThunk('products/fetch', async () => {
  const token = localStorage.getItem('token');
  const res = await API.get('/products', {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.data;
});

const productsSlice = createSlice({
  name: 'products',
  initialState: { items: [], status: 'idle' },
  reducers: {
    applySale(state, action) {
      const soldItems = action.payload || [];
      soldItems.forEach(sold => {
        const product = state.items.find(p => p._id === sold.productId || p.SKU === sold.SKU);
        if (!product) return;
        const piecesPerCarton = Number(product.piecesPerCarton) || 0;
        const cartonQuantity = Number(product.cartonQuantity) || 0;
        const losePieces = Number(product.losePieces) || 0;
        const totalPieces = (cartonQuantity * piecesPerCarton) + losePieces;
        const remaining = Math.max(0, totalPieces - (Number(sold.quantity) || 0));
        const newCartons = piecesPerCarton > 0 ? Math.floor(remaining / piecesPerCarton) : 0;
        const newLose = piecesPerCarton > 0 ? (remaining % piecesPerCarton) : remaining;
        product.cartonQuantity = newCartons;
        product.losePieces = newLose;
      });
    }
  },
  extraReducers: builder => {
    builder
      .addCase(fetchProducts.pending, state => { state.status = 'loading'; })
      .addCase(fetchProducts.fulfilled, (state, action) => {
        state.items = action.payload;
        state.status = 'succeeded';
      });
  }
});

export const { applySale } = productsSlice.actions;
export default productsSlice.reducer;
