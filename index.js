var cool = require('cool-ascii-faces');
var req = require('request');
var express = require('express');
var bodyParser = require('body-parser');
var app = express();
const firstEntityValue = (entities, entity) => {
  const val = entities && entities[entity] &&
    Array.isArray(entities[entity]) &&
    entities[entity].length > 0 &&
    entities[entity][0].value
  ;
  if (!val) {
    return null;
  }
  return typeof val === 'object' ? val.value : val;
};

const actions = {
  say(sessionId, context, message, cb) {
    console.log(message);
    cb();
  },
  merge(sessionId, context, entities, message, cb) {
    // Retrieve the location entity and store it into a context field
    const loc = firstEntityValue(entities, 'location');
    if (loc) {
      context.loc = loc;
    }
    cb(context);
  },
  error(sessionId, context, error) {
    console.log(error.message);
  },
  ['fetch-weather'](sessionId, context, cb) {
    // Here should go the api call, e.g.:
    // context.forecast = apiCall(context.loc)
    context.forecast = 'sunny';
    cb(context);
  },
};
const Logger = require('node-wit').Logger;
const levels = require('node-wit').logLevels;
const Wit = require('node-wit').Wit;
const logger = new Logger(levels.DEBUG);
const client = new Wit("JUFYXEJC6KRMQX6EVVL4OKNLN7BP5JDF",actions,logger);


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
client.converse('my-user-session-42', 'what is the weather?', {}, (error, data) => {
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


