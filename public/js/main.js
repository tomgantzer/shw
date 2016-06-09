var socket = io();
var jsonData = {};
var ctx;

$(document).ready(function() {
	// JQUERY LOADED
	if (top.location.pathname === '/results') {

		$.getJSON("/json/votes.json").done(function(data) {
      jsonData = data;
			console.log(jsonData);

			// CHART CONFIGURATION
			ctx = $("#resultsChart");
			var resultsChart = new Chart(ctx, {
				type: 'horizontalBar',
				data: {
						labels: ["Hand", "Cube", "Mobile App"],
						datasets: [{
								label: 0,
								data: [jsonData.hand.votes, jsonData.cube.votes, jsonData.app.votes],
								backgroundColor: [
										'rgba(255, 99, 132, 0.2)',
										'rgba(54, 162, 235, 0.2)',
										'rgba(255, 206, 86, 0.2)'
								],
								borderColor: [
										'rgba(255,99,132,1)',
										'rgba(54, 162, 235, 1)',
										'rgba(255, 206, 86, 1)'
								],
								borderWidth: 1
						}]
				},
				options: {
						scales: {
								yAxes: [{
										ticks: {
												beginAtZero:true
										}
								}]
						}
				}
			});
    });
	}

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

	$('#button-done').click(function() {
		window.location.href = "/vote";
	});

	$('#button-hand').click(function() {
		// $("#button-vote span").html("for Hand");
		socket.emit("vote", "hand");
	});
	$('#button-cube').click(function() {
		// $("#button-vote span").html("for Cube");
		socket.emit("vote", "cube");
	});
	$('#button-app').click(function() {
		// $("#button-vote span").html("for Mobile App");
		socket.emit("vote", "app");
	});
});

socket.on("ui update", function(data) {
	console.log("received ui update socket - ", data);
	$('#slider').val(data).change();
});

socket.on("vote tallied", function(data) {
	window.location.href = "/results";
});

socket.on("new vote", function(voteData) {
	if (top.location.pathname === '/results') {
		location.reload(true);
	}
});
