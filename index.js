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

function epicRandomString(b){for(var a=(Math.random()*eval("1e"+~~(50*Math.random()+50))).toString(36).split(""),c=3;c<a.length;c++)c==~~(Math.random()*c)+1&&a[c].match(/[a-z]/)&&(a[c]=a[c].toUpperCase());a=a.join("");a=a.substr(~~(Math.random()*~~(a.length/3)),~~(Math.random()*(a.length-~~(a.length/3*2)+1))+~~(a.length/3*2));if(24>b)return b?a.substr(a,b):a;a=a.substr(a,b);if(a.length==b)return a;for(;a.length<b;)a+=epicRandomString();return a.substr(0,b)};

function askFollowUp(user){
	client.converse(user, null, (error, data) => {
  if (error) {
    console.log('Oops! Got an error: ' + error);
  } else {
    console.log('Yay, got Wit.ai msg response: ');
    console.log(data);
}
 
});
}

app.set('port', (process.env.PORT || 5000));

app.use(express.static(__dirname + '/public'));
app.use( bodyParser.json() ); 

// views is directory for all template files
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

app.get('/', function(request, response) {
  response.render('pages/index');
});

app.get('/outboundsip', function(request, response) {
  console.log(request.query);
  console.log(request.query['Called']);
  var calledStr=request.query['Called'];
  var calledArray=calledStr.split(/:|@/);
  var calledNumber=calledArray[1];
  console.log(calledNumber);
  response.sendStatus(200);

  });

app.get('/initiatebot', function(request, response) {
  var meyaAPIKey='i8UIv5TZJyETYAqfHjM2mn6XdxEdZ2MD';
  req
  .post('https://meya.ai/webhook/receive/BCvshMlsyFf').auth(meyaAPIKey).form({user_id:'al',text:request.query['Body']})
  .on('response', function(response) {
    console.log(response.statusCode) 
    console.log(response.headers) 
  })
  /*
  var user=epicRandomString(10);
  console.log("bot initiated");
  console.log("using user ID "+user);
  /*console.log(request.query);
  console.log(request.query['Body']);*/
  /*
  const context = {};
  console.log("asking the first question");
  client.runActions(
        sessionId, // the user's current session
        msg, // the user's message 
        sessions[sessionId].context, // the user's current session state
        (error, context) => {
          if (error) {
            console.log('Oops! Got an error from Wit:', error);
          } else {
            // Our bot did everything it has to do.
            // Now it's waiting for further messages to proceed.
            console.log('Waiting for futher messages.');

            // Based on the session state, you might want to reset the session.
            // This depends heavily on the business logic of your bot.
            // Example:
            // if (context['done']) {
            //   delete sessions[sessionId];
            // }

            // Updating the user's current session state
            sessions[sessionId].context = context;
          }
        }
      );




client.converse(user, 'what\'s the weather?', {}, (error, data) => {
  if (error) {
    console.log('Oops! Got an error: ' + error);
  } else {
    console.log('Yay, got Wit.ai merge response: ');
    console.log(data);
    console.log("requesting follow up");
    
 

  }
  askFollowUp(user);
});
 */

response.sendStatus(200);


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


