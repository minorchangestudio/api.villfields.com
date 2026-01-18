const router = require('express').Router();



router.use('/v1/utm-links', require('./utm_links.routes'));






module.exports = router;