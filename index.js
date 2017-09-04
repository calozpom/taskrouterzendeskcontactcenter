require('dotenv').load();

var AWS = require('aws-sdk');
var bodyParser = require('body-parser');
var express = require('express');
var Firebase = require('firebase');
var FirebaseTokenGenerator = require('firebase-token-generator');
var fs = require('fs')
var querystring = require("querystring");
var req = require('request');
var twilio = require('twilio');
var taskrouterHelper = require('./jwt/taskrouter/tokenGenerator');
var twilioClientHelper = require('./jwt/client/tokenGenerator');

// Twilio creds
var accountSid = process.env.accountSid;
var authToken = process.env.authToken;
var workspaceSid = process.env.workspaceSid;
var workflowSid = process.env.workflowSid;
var workerSid = process.env.workerSid;
var voiceTaskChannelSid = process.env.voiceTaskChannelSid;
var chatTaskChannelSid = process.env.chatTaskChannelSid;

var secondAccountSid = process.env.secondAccountSid;
var secondAuthToken = process.env.secondAuthToken;

var syncServiceInstance = process.env.syncServiceInstance;
var chatServiceInstance = process.env.chatServiceInstance;

var twilioPhoneNumber = process.env.twilioPhoneNumber;
var twilioPhoneNumberSkipBot = process.env.twilioPhoneNumberSkipBot;
var alsPhoneNumber = process.env.alsPhoneNumber;

// Meya, Facebook, Firebase creds
var meyaAPIKey = process.env.meyaAPIKey;
var pageAccessToken = process.env.pageAccessToken; //facebook
var firebaseSecret = process.env.firebaseSecret;

// Server side setup

// AWS Polly (text-to-speech) setup
AWS.config = {
  region: 'us-east-1',
  maxRetries: '3',
  accessKeyId: process.env.awsAccessKeyId,
  secretAccessKey: process.env.awsSecretAccessKey,
  timeout: '15000'
};

var polly = new AWS.Polly();
if (!fs.existsSync('/tmp')) {
    fs.mkdirSync('/tmp');
}

// Firebase setup
console.log("Trying to authenticate to Firebase with secret " + firebaseSecret);
var firebaseTokenGenerator = new FirebaseTokenGenerator(firebaseSecret);
//firebase instance is set to allow read from any client, but write only from secure-server. From firebase settings:
/*{
    "rules": {
        ".read": true,
        ".write": "auth.uid === 'secure-server'"
    }
}
*/
//probably ought to implement some sort of token refresh function
//firebase expires parameter is seconds since epoch (set to expire Tuesday, August 3, 2100)
var firebaseToken = firebaseTokenGenerator.createToken({ uid: "secure-server"}, { expires: 4121017284});
console.log("Firebase Token: " + firebaseToken);
var myFirebase = new Firebase("https://taskrouter.firebaseio.com/");
myFirebase.authWithCustomToken(firebaseToken, function(error, authData) {
  if (error) {
    console.log("Firebase Auth Error: " + error);
  } else {
    console.log("Firebase Auth Status: " + authData);
  }
});

// Twilio setup
var twilioClient = new twilio(accountSid, authToken);
var secondTwilioClient = new twilio(secondAccountSid, secondAuthToken);
var syncService = twilioClient.sync.services(syncServiceInstance);

// Express setup
var app = express();

app.set('port', (process.env.PORT || 5000));
app.use(express.static(__dirname + '/public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
})); // support encoded bodies

// views is directory for all template files
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.disable('view cache');

app.get('/', function(request, response) {
  response.render('pages/index');
});

app.get('/dashboard', function(request, response) {
  // dashboard is the main page for the demo
  response.render('pages/dashboard');
});

app.get('/zendeskdashboard', function(request, response) {
  // dashboard is the main page for the demo
  response.render('pages/zendeskdashboard');
});

app.get('/agentcontrols', function(request, response) {
  // dashboard is the main page for the demo
  response.render('pages/agentcontrols');
});

app.get('/grr', function(request, response) {
  // dashboard is the main page for the demo
  response.render('pages/whywontyouwork');
});

app.get('/reservationmodal', function(request, response) {
  // dashboard is the main page for the demo
  console.log("Calling modal dialog.");
  console.log(request.query.reservationSid);
  console.log(request.query.taskSid);
  console.log(request.query.channel);

  response.render('pages/zendeskmodal', {
    taskSid: request.query.taskSid,
    reservationSid: request.query.reservationSid,
    channel: request.query.channel
  });
});

app.get('/token', function(request, response) {
  response.send({ token: taskrouterHelper.getTaskRouterWorkerCapabilityToken(accountSid, authToken, workspaceSid, workerSid) });
});

app.get('/workspacetoken', function(request, response) {
  response.send({
      workspacetoken: taskrouterHelper.getTaskRouterWorkspaceCapabilityToken(accountSid, authToken, workspaceSid, workerSid),
      token: taskrouterHelper.getTaskRouterWorkerCapabilityToken(accountSid, authToken, workspaceSid, workerSid)
  });
});

app.get('/clienttoken',function(request, response) {
  const identity = "al";
  response.send({ token: twilioClientHelper.getClientCapabilityToken(accountSid, authToken, identity) });
});

app.get('/visualize', function(request, response) {
  //visualize shows a visual representation of TaskRouter state
  response.setHeader('Cache-Control', 'no-cache');
  response.render('pages/visualize');
});

app.post('/voicenoivr', function(request,response){
  var textToSpeak = querystring.escape("Please hold while we connect you");
  var responseString="<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response><Play>https://twiliozendeskcc.herokuapp.com/play/Joanna/"+textToSpeak+"</Play><Enqueue workflowSid="+workflowSid+"><Task>{\"type\":\"voice\"}</Task></Enqueue></Response>";
    response.send(responseString);
});

app.post('/initiateivr', function(request,response){
  var textToSpeak = querystring.escape("Hello and welcome to the best customer experience youve ever had. Thats right. British Customer Service. Please tell us how we can help.");
  var didNotHear = querystring.escape("Did you say anything?"); 
  console.log(textToSpeak);
  var responseString="<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response><Gather input=\"speech\" timeout=\"2\" action=\"/finalresult\" partialResultsCallback=\"/partialresult\" hints=\"voice, sms, twilio, hate, love, awesome, help, british, marmite, suck, terrible, awful, assistance, exports\"><Play>https://twiliozendeskcc.herokuapp.com/play/Joanna/"+textToSpeak+"</Play><Pause length=\"10\"/></Gather><Play>https://twiliozendeskcc.herokuapp.com/play/Joanna/"+didNotHear+"</Play><Redirect method=\"POST\">/initiateivr</Redirect></Response>";
  console.log(responseString);
  response.send(responseString);
});

app.post('/finalresult', function(request,res){
  console.log("final result:");
  //console.log(request.body);
  //  console.log("=====");
  console.log(request.body['SpeechResult']);
  var result = querystring.stringify({q: request.body['SpeechResult']});

  var headers = {
    'Authorization': 'Bearer UQZMKIWYDG675WZJXOFHWZXGIMDSXHDH'
  };

  var options = {
    url: 'https://api.wit.ai/message?v=20170430&'+result,
    headers: headers
  };

  req(options, function(error, response, body) {
    console.log(body);
    try {
      //Works if Wit extracted an intent. 
      console.log(JSON.parse(body)['entities']['intent'][0]['value']);
      var textToSpeak = querystring.escape("OK. Got it. Please stand by while I connect you to the best possible agent.");

      switch (JSON.parse(body)['entities']['intent'][0]['value']) {
        case "happy":
          textToSpeak = querystring.escape("Great. Glad to hear things are going well. We will go ahead and send you a t-shirt to say thank you. Hold on the line for a second if there is anything else we can do.");
          break;
        case "needs_help":
          textToSpeak = querystring.escape("OK - let me get a support representative who can help you immediately.")
          break;
        case "problem":
          textToSpeak = querystring.escape("Hmmm. Sounds like a problem. We can help you with that - one moment. I will escalate your case to a technician.");
          break;
        case "angry":
          textToSpeak = querystring.escape("Oh no. We hate to hear you upset. Let me connect you directly with someone who has authority to make changes to your account")
          break;
        case "silly":
          textToSpeak = querystring.escape("Robots have feelings too you know. That just seems silly. Let me connect you with a human.");
          break;
        case "service_question":
          textToSpeak = querystring.escape("Good question. We have a good answer. Stand by.")
          break;
        default:
          console.log("Could not match " + JSON.parse(body)['entities']['intent'][0]['value'] + " to any switch statement")
      }

      var responseString="<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response><Play>https://twiliozendeskcc.herokuapp.com/play/Joanna/"+textToSpeak+"</Play><Enqueue workflowSid="+workflowSid+"><Task>{\"bot_intent\":\""+JSON.parse(body)['entities']['intent'][0]['value']+"\", \"type\":\"voice\", \"asrtext\":\""+request.body['SpeechResult']+"\"}</Task></Enqueue></Response>";
      res.send(responseString);
    } catch (err) {
      // Failed to extract an intent. Ask the fool again.
      var textToSpeak = querystring.escape("Say what now? Please tell us how we can help, you");
      var responseString="<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response><Gather input=\"speech\" action=\"/finalresult\" partialResultsCallback=\"/partialresult\" hints=\"voice, sms, twilio\"><Play>https://twiliozendeskcc.herokuapp.com/play/Joanna/"+textToSpeak+"</Play></Gather></Response>";
      res.send(responseString);
    }
  });
});

app.post('/partialresult', function(request,response){
  console.log("partial result:");
  //console.log(request.body);
  //console.log("=====");
  console.log(request.body['IncrementalSpeechResult']);
  var result = querystring.stringify({q: request.body['IncrementalSpeechResult']});

  var headers = {
    'Authorization': 'Bearer UQZMKIWYDG675WZJXOFHWZXGIMDSXHDH'
  };

  var options = {
    url: 'https://api.wit.ai/message?v=20170430&'+result,
    headers: headers
  };

  req(options, function(error, response, body){
    console.log(body);
    try {
      console.log(JSON.parse(body)['entities']['intent'][0]['value']);
    } catch (err) {}
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

  console.log("checking for any existing task from this user");

  var queryJson = {};
  var friendlyName_first = "";
  var friendlyName_last = "";
  var address_street = "";
  var address_city = "";
  queryJson['EvaluateTaskAttributes'] = "(message_from=\"" + request.body['From'] + "\")";
  var queryString = "{'EvaluateTaskAttributes':'(message_from=\"" + request.body['From'] + "\")'}";

  var foundTask = 0;
  var taskConversationSid = "";
  //note the following call is async
  //Here I am looking up for a current task from this user. I could alternatively cookie the request, but that is time limited.

  twilioClient.taskrouter.workspaces(workspaceSid).tasks.list(queryJson, function(err, data) {
    if (!err) {
      data.tasks.forEach(function(task) {
        myFirebase.child("messageList").child(task.sid).push({
          'from': request.body['From'],
          'message': request.body['Body'],
          'first': friendlyName_first,
          'last': friendlyName_last
        });

        if (task.assignmentStatus == "pending" || task.assignmentStatus == "reserved" || task.assignmentStatus == "assigned") {
          foundTask = 1;
          console.log("found an existing task from that user which is still active. Trying to list attributes");
          console.log(task.attributes);
          taskConversationSid = task.sid;
          console.log("will use this existing task sid for this conversation " + taskConversationSid);
          updateConversationPost(taskConversationSid, request, friendlyName_first, friendlyName_last);
        }
      });

      if (!foundTask) {
        console.log("did not find an existing active task for this messenger");

        var attributesJson = {};
        attributesJson['message_from'] = request.body['From'];
        attributesJson['from'] = request.body['From'];
        attributesJson['message_body'] = request.body['Body'];
        attributesJson['message_to'] = request.body['To'];
        attributesJson['message_sid'] = request.body['MessageSid'];
        // hard coding in a specific number that skips bot qualification when messaged
        if (request.body['To'] == twilioPhoneNumberSkipBot) {
          attributesJson['bot_qualified'] = "true";

        }

        console.log("want to create a new task with these attributes");
        console.log(attributesJson);
        var attributesString = JSON.stringify(attributesJson);

        var options = {
          method: 'POST',
          url: 'https://taskrouter.twilio.com/v1/Workspaces/' + workspaceSid + '/Tasks',
          auth: {
            username: accountSid,
            password: authToken
          },
          form: {
            WorkflowSid: workflowSid,
            Attributes: attributesString,
            TaskChannel: 'chat'
          }
        };

        req(options, function(error, response, body) {
          if (error) {
            throw new Error(error);
          }
          //console.log(body);
          var newTaskResponse = JSON.parse(body);
          console.log("created a new tasks with Sid " + newTaskResponse.sid);
          myFirebase.child("messageList").child(newTaskResponse.sid).push({
            'from': request.body['From'],
            'message': request.body['Body'],
            'first': friendlyName_first,
            'last': friendlyName_last
          });

          var id = request.body['From'];
          if (id.substr(0, 10) == "messenger:") {
            id = id.replace('messenger:', '');
            getFacebookDetails(id, newTaskResponse.sid);
          } else {
            try {
              console.log(request.body.AddOns);
              var addOnsData = JSON.parse(request.body.AddOns);
              console.log(addOnsData['results']);

              friendlyName_first = addOnsData['results']['nextcaller_advanced_caller_id']['result']['records'][0]['first_name'];
              friendlyName_last = addOnsData['results']['nextcaller_advanced_caller_id']['result']['records'][0]['last_name'];
              address_street = addOnsData['results']['nextcaller_advanced_caller_id']['result']['records'][0]['address'][0]['line1'];
              address_city = x;
            } catch (err) {

            }

            myFirebase.child("profiles").child(newTaskResponse.sid).set({
              'first_name': friendlyName_first,
              'last_name': friendlyName_last,
              'address_street': address_street,
              'address_city': address_city,
              'message_type': 'sms',
              'profile_pic': 'img/unknownavatar.jpeg'
            });
          }

          updateConversationPost(newTaskResponse.sid, request, friendlyName_first, friendlyName_last);
        });
      }
    }
  });
  response.send('');
});

function getFacebookDetails(id, sid) {
  var results = {};
  var options = {
    method: 'GET',
    url: 'https://graph.facebook.com/v2.6/' + id + '?fields=first_name,last_name,profile_pic&access_token=' + pageAccessToken,
  };
  var friendlyName_first = "";
  var friendlyName_last = "";

  req(options, function(error, response, body) {
    if (error) {
      throw new Error(error);
    }

    var bodyJSON = JSON.parse(body);
    results['first_name'] = bodyJSON['first_name'];
    results['last_name'] = bodyJSON['last_name'];
    results['full_name'] = bodyJSON['first_name'] + " " + bodyJSON['last_name'];
    results['profile_pic'] = bodyJSON['profile_pic'];
    results['message_type'] = "facebook";
    console.log("response data is " + JSON.stringify(results));
    myFirebase.child("profiles").child(sid).set({
      'first_name': results['first_name'],
      'last_name': results['last_name'],
      'full_name': results['full_name'],
      'profile_pic': results['profile_pic'],
      'message_type': results['message_type']
    });
  });
}


function updateConversationPost(taskSid, request, friendlyName_first, friendlyName_last) {
  myFirebase.child(taskSid).push({
    'from': request.body['From'],
    'message': request.body['Body'],
    'first': friendlyName_first,
    'last': friendlyName_last
  });

  var meyaUserID = {};
  //We munge multiple parameters together to pass all the context to Meya. I had to shorten the Messenger prefix to stay within character count limits.
  meyaUserID['from'] = request.body['From'].replace("messenger:", "M@");
  meyaUserID['to'] = request.body['To'].replace("messenger:", "M@");
  meyaUserID['sid'] = taskSid;
  meyaUserID_string = meyaUserID['from'] + "@@" + meyaUserID['to'] + "@@" + taskSid;
  console.log("going to use this as meya user ID " + meyaUserID_string);

  twilioClient.workspaces(workspaceSid).tasks(taskSid).fetch(function(err, task) {
    attr = JSON.parse(task.attributes);
    console.log(attr['bot_qualified']);

    if (!attr.hasOwnProperty('bot_qualified')) {
      console.log("this task is not yet bot qualified");
      console.log("posting to meya with user id " + meyaUserID_string + " and text " + request.body['Body']);

      req.post('https://meya.ai/webhook/receive/BCvshMlsyFf').auth(meyaAPIKey).form({
        user_id: meyaUserID_string,
        text: request.body['Body']
      }).on('response', function(response) {
        console.log("got response from meya " + response);
      });
    } else {
      console.log("this task is already bot qualified");
    }
  });
}

function updateTaskAttributes(taskSid, attributesJson) {
  var attributes = {};

  twilioClient.workspaces(workspaceSid).tasks(taskSid).fetch(function(err, task) {
    attributes = JSON.parse(task.attributes);
    for (var key in attributesJson) {
      attributes[key] = attributesJson[key];
    }

    twilioClient.workspaces(workspaceSid).tasks(taskSid).update({
      attributes: JSON.stringify(attributes)
    }, function(err, task) {
      if (err) {
        console.log("error");
        console.log(err);
      } else {

      }
    });
  });
}

app.get('/deletealltasks', function(request, response) {
  //this page purges all TaskRouter and Firebase content in order to reset the demo

  twilioClient.workspaces(workspaceSid).tasks.list(function(err, tasks) {
    if (!err) {
      console.log(tasks);

      tasks.forEach(function(task) {
        twilioClient.workspaces(workspaceSid).tasks(task.sid).remove();
        console.log('deleted task ' + task.sid);
        //task.delete();
      });
    }
  });

  myFirebase.remove();
  response.send('all tasks deleted');
  //client.workspace.tasks.delete()
});

app.get('/completeTask', function(request, response) {
  console.log("received request to complete task ");
  console.log(request.query.sid);

  //POST /v1/Workspaces/{WorkspaceSid}/Tasks/{TaskSid}
  var options = {
    method: 'POST',
    url: 'https://taskrouter.twilio.com/v1/Workspaces/' + workspaceSid + '/Tasks/' + request.query.sid,
    auth: {
      username: accountSid,
      password: authToken
    },
    form: {
      AssignmentStatus: 'completed'
    }
  };
  console.log(options);

  req(options, function(error, response, body) {
    if (error) {
      throw new Error(error);
    }
    //console.log(body);
    console.log("task moved to completed state " + body);
  });

  myFirebase.child(request.query.sid).remove();
  response.send('');
});

app.get('/acceptTask', function(request, response) {
  console.log("received request to accept task ");
  console.log(request.query.tasksid);
  console.log(request.query.reservationsid);
  console.log(request.query.channel);

  //wrap this whole thing in a try in case we're dealing with a revoked reservation

  try {
    if (request.query.channel == "voice") {
      twilioClient.workspaces(workspaceSid).tasks(request.query.tasksid).reservations(request.query.reservationsid).update({
        instruction: 'conference',
        dequeueFrom: twilioPhoneNumber
      }, function(err, reservation) {
        console.log(reservation.reservation_status);
        console.log(reservation.worker_name);
      });
    }

    if (request.query.channel == "chat") {
      twilioClient.workspaces(workspaceSid).tasks(request.query.tasksid).reservations(request.query.reservationsid).update({
        reservationStatus: 'accepted'
      }, function(err, reservation) {
        console.log(reservation.reservation_status);
        console.log(reservation.worker_name);
      });
    }
  } catch (err) {
    console.log("accept task failed. maybe an old reservation?");
  }
  response.send('');
});

app.get('/getTaskDetails', function(request, response) {
  console.log("received request to get task details");
  console.log(request.query.tasksid);

  twilioClient.workspaces(workspaceSid).tasks(request.query.tasksid).fetch(function(err, task) {
    console.log(task.attributes);
    response.send(task);
  });
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
  console.log("trying to get the details for this task with sid " + request.body.user_id);
  //var meyaUserID = JSON.parse(request.body.user_id);
  //console.log("received message from bot originally from" + meyaUserID['from'])
  var meyaUserID = request.body.user_id.split("@@");
  var smsclienttouse = smsclient;
  //Temporary hack to send facebook messages from a different account
  if (meyaUserID[0].includes("M@")) {
    smsclienttouse = secondTwilioClient;
  }

  smsclienttouse.messages.create({
    to: meyaUserID[0].replace("M@", "messenger:"), // Any number Twilio can deliver to
    from: meyaUserID[1].replace("M@", "messenger:"), // A number you bought from Twilio and can use for outbound communication
    body: request.body.text, // body of the SMS message
    statusCallback: 'https://twiliozendeskcc.herokuapp.com/messagestatus/'


    /*client.workspace.tasks(request.body.user_id).get(function(err, task) {
   // var attrib=JSON.parse(task.attributes);
  
       smsclient.sendMessage({

    to:attrib.message_from, // Any number Twilio can deliver to
    from: attrib.message_to, // A number you bought from Twilio and can use for outbound communication
    body: request.body.text // body of the SMS message
*/
  }, function(err, responseData) { //this function is executed when a response is received from Twilio

    if (!err) { // "err" is an error received during the request, if any

      // "responseData" is a JavaScript object containing data received from Twilio.
      // A sample response from sending an SMS message is here (click "JSON" to see how the data appears in JavaScript):
      // http://www.twilio.com/docs/api/rest/sending-sms#example-1

      console.log(responseData.from); // outputs "+14506667788"
      console.log(responseData.body); // outputs "word to your mother."
    } else {
      console.log("there was an error");
    }

    console.log("trying to update old message list");

    myFirebase.child(meyaUserID[2]).push({
      'from': 'MeyaBot',
      'message': request.body.text
    });

    console.log("now trying to update new message list")
    myFirebase.child("messageList").child(meyaUserID[2]).push({
      'from': 'MeyaBot',
      'message': request.body.text
    });

    //});
  });
  //Send the response

  console.log(request.body);
  console.log(request.body.user_id);
  console.log(request.body.text);
  response.send('');
});

app.post('/eventstream', function(request, response) {
  // This function consumes the event stream and structures it into firebase data
  // The eventstream firebase structure is then used for real time visualization of queue state
  // The taskList firebase structure is then used for the agent UI rendering using vue.js

  var eventstream = myFirebase.child("eventstream");
  var taskList = myFirebase.child("taskList");

  try {
    console.log("received event " + request.body.EventType);
  } catch (err) {

  }
  console.log(request.body);

  if (request.body.TaskSid) {
    dataToSet = {};

    switch (request.body.EventType) {
      case "task.deleted":
        eventstream.child(request.body.TaskQueueSid).child(request.body.TaskSid).remove();
        //taskList.child(request.body.)
        break;
      case "task-queue.entered":
        dataToSet['attributes'] = request.body.TaskAttributes;
        dataToSet['sid'] = request.body.TaskSid;
        dataToSet['status'] = request.body.TaskAssignmentStatus;
        dataToSet['channel'] = request.body.TaskChannelUniqueName;
        dataToSet['queue'] = request.body.TaskQueueName;
        taskList.child("queue").child(request.body.TaskSid).update(dataToSet)
        eventstream.child(request.body.TaskQueueSid).child(request.body.TaskSid).setWithPriority(dataToSet, request.body.TaskAge)
        break;
      case "task-queue.timeout":
        eventstream.child(request.body.TaskQueueSid).child(request.body.TaskSid).remove();
        break;
      case "task-queue.moved":
        eventstream.child(request.body.TaskQueueSid).child(request.body.TaskSid).remove();
        break;
      case "task.canceled":
        //todo need to update this to support tasks currently reserved too
        taskList.child("queue").child(request.body.TaskSid).remove();
        break;
      case "task.completed":
        dataToSet['attributes'] = request.body.TaskAttributes;
        dataToSet['sid'] = request.body.TaskSid;
        dataToSet['status'] = request.body.TaskAssignmentStatus;
        eventstream.child(request.body.TaskQueueSid).child(request.body.TaskSid).setWithPriority(dataToSet, request.body.TaskAge)
        //TODO
        taskAttributes = JSON.parse(request.body.TaskAttributes);
        taskList.child(taskAttributes['worker']).child(request.body.TaskSid).remove();
        // taskList.child(request.body.TaskQueueSid).child(request.body.TaskSid).setWithPriority(dataToSet, request.body.TaskAge)
        break;
      case "task.updated":
        dataToSet['attributes'] = request.body.TaskAttributes;
        dataToSet['sid'] = request.body.TaskSid;
        dataToSet['status'] = request.body.TaskAssignmentStatus;
        //eventstream.child(request.body.TaskQueueSid).child(request.body.TaskSid).setWithPriority(dataToSet, request.body.TaskAge)
        if (request.body.TaskAssignmentStatus == "pending") {
          taskList.child("queue").child(request.body.TaskSid).once("value", function(snapshot) {
            console.log("received task updated  event for pending task. firebase before changing anything is");
            console.log(JSON.stringify(snapshot.val()));
            taskList.child("queue").child(request.body.TaskSid).update(dataToSet);
          });
        } else {
          // the task updated event does not include the worker sid, which is the key in the taskList data structure
          // so we first get it out of the task attributes, where we have saved it
          twilioClient.workspaces(workspaceSid).tasks(request.body.TaskSid).fetch(function(err, task) {
            attributes = JSON.parse(task.attributes);
            taskList.child("queue").child(request.body.TaskSid).once("value", function(snapshot) {
              console.log("received task updated  event for non-pending task. firebase before changing anything is");
              console.log(JSON.stringify(snapshot.val()));
              taskList.child(attributes["worker"]).child(request.body.TaskSid).update(dataToSet);
            });
          });
        }
        break;
      case "reservation.created":
        dataToSet['status'] = request.body.TaskAssignmentStatus;
        dataToSet['reservationSid'] = request.body.ReservationSid;
        dataToSet['attributes'] = request.body.TaskAttributes;
        dataToSet['sid'] = request.body.TaskSid;

        if (request.body.TaskChannelUniqueName) {
          dataToSet['channel'] = request.body.TaskChannelUniqueName;
        } else if (request.body.TaskChannelSid == voiceTaskChannelSid) {
          dataToSet['channel'] = "voice";
        } else if (request.body.TaskChannelSid == chatTaskChannelSid) {
          dataToSet['channel'] = "chat";
        }

        dataToSet['queue'] = request.body.TaskQueueName;
        taskList.child(request.body.WorkerSid).child(request.body.TaskSid).setWithPriority(dataToSet, request.body.TaskAge);
        taskList.child("queue").child(request.body.TaskSid).remove();
        var newAttributes = {'worker' : request.body.WorkerSid};
        updateTaskAttributes(request.body.TaskSid, newAttributes);
        var addons = JSON.parse(request.body.TaskAddons);

        dataToSet={};
        try {
          dataToSet['name']=addons.nextcaller_advanced_caller_id.records[0].name;
          dataToSet['address']=addons.nextcaller_advanced_caller_id.records[0].address[0].line1 + " " + addons.nextcaller_advanced_caller_id.records[0].address[0].city + " " + addons.nextcaller_advanced_caller_id.records[0].address[0].zip_code;
        } catch (err) {
          attributes=JSON.parse(task.attributes);
          dataToSet['name']=attributes.from;
        }

        dataToSet['profile_pic']="img/unknownavatar.jpeg"
        taskList.child(request.body.WorkerSid).child(request.body.TaskSid).update(dataToSet);
        break;
      case "reservation.timeout":
      case "reservation.canceled":
        taskList.child(request.body.WorkerSid).child(request.body.TaskSid).once("value", function(snapshot) {
          taskList.child("queue").child(request.body.TaskSid).setWithPriority(snapshot.val(), request.body.TaskAge);
        });
        taskList.child(request.body.WorkerSid).child(request.body.TaskSid).remove();
        break;
      case "reservation.accepted":
        dataToSet['status'] = request.body.TaskAssignmentStatus;
        dataToSet['accepted'] = "true";
        taskList.child(request.body.WorkerSid).child(request.body.TaskSid).update(dataToSet);
        var newAttributes = {'worker':request.body.WorkerSid};
        updateTaskAttributes(request.body.TaskSid, newAttributes);
        break;
      case "task.wrapup":
        dataToSet['status'] = request.body.TaskAssignmentStatus;
        twilioClient.workspaces(workspaceSid).tasks(request.body.TaskSid).fetch(function(err, task) {
          attributes = JSON.parse(task.attributes);
          taskList.child(attributes["worker"]).child(request.body.TaskSid).update(dataToSet);
        });
        break;
    }
    //eventstream.child(request.body.TaskSid).push({'update':request.body});
  }
  response.send('');
});

app.post('/messagestatus', function(request, response) {
  // This function consumes the event stream and structures it into firebase data
  // This firebase structure is then used for real time visualization of queue state
  console.log("received message status " + JSON.stringify(request.body));
  response.send('');
});

app.get('/updateCapacity', function(request, response) {
  // This function uses the TaskRouter multi-tasking API to change concurrent task capacity
  // This function was written before multi-tasking was available throught the Node helper lib
  console.log("received request to update capacity ");
  console.log(request.query);
  console.log(request.query.capacity);

  //https://taskrouter.twilio.com/v1/Workspaces/WorkspaceSid/Workers/WorkerSid/Channels/default -d Capacity=2 -u AccountSid:AuthToken
  var options = {
    method: 'POST',
    url: 'https://taskrouter.twilio.com/v1/Workspaces/' + workspaceSid + '/Workers/' + request.query.workerSid + '/Channels/default',
    auth: {
      username: accountSid,
      password: authToken
    },
    form: {
      Capacity: request.query.capacity
    }
  };
  console.log(options);

  req(options, function(error, response, body) {
    if (error) {
      throw new Error(error);
    }
    //console.log(body);
    var capacityResponse = JSON.parse(body);
    console.log("updated capacity. Returned " + body);
    var tempOptions = {
      method: 'POST',
      url: 'https://taskrouter.twilio.com/v1/Workspaces/' + workspaceSid + '/Workflows/' + workflowSid,
      auth: {
        username: accountSid,
        password: authToken
      },
      form: {
        ReEvaluateTasks: true
      }
    };

    req(tempOptions, function(error, response, body) {
      if (error) {
        throw new Error(error);
      }
      // Manually force 
      // reevaluate tasks after update to trigger immediate push
      // POST /v1/Workspaces/{WorkspaceSid}/Workflows/{WorkflowSid}

    });
  });
  response.send('');
});

app.get('/sendsms', function(request, response) {
  console.log(request.query);
  console.log(request.query.to);
  console.log(request.query.from);
  console.log(request.query.body);

  twilioClient.messages.create({
    to: request.query.to, // Any number Twilio can deliver to
    from: request.query.from, // A number you bought from Twilio and can use for outbound communication
    body: request.query.body // body of the SMS message
  }, function(err, responseData) { //this function is executed when a response is received from Twilio

    if (!err) { // "err" is an error received during the request, if any

      // "responseData" is a JavaScript object containing data received from Twilio.
      // A sample response from sending an SMS message is here (click "JSON" to see how the data appears in JavaScript):
      // http://www.twilio.com/docs/api/rest/sending-sms#example-1

      console.log(responseData.from); // outputs "+14506667788"
      console.log(responseData.body); // outputs "word to your mother."

    } else {
      console.log("there was an error");
    }
  });

  myFirebase.child(request.query.sid).push({ 'from' : 'me', 'message' : request.query.body });
  myFirebase.child("messageList").child(request.query.sid).push({
    'from': 'me',
    'message': request.query.body
  });
  response.send('');
});

app.post('/voice', function (request, response) {

  const twiml = new VoiceResponse();

  if(request.toNumber) {
    // Wrap the phone number or client name in the appropriate TwiML verb
    // if is a valid phone number
    const attr = isAValidPhoneNumber(request.toNumber) ? 'number' : 'client';

    twiml.dial({
      [attr]: toNumber,
      callerId: alsPhoneNumber,
    });
  } else {
    twiml.say('Thanks for calling!');
  }

  response.send(twiml.toString());
});

/**
* Checks if the given value is valid as phone number
* @param {Number|String} number
* @return {Boolean}
*/
function isAValidPhoneNumber(number) {
  return /^[\d\+\-\(\) ]+$/.test(number);
}


app.get('/play/:voiceId/:textToConvert', function (req, res) {
  var pollyCallback = function (err, data) {
  if (err) { // error occurred
    console.log(err, err.stack);
  } else {
    console.log(data);
  } // successful response

  // Generate a unique name for this audio file, the file name is: PollyVoiceTimeStamp.mp3
  var filename = req.params.voiceId + (new Date).getTime() + ".mp3";
  fs.writeFile('/tmp/'+filename, data.AudioStream, function (err) {
    if (err) {
      console.log('An error occurred while writing the file.');
      console.log(err);
    }
    console.log('Finished writing the file to the filesystem ' + '/tmp/'+filename)

    // Send the audio file
    res.setHeader('content-type', 'audio/mpeg');
    res.download('/tmp/'+filename);
  });
};

var pollyParameters = {
  OutputFormat: 'mp3',
  Text: unescape(req.params.textToConvert),
  VoiceId: req.params.voiceId
};

// Make a request to AWS Polly with the text and voice needed, when the request is completed push callback to pollyCallback
polly.synthesizeSpeech(pollyParameters, pollyCallback);
});

app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});


