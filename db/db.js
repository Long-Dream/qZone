var mongodb  = require('mongodb');
var config   = require('../config.js')

var main     = require("../app.js")

var server   = new mongodb.Server('localhost', 27017, {auto_reconnect:true});
var db       = new mongodb.Db(config.dbName, server, {safe:true});

db.open(function(err, db){
    if(err) throw err;
    console.log('连接数据库成功！');

    init(db);

    getQQdone(db);
    getQQNumbers(db);
})

/**
 * 对数据库的初始化, 目前是对 QQNumbers , 如果为空就先加一个文档
 */
function init(){
    db.collection("QQNumbers").findOne({}, function(err, result){
        if(err) throw err;
        if(!result){
            db.collection("QQNumbers").insert({name : "QQNumbers", QQNumbers : []}, function(err, result){
                if(err) throw err;

                console.log("QQNumbers 内容初始化完成!")
            })
        }
    })
}

/**
 * 从数据库中获取 QQdone 的内容, 并将其加入到程序中
 * @param  {db} db 数据库
 */
function getQQdone(db){
    db.collection("QQdone").find({}).toArray(function(err, result){
        if(err) throw err;  // 获取 QQdone 数据 失败!

        for(var i = 0; i < result.length; i++){
            main.QQdone.push(result[i].uin)
        }

        console.log("数据库的 " + result.length +　" 个　QQdone 已被推入数组!")

        main.flags.readyFlag -= 1;
    })
}

/**
 * 从数据库中获取 QQNumbers 的内容, 并将其加入到程序中
 * @param  {db} db 数据库
 */
function getQQNumbers(db){
    db.collection("QQNumbers").findOne({}, function(err, result){
        if(err) throw err;

        if(result) {
            for(var i = 0; i < result.QQNumbers.length; i++){
                main.QQNumbers.push(result.QQNumbers[i])
            }
            console.log("数据库的 " + result.QQNumbers.length +　" 个　QQNumbers 已被推入数组!");
        }
        
        main.flags.readyFlag -= 1;
    })
}



module.exports = db;