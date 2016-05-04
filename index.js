var cool = require('cool-ascii-faces');
var req = require('request');
var express = require('express');
var bodyParser = require('body-parser');
var app = express();

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

  req
  .post('https://meya.ai/webhook/receive/BCvshMlsyFf').auth(meyaAPIKey).form({user_id:'al',text:request.query['Body']})
  .on('response', function(response) {
    console.log(response.statusCode) 
    console.log(response.headers) 
  })
});

app.post('/botresponse', function(request, response) {
  console.log("bot replied");

  console.log(request.body);
  console.log(request.body.text);
});

app.get('/cool', function(request,response) {
  response.send(cool());
});
app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});


