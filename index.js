var cool = require('cool-ascii-faces');
var req = require('request');
var express = require('express');
var bodyParser = require('body-parser');
var twilio = require('twilio');

var accountSid = "AC36a9938f19a9480c595e857f2f1af7dd";
var authToken = "264a2e58db9f0ccc58a3003c2c472164";
var workspaceSid = "WS056355824815f89c7cc46e5d8cacaf20";
var workerSid = "WKc9fb44a68905d751dded01581d3fe50c";
var Firebase = require("firebase");


var myFirebase = new Firebase("https://taskrouter.firebaseio.com/");

var capability = new twilio.TaskRouterWorkerCapability(accountSid, authToken, workspaceSid, workerSid);
var client = new twilio.TaskRouterClient(accountSid, authToken,workspaceSid);
var smsclient = new twilio.RestClient(accountSid, authToken);

capability.allowActivityUpdates();
capability.allowReservationUpdates();

// By default, tokens are good for one hour.
// Override this default timeout by specifiying a new value (in seconds).
// For example, to generate a token good for 8 hours:

var token = capability.generate();  // 60 * 60 * 8
var app = express();

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
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies


// views is directory for all template files
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

app.get('/', function(request, response) {
  response.render('pages/index');
});

app.get('/dashboard', function(request, response) {
  response.render('pages/dashboard', {'token': token});
});

app.get('/visualize', function(request, response) {
  response.render('pages/visualize');
});

app.get('/outboundsip', function(request, response) {
  console.log(request.query);
  console.log(request.query['Called']);
  var calledStr=request.query['Called'];
  var calledArray=calledStr.split(/:|@/);
  var calledNumber=calledArray[1];
  console.log(calledNumber);
  var responseText ="<?xml version=\"1.0\" encoding=\"UTF-8\"?>";
  responseText += "<Response>";
  responseText += "<Dial callerId=\"4159660660\">"
  responseText += calledNumber;
  responseText += "</Dial></Response>";
  console.log(responseText);
  response.send(responseText);

});

app.get('/initiatebot', function(request, response) {
  // desired behavior
  // - evaluate whether there is already a task from this messenger
  // if no - create a task and get task sid
  // if yes, get task sid 
  // add message to firebase entry for task sid
  // if task is not bot_qualified
  //    send message to meya with from set to task SID
  console.log("received new message as follows:");
  console.log(request.query['Body']); // message content
  console.log(request.query['From']); // sender ID
  console.log(request.query);


  console.log("checking for any existing task from this user");
  var queryJson={};
  queryJson['EvaluateTaskAttributes']="(message_from=\"" + request.query['From'] + "\")";
  var queryString = "{'EvaluateTaskAttributes':'(message_from=\"" + request.query['From'] + "\")'}";

  var foundTask=0;
  var taskConversationSid="";
  //note the following call is async
  client.workspace.tasks.get(queryJson, function(err, data) {
    if(!err) {
      data.tasks.forEach(function(task) {
        if (task.assignmentStatus == "pending" ||
          task.assignmentStatus == "reserved" ||
          task.assignmentStatus == "assigned") {
          foundTask=1;
        console.log("found an existing task from that user which is still active. Trying to list attributes");
        console.log(task.attributes);
        taskConversationSid = task.sid;
        console.log("will use this existing task sid for this conversation " + taskConversationSid);
        updateConversation(taskConversationSid,request);
      }
    });

      if (!foundTask) {
        console.log("did not find an existing active task for this messenger");
        
        var attributesJson = {};
        //{"message_from":"+14152791216","message_body":"Test message over here","message_to":"+18552226811","message_sid":"SM749eb6d22149847222325fa65d33a608"}
        attributesJson['message_from']=request.query['From'];
        attributesJson['message_body']=request.query['Body'];
        attributesJson['message_to']=request.query['To'];
        attributesJson['message_sid']=request.query['MessageSid'];
        console.log("want to create a new task with these attributes");
        console.log(attributesJson);
        var attributesString=JSON.stringify(attributesJson);

        var options = { method: 'POST',
        url: 'https://taskrouter.twilio.com/v1/Workspaces/'+workspaceSid+'/Tasks',
        auth: {username: accountSid, password: authToken},
        form: 
        { WorkflowSid: 'WW4d526c9041d73060ca46d4011cf34b33',
        Attributes: attributesString
      } 
    };
    req(options, function (error, response, body) {
      if (error) throw new Error(error);
          //console.log(body);
          var newTaskResponse = JSON.parse(body);
          console.log("created a new tasks with Sid "+newTaskResponse.sid);
          updateConversation(newTaskResponse.sid,request);

        });
  }
}
});


  response.send('');



});

app.post('/initiatebot', function(request, response) {
  // desired behavior
  // - evaluate whether there is already a task from this messenger
  // if no - create a task and get task sid
  // if yes, get task sid 
  // add message to firebase entry for task sid
  // if task is not bot_qualified
  //    send message to meya with from set to task SID
  console.log("received new message as follows:");
  console.log(request.body);


  console.log("checking for any existing task from this user");
  var queryJson={};
  queryJson['EvaluateTaskAttributes']="(message_from=\"" + request.query['From'] + "\")";
  var queryString = "{'EvaluateTaskAttributes':'(message_from=\"" + request.query['From'] + "\")'}";

  var foundTask=0;
  var taskConversationSid="";
  //note the following call is async
  client.workspace.tasks.get(queryJson, function(err, data) {
    if(!err) {
      data.tasks.forEach(function(task) {
        if (task.assignmentStatus == "pending" ||
          task.assignmentStatus == "reserved" ||
          task.assignmentStatus == "assigned") {
          foundTask=1;
        console.log("found an existing task from that user which is still active. Trying to list attributes");
        console.log(task.attributes);
        taskConversationSid = task.sid;
        console.log("will use this existing task sid for this conversation " + taskConversationSid);
        updateConversation(taskConversationSid,request);
      }
    });

      if (!foundTask) {
        console.log("did not find an existing active task for this messenger");
        
        var attributesJson = {};
        //{"message_from":"+14152791216","message_body":"Test message over here","message_to":"+18552226811","message_sid":"SM749eb6d22149847222325fa65d33a608"}
        attributesJson['message_from']=request.query['From'];
        attributesJson['message_body']=request.query['Body'];
        attributesJson['message_to']=request.query['To'];
        attributesJson['message_sid']=request.query['MessageSid'];
        console.log("want to create a new task with these attributes");
        console.log(attributesJson);
        var attributesString=JSON.stringify(attributesJson);

        var options = { method: 'POST',
        url: 'https://taskrouter.twilio.com/v1/Workspaces/'+workspaceSid+'/Tasks',
        auth: {username: accountSid, password: authToken},
        form: 
        { WorkflowSid: 'WW4d526c9041d73060ca46d4011cf34b33',
        Attributes: attributesString
      } 
    };
    req(options, function (error, response, body) {
      if (error) throw new Error(error);
          //console.log(body);
          var newTaskResponse = JSON.parse(body);
          console.log("created a new tasks with Sid "+newTaskResponse.sid);
          updateConversation(newTaskResponse.sid,request);

        });
  }
}
});


  response.send('');



});

function updateConversation(taskSid,request) {
  myFirebase.child(taskSid).push({'from':request.query['From'], 'message':request.query['Body']});
  //TODO: need to add an if statement here and only post to meya if bot_qualified is not true
  var meyaAPIKey='i8UIv5TZJyETYAqfHjM2mn6XdxEdZ2MD';
  req
  .post('https://meya.ai/webhook/receive/BCvshMlsyFf').auth(meyaAPIKey).form({user_id:taskSid,text:request.query['Body']})
  .on('response', function(response) {

  })
}

app.get('/deletealltasks', function(request,response) {
  client.workspace.tasks.list(function(err, data) {
    if(!err) {
      console.log(data);
      data.tasks.forEach(function(task) {
        client.workspace.tasks(task.sid).delete();
        console.log('deleted task ' +task.sid);
        //task.delete();
      })
    }
  })
  response.send('all tasks deleted');
        //client.workspace.tasks.delete()
      });


app.post('/botresponse', function(request, response) {
    // desired behavior
  // - receive bot response
  // parse task SID out from bot response
  // add response to firebase index by task SID
  // lookup from URI from task SID
  // send response back to customer
  // 
  // if yes, get task sid 
  // add message to firebase entry for task sid
  // if task is not bot_qualified
  //    send message to meya with from set to task SID
  
  console.log("bot replied");
  myFirebase.child(request.body.user_id).push({'from':'MeyaBot', 'message':request.body.text});
  console.log("trying to get the details for this task with sid " + request.body.user_id);
  client.workspace.tasks(request.body.user_id).get(function(err, task) {
    var attrib=JSON.parse(task.attributes);
  
       smsclient.sendMessage({

    to:attrib.message_from, // Any number Twilio can deliver to
    from: attrib.message_to, // A number you bought from Twilio and can use for outbound communication
    body: request.body.text // body of the SMS message

}, function(err, responseData) { //this function is executed when a response is received from Twilio

    if (!err) { // "err" is an error received during the request, if any

        // "responseData" is a JavaScript object containing data received from Twilio.
        // A sample response from sending an SMS message is here (click "JSON" to see how the data appears in JavaScript):
        // http://www.twilio.com/docs/api/rest/sending-sms#example-1

        console.log(responseData.from); // outputs "+14506667788"
        console.log(responseData.body); // outputs "word to your mother."

    }
    else{
      console.log("there was an error");
    }
});

  });   
  //Send the response
 

  
  console.log(request.body);
  console.log(request.body.user_id);
  console.log(request.body.text);
  response.send('');
});

app.post('/eventstream', function(request, response) {
 var eventstream = myFirebase.child("eventstream");
 eventstream.child(request.body.TaskSid).push({'update':request.body});
});

app.get('/sendsms', function(request, response) {
  console.log(request.query);
  console.log(request.query.to);
  console.log(request.query.from);
  console.log(request.query.body);
  smsclient.sendMessage({

    to:request.query.to, // Any number Twilio can deliver to
    from: request.query.from, // A number you bought from Twilio and can use for outbound communication
    body: request.query.body // body of the SMS message

}, function(err, responseData) { //this function is executed when a response is received from Twilio

    if (!err) { // "err" is an error received during the request, if any

        // "responseData" is a JavaScript object containing data received from Twilio.
        // A sample response from sending an SMS message is here (click "JSON" to see how the data appears in JavaScript):
        // http://www.twilio.com/docs/api/rest/sending-sms#example-1

        console.log(responseData.from); // outputs "+14506667788"
        console.log(responseData.body); // outputs "word to your mother."

    }
    else{
      console.log("there was an error");
    }
});
});


app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});

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

   /*req
  .post('https://meya.ai/webhook/receive/BCvshMlsyFf').auth(meyaAPIKey).form({user_id:'al',text:request.query['Body']})
  .on('response', function(response) {
    console.log(response.statusCode) 
    console.log(response.headers) 
  })
  */
 /*var taskCreationJson = {};
        //taskCreationJson['workflow_sid']="WW4d526c9041d73060ca46d4011cf34b33";
        taskCreationJson['attributes']=attributesJson;
        console.log(taskCreationJson);
        var newTask =client.workspace.tasks.create(attributesJson);
        console.log(newTask);
        var newTask =client.workspace.tasks.create(JSON.stringify(attributesJson));
        console.log(newTask);
        var newTask =client.workspace.tasks.create({workflowSid: "WW4d526c9041d73060ca46d4011cf34b33", attributes: '{"type":"support"}'});
        console.log(newTask);
        */


        /*const firstEntityValue = (entities, entity) => {
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
*/
