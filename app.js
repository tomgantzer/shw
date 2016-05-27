// SERVER VARIABLES
var EventEmitter = require('events');
var http = require("http");
var express = require('express');
var cors = require('cors');
var app = express();
var server = http.createServer(app);
var io = require('socket.io')(server);
var bodyParser = require('body-parser');    // pull information from HTML POST (express4)
var methodOverride = require('method-override'); // simulate DELETE and PUT (express4)
var unirest = require('unirest');
var five = require("johnny-five");
var Particle = require("particle-io");
var LifxClient = require('node-lifx').Client;
var light = new LifxClient();
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

// CONFIG VARIABLES
var arduinos = [
  {
    id: "ultrasonic",
    port: "/dev/cu.usbmodem141131"
  },
  {
    id: "pressure",
    port: "/dev/cu.usbmodem1421"
  }
];
var boards = new five.Boards(arduinos);

var port = 8080;
var brightness = 0;
var delay = 120;
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

// SERVER SETUP
app.use(bodyParser.urlencoded({'extended':'true'}));            // parse application/x-www-form-urlencoded
app.use(bodyParser.json());                                     // parse application/json
app.use(bodyParser.json({ type: 'application/vnd.api+json' })); // parse application/vnd.api+json as json
app.use(methodOverride());
app.use(cors());
app.use(express.static(__dirname + '/'));
app.get('/app/', function(req, res) {
  res.sendFile(__dirname + '/index.html');
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

server.listen(port);
console.log('Server available at ' + 'http://localhost:' + port);

// LETS DO THIS!
//EventEmitter.defaultMaxListeners = 0;

boards.on("ready", function() {
  // SENSOR SETUP
  var proximity = new five.Proximity({
    board: this.byId("ultrasonic"),
    controller: "HCSR04",
    pin: 7,
    freq: delay
  });

  var mat = new five.Button({
    board: this.byId("pressure"),
    pin: 2,
    isPullup: true
  });

  var motion = new five.Motion({
    board: this.byId("ultrasonic"),
    pin: 4,
    freq: 250
  });

  // SENSOR LOGIC
  light.on('light-new', function(bulb) {

    bulb.getState(function(error, data){
      console.log("Lightbulb State:");
      console.log(data);
    });

    proximity.on("data", function() {
      if (this.cm < 100) {
        brightness = Math.min(Math.max(parseInt(this.cm), 0), 100);
        brightness = 100 - brightness;
        console.log("Range:  " + brightness);
        bulb.color(0, 100, brightness, 3500, delay, function() {
          io.in('clients').emit("ui update", brightness);
        });
      }
    });

    mat.on("down", function(value) {
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
    });

    motion.on("calibrated", function() {
      console.log("calibrated");
    });

    motion.on("motionstart", function() {
      console.log("motion start");
      bulb.on();
    });

    motion.on("motionend", function() {
      console.log("motion end");
      bulb.off();
    });


  });

  light.init();
});

io.on('connection', function(socket){
  console.info('New client connected ('+ socket.id +').');

  socket.join('clients');

  socket.on('brightness change', function(data){
    console.log(data);
    light.light('d073d5107cb8').color(0, 100, data, 3500, delay);
  });

  socket.on('disconnect', function() {
    console.log(socket.id + ' disconnected');
  });
});
