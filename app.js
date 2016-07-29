var express = require('express');
var bodyParser = require('body-parser');
var async = require('async');
var _ = require('underscore');

var app = express();
var port = process.env.PORT || 1337;

var orders = {};
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
    var place_order_regex = /^order \[(.+?)\](?: with \[(.+)\])?$/i;
    var finished_order_regex = /^finished order$/i;

    if(set_restaurant_regex.test(text)) {
        restaurant = set_restaurant_regex.exec(text)[1];
        return callback(null, {
            "response_type": "in_channel",
            "text": 'Restaurant set to ' + restaurant,
        });
    } else if(place_order_regex.test(text)) {
        if(!restaurant) return callback('Restaurant is not set, you cant place order');
        var order_match = place_order_regex.exec(text);
        var order_item = order_match[1];

        if(!orders.hasOwnProperty(order_item)) orders[order_item] = [];

        var order_detail = {
            'orderer': user,
        }

        order_detail['option'] = order_match.length >= 3 ? order_match[2] : 'no options';

        orders[order_item].push(order_detail);

        console.log(orders);

        return callback(null, {
            "response_type": "in_channel",
            "text": user + ' ordered ' + order_item,
        });
    } else if(finished_order_regex.test(text)) {
        restaurant = null;
        return callback(null, {
            "text": 'order finished!',
        })
    } else {
        return callback('unrecognized command');
    }
}

var print_order = function(callback) {
    var print_text = "";
    async.forEachSeries(Object.keys(orders), function(order_key, order_cb){
        print_text += '-----------------------------\n';
        print_text += order_key + ': in total ' + orders[order_key].length + '\n\n';

        var grouped_by_option = _.groupBy(orders[order_key], function(order){
            return order.option;
        });

        async.forEachSeries(grouped_by_option, function(option, group_cb){
            print_text += option[0]['option'] + ': ' + option.length;
            return group_cb();
        }, function(err){
            if(err) return callback(err);
            return order_cb();
        });
    }, function(err){
        if(err) return callback('Failed to print order');
        orders = {};
        callback(null, print_text);
    })
}
