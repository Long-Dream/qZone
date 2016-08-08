#qZone 爬取程序

## 前提

本产品需要用户电脑上事先安装下列程序

* Nodejs
* npm
* MongoDB

## 使用方法

### 启动程序前

将仓库克隆后, 于终端运行`npm install` 以安装必要依赖. 之后, 按如下步骤进行相关的设置:

* 于 `config.js`内进行相关设置, 推荐除收信邮箱外全部设置项保持默认
* 于 `main.js`内设置进程内容, 推荐保持默认------四线程, 每线程的范围是5 0000 0000

之后, 终端运行`mongod`以打开数据库.再在程序目录下终端运行`node main.js` 以启动爬虫程序

### 启动程序中

在浏览器中, 输入本地地址加在设置过程中设置的端口号即可进入后台管理界面(如 http://localhost:3001/). 添加购买的修改过密码的爬虫账号, 点击`开始登录不爬取`进行登录, 全部登录完毕后, 将`设置间隔时间`设置为 30000ms 左右(每个进程的间隔时间最好不一样), 之后点击`开始无阻塞爬取` 进行爬取. 

####注意事项

* 在添加爬虫账号的过程中, 如果进行的是批量添加, 最后一行必须是空行!
* 每一个线程的爬虫数量最大值尚未进行测试.
* 每隔一段时间(默认: 900000ms), 程序会向指定邮箱发送一封当前爬虫信息的邮件. 正常情况下, 账号状态为 1 或 5 都是有可能的. 

## 版权

本程序版权归 Long-Dream, vortex_wh 所有
