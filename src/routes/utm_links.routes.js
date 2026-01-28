const router = require('express').Router();
const { createUtmLink, getUtmLinks, redirectUtmLink, updateUtmLink, deleteUtmLink, getUtmLinkAnalytics } = require('../controllers/utm_links.controller');

router.get('/', getUtmLinks);
router.post('/', createUtmLink);
router.get('/redirect/:code', redirectUtmLink);
router.get('/analytics/:code', getUtmLinkAnalytics);
router.put('/:id', updateUtmLink);
router.delete('/:id', deleteUtmLink);
module.exports = router;