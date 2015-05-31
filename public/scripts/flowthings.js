
// Websockets Connection
var connection;

function heartbeatWS() {
  connection.send(JSON.stringify({
    "type": "heartbeat"
  }));
}

function connectFlowWebsockets(host, username, token, flowId, onUpdate){
	var dateFormat = "YYYYMMDD";
	request = $.ajax({
        url: "https://" + host + "/session",
        beforeSend: function(req) {
        	req.setRequestHeader("X-Auth-Account", username);
        	req.setRequestHeader("X-Auth-Token", token);
        	req.withCredentials = true
        },
        type: "post",
        dataType: 'json',
        success: function(data) {

          var sessionId = data["body"]["id"]
          var url = "wss://" + host + "/session/" + sessionId + "/ws";

          connection = new WebSocket(url);

          connection.onopen = function() {
            connection.send(
              JSON.stringify({
                "msgId": "subscribe-request",
                "object": "drop",
                "type": "subscribe",
                "flowId": flowId
                }));
            var counter = setInterval(heartbeatWS, 10000);
          };
          connection.onerror = function(error) {
            console.log('WebSocket Error ' + error);
          };
          connection.onmessage = function(e) {
            var message = JSON.parse(e.data)
            var todaysDate = moment().format(dateFormat);
            if (message.value) {
              if (message.value.elems.day.value == todaysDate){
                var total = parseInt(message.value.elems.total.value)
                onUpdate(total);
              }
            }
          };
        }
      });
}

function sendWeight(account, path, amount){
	connection.send(JSON.stringify({
		object : "drop",
		type : "create",
		value : {
			path : "/" + account + "/coaster/" + path,
			elems : {
				weight : amount
			}
		}
	}));
}

function drinkSome(account, amount){
	window.setTimeout(function() { sendWeight(account, "latest", amount * 2); }, 100);
	window.setTimeout(function() { sendWeight(account, "default", amount); }, 300);
}


/**
* Render the water gauge that displays the total for the current day
*/
function renderTodaysTotal(value){
	$("#fillgauge").empty();
	var config = liquidFillGaugeDefaultSettings();
	config.circleColor = "#58ACFA";
	config.textColor = "#58ACFA";
	config.waveTextColor = "#58ACFA";
	config.waveColor = "#CEE3F6";
	config.circleThickness = 0.2;
	config.textVertPosition = 0.25;
	config.waveAnimateTime = 2000;
	config.waveRise = false;
	loadLiquidFillGauge("fillgauge", value, config);
}

/**
* Render the bar chart displaying the previous days' totals
*/
function renderBarChart(barData){
	var dateFormat = "YYYYMMDD";
	var margin = {
		top: 20, 
		right: 20, 
		bottom: 90, 
		left: 70
	},
	width = 400 - margin.left - margin.right,
	height = 300 - margin.top - margin.bottom;

	var x = d3.scale.ordinal().rangeRoundBands([0, width], .05);
	var y = d3.scale.linear().range([height, 0]);

	var xAxis = d3.svg.axis()
		.scale(x)
		.orient("bottom")
		.tickFormat(function(d,i) { return moment(d, dateFormat).format("MM/DD")})
		.ticks(10);

	var yAxis = d3.svg.axis()
		.scale(y)
		.orient("left")
		.ticks(10);

	var svg = d3.select("#barchart").append("svg")
		.attr("width", width + margin.left + margin.right)
		.attr("height", height + margin.top + margin.bottom)
		.append("g")
			.attr("transform", 
			  "translate(" + margin.left + "," + margin.top + ")");

  
	x.domain(barData.map(function(d) { return d.x; }));
	y.domain([0, d3.max(barData, function(d) { return d.y; })]);

	svg.append("g")
		.attr("class", "x axis")
		.attr("transform", "translate(0," + height + ")")
		.call(xAxis)
	.selectAll("text")
		.style("text-anchor", "end")
		.attr("dx", "-.8em")
		.attr("dy", "-.55em")
		.attr("transform", "rotate(-90)" );

	svg.append("g")
		.attr("class", "y axis")
		.call(yAxis)
	.append("text")
		.attr("transform", "rotate(-90)")
		.attr("y", 6)
		.attr("dy", "-2.71em")
		.text("% of daily recommended")
		.style("text-anchor", "end");


	svg.selectAll("bar")
		.data(barData)
	.enter().append("rect")
		.style("fill", "steelblue")
		.attr("x", function(d) { return x(d.x); })
		.attr("width", x.rangeBand())
		.attr("y", function(d) { return y(d.y); })
		.attr("height", function(d) { return height - y(d.y); })
}

/**
* Load the IBM Gamification widget at the bottom of the screen
*/
function renderIBMGamificationBar(planName, uid){
	// GameBar
	require(["dojo/request", "dojo/dom", "dojo/_base/array", "bluemix_g/gamebar", "dojo/domReady!"], 
		function(request, dom, arrayUtil, Gamebar){
			var gamebarContainer = dom.byId("gamebar");
			var gamebarConfig = {
				connectMode: 'proxy', //'proxy' or 'direct'
				proxyPath: '/proxy/', //required for 'proxy' mode
				planName: planName,
				uid: uid, 
				refreshInterval:-1, //required for 'proxy' mode, in msec
				enableFollowing: false //turn on Following tab
			}
			// add gamebar widget to the page
			console.log("gamebar config: " + JSON.stringify(gamebarConfig))
			var widget = new Gamebar(gamebarConfig);
			widget.placeAt(gamebarContainer);
			widget.startup();
		});
}