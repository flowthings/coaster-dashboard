//------------------------------------------------------------------------------
// Flowthings.io Drinks Coaster Demo
//------------------------------------------------------------------------------

var express = require('express'),
  exphbs = require('express-handlebars'),
  reload = require('reload'),
  http = require('http'),
  moment = require('moment'),
  cfenv = require("cfenv"),
  util = require("util"),
  setup = require("./setupApplication.js")(),
  flowthings = require('flowthings'),
  bodyParser = require('body-parser');


// Get Bluemix Environment variables
var appEnv = cfenv.getAppEnv();
var environment = JSON.parse(process.env.VCAP_SERVICES);

if (!environment) {
  console.log("Could not find Environment VCAP_SERVICES. Are you running locally?");
  process.exit(1);
}

var gamificationConfig = environment.Gamification[0];
var flowthingsConfig = environment.flowthings[0];

// Constants
var dateFormat = "YYYYMMDD";
var target = 900;

// Handlebars Templating
var hbs = exphbs.create({
  helpers: {
    json: function(obj) {
      return JSON.stringify(obj);
    }
  }
});

// create a new express server
var app = express();
app.engine('handlebars', hbs.engine);
app.use(express.static(__dirname + '/public'));
app.set('view engine', 'handlebars');

// Flowthings Credentials
var api = flowthings.API(flowthingsConfig.credentials);

/*
 * Routes
 */

// App Setup - 1 time only
app.post("/setup", bodyParser.urlencoded({
  extended: true
}), function(req, res) {

  var gamificationDetails = {
    key: req.body.key,
    firstName: req.body.firstName,
    lastName: req.body.lastName,
    planName: req.body.planName,
    tenantId: gamificationConfig.credentials.tenantId,
    host: gamificationConfig.credentials.gamiHost
  };

  setup.setupApplication(res, flowthingsConfig.credentials, gamificationDetails, function(appDetails) {
    console.log("App Details: " + JSON.stringify(appDetails, null, '\t'));
    res.redirect("/");
  });
});

// misc
app.get("/guide", function(req, res) {
  res.render("guide");
});

app.get("/welcome", function(req, res) {
  res.render("welcome");
});

app.get("/", function(req, res) {
  setup.getAppConfig(
    app,
    function() {
      res.render('welcome');
    },
    function(appDetails) {
      try {
        populateDailyTotals(appDetails, function(data, today, latest, yyyymmdd) {

          res.render('home', {
            ibmPlanName: appDetails.gamificationPlanName,
            ibmUserId: appDetails.account,
            layout: false,
            drops: data,
            today: today,
            latest: latest,
            deviceId: appDetails.deviceId,
            target: target,
            wsHost: "ws.flowthings.io",
            tokenString: appDetails.tokenString,
            flowUser: flowthingsConfig.credentials.account,
            flowId: appDetails.totalFlowId
          });
        });
      } catch (err) {
        console.log("Error: " + JSON.stringify(err));
      }
    });
});


// Start Serving
var server = http.createServer(app);
reload(server, app);

app.listen(appEnv.port, appEnv.bind, function() {
  console.log("server starting on " + appEnv.url);
});

/**
 * Retrieve coaster demo
 */
function populateDailyTotals(appDetails, f) {

  var todaysDate = moment().startOf('day');

  var consumptionData = [];
  var consumedToday = 0;
  var oldestDate = moment(todaysDate).subtract(7, 'days');

  api.drop(appDetails.totalFlowId).find({
    limit: 5,
    hints: false
  }, function(err, resp) {

    if (err) {
      console.log("Error fetching drop data: " + JSON.stringify(err));
      return;
    }

    var consumptionMap = {};

    resp.forEach(function(e) {

      var day = moment(e.elems.day, dateFormat);

      var consumed = 0;
      if (day.isAfter(oldestDate)) {
        // Use it
        consumed = e.elems.total;
      }

      if (!todaysDate.isSame(day, 'day')) {
        consumptionMap[day.format(dateFormat)] = Math.round(consumed / target * 100);
      } else {
        consumedToday = Math.round(consumed / target * 100);
      }

    });

    // Clone the date for the loop
    var loopDate = moment(todaysDate);
    for (var i = 1; i < 10; i++) {
      var day = todaysDate.subtract(1, 'days');
      var value = consumptionMap[day.format(dateFormat)];
      value = value ? value : 0;
      consumptionData.push({
        x: day.format(dateFormat),
        y: value
      });
    }

    api.drop(appDetails.latestFlowId).find({
      limit: 1,
      hints: false
    }, function(err, resp) {
      var latestWeight = resp.length === 0 ? 0 : resp[0].elems.weight;
      console.log(resp);
      consumptionData.sort(function(a, b) {
        return a.x - b.x;
      });
      f(consumptionData, consumedToday, latestWeight, todaysDate.format(dateFormat));
    });

  });
}