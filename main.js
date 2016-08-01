var cp          = require("child_process");
var fs          = require("fs")
var nodemailer  = require('nodemailer');
var request     = require("superagent");

var ports = [3001, 3002];   // 所有爬虫的端口号集合

// 清空img文件夹
clearImg();

var thread_1 = cp.fork(__dirname + '/app.js');
var thread_2 = cp.fork(__dirname + '/app.js');

// 发送启动信号
thread_1.send({THREAD_ID: 1, QQ_RANGE_MIN : 0000000000, QQ_RANGE_MAX : 1000000000, PORT : 3001});
thread_2.send({THREAD_ID: 2, QQ_RANGE_MIN : 1000000000, QQ_RANGE_MAX : 2000000000, PORT : 3002});

setInterval(editMailData, 30000);


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

/**
 * 编辑要发送的邮件的内容
 */
function editMailData(){

    var text = "";

    // 接受返回数据的次数，当归零的时候，就进行邮件的发送
    var temp = ports.length * 2;

    var stateObj    = {};

    ports.forEach(function(item){
        request.get("http://localhost:" + item + "/list")
            .end(function(err, data){
                if(err) throw err;      // 邮件获取信息发生了错误
                addMailData(item, "list", data.text);
            })
    })

    ports.forEach(function(item){
        request.get("http://localhost:" + item + "/QQArr")
            .end(function(err, data){
                if(err) throw err;      // 邮件获取信息发生了错误
                addMailData(item, "QQArr", data.text);
            })
    })

    /**
     * 每个请求返回了数据以后，将返回的数据加入要发送给邮件的内容中
     * 如果请求全部返回，则将邮件发送
     * @param {[type]} data [description]
     */
    function addMailData(item, type, data){

        text += ("来自端口号 " + item + " 的类型为 " + type + " 的信息：<br>" + data + "<br><br>");

        var json        = JSON.parse(data);

        if(json instanceof Array){
            var num = 0;
            json.forEach(function(item){
                if(item.isLogin === 1) num++;
            })
            stateObj[item + "_alive"] = num;
        } else {
            stateObj[item + "_QQdone"] = json.status.QQdone;
        }

        temp--;

        if(!temp){
            text = JSON.stringify(stateObj) + "<br><br><br>" + text;
            sendMail(text);
        }
    }
}

/**
 * 定时发送一封有关爬虫信息的邮件
 * @param  {string} data 邮件内容
 */
function sendMail(data){

    // 开启一个 SMTP 连接池
    var smtpTransport = nodemailer.createTransport("SMTP",{
        host: "smtp.qq.com", // 主机
        secureConnection: true, // 使用 SSL
        port: 465, // SMTP 端口
        auth: {
            user: "3154439834@qq.com", // 账号
            pass: "zxxchomltpxjdgeh" // 密码
        }
    });

    var mailOptions = {
        from: "Fred Foo <3154439834@qq.com>", // 发件地址
        to: "634262407@qq.com", // 收件列表
        subject: new Date().toLocaleString() + "_爬虫信息", // 标题
        html: data // html 内容
    }

    // 发送邮件
    smtpTransport.sendMail(mailOptions, function(error, response){
        if(error){
            return console.log(error);
        }

        console.log("Message sent: " + response.message);
    });
}