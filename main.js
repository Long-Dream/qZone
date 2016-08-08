var cp          = require("child_process");
var fs          = require("fs")

// 清空img文件夹
clearImg();

var thread_Mail;
startEmailThread(thread_Mail);

var threadArr = [];  // 子进程数组
var ports     = [];  // 端口号数组集合
var threadDetailArr = [
    {THREAD_ID: 1, QQ_RANGE_MIN : 000000000,  QQ_RANGE_MAX : 500000001,  PORT : 3001},
    {THREAD_ID: 2, QQ_RANGE_MIN : 500000000,  QQ_RANGE_MAX : 1000000001, PORT : 3002},
    {THREAD_ID: 3, QQ_RANGE_MIN : 1000000000, QQ_RANGE_MAX : 1500000001, PORT : 3003},
    {THREAD_ID: 4, QQ_RANGE_MIN : 1500000000, QQ_RANGE_MAX : 2000000001, PORT : 3004}
];

// 开启进程, 并发送启动信号
threadDetailArr.forEach(function(item, index){
    ports.push(item.PORT)
    threadArr[index] = cp.fork(__dirname + '/app.js');
    threadArr[index].send(item);
})

console.log(ports)

/**
 * 开启邮箱进程, 并进行守护
 * @param  {thread} thread_Mail 邮箱进程
 */
function startEmailThread(thread_Mail){

    thread_Mail = cp.fork(__dirname + '/email.js');
    thread_Mail.send({ports : ports, timeout : 900000})

    thread_Mail.on("exit", function(data){
        startEmailThread(thread_Mail);
    })
}


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
