var express = require('express');
var router = express.Router();

var api = require('../api/api');


router.post('/api/connect', api.connect);
router.get('/api/logout', api.logout);
router.get('/api/loggedIn', api.loggedIn);
router.post('/api/changeServerPassword', api.changeServerPassword);


/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'QB Manager' });
});

module.exports = router;
