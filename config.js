// Config
var config     = {
    // QQ 数组
    // 其中 isLogin 用于判断QQ是否已登录
    // 0 代表没有登录   1 代表登录成功   2 代表账号已被冻结  3 代表正在登录  4 代表账号或者密码不正确  5 代表操作过于频繁 等一两天再试
    QQ                  : [
        // {userQQ      : 1852905648, password    : 'rnpddq', isLogin     : 0 },
        // {userQQ      : 2027708698, password    : 'uiut0g', isLogin     : 0 },

        // {userQQ      : 2332952069, password    : 'gsp142', isLogin     : 0 },
        // {userQQ      : 2308583910, password    : 'exehg2', isLogin     : 0 },
        // {userQQ      : 2029725460, password    : 'ipvcxhdzsu', isLogin     : 0 }
    ],

    boardNum            : 20,     // 留言板每次抓取的数量
    boardMax            : 20,     // 留言板的最大抓取数量
    shuoNum             : 40,     // 说说每次抓取的数量
    shuoMax             : 40,    // 说说的最大抓取数量
    timeout             : 6000,   // 主函数两次爬取之间的间隔
    getTimeout          : 5000,   // 请求的超时时间
    saveQQNumbersTime   : 30000,   // 存储 QQNumbers 的时间间隔
 
    // 数据库的名称
    dbName      : "Qzone"
}

module.exports = config;