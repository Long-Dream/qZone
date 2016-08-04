var cp          = require("child_process");
var fs          = require("fs")


var ports = [3001, 3002, 3003, 3004];   // 所有爬虫的端口号集合

// 清空img文件夹
clearImg();

var thread_Mail = cp.fork(__dirname + '/email.js');

thread_Mail.send({ports : ports, timeout : 900000})

var thread_1    = cp.fork(__dirname + '/app.js');
var thread_2    = cp.fork(__dirname + '/app.js');
var thread_3    = cp.fork(__dirname + '/app.js');
var thread_4    = cp.fork(__dirname + '/app.js');

// 发送启动信号
thread_1.send({THREAD_ID: 1, QQ_RANGE_MIN : 000000000 , QQ_RANGE_MAX : 500000000,  PORT : 3001});
thread_2.send({THREAD_ID: 2, QQ_RANGE_MIN : 500000000,  QQ_RANGE_MAX : 1000000000, PORT : 3002});
thread_3.send({THREAD_ID: 3, QQ_RANGE_MIN : 1000000000, QQ_RANGE_MAX : 1500000000, PORT : 3003});
thread_4.send({THREAD_ID: 4, QQ_RANGE_MIN : 1500000000, QQ_RANGE_MAX : 2000000000, PORT : 3004});




/**
 * 清空图片文件夹的内容函数
 */
function clearImg () {
    var list = fs.readdirSync('./server/public/img/');
    for (var i = 0; i < list.length; i++) {
        var name = list[i];
        fs.unlinkSync('./server/public/img/' + name);
    }
    console.log('清空img文件夹');
};
