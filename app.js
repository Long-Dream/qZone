var request    = require("superagent");
var cheerio    = require("cheerio");
var fs         = require("fs")
var QQSafe     = require('./QzoneLogin.js')

var cp         = require("child_process");
var exec       = require("child_process").exec;


var jsonCookie = [];    // 以 JSON 形式保存的当前cookie值

var QQNumbers  = [];    // 收集到的QQ号码, 待爬取
var QQdone     = [];    // 收集到的QQ号码, 已爬取

var QQtorrent  = [470501491];    // 种子 QQ 号, 星星之火, 可以燎原

// Config
var config     = {
    // QQ 数组
    // 其中 isLogin 用于判断QQ是否已登录
    // 0 代表没有登录   1 代表登录成功
    QQ          : [
        // {userQQ      : 3095623630, password    : 'testtest', isLogin     : 0 },
        {userQQ      : 2170576112, password    : 'wcresdjh', isLogin     : 0 },
        // {userQQ      : 3332755205, password    : 'xvee22634', isLogin     : 0 },
        // {userQQ      : 3332784766, password    : 'kasi99753', isLogin     : 0 }
    ],

    boardNum    : 20,    // 留言板每次抓取的数量
    boardMax    : 60,   // 留言板的最大抓取数量
    shuoNum     : 40,    // 说说每次抓取的数量
    shuoMax     : 120,   // 说说的最大抓取数量
    timeout     : 3000   // 主函数两次爬取之间的间隔
}

// 判断当前是否处于输入验证码的状态中  0 代表不在输入验证码  大于 0 代表正在输入验证码
// 如果正在输入验证码, 那么请求暂停 → 也就是 mainStep 先暂时延时一下
var verifyFlag = 0;     

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
    // 'Host'              : 'r.qzone.qq.com'
    // 'Host' : 'base.s21.qzone.qq.com',
    // 'Host' : 'xui.ptlogin2.qq.com',
    'Referer' : 'http://ctc.qzs.qq.com/qzone/profile/index.html'
}

var LoginHeaders = {
    'Accept' : '*/*',
    'Accept-Encoding'   : 'gzip, deflate, sdch',
    'Accept-Language'   : 'zh-CN,zh;q=0.8,zh-TW;q=0.6',
    'Connection'        : 'keep-alive',
    'Host'              : 'ptlogin2.qq.com',
    'Referer'           : 'http://xui.ptlogin2.qq.com/cgi-bin/xlogin?proxy_url=http%3A//qzs.qq.com/qzone/v6/portal/proxy.html&daid=5&&hide_title_bar=1&low_login=0&qlogin_auto_login=1&no_verifyimg=1&link_target=blank&appid=549000912&style=22&target=self&s_url=http%3A%2F%2Fqzs.qq.com%2Fqzone%2Fv5%2Floginsucc.html%3Fpara%3Dizone&pt_qr_app=%E6%89%8B%E6%9C%BAQQ%E7%A9%BA%E9%97%B4&pt_qr_link=http%3A//z.qzone.com/download.html&self_regurl=http%3A//qzs.qq.com/qzone/v6/reg/index.html&pt_qr_help_link=http%3A//z.qzone.com/download.html',
    'User-Agent'        : 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Ubuntu Chromium/51.0.2704.79 Chrome/51.0.2704.79 Safari/537.36'
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

// 验证码 HTTP
var verifyHTTP = {
    'Accept':'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Encoding':'gzip, deflate, sdch',
    'Accept-Language':'zh-CN,zh;q=0.8,zh-TW;q=0.6',
    'Cache-Control':'no-cache',
    'Connection':'keep-alive',
    'Host':'check.ptlogin2.qq.com',
    'Pragma':'no-cache',
    'Upgrade-Insecure-Requests':'1',
    'User-Agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Ubuntu Chromium/51.0.2704.79 Chrome/51.0.2704.79 Safari/537.36'
}


getLoginCookie(0)




// Panzer Vor !!
// main();


/**
 * 主函数, 进行爬虫程序的调度
 */
function main(){

    // 每隔一段时间执行一次, 以防被 QQ空间 反爬程序盯上
    setTimeout(function(){mainStep();}, config.timeout)

    /**
     * 主函数的单步函数
     */
    function mainStep(){

        // 如果正在输入验证码, 则延迟执行请求
        if(!verifyFlag){
            console.log("等待输入验证码ing....")
            setTimeout(function(){mainStep();}, config.timeout);
            return;
        }

        console.log("QQNumbers 内有 " + QQNumbers.length + " 个 QQ 号, " + " QQdone 内有 " + QQdone.length + " 个 QQ 号.")

        // 检查当前所有的QQ号是否已登录, 若没有登录, 就进行登录
        var QQlist = checkQQ();
        
        // 利用已登录的 QQ 号开始爬取
        QQlist.forEach(function(item){

            // 先检查种子 QQ 号
            if(QQtorrent.length > 0){
                var fetchNum = QQtorrent.pop();
                QQdone.push(fetchNum);
                console.log("QQ 第 " + item + " 号, 开始爬取种子 QQ 号 " + fetchNum)
                fetchData(fetchNum, item);
                return;
            }

            // 再检查队列中的 QQ 号
            if(QQNumbers.length > 0){
                var fetchNum = QQNumbers.pop();
                QQdone.push(fetchNum);
                console.log("QQ 第 " + item + " 号, 开始爬取 QQ 号 " + fetchNum)
                fetchData(fetchNum, item);
                return;
            }

            console.log("星星之火即将熄灭!")

        })

        // 进行链式反应
        setTimeout(function(){mainStep();}, config.timeout)
    }


    /**
     * main 函数的辅助函数
     * 用于判断 QQ 是否已登录 并登录尚未登录的 QQ 同时将已登录的 QQ 的 ID 的数组返回
     * 
     * @return {array} QQlist 已登录的 QQ 的 ID 的数组
     */
    function checkQQ(){

        // 先定义一个已经登录好的 QQID 的数组
        var QQlist = [];

        // 检查 QQ 列表, 如果没有登录, 就进行登录; 如果已经登录, 就将其 ID 推进数组
        config.QQ.forEach(function(item, index){
            if(!item.isLogin){
                console.log("QQ 第 " + index + " 号 ,QQ 号 " + item.userQQ + " 准备登录!");
                QQLogin(index);
            } else if(item.isLogin === 1){
                QQlist.push(index);
            }
        })

        return QQlist;
    }

    /**
     * main 函数的辅助函数
     * 用于开始单次的爬取
     * 
     * @param  {QQ} targetQQ  目标人物的QQ号
     * @param  {QQ} currentQQID 当前爬虫正在使用的QQ号的ID
     * @return {[type]}             [description]
     */
    function fetchData(targetQQ, currentQQID){

        // 个人档信息
        getUserInfoAll(targetQQ, currentQQID);

        // 留言板信息
        getMsgBoard(targetQQ, currentQQID, config.boardNum)

        // 说说信息
        getShuoShuoMsgList(targetQQ, currentQQID, config.shuoNum)
    }
}


/**
 * 获取登录过程中所必须的 cookie 值
 * 
 * @param  {QQ} currentQQID 当前爬虫正在使用的QQ号的ID
 */
function getLoginCookie(currentQQID){

    request.get("http://xui.ptlogin2.qq.com/cgi-bin/xlogin?proxy_url=http%3A//qzs.qq.com/qzone/v6/portal/proxy.html&daid=5&&hide_title_bar=1&low_login=0&qlogin_auto_login=1&no_verifyimg=1&link_target=blank&appid=549000912&style=22&target=self&s_url=http%3A%2F%2Fqzs.qq.com%2Fqzone%2Fv5%2Floginsucc.html%3Fpara%3Dizone&pt_qr_app=%E6%89%8B%E6%9C%BAQQ%E7%A9%BA%E9%97%B4&pt_qr_link=http%3A//z.qzone.com/download.html&self_regurl=http%3A//qzs.qq.com/qzone/v6/reg/index.html&pt_qr_help_link=http%3A//z.qzone.com/download.html")
        .set(HTTPheaders)
        .end(function(err, data){
            if(err) throw err;      // 获取登录所必须的 cookie 值 失败!

            // 逐个访问 set-cookie 并进行添加
            data.headers['set-cookie'].forEach(function(item, index){
                var pattern = /(.*?)=(.*?);/;
                var match = pattern.exec(item);

                var oneCookie = {};
                oneCookie[match[1]] = match[2]
                if(match !== null){addCookie(oneCookie, currentQQID)}
            })

            // 这里装一些其他的, 比较重要的cookie
            var otherCookie = {
                _qz_referrer    : "qzone.qq.com",
                pgv_pvid        : getPgv_1(),
                pgv_info        : "ssid=" + getPgv_1('s'),
                pgv_pvi         : getPgv_2(),
                pgv_si          : getPgv_2('s'),
                ptui_loginuin   : config.QQ[currentQQID].userQQ
            }

            addCookie(otherCookie, currentQQID)

            getLoginCookie_qrsig(currentQQID);

        })
}

/**
 * 获取登录过程中所必须的 cookie 值----qrsig
 * 
 * @param  {QQ} currentQQID 当前爬虫正在使用的QQ号的ID
 */
function getLoginCookie_qrsig(currentQQID){

    request.get("http://ptlogin2.qq.com/ptqrshow?appid=549000912&e=2&l=M&s=3&d=72&v=4&t=" + Math.random() + "&daid=5")
        .set(HTTPheaders)
        .set({Cookie : json2cookies(jsonCookie[currentQQID])})
        .end(function(err, data){
            if(err) throw err;      // 获取 cookie : qrsig 失败

            data.headers['set-cookie'].forEach(function(item, index){
                var pattern = /(.*?)=(.*?);/;
                var match = pattern.exec(item);

                var oneCookie = {};
                oneCookie[match[1]] = match[2]
                if(match !== null){addCookie(oneCookie, currentQQID)}
            })
            getVerifyMsg(currentQQID)
        })
}


/**
 * ***调用 QQLib 进行QQ的登录, 并将返回的 cookie 值存储到 jsonCookie 中*** 已废弃
 *
 * 实现登录模块, 该模块需要先进行验证码的验证, 并获取两个关键的字段 verifycode 和 pt_verifysession_v1
 * 应该使用 query 的字符串形式, 以做到防止 * 被转义
 * 如果登录成功, 就将 config 里面的 isLogin 设为1
 * 
 * @param  {QQ} currentQQID 当前爬虫正在使用的QQ号的ID
 */
function QQLogin(currentQQID, verifycode, pt_verifysession_v1){
    // 调用登录模块, 进行登录并获取到登陆后的 cookie 内容
    // exec('python ./QQLib/test.py ' + config.QQ[currentQQID].userQQ + ' ' + config.QQ[currentQQID].password + ' ' + verifycode + ' ' + pt_verifysession_v1, function(err, stdout, stderr){

    //     if(err) throw err; // 登录失败
        
    //     console.log(stdout)

    //     out2jsoncookies(stdout, currentQQID);

    //     config.QQ[currentQQID].isLogin = 1;

    //     // getMainPage(616772663, config.userQQ, json2cookies(jsonCookie));
    //     // getMsgBoard(616772663, 0, config.shuoNum);
        
    //     // console.log(jsonCookie);
    //     // console.log(config)
    // })
    
    // 利用 nodeJs 自己摸索登录模块的实现! Fighting!
    
    // delete jsonCookie[currentQQID].pt_user_id;
    // delete jsonCookie[currentQQID].ptui_identifier;

    
    request.get("http://ptlogin2.qq.com/login")
        .set({Cookie : json2cookies(jsonCookie[currentQQID])})
        .set(LoginHeaders)
        .query({
            u               : config.QQ[currentQQID].userQQ,
            pt_vcode_v1     : 1,
            pt_randsalt     : 2,
            // pt_vcode_v1     : 0,
            // pt_randsalt     : 0,
            ptredirect      : 0,
            h               : 1,
            g               : 1,
            t               : 1,
            from_ui         : 1,
            ptlang          : 2052,
            // js_ver          : 10167,
            js_ver          : 10143,
            js_type         : 1,
            pt_uistyle      : 40,
            aid             : 549000912,
            daid            : 5,
            // action          : "2-3-" + Date.now()
            action          : '4-22-1450611437613'
        })
        .query("u1=http%3A%2F%2Fqzs.qq.com%2Fqzone%2Fv5%2Floginsucc.html%3Fpara%3Dizone")
        .query("verifycode=" + verifycode)
        .query("pt_verifysession_v1=" + pt_verifysession_v1)
        .query("p=" + getP(currentQQID, verifycode))
        .query("login_sig=" + jsonCookie[currentQQID].pt_login_sig)
        .end(function(err, data){
            if(err) throw err;      // 登录失败

            // console.log(data)

            data.on('data', function(chunk){
                // console.log(data)
                console.log(chunk.toString())
            })
        })
}

/**
 * 获取验证码的相关信息
 * 然后应该是将返回的内容添加到 cookie 里 
 * 
 * @param  {QQ} currentQQID 当前爬虫正在使用的QQ号的ID
 */
function getVerifyMsg(currentQQID){

    request.get('http://check.ptlogin2.qq.com/check')
        .set({Cookie : json2cookies(jsonCookie[currentQQID])})
        .set(HTTPheaders)
        .query({
            regmaster   : '',
            pt_tea      : 2,
            pt_vcode    : 1,
            uin         : config.QQ[currentQQID].userQQ,
            appid       : 549000912,
            js_ver      : 10166,
            js_type     : 1,
            login_sig   : jsonCookie.pt_login_sig,
            u1          : 'http://qzs.qq.com/qzone/v5/loginsucc.html?para=izone',
            r           : Math.random(),
            pt_uistyle  : 40
        })
        .end(function(err, data){
            if(err) throw err;

            // 这个请求里面也有一些比较重要的 cookie
            data.headers['set-cookie'].forEach(function(item, index){
                var pattern = /(.*?)=(.*?);/;
                var match = pattern.exec(item);

                var oneCookie = {};
                oneCookie[match[1]] = match[2]
                if(match !== null){addCookie(oneCookie, currentQQID)}
            })

            var text = '';

            data.on('data', function(chunk){
                text += chunk;
            })

            data.on('end', function(){

                var verifyArr = text.replace(/^ptui_checkVC\(/, '').replace(/\);$/, '').replace(/'/g, '').split(',')

                // 数组的第0个元素如果是 '1' , 则说明需要验证码; 如果第一个元素是 '0' , 则说明不需要验证码
                if (verifyArr[0] === "0"){
                    return console.log("QQ ID " + currentQQID +" 不需要验证码, 即将进行登录");
                } else if (verifyArr[0] === "1") {
                    console.log("QQ ID " + currentQQID +" 需要验证码, 即将进行验证码验证!")

                    // 进入获取验证码的第二阶段
                    getVerifyMoreMsg(currentQQID, verifyArr[1]);
                    return;
                }

                // 不应该走到这里
                throw new Error("一定是哪里出错了!");
            })
        })
}

/**
 * 获取验证码的相关信息 第二阶段
 * 需要用到第一阶段获取到的 cap_cd, 也就是 verifyArr[1]
 * 
 * @param  {QQ} currentQQID 当前爬虫正在接受治疗的QQ号的ID
 * @param  {string} cap_cd      第一阶段获取到的必要信息
 */
function getVerifyMoreMsg(currentQQID, cap_cd){

    request.get("http://captcha.qq.com/cap_union_show")
        .set({Cookie : json2cookies(jsonCookie[currentQQID])})
        .set(HTTPheaders)
        .query({
            clientype   : 2,
            uin         : config.QQ[currentQQID].userQQ,
            aid         : 549000912,
            pt_style    : 40
        })
        .query('cap_cd=' + cap_cd)
        .end(function(err, data){

            if(err) throw err;  // 获取验证码消息 第二阶段

            // 匹配 g_vsig
            var match = data.text.match(/var g_vsig = ".*?"/);

            // 如果不存在 g_vsig, 那就报错吧...
            if(!match)  throw new Error("验证码第二阶段 g_vsig 匹配失败!")

            var g_vsig = match[0].replace('var g_vsig = "', '').replace('"', '');

            // 进入获取验证码的第三阶段
            getVerifyImg(currentQQID, cap_cd, g_vsig)

        })
}

/**
 * 获取验证码相关信息 第三阶段
 * 根据前两步用到的 cap_cd 和 g_vsig, 获取验证码图片
 * 
 * @param  {QQ} currentQQID 当前爬虫正在接受治疗的QQ号的ID
 * @param  {string} cap_cd      第一阶段获取到的必要信息
 * @param  {string} g_vsig      第二阶段获取到的必要信息
 */
function getVerifyImg(currentQQID, cap_cd, g_vsig){

    var req = request.get("http://captcha.qq.com/getimgbysig")
        .set({Cookie : json2cookies(jsonCookie[currentQQID])})
        .set(HTTPheaders)
        .query({
            clientype   : 2,
            uin         : config.QQ[currentQQID].userQQ,
            aid         : 549000912,
            pt_style    : 40,
            rand        : Math.random(),
        })
        .query('cap_cd=' + cap_cd)
        .query('sig=' + g_vsig)
        .end(function(err, data){

            var imgName = 'ID' + currentQQID + '_' + new Date().toLocaleString().replace(/:/g, "").replace(/-/g, "").replace(/ /g, "_") + '.jpg'

            fs.writeFile('./verifyImg/' + imgName, data.body, function(err){
                if(err) throw err;      // 保存验证码图片时出现问题!

                // 此时禁止所有请求
                verifyFlag += 1;

                console.log("验证码图片已经保存, 请打开" + './verifyImg/' + imgName +　' , 并在下方输入验证码: ')

                // 开启输入
                process.stdin.resume();
                process.stdin.setEncoding('utf8');

                // 绑定输入事件, 此处的 dataFun 是为了给函数起个名字, 方便到时候进行移除
                process.stdin.on('data', function dataFun(chunk){

                    process.stdin.pause();

                    // 先行检查验证码的字符数
                    if(chunk.length !== 5){
                        process.stdin.resume();
                        console.log("验证码只有 4 个字符哦, 请重新输入:");
                        return;
                    }

                    // NOTICE: 有坑注意!  及时移除事件, 不然下次执行 process.stdin.on('data') 还会绑定第二个事件!
                    process.stdin.removeListener('data', dataFun);

                    ans = chunk.slice(0, 4);
                    getVerifyResult(currentQQID, cap_cd, g_vsig, ans);
                    return;
                })

            })
        })
}

/**
 * 获取验证码的相关信息 第四阶段
 * 用于对输入的验证码进行验证
 * 
 * @param  {QQ} currentQQID 当前爬虫正在接受治疗的QQ号的ID
 * @param  {string} cap_cd      第一阶段获取到的必要信息
 * @param  {string} g_vsig      第二阶段获取到的必要信息
 * @param  {string} ans         第三阶段所收集到的验证码答案
 */
function getVerifyResult(currentQQID, cap_cd, g_vsig, ans){

    request.get("http://captcha.qq.com/cap_union_verify_new")
        .set({Cookie : json2cookies(jsonCookie[currentQQID])})
        .set(HTTPheaders)
        .query({
            clientype   : 2,
            uin         : config.QQ[currentQQID].userQQ,
            aid         : 549000912,
            pt_style    : 40,
            rand        : Math.random(),
            capclass    : 0,
            ans         : ans
        })
        .query('cap_cd=' + cap_cd)
        .query('sig=' + g_vsig)
        .end(function(err, data){
            if(err) throw err;      // 获取验证码结果失败

            var resultJson = JSON.parse(data.text);

            // 验证失败
            if (resultJson.errorCode === "50"){
                console.log(resultJson.errMessage);
                // 重发获取 sig 的请求就行
                getVerifyMoreMsg(currentQQID, cap_cd)
                return;
            }

            // 验证成功
            // 但我并不知道验证成功后应该怎么做....
            if (resultJson.errorCode === "0"){
                console.log("验证成功, 撒花~~~  即将进行登录");
                QQLogin(currentQQID, resultJson.randstr, resultJson.ticket)
            }
        })

}



/**
 * 获取主页面
 * 主要目的是返回的 响应头有好几个 set-cookie 貌似有点用....
 * 其他的目的...慢慢摸索吧...
 * 
 * @param  {QQ} targetQQ  目标人物的QQ号
 * @param  {QQ} currentQQID 当前爬虫正在使用的QQ号的ID
 */
function getMainPage(targetQQ, currentQQID){
    request.get("http://user.qzone.qq.com/" + targetQQ)
        .set(HTTPheaders)
        .set({Cookie : json2cookies(jsonCookie[currentQQID])})
        .end(function(err, data){
            if(err) throw err; // 获取 QQ空间主页面失败
            data.headers['set-cookie'].forEach(function(item, index){
                var pattern = /(.*?)=(.*?);/;
                var match = pattern.exec(item);
                if(match !== null){addCookie(match[1], match[2])}
            })

            // 先加这么多... cookie多一点总比少一点好....应该是这样吧
            addCookie({
                pgv_pvi     : getPgv(),
                pgv_si      : getPgv('s'),
                pgv_info    : 'ssid=' + getPgv('s'),
                pgv_pvid    : getPgv(),
                pac_uid     : '1_' + config.QQ[currentQQID].userQQ,
                o_cookie    : config.QQ[currentQQID].userQQ,
                QZ_FE_WEBP_SUPPORT : 1,
                __Q_w_s_hat_seed : 1,
                __Q_w_s__QZN_TodoMsgCnt : 1,
                Loading     : 'Yes',
                cpu_performance_v8 : 2,
                qqmusic_uin : '',
                qqmusic_key : '',
                qqmusic_fromtag : '',
                qzone_check : config.QQ[currentQQID].userQQ + '_' + Math.round(Date.now() / 1000)
            });

            // console.log(jsonCookie)

        })
}

/**
 * 获取个人档里的相关信息
 * 
 * @param  {QQ} targetQQ  目标人物的QQ号
 * @param  {QQ} currentQQID 当前爬虫正在使用的QQ号的ID
 */
function getUserInfoAll(targetQQ, currentQQID){

    request.get('http://base.s21.qzone.qq.com/cgi-bin/user/cgi_userinfo_get_all')
        .set(HTTPheaders)
        .set({Cookie : json2cookies(jsonCookie[currentQQID])})
        .query({
            uin     : targetQQ,
            vuin    : config.QQ[currentQQID].userQQ,
            fupdate : 1,
            rd      : 0.057868526378582094,
            g_tk    : getGTK(jsonCookie[currentQQID].p_skey)
        })
        .end(function(err, data){

            if(err) throw err;      // 获取个人档信息失败

            var text = '';
            data.on('data', function(chunk){
                text += chunk;
            })
            data.on('end', function(chunk){
                console.log("QQ ID " + currentQQID +" 已获得 " + targetQQ + " 的个人档信息!");
            })
            
        })
}


/**
 * 获取QQ空间留言板的信息
 * 然而..这东西还并没有完成
 * 获取到的内容 data.text 一直是 undefined
 * 可能是 cookie 里没加 verifysession ? 但我并不知道怎么加这东西啊....
 * 先放着吧.. 到时候再捡起来看看...
 *
 * 更新: 嗯..不是 verifysession 的问题 
 * 原因就是数据是以流的形式进行传输
 * 而我居然把这个给忘掉了....
 * 
 * @param  {QQ} targetQQ  目标人物的QQ号
 * @param  {QQ} currentQQID 当前爬虫正在使用的QQ号的ID
 * @param  {int} boardNum 每次抓取的留言板条数
 * @param  {int} startNum 开始的留言板条数  默认为 0
 */
function getMsgBoard(targetQQ, currentQQID, boardNum, startNum){

    // 将开始数默认为 0
    startNum = startNum || 0;

    request.get('https://h5.qzone.qq.com/proxy/domain/m.qzone.qq.com/cgi-bin/new/get_msgb')
        .set(msgBoardHeader)
        .set({Cookie : json2cookies(jsonCookie[currentQQID])})
        .query({
            uin         : config.QQ[currentQQID].userQQ,
            hostUin     : targetQQ,
            start       : startNum,
            format      : 'jsonp',
            num         : 20,
            inCharset   : 'utf-8',
            outCharset  : 'utf-8',
            g_tk        : getGTK(jsonCookie[currentQQID].p_skey)
        })
        .end(function(err, data){
            if(err) throw err;      // 获取留言板消息失败
            var text = '';
            data.on('data', function(chunk){
                text += chunk;
            })
            data.on('end', function(chunk){

                var boardJson = JSON.parse(text.replace(/^_Callback\(/, '').replace(/\);$/, ''));

                // 权限检查 以及 登录检查
                switch(boardJson.code){
                    case -4009  : return console.log('获取留言板 ' +　targetQQ + " : 没有权限");
                    case -4001  : return console.log('获取留言板 ' +　targetQQ + " : 没有登录");
                    case  1003  : return console.log('获取留言板 ' +　targetQQ + " : 操作过于频繁");
                    case -5007  : return console.log('获取留言板 ' +　targetQQ + " : 系统繁忙1");
                    case -5008  : return console.log('获取留言板 ' +　targetQQ + " : 系统繁忙2");
                    case -30002 : return console.log('获取留言板 ' +　targetQQ + " : 系统繁忙3");
                    case -4013  : return console.log('获取留言板 ' +　targetQQ + " : 空间未开通");
                    case -4014  : return console.log('获取留言板 ' +　targetQQ + " : 空间被封闭");
                }

                // 返回消息代码 二次确认
                if(boardJson.code !==  0) {debugger;return;}
                // if(boardJson.code !==  0) throw new Error("获取留言板, 收到未知代码")

                // 就算返回代码正确, list 仍然可能没有被定义
                if(!boardJson.data.commentList) return;

                console.log("QQ ID " + currentQQID +" 留言板消息" +　targetQQ + " : 获取成功, 从第 " + startNum + " 条开始, 留言板的信息共有 " + boardJson.data.total + " 条");

                // 如果 startNum 为 0, 就说明是首次抓取该 QQ 号的留言板
                // 那就对留言板的数量进行分析 并对每一页都发出抓取信号
                if(startNum === 0 && boardJson.data.total > boardNum){
                    for(var i = boardNum; i < Math.min(boardJson.data.total, config.boardMax); i += boardNum){
                        getMsgBoard(targetQQ, currentQQID, boardNum, i)
                    }
                }

                boardJson.data.commentList.forEach(function(item, index){

                    // 检查 item.uin 是否存在 以及 是否为数
                    if(typeof item.uin !== 'number') return;

                    // 检查是否已经爬过
                    // 如果是小鲜肉, 就将其深入
                    // TODO : 后期程序成型后, 将小鲜肉立刻深入改为排队站好逐个深入
                    if(isFreshman(item.uin)){
                        QQNumbers.push(item.uin);
                        console.log("QQ ID " + currentQQID +" 当前留言板爬取 QQ : " + targetQQ + ", 已将 QQ " + item.uin + " 加入队列")
                        // getMsgBoard(item.uin, currentQQID, boardNum);
                    }
                })
            })
        })
}

/**
 * 获取某一个用户的说说列表
 * 返回的内容不是流!!! 而是直接写在了 data.text 里面
 * 
 * @param  {QQ} targetQQ  目标人物的QQ号
 * @param  {QQ} currentQQID 当前爬虫正在使用的QQ号的ID
 */
function getShuoShuoMsgList(targetQQ, currentQQID, shuoNum, startNum){

    // 将开始数默认为 0
    startNum = startNum || 0;

    request.get("https://h5.qzone.qq.com/proxy/domain/taotao.qq.com/cgi-bin/emotion_cgi_msglist_v6")
        .set(msgBoardHeader)
        .set({Cookie : json2cookies(jsonCookie[currentQQID])})
        .query({
            uin         : targetQQ,
            inCharset   : 'utf-8',
            outCharset  : 'utf-8',
            hostUin     : targetQQ,
            notice      : 0,
            sort        : 0,
            pos         : startNum,
            num         : shuoNum,
            cgi_host    : 'http://taotao.qq.com/cgi-bin/emotion_cgi_msglist_v6',
            code_version    : 1,
            format      : 'jsonp',
            need_private_comment    : 1,
            g_tk        : getGTK(jsonCookie[currentQQID].p_skey)
        })
        .end(function(err, data){
            if(err) throw err;      // 获取说说消息失败

            // console.log(data.text)

            var msgListJson = JSON.parse(data.text.replace(/^_Callback\(/, '').replace(/\);$/, ''));

            // 权限检查 以及 登录检查
            switch(msgListJson.code){
                case -10031 : return console.log('获取说说 ' +　targetQQ + " : 没有权限");
                case -3000  : return console.log('获取说说 ' +　targetQQ + " : 没有登录");
                case -10000 : return console.log('获取说说 ' +　targetQQ + " : 操作过于频繁");
            }

            // 返回消息代码 二次确认
            // if(msgListJson.code !== 0) throw new Error("获取说说消息, 收到未知代码")
            if(msgListJson.code !== 0) debugger;

            // 就算返回代码正确, list 仍然可能没有被定义
            if(!msgListJson.msglist) return;

            console.log("QQ ID " + currentQQID +" 说说消息" +　targetQQ + " : 获取成功, 从第 " + startNum + " 条开始, 留言板的信息共有 " + msgListJson.total + " 条");

            // 如果 startNum 为 0, 就说明是首次抓取该 QQ 号的说说
            // 那就对说说的数量进行分析 并对每一页都发出抓取信号
            if(startNum === 0 && msgListJson.total > shuoNum){
                for(var i = shuoNum; i < Math.min(msgListJson.total, config.shuoMax); i += shuoNum){
                    getShuoShuoMsgList(targetQQ, currentQQID, shuoNum, i)
                }
            }
            
            msgListJson.msglist.forEach(function(item, index){

                // 以下几行用于展示说说, 并没有什么实际用处
                // console.log("说说: " + (item.content === '' ? "*该用户在转发时保持了沉默*" : item.content))
                // if(item.rt_con){ console.log("   By 转发说说 : " + item.rt_con.content) }
                // console.log('\n')
                
                // 通过评论内容 获取好友的信息
                // 如果有评论的话, 那么将评论列表里的所有人的 QQ 号都再进行深入爬取
                if(item.rtlist){
                    item.rtlist.forEach(function(replyItem, replyIndex){

                        // 将爬到的 QQ 加入到队列中
                        if(typeof replyItem.uin === 'number' && isFreshman(replyItem.uin)){
                            QQNumbers.push(replyItem.uin);
                            console.log("QQ ID " + currentQQID +" 当前说说爬取 QQ : " + targetQQ + ", 已将 QQ " + replyItem.uin + " 加入队列")
                            // getShuoShuoMsgList(replyItem.uin, currentQQID, shuoNum)
                        }

                    })
                }
            })
        })
}



/**
 * 获取最近来访的好友 注意: 只有真正的QQ好友才允许请求到信息...所以好像并没有什么卵用...
 * 这函数在请求完以后会把最近访问的 QQ 号 push 到全局变量 QQNumbers 里面
 *
 * Warning: 天坑注意!!!
 * 
 * @param  {QQ} targetQQ  目标人物的QQ号
 * @param  {QQ} currentQQID 当前爬虫正在使用的QQ号的ID
 */
function getRecentFriends(targetQQ, currentQQID){

    request.get('http://r.qzone.qq.com/cgi-bin/main_page_cgi')
        .set(HTTPheaders)
        .set({Cookie : json2cookies(jsonCookie[currentQQID])})
        .query({
            uin     : targetQQ,
            param   : '3_' + targetQQ + '_0|8_8_' + config.QQ[currentQQID].userQQ + '_0_1_0_0_1|15|16',
            g_tk    : getGTK(jsonCookie[currentQQID].p_skey)
        })
        .end(function (err, data) {
            if(err) throw err; // 获取主页面失败

            var seeJson = JSON.parse(data.text.replace(/^_Callback\(/, '').replace(/\)/, ''));

            seeJson.data.module_3.data.items.forEach(function(item, index){
                QQNumbers.push(item.uin);
                console.log(item.uin)
            })

        })

}


/**
 * 获取QQ空间验证手段之一的 字段 p
 * 这加密方式能恶心坏我....结果到最终都不知道这个 P 是怎么得出来的...
 * 反正就是把现行的 c_login_2.js 先把 window 全部换成 global
 * 然后一部分一部分地拷进 js 文件里
 *
 * 啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊
 * 
 * @param  {QQ}     currentQQID 当前爬虫正在使用的QQ号的ID
 * @param  {string} verifycode  获取到的 verifycode
 * @return {string}             计算出来的结果 p
 */
function getP(currentQQID, verifycode){

    var password = config.QQ[currentQQID].password;
    var salt     = QQSafe.uin2hex(config.QQ[currentQQID].userQQ);

    /**
     * QQSafe.getEncryption 是腾讯自家的计算字段 p 的方法
     * 四个参数的含义略
     */
    var result = QQSafe.getEncryption(password, salt, verifycode);

    return result;

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
 * @param  {QQ} currentQQID 当前爬虫正在使用的QQ号的ID
 */
function out2jsoncookies(str, currentQQID){

    // 先清空当前的 jsonCookie
    jsonCookie[currentQQID] = {};

    // 输入格式判断
    if(typeof str !== 'string') throw new Error("未传入有效数据!");

    var pattern = /<Cookie (.*?)=(.*?) for /g;

    var match;

    while((match = pattern.exec(str)) !== null){
        jsonCookie[currentQQID][match[1]] = match[2];
    }
}

/**
 * 将 json 形式的 cookie 值转换为传输形式的 cookie 值
 * 
 * @param  {json} json   json 形式的 cookie 值
 * @return {string}      用于传输的cookie值
 */
function json2cookies(json){

    if(typeof json !== 'object' && typeof json !== 'undefined') throw new Error("未传入有效数据!");

    var cookie = "";

    for(var i in json){
        // 天坑注意: 下一句中的分号后的空格一定不能丢!!!
        cookie += (i + '=' + json[i] + '; ');
    }

    return cookie;
}

/**
 * 向当前 cookie 中添加新的 cookie 值
 *
 * @param {object} obj          cookie 对象 里面存储者键和值
 * @param {number} cookieID     当前 QQ 号的ID
 */
function addCookie(obj, cookieID){

    if(typeof obj !== 'object' || typeof cookieID !== 'number') throw new Error("添加cookie : 请输入正确的格式!")

    if(typeof jsonCookie[cookieID] === 'undefined') jsonCookie[cookieID] = {};

    for(var i in obj){
        jsonCookie[cookieID][i] = obj[i];
    }
    return;

}

/**
 * 计算 cookie 中的 pgv_pvid 和 pgv_info 的值
 * 百度到的东西...不知道靠不靠谱
 * 计算 pgv_pvid  就是 getPgv_1()
 * 计算 pgv_info  则是 getPgv_1('s')
 * 
 * @return {string}   计算到的 pgv_pvid 或 pgv_info
 */
function getPgv_1(d) {
    return (d || "") + (Math.round(Math.random() * 2147483647) * (new Date().getUTCMilliseconds())) % 10000000000;
}

/**
 * 计算 cookie 中的 pgv_pvi 和 pgv_si 的值
 * 百度到的东西...不知道靠不靠谱
 * 计算 pgv_pvi  就是 getPgv_2()
 * 计算 pgv_si   则是 getPgv_2('s')
 * 
 * @return {string}   计算到的 pgv_pvi 或 pgv_si
 */
function getPgv_2(d) {
    return (d || "") + Math.round(2147483647 * (Math.random() || 0.5)) * +new Date % 1E10
}

/**
 * 判断是否已经被爬过
 * 
 * @param  {QQ}  QQ 所要进行检查的QQ号
 * @return {Boolean}    1 代表还没有被爬过   0 代表已经不是小鲜肉了
 */
function isFreshman(QQ){
    return (QQNumbers.indexOf(QQ) === -1 && QQdone.indexOf(QQ) === -1);
}

/**
王豪QQ    616772663  
测试用QQ   3095623630          已冻结

淘宝购买小号:

    7月13日 购买
        3317753772----orii02058  已冻结
        3332755205----   
        3332784766----kasi99753  已冻结
    7月14日 购买
        2170576112----wcresdjh 


部分数据的请求地址: http://r.qzone.qq.com/cgi-bin/main_page_cgi?uin=616772663&param=3_616772663_0%7C8_8_3095623630_0_1_0_0_1%7C15%7C16&g_tk=320979203
    其中 module3 里面是 最近访客

留言板消息的请求地址: https://h5.qzone.qq.com/proxy/domain/m.qzone.qq.com/cgi-bin/new/get_msgb?uin=3095623630&hostUin=616772663&start=0&s=0.12159129992366813&format=jsonp&num=10&inCharset=utf-8&outCharset=utf-8&g_tk=320979203

    最大获取数量 : 20

    可能的情况:
        操作过于频繁
            {"code":1003,"subcode":1003,"message":"操作过于频繁咯！休息会再来操作吧！","notice":0,"time":1468243828,"tips":"0000-0","data":{}}
        系统繁忙
            {"code":-5007,"subcode":-28,"message":"系统繁忙，请稍后再试","notice":0,"time":1468249236,"tips":"0000-0","data":{}}
            {"code":-30002,"subcode":-3,"message":"系统繁忙，请稍后再试","notice":0,"time":1468249568,"tips":"0000-0","data":{}}
            {"code":-5008,"subcode":-28,"message":"系统繁忙，请稍后再试","notice":0,"time":1468300501,"tips":"0000-0","data":{}}"
        空间未开通
            {"code":-4013,"subcode":-4013,"message":"空间未开通","notice":0,"time":1468249349,"tips":"0000-0","data":{}}
        空间被封闭
            {"code":-4014,"subcode":-4014,"message":"空间被封闭","notice":0,"time":1468249463,"tips":"0000-0","data":{}}
        权限没有
            _Callback({
                "code":-4009,
                "subcode":-4009,
                "message":"空间主人设置了访问权限，您无法进行操作",
                "notice":0,
                "time":1468215247,
                "tips":"0000-0",
                "data":{}
            }
            );
        未登录
            _Callback({
                "code":-4001,
                "subcode":-4001,
                "message":"您还没有登陆,请先登陆",
                "notice":0,
                "time":1468215345,
                "tips":"0000-0",
                "data":{}
            }
            );
        获取成功
            见文件 留言板_获取成功_示例.js
        

个人档信息获取地址: http://base.s21.qzone.qq.com/cgi-bin/user/cgi_userinfo_get_all?uin=616772663&vuin=3095623630&fupdate=1&rd=0.057868526378572094&g_tk=1982035933



验证码1 获取地址: http://check.ptlogin2.qq.com/check?regmaster=&pt_tea=2&pt_vcode=1&uin=3095623630&appid=549000912&js_ver=10166&js_type=1&login_sig=oclBfCAaRbEUeYIEs58pWBYzIp*tHtBOYlkxjXqUVi*2gBSdtaftiw0bCrkv0E5L&u1=http%3A%2F%2Fqzs.qq.com%2Fqzone%2Fv5%2Floginsucc.html%3Fpara%3Dizone&r=0.3091402225059401&pt_uistyle=40
    获取示例:

    不需要验证码:
        ptui_checkVC('0','!CKM','\x00\x00\x00\x00\xb8\x83\x77\xce','04f067eb42adc886b9c8c9e20e7ebc31686e1fa7e94eb798f158aae2070cdaea5c38e913b140241bb094881846aa5b13e7d08559d6d2becc','2')
    需要验证码:
        ptui_checkVC('1','THO2WOw4EZs9zRffNObG6HC9cC1mTRlqAAQmprIDI-uQQb16wbd_Gw**','\x00\x00\x00\x00\xb8\x83\x77\xce','','2');
验证码2 文档获取地址:http://captcha.qq.com/cap_union_show?clientype=2&uin=3095623630&aid=549000912&cap_cd=THO2WOw4EZs9zRffNObG6HC9cC1mTRlqAAQmprIDI-uQQb16wbd_Gw**&pt_style=40&0.7694536918397665
    其中 cap_cd 是 验证码1 需要验证码情况的第二个参数
    请求该地址, 会返回一个文档
        文档见 验证码2 返回文档.html
    文档第 132 行 会有一个 g_vsig , 这个是获取验证码图片的关键

验证码3 图片获取地址:http://captcha.qq.com/getimgbysig?clientype=2&uin=3095623630&aid=549000912&cap_cd=THO2WOw4EZs9zRffNObG6HC9cC1mTRlqAAQmprIDI-uQQb16wbd_Gw**&pt_style=40&0.7694536918397665&rand=0.5433495875215326&sig=gwkdorpjiYpG4lLwiv8ukMV8lCSHRAKgvXQaiGAofT4w0Mb6jKpKIgW1p9grIekpkD65rRIm1Swwu9hrM2cEvR9kCydsb46A-neP9fw_1CrIWtH5Ak3zAaw**
    其中 cap_cd 是 验证码1 需要验证码情况的第二个参数
         sig 是 验证码2 获取到的 g_vsig

发送验证码: http://captcha.qq.com/cap_union_verify_new?clientype=2&uin=3095623630&aid=549000912&cap_cd=THO2WOw4EZs9zRffNObG6HC9cC1mTRlqAAQmprIDI-uQQb16wbd_Gw**&pt_style=40&0.7694536918397665&rand=0.4683637544282824&capclass=0&sig=gwkdorpjiYpG4lLwiv8ukMV8lCSHRAKgvXQaiGAofT4w0Mb6jKpKIgW1p9grIekpkD65rRIm1Swwu9hrM2cEvR9kCydsb46A-neP9fw_1CrIWtH5Ak3zAaw**&collect=QMOd6nPPsI_rUCgMgdhSkYxEePJTzvzOSl6OdqtaT0JZTm3uB6PsvJT_-rvCAY6v67HCBDUUEiOAJCwP1iWhyIZGYdO1-CreVD-X3bHLxFXpvQ2lAQjsnGBEVLLGykQ6l1_WLcRObYnHNYP7dMNdEoS2Hl1hxCkv0DxqSaEek-6dMh7dRYzTX9Xi--QtNd52Dox6BpCMWhy5q3wVn0wzBC8bQn-zYKYX0JiMfwuPKicCJCDaGjWrOvx0pRHT6Lrcjz6Z6ovPaWJKKjQ14L2uK9GIhS3fp8Pp65Y3B8yJUcRr2gfoqOD_sRpCR4RyVg2l73G_HvsKYhXlEALvaW6rf1lQdxT2uBHfXR7lnUlmMBhXnWs0gyJXAooTjm91srIKUy25HNoFNYCB7mKpttUXo_2-7JE0WaIy8B17RX1JDuR3HksJk3RV6jtP_wI4igDLEqjgLTOu_hkg5kwFWr4ZDb_R7ahjtX0Vk3BMOta7HRBW8Ui9AouyL3jdC6JerfRpqD6E0JAnXI0rW6bZpM_lDZi7Vo4VcHHly_4bHnCaxqyqFkfEFiloaFlaqIU9vehNtXfqlD6x2xIBODfV7RjaTzqmRsCTCtdm_SS7l1xK7jRU777Qw-DVcF8yGe_JBVcNfgRQYWIgRyMOnv1aWaoFylOR6YrD2MvthmVgVU8_GQ6lbtwDr2e722PSLHCe4H3pKmgMIM6JyHLfGuZeoUQtVgmkj3V_C9FzbQHsCRuaJuRowsevrF7DblXvBo-Kdi5y&ans=1111
    ans 里保存着答案
    尚不清楚 collect 里面保存着是什么鬼东西...

    情况1: 失败 返回 {"errorCode":"50" , "randstr" : "" , "ticket" : "" , "errMessage":"éªŒè¯å¤±è´¥ï¼Œè¯·é‡è¯•ã€‚"}
        同时再发送 获取 sig 的请求 http://captcha.qq.com/cap_union_getsig_new?clientype=2&uin=3095623630&aid=549000912&cap_cd=THO2WOw4EZs9zRffNObG6HC9cC1mTRlqAAQmprIDI-uQQb16wbd_Gw**&pt_style=40&0.7694536918397665&rand=0.007936846415641075
            返回: {"vsig":"g9bQMn0v7Le8dJXCktYFszNj4CuWPmJLTYw6DNds7c675siwGqtjdissTNfDsAh0MTQCy4ekpn1VRXSVI5-ZULrCDAM28rP6NcTcW44BBVwPT25GTIiP0uw**","ques":""}
        然后再发送 获取图片的请求 http://captcha.qq.com/getimgbysig?clientype=2&uin=3095623630&aid=549000912&cap_cd=THO2WOw4EZs9zRffNObG6HC9cC1mTRlqAAQmprIDI-uQQb16wbd_Gw**&pt_style=40&0.7694536918397665&rand=0.022791218795862322&sig=g9bQMn0v7Le8dJXCktYFszNj4CuWPmJLTYw6DNds7c675siwGqtjdissTNfDsAh0MTQCy4ekpn1VRXSVI5-ZULrCDAM28rP6NcTcW44BBVwPT25GTIiP0uw**

    情况2 成功 返回 {"errorCode":"0" , "randstr" : "@8jz" , "ticket" : "t021CIiGX7jCEQNNwMsudOUhDC0BhxTo4r_TvdKRaC_AVwjps3X7V4UlTISt3RyvpU26b6FNPH5trzoLy07KYd44jpZCS6qG6oI-I7g1oma42I*" , "errMessage":"验证失败，请重试。"}

        不过却收到了 
            ptuiCB('19','0','','0','您的帐号暂时无法登录，请<a href="http://aq.qq.com/007" target="_blank">点击这里</a>恢复正常使用。', '');
        难道真被封了吗...QAQ

        注, 也可能收到 
            ptuiCB('22009','0','','0','对不起，您的号码登录异常，请使用<a href="http://im.qq.com/mobileqq/2013/" target="_blank">QQ手机版</a>扫描二维码安全登录。<a href="http://ptlogin2.qq.com/qq_cheat_help" target="_blank">(帮助反馈)</a>(22009)', '');


登录前获取必须的 cookie 的地址:http://xui.ptlogin2.qq.com/cgi-bin/xlogin?proxy_url=http%3A//qzs.qq.com/qzone/v6/portal/proxy.html&daid=5&&hide_title_bar=1&low_login=0&qlogin_auto_login=1&no_verifyimg=1&link_target=blank&appid=549000912&style=22&target=self&s_url=http%3A%2F%2Fqzs.qq.com%2Fqzone%2Fv5%2Floginsucc.html%3Fpara%3Dizone&pt_qr_app=%E6%89%8B%E6%9C%BAQQ%E7%A9%BA%E9%97%B4&pt_qr_link=http%3A//z.qzone.com/download.html&self_regurl=http%3A//qzs.qq.com/qzone/v6/reg/index.html&pt_qr_help_link=http%3A//z.qzone.com/download.html
    返回的内容会在 Set-Cookie 中存储



说说获取地址:
    https://h5.qzone.qq.com/proxy/domain/taotao.qq.com/cgi-bin/emotion_cgi_msglist_v6?uin=616772663&inCharset=utf-8&outCharset=utf-8&hostUin=616772663&notice=0&sort=0&pos=40&num=20&cgi_host=http%3A%2F%2Ftaotao.qq.com%2Fcgi-bin%2Femotion_cgi_msglist_v6&code_version=1&format=jsonp&need_private_comment=1&g_tk=2116221929

        最大获取数量 : 40

        可能的情况:
            操作过于频繁
                {"censor_count":0,"censor_flag":0,"censor_total":0,"cginame":2,"code":-10000,"logininfo":{"name":"露娜sama","uin":3095623630},"message":"使用人数过多，请稍后再试","name":"露娜sama","right":1,"smoothpolicy":{"comsw.disable_soso_search":0,"l1sw.read_first_cache_only":0,"l2sw.dont_get_reply_cmt":0,"l2sw.mixsvr_frdnum_per_time":50,"l3sw.hide_reply_cmt":0,"l4sw.read_tdb_only":0,"l5sw.read_cache_only":0},"subcode":-10000,"usrinfo":{"concern":0,"createTime":"昨天11:23","fans":0,"followed":0,"msg":"作为一个路痴我要怎么考科目三……","msgnum":12,"name":"远恙°","uin":120021074}}
            权限设置
                _Callback({"cginame":2,"code":-10031,"logininfo":{"name":"露娜sama","uin":3095623630},"message":"对不起,主人设置了保密,您没有权限查看","name":"露娜sama","right":2,"smoothpolicy":{"comsw.disable_soso_search":0,"l1sw.read_first_cache_only":0,"l2sw.dont_get_reply_cmt":0,"l2sw.mixsvr_frdnum_per_time":50,"l3sw.hide_reply_cmt":0,"l4sw.read_tdb_only":0,"l5sw.read_cache_only":0},"subcode":2,"usrinfo":{"concern":0,"createTime":"","fans":0,"followed":0,"msg":"","msgnum":0,"name":"七月","uin":562690455}});
            未登录
                _Callback({"code":-3000,"message":"请先登录空间","subcode":-4001});
            获取成功
                见文件 说说_获取成功_示例.js


cookie 相关:
    传输形式的 cookie 每个分号之后必须要留一个空格!!!
    如果不留空格, 以获取最近访问为例, 就会出现
        "由于对方权限设置，您不能进行此操作" 的情况


 */
