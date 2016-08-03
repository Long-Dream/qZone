// NOTICE! 此JS文件用于定时发送邮件
// NOTICE! 当收到总调度函数的启动信号时, 邮件发送器启动!
process.once("message", function(data){
    setInterval(function(){
        editMailData(data.ports)
    }, data.timeout);
})


var nodemailer  = require('nodemailer');
var request     = require("superagent");

/**
 * 编辑要发送的邮件的内容
 * @param  {array} ports 端口号的数组
 */
function editMailData(ports){

    var text = "";

    // 接受返回数据的次数，当归零的时候，就进行邮件的发送
    var temp = ports.length;

    var stateObj    = {};

    ports.forEach(function(item){
        request.get("http://localhost:" + item + "/list")
            .end(function(err, data){
                if(err) throw err;      // 邮件获取信息发生了错误
                addMailData(item, "list", data.text);
            })
    })

    /**
     * 每个请求返回了数据以后，将返回的数据加入要发送给邮件的内容中
     * 如果请求全部返回，则将邮件发送
     * @param {[type]} data [description]
     */
    function addMailData(item, type, data){

        text += ("来自端口号 " + item + " 的类型为 " + type + " 的信息：<br>" + data + "<br><br>");

        var json = JSON.parse(data);
        var num  = 0;

        stateObj[item + "_QQdone"] = json.status.QQdone;

        json.config.QQ.forEach(function(QQitem){
            if(QQitem.isLogin === 1) num++;
        })
        stateObj[item + "_alive"] = num;

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
        from: "MyRobot <3154439834@qq.com>", // 发件地址
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