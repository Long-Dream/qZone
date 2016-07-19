var express = require('express');
var router = express.Router();
var config = require('../../config.js');
var main = require('../../app.js');
/* GET home page. */
router.get('/', function(req, res, next) {
    res.render('index', {
        title: '后台管理系统'
    });
});

router.post('/', function(req, res, next) {
    
    var userObj = {
        'userQQ': req.body.userQQ,
        'password': req.body.password,
        'isLogin' : 0
    };

    config.QQ.push(userObj);

    res.send('success')
})

router.get('/list', function(req, res, next) {
    res.send(main.userInfos);
})

router.get("/QQArr", function(req, res, next){
    res.send(config.QQ);
})

router.post("/deleteQQ", function(req, res, next){

    var deleteIndex = req.body.index;

    delete config.QQ[deleteIndex];

    res.send("第 " +　deleteIndex　 + " 号爬虫已删除成功!");
})

router.post("/pauseQQ", function(req, res, next){

    var pauseIndex = req.body.index;

    if(config.QQ[pauseIndex].isLogin === 2){
        return res.send("第 " +　pauseIndex　 + " 号账号已经被冻结, 就算你暂停也是没有办法的哦!");
    }

    if(config.QQ[pauseIndex].isLogin === 1){
        config.QQ[pauseIndex].isLogin = 6;
        return res.send("第 " +　pauseIndex　 + " 号账号已暂停使用!")
    } else if (config.QQ[pauseIndex].isLogin === 6){
        config.QQ[pauseIndex].isLogin = 0;
        return res.send("第 " +　pauseIndex　 + " 号账号已恢复使用, 即将进行登录!")
    }

    return res.send("操作失败");
})

module.exports = router;
