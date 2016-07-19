var express = require('express');
var router = express.Router();
var config = require('../../config.js');
var main = require('../../app.js');
/* GET home page. */
router.get('/', function(req, res, next) {
    res.render('index', {
        title: '爬取到的用户信息'
    });
});

router.post('/', function(req, res, next) {
    
    var userObj = {
        'userQQ': req.body.userQQ,
        'password': req.body.password
    };

    config.QQ.push(userObj);

    res.send('success')
})

router.get('/list', function(req, res, next) {
    res.send(main.userInfos);
})

module.exports = router;
