const router = require('express').Router();
const { createUtmLink, getUtmLinks, redirectUtmLink } = require('../controllers/utm_links.controller');

router.get('/', getUtmLinks);
router.post('/', createUtmLink);
router.get('/redirect/:code', redirectUtmLink);

module.exports = router;