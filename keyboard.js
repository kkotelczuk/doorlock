#!/usr/bin/env/ node
'use strict'
const requests = require('requests');
const Syncano = require('syncano');
const Gpio = require('onoff').Gpio;
const sleep = require('sleep');
const axios = require('axios');
//--- CONFG ---;

let curr_state;
let prev_state;
let currentCode;
let pinNumber = [];
let continueReading;
let url = 'https://api.syncano.io/v1.1/instances/muddy-paper-3302/endpoints/scripts/p/fce74a641ded7f277d2aeeaeafff7561146cac9b/door_open/';

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

	setupKeyPadPins() {
		for (let i = 0; i < this.COLUMN.length; i++) {
			GPIO.open(this.COLUMN[i], GPIO.OUTPUT, GPIO.PULL_DOWN);
		}
		for (let i = 0; i <this.ROW.length; i++) {
			GPIO.open(this.ROW[i], GPIO.INPUT, GPIO.PULL_DOWN);
		}
	}	
	getRow(pin){
		for (let i = 0; i < this.ROW.length; i++) {
			if (this.ROW[i] === pin)
				return i + 1;
		}
		return 0;;
	}
	getCol(pin) {
		for (let i = 0; i < this.COLUMN.length; i++) {
			if (this.COLUMN[i] === pin)
				return i + 1;
		}
		return 0;
	}
	setColsInput(){
		for (let i = 0; i < this.COLUMN.length; i++) {
			GPIO.open(this.COLUMN[i], GPIO.INPUT, GPIO.PULL_DOWN);
		}
	}
	setupHandlers(active) {
		for (let j = 0; j < this.COLUMN.length; j++) {
            GPIO.poll (this.COLUMN[j], active ? this.buttonHandler : null);
        }

        for (let j = 0; j < this.ROW.length; j++) {
            GPIO.poll (this.ROWs[j], active ? this.buttonHandler : null);
        }
	}
	handleDigit(digit) {
		currentCode += digit;
	}
	handleStar() {
		axios.post(url, {
			input_type: 'pin',
			door: 758,
			code: currentCode
		})
		.then( response => {
			let doorStatus = response.data.door_status;
			console.log(`Pin used: ${currentCode} Door open ${doorStatus}\n`)
			diodeControl(doorStatus);
			doorClose();
			currentCode = '';
		})
	}
	handleKeyPress(key) {
		switch(key) {
			case '*':
				this.handleStar();
				break;
			default:
				this.handleDigit(key);
				break;
		}
	}
	buttonHandler(cbpin) {
		let pressed = GPIO.read(cbpin)
		if (!pressed)
			return;
		setupHandlers(false);
		this.setColsInput();
		GPIO.open (cbpin, GPIO.INPUT, GPIO.PULL_UP);
		let out = `P ${cbpin}`;
		let buttons = '';
		let row = this.getRow(cbpin);
		let col = 0;
		
		for (let i = 0; i < this.COLUMN.length; i++) {
			let state = GPIO.read(this.COLUMN[i]);
			buttons += '' + state;
			if (state)
				col = this.getCol(this.COLUMN[i]);
		}
		let digit = '';
		if (row > 0 && col > 0)
			digit = digits[row-1][col-1];
		this.setupKeyPadPins();
		this.setupHandlers(true);
		if (digit.length > 0)
			this.handleKeyPress(digit);
	}
}
let setupRelayPin = () => {
let buzzer = new Gpio(4, 'out');
let iv = setInterval( () => {
buzzer.writeSync(buzzer.readSync() ^ 1);
console.log('Pin 11 is currently set ' + (buzzer.readSync()) ? 'high' : 'low');
},100);
setTimeout(()=>{
clearInterval(iv);
buzzer.writeSync(0);
buzzer.unexport();
}, 5000);

}

let triggerRelayPin = () => {
	let relayPin = PINS.output.relay;
	let relayDelay = 1500;
	console.log(GPIO.HIGH, GPIO.LOW, relayPin);
	GPIO.open(relayPin, GPIO.OUTPUT);
	GPIO.write(relayPin, 1);
	GPIO.close(relayPin);
console.log('Pin 11 is currently set ' + (GPIO.read(PINS.output.relay) ? 'high' : 'low'));
	setTimeout( () => {
		GPIO.open(relayPin, GPIO.OUTPUT);
		GPIO.write(relayPin, GPIO.LOW);
console.log('Pin 11 is currently set ' + (GPIO.read(PINS.output.relay) ? 'high' : 'low'));
		GPIO.close(relayPin);
		console.log('should fire');
	}, relayDelay);	
}

curr_state = false;
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
//let kp = new Keypad();
//kp.setupKeyPadPins();
setupRelayPin();
//triggerRelayPin();
/*j
while(continueReading){
	readKeypad();
	sleep.slee(0.2);
}*/
