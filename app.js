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
    port: "/dev/cu.usbmodem141131"
  },
  {
    id: "mat",
    port: "/dev/cu.usbmodem1421"
  },
  {
    id: "range",
    port: "/dev/cu.usbmodem143231"
  },
  {
    id: "cube",
    io: new Particle({
      token: "1059f47f854fca3cd19ccb2b050f8f31d0b227e8",
      deviceId: "38001b000447353138383138"
    })
  },
  {
    id: "control-panel",
    io: new Particle({
      token: "1059f47f854fca3cd19ccb2b050f8f31d0b227e8",
      deviceId: "36003a000a47353235303037"
    })
  }
];
var boards = new five.Boards(arduinos);

// PROGRAM CONFIGURATION
var jsonData = {};
var jsonDataBackup = {};
var port = 8080;

var brightness = 0;
var delay = 120;
var tiltThreshold = 0.15;

// AYLA CONFIGURATION
var aylaEmail = "tom.gantzer@thealloy.com";
var aylaPass = "Chicago1TG";
var aylaURL = "https://user.aylanetworks.com/users/sign_in.json";
var aylaAppID = "the-alloy-id";
var aylaAppSecret = "the-alloy-PUCo41iF4zAEBqwHCbAsnLCQHZk";
var aylaData = {
  "user": {
    "email": aylaEmail,
    "password": aylaPass,
    "application": {
      "app_id": aylaAppID,
      "app_secret": aylaAppSecret
    }
  }
};
var accessToken = "";
var refreshToken = "";

// CONTROL PANEL CONFIGURATION
var toggleMat = true;
var toggleRange = true;
var togglePIR = false;
var toggleRangeInside = false;
var toggleCube = false;

var maxRange = 100;
var minRange = 0;
var fadeRange = 120;

var freqRange = 250;

var delayPIR = 200;

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

// WORKING POST REQUEST TO GET ACCESS TOKEN FOR AYLA API
// unirest.post(aylaURL)
// .headers({'Accept': 'application/json', 'Content-Type': 'application/json'})
// .send(aylaData)
// .end(function (response) {
//   console.log(response.body);
//
//   accessToken = response.body.access_token;
//   refreshToken = response.body.refresh_token;
//
//   //unirest.get("" + "?auth_token=" + accessToken);
// });

// APP PROGRAM
boards.on("ready", function() {
  console.log("All boards connected.");
  // SENSOR SETUP

  var roof_range = new five.Proximity({
    board: this.byId("roof"),
    controller: "HCSR04",
    pin: 3,
    freq: freqRange
  });

  var table_range = new five.Proximity({
    board: this.byId("range"),
    controller: "HCSR04",
    pin: 3,
    freq: freqRange
  });

  var roof_pir = new five.Motion({
    board: this.byId("roof"),
    pin: 4,
    freq: 250
  });

  var cube = new five.IMU({
    board: this.byId("cube"),
    controller: "MPU6050",
    device: "GY-521",
    freq: 750
  });

  var mat = new five.Button({
    board: this.byId("mat"),
    pin: 2,
    isPullup: true
  });

  var cp_pot = new five.Sensor({
    board: this.byId("control-panel"),
    pin: "A0",
    freq: 200
  });

  // SENSOR LOGIC
  light.on('light-new', function(bulb) {

    bulb.getState(function(error, data){
      console.log("Lightbulb State:");
      console.log(data);
    });

    // CONTROL PANEL BUTTONS
    cp_pot.scale(0,5000).on("change", function() {
      delayPIR = this.value;
      console.log(delayPIR);
    });

    // REST OF PROGRAM
    roof_range.on("data", function() {
      if (toggleRange) {
        if (this.cm < maxRange) {
          brightness = Math.min(Math.max(parseInt(this.cm), 0), maxRange);
          brightness = 100 - brightness;
          console.log("Outside Range: " + brightness);
          bulb.color(0, 100, brightness, 3500, fadeRange, function() {
            socketio.emit("ui update", brightness);
          });
        }
      }
    });

    table_range.on("data", function() {
      if (toggleRangeInside) {
        if (this.cm < 100) {
          brightness = Math.min(Math.max(parseInt(this.cm), 0), 100);
          brightness = 100 - brightness;
          console.log("Inside Range: " + brightness);
          bulb.color(0, 100, brightness, 3500, 250, function() {
            socketio.emit("ui update", brightness);
          });
        }
      }
    });

    mat.on("down", function() {
      if (toggleMat) {
        bulb.getState( function(error, data) {
          var powerState = data.power;

          if (powerState) {
            console.log("bulb off");
            bulb.off();
          }
          else {
            console.log("bulb on");
            bulb.on();
          }
        });
      }
    });

    roof_pir.on("motionstart", function() {
      console.log("motion start");
      if (togglePIR) {
        bulb.on();
      }
    });

    roof_pir.on("motionend", function() {
      console.log("motion end - no delay");
      if (togglePIR) {
        setInterval(function () {
          bulb.off();
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
              bulb.color(0, 100, 100, 3500, delay);
              console.log("brightness: " + data.color.brightness);
            }
          });
        }
        if (getCubeSide(this.accelerometer.x,this.accelerometer.y,this.accelerometer.z) == "bottom") {
          console.log("bottom");

          bulb.getState( function(error, data) {
            if (data.power) {
              bulb.color(0, 100, 0, 3500, delay);
              console.log("brightness: " + data.color.brightness);
            }
          });
        }
        if (getCubeSide(this.accelerometer.x,this.accelerometer.y,this.accelerometer.z) == "front") {
          console.log("front");

          bulb.getState( function(error, data) {
            if (data.power) {
              bulb.color(0, 100, 40, 3500, delay);
              console.log("brightness: " + data.color.brightness);
            }
          });
        }
        if (getCubeSide(this.accelerometer.x,this.accelerometer.y,this.accelerometer.z) == "back") {
          console.log("back");

          bulb.getState( function(error, data) {
            if (data.power) {
              bulb.color(0, 100, 80, 3500, delay);
              console.log("brightness: " + data.color.brightness);
            }
          });
        }
        if (getCubeSide(this.accelerometer.x,this.accelerometer.y,this.accelerometer.z) == "left") {
          console.log("left");

          bulb.getState( function(error, data) {
            if (data.power) {
              bulb.color(0, 100, 20, 3500, delay);
              console.log("brightness: " + data.color.brightness);
            }
          });
        }
        if (getCubeSide(this.accelerometer.x,this.accelerometer.y,this.accelerometer.z) == "right") {
          console.log("right");

          bulb.getState( function(error, data) {
            if (data.power) {
              bulb.color(0, 100, 60, 3500, delay);
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
    light.light('d073d5107cb8').color(0, 100, data, 3500, delay);
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
