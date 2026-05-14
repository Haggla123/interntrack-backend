const express = require('express');
const router  = express.Router();
const { 
  getMyCompany, getInterns, getSupervisors, assignInterns, getStats, 
  createSupervisor, updateSupervisor, deleteSupervisor 
} = require('../Controllers/companyManagerController');
const { protect, authorise } = require('../middleware/auth');

router.get('/company',     protect, authorise('company_manager'), getMyCompany);
router.get('/interns',     protect, authorise('company_manager'), getInterns);
router.get('/supervisors', protect, authorise('company_manager'), getSupervisors);
router.post('/supervisors', protect, authorise('company_manager'), createSupervisor);
router.put('/supervisors/:id', protect, authorise('company_manager'), updateSupervisor);
router.delete('/supervisors/:id', protect, authorise('company_manager'), deleteSupervisor);
router.put('/assign',      protect, authorise('company_manager'), assignInterns);
router.get('/stats',       protect, authorise('company_manager'), getStats);

module.exports = router;
