var express = require('express');
var bodyParser = require('body-parser');

var app = express();
var port = process.env.PORT || 1337;

var order = {};
var restaurant = null;

var slack_token = 'DtVFF8hPgNAAj70gex4tBhRk';

// body parser middleware
app.use(bodyParser.urlencoded({ extended: true }));

// test route
app.get('/', function (req, res) { res.status(200).send('Hello world!'); });

app.listen(port, function () {
    console.log('Listening on port ' + port);
});

app.post('/order', function (req, res, next) {
    if (! req.body.token || req.body.token.valueOf() != slack_token.valueOf()) {
        console.log('Illegal request!');
        return res.sendStatus(403);
    }

    var text = req.body.text;

    var user = req.body.user_name;

    handle_request(user, text, function(err, botPayload){
        if(err) {
            return res.status(200).json({ text: 'err: ' + err});
        } else {
            return res.status(200).json(botPayload);
        }
    })
    /*var botPayload = {
        "text": req.body.text,
    }

    if (userName !== 'slackbot') {
        return res.status(200).json(botPayload);
    } else {
        return res.status(200).end();
    }*/
});

var handle_request = function(user, text, callback) {
    var set_restaurant_regex = /^set restaurant (.+)$/i;
    var place_order_regex = /^order \[(.+)\](?: with \[(.+)\])?$/i;
    var finished_order_regex = /^finished order$/i;

    if(set_restaurant_regex.test(text)) {
        restaurant = set_restaurant_regex.exec(text)[1];
        return callback(null, {
            "text": 'Restaurant set to ' + restaurant,
        });
    } else if(place_order_regex.test(text)) {
        if(!restaurant) return callback('Restaurant is not set, you cant place order');
        var order_item = place_order_regex.exec(text)[1];
        return callback(null, {
            "text": user + ' ordered' + order_item,
        });
    } else if(finished_order_regex.test(text)) {
        restaurant = null;
        return callback(null, {
            "text": 'order finished!',
        })
    } else {
        return callbck('unrecognized command');
    }
}
