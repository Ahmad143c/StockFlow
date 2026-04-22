const User = require('../models/User');
const jwt = require('jsonwebtoken');


exports.login = async (req, res) => {
  const { username, password } = req.body;
  console.log('Login attempt for username:', username);
  const user = await User.findOne({ username });
  console.log('User found:', !!user);
  if (!user) {
    console.log('User not found');
    return res.status(400).json({ message: 'Invalid credentials' });
  }
  const passwordMatch = await user.comparePassword(password);
  console.log('Password match:', passwordMatch);
  if (!passwordMatch) {
    console.log('Password does not match');
    return res.status(400).json({ message: 'Invalid credentials' });
  }
  const token = jwt.sign({ id: user._id, role: user.role, passwordVersion: user.passwordVersion || 0 }, process.env.JWT_SECRET, { expiresIn: '1d' });
  console.log('Login successful for:', username);
  res.json({ token, user: { username: user.username, role: user.role } });
};


exports.register = async (req, res) => {
  const { username, password, role, shopName, sellingPoint, productCategory } = req.body;
  if (!username || !password || !role) {
    return res.status(400).json({ message: 'Username, password, and role are required' });
  }
  if (role === 'staff' && (!shopName || !sellingPoint || !productCategory)) {
    return res.status(400).json({ message: 'Shop Name, Selling Point, and Product Category are required for sellers' });
  }
  const existingUser = await User.findOne({ username });
  if (existingUser) {
    return res.status(400).json({ message: 'Username already exists' });
  }
  const user = new User({ username, password, role, shopName, sellingPoint, productCategory });
  await user.save();
  res.status(201).json({ message: 'User registered successfully' });
};
