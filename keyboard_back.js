#!/usr/bin/env/ node
'use strict'
const GPIO = require('rpio');
const requests = require('requests');
const Syncano = require('syncano');
const sleep = require('sleep');
//--- CONFG ---
let curr_state;
let prev_state;
let pinNumber = [];
let continueReading;
const connect = {
	INSTANCE_NAME: process.env['INSTANCE_NAME'],
	API_KEY: process.env['SYNCANO_API_KEY'],
	USER_KEY: process.env['SYNCANO_USER_KEY']
}
const  PINS = { 
	input: {sensor: 11},
	output: {
		relay: 13,
		greenDiode: 18,
		redDiode: 16,
		buzzer: 7,
		sensor:11
	}
}	
//Default mode is MODE_RPI - BOARD PINOUTS
// --- END CONFIG ---
var connection = Syncano({
	instanceName: connect.INSTANCE_NAME, 
	apiKey: connect.API_KEY, 
	userKey: connect.USER_KEY
});

let DataObject = connection.DataObject;
class Keypad {
	constructor(){
	this.KEYPAD = [
		[1,2,3,"A"],
		[4,5,6,"B"],
		[7,8,9,"C"],
		["*",0,"#","D"]
	];	
	this.COLUMN = [32,36,38,40]; // PINOUTS FOR COLUMN KEYPAD
	this.ROW    = [31,33,35,37]; // PINOUTS FOR ROW KEYPAD
	}
	exit() {
		for (let i = 0; i < this.ROW.length; i++) {
			GPIO.setup(this.ROW[i], GPIO.DIR_IN, (error) => {
			if (error)
				console.error(error);
			});
		}
		for (let i = 0; i < this.COLUMN.length; i++) {
			GPIO.setup(this.COLUMN[i], GPIO.DIR_IN, (error) => {
				if (error) 
				 console.error(error)		
			});
		}
	}
	setupKeyPadPins() {
		for (let i = 0; i < this.COLUMN.length; i++) {
			GPIO.open(this.COLUMN[i], GPIO.OUTPUT, GPIO.PULL_DOWN);
		}
		for (let i = 0; i <this.ROW.length; i++) {
			GPIO.open(this.ROW[i], GPIO.INPUT, GPIO.PULL_DOWN);
		}
	}	
}
let doorClose = () => {
	sleep.sleep(1.5);
	GPIO.output(PINS.output.greenDiode, 0); 
	GPIO.output(PINS.output.redDiode, 1);
	GPIO.output(PINS,output.buzzer, 0);
	// TODO:
	// Syncano object update
	let query = {
		id: 758,
		className: 'doors',
	}
	let doorStatus = { 
		status: 'Close'
	}
	DataObject.please().update(query, doorStatus).then( door => {
		console.log(`Status has been updated to ${door.status}`);
	})	
	GPIO.output(PINS.output.relay, 1)
}
let diodeControl = (status) => {
	GPIO.output(PINS.output.buzzer, status);
	GPIO.output(PINS.output.greenDiode, status);
	GPIO.output(PINS.output.redDiode, !status);
	//TODO:
	// implement syncano object update
	let query = { 
		id: 758,
		className: 'doors',
	};
	let doorStatus = {
		status: 'Open'
	};
	
	DataObject.please().update(query, doorStatus).then(door => {
		console.log(`Status has been updated to ${door.status}`);
	});
	GPIO.output(PINS.output.relay, !status);
	if (status === false) {
		for (let i = 0; i < 5; i++) {
			GPIO,output(PINS.output.buzzer, 1);
			GPIO.output(PINS.output.redDiode, 1);
			sleep.sleep(0.1);	
			GPIO.output(PINS.output.buzzer, 0);
			GPIO.output(PINS.output.redDiode, 0);
			sleep.sleep(0.1);
			GPIO.output(PINS.output.redDiode, 1);
		}
	} else {
		doorClose();
	}
}
continueReading = true;
// Capture SIGINT for cleanup when the script is aborted

let endRead = () => {
	console.log('CTRL+C captured, ending now');
	continueReading = false;
	GPIO.destroy();
}
process.on('exit', (code) => {
console.log(`Exiting with code of ${code}`);
endRead();
});
//signal.signal(signal.SIGINT, endRead);
console.log('RELAY: ', PINS.output.relay);
prev_state = false;
GPIO.setup(PINS.output.relay, GPIO.DIR_OUT, (error) => {
	if (error) {
		console.error(error);
	}	
	GPIO.output(PINS.output.relay, 1, (error) => {
		if (error) 
			console.error(error);
	});
});
GPIO.setup(PINS.output.redDiode, GPIO.DIR_OUT, (error) => {
	GPIO.output(PINS.output.redDiode, 1, (error) => {
		if (error)
			console.error(error);
	});
});
GPIO.setup(PINS.output.greenDiode, GPIO.DIR_OUT, (error) => {
	GPIO.output(PINS.output.greenDiode, 0, (error) => {
		if (error)
			console.error(error);
	});
});
GPIO.setup(PINS.output.buzzer, GPIO.DIR_OUT, (error) => {
	GPIO.output(PINS.output.buzzer, 0, (error) => {
		if (error)
			console.error(error);
	});
});
curr_state = false;
let url = 'https://api.syncano.io/v1.1/instances/muddy-paper-3302/endpoints/scripts/p/fce74a641ded7f277d2aeeaeafff7561146cac9b/door_open/';
let readKeypad = () => {
	let kp = new Keypad();
	//let digit = kp.getKey();
	kp.setupKeyPadPins();
	if (digit !== undefined) {
		GPIO.output(PINS.output.buzzer, 1);
		sleep.sleep(0.1);
		GPIO.output(PINS.output.buzzer, 0);
		if (digit !== '*') {
			pinNumber.push(digit);
		}
		if (digit === '*') {
			let pinString = pinNumber.join('');
			axios.post(url,{
				input_type: 'pin',
				door: 758,
				code: pinString
			})
			.then( response => {
				let doorStatus = response.data.door_status;
				console.log(`Pin used: ${pinString} Door Open: ${doorStatus}\n`);
				diodeControl(doorStatus);
				doorClose();
				pinNumber = [];
				pinString = '';
			});	
		}
	}	
}
while(continueReading){
	readKeypad();
	sleep.slee(0.2);
}
