$(document).ready(function() {
	var socket = io();

	// $("#slider").roundSlider({
	//     radius: 150,
	//     width:10,
	//     sliderType: "min-range",
	//     value: 50,
	//     startAngle: 135,
	//     handleSize: 50,
	// 		step: 10,
	//     circleShape: "pie",
	// 		drag: function(data) {
	// 			console.log("value changed");
	// 			socket.emit("brightness change", data.value);
	// 		}
	// });

	socket.on("ui update", function(data) {
		console.log("received ui update socket - ", data);
		$('#slider').val(data).change();
	});

	$('#slider').rangeslider({
		polyfill: true,
		rangeClass: 'rangeslider',
    disabledClass: 'rangeslider--disabled',
    horizontalClass: 'rangeslider--horizontal',
    verticalClass: 'rangeslider--vertical',
    fillClass: 'rangeslider__fill',
    handleClass: 'rangeslider__handle',
		onInit: function() {
			console.log("rangeslider initialised");
		},
		onSlide: function() {
			console.log("rangeslider sliding!");
		},
		onSlideEnd: function(position, value) {
			console.log("rangeslider ended...");
			console.log(value);
			//socket.emit("brightness change", data);
		}
	});
});
