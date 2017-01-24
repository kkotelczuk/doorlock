import subprocess
import urllib2
import datetime
import time
print "********************************************"
print "*                                          *"
print "*       Doorlock master script fired!      *"
print "*                                          *"
print "********************************************"
subprocess.Popen(["python","keyboard.py"])
subprocess.Popen(["python","rfid.py"])
