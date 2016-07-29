var express = require('express');
var bodyParser = require('body-parser');
var async = require('async');
var _ = require('underscore');

var app = express();
var port = process.env.PORT || 1337;

var orders = {};
var restaurant = null;
var menu_map = {
    'drupatis': 'http://www.drupatis.com/menu.html',
    'tabule': 'https://yonge.tabule.ca/',
    'kfc': 'http://www.kfc.ca/full-menu',
    "mamaspizza": 'http://mammaspizza.com/menu/pizza'
}

var unrecognized_command_error_msg = 'Unrecognized command. \n\n' + usage_hint;

var usage_hint = "to start order, type '/order start $restaurant' \n" +
                "to place an order, type '/order order [$item]' or '/order order [$item] with [$option]'\n" +
                "to cancel an order, type '/order cancel order [$item]' or '/order cancel order [$item] with [$option]'\n" +
                "to finish order, type '/order finish'";

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
});

var handle_request = function(user, text, callback) {
    var set_restaurant_regex = /^start (.+)$/i;
    var place_order_regex = /^order \[(.+?)\](?: with \[(.+)\])?$/i;
    var cancel_order_regex = /^cancel order \[(.+?)\](?: with \[(.+)\])?$/i;
    var cancel_all_order_regex = /^cancel order \[(.+?)\] all$/i;
    var finished_order_regex = /^finish$/i;
    var help_regex = /^help$/i;

    if(set_restaurant_regex.test(text)) {
        if(restaurant) {
            return callback("There's an ongoing order with " + restaurant +", please finish that order before start another one, " +
                    "To finish current order, type '/order finish'");
        }
        restaurant = set_restaurant_regex.exec(text)[1];

        var response = {
            "response_type": "in_channel",
            "text": user + ' started order, restaurant set to ' + restaurant,
        }

        var restaurant_for_map = restaurant.toLowerCase().replace(/\s/,"").replace(/'/,"");

        if(menu_map.hasOwnProperty(restaurant_for_map)) {
            response['attachments'] = [
                {
                    "text": menu_map[restaurant_for_map]
                }
            ]
        }
        return callback(null, response);
    } else if(place_order_regex.test(text)) {
        if(!restaurant) return callback('Restaurant is not set, you cant place order');
        var order_match = place_order_regex.exec(text);
        var order_item = order_match[1].trim();
        var order_option = order_match[2].trim();
        if(!order_option) order_option = 'no option';
        else order_option = order_option.trim();

        if(!orders.hasOwnProperty(order_item)) orders[order_item] = [];

        var order_detail = {
            'orderer': user,
            'option': order_option
        }

        orders[order_item].push(order_detail);

        var response_text = user + ' ordered ' + order_item;
        if(order_option != 'no option') response_text = response_text + ' with ' + order_option;

        return callback(null, {
            "response_type": "in_channel",
            "text": response_text,
        });
    } else if(finished_order_regex.test(text)) {
        if(!restaurant) return ('No ongoing order');

        print_order(function(err, text){
            if(err) return callback(err);
            restaurant = null;
            orders = {};
            return callback(null, {
                "response_type": "in_channel",
                "text": 'order finished!',
                "attachments": [
                    {
                        "text": text
                    }
                ]
            });
        })
    } else if(cancel_order_regex.test(text)) {

        var order_match = cancel_order_regex.exec(text);
        var order_item = order_match[1].trim();
        var order_option = order_match[2].trim();
        if(!order_option) order_option = 'no option';
        else order_option = order_option.trim();

        var count = 0;
        if(!orders[order_item]) {
            return callback('No order found');
        }

        var canceled_order = []

        async.forEachSeries(orders[order_item], function(order, cancel_cb){
            if(order.orderer != user || order.option != order_option) {
                canceled_order.push(order)
            }
            return cancel_cb();
        }, function(err){
            if(err) return callback('Failed to cancel the order');
            else if(canceled_order.length === orders[order_item].length) {
                return ('Failed to locate the order');
            }
            else {
                if(!canceled_order.length) delete orders[order_item]
                else orders[order_item] = canceled_order;
                return callback(null, {
                    "response_type": "in_channel",
                    'text': 'order for ' + order_item + ' with ' + order_option +
                            ' by ' + user + 'has been canceled.'
                })
            }
        })
    } else if (help_regex) {
        return callback(null, {
            'text': 'hint',
            "attachments": [
                {
                    "text": usage_hint
                }
            ]
        });
    } else {
        return callback(null, {
            'text': 'Unrecognized command',
            "attachments": [
                {
                    "text": usage_hint
                }
            ]
        });
    }
}

var print_order = function(callback) {
    var print_text = "Orders for " + restaurant;
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
        print_text += '\n-----------------------------\n'
        callback(null, print_text);
    })
}
