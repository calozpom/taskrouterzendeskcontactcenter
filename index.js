var req = require('request');
var express = require('express');
var bodyParser = require('body-parser');
var twilio = require('twilio');
var FirebaseTokenGenerator = require('firebase-token-generator');
var Firebase = require('firebase');


var accountSid = process.env.accountSid;
var authToken = process.env.authToken;
var workspaceSid = process.env.workspaceSid;
var workerSid = process.env.workerSid;
var meyaAPIKey = process.env.meyaAPIKey;
var pageAccessToken = process.env.pageAccessToken; //facebook
var firebaseSecret = process.env.firebaseSecret;
console.log("trying to authenticate to firebase with secret " + firebaseSecret);

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
//firebase expires parameter is seconds since epoch
var firebaseToken = firebaseTokenGenerator.createToken({ uid: "secure-server"}, { expires: 4121017284});
console.log(firebaseToken);
var myFirebase = new Firebase("https://taskrouter.firebaseio.com/");
myFirebase.authWithCustomToken(firebaseToken, function(error, authData) {
  console.log("firebase auth status:");
  console.log(error);
  console.log(authData);
});


var capability = new twilio.TaskRouterWorkerCapability(accountSid, authToken, workspaceSid, workerSid);
var workspacecapability = new twilio.TaskRouterWorkspaceCapability(accountSid, authToken, workspaceSid);
workspacecapability.allowFetchSubresources();
workspacecapability.allowUpdatesSubresources();
workspacecapability.allowDeleteSubresources();

var client = new twilio.TaskRouterClient(accountSid, authToken, workspaceSid);
var smsclient = new twilio.RestClient(accountSid, authToken);

capability.allowActivityUpdates();
capability.allowReservationUpdates();
var workspacetoken = workspacecapability.generate();

// By default, tokens are good for one hour.
// Override this default timeout by specifiying a new value (in seconds).
// For example, to generate a token good for 8 hours:

//probably ought to implement some sort of token refresh function
var token = capability.generate(); // 60 * 60 * 8
var app = express();

function epicRandomString(b) {
  for (var a = (Math.random() * eval("1e" + ~~(50 * Math.random() + 50))).toString(36).split(""), c = 3; c < a.length; c++) c == ~~(Math.random() * c) + 1 && a[c].match(/[a-z]/) && (a[c] = a[c].toUpperCase());
  a = a.join("");
  a = a.substr(~~(Math.random() * ~~(a.length / 3)), ~~(Math.random() * (a.length - ~~(a.length / 3 * 2) + 1)) + ~~(a.length / 3 * 2));
  if (24 > b) return b ? a.substr(a, b) : a;
  a = a.substr(a, b);
  if (a.length == b) return a;
  for (; a.length < b;) a += epicRandomString();
  return a.substr(0, b)
};

function askFollowUp(user) {
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
  response.render('pages/dashboard', {
    'token': token
  });
});

app.get('/visualize', function(request, response) {
  //visualize shows a visual representation of TaskRouter state
  response.setHeader('Cache-Control', 'no-cache');
  response.render('pages/visualize', {
    'token': workspacetoken
  });
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
  client.workspace.tasks.get(queryJson, function(err, data) {
    if (!err) {
      data.tasks.forEach(function(task) {
        if (task.assignmentStatus == "pending" ||
          task.assignmentStatus == "reserved" ||
          task.assignmentStatus == "assigned") {
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
        attributesJson['message_body'] = request.body['Body'];
        attributesJson['message_to'] = request.body['To'];
        attributesJson['message_sid'] = request.body['MessageSid'];
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
            WorkflowSid: 'WW4d526c9041d73060ca46d4011cf34b33',
            Attributes: attributesString
          }
        };

        req(options, function(error, response, body) {
          if (error) throw new Error(error);
          //console.log(body);
          var newTaskResponse = JSON.parse(body);
          console.log("created a new tasks with Sid " + newTaskResponse.sid);
          var id = request.body['From'];
          if (id.substr(0, 10) == "Messenger:") {
            id = id.replace('Messenger:', '');
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



            } catch (err) {}
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
    if (error) throw new Error(error);
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
  //TODO: need to add an if statement here and only post to meya if bot_qualified is not true
  var meyaUserID = {};

  meyaUserID['from'] = request.body['From'].replace("Messenger:", "M@");
  meyaUserID['to'] = request.body['To'].replace("Messenger:", "M@");
  meyaUserID['sid'] = taskSid;
  meyaUserID_string = meyaUserID['from'] + "@@" + meyaUserID['to'] + "@@" + taskSid;
  console.log("going to use this as meya user ID " + meyaUserID_string);
  client.workspace.tasks(taskSid).get(function(err, task) {
    attr = JSON.parse(task.attributes);
    console.log(attr['bot_qualified']);
    if (!attr.hasOwnProperty('bot_qualified')) {
      console.log("this task is not yet bot qualified");
      console.log("posting to meya with user id " + meyaUserID_string + " and text " + request.body['Body']);
      req
        .post('https://meya.ai/webhook/receive/BCvshMlsyFf').auth(meyaAPIKey).form({
          user_id: meyaUserID_string,
          text: request.body['Body']
        })
        .on('response', function(response) {
          console.log("got response from meya " + response);

        })

    } else {
      console.log("this task is already bot qualified");
    }
  });
}

app.get('/deletealltasks', function(request, response) {
  //this page purges all TaskRouter and Firebase content in order to reset the demo
  client.workspace.tasks.list(function(err, data) {
    if (!err) {
      console.log(data);
      data.tasks.forEach(function(task) {
        client.workspace.tasks(task.sid).delete();
        console.log('deleted task ' + task.sid);
        //task.delete();
      })
    }
  })
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
    if (error) throw new Error(error);
    //console.log(body);
    console.log("task moved to completed state " + body);

  });
  myFirebase.child(request.query.sid).remove();
  response.send('');
});

app.get('/acceptTask', function(request, response) {
  console.log("received request to accept task ");
  console.log(request.query.tasksid);
  console.log(request.query.reservationsid)

  //POST /v1/Workspaces/{WorkspaceSid}/Tasks/{TaskSid}/Reservations/{ReservationSid}
  var options = {
    method: 'POST',
    url: 'https://taskrouter.twilio.com/v1/Workspaces/' + workspaceSid + '/Tasks/' + request.query.tasksid + '/Reservations/' + request.query.reservationsid,
    auth: {
      username: accountSid,
      password: authToken
    },
    form: {
      ReservationStatus: 'accepted'
    }
  };
  console.log(options);

  req(options, function(error, response, body) {
    if (error) throw new Error(error);
    //console.log(body);
    console.log("accepted task" + body);

  });
  response.send('');
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

  smsclient.sendMessage({

    to: meyaUserID[0].replace("M@", "Messenger:"), // Any number Twilio can deliver to
    from: meyaUserID[1].replace("M@", "Messenger:"), // A number you bought from Twilio and can use for outbound communication
    body: request.body.text // body of the SMS message

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
    myFirebase.child(meyaUserID[2]).push({
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
  // This firebase structure is then used for real time visualization of queue state
  var eventstream = myFirebase.child("eventstream");
  console.log("received event " + request.body.EventType);
  //console.log(request.body); 
  if (request.body.TaskSid) {
    dataToSet = {};
    switch (request.body.EventType) {
      case "task.deleted":
        eventstream.child(request.body.TaskQueueSid).child(request.body.TaskSid).remove();
        break;
      case "task-queue.entered":
        dataToSet['attributes'] = request.body.TaskAttributes;
        dataToSet['sid'] = request.body.TaskSid;
        dataToSet['status'] = request.body.TaskAssignmentStatus;
        eventstream.child(request.body.TaskQueueSid).child(request.body.TaskSid).setWithPriority(dataToSet, request.body.TaskAge)
        break;
      case "task-queue.timeout":
        eventstream.child(request.body.TaskQueueSid).child(request.body.TaskSid).remove();

        break;
      case "task-queue.moved":
        eventstream.child(request.body.TaskQueueSid).child(request.body.TaskSid).remove();
        break;
      case "task.canceled":
        break;
      case "task.completed":
        dataToSet['attributes'] = request.body.TaskAttributes;
        dataToSet['sid'] = request.body.TaskSid;
        dataToSet['status'] = request.body.TaskAssignmentStatus;
        eventstream.child(request.body.TaskQueueSid).child(request.body.TaskSid).setWithPriority(dataToSet, request.body.TaskAge)
        break;
      case "task.updated":
        dataToSet['attributes'] = request.body.TaskAttributes;
        dataToSet['sid'] = request.body.TaskSid;
        dataToSet['status'] = request.body.TaskAssignmentStatus;
        //eventstream.child(request.body.TaskQueueSid).child(request.body.TaskSid).setWithPriority(dataToSet, request.body.TaskAge)
        break;


    }
    //eventstream.child(request.body.TaskSid).push({'update':request.body});
  }
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
    if (error) throw new Error(error);
    //console.log(body);
    var capacityResponse = JSON.parse(body);
    console.log("updated capacity. Returned " + body);
    var tempOptions = {
      method: 'POST',
      url: 'https://taskrouter.twilio.com/v1/Workspaces/' + workspaceSid + '/Workflows/WW4d526c9041d73060ca46d4011cf34b33',
      auth: {
        username: accountSid,
        password: authToken
      },
      form: {
        ReEvaluateTasks: true
      }
    };
    req(tempOptions, function(error, response, body) {
      if (error) throw new Error(error);

      //temporary hack
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
  smsclient.sendMessage({

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
  myFirebase.child(request.query.sid).push({'from':'me', 'message':request.query.body}    );
  response.send('');

});


app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});


