// SERVER VARIABLES
  // file system and networks
var fs = require('fs');
var os = require('os');

  // server + dependencies (express)
var http = require('http');
var express = require('express');
var expressHBS = require('express-handlebars');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var cors = require('cors');
var app = express();
var server = http.createServer(app);

  // client websockets and REST
var socketio = require('socket.io')(server);
var unirest = require('unirest');

  // arduino interfacing (johnny5)
var five = require('johnny-five');
var Particle = require('particle-io');
var LifxClient = require('node-lifx').Client;
var light = new LifxClient();

  // database storage
// var mongoose = require('mongoose');
// var Schema = mongoose.Schema;

// BOARD SETUP
var arduinos = [
  {
    id: "roof",
    port: "/dev/cu.usbmodem14111"
  },
  {
    id: "mat",
    port: "/dev/cu.usbmodem14121"
  },
  {
    id: "range",
    port: "/dev/cu.usbmodem14131"
  },
  // {
  //   id: "cube",
  //   io: new Particle({
  //     token: "1059f47f854fca3cd19ccb2b050f8f31d0b227e8",
  //     deviceId: "38001b000447353138383138"
  //   })
  // },
  {
    id: "control-panel",
    port: "/dev/cu.usbmodem14141"
  }
];
var boards = new five.Boards(arduinos);

// PROGRAM CONFIGURATION
var jsonData = {};
var jsonDataBackup = {};
var port = 8080;

var brightness = 0;
var tiltThreshold = 0.15;

// CONTROL PANEL CONFIGURATION
var toggleMat = false;
var toggleRange = false;
var togglePIR = false;
var toggleRangeInside = false;
var toggleCube = false;
var toggleLock = false;

var experiment2 = false;

var ultrasonicRange = 20;

var delayAll = 0; //ben added - for All Delay pot
var delayPIR = 2500; //ben added - for PIR Delay pot

// SERVER SETUP
app.use(logger('dev'));
app.use(bodyParser.urlencoded({'extended':'true'}));
app.use(cookieParser());
app.use(bodyParser.json());
app.use(cors());
app.use(express.static(__dirname + '/public'));
app.use('/json', express.static(__dirname + '/'));

  // set handlebars as the view templating language
app.engine('.hbs', expressHBS({defaultLayout: 'main', extname: '.hbs'}));
app.set('view engine', '.hbs');
app.set('views', __dirname + '/views');

  // routing for each page
  // home page showing brightness control
app.get('/', function(req, res) {
  res.render('index', {title: "Alloy SHW 2016", stylesheet: "main"});
});
  // vote page
app.get('/vote', function(req, res) {
  res.render('index', {title: "Alloy SHW 2016 Vote", stylesheet: "vote", layout: "vote"});
});
  // results page
app.get('/results', function(req, res) {
  res.render('index', {title: "Alloy SHW 2016 Results", stylesheet: "results", layout: "results"});
});

// INITIALISATION
server.listen(port, function() {
  console.log('Server available at ' + 'http://localhost:' + port);
});

fs.readFile('votes.json', 'utf8', function(err, data) {
  if (err) {
    console.log("Error retrieving votes json", err);
    return;
  }
  else {
    jsonData = JSON.parse(data);
    console.log("jsonData loaded with data from votes.json");
  }
});

// APP PROGRAM
boards.on("ready", function() {
  console.log("All boards connected.");
  // SENSOR SETUP

  var roof_range = new five.Proximity({
    board: this.byId("roof"),
    controller: "HCSR04",
    pin: 3,
    freq: 50
  });

  var table_range = new five.Proximity({
    board: this.byId("range"),
    controller: "HCSR04",
    pin: 7,
    freq: 250
  });

  var roof_pir = new five.Motion({
    board: this.byId("roof"),
    pin: 2,
    freq: 250
  });

  var cube = new five.IMU({
    board: this.byId("cube"),
    controller: "MPU6050",
    device: "GY-521",
    freq: 500
  });

  var mat = new five.Button({
    board: this.byId("mat"),
    pin: 2,
    isPullup: true
  });

  var cp_pot_ultrasonic = new five.Sensor({ //ben added - not connected yet
    board: this.byId("control-panel"),
    pin: "A2",
    freq: 100
  });

  var cp_pot_pir = new five.Sensor({ //ben added
    board: this.byId("control-panel"),
    pin: "A1",
    freq: 250
  });

  var cp_pot_allDelay = new five.Sensor({ //ben added
    board: this.byId("control-panel"),
    pin: "A0",
    freq: 250
  });

  var cp_switch_ultrasonic = new five.Switch({
    board: this.byId("control-panel"),
    type: "NO",
    pin: 5,
    freq: 1000
  });

  var cp_switch_mat = new five.Switch({
    board: this.byId("control-panel"),
    type: "NO",
    pin: 8,
    freq: 1000
  });

  var cp_switch_pir = new five.Switch({
    board: this.byId("control-panel"),
    type: "NO",
    pin: 7,
    freq: 1000
  });

  var cp_switch_lock = new five.Switch({ //ben added
    board: this.byId("control-panel"),
    type: "NO",
    pin: 12,
    freq: 1000
  });

  var cp_button_reset = new five.Button({
    board: this.byId("control-panel"),
    pin: 4
  });

  // SENSOR LOGIC
  light.on('light-new', function(bulb) {
    ////////////////////////////////////
    // LET'S GET THIS SHOW ON THE ROAD
    ////////////////////////////////////

    bulb.getState(function(error, data) {
      console.log(data.label + " is ready.");
      bulb.color(0, 100, 0, 3500, 0);
      bulb.on();

      ////////////////////////////////////
      // SET INITIAL CONTROL PANEL STATES
      ////////////////////////////////////

      if (cp_switch_ultrasonic.isOpen) {
        console.log("Ultrasonic Toggle TRUE");
        toggleRange = true;
      }
      else {
        console.log("Ultrasonic Toggle FALSE");
        toggelRange = false;
      };

      if (cp_switch_pir.isOpen) {
        console.log("PIR Toggle TRUE");
        togglePIR = true;
      }
      else {
        console.log("PIR Toggle FALSE");
        togglePIR = false;
      };

      if (cp_switch_mat.isOpen) {
        console.log("Mat Toggle TRUE");
        toggleMat = true;
      }
      else {
        console.log("Mat Toggle FALSE");
        toggleMat = false;
      };

      if (cp_switch_lock.isOpen) { //ben added - for lock switch
        console.log("Lock Toggle TRUE");
        toggleLock = true;
      }
      else {
        console.log("Lock Toggle FALSE");
        toggleLock = false;
      };

    });

    // CONTROL PANEL BUTTONS
    if (!toggleLock) {
      cp_pot_ultrasonic.scale(0,100).on("data", function() { //ben added - pot not connected
        if (toggleRange) {
          ultrasonicRange = parseInt(100 - this.value);
          console.log("Ultrasonic Threshold " + ultrasonicRange);
        }
      });

      cp_pot_pir.scale(100,5000).on("data", function() { //ben added
        if (togglePIR) {
          delayPIR = parseInt(this.value);
          console.log("PIR Delay: " + delayPIR);
        }
      })

      cp_pot_allDelay.scale(0,2500).on("data", function() { //ben added
        delayAll = parseInt(this.value);
        console.log("Global Delay: " + delayAll);
      })

      cp_switch_ultrasonic.on("open", function() {
        console.log("UltrasonicToggle TRUE");
        toggleRange = true;
      });
      cp_switch_ultrasonic.on("closed", function() {
        console.log("Ultrasonic Toggle FALSE");
        toggleRange = false;
      });

      cp_switch_mat.on("open", function() {
        console.log("Mat Toggle TRUE");
        toggleMat = true;
      });
      cp_switch_mat.on("closed", function() {
        console.log("Mat Toggle FALSE");
        toggleMat = false;
      });

      cp_switch_pir.on("open", function() {
        console.log("PIR Toggle TRUE");
        togglePIR = true;
      });
      cp_switch_pir.on("closed", function() {
        console.log("PIR Toggle FALSE");
        togglePIR = false;
      });

      cp_button_reset.on("down", function() {
        console.log("reset pressed");
        bulb.color(0, 100, 0, 3500, delayAll);
      });
    }

    cp_switch_lock.on("open", function() { //ben added - for lock switch
      console.log("Lock Toggle TRUE");
      toggleLock = true;
    });
    cp_switch_lock.on("closed", function() {
      console.log("Lock Toggle FALSE");
      toggleLock = false;
    });

    // REST OF PROGRAM
    roof_range.on("data", function() {
      if (toggleRange) {
        console.log("roof range: " + this.cm);
        if ((this.cm <= ultrasonicRange)) {
          bulb.color(0, 100, 100, 3500, delayAll);
        }
      }
    });

    table_range.on("data", function() {
      if (toggleRangeInside) {
        if (this.cm.between(0,100)) {
          console.log("Roof Range " + this.cm);
        }
        if (this.cm < 100) {
          brightness = Math.min(Math.max(parseInt(this.cm), 0), 100);
          brightness = 100 - brightness;
          bulb.color(0, 100, brightness, 3500, delayAll, function() {
            socketio.emit("ui update", brightness);
          });
        }
      }
    });

    mat.on("down", function() {
      if (toggleMat) {
        bulb.getState( function(error, data) {
          var powerState = data.power;

          if (!powerState) {
            console.log("bulb on");
            bulb.color(0, 100, 100, 3500, delayAll);
          }
        });
      }
    });

    roof_pir.on("calibrated", function(){ //ben added - maybe this helps PIR sensitivity?
      console.log("PIR calibrated")
    })

    roof_pir.on("motionstart", function() {
      if (togglePIR) {
        console.log("motion start");
        window.clearTimeout(pirTimer);
        bulb.color(0, 100, 100, 3500, delayAll);
      }
    });

    roof_pir.on("motionend", function() {
      console.log("motion end - no delay");
      if (togglePIR) {
        var pirTimer = window.setTimeout(function () {
          console.log("real motion end");
          bulb.color(0, 100, 0, 3500, delayAll);
        }, delayPIR);
      }
    });

    cube.on("data", function() {
      // LOGIC TABLE
      if (toggleCube) {
        if (getCubeSide(this.accelerometer.x,this.accelerometer.y,this.accelerometer.z) == "top") {
          console.log("top");

          bulb.getState( function(error, data) {
            if (data.power) {
              bulb.color(0, 100, 100, 3500, delayAll);
              console.log("brightness: " + data.color.brightness);
            }
          });
        }
        if (getCubeSide(this.accelerometer.x,this.accelerometer.y,this.accelerometer.z) == "bottom") {
          console.log("bottom");

          bulb.getState( function(error, data) {
            if (data.power) {
              bulb.color(0, 100, 0, 3500, delayAll);
              console.log("brightness: " + data.color.brightness);
            }
          });
        }
        if (getCubeSide(this.accelerometer.x,this.accelerometer.y,this.accelerometer.z) == "front") {
          console.log("front");

          bulb.getState( function(error, data) {
            if (data.power) {
              bulb.color(0, 100, 40, 3500, delayAll);
              console.log("brightness: " + data.color.brightness);
            }
          });
        }
        if (getCubeSide(this.accelerometer.x,this.accelerometer.y,this.accelerometer.z) == "back") {
          console.log("back");

          bulb.getState( function(error, data) {
            if (data.power) {
              bulb.color(0, 100, 80, 3500, delayAll);
              console.log("brightness: " + data.color.brightness);
            }
          });
        }
        if (getCubeSide(this.accelerometer.x,this.accelerometer.y,this.accelerometer.z) == "left") {
          console.log("left");

          bulb.getState( function(error, data) {
            if (data.power) {
              bulb.color(0, 100, 20, 3500, delayAll);
              console.log("brightness: " + data.color.brightness);
            }
          });
        }
        if (getCubeSide(this.accelerometer.x,this.accelerometer.y,this.accelerometer.z) == "right") {
          console.log("right");

          bulb.getState( function(error, data) {
            if (data.power) {
              bulb.color(0, 100, 60, 3500, delayAll);
              console.log("brightness: " + data.color.brightness);
            }
          });
        }
      }
    });
  });

  light.init();
});

// SOCKET CONNECTIONS
socketio.on('connection', function(socket){
  console.info('New client connected ('+ socket.id +').');

  socket.on('brightness change', function(data){
    console.log(data);
    light.light('d073d5107cb8').color(0, 100, data, 3500, delayAll);
  });

  socket.on('disconnect', function() {
    console.log(socket.id + ' disconnected');
  });

    // when client sends their vote data, increment the database store, then send socket back including new vote tally for client results page.
  socket.on("vote", function(voteData) {
    console.log("vote received for " + voteData);
    jsonData[voteData].votes++;
    fs.writeFile('votes.json', JSON.stringify(jsonData, null, 2), function (err) {
      if (err) {
        console.log('There has been an error saving your configuration data.', err);
        return;
      }
      else {
        console.log("New vote tally: " + jsonData[voteData].votes);
        socket.emit("vote tallied");
        socketio.emit("new vote", jsonData);
      }
    });
  });
});

// HELPER FUNCTIONS

Number.prototype.between = function(a, b) {
  var min = Math.min(a, b);
  var max = Math.max(a, b);
  return this > min && this < max;
};

function getCubeSide(x,y,z) {
  if (x.between(0-tiltThreshold, 0+tiltThreshold) &&
      y.between(0-tiltThreshold, 0+tiltThreshold) &&
      z.between(-1-tiltThreshold, -1+tiltThreshold)) {
    return "top";
  }
  if (x.between(0-tiltThreshold, 0+tiltThreshold) &&
      y.between(0-tiltThreshold, 0+tiltThreshold) &&
      z.between(1-tiltThreshold, 1+tiltThreshold)) {
    return "bottom";
  }
  if (x.between(0-tiltThreshold, 0+tiltThreshold) &&
      y.between(1-tiltThreshold, 1+tiltThreshold) &&
      z.between(0-tiltThreshold, 0+tiltThreshold)) {
    return "front";
  }
  if (x.between(0-tiltThreshold, 0+tiltThreshold) &&
      y.between(-1-tiltThreshold, -1+tiltThreshold) &&
      z.between(0-tiltThreshold, 0+tiltThreshold)) {
    return "back";
  }
  if (x.between(-1-tiltThreshold, -1+tiltThreshold) &&
      y.between(0-tiltThreshold, 0+tiltThreshold) &&
      z.between(0-tiltThreshold, 0+tiltThreshold)) {
    return "left";
  }
  if (x.between(1-tiltThreshold, 1+tiltThreshold) &&
      y.between(0-tiltThreshold, 0+tiltThreshold) &&
      z.between(0-tiltThreshold, 0+tiltThreshold)) {
    return "right";
  }
  else {
    return false;
  };
}

function setIntervalSync(func, delay) {
  var intervalFunction, timeoutId, clear;
  // Call to clear the interval.
  clear = function () {
    clearTimeout(timeoutId);
  };
  intervalFunction = function () {
    func();
    timeoutId = setTimeout(intervalFunction, delay);
  }
  // Delay start.
  timeoutId = setTimeout(intervalFunction, delay);
  // You should capture the returned function for clearing.
  return clear;
};
