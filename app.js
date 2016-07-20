var request      = require("superagent");
var fs           = require("fs")
var EventEmitter = require('events').EventEmitter;

var config       = require("./config.js")

var jsonCookie   = [];    // 以 JSON 形式保存的当前cookie值

var QQNumbers    = [];    // 收集到的QQ号码, 待爬取
var QQdone       = [];    // 收集到的QQ号码, 已爬取

var QQEvents     = {};    // 事件列表, 每个元素都是对象, 有三个属性, obj 是一些数据, event 是事件对象, count 是计数君, 默认为 3

var QQtorrent    = [470501491];    // 种子 QQ 号, 星星之火, 可以燎原

var userInfos = [];     // 爬取的用户信息

var flags = {

    // 判断当前是否处于输入验证码的状态中  0 代表不在输入验证码  大于 0 代表正在输入验证码
    // 如果正在输入验证码, 那么请求暂停 → 也就是 mainStep 先暂时延时一下
    verifyFlag : 0,

    // 当前正在进行的请求的编号
    verifyNum : -1,

    // 是否已经准备好的 flag  目前准备好的条件是, 已从数据库中读取到 QQdone 的数据,  已从数据库中读取到 QQNumbers 的数据
    // 0 为已准备好, 大于 0 为未准备好
    readyFlag : 2,

    // 最近一次的验证码的图片名称
    verifyImg : ""
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
    'Referer'           : 'http://ctc.qzs.qq.com/qzone/profile/index.html'
}

/**
 * 因为在引用 QQLogin.js 的时候就已经需要 module.exports 了, 所以将 module.exports 的定义提前到引入 QQLogin 之前
 * 但同时也要保证位置在 内容 的定义之后
 * @type {Object}
 */
module.exports = {
    jsonCookie      : jsonCookie,
    flags           : flags,
    HTTPheaders     : HTTPheaders,
    json2cookies    : json2cookies,
    QQdone          : QQdone,
    QQNumbers       : QQNumbers,
    userInfos       : userInfos
}

var QQLogin    = require('./QQLogin.js')
var db         = require("./db/db.js");

var www = require('./server/bin/www');

// Panzer Vor !!
main();

/**
 * 主函数, 进行爬虫程序的调度
 */
function main(){

    // 每隔一段时间执行一次, 以防被 QQ空间 反爬程序盯上
    mainStep();

    // 定时存储所有 QQNumbers
    setTimeout(saveQQNumbers, config.saveQQNumbersTime);

    /**
     * 主函数的单步函数
     */
    function mainStep(){

        // 如果正在输入验证码, 则延迟执行请求
        // 如果没有准备好, 也延迟执行请求
        if(flags.verifyFlag || flags.readyFlag){
            setTimeout(function(){mainStep();}, config.timeout);
            return;
        }

        console.log("QQNumbers 内有 " + QQNumbers.length + " 个 QQ 号, " + " QQdone 内有 " + QQdone.length + " 个 QQ 号.")

        // if(QQdone.length > 400){
        //     setTimeout(function(){
        //         debugger;
        //     }, 15000)
        //     return;
        // }

        // 检查当前所有的QQ号是否已登录, 若没有登录, 就进行登录
        var QQlist = checkQQ();

        // 利用已登录的 QQ 号开始爬取
        QQlist.forEach(function(item){

            // 先检查种子 QQ 号
            if(QQtorrent.length > 0){
                var fetchNum = QQtorrent.pop();

                if(isOldFreshman(fetchNum)){
                    QQdone.push(fetchNum);
                    console.log("QQ 第 " + item + " 号, 开始爬取种子 QQ 号 " + fetchNum)
                    fetchData(fetchNum, item);
                    return;
                }
            }

            // 再检查队列中的 QQ 号
            if(QQNumbers.length > 0){

                var fetchNum;

                while(true){
                    if (isOldFreshman(fetchNum = QQNumbers.pop())) break;
                }

                QQdone.push(fetchNum);
                console.log("QQ 第 " + item + " 号, 开始爬取 QQ 号 " + fetchNum)
                fetchData(fetchNum, item);
                return;
            }

            console.log("星星之火即将熄灭")
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

        // 通过此变量限制同时进行的最大爬虫数
        var temp = config.maxQQ;

        // 检查 QQ 列表, 如果没有登录, 就进行登录; 如果已经登录, 就将其 ID 推进数组
        config.QQ.forEach(function(item, index){
            if(item.isLogin === 1 && temp){
                QQlist.push(index);
                temp--;
            } else if(item.isLogin === 3 && temp){
                temp--;
            } else if(item.isLogin === 0 && temp){
                console.log("QQ 第 " + index + " 号 ,QQ 号 " + item.userQQ + " 准备登录!");

                // 使 isLogin 为 3 意为正在登录
                config.QQ[index].isLogin = 3;

                QQLogin(index);
                temp--;
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

        // 订阅事件
        emitQQ(targetQQ, currentQQID)

        // 个人档信息
        getUserInfoAll(targetQQ, currentQQID, config.timeoutNum);

        // 留言板信息
        getMsgBoard(targetQQ, currentQQID, config.boardNum, 0, config.timeoutNum)

        // 说说信息
        getShuoShuoMsgList(targetQQ, currentQQID, config.shuoNum, 0, config.timeoutNum)
    }


    /**
     * 对每个目标 QQ 进行事件的订阅, 正常的抓取过程中, 每个目标 QQ 应该发布三次事件
     * 当三次事件全部接收到后, 将目标 QQ 存入数据库
     * 然后为了节省内存, 删除订阅的事件
     *
     * @param  {QQ} targetQQ  目标人物的QQ号
     */
    function emitQQ(targetQQ){

        QQEvents[targetQQ] = {};

        // 计数变量是 3 , 原因是会对三个方面进行爬取, 分别是 留言板 说说 个人档
        QQEvents[targetQQ].count = 3;

        QQEvents[targetQQ].obj = {
            uin             : targetQQ,
            msgBoardNum     : undefined,
            shuoshuoNum     : undefined,
            userInfoState   : undefined
        }

        // 使 EventEmitter 对象实例化
        QQEvents[targetQQ].event = new EventEmitter();

        QQEvents[targetQQ].event.on("userInfo", function(data){
            QQEvents[targetQQ].count --;
            QQEvents[targetQQ].obj.userInfoState = data;
            checkEventCount(targetQQ);
        })

        QQEvents[targetQQ].event.on("msgBoard", function(data){
            QQEvents[targetQQ].count --;
            QQEvents[targetQQ].obj.msgBoardNum = data;
            checkEventCount(targetQQ);
        })

        QQEvents[targetQQ].event.on("shuoshuo", function(data){
            QQEvents[targetQQ].count --;
            QQEvents[targetQQ].obj.shuoshuoNum = data;
            checkEventCount(targetQQ);
        })

    }

    /**
     * 检查接收到的事件数是否达到预订目标
     * 如果达到了, 就将其存入数据库, 并在内存中将其删除
     *
     * @param  {QQ} targetQQ  目标人物的QQ号
     */
    function checkEventCount(targetQQ){

        // 如果计数变量还有值就 return
        if(QQEvents[targetQQ].count) return;

        db.collection("QQdone").insert(QQEvents[targetQQ].obj, function(err, data){
            if(err) throw err;      // QQdone 数据库保存失败
            console.log("一条 QQdone 的数据已保存成功");

            // 此处设置延时删除, 是因为可能在 3 次事件都接受后, 后续请求还会发送请求
            setTimeout(function(){
                delete QQEvents[targetQQ];
            }, 2 * config.getTimeout)
        })
    }

    /**
     * 定时将 QQNumbers 存入数据库中, 方便下次程序运行的时候调用
     */
    function saveQQNumbers(){

        var obj = {name : "QQNumbers", QQNumbers : QQNumbers};

        db.collection("QQNumbers").update({name : "QQNumbers"}, {"$set" : {"QQNumbers" : QQNumbers}}, true, function(err){
            if(err) throw err;
            console.log("Success!")

            setTimeout(saveQQNumbers, config.saveQQNumbersTime);
        })
    }
}


/**
 * 获取个人档里的相关信息
 *
 * @param  {QQ} targetQQ  目标人物的QQ号
 * @param  {QQ} currentQQID 当前爬虫正在使用的QQ号的ID
 * @param  {int} timeoutNum 超时请求的剩余次数
 */
function getUserInfoAll(targetQQ, currentQQID, timeoutNum){

    request.get('http://base.s21.qzone.qq.com/cgi-bin/user/cgi_userinfo_get_all')
        .set(HTTPheaders)
        .set({Cookie : json2cookies(jsonCookie[currentQQID])})
        .timeout(config.getTimeout)
        .query({
            uin     : targetQQ,
            vuin    : config.QQ[currentQQID].userQQ,
            fupdate : 1,
            rd      : 0.057868526378582094,
            g_tk    : getGTK(currentQQID)
        })
        .end(function(err, data){

            if(err) {
                if(err.timeout) {
                    log(currentQQID, "个人档请求超时, 剩余超时次数 " + timeoutNum);

                    // 如果重复请求次数已达到上限, 则不再进行请求
                    if(!timeoutNum){
                        QQEvents[targetQQ].event.emit("userInfo", "请求超时");
                        return;
                    }

                    setTimeout(function(){
                        getUserInfoAll(targetQQ, currentQQID, timeoutNum - 1);
                    }, 0);

                    return;
                }
                throw err; // 获取个人档信息失败
            }

            var text = '';
            data.on('data', function(chunk){
                text += chunk;
            })
            data.on('end', function(chunk){

                var userInfoJson = JSON.parse(text.replace(/^_Callback\(/, '').replace(/\);$/, '').replace(/\\'/g, "'"));

                // 权限检查 以及 登录检查
                switch(userInfoJson.code){
                    case -4009  :
                        log(currentQQID, '获取个人档 ' +　targetQQ + " : 没有权限");
                        QQEvents[targetQQ].event.emit("userInfo", "没有权限");
                        return;
                }

                // 返回消息代码 二次确认
                if(userInfoJson.code !==  0) {
                    log(currentQQID, '获取个人档 ' +　targetQQ + " : 未知原因");
                    QQEvents[targetQQ].event.emit("userInfo", "未知原因");
                    debugger;return;
                }

                // log(currentQQID, "已获得 " + targetQQ + " 的个人档信息!");

                QQEvents[targetQQ].event.emit("userInfo", "Success!");

                // 将返回的个人档的对象添加到数据库中
                db.collection("UserInfo").insert(userInfoJson.data, function(err){
                    userInfos.unshift(userInfoJson.data);
                    if(err) throw err;
                    log(currentQQID, targetQQ + " 的个人档信息, 已加入数据库!")
                })
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
 * @param  {int} timeoutNum 超时请求的剩余次数
 */
function getMsgBoard(targetQQ, currentQQID, boardNum, startNum, timeoutNum){

    // 将开始数默认为 0
    startNum = startNum || 0;

    request.get('https://h5.qzone.qq.com/proxy/domain/m.qzone.qq.com/cgi-bin/new/get_msgb')
        .set(HTTPheaders)
        .set({Cookie : json2cookies(jsonCookie[currentQQID])})
        .timeout(config.getTimeout)
        .query({
            uin         : config.QQ[currentQQID].userQQ,
            hostUin     : targetQQ,
            start       : startNum,
            format      : 'jsonp',
            num         : 20,
            inCharset   : 'utf-8',
            outCharset  : 'utf-8',
            g_tk        : getGTK(currentQQID)
        })
        .end(function(err, data){

            if(err) {
                if(err.timeout) {
                    log(currentQQID, "留言板请求超时, 剩余超时次数 " + timeoutNum);

                    // 如果重复请求次数已达到上限, 则不再进行请求
                    if(!timeoutNum){
                        QQEvents[targetQQ].event.emit("msgBoard", "请求超时");
                        return;
                    }

                    setTimeout(function(){
                        getMsgBoard(targetQQ, currentQQID, boardNum, startNum, timeoutNum - 1);
                    }, 0);

                    return;
                }
                throw err; // 获取留言板信息失败
            }

            var text = '';
            data.on('data', function(chunk){
                text += chunk;
            })
            data.on('end', function(chunk){

                var boardJson = JSON.parse(text.replace(/^_Callback\(/, '').replace(/\);$/, '').replace(/\\'/g, "'"));

                // 权限检查 以及 登录检查
                switch(boardJson.code){
                    case -4009  :
                        log(currentQQID, '获取留言板 ' +　targetQQ + " : 没有权限");
                        QQEvents[targetQQ].event.emit("msgBoard", "没有权限");
                        return;
                    case -4001  :
                        log(currentQQID, '获取留言板 ' +　targetQQ + " : 没有登录");
                        // 这是一个悲伤的事实... 在爬取过程中如果登录被退出, 那就是意味着账号已被冻结
                        config.QQ[currentQQID].isLogin = 2;
                        QQEvents[targetQQ].event.emit("msgBoard", "没有登录");
                        return;
                    case  1003  :
                        log(currentQQID, '获取留言板 ' +　targetQQ + " : 操作过于频繁");
                        QQEvents[targetQQ].event.emit("msgBoard", "操作过于频繁");
                        config.QQ[currentQQID].isLogin = 5;
                        return
                    case -5007  :
                        log(currentQQID, '获取留言板 ' +　targetQQ + " : 系统繁忙1");
                        QQEvents[targetQQ].event.emit("msgBoard", "系统繁忙1");
                        return
                    case -5008  :
                        log(currentQQID, '获取留言板 ' +　targetQQ + " : 系统繁忙2");
                        QQEvents[targetQQ].event.emit("msgBoard", "系统繁忙2");
                        return
                    case -30002 :
                        log(currentQQID, '获取留言板 ' +　targetQQ + " : 系统繁忙3");
                        QQEvents[targetQQ].event.emit("msgBoard", "系统繁忙3");
                        return
                    case -4013  :
                        log(currentQQID, '获取留言板 ' +　targetQQ + " : 空间未开通");
                        QQEvents[targetQQ].event.emit("msgBoard", "空间未开通");
                        return
                    case -4014  :
                        log(currentQQID, '获取留言板 ' +　targetQQ + " : 空间被封闭");
                        QQEvents[targetQQ].event.emit("msgBoard", "空间被封闭");
                        return
                }

                // 返回消息代码 二次确认
                if(boardJson.code !==  0) {
                    log(currentQQID, '获取留言板 ' +　targetQQ + " : 未知原因");
                    QQEvents[targetQQ].event.emit("msgBoard", "未知原因");
                    debugger;return;
                }
                // if(boardJson.code !==  0) throw new Error("获取留言板, 收到未知代码")

                // 就算返回代码正确, list 仍然可能没有被定义
                if(!boardJson.data.commentList || boardJson.data.commentList.length === 0) {
                    log(currentQQID, '获取留言板 ' +　targetQQ + " : 留言板数组为空");
                    QQEvents[targetQQ].event.emit("msgBoard", "留言板数组为空");
                    return;
                }

                // 留言板有一种特殊情况, 那就是主人设置了 serect, 那么就也不行
                // 但是 data 还是有的, 所以可以获取 留言板的总数
                if(boardJson.data.commentList[0].secret === 1) {
                    log(currentQQID, '获取留言板 ' +　targetQQ + " : 主人设置其为隐私");
                    QQEvents[targetQQ].event.emit("msgBoard", boardJson.data.total);
                    return;
                }

                log(currentQQID, "留言板消息" +　targetQQ + " : 获取成功, 从第 " + startNum + " 条开始, 留言板的信息共有 " + boardJson.data.total + " 条");

                // 如果 startNum 为 0, 就说明是首次抓取该 QQ 号的留言板
                // 那就对留言板的数量进行分析 并对每一页都发出抓取信号
                // 同时也可以对数据库发出信号, 因为只有首次会触发所以每个 targetQQ 只会触发一次
                if(startNum === 0){

                    // 触发事件
                    QQEvents[targetQQ].event.emit("msgBoard", boardJson.data.total);

                    if(boardJson.data.total > boardNum){
                        for(var i = boardNum, len = Math.min(boardJson.data.total, config.boardMax); i < len; i += boardNum){
                            getMsgBoard(targetQQ, currentQQID, boardNum, i, timeoutNum)
                        }
                    }
                }

                // 将返回的说说的对象数组添加到数据库中
                db.collection("MsgBoard").insert(boardJson.data.commentList, function(err){
                    if(err) throw err;
                    log(currentQQID, boardJson.data.commentList.length + " 条留言板消息, 已加入数据库!")
                })

                // 如果 QQNumbers 里的数据 大于 1000, 就不用存了
                if(QQNumbers.length < 1000){
                    boardJson.data.commentList.forEach(function(item, index){

                        // 检查 item.uin 是否存在 以及 是否为数
                        if(typeof item.uin !== 'number') return;

                        // 检查是否已经爬过
                        // 如果是小鲜肉, 就将其深入
                        // TODO : 后期程序成型后, 将小鲜肉立刻深入改为排队站好逐个深入
                        if(isFreshman(item.uin)){
                            QQNumbers.push(item.uin);
                            // log(currentQQID, "当前留言板爬取 QQ : " + targetQQ + ", 已将 QQ " + item.uin + " 加入队列")
                        }
                    })
                }


            })
        })
}

/**
 * 获取某一个用户的说说列表
 * 返回的内容不是流!!! 而是直接写在了 data.text 里面
 *
 * @param  {QQ} targetQQ  目标人物的QQ号
 * @param  {QQ} currentQQID 当前爬虫正在使用的QQ号的ID
 * @param  {int} timeoutNum 超时请求的剩余次数
 */
function getShuoShuoMsgList(targetQQ, currentQQID, shuoNum, startNum, timeoutNum){

    // 将开始数默认为 0
    startNum = startNum || 0;

    request.get("https://h5.qzone.qq.com/proxy/domain/taotao.qq.com/cgi-bin/emotion_cgi_msglist_v6")
        .set(HTTPheaders)
        .set({Cookie : json2cookies(jsonCookie[currentQQID])})
        .timeout(config.getTimeout)
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
            g_tk        : getGTK(currentQQID)
        })
        .end(function(err, data){

            if(err) {
                if(err.timeout) {
                    log(currentQQID, "说说请求超时, 剩余超时次数 " + timeoutNum);

                    // 如果重复请求次数已达到上限, 则不再进行请求
                    if(!timeoutNum){
                        QQEvents[targetQQ].event.emit("shuoshuo", "请求超时");
                        return;
                    }

                    setTimeout(function(){
                        getShuoShuoMsgList(targetQQ, currentQQID, shuoNum, startNum, timeoutNum - 1);
                    }, 0);

                    return;
                }
                throw err; // 获取说说信息失败
            }

            // console.log(data.text)

            var msgListJson = JSON.parse(data.text.replace(/^_Callback\(/, '').replace(/\);$/, '').replace(/\\'/g, "'"));

            // 权限检查 以及 登录检查
            switch(msgListJson.code){
                case -10031 :
                    log(currentQQID, '获取说说 ' +　targetQQ + " : 没有权限");
                    QQEvents[targetQQ].event.emit("shuoshuo", "没有权限");
                    return;
                case -3000  :
                    log(currentQQID, '获取说说 ' +　targetQQ + " : 没有登录");
                    // 这是一个悲伤的事实... 在爬取过程中如果登录被退出, 那就是意味着账号已被冻结
                    config.QQ[currentQQID].isLogin = 2;
                    QQEvents[targetQQ].event.emit("shuoshuo", "没有登录");
                    return;
                case -10000 :
                    log(currentQQID, '获取说说 ' +　targetQQ + " : 操作过于频繁");
                    config.QQ[currentQQID].isLogin = 5;
                    QQEvents[targetQQ].event.emit("shuoshuo", "操作过于频繁");
                    return;
            }

            // 返回消息代码 二次确认
            // if(msgListJson.code !== 0) throw new Error("获取说说消息, 收到未知代码")
            if(msgListJson.code !== 0) {
                log(currentQQID, '获取说说 ' +　targetQQ + " : 未知原因");
                QQEvents[targetQQ].event.emit("shuoshuo", "未知原因");
                debugger;return;
            }

            // 就算返回代码正确, list 仍然可能没有被定义
            // 同时数据库还有个要求... 如果数组为空也会报错
            if(!msgListJson.msglist || msgListJson.msglist.length === 0) {
                log(currentQQID, '获取说说 ' +　targetQQ + " : 说说数组为空");
                QQEvents[targetQQ].event.emit("shuoshuo", "说说数组为空");
                return;
            }

            log(currentQQID, "说说消息" +　targetQQ + " : 获取成功, 从第 " + startNum + " 条开始, 留言板的信息共有 " + msgListJson.total + " 条");

            // 如果 startNum 为 0, 就说明是首次抓取该 QQ 号的说说
            // 那就对说说的数量进行分析 并对每一页都发出抓取信号
            if(startNum === 0){

                // 发布事件
                QQEvents[targetQQ].event.emit("shuoshuo", msgListJson.total);

                if(msgListJson.total > shuoNum){
                    for(var i = shuoNum, len = Math.min(msgListJson.total, config.shuoMax); i < len; i += shuoNum){
                        getShuoShuoMsgList(targetQQ, currentQQID, shuoNum, i, timeoutNum)
                    }
                }
            }

            // 将返回的说说的对象数组添加到数据库中
            db.collection("ShuoShuo").insert(msgListJson.msglist, function(err){
                if(err) throw err;
                log(currentQQID, msgListJson.msglist.length + " 条说说, 已加入数据库!")
            })

            // 如果 QQNumbers 里的数据 大于 1000, 就不用存了
            if(QQNumbers.length < 1000){
                msgListJson.msglist.forEach(function(item, index){

                    // 通过评论内容 获取好友的信息
                    // 如果有评论的话, 那么将评论列表里的所有人的 QQ 号都再进行深入爬取
                    if(item.rtlist){
                        item.rtlist.forEach(function(replyItem, replyIndex){

                            // 将爬到的 QQ 加入到队列中
                            if(typeof replyItem.uin === 'number' && isFreshman(replyItem.uin)){
                                QQNumbers.push(replyItem.uin);
                                // log(currentQQID, "当前说说爬取 QQ : " + targetQQ + ", 已将 QQ " + replyItem.uin + " 加入队列")
                            }
                        })
                    }
                })
            }
        })
}




/**
 * 获取QQ空间验证手段之一的 G_TK
 * G_TK 的生成函数如下所示 来自 http://cm.qzonestyle.gtimg.cn/ac/qzone/qzfl/qzfl_v8_2.1.45.js
 * G_TK 应该附在 GET 请求中一起发送
 *
 * @param  {QQ} currentQQID 当前爬虫正在使用的QQ号的ID
 * @return {string}        生成的 G_TK 附在 GET 请求中一起发送
 */
function getGTK(currentQQID){

    var key = jsonCookie[currentQQID].p_skey || jsonCookie[currentQQID].skey;

    var hash = 5381;
    for (var i = 0, len = key.length; i < len; ++i) hash += (hash << 5) + key.charCodeAt(i);
    return hash & 2147483647
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
 * 判断是否已经将要被爬过
 *
 * @param  {QQ}  QQ 所要进行检查的QQ号
 * @return {Boolean}    1 代表还没有被爬过   0 代表已经不是小鲜肉了
 */
function isFreshman(QQ){
    return (QQNumbers.indexOf(QQ) === -1 && QQdone.indexOf(QQ) === -1);
}

/**
 * 判断是否已经被爬过
 *
 * @param  {QQ}  QQ 所要进行检查的QQ号
 * @return {Boolean}    1 代表还没有被爬过   0 代表已经不是小鲜肉了
 */
function isOldFreshman(QQ){
    return QQdone.indexOf(QQ) === -1
}

/**
 * 格式化输出日志
 *
 * @param  {QQ} currentQQID 当前爬虫正在使用的QQ号的ID
 * @param  {str} msg         消息内容
 */
function log(currentQQID, msg){
    if(flags.verifyFlag) return;  // 如果正在输入验证码, 就不显示日志了
    console.log("QQ ID " + currentQQID +" " + msg);
}




/**
王豪QQ    616772663
测试用QQ   3095623630          已冻结

淘宝购买小号:

    7月13日 购买
        3317753772----orii02058  已冻结
        3332755205----xvee22634  已冻结
        3332784766----kasi99753  已冻结
    7月14日 购买
        2170576112----wcresdjh   已冻结
    7月16日 购买
        1852905648----rnpddq     已冻结
        2027708698----uiut0g     已冻结
        2029725460----ipvcxhdzsu 已冻结
    7月17日 购买
        2332952069----gsp142     已冻结
        2308583910----exehg2     已冻结
        2326977241----u7v6yx     已冻结
        2334198261----aa158522   已冻结
    7月18日 购买
        3293278947----on0wzx51snue      已冻结
        3291980641----w34j7vpkl         已冻结
        3281412160----lishi7589813   买下的时候就冻结了
        3276668506----clb00loqed        已冻结
        3290067575----wcynzaivtm        已冻结

        2152028434----fanjin922         已冻结
        1917054091----2bvn4uyjpdn       已冻结
        3149680787----q4xg2jvni0        已冻结
        2154474519----w42i5p0l3oew5     已冻结
        2151132771----mn1jjo70av        已冻结
        2151830981----h572wz6c          已冻结
    7月19日 购买
        2674889378----joryyqogaf        已冻结
        2460545451----mssdvcvhft        已冻结
        2675085659----shaashcexv
        2685867114----civscnkifq        已冻结
        2670795177----zhxhitromx        已冻结


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




