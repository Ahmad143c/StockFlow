const express = require('express');
const router = express.Router();
const { login } = require('../controllers/authController');


const { register } = require('../controllers/authController');


const User = require('../models/User');

router.post('/login', login);
router.post('/register', register);


// Update seller info
router.put('/update/:id', async (req, res) => {
	try {
		const { shopName, username, sellingPoint, productCategory } = req.body;
		const user = await User.findByIdAndUpdate(
			req.params.id,
			{ shopName, username, sellingPoint, productCategory },
			{ new: true }
		);
		if (!user) return res.status(404).json({ message: 'Seller not found' });
		res.json({ message: 'Seller updated successfully', user });
	} catch (err) {
		res.status(500).json({ message: 'Failed to update seller' });
	}
});

module.exports = router;
