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

  /*if (! req.query.token || req.query.token.valueOf() != slack_token.valueOf()) {
      console.log('Illegal request!');
      return res.sendStatus(403)
  }*/

  var text = req.query.text;

  var userName = req.body.user_name;
  var botPayload = {
      "text": text,
  }

  if (userName !== 'slackbot') {
      return res.status(200).json(botPayload);
  } else {
      return res.status(200).end();
  }
});

var handle_request = function(text) {

}
