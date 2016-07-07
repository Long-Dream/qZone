var request = require("superagent");
var cheerio = require("cheerio");

var exec = require("child_process").exec;


var jsonCookie = {};    // 以 JSON 形式保存的当前cookie值
var cookies = '';       // 以传输形式保存的当前cookie值

var QQNumbers = [];     // 收集到的QQ号码

// Config
var config = {
    userQQ : 3095623630,
    password : 'testtest'
}

// 通用的HTTP请求头(不含cookie)
var HTTPheaders = {
    'Accept' : 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Encoding' : 'gzip, deflate, sdch',
    'Accept-Language' : 'zh-CN,zh;q=0.8,zh-TW;q=0.6',
    'Cache-Control' : 'no-cache',
    'Connection' : 'keep-alive',
    'User-Agent' : 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Ubuntu Chromium/51.0.2704.79 Chrome/51.0.2704.79 Safari/537.36',
    'Upgrade-Insecure-Requests' : '1',
    'Pragma' : 'no-cache',
    'Host' : 'user.qzone.qq.com'
}


// 调用子命令
exec('python ./QQLib/test.py ' + config.userQQ + ' ' + config.password + '', function(err,stdout,stderr){
    if(err) throw err; // 登录失败

    out2cookies(stdout);
    getMainPage(616772663, config.userQQ, cookies);
})

// 获取最近来访好友
function getMainPage(targetQQ, currentQQ, cookies){

    request.get('http://r.qzone.qq.com/cgi-bin/main_page_cgi?uin=' + targetQQ + '&param=3_' + targetQQ + '_0%7C8_8_' + config.userQQ + '_0_1_0_0_1%7C15%7C16')
        .set(HTTPheaders)
        .set({'Cookie' : cookies})
        .end(function (err, data) {
            if(err) throw err; // 获取主页面失败

            var seeJson = JSON.parse(data.text.replace(/^_Callback\(/, '').replace(/\)/, ''));
            seeJson.data.module_3.data.items.forEach(function(item, index){
                QQNumbers.push(item.uin);
                console.log(item.uin);
            })

        })

}




/**
 * 将 string 格式的内容转换为http请求的cookie格式字符串
 * 并且操作全局变量 jsonCookie 和 cookies 也随之改变
 * 
 * @param  {string} str 需要被转换的对象
 * @return {string}      转换后的cookie形式的字符串
 */
function out2cookies(str){

    // 先清空当前的 jsonCookie
    jsonCookie = {};

    // 输入格式判断
    if(typeof str !== 'string') throw new Error("未传入有效数据!");

    var pattern = /<Cookie (.*?)=(.*?) for /g;

    var match;

    while((match = pattern.exec(str)) !== null){
        cookies += (match[1] + '=' + match[2] + '; ');
        jsonCookie[match[1]] = match[2];
    }

    return cookies.replace(/; $/, '');
}

/**
王豪QQ    616772663
测试用QQ   3095623630


部分数据的请求地址: http://r.qzone.qq.com/cgi-bin/main_page_cgi?uin=616772663&param=3_616772663_0%7C8_8_3095623630_0_1_0_0_1%7C15%7C16&g_tk=320979203
    其中 module3 里面是 最近访客

部分数据的请求地址: https://h5.qzone.qq.com/proxy/domain/m.qzone.qq.com/cgi-bin/new/get_msgb?uin=3095623630&hostUin=616772663&start=0&s=0.12159129992366813&format=jsonp&num=10&inCharset=utf-8&outCharset=utf-8&g_tk=320979203

 */
