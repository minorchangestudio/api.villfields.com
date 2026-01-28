const router = require('express').Router();
const { createUtmLink, getUtmLinks, redirectUtmLink, updateUtmLink, deleteUtmLink } = require('../controllers/utm_links.controller');

router.get('/', getUtmLinks);
router.post('/', createUtmLink);
router.get('/redirect/:code', redirectUtmLink);
router.put('/:id', updateUtmLink);
router.delete('/:id', deleteUtmLink);
module.exports = router;