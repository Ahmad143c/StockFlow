// Stub for product analytics
exports.getProductAnalytics = async (req, res) => {
  // Replace with real analytics logic as needed
  res.json({
    sales: 0,
    growth: 0,
    views: 0,
    productId: req.params.id
  });
};
const Product = require('../models/Product');


exports.getAll = async (req, res) => {
  const products = await Product.find();
  res.json(products);
};

exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};

exports.create = async (req, res) => {
  try {
    const body = { ...req.body };
    const cartonQuantity = Number(body.cartonQuantity) || 0;
    const piecesPerCarton = Number(body.piecesPerCarton) || 0;
    const losePieces = Number(body.losePieces) || 0;
    const costPerPiece = Number(body.costPerPiece) || 0;
    const sellingPerPiece = Number(body.sellingPerPiece) || 0;

    const totalPieces = cartonQuantity * piecesPerCarton + losePieces;
    const stockQuantity = cartonQuantity + (losePieces > 0 ? 1 : 0);
    const perPieceProfit = sellingPerPiece - costPerPiece;
    const totalUnitProfit = perPieceProfit * totalPieces;
    const totalUnitCost = costPerPiece * totalPieces;
    const costPerCarton = cartonQuantity * piecesPerCarton * costPerPiece;

    Object.assign(body, {
      totalPieces,
      stockQuantity,
      perPieceProfit,
      totalUnitProfit,
      totalUnitCost,
      costPerCarton
    });

    const product = new Product(body);
    await product.save();
    res.status(201).json(product);
  } catch (e) {
    res.status(400).json({ message: 'Failed to create product', error: e.message });
  }
};

exports.update = async (req, res) => {
  try {
    const body = { ...req.body };
    const cartonQuantity = Number(body.cartonQuantity) || 0;
    const piecesPerCarton = Number(body.piecesPerCarton) || 0;
    const losePieces = Number(body.losePieces) || 0;
    const costPerPiece = Number(body.costPerPiece) || 0;
    const sellingPerPiece = Number(body.sellingPerPiece) || 0;

    const totalPieces = cartonQuantity * piecesPerCarton + losePieces;
    const stockQuantity = cartonQuantity + (losePieces > 0 ? 1 : 0);
    const perPieceProfit = sellingPerPiece - costPerPiece;
    const totalUnitProfit = perPieceProfit * totalPieces;
    const totalUnitCost = costPerPiece * totalPieces;
    const costPerCarton = cartonQuantity * piecesPerCarton * costPerPiece;

    Object.assign(body, {
      totalPieces,
      stockQuantity,
      perPieceProfit,
      totalUnitProfit,
      totalUnitCost,
      costPerCarton
    });

    const product = await Product.findByIdAndUpdate(req.params.id, body, { new: true });
    res.json(product);
  } catch (e) {
    res.status(400).json({ message: 'Failed to update product', error: e.message });
  }
};

exports.delete = async (req, res) => {
  await Product.findByIdAndDelete(req.params.id);
  res.json({ message: 'Product deleted' });
};
