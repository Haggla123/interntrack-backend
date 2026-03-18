// Routes/Routes_companies.js
const express = require('express');
const router  = express.Router();

const {
  getCompanies, getCompany, createCompany, updateCompany, deleteCompany, applyForSlot,
} = require('../Controllers/companyController');

const { protect, authorise } = require('../middleware/auth');

// All roles can view companies
router.get('/',    protect, getCompanies);
router.get('/:id', protect, getCompany);

// Student: apply for a slot — decrements slot count
router.post('/:id/apply', protect, authorise('student'), applyForSlot);

// Admin-only: create, update, delete
router.post('/',    protect, authorise('admin'), createCompany);
router.put('/:id',  protect, authorise('admin'), updateCompany);
router.delete('/:id', protect, authorise('admin'), deleteCompany);

module.exports = router;