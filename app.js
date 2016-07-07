var request    = require("superagent");
var cheerio    = require("cheerio");

var exec       = require("child_process").exec;


var jsonCookie = {};    // 以 JSON 形式保存的当前cookie值
// var cookies    = '';       // 以传输形式保存的当前cookie值

var QQNumbers  = [];     // 收集到的QQ号码

// Config
var config     = {
    userQQ      : 3095623630,
    password    : 'testtest'
}


// 通用的HTTP请求头(不含cookie)
var HTTPheaders = {
    // 'Accept'            : 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept' : '*/*',
    'Accept-Encoding'   : 'gzip, deflate, sdch',
    'Accept-Language'   : 'zh-CN,zh;q=0.8,zh-TW;q=0.6',
    'Cache-Control'     : 'no-cache',
    'Connection'        : 'keep-alive',
    'User-Agent'        : 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Ubuntu Chromium/51.0.2704.79 Chrome/51.0.2704.79 Safari/537.36',
    'Upgrade-Insecure-Requests'     : '1',   
    'Pragma'            : 'no-cache',
    'Host'              : 'r.qzone.qq.com'
}

// 测试性质 留言板的请求头
var msgBoardHeader = {
    'Accept' : '*/*',
    'Accept-Encoding'   : 'gzip, deflate, sdch, br',
    'Accept-Language'   : 'zh-CN,zh;q=0.8,zh-TW;q=0.6',
    'Cache-Control'     : 'no-cache',
    'Pragma'            : 'no-cache',
    'referer'           : 'http://user.qzone.qq.com/616772663',
    'User-Agent'        : 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Ubuntu Chromium/51.0.2704.79 Chrome/51.0.2704.79 Safari/537.36',
}


// 调用登录模块, 进行登录并获取到登陆后的 cookie 内容
exec('python ./QQLib/test.py ' + config.userQQ + ' ' + config.password + '', function(err,stdout,stderr){

    if(err) throw err; // 登录失败

    out2jsoncookies(stdout);
    getMainPage(616772663, config.userQQ, json2cookies(jsonCookie));
})

/**
 * 获取主页面
 * 主要目的是返回的 响应头有好几个 set-cookie 貌似有点用....
 * 其他的目的...慢慢摸索吧...
 * 
 * @param  {QQ} targetQQ  目标人物的QQ号
 * @param  {QQ} currentQQ 当前爬虫正在使用的QQ号
 * @param  {string} cookies   当前cookie的传输格式
 */
function getMainPage(targetQQ, currentQQ, cookie){
    request.get("http://user.qzone.qq.com/" + targetQQ)
        .set(HTTPheaders)
        .set({Cookie : cookie})
        .end(function(err, data){
            if(err) throw err; // 获取 QQ空间主页面失败
            data.headers['set-cookie'].forEach(function(item, index){
                var pattern = /(.*?)=(.*?);/;
                var match = pattern.exec(item);
                if(match !== null){addCookie(match[1], match[2])}
            })

            // 先加这么多... cookie多一点总比少一点好....应该是这样吧
            addCookie('pgv_pvi', getPgv());
            addCookie('pgv_si', getPgv('s'));
            addCookie('pgv_info', 'ssid=' + getPgv('s'));
            addCookie('pgv_pvid', getPgv());
            addCookie('pac_uid', '1_' + currentQQ);
            addCookie('o_cookie', currentQQ);
            addCookie('QZ_FE_WEBP_SUPPORT', '1');
            addCookie('__Q_w_s_hat_seed', '1');
            addCookie('__Q_w_s__QZN_TodoMsgCnt', '1');
            addCookie('Loading', 'Yes');
            addCookie('cpu_performance_v8', '2');
            addCookie('qqmusic_uin', '');
            addCookie('qqmusic_key', '');
            addCookie('qqmusic_fromtag', '');

            addCookie('qzone_check', currentQQ + '_' + Math.round(Date.now() / 1000));

            console.log(jsonCookie)

            getMsgBoard(targetQQ, config.userQQ, json2cookies(jsonCookie))

        })
}



/**
 * 获取QQ空间留言板的信息
 * 然而..这东西还并没有完成
 * 获取到的内容 data.text 一直是 undefined
 * 可能是 cookie 里没加 verifysession ? 但我并不知道怎么加这东西啊....
 * 先放着吧.. 到时候再捡起来看看...
 * 
 * @param  {QQ} targetQQ  目标人物的QQ号
 * @param  {QQ} currentQQ 当前爬虫正在使用的QQ号
 * @param  {string} cookies   当前cookie的传输格式
 */
function getMsgBoard(targetQQ, currentQQ, cookies){
    request.get('https://h5.qzone.qq.com/proxy/domain/m.qzone.qq.com/cgi-bin/new/get_msgb')
        .set(msgBoardHeader)
        .set({Cookie : cookies})
        .query({
            uin         : currentQQ,
            hostUin     : targetQQ,
            start       : 0,
            format      : 'jsonp',
            num         : 10,
            inCharset   : 'utf-8',
            outCharset  : 'utf-8',
            g_tk        : getGTK(jsonCookie.p_skey)
        })
        .end(function(err, data){
            if(err) throw err;      // 获取留言板消息失败
            // console.log(cookies)
            console.log(data)
        })
}



/**
 * 获取最近来访的好友 注意: 只有真正的QQ好友才允许请求到信息...所以好像并没有什么卵用...
 * 这函数在请求完以后会把最近访问的 QQ 号 push 到全局变量 QQNumbers 里面
 *
 * Warning: 天坑注意!!!
 * 
 * @param  {QQ} targetQQ  目标人物的QQ号
 * @param  {QQ} currentQQ 当前爬虫正在使用的QQ号
 * @param  {string} cookies   当前cookie的传输格式
 */
function getRecentFriends(targetQQ, currentQQ, cookies){

    request.get('http://r.qzone.qq.com/cgi-bin/main_page_cgi')
        .set(HTTPheaders)
        .set({Cookie : cookies})
        .query({
            uin     : targetQQ,
            param   : '3_' + targetQQ + '_0|8_8_' + currentQQ + '_0_1_0_0_1|15|16',
            g_tk    : getGTK(jsonCookie.p_skey)
        })
        .end(function (err, data) {
            if(err) throw err; // 获取主页面失败

            // console.log(getGTK(jsonCookie.p_skey))
            // console.log(jsonCookie)
            // console.log(cookies)
            // console.log(data.text)

            var seeJson = JSON.parse(data.text.replace(/^_Callback\(/, '').replace(/\)/, ''));

            seeJson.data.module_3.data.items.forEach(function(item, index){
                QQNumbers.push(item.uin);
                console.log(item.uin)
            })

        })

}


/**
 * 获取QQ空间验证手段之一的 G_TK
 * G_TK 的生成函数如下所示 来自 http://cm.qzonestyle.gtimg.cn/ac/qzone/qzfl/qzfl_v8_2.1.45.js
 * G_TK 应该附在 GET 请求中一起发送
 * 
 * @param  {string} p_skey cookie 里的 p_skey
 * @return {string}        生成的 G_TK 附在 GET 请求中一起发送
 */
function getGTK(p_skey){
    var hash = 5381;
    for (var i = 0, len = p_skey.length; i < len; ++i) hash += (hash << 5) + p_skey.charCodeAt(i);
    return hash & 2147483647
}


/**
 * 将 string 格式的内容添加到全局变量 jsonCookie
 * 
 * @param  {string} str 需要被转换的对象
 */
function out2jsoncookies(str){

    // 先清空当前的 jsonCookie
    jsonCookie = {};

    // 输入格式判断
    if(typeof str !== 'string') throw new Error("未传入有效数据!");

    var pattern = /<Cookie (.*?)=(.*?) for /g;

    var match;

    while((match = pattern.exec(str)) !== null){
        jsonCookie[match[1]] = match[2];
    }
}

/**
 * 将 json 形式的 cookie 值转换为传输形式的 cookie 值
 * 
 * @param  {json} json   json 形式的 cookie 值
 * @return {string}      用于传输的cookie值
 */
function json2cookies(json){

    if(typeof json !== 'object') throw new Error("未传入有效数据!");

    var cookie = "";

    for(var i in json){
        // 天坑注意: 下一句中的分号后的空格一定不能丢!!!
        cookie += (i + '=' + json[i] + '; ');
    }

    return cookie;
}

/**
 * 向当前 cookie 中添加新的 cookie 值
 * 该函数会同时向 jsonCookie 和 cookies 里面添加新值
 * 
 * @param {string} key   新的 cookie 的键
 * @param {string} value 新的 cookie 的值
 */
function addCookie(key, value){
    jsonCookie[key] = value;
}

/**
 * 计算 cookie 中的 pgv_pvi 和 pgv_si 的值
 * 百度到的东西...不知道靠不靠谱
 * 计算 pgv_pvi 就是 getPgv()
 * 计算 pgv_si  则是 getPgv('s')
 * 
 * @return {string}   计算到的 pgv_pvi 或 pgv_si
 */
function getPgv(d) {
    return (d || "") + Math.round(2147483647 * (Math.random() || 0.5)) * +new Date % 1E10
}

/**
王豪QQ    616772663
测试用QQ   3095623630


部分数据的请求地址: http://r.qzone.qq.com/cgi-bin/main_page_cgi?uin=616772663&param=3_616772663_0%7C8_8_3095623630_0_1_0_0_1%7C15%7C16&g_tk=320979203
    其中 module3 里面是 最近访客

部分数据的请求地址: https://h5.qzone.qq.com/proxy/domain/m.qzone.qq.com/cgi-bin/new/get_msgb?uin=3095623630&hostUin=616772663&start=0&s=0.12159129992366813&format=jsonp&num=10&inCharset=utf-8&outCharset=utf-8&g_tk=320979203
    内容: 留言板的消息


cookie 相关:
    传输形式的 cookie 每个分号之后必须要留一个空格!!!
    如果不留空格, 以获取最近访问为例, 就会出现
        "由于对方权限设置，您不能进行此操作" 的情况


 */
