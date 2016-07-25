var cp      = require("child_process");
var fs      = require("fs")

// 清空img文件夹
clearImg();

var thread_1 = cp.fork(__dirname + '/app.js');
var thread_2 = cp.fork(__dirname + '/app.js');

// 发送启动信号
thread_1.send({THREAD_ID: 1, QQ_RANGE_MIN : 000000000, QQ_RANGE_MAX : 2000000000, PORT : 3001});
// thread_2.send({THREAD_ID: 2, QQ_RANGE_MIN : 000000000, QQ_RANGE_MAX : 300000000, PORT : 3002});



function clearImg () {
    var list = fs.readdirSync('./server/public/img/');
    for (var i = 0; i < list.length; i++) {
        var name = list[i];
        fs.unlinkSync('./server/public/img/' + name);
    }
    console.log('清空img文件夹');
};
