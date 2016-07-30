var mongodb  = require('mongodb');
var config   = require('../config.js')

var main     = require("../app.js")

var server   = new mongodb.Server('localhost', 27017, {auto_reconnect:true});
var db       = new mongodb.Db(config.dbName, server, {safe:true});

db.open(function(err, db){
    if(err) throw err;
    console.log('连接数据库成功！');

    console.time("db");

    db.collection("qq_friends").find({qq : 763492170}).toArray(function(err, result){
        result.sort(function(a, b){
            return a.friend - b.friend;
        })

        result.forEach(function(item){
            console.log(item.friend)
        })
    })

})

// 1183502093