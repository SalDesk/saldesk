const express = require('express');
const router = express.Router();
const {
  getProfile, updateProfile, getBookings, getWishlist, addWishlist, removeWishlist, submitReview, getRecommendations,
} = require('../controllers/travelerController');
const authMiddleware = require('../middleware/auth');
const requireTraveler = require('../middleware/requireTraveler');
const { validate, schemas } = require('../middleware/validation');

router.use(authMiddleware);
router.use(requireTraveler);

router.get('/profile',             getProfile);
router.put('/profile',             validate(schemas.travelerProfile), updateProfile);
router.get('/bookings',            getBookings);
router.post('/bookings/:reservationId/review', validate(schemas.travelerReview), submitReview);
router.get('/wishlist',            getWishlist);
router.post('/wishlist',           validate(schemas.wishlistAdd), addWishlist);
router.delete('/wishlist/:unitId', removeWishlist);
router.get('/recommendations',     getRecommendations);

module.exports = router;
