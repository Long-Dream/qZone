// Config
var config     = {
    // QQ 数组
    // 其中 isLogin 用于判断QQ是否已登录
    // 0 代表没有登录   1 代表登录成功   2 代表账号已被冻结  3 代表正在登录
    QQ          : [
        {userQQ      : 1852905648, password    : 'rnpddq', isLogin     : 0 },
        {userQQ      : 2027708698, password    : 'uiut0g', isLogin     : 0 },
        {userQQ      : 2029725460, password    : 'ipvcxhdzsu', isLogin     : 0 }
    ],

    boardNum    : 20,    // 留言板每次抓取的数量
    boardMax    : 60,   // 留言板的最大抓取数量
    shuoNum     : 40,    // 说说每次抓取的数量
    shuoMax     : 120,   // 说说的最大抓取数量
    timeout     : 3000,   // 主函数两次爬取之间的间隔

    // 数据库的名称
    dbName      : "Qzone"
}

module.exports = config;