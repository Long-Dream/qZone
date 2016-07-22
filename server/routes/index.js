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

    res.send('新爬虫账号已添加成功!')
})

router.get('/list', function(req, res, next) {
    var obj = {};

    obj.userInfos = main.userInfos;
    obj.status = {
        QQdone : main.QQdone.length,
        QQNumbers : main.QQNumbers.length
    };
    obj.config = config;
    obj.verifyImg = main.flags.verifyImg;
    obj.QQstateNum = main.flags.QQstate;

    res.send(obj);
})

router.get("/QQArr", function(req, res, next){
    res.send(config.QQ);
})

router.post("/deleteQQ", function(req, res, next){

    var deleteIndex = req.body.index;

    // 不能使用以下语句, 会造成 bug
    // delete config.QQ[deleteIndex]

    config.QQ[deleteIndex].userQQ = 0;
    config.QQ[deleteIndex].password = "";
    config.QQ[deleteIndex].isLogin = 7;

    res.send("第 " +　deleteIndex　 + " 号爬虫已删除成功!");
})

router.post("/pauseQQ", function(req, res, next){

    var pauseIndex = req.body.index;

    switch(config.QQ[pauseIndex].isLogin){
        case 2 : return res.send("第 " +　pauseIndex　 + " 号账号已经被冻结, 就算你暂停也是没有办法的哦!");
        case 3 : return res.send("第 " +　pauseIndex　 + " 号账号当前正在登录, 请稍后再试!");
        case 7 : return res.send("第 " +　pauseIndex　 + " 号账号已被删除, 无法暂停!");
        case 6 :
            config.QQ[pauseIndex].isLogin = 0;
            return res.send("第 " +　pauseIndex　 + " 号账号已恢复使用!")
        default :
            config.QQ[pauseIndex].isLogin = 6;
            return res.send("第 " +　pauseIndex　 + " 号账号已暂停使用!")
    }

    return res.send("操作失败");
})

router.post("/runCode", function(req, res, next){

    var evalCode = req.body.code;

    try{
        eval(evalCode)
    } catch(e){
        return res.send("Error : " + e.message);
    }

    return res.send("代码已成功执行!");
})

router.post('/verify', function (req, res, next) {
    var verifyCode = req.body.verifyCode;
    process.stdin.emit('data', verifyCode);
    main.flags.verifyImg = "";
    res.send('success')
})

router.post("/stopAll", function (req, res, next) {
    var result = main.clearMain();
    switch(result){
        case -1 : return res.send("当前仍然有正在进行登录的爬虫, 请等这些爬虫登陆完成后重试");
        case  0 : return res.send("已成功停止所有爬虫的运行");
        default : return res.send("post('/stopAll') 未知错误");
    }
})

router.post("/startAll", function (req, res, next) {

    var state = req.body.state;
    
    var result = main.startMain(state);
    switch(result){
        case -1 : return res.send("操作失败, 目前爬虫仍然在运行之中");
        case  0 : return res.send("已成功恢复所有爬虫的运行");
        default : return res.send("post('/startMain') 未知错误");
    }
})

module.exports = router;
