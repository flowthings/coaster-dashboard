/**
 * Creates the flowthings.io application on startup
 */

var Promise = require('bluebird'),
  flowthings = require('flowthings'),
  http = require('http'),
  util = require('util'),
  moment = require('moment'),
  restClient = require('./gamiRESTClient.js'),
  fs = require('fs'),
  path = require('path');

var gamificationProxySetup = false;

module.exports = function() {
  return {

    /**
     * First time setup of the flowthings Flows, Tracks, Devices.
     */
    setupApplication: function(res, creds, gamificationDetails, f) {
      var dateFormat = "YYYYMMDD";
      var todaysDate = moment().startOf('day');

      // Create the IBM Gamification user
      var path = "/service/plan/" + gamificationDetails.planName + "/user?key=" + gamificationDetails.key +
        "&tenantId=" + gamificationDetails.tenantId;

      var options = {
        hostname: gamificationDetails.host,
        path: path,
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        }
      };

      var req = http.request(options, function(response) {

        createGamificationEvent(gamificationDetails);

        var appDetails = {
          account: creds.account,
          gamificationHost: gamificationDetails.host,
          gamificationKey: gamificationDetails.key,
          gamificationTenantId: gamificationDetails.tenantId,
          gamificationUserId: creds.account,
          gamificationPlanName: gamificationDetails.planName
        };

        var api = flowthings.API(creds, {
          transform: flowthings.promisify(Promise)
        });

        /*
         *  Create the base Flow 
         */
        console.log("Setting up Flow App");
        api.flow.create({
            path: util.format("/%s/coaster", creds.account)
          })
          /*
           *  Create a "Device" object. This will set up input and output endpoints,
           *  a secure token, and management / monitoring tools  
           */
          .then(function(flow) {
            console.log("Created Root Flow");
            return api.device.create({
              displayName: "Coaster",
              path: util.format("/%s/coaster", creds.account)
            });
          })
          /*
           *  Get the restricted token string. We'll need that to read data 
           */
          .then(function(device) {
            console.log("Created Device");
            appDetails.deviceId = device.id;
            return api.token.read(device.tokenId);
          })
          /*
           *  Create a Flow to store the total amount drunk, per day
           */
          .then(function(token) {
            console.log("Got Device Token");
            appDetails.tokenString = token.tokenString;
            return api.flow.create({
              path: util.format("/%s/coaster/total_consumed", creds.account)
            });
          })
          /*
           *  Create some sample data
           */
          .then(function(flow) {
            console.log("Created Total Flow");
            appDetails.totalFlowId = flow.id;

            var date = todaysDate.format(dateFormat);
            return api.drop(appDetails.totalFlowId).create({
              fhash: date,
              elems: {
                day: date,
                total: 200,
                previousTotal: 150
              }
            });
          }).then(function(drop) {
            todaysDate.subtract(1, 'day');
            var date = todaysDate.format(dateFormat);
            return api.drop(appDetails.totalFlowId).create({
              fhash: date,
              elems: {
                day: date,
                total: 450
              }
            });
          }).then(function(drop) {
            todaysDate.subtract(1, 'day');
            var date = todaysDate.format(dateFormat);
            return api.drop(appDetails.totalFlowId).create({
              fhash: date,
              elems: {
                day: date,
                total: 250
              }
            });
          }).then(function(drop) {
            todaysDate.subtract(1, 'day');
            var date = todaysDate.format(dateFormat);
            return api.drop(appDetails.totalFlowId).create({
              fhash: date,
              elems: {
                day: date,
                total: 150
              }
            });
          })
          /*
           *  Create a Flow to store the latest reading from the Coaster
           */
          .then(function(drop) {
            console.log("Created Sample Drops");
            return api.flow.create({
              path: util.format("/%s/coaster/latest", creds.account),
              capacity: 1
            });
          })
          /*
           *  Create the application processing logic (Track).
           */
          .then(function(flow) {
            console.log("Created Latest Flow");
            appDetails.latestFlowId = flow.id;

            res.render('track', appDetails, function(err, trackText) {
              console.log("Got Track JS");

              res.render('metadata', appDetails, function(err, metadataText) {
                console.log("Got Track Metadata");

                api.track.create({
                  metadata: JSON.parse(metadataText),
                  js: trackText,
                  source: util.format("/%s/coaster/default", creds.account)
                }).then(function(track) {
                  console.log("Created Track");
                  appDetails.trackId = track.id;

                  // Saving all the config locally
                  fs.writeFile("appConfig.json", JSON.stringify(appDetails, null, '\t'), function(err) {
                    if (err) {
                      return console.log(err);
                    }
                    console.log("Saved!");
                  });

                  f(appDetails);

                }).catch(function(err) {
                  console.log("Error creating Track: ", err);
                });
              });
            });
          })
          .catch(function(err) {
            console.log("Error creating Application:", err);
          });
      });

      req.on('error', function(e) {
        console.log('problem with request: ' + e.message);
      });
      req.write(JSON.stringify({
        "uid": creds.account,
        "firstName": gamificationDetails.firstName,
        "lastName": gamificationDetails.lastName
      }));
      req.end();

    },

    getAppConfig: function(app, notreadyf, readyf) {

      fs.exists('appConfig.json', function(exists) {

          try {
            var appDetails = require("./appConfig.json");
            /** 
             *  Set up IBM Gamification Proxy, once.
             */
            if (!gamificationProxySetup) {
              var restConf = restClient.config({
                gamiHost: appDetails.gamificationHost,
                tenantId: appDetails.gamificationTenantId,
                planName: appDetails.gamificationPlanName,
                key: appDetails.gamificationKey,
                getLoginUid: function(req) {
                  return appDetails.account;
                }
              });

              console.log("Setting up Gamification: " + JSON.stringify(restConf, null, '\t'));


              app.get("/proxy/*", restClient.proxy(restConf));
              app.post("/proxy/*", restClient.proxy(restConf));
              gamificationProxySetup = true;
            }

            readyf(appDetails);
          } catch (err){
            notreadyf();
          }


      });
    }
  };
};

function createGamificationEvent(gamificationDetails){
  console.log("Creating Gamification Event");
  var path = "/service/plan/" + gamificationDetails.planName + "/event?key=" + gamificationDetails.key +
      "&tenantId=" + gamificationDetails.tenantId;

    var options = {
      hostname: gamificationDetails.host,
      path: path,
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      }
    };

    var req = http.request(options, function(response) {});
    req.on('error', function(e) {
      console.log('problem with request: ' + e.message);
    });
    req.write(JSON.stringify({
      "name" : "dailytargethit", 
      "impacts" : [
        {"target" : "vars.xp.value", "formula" : "vars.xp.value+1"}
      ]
    }));
    req.end();
}