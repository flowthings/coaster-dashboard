# The flowthings.io Drinks Coaster Dashboard App
This is the IBM Bluemix-deployable Node.js app for the [flowthings.io](http://flowthings.io) drinks coaster demo.

Sign up with an IBM Bluemix account, then press the button below to deploy and run the application:

[![Deploy to Bluemix](https://bluemix.net/deploy/button.png)](https://bluemix.net/deploy?repository=https://github.com/flowthings/coaster-dashboard)


# Drink more water with IoT and flowthings.io
_Let's see how easily it is to build a scalable cloud application for IoT devices using flowthings.io_

Consumer health is a multi-billion dollar industry, and one of the new trends in this area is IoT devices designed to track, analyze and promote personal wellbeing. By tracking their progress against a defined goal, users are motivated to live healthier lifestyles.

Maintaining an adequate intake of water is a recommendation for good health, especially for people with active lifestyles. 

![A Cup of water](https://raw.githubusercontent.com/flowthings/coaster-dashboard/master/public/images/guide/water_cup.jpg)

So the software development team in Brooklyn decided that building a simple water-consumption tracker would be an excellent way to show off how simple and easy it is to use flowthings.io to process IoT device data in the cloud!

## All aboard the flowthings Coaster!
For the hardware, we wanted something really simple to build that would accomodate all types of "drink delivery devices" - mugs, cups, glasses, water bottles etc. That meant a device which attached directly to a cup would probably not be ideal.

That's when we hit on the idea of a drinks coaster:

* It doesn't need to be particularly mobile
* It can easily be plugged in
* It works for all types of container

## Core parts of the demo

![Summary](https://raw.githubusercontent.com/flowthings/coaster-dashboard/master/public/images/guide/overview_diagram.jpg)

* The drinks coaster (an Intel Edison with a load cell attached) periodically reports the weight of the cup which is places upon it. 
* The weight values are sent directly to flowthings.io using the [flowthings Device Agent](https://flowthings.io/docs/flowthings-agent).
* In the cloud, readings are filtered and processed so that we can obtain the aggregated the _decrease_ in weight, and hence the amount of liquid consumed.
* The *Dashboard Application* can be deployed on [IBM Bluemix](https://console.ng.bluemix.net), and will show the user how much water she has consumed as a percentage of her daily target.
* Finally, we can harness the power of [gamification](http://en.wikipedia.org/wiki/Gamification) as a motivational tool to reward the user with achievements if they've hit their set goals.

## Getting Started

Sign up with an [IBM Bluemix account](https://console.ng.bluemix.net/), then press the button below to deploy and run the Dashboard Application:

[![Deploy to Bluemix](https://bluemix.net/deploy/button.png)](https://bluemix.net/deploy?repository=https://github.com/flowthings/coaster-dashboard)

Once deployed, browse the to app's URL and follow the instructions.

## Detailed Explanation
Users can utilize our [REST](https://flowthings.io/docs/http-drop-create), [MQTT](https://flowthings.io/docs/mqtt-importer-task-overview) or [WebSockets](https://flowthings.io/docs/websockets-drop-create) APIs to send device data to flowthings.io. However, we've created an even simpler way of handling this - our [Device Agent](https://flowthings.io/docs/flowthings-agent).

The Agent is self-contained executable that runs on low-powered gateway devices, and facilitates communication between the device and flowthings.io. It also makes authentication and connection management simpler.

The device data itself is standard JSON:

```javascript
{
    elems: {
        "weight" : 14.2
    }
}
```

## Registering a new Device
[Devices](https://flowthings.io/docs/device-object-overview) are first-class objects within flowthings.io. You can track their status, manage their access to data, and communicate directly with them.

On deploying the Dashboard Application, a new Device object is created:

### GUI
![Device GUI](https://raw.githubusercontent.com/flowthings/coaster-dashboard/master/public/images/guide/device_create.jpg)

### cURL
```sh
curl "https://api.flowthings.io/v0.1/drinks_coaster/device?pretty=true" \
    -H "X-Auth-Token: LVxmCbB5QiX1AGAl3E4QuRHJctTG6kTY" \
    -d '{
            "displayName" : "My Drink Coaster",
            "path" : "/drinks_coaster/coaster"
        }'
```

### Node.js

```javascript
// https://www.npmjs.com/package/flowthings
var flowthings = require("flowthings");

var creds = {
  account: '<account_name>',
  token: '<token_string>'
};

var api = flowthings.API(creds);

api.device.create({
  displayName: "Coaster",
  path: util.format("/drinks_coaster/coaster", creds.account)
}, function(err, res) {...});
```


Once the device is registered we can download the Agent binary to the device and configure it. 

```sh
### Choose your architecture:
# x86
curl "https://res.cloudinary.com/dushgp4zq/raw/upload/go-agent/current/386/go-agent"
# amd64
curl "https://res.cloudinary.com/dushgp4zq/raw/upload/go-agent/current/amd64/go-agent"
# arm6
curl "https://res.cloudinary.com/dushgp4zq/raw/upload/go-agent/current/arm/6/go-agent"
# arm7
curl "https://res.cloudinary.com/dushgp4zq/raw/upload/go-agent/current/arm/7/go-agent"
# OS X (darwin)
curl "https://res.cloudinary.com/dushgp4zq/raw/upload/go-agent/current/darwin/go-agent"
```

## Designing the application
When the coaster is powered on, it will send through a constant stream of `weight` measurements. That's fine but we now need to do something useful with it all. A rough outline of our flowthings.io application will look like this:

1. Filter any spurious readings
2. Get the delta between the latest measurement and the previous
3. Filter those deltas that are negative (i.e. where we've filled up our glass, rather than when we've drunk from it)
4. Aggregate the deltas, to get the total amount drunk for the day
5. Send a request to IBM Gamification if we've reached a threshold

flowthings.io will manage automatic scaling of the application.

### Flows - event streams
As events reach flowthings.io, they will be sent to different [Flows](https://flowthings.io/docs/flow-object-overview). We will have different Flows for:

* Raw input
* The last reading received
* Aggregated totals by date

A Flow for the raw input is created automatically when a Device is created.

For the last reading received, we want a Single Capacity Flow, which will keep only the most recent item which it has received.

#### cURL
```sh
curl "https://api.flowthings.io/v0.1/drinks_coaster/flow?pretty=true" \
    -H "X-Auth-Token: LVxmCbB5QiX1AGAl3E4QuRHJctTG6kTY" \
    -d '{
            "capacity" : 1,
            "path" : "/drinks_coaster/coaster/latest"
        }'

curl "https://api.flowthings.io/v0.1/drinks_coaster/flow?pretty=true" \
    -H "X-Auth-Token: LVxmCbB5QiX1AGAl3E4QuRHJctTG6kTY" \
    -d '{
            "path" : "/drinks_coaster/coaster/total_consumed"
        }'
```
#### Node.js
```javascript
api.flow.create({
    path : "/drinks_coaster/coaster/latest",
    capacity : 1
    }, function(err, res) { ... });

//....

api.flow.create({
    path : "/drinks_coaster/coaster/total_consumed"
    }, function(err, res) { ... });
```

### Tracks - event processing
When a reading hits our input Flow (`/drinks_coaster/coaster/default`) we want to trigger our application logic. This logic is defined in a "Track" object.

#### GUI
![Track Processing](https://raw.githubusercontent.com/flowthings/coaster-dashboard/master/public/images/guide/track_gui.jpg)

The order of processing looks like this:
      
1. The raw input data stream.
2. We filter out any data below a threshold. This allows us to ignore events when a cup has been removed from the coaster.
3. A query to find the previous value.
4. Calculate the delta of the current and previous value. This will tell us how much we've drunk / filled up the cup.
5. Send the latest reading to the "Latest" Flow.
6. Check the Delta we calculated. If it is negative, it means we have refilled the cup. We don't care about this value, so ignore it. If it is positive, water has been drunk and we proceed.
7. Query the previous total, and add our new value
8. Store the total drunk for today
9. On this reading, did we reached the target for the day? If so, send an HTTP request to trigger an IBM Gamification reward event

#### cURL
The `js` parameter is the JavaScript which will be executed, in the cloud, when a new reading arrives.

```sh
curl "https://api.flowthings.io/v0.1/drinks_coaster/track?pretty=true" \
    -H "X-Auth-Token: LVxmCbB5QiX1AGAl3E4QuRHJctTG6kTY" \
    -d '{
            "source" : "/drinks_coaster/coaster/default",
            "js" : "function (reading) {
                // Some JavaScript code
                // See https://flowthings.io/docs/example-tracks-in-depth
            }"
        }'
```

#### Node.js

```javascript
api.track.create({
    source : "/drinks_coaster/coaster/default",
    js : "function (reading) { 
        // Some JavaScript code
        // See https://flowthings.io/docs/example-tracks-in-depth
    }"
    }, function(err, res) { ... });
```


## Drops - JSON Data
Now let's see how it all works in practice. We can simulate some test payloads coming from the coaster by creating our own [Drops](https://flowthings.io/docs/drop-object-overview)

#### GUI
![New Drop](https://raw.githubusercontent.com/flowthings/coaster-dashboard/master/public/images/guide/drop_create.jpg)

#### cURL
```sh
curl "https://api.flowthings.io/v0.1/drinks_coaster/drop?pretty=true" \
    -H "X-Auth-Token: LVxmCbB5QiX1AGAl3E4QuRHJctTG6kTY" \
    -d '{
            "path" : "/drinks_coaster/devices/matt_home/default",
            "elems" : { "weight" : 240 }
        }'
```
#### Node.js
```javascript
api.drop(appDetails.totalFlowId).create({
  elems: {
    weight: 240
  }
}, function(err, res){...});
```

## Retrieving updates using WebSockets
The dashboard will display the user's progress in realtime. Getting your data from flowthings.io is as easy as putting it in!

The easiest way to subscribe to events is to use our [WebSockets API](https://flowthings.io/docs/flowthings-websockets-api-authentication). You'll get notified immediately on every update to the data. We want to subscribe to the Daily Total and the Achievement endpoints:

#### JavaScript + jQuery
```javascript
$.ajax({
    url: "https://ws.flowthings.io/session",
    beforeSend: function(req) {
      req.setRequestHeader("X-Auth-Token", "LVxmCbB5QiX1AGAl3E4QuRHJctTG6kTY");
      req.setRequestHeader("X-Auth-Account", "drinks_coaster");
      req.withCredentials = true
    },
    type: "post",
    dataType: 'json',
    success: function(data) {

      var sessionId = data["body"]["id"]
      var url = "wss://ws.flowthings.io/session/" + sessionId + "/ws";

      connection = new WebSocket(url);

      connection.onopen = function() {
        connection.send(connection.send(JSON.stringify({
            "msgId": "sub",
            "object": "drop",
            "type": "subscribe",
            "path": "/drinks_coaster/coaster/total_consumed"
          })));
      };
      connection.onerror = function(error) {
        console.log('WebSocket Error ' + error);
      };
      connection.onmessage = function(e) {
       ...
      };
    }
  });
```


## Who sees what: sharing and restricting the data

### Restricting access to your data
So far we've used the [Master Token](https://flowthings.io/docs/master-token) for the every query we've made to flowthings.io. That's fine when you're building your application, but it's not something you want to distribute with your applications. The Master Token allows full read and write access to your entire account. If distributed with say, and iOS application, the binary could be reverse-engineered and your account could be compromised.

We've developed restricted, individual [Token](https://flowthings.io/docs/token-object-overview) objects for exactly this situation. Tokens can be:

* Generated on the fly, in unlimited quantities
* Personalized for individual users / devices
* Restricted to particular actions (e.g. read only)
* Restricted to particular parts of the application (e.g. leaderboard only)
* Revoked at any time, thereby revoking access to the user / device.
* Set to expire after a pre-defined interval, if you wish.

Our web application should use one of these Tokens. Our coaster should use another one. Why? Because neither needs full read / write / delete access to the entire application. Nor do their access requirements intersect; the coaster needs only to post raw measurements, the web application needs only to read the aggregated results. This method of access segmentation is the cornerstone of good application security.

When we created the coaster Device object, a new Token was generated automatically by the platform. For security purposes, the flowthings.io device agent will only work if supplied with this single-use Token.

If we wanted to create a seperate Token object for the front-end web application, we can use the Developer Site or REST API:

#### GUI
![New Token](https://raw.githubusercontent.com/flowthings/coaster-dashboard/master/public/images/guide/token_create.jpg)

#### cURL
```sh
## Use the Master Token to generate the new Token object
curl "https://api.flowthings.io/v0.1/drinks_coaster/token?pretty=true" \
    -H "X-Auth-Token: LVxmCbB5QiX1AGAl3E4QuRHJctTG6kTY" \
    -d '{
            "paths": {
                "/drinks_coaster/devices/matt_home/achievement" : {
                    "dropRead" : true,
                    "dropWrite": false
                },
                "/drinks_coaster/leaderboard" : {
                    "dropRead" : true,
                    "dropWrite": false
                }
           }
        }'
```

#### JavaScript
```javascript
api.token.create({paths : {
                "/drinks_coaster/devices/matt_home/achievement" : {
                    "dropRead" : true,
                    "dropWrite": false
                },
                "/drinks_coaster/leaderboard" : {
                    "dropRead" : true,
                    "dropWrite": false
                }
           }}, function(err, res) { ... });
```


Now you can interact with any of our APIs, libraries or endpoints using your Token string.

### Sharing your data
By default, users must authenticate as the `drinks_coaster` user to access / post any data. However, flowthings.io is a truly multi-tenant platform where different users can make data available to third parties in a controlled manner. For example, if a user wanted to make their health data accessible to their doctor, who had a flowthings.io account, they could issue a [Share](https://flowthings.io/docs/share-object-overview). A Share works in a similar way to a Token, but grants access to other flowthings.io accounts. For example, you might want to:

* Invite other colleagues (with their own flowthings.io accounts) to help build your application by granting them `write` access to the root of your application.
* Make a stream of data public. E.g. `/drinks_coaster/aggregate_anonymized_stream`. Other users could create Tracks from this data and mix it in to their own application.