from qqlib import qzone
import sys

qq = qzone.QZone(sys.argv[1], sys.argv[2])
qq.login()
qq.showCookie()