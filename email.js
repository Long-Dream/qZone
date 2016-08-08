// NOTICE! 此JS文件用于定时发送邮件
// NOTICE! 当收到总调度函数的启动信号时, 邮件发送器启动!
process.once("message", function(data){
    setInterval(function(){
        editMailData(data.ports)
    }, data.timeout);
})


var nodemailer  = require('nodemailer');
var request     = require("superagent");
var config      = require("config");

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

        // 事先让 stateObj 的每一个元素都是一个对象
        stateObj[item] = {};

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

        text += ("来自端口号 " + item + " 的类型为 " + type + " 的信息：<br>" + listData2Table(data) + "<br><br>");

        var json = JSON.parse(data);
        var num  = 0;


        json.config.QQ.forEach(function(QQitem){
            if(QQitem.isLogin === 1) num++;
        })
        stateObj[item].alive = num;
        stateObj[item].QQdone = json.status.QQdone;

        temp--;

        if(!temp){
            text = stateObj2Table(stateObj) + "<br><br><br>" + text;
            sendMail(text);
        }
    }
}

/**
 * 将 stateObj 这个对象转为表格的 HTML 字符串
 * @param  {object} stateObj 存放有当前爬虫信息的对象
 */
function stateObj2Table(stateObj){
    
    var tableText = "<table><tbody><tr><td>Port</td><td>QQdown</td><td>alive</td></tr>";

    for(var i in stateObj){
        tableText += ("<tr><td>" + i + "</td><td>" + stateObj[i].QQdone + "</td><td>" + stateObj[i].alive + "</td></tr>")
    }

    tableText += "</tbody></table>";

    return tableText;
}

/**
 * 将从 list 的 GET 请求返回到的数据转变为表格
 * @param  {string} list 返回的数据，json的字符串
 */
function listData2Table(list){

    var tableText = "<table><tbody><tr><td>ID</td><td>userQQ</td><td>password</td><td>isLogin</td></tr>";
    var json      = JSON.parse(list);

    json.config.QQ.forEach(function(QQitem, index){
        tableText += ("<tr><td>" + index + "</td><td>" + QQitem.userQQ + "</td><td>" + QQitem.password + "</td><td>" + QQitem.isLogin + "</td></tr>")
    })

    tableText += "</tbody></table>";

    return tableText;
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
        to: config.email, // 收件列表，如果要发送给多人逗号分隔即可
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

