from qqlib import qzone
import sys

qq = qzone.QZone(sys.argv[1], sys.argv[2])
qq.login()
qq.showCookie()

# 3095623630 zyf19960513