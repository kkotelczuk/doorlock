#!/usr/bin/env python
# -*- coding: utf8 -*-
import RPi.GPIO as GPIO
import MFRC522
import signal
import requests
import json
import time
import syncano
import os
from datetime import datetime
from syncano.models import Object
connection = syncano.connect(instance_name=os.environ['INSTANCE_NAME'], api_key=os.environ['SYNCANO_API_KEY'], user_key=os.environ['SYNCANO_USER_KEY'])
#----------- CONFIGURATION -------
global pinNumber
global curr_state
global prev_state
__input = {'sensor': 11}
output = {'relay': 13, 'greenDiode': 18, 'redDiode': 16, 'buzzer': 7, 'sensor': 11}
pinNumber = []
#---------------- END CONFIG --------

GPIO.setwarnings(False)

def diodeControl(status):
	GPIO.output(output['buzzer'],status)
	GPIO.output(output['greenDiode'],status)
	GPIO.output(output['redDiode'],not status)
	Object.please.update(class_name='doors', status='Open', id='758')
	GPIO.output(output['relay'],not status)
	if status==False:
		for x in range(0,5):
			GPIO.output(output['buzzer'], 1)
			GPIO.output(output['redDiode'],1)
			time.sleep(0.1)
			GPIO.output(output['buzzer'], 0)
			GPIO.output(output['redDiode'],0)
			time.sleep(0.1)
			GPIO.output(output['redDiode'],1)
	else:
		doorClose()

def doorClose():
	#TODO Implement post request with update on door status
	time.sleep(1.5)
	GPIO.output(output['greenDiode'],GPIO.LOW)
	GPIO.output(output['redDiode'],GPIO.HIGH)
	GPIO.output(output['buzzer'],GPIO.LOW)
	Object.please.update(class_name='doors', status='Close', id='758')
	GPIO.output(output['relay'], True)

continue_reading = True

# Capture SIGINT for cleanup when the script is aborted
def end_read(signal,frame):
    global continue_reading
    print "Ctrl+C captured, ending read."
    continue_reading = False
    GPIO.cleanup()

# Hook the SIGINT
signal.signal(signal.SIGINT, end_read)

# Create an object of the class MFRC522
MIFAREReader = MFRC522.MFRC522()
prev_state = False
GPIO.setup(__input['sensor'], GPIO.IN, pull_up_down=GPIO.PUD_UP)
curr_state = False
GPIO.setup(output['relay'], GPIO.OUT, initial=GPIO.HIGH)
GPIO.setup(output['redDiode'], GPIO.OUT, initial=GPIO.HIGH)
GPIO.setup(output['greenDiode'], GPIO.OUT, initial=GPIO.LOW)
GPIO.setup(output['buzzer'], GPIO.OUT, initial=GPIO.LOW)
url = 'https://api.syncano.io/v1.1/instances/muddy-paper-3302/endpoints/scripts/p/fce74a641ded7f277d2aeeaeafff7561146cac9b/door_open/'

# Welcome message
print "RFID Initialized"

def readRFID():
	(status,TagType) = MIFAREReader.MFRC522_Request(MIFAREReader.PICC_REQIDL)
	# If we have the UID, continue
	(status,uid) = MIFAREReader.MFRC522_Anticoll()
	if status == MIFAREReader.MI_OK:
		GPIO.output(output['buzzer'],1)
		time.sleep(0.2)
		GPIO.output(output['buzzer'],0)

		r = requests.post(url, data = {'code':','.join(map(str,uid[:4])), 'door':758,'input_type':'rfid'})
		json_response = json.loads(r.text)
		print str(datetime.now())+" Card UID: "+str(uid[0])+","+str(uid[1])+","+str(uid[2])+","+str(uid[3])+" Door open: "+str(json_response["door_status"])
		diodeControl(json_response['door_status'])
		continue_reading = True

while continue_reading:
	readRFID()
	time.sleep(0.2)
