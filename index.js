var cool = require('cool-ascii-faces');
var req = require('request');
var express = require('express');
var bodyParser = require('body-parser');
var app = express();
const actions = {
  say(sessionId, context, message, cb) {
    console.log(message);
    cb();
  },
  merge(sessionId, context, entities, message, cb) {
    cb(context);
  },
  error(sessionId, context, error) {
    console.log(error.message);
  },
};
const Logger = require('node-wit').Logger;
const levels = require('node-wit').logLevels;
const Wit = require('node-wit').Wit;
const logger = new Logger(levels.DEBUG);
const client = new Wit(token, "JUFYXEJC6KRMQX6EVVL4OKNLN7BP5JDF");


app.set('port', (process.env.PORT || 5000));

app.use(express.static(__dirname + '/public'));
app.use( bodyParser.json() ); 

// views is directory for all template files
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

app.get('/', function(request, response) {
  response.render('pages/index');
});

app.get('/initiatebot', function(request, response) {
  var meyaAPIKey='i8UIv5TZJyETYAqfHjM2mn6XdxEdZ2MD';
  console.log("bot initiated");
  console.log(request.query);
  console.log(request.query['Body']);
  const context = {};
client.message(request.query['Body'], context, (error, data) => {
  if (error) {
    console.log('Oops! Got an error: ' + error);
  } else {
    console.log('Yay, got Wit.ai response: ' + JSON.stringify(data));
  }
});

  /*req
  .post('https://meya.ai/webhook/receive/BCvshMlsyFf').auth(meyaAPIKey).form({user_id:'al',text:request.query['Body']})
  .on('response', function(response) {
    console.log(response.statusCode) 
    console.log(response.headers) 
  })
*/
});

app.post('/botresponse', function(request, response) {
  console.log("bot replied");

  console.log(request.body);
  console.log(request.body.text);
});


app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});


