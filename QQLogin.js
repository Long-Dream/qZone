var request    = require("superagent");
var fs         = require("fs")
var cp         = require('child_process')

var QQSafe     = require('./QzoneLogin_lib.js')
var main       = require('./app.js')
var config     = require("./config.js")



/**
 * 第 -1 阶段
 * 获取登录过程中所必须的 cookie 值
 *
 * @param  {QQ} currentQQID 当前爬虫正在使用的QQ号的ID
 */
function getLoginCookie(currentQQID){

    request.get("http://xui.ptlogin2.qq.com/cgi-bin/xlogin?proxy_url=http%3A//qzs.qq.com/qzone/v6/portal/proxy.html&daid=5&&hide_title_bar=1&low_login=0&qlogin_auto_login=1&no_verifyimg=1&link_target=blank&appid=549000912&style=22&target=self&s_url=http%3A%2F%2Fqzs.qq.com%2Fqzone%2Fv5%2Floginsucc.html%3Fpara%3Dizone&pt_qr_app=%E6%89%8B%E6%9C%BAQQ%E7%A9%BA%E9%97%B4&pt_qr_link=http%3A//z.qzone.com/download.html&self_regurl=http%3A//qzs.qq.com/qzone/v6/reg/index.html&pt_qr_help_link=http%3A//z.qzone.com/download.html")
        .set(main.HTTPheaders)
        .end(function(err, data){
            if(err) throw err;      // 获取登录所必须的 cookie 值 失败!

            // 逐个访问 set-cookie 并进行添加
            setCookie(currentQQID, data);

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
 * 第 0 阶段
 * 获取登录过程中所必须的 cookie 值----qrsig
 *
 * @param  {QQ} currentQQID 当前爬虫正在使用的QQ号的ID
 */
function getLoginCookie_qrsig(currentQQID){

    request.get("http://ptlogin2.qq.com/ptqrshow?appid=549000912&e=2&l=M&s=3&d=72&v=4&t=" + Math.random() + "&daid=5")
        .set(main.HTTPheaders)
        .set({Cookie : main.json2cookies(main.jsonCookie[currentQQID])})
        .end(function(err, data){
            if(err) throw err;      // 获取 cookie : qrsig 失败

            setCookie(currentQQID, data);

            getVerifyMsg(currentQQID)
        })
}

/**
 * 获取验证码的相关信息 第一阶段
 * 然后应该是将返回的内容添加到 cookie 里
 *
 * @param  {QQ} currentQQID 当前爬虫正在使用的QQ号的ID
 */
function getVerifyMsg(currentQQID){

    request.get('http://check.ptlogin2.qq.com/check')
        .set({Cookie : main.json2cookies(main.jsonCookie[currentQQID])})
        .set(main.HTTPheaders)
        .query({
            regmaster   : '',
            pt_tea      : 2,
            pt_vcode    : 1,
            uin         : config.QQ[currentQQID].userQQ,
            appid       : 549000912,
            js_ver      : 10166,
            js_type     : 1,
            login_sig   : main.jsonCookie.pt_login_sig,
            u1          : 'http://qzs.qq.com/qzone/v5/loginsucc.html?para=izone',
            r           : Math.random(),
            pt_uistyle  : 40
        })
        .end(function(err, data){
            if(err) throw err;

            // 这个请求里面也有一些比较重要的 cookie
            setCookie(currentQQID, data);

            var text = '';

            data.on('data', function(chunk){
                text += chunk;
            })

            data.on('end', function(){

                var verifyArr = text.replace(/^ptui_checkVC\(/, '').replace(/\);$/, '').replace(/'/g, '').split(',')

                // 数组的第0个元素如果是 '1' , 则说明需要验证码; 如果第一个元素是 '0' , 则说明不需要验证码
                if (verifyArr[0] === "0"){
                    log(currentQQID, "不需要验证码, 即将进行登录");
                    QQTryLogin(currentQQID, verifyArr[1], verifyArr[3]);
                    return;
                } else if (verifyArr[0] === "1") {
                    log(currentQQID, "需要验证码, 即将进行验证码验证!")

                    // 进入获取验证码的第二阶段
                    getVerifyMoreMsg(currentQQID, verifyArr[1]);
                    return;
                }

                console.log(verifyArr);

                // 不应该走到这里
                // 目前原因也只有账号不是数字的原因了....所以输出用户名和密码错误吧
                // throw new Error("一定是哪里出错了!");
                config.QQ[currentQQID].isLogin = 4;
                log(currentQQID, "用户名貌似不是数字?")


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
        .set({Cookie : main.json2cookies(main.jsonCookie[currentQQID])})
        .set(main.HTTPheaders)
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
        .set({Cookie : main.json2cookies(main.jsonCookie[currentQQID])})
        .set(main.HTTPheaders)
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

            fs.writeFile('./server/public/img/' + imgName, data.body, function(err){
                if(err) throw err;      // 保存验证码图片时出现问题!

                // 因为请求也有延时, 所以此时再次判断是否有正在请求验证码
                // 如果有, 就下次再说!
                // 当然, 前提是过来的是别的请求

                if(main.flags.verifyFlag > 0 &&　main.flags.verifyNum　!== currentQQID) {
                    config.QQ[currentQQID].isLogin = 0;
                    return log(currentQQID, "正在等待当前验证码验证结束!")
                }

                // 此时禁止所有请求
                main.flags.verifyFlag += 1;
                main.flags.verifyNum = currentQQID;

                // 同时保存验证码的图片
                main.flags.verifyImg = imgName;

                console.log("\n\n")
                log(currentQQID, "验证码图片已经保存, 请打开" + './server/public/img/' + imgName +　' , 并在下方输入验证码: ')

                // 显示图片, 同时获取子进程的 pid
                // linux
                // var imgCp = cp.exec('display ./verifyImg/' + imgName)
                // windows
                // var imgCp = cp.exec('start verifyImg/' + imgName)

                // 开启输入
                process.stdin.resume();
                process.stdin.setEncoding('utf8');

                // 绑定输入事件, 此处的 dataFun 是为了给函数起个名字, 方便到时候进行移除
                process.stdin.on('data', function dataFun(chunk){

                    process.stdin.pause();

                    // 先行检查验证码的字符数
                    // if(chunk.length !== 4){
                    //     process.stdin.resume();
                    //     log(currentQQID, "验证码只有 4 个字符哦, 请重新输入:");
                    //     return;
                    // }

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
        .set({Cookie : main.json2cookies(main.jsonCookie[currentQQID])})
        .set(main.HTTPheaders)
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
                log(currentQQID, "验证失败, 请重试");

                // 此处让 verifyFlag 的值减1 因为每进行一次输入都会使其值加 1
                main.flags.verifyFlag -= 1;

                // 重发获取 sig 的请求就行
                getVerifyMoreMsg(currentQQID, cap_cd)
                return;
            }

            // 验证成功
            // 但我并不知道验证成功后应该怎么做.... → 现在知道了
            if (resultJson.errorCode === "0"){
                log(currentQQID, "验证成功, 撒花~~~  即将进行登录");
                QQTryLogin(currentQQID, resultJson.randstr, resultJson.ticket)
            }
        })

}

/**
 * 第五阶段
 *
 *
 *
 * ***调用 QQLib 进行QQ的登录, 并将返回的 cookie 值存储到 main.jsonCookie 中*** 已废弃
 *
 * 实现登录模块, 该模块需要先进行验证码的验证, 并获取两个关键的字段 verifycode 和 pt_verifysession_v1
 * 应该使用 query 的字符串形式, 以做到防止 * 被转义
 * 如果登录成功, 就将 config 里面的 isLogin 设为1
 *
 * 注意: 参数中, 如果需要验证码, pt_vcode_v1 的值就为 1 ; 如果不需要验证码, pt_vcode_v1 的值就为 0
 *
 * @param  {QQ} currentQQID 当前爬虫正在使用的QQ号的ID
 * @param  {string} verifycode  第四阶段获取到的 verifycode
 * @param  {string} pt_verifysession_v1  第四阶段获取到的 pt_verifysession_v1
 *
 */
function QQTryLogin(currentQQID, verifycode, pt_verifysession_v1){

    // 需要验证码的话, verifycode 的形式为 @WgU; 不需要的话, verifycode 的形式为 !BSE.
    // 所以通过判断 @ 的有无可以判断过程中有没有使用验证码  1 为 使用了验证码  0 为 没有使用验证码
    var pt_vcode_v1 = verifycode.indexOf("@") >= 0 ? 1 : 0;

    request.get("http://ptlogin2.qq.com/login")
        .set({Cookie : main.json2cookies(main.jsonCookie[currentQQID])})
        .set(main.HTTPheaders)
        .query({
            u               : config.QQ[currentQQID].userQQ,
            pt_vcode_v1     : pt_vcode_v1,
            pt_randsalt     : 2,
            ptredirect      : 0,
            h               : 1,
            g               : 1,
            t               : 1,
            from_ui         : 1,
            ptlang          : 2052,
            js_ver          : 10167,
            js_type         : 1,
            pt_uistyle      : 40,
            aid             : 549000912,
            daid            : 5,
            action          : '4-22-1450611437613',
        })
        .query("u1=http%3A%2F%2Fqzs.qq.com%2Fqzone%2Fv5%2Floginsucc.html%3Fpara%3Dizone")
        .query("verifycode=" + verifycode)
        .query("pt_verifysession_v1=" + pt_verifysession_v1)
        .query("p=" + getP(currentQQID, verifycode))
        .query("login_sig=" + main.jsonCookie[currentQQID].pt_login_sig)
        .end(function(err, data){
            if(err) throw err;      // 登录失败

            var text = '';

            data.on('data', function(chunk){
                text += chunk;
            })

            data.on('end', function(){

                var verifyArr = text.replace(/^ptuiCB\(/, '').replace(/\);$/, '').replace(/'/g, '').split(',')

                // 如果第一个参数是 0 , 则说明登录成功; 如果第一个参数不是 0 ,那就有各种各样的情况了...姑且认为账号被冻结了吧
                if(verifyArr[0] === '0'){
                    log(currentQQID, "登录成功")

                    getSuccessCookies(currentQQID, verifyArr[2], pt_vcode_v1);
                } else if (verifyArr[0] === '3') {
                    log(currentQQID, "您输入的帐号或密码不正确, 请将账号删除后重新录入账号和密码");
                    if(pt_verifysession_v1){
                        main.flags.verifyFlag -= 1;
                        main.flags.verifyNum = -1;
                    }
                    config.QQ[currentQQID].isLogin = 4;
                } else {
                    log(currentQQID, "登录失败!");
                    console.log(text);

                    // 就算被冻结了也要让路!
                    // 当然是在进行了验证码验证的情况下
                    // P.S. 就算被冻结 收到的 verifycode 一样是以 @ 打头
                    if(pt_verifysession_v1){
                        main.flags.verifyFlag -= 1;
                        main.flags.verifyNum = -1;
                    }
                    // 使 账号的 isLogin 定为 2, 视为已冻结
                    config.QQ[currentQQID].isLogin = 2;
                }

            })
        })
}


/**
 * 第六阶段
 *
 * 在验证成功后, 获取 第五阶段 所给的网址, 以获取进行访问所必须的 cookie 值
 * 此处需要注意的是, 需不需要验证码所得到的 set-cookie 是不一样的
 * 比如, 需要验证码就是 p_skey , 而不需要验证码则是 skey
 *
 * @param  {QQ} currentQQID         当前爬虫正在使用的QQ号的ID
 * @param  {url} url                第五阶段获取到的 url
 * @param  {boolean} isVerify       是否采用了验证码   1 为 使用了验证码  0 为 没有使用验证码
 */
function getSuccessCookies(currentQQID, url, isVerify){

    request.get(url)
        .set(main.HTTPheaders)
        .redirects(0)
        .end(function(err, data){

            // 此处一直会有 302 错误, 不进行捕获

            // 此处, 需要清空已获取的 cookie, 并重新添加新的 cookie
            main.jsonCookie[currentQQID] = {};

            setCookie(currentQQID, data);

            // 此时允许所有请求
            // 因为只有当进行了验证码验证的情况下才对 verifyFlag 有 +1 的操作, 所以此处进行减一的操作
            if(isVerify) {
                main.flags.verifyFlag -= 1;

                // 同时将当前正在进行的请求的编号置为初始值 -1
                main.flags.verifyNum = -1;
            }

            // 使 账号的 isLogin 定为 1, 视为已成功登录
            config.QQ[currentQQID].isLogin = 1;

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
 * 向当前 cookie 中添加新的 cookie 值
 *
 * @param {object} obj          cookie 对象 里面存储者键和值
 * @param {number} cookieID     当前 QQ 号的ID
 */
function addCookie(obj, cookieID){

    if(typeof obj !== 'object' || typeof cookieID !== 'number') throw new Error("添加cookie : 请输入正确的格式!")

    if(typeof main.jsonCookie[cookieID] === 'undefined') main.jsonCookie[cookieID] = {};

    for(var i in obj){
        main.jsonCookie[cookieID][i] = obj[i];
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
 * 将响应头之中的 set-cookie 加入到现有的 cookie 中
 *
 * @param  {QQ}     currentQQID 当前爬虫正在使用的QQ号的ID
 * @param {res} data        superagent 的数据文件
 */
function setCookie(currentQQID, data){

    if(typeof data.headers['set-cookie'] !== 'object') return console.log(typeof data.headers['set-cookie'])

    data.headers['set-cookie'].forEach(function(item, index){
        var pattern = /(.*?)=(.*?);/;
        var match = pattern.exec(item);

        if(match[1] === 'p_uin' || match[1] === 'p_skey' || match[1] === 'pt4_token'){
            if(match[2] === '') return;
        }

        var oneCookie = {};
        oneCookie[match[1]] = match[2]
        if(match !== null){addCookie(oneCookie, currentQQID)}
    })
}

/**
 * 格式化输出日志
 *
 * @param  {QQ} currentQQID 当前爬虫正在使用的QQ号的ID
 * @param  {str} msg         消息内容
 */
function log(currentQQID, msg){
    console.log("QQ ID " + currentQQID +" " + msg);
}



module.exports = getLoginCookie;
