$(document).ready(function() {
	var socket = io();
	var socketID;

	$("#slider").roundSlider({
	    radius: 150,
	    width:10,
	    sliderType: "min-range",
	    value: 50,
	    startAngle: 135,
	    handleSize: 50,
			step: 10,
	    circleShape: "pie",
			drag: function(data) {
				console.log("value changed");
				socket.emit("brightness change", data.value);
			}
	});

	socket.on("ui update", function(data) {
		console.log("received ui update socket - ", data);
		$("#slider").roundSlider("option", "value", data);
	});
});
