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
    // 'Host'              : 'r.qzone.qq.com'
    'Host' : 'base.s21.qzone.qq.com',
    'Referer' : 'http://ctc.qzs.qq.com/qzone/profile/index.html'
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


// 调用登录模块, 进行登录并获取到登陆后的 cookie 内容
exec('python ./QQLib/test.py ' + config.userQQ + ' ' + config.password + '', function(err,stdout,stderr){

    if(err) throw err; // 登录失败

    out2jsoncookies(stdout);
    // getMainPage(616772663, config.userQQ, json2cookies(jsonCookie));
    getMsgBoard(616772663, config.userQQ);
})


/**
 * 获取验证码的相关信息
 * 然后应该是将返回的内容添加到 cookie 里 
 * 
 * @param  {QQ} currentQQ 当前爬虫正在使用的QQ号
 */
function getVerifyMsg(currentQQ){

    request.get('http://check.ptlogin2.qq.com/check?regmaster=&pt_tea=2&pt_vcode=1&uin=3095623630&appid=549000912&js_ver=10166&js_type=1&login_sig=oclBfCAaRbEUeYIEs58pWBYzIp*tHtBOYlkxjXqUVi*2gBSdtaftiw0bCrkv0E5L&u1=http%3A%2F%2Fqzs.qq.com%2Fqzone%2Fv5%2Floginsucc.html%3Fpara%3Dizone&r=0.3091402225059401&pt_uistyle=40')
        .set(HTTPheaders)
        .set({Cookie : json2cookies(jsonCookie)})
        .query({
            regmaster : '',
            pt_tea : 2,
            pt_vcode : 1,
            uin : currentQQ,
            appid : 549000912,
            js_ver : 10166,
            js_type : 1,
            login_sig : jsonCookie.pt_login_sig,
            u1 : 'http://qzs.qq.com/qzone/v5/loginsucc.html?para=izone',
            r : 0.3091402225059401,
            pt_uistyle : 40
        })
        .end(function(err, data){
            if(err) throw err;
            var text = '';
            data.on('data', function(chunk){
                text += chunk;
            })
            data.on('end', function(){
                console.log(text);
                console.log(text.split("','"))
            })
        })
}

/**
 * 获取主页面
 * 主要目的是返回的 响应头有好几个 set-cookie 貌似有点用....
 * 其他的目的...慢慢摸索吧...
 * 
 * @param  {QQ} targetQQ  目标人物的QQ号
 * @param  {QQ} currentQQ 当前爬虫正在使用的QQ号
 * @param  {string} cookies   当前cookie的传输格式
 */
function getMainPage(targetQQ, currentQQ){
    request.get("http://user.qzone.qq.com/" + targetQQ)
        .set(HTTPheaders)
        .set({Cookie : json2cookies(jsonCookie)})
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
                pac_uid     : '1_' + currentQQ,
                o_cookie    : currentQQ,
                QZ_FE_WEBP_SUPPORT : 1,
                __Q_w_s_hat_seed : 1,
                __Q_w_s__QZN_TodoMsgCnt : 1,
                Loading     : 'Yes',
                cpu_performance_v8 : 2,
                qqmusic_uin : '',
                qqmusic_key : '',
                qqmusic_fromtag : '',
                qzone_check : currentQQ + '_' + Math.round(Date.now() / 1000)
            });

            // console.log(jsonCookie)

            getShuoShuoMsgList(targetQQ, config.userQQ)

        })
}

/**
 * 获取个人档里的相关信息
 * 
 * @param  {QQ} targetQQ  目标人物的QQ号
 * @param  {QQ} currentQQ 当前爬虫正在使用的QQ号
 */
function getUserInfoAll(targetQQ, currentQQ){

    request.get('http://base.s21.qzone.qq.com/cgi-bin/user/cgi_userinfo_get_all')
        .set(HTTPheaders)
        .set({Cookie : json2cookies(jsonCookie)})
        .query({
            uin     : targetQQ,
            vuin    : currentQQ,
            fupdate : 1,
            rd      : 0.057868526378582094,
            g_tk    : getGTK(jsonCookie.p_skey)
        })
        .end(function(err, data){

            if(err) throw err;      // 获取个人档信息失败

            var text = '';
            data.on('data', function(chunk){
                text += chunk;
            })
            data.on('end', function(chunk){
                console.log(text);
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
 * @param  {QQ} currentQQ 当前爬虫正在使用的QQ号
 */
function getMsgBoard(targetQQ, currentQQ){
    request.get('https://h5.qzone.qq.com/proxy/domain/m.qzone.qq.com/cgi-bin/new/get_msgb')
        .set(msgBoardHeader)
        .set({Cookie : json2cookies(jsonCookie)})
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
            var text = '';
            data.on('data', function(chunk){
                text += chunk;
            })
            data.on('end', function(chunk){

                var boardJson = JSON.parse(text.replace(/^_Callback\(/, '').replace(/\);/, ''));

                // 权限检查 以及 登录检查
                if(boardJson.code === -4009){return console.log(targetQQ + " : 没有权限"); }
                if(boardJson.code === -4001){return console.log(targetQQ + " : 没有登录"); }

                console.log(targetQQ + " : 获取成功, 留言板的信息共有 " + boardJson.data.total + " 条");
                boardJson.data.commentList.forEach(function(item, index){

                    // 检查 item.uin 是否存在 以及 是否为数
                    if(!item.uin || typeof item.uin !== 'number') return;

                    // 检查是否已经爬过
                    if(QQNumbers.indexOf(item.uin) === -1){
                        QQNumbers.push(item.uin);
                        console.log("当前爬取 QQ : " + targetQQ + ", 已将 QQ " + item.uin + "加入队列")
                        getMsgBoard(item.uin, currentQQ);
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
 * @param  {QQ} currentQQ 当前爬虫正在使用的QQ号
 */
function getShuoShuoMsgList(targetQQ, currentQQ){
    request.get("https://h5.qzone.qq.com/proxy/domain/taotao.qq.com/cgi-bin/emotion_cgi_msglist_v6")
        .set(msgBoardHeader)
        .set({Cookie : json2cookies(jsonCookie)})
        .query({
            uin         : targetQQ,
            inCharset   : 'utf-8',
            outCharset  : 'utf-8',
            hostUin     : targetQQ,
            notice      : 0,
            sort        : 0,
            pos         : 0,
            num         : 20,
            cgi_host    : 'http://taotao.qq.com/cgi-bin/emotion_cgi_msglist_v6',
            code_version    : 1,
            format      : 'jsonp',
            need_private_comment    : 1,
            g_tk        : getGTK(jsonCookie.p_skey)
        })
        .end(function(err, data){
            if(err) throw err;      // 获取说说消息失败

            console.log(data.text)

            // var msgListJson = JSON.parse(data.text.replace(/^_Callback\(/, '').replace(/\);/, ''));
            
            // msgListJson.msglist.forEach(function(item, index){
            //     console.log("说说: " + item.content)
            //     if(item.rt_con){
            //         console.log("   By 转发说说 : " + item.rt_con.content)
            //     }
            //     console.log('\n')
            // })

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
 * 两参数时: 
 * @param {string} key   新的 cookie 的键
 * @param {string} value 新的 cookie 的值
 *
 * 一参数时: 
 * @param {object} key   cookie 对象 里面存储者键和值
 */
function addCookie(key, value){

    // 输入为两变量
    if(arguments.length === 2 && typeof key === 'string'){
        jsonCookie[key] = value;
        return;
    }

    // 输入为一变量
    if(arguments.length === 1 && typeof key === 'object'){
        for(var i in key){
            jsonCookie[i] = key[i];
        }
        return;
    }

    throw new Error("请输入正确cookie格式!");
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

留言板消息的请求地址: https://h5.qzone.qq.com/proxy/domain/m.qzone.qq.com/cgi-bin/new/get_msgb?uin=3095623630&hostUin=616772663&start=0&s=0.12159129992366813&format=jsonp&num=10&inCharset=utf-8&outCharset=utf-8&g_tk=320979203
    可能的情况:
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

验证码获取地址: http://check.ptlogin2.qq.com/check?regmaster=&pt_tea=2&pt_vcode=1&uin=3095623630&appid=549000912&js_ver=10166&js_type=1&login_sig=oclBfCAaRbEUeYIEs58pWBYzIp*tHtBOYlkxjXqUVi*2gBSdtaftiw0bCrkv0E5L&u1=http%3A%2F%2Fqzs.qq.com%2Fqzone%2Fv5%2Floginsucc.html%3Fpara%3Dizone&r=0.3091402225059401&pt_uistyle=40
    获取示例:
    ptui_checkVC('0','!CKM','\x00\x00\x00\x00\xb8\x83\x77\xce','04f067eb42adc886b9c8c9e20e7ebc31686e1fa7e94eb798f158aae2070cdaea5c38e913b140241bb094881846aa5b13e7d08559d6d2becc','2')

说说获取地址:
    https://h5.qzone.qq.com/proxy/domain/taotao.qq.com/cgi-bin/emotion_cgi_msglist_v6?uin=616772663&inCharset=utf-8&outCharset=utf-8&hostUin=616772663&notice=0&sort=0&pos=40&num=20&cgi_host=http%3A%2F%2Ftaotao.qq.com%2Fcgi-bin%2Femotion_cgi_msglist_v6&code_version=1&format=jsonp&need_private_comment=1&g_tk=2116221929
        可能的情况:
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
