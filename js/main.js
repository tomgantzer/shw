var socket = io();

$(document).ready(function() {
	$('#slider').rangeslider({
		polyfill: false,
		rangeClass: "rangeslider",
    disabledClass: "rangeslider--disabled",
    horizontalClass: "rangeslider--horizontal",
    verticalClass: "rangeslider--vertical",
    fillClass: "rangeslider__fill",
    handleClass: "rangeslider__handle",
		onInit: function() {
			console.log("rangeslider initialised");
		},
		onSlideEnd: function(position, value) {
			console.log("rangeslider ended...", value);
			socket.emit("brightness change", value);
		}
	});

	$('#button-up').click(function() {
		var value =  parseInt($('#slider').val());
		if (value >= 0 && value <= 100) {
			$('#slider').val(value + 10).change();
			value =  parseInt($('#slider').val());
			console.log(value);
			socket.emit("brightness change", value);
		}
	});
	$('#button-down').click(function() {
		var value =  parseInt($('#slider').val());
		if (value >= 0 && value <= 100) {
			$('#slider').val(value - 10).change();
			value =  parseInt($('#slider').val());
			console.log(value);
			socket.emit("brightness change", value);
		}
	});
});

socket.on("ui update", function(data) {
	console.log("received ui update socket - ", data);
	$('#slider').val(data).change();
});
