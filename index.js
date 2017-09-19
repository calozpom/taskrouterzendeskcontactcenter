require('dotenv').load();

var AWS = require('aws-sdk');
var bodyParser = require('body-parser');
var express = require('express');
var fs = require('fs')
var querystring = require("querystring");
var req = require('request');

var twilio = require('twilio');
var AccessManager = require('twilio-common').AccessManager;
var SyncClient = require('twilio-sync');    // remove this when you fix it to use the node helper lib, not the client side sdk
var twilioChatHelper = require('./public/js/twilioChatHelper');
var taskrouterTokenHelper = require('./jwt/taskrouter/tokenGenerator');
var twilioClientTokenHelper = require('./jwt/client/tokenGenerator');
var twilioSyncChatHelper = require('./jwt/sync/tokenGenerator');
var VoiceResponse = twilio.twiml.VoiceResponse;

// Twilio creds (for everything but Twilio Understand)
var accountSid = process.env.accountSid;
var authToken = process.env.authToken;

// For Twilio Understand usage only
//var understandAccountSid = process.env.understandAccountSid;
//var understandAuthToken = process.env.understandAuthToken;

var workspaceSid = process.env.workspaceSid;
var workflowSid = process.env.workflowSid;
var workerSid = process.env.workerSid;
var voiceTaskChannelSid = process.env.voiceTaskChannelSid;
var chatTaskChannelSid = process.env.chatTaskChannelSid;

var syncServiceInstance = process.env.syncServiceInstance;
var understandServiceInstance = process.env.understandServiceInstance;
var understandModelBuildSid = process.env.understandModelBuildSid;
var understandAccountSid = process.env.understandAccountSid;
var understandAuthToken = process.env.understandAuthToken;

var participantContactNumbers = [];

var twilioPhoneNumber = process.env.twilioPhoneNumber;
var twilioPhoneNumberSkipBot = process.env.twilioPhoneNumberSkipBot;
var alsPhoneNumber = process.env.alsPhoneNumber;

// Facebook  creds
var pageAccessToken = process.env.pageAccessToken; //facebook

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


// Twilio node helper lib setup
var twilioClient = new twilio(accountSid, authToken);
//var twilioClientForUnderstand = new twilio(understandAccountSid, understandAuthToken);
var syncService = twilioClient.sync.services(syncServiceInstance);

var identity = 'al';
var accessToken = twilioSyncChatHelper.getSyncAndChatToken(identity);
var syncClient = new SyncClient(accessToken);

var accessManager = new AccessManager(accessToken); // needed for uninterrupted access when using the syncClient server side
accessManager.on('tokenUpdated', am => {
    // get new token from AccessManager and pass it to the library instance
    syncClient.updateToken(am.token);
});

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
  response.render('pages/zendeskdashboard');
});

app.get('/zendeskdashboard', function(request, response) {
  // dashboard is the main page for the demo
  response.render('pages/zendeskdashboard');
});

app.get('/agentcontrols', function(request, response) {
  // dashboard is the main page for the demo
  response.render('pages/agentcontrols');
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
  const identity = 'al';
  const chatIdentity = 'Al Cook';   // realistically this should be the workerSid, request.query.workerSid
  response.send({ 
    taskRouterToken: taskrouterTokenHelper.getTaskRouterWorkerCapabilityToken(accountSid, authToken, workspaceSid, workerSid),
    syncToken: twilioSyncChatHelper.getSyncAndChatToken(identity), 
    clientToken: twilioClientTokenHelper.getClientCapabilityToken(accountSid, authToken, identity),
    chatToken: twilioSyncChatHelper.getSyncAndChatToken(chatIdentity)
  });
});

app.get('/workspaceToken', function(request, response) {
  response.send({
      workspaceToken: taskrouterTokenHelper.getTaskRouterWorkspaceCapabilityToken(accountSid, authToken, workspaceSid, workerSid),
      workerToken: taskrouterTokenHelper.getTaskRouterWorkerCapabilityToken(accountSid, authToken, workspaceSid, workerSid),
      syncToken: twilioSyncChatHelper.getSyncAndChatToken(identity)
  });
});

app.get('/visualize', function(request, response) {
  //visualize shows a visual representation of TaskRouter state
  response.setHeader('Cache-Control', 'no-cache');
  response.render('pages/visualize');
});

app.get('/sendMessageToAttendees', function(request, response) {
    var message = 'Thanks for coming to our presentation at SIGNAL London 2017!' +
        ' Visit https://www.twilio.com/docs/api/contact-center-blueprint to lean more about Contact Centers.' +
        ' And our github is available at https://github.com/calozpom/taskrouterzendeskcontactcenter' +
        ' Feel free to contact us at al@twilio.com and wli@twilio.com. And check out the Ytica demo booth! We\'d appreciate your feedback, forms are in the back of the room. See you at $bash!';

    // texters
    participantContactNumbers.forEach(audiencePhoneNumber => {
        // send SMS
        twilioClient.messages.create({
            to: audiencePhoneNumber, from: twilioPhoneNumber, // twilio phone number
            body: message
        }).then(message => {
            console.log('Successfully sent message to: ' + request.query.to);
        }).catch(err => {
            console.log('Failed to send message to: ' + request.query.to);
        });

        response.send('');
    });
});

app.post('/voicenoivr', function(request,response) {
  var textToSpeak = querystring.escape("Please hold while we connect you");
  var responseString="<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response><Play>https://twiliozendeskcc.herokuapp.com/play/Amy/"+textToSpeak+"</Play><Enqueue workflowSid="+workflowSid+"><Task>{\"type\":\"voice\"}</Task></Enqueue></Response>";
    response.send(responseString);
});

app.post('/initiateIVR', function(request, response) {
    //var welcomeMessage = querystring.escape("Hello and welcome to the best customer experience youve ever had. Thats right. British Customer Service. Please tell us how we can help.");
    var welcomeMessage = querystring.escape("Hello. I take it you have finally got fed up of American Chocolate. We are so glad you found the light. Please tell us how we can help.");
  
    var didNotHearMessage = querystring.escape("Did you say anything?");

    var voiceResponse = new VoiceResponse();
    var gather = voiceResponse.gather({
        input: 'speech',
        timeout: 2,
        action: '/finalResult',
        partialResultCallback: '/partialResult',
        hints: 'voice, sms, twilio, hate, love, awesome, help, british, cadbury, hershey, marmite, suck, terrible, awful, assistance, exports',
    });

    gather.play({
        loop: 1
    }, 'https://twiliozendeskcc.herokuapp.com/play/Amy/' + welcomeMessage);

    gather.pause({
        length: 10
    });

    voiceResponse.play({
        loop: 1
    }, 'https://twiliozendeskcc.herokuapp.com/play/Amy/' + didNotHearMessage);

    voiceResponse.redirect({
        method: 'POST'
    }, '/initiateIVR');

    var responseString = voiceResponse.toString();
    console.log(responseString);

    response.send(responseString);
});

app.post('/finalResult', function(request, response) {
    console.log('/finalResult');
    console.log('SpeechResult = ' + request.body['SpeechResult']);

    //result of <Gather> verb
    var speechResult = request.body['SpeechResult'];

    var options = {
        method: 'POST',
        url: 'https://preview.twilio.com/understand/Services/' + understandServiceInstance + '/Queries',
        auth: {
            username: understandAccountSid, password: understandAuthToken
        },
        form: {
            Language: 'en-us', Query: speechResult, ModelBuild: understandModelBuildSid
        }
    };

    var responseMessage = "OK. Got it. Please stand by while I connect you to the best possible agent.";
    var sentiment = 'service_question';

    req(options, function (error, resp, body) {
        if (error) {
            responseMessage = querystring.escape("Say what now? Please tell us how we can help you");
            sentiment = 'fail';
        } else {
            var understandResults = JSON.parse(body);
            onsole.log('understand(sentiment) = ' + understandResults);

            try {
                sentiment = understandResults.results.intent;
            } catch(err) {

            }
            sentiment = understandResults.results.intent;

            switch (sentiment) {
                case 'greeting':
                    var replyOptions = ["Hi :)", "Hello, there!", "Howdy!", "Hey there"];
                    responseMessage = replyOptions[Math.floor(Math.random() * replyOptions.length)];
                    break;
                case 'happy':
                    responseMessage = querystring.escape("Great. Glad to hear things are going well. We will go ahead and send you a t-shirt to say thank you. Hold on the line for a second if there is anything else we can do.");
                    break;
                case 'needs_help':
                    responseMessage = querystring.escape("OK - let me get a support representative who can help you immediately.");
                    break;
                case 'problem':
                    responseMessage = querystring.escape("Hmmm. Sounds like a problem. We can help you with that - one moment. I will escalate your case to a technician.");
                    break;
                case 'angry':
                    responseMessage = querystring.escape("Oh no. We hate to hear you upset. Let me connect you directly with someone who has authority to make changes to your account");
                    break;
                case 'silly':
                    responseMessage = querystring.escape("Robots have feelings too you know. That just seems silly. Let me connect you with a human.");
                    break;
                case 'service_question':
                    responseMessage = querystring.escape("Good question. We have a good answer. Stand by.");
                    break;
                default:
                    sentiment = "service_question"; // if understand returns sentiment=null, this will be the default choice
                    responseMessage = querystring.escape("OK. Got it. Please stand by while I connect you to the best possible agent."); // default message
                    console.log('Failed to get a sentiment value, using the default statement.');
            }
        }

        if (sentiment != 'fail') {

            var voiceResponse = new VoiceResponse();

            voiceResponse.play({
                loop: 1,
            }, 'https://taskrouterzendesksync.herokuapp.com/play/Amy/' + responseMessage);

            voiceResponse.enqueueTask({
                workflowSid: workflowSid
            }).task({}, '{"bot_intent": "' + sentiment + '", "type": "voice", "asrtext": "' + speechResult + '"}');

            response.send(voiceResponse.toString());

        } else {
            var voiceResponse = new VoiceResponse();
            var gather = voiceResponse.gather({
                input: 'speech',
                action: '/finalResult',
                partialResultCallback: '/partialResult',
                hints: 'voice, sms, twilio'
            });

            gather.play({
                loop: 1
            }, 'https://taskrouterzendesksync.herokuapp.com/play/Amy/' + responseMessage);

            response.send(voiceResponse.toString());
        }
    });
});

//Not currently using this:
app.post('/partialresult', function(request,response){
    console.log('/partialResult');

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

// configured messaging endpoint (via SMS to a Twilio number or FB Messenger)
app.post('/initiateMessagingBot', function(request, response) {
    console.log('/initiateMessagingBot');

    // Marketplace Add-On field (aka Caller ID)
    var friendlyName_first = "";
    var friendlyName_last = "";
    var address_street = "";
    var address_city = "";

    // Check if a Task already exists for this 'From'
        // Why? Need to distinguish if it is the FIRST message from the customer
        // or if it is a CONTINUATION of a conversation from the customer
    var queryJSON = {};
    var considerAsNewInteraction = 1;
    queryJSON['EvaluateTaskAttributes'] = "(message_from=\"" + request.body['From'] + "\")";

    twilioClient.taskrouter.workspaces(workspaceSid).tasks.list(queryJSON).then(tasks => {
        console.log(tasks.length);

        if (tasks.length > 0) {
          console.log("WTF");

            tasks.forEach(task => {
                console.log('Found tasks with this "from" ' +task.sid + " " + task.assignmentStatus);

                //console.log('Logging task');
                //console.log(task);
                // determine if the Task is still active - pending, reserved, assigned (not completed)
                if (task.assignmentStatus == 'pending' || task.assignmentStatus == 'reserved'
                    || task.assignmentStatus == 'assigned') {
                  sendMessageToBotLogicIfNeeded(task, request);
                  considerAsNewInteraction = 0;

                    // first fetch the user's name out of syncMap of UserProfiles
                    syncService.syncMaps('UserProfiles').syncMapItems(task.sid + '.info').fetch().then(response => {
                        console.log('Fetched the user profile: ' + response);

                        // send the message to the chatChannel=taskSid as the message sender
                        var userIdentity = response.data.first_name + ' ' + response.data.last_name;
                        twilioChatHelper.sendChat(task.sid, request.body['Body'], userIdentity);
                    });
                }
                // if it's not this, the task is complete but has not been deleted yet - so we need to consider it as a new interaction 
            });
        }

        if (considerAsNewInteraction) {  // it is the first message from this user in the TaskRouter system; create a Task to represent it and insert the message into chat container
            console.log('No active Tasks found with this "from". Creating Task for this instead.');
            participantContactNumbers.push(request.body['From']);

            var attributesJSON = {};
            attributesJSON['message_from'] = request.body['From'];
            attributesJSON['from'] = request.body['From'];
            attributesJSON['message_body'] = request.body['Body'];
            attributesJSON['message_to'] = request.body['To'];
            attributesJSON['message_sid'] = request.body['MessageSid'];

            // hard coding in a specific number that skips bot qualification when messaged
            if (request.body['To'] == twilioPhoneNumberSkipBot) {
                attributesJSON['bot_qualified'] = "true";
            }

            // create the Task
            twilioClient.taskrouter.workspaces(workspaceSid).tasks.create({
                workflowSid: workflowSid,
                attributes: JSON.stringify(attributesJSON),
                taskChannel: 'chat'
            }).then((createdTask) => {
                console.log('Created Task ' + createdTask.sid + ' for SMS from : ' + request.body['From']);

                // determine if it came from Facebook Messenger
                // if yes, then we need to fetch the profile details
                // if no, then we need to fetch caller details with Marketplace Addons
                var id = request.body['From'];
                if (id.substr(0, 10) == "messenger:") {
                    id = id.replace('messenger:', '');
                    handleInboundFBMessage(id, createdTask, request.body['Body']);
                } else {
                    try {
                        var addOnsData = JSON.parse(createdTask.addons);

                        friendlyName_first = addOnsData['nextcaller_advanced_caller_id']['records'][0]['first_name'];
                        friendlyName_last = addOnsData['nextcaller_advanced_caller_id']['records'][0]['last_name'];
                        address_street = addOnsData['nextcaller_advanced_caller_id']['records'][0]['address'][0]['line1'];
                        address_city = addOnsData['nextcaller_advanced_caller_id']['records'][0]['address'][0]['city'];
                    } catch (err) {
                        console.log('No user identification for this inbound user. Using the phone number as the firstname.');
                        console.log(err);
                        friendlyName_first = request.body['From'];
                    }

                    // update our SyncMap UserProfiles to contain user data fetched via AddOns
                    syncService.syncMaps('UserProfiles').fetch().then(fetchedMap => {
                        console.log('Fetching SyncMap: UserProfiles ');
                        // insert syncMapItem
                        syncService.syncMaps(fetchedMap.uniqueName).syncMapItems.create({
                            key: createdTask.sid + '.info',
                            data: {
                                'first_name': friendlyName_first,
                                'last_name': friendlyName_last,
                                'address_street': address_street,
                                'address_city': address_city,
                                'message_type': 'sms',
                                'profile_pic': 'img/unknownavatar.jpeg'
                            }
                        }).then(createdMapItem => {
                            console.log('Created mapItem');
                            console.log(createdMapItem);
                            console.log(JSON.parse(createdMapItem));
                            return friendlyName_first + ' ' + friendlyName_last;
                        }).catch(err => {
                            console.log('Failed to insert UserProfile ' + taskSid + ' due to error: ' + err);
                        });
                    }).catch(err => {
                        console.log('Error trying to fetch UserProfiles due to ' + err);
                        // map didn't exist, create it and then insert syncMapItem
                        syncService.syncMaps.create({
                            uniqueName: 'UserProfiles'
                        }).then(createdMap => {
                            syncService.syncMaps(createdMap.uniqueName).syncMapItems.create({
                                key: createdTask.sid + '.info',
                                data: {
                                    'first_name': friendlyName_first,
                                    'last_name': friendlyName_last,
                                    'address_street': address_street,
                                    'address_city': address_city,
                                    'message_type': 'sms',
                                    'profile_pic': 'img/unknownavatar.jpeg'
                                }
                            }).then(createdMapItem => {
                                return friendlyName_first + ' ' + friendlyName_last;
                            }).catch(err => {
                                console.log('Could not create SyncMapItem for UserProfile TaskSid: ' + taskSid + ' due to error: ' + err);
                            });
                        }).catch(err => {
                            console.log('Unable to create SyncMap UserProfiles due to error: ' + err);
                        });
                    });

                    // push the message to Chat channel
                    var userIdentity = friendlyName_first + ' ' + friendlyName_last;
                    twilioChatHelper.sendChat(createdTask.sid, request.body['Body'], userIdentity);
                }

                // send message for bot qualification regardless if via FB or SMS
                sendMessageToBotLogicIfNeeded(createdTask, request);

            }).catch(err => {
                console.log('Failed to create Task for SMS from : ' + request.body['From'] + ' due to : ' + err);
            });
        }
    });
    response.send('');
});

function handleInboundFBMessage(facebookId, createdTask, messageBody) {
    var results = {};

    var options = {
        method: 'GET',
        url: 'https://graph.facebook.com/v2.6/' + facebookId + '?fields=first_name,last_name,profile_pic&access_token=' + pageAccessToken
    };

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

        console.log("Fetch FB Profile Details for TaskSid: " + createdTask.sid);
        console.log("Fetched FB Profile Details: " + JSON.stringify(results));

        // update our SyncMap UserProfiles to contain the FB detail (if SMS is via FB channel)
        syncService.syncMaps('UserProfiles').fetch().then(fetchedMap => {
            // insert syncMapItem
            syncService.syncMaps(fetchedMap.uniqueName).syncMapItems.create({
                key: createdTask.sid + '.info',
                data: results
            }).catch(err => {
                console.log('Failed to insert UserProfile ' + createdTask.sid + ' due to error: ' + err);
            });
        }).catch(err => {
            // map didn't exist, create it and then insert syncMapItem
            syncService.syncMaps.create({
                uniqueName: 'UserProfiles'
            }).then(createdMap => {
                syncService.syncMaps(createdMap.uniqueName).syncMapItems.create({
                    key: createdTask.sid + '.info',
                    data: results
                }).catch(err => {
                    console.log('Could not create SyncMapItem for UserProfile TaskSid: ' + createdTask.sid + ' due to error: ' + err);
                });
            }).catch(err => {
                console.log('Unable to create SyncMap UserProfiles due to error: ' + err);
            });
        });

        // send the message to the Chat channel
        var userIdentity = results['first_name'] + ' ' + results['last_name'];
        twilioChatHelper.sendChat(taskSid, messageBody, userIdentity);
    });
}

function sendMessageToBotLogicIfNeeded(task, request) {
    var hasBotQualifiedProperty = JSON.parse(task.attributes).hasOwnProperty('bot_qualified');
    console.log('Is the task on INITIAL creation Bot Qualified ? ' + hasBotQualifiedProperty);

    if (!hasBotQualifiedProperty) {
        automateReply(task, request);
    }
}

function automateReply(task, request) {
    // the given Task has not yet been bot qualified => so we will use Understand to determine the intent
    // and then automate our replies
    console.log('Sending Task ' + task.sid + ' to Wit.ai for analysis');

    var options = {
        method: 'POST',
        url: 'https://preview.twilio.com/understand/Services/' + understandServiceInstance + '/Queries',
        auth: {
            username: accountSid, password: authToken
        },
        form: {
            Language: 'en-us', Query: queryMessage, ModelBuild: understandModelBuildSid
        }
    };

    var responseMessage = '';
    var sentiment = '';

    req(options, function (error, response, body) {
        if (error) {
            responseMessage = querystring.escape("Say what now? Please tell us how we can help you");
            sentiment = 'fail';
        } else {
            var understandResults = JSON.parse(body);
            sentiment = understandResults.results.intent;
            console.log('understand(sentiment) = ' + sentiment);

            switch (sentiment) {
                case 'greeting':
                    var replyOptions = ["Hi :)", "Hello, there!", "Howdy!", "Hey there"];
                    responseMessage = replyOptions[Math.floor(Math.random() * replyOptions.length)];
                    break;
                case 'happy':
                    responseMessage = querystring.escape("Great. Glad to hear things are going well. We will go ahead and send you a t-shirt to say thank you. Hold on the line for a second if there is anything else we can do.");
                    break;
                case 'needs_help':
                    responseMessage = querystring.escape("OK - let me get a support representative who can help you immediately.");
                    break;
                case 'problem':
                    responseMessage = querystring.escape("Hmmm. Sounds like a problem. We can help you with that - one moment. I will escalate your case to a technician.");
                    break;
                case 'angry':
                    responseMessage = querystring.escape("Oh no. We hate to hear you upset. Let me connect you directly with someone who has authority to make changes to your account");
                    break;
                case 'silly':
                    responseMessage = querystring.escape("Robots have feelings too you know. That just seems silly. Let me connect you with a human.");
                    break;
                case 'service_question':
                    responseMessage = querystring.escape("Good question. We have a good answer. Stand by.");
                    break;
                default:
                    sentiment = "service_question"; // if understand returns sentiment=null, this will be the default choice
                    responseMessage = querystring.escape("OK. Got it. Please stand by while I connect you to the best possible agent."); // default message
                    console.log('Failed to get a sentiment value, using the default statement.');
                    break;
            }
        }

        console.log("Result of analyzing " + request.body['Body'] + " is " + JSON.stringify(sentimentResponse.sentiment));

        if (sentiment != "fail" && sentiment != "greeting") {
            updateTaskAttributes(task.sid, {"bot_qualified": "true", "bot_intent": sentiment})
        }

        twilioClient.messages.create({
            to: request.body['From'], // Any number Twilio can deliver to
            from: request.body['To'], // A number you bought from Twilio and can use for outbound communication
            body: sentimentResponse.message, // body of the SMS message
            statusCallback: 'https://twiliozendeskcc.herokuapp.com/messagestatus/'
        }).then(createdMessage => {
            console.log('Successfully sent response as SMS back to User.');
            console.log(createdMessage);
        }).catch(err => {
            console.log('Failed to send response as SMS back to User due to error: ' + err);
        });

        // push the bot response into the Chat Channel, but as the "server" == worker
        // you know cause bot == worker in this case
        twilioChatHelper.sendChat(task.sid, sentimentResponse.message, 'Al Cook');
    });
}

function updateTaskAttributes(taskSid, sourceTargetAttributes) {
  twilioClient.taskrouter.workspaces(workspaceSid).tasks(taskSid).fetch().then(task => {
      var attributes = JSON.parse(task.attributes);

      for (var key in sourceTargetAttributes) {
          attributes[key] = sourceTargetAttributes[key];
      }

      task.update({
          attributes: JSON.stringify(attributes)
      }).then(updatedTask => {
          console.log('Successfully updated Task ' + taskSid);
          console.log('Updated Task: ' + updatedTask);
      }).catch(err => {
         console.log('Failed to update Task with Sid: ' + taskSid);
         console.log('Task update error: ' + err);
      });

  }).catch(err => {
     console.log('Failed to fetch Task with Sid: ' + taskSid + ' for update.');
     console.log('Task fetch error: ' + err);
  });
}

app.get('/deletealltasks', function(request, response) {
  //this page purges all TaskRouter Sync and Chat content in order to reset the demo

  twilioClient.taskrouter.workspaces(workspaceSid).tasks.list(function(err, tasks) {
    if (!err) {
      console.log(tasks);

      tasks.forEach(function(task) {
        twilioClient.taskrouter.workspaces(workspaceSid).tasks(task.sid).remove();
        console.log('deleted task ' + task.sid);
      });
    }
  });
  // need to update this to delete every sync map
  syncClient.map().then(syncMap => {
                    console.log(syncMap);
                });

  syncClient.map('EventStream.WQea20678d853cf025b5875126f5c1547a').then(syncMap => {
                    syncMap.removeMap().catch(err => {
                        console.log('Err deleting SyncMapItem: ' + err);
                    });
                });
  syncClient.map('EventStream.WQbcc8f236cde1977e4ef5535b4deff820').then(syncMap => {
                    syncMap.removeMap().catch(err => {
                        console.log('Err deleting SyncMapItem: ' + err);
                    });
                });
  syncClient.map('EventStream.WQ4fa5d2a1324d7d98d30c591f0f1e7312').then(syncMap => {
                    console.log(syncMap);
                    syncMap.removeMap().catch(err => {
                        console.log('Err deleting SyncMapItem: ' + err);
                    });
                });
   syncClient.map('EventStream.WQ96d95f1d60f14921bdab67a1ef1c6266').then(syncMap => {
                    syncMap.removeMap().catch(err => {
                        console.log('Err deleting SyncMapItem: ' + err);
                    });
                });
  syncClient.map('EventStream.WQ99f2acb77fce64fcb7bf784cdbda82b2').then(syncMap => {
                    syncMap.removeMap().catch(err => {
                        console.log('Err deleting SyncMapItem: ' + err);
                    });
                });
  syncClient.map('EventStream.WQ65d738992b8473b612884d5da35bcee2').then(syncMap => {
                    console.log(syncMap);
                    syncMap.removeMap().catch(err => {
                        console.log('Err deleting SyncMapItem: ' + err);
                    });
                });
  syncClient.map('TaskList.WK3d909c13f46f8e227e32e38d66b19691').then(syncMap => {
                    console.log(syncMap);
                    syncMap.removeMap().catch(err => {
                        console.log('Err deleting SyncMapItem: ' + err);
                    });
                });

  response.send('all tasks deleted');
});

app.get('/completeTask', function(request, response) {

    twilioClient.taskrouter.workspaces(workspaceSid).tasks(request.query.sid).update({
        assignmentStatus: 'completed',
        reason: 'Agent has finished the conversation.'
    }).then(updatedTask => {
        console.log('Successfully completed Task: ' + request.query.sid);
        console.log('Updated Task: ' + updatedTask);
    }).catch(err => {
        console.log('Failed to update Task ' + request.query.sid + ' to assignmentStatus: completed');
        console.log('Task update error: ' + err);
    });

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
      twilioClient.taskrouter.workspaces(workspaceSid).tasks(request.query.tasksid).reservations(request.query.reservationsid).update({
        instruction: 'conference',
        dequeueFrom: twilioPhoneNumber
      }, function(err, reservation) {
        console.log(err);
        console.log(reservation.reservation_status);
        console.log(reservation.worker_name);
      });
    }

    else {
      twilioClient.taskrouter.workspaces(workspaceSid).tasks(request.query.tasksid).reservations(request.query.reservationsid).update({
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
  console.log(JSON.stringify(request.query))
  console.log(request.query.tasksid);

  twilioClient.taskrouter.workspaces(workspaceSid).tasks(request.query.tasksid).fetch(function(err, task) {
    console.log(task.attributes);
    response.send(task);
  });
});

app.get('/getTaskRepresentation', function(request, response) {
  //[{"data":{"attributes":{"bot_qualified":"true","worker":"WKc9fb44a68905d751dded01581d3fe50c"},"queue":"Other Customers","reservationSid":"WRf5f2748b6017c744232fab4ace8c51e8","sid":"WT197a33a343235fdbc695b5b7b8464828","status":"reserved"}}]
  console.log("received request to get task details");
  console.log(JSON.stringify(request.query))
  console.log(request.query.tasksid);

  twilioClient.taskrouter.workspaces(workspaceSid).tasks(request.query.tasksid).fetch(function(err, task) {
    console.log(task);
    var dataToReturn={"data":{"attributes":JSON.parse(task.attributes), "queue":task.taskQueueFriendlyName,"sid":task.sid, "status":task.assignmentStatus, "channel":task.taskChannelUniqueName}};
    console.log(dataToReturn);
    response.send(dataToReturn);
  });
});


app.post('/syncEventStream', function(request, response) {
    // update the appropriate syncMap when an event is received from TaskRouter eventCallback config
    if (request.body.TaskSid) {
        var dataToSet = {};

        switch (request.body.EventType) {
            case "task.deleted":
                syncClient.map('EventStream.' + request.body.TaskQueueSid).then(syncMap => {
                    syncMap.remove(request.body.TaskSid).catch(err => {
                        console.log('Err deleting SyncMapItem: ' + err);
                    });
                });
                break;

            case "task-queue.entered":
                dataToSet['attributes'] = request.body.TaskAttributes;
                dataToSet['sid'] = request.body.TaskSid;
                dataToSet['status'] = request.body.TaskAssignmentStatus;
                dataToSet['channel'] = request.body.TaskChannelUniqueName;
                dataToSet['queue'] = request.body.TaskQueueName;

                syncClient.map('TaskList.Queue').then(syncMap => {
                    syncMap.set(request.body.TaskSid, dataToSet);
                });

                syncClient.map('EventStream.' + request.body.TaskQueueSid).then(syncMap => {
                    syncMap.set(request.body.TaskSid, dataToSet);
                });
                break;

            case "task-queue.timeout":
                syncClient.map('EventStream.' + request.body.TaskQueueSid).then(syncMap => {
                    syncMap.remove(request.body.TaskSid);
                });
                break;

            case "task-queue.moved":
                syncClient.map('EventStream.' + request.body.TaskQueueSid).then(syncMap => {
                    syncMap.remove(request.body.TaskSid);
                });
                break;

            case "task.canceled":
                syncClient.map('EventStream.' + request.body.TaskQueueSid).then(syncMap => {
                    syncMap.remove(request.body.TaskSid);
                });

                //todo need to update this to support tasks currently reserved too
                syncClient.map('TaskList.Queue.' + request.body.TaskQueueSid).then(syncMap => {
                    syncMap.remove(request.body.TaskSid);
                });
                break;

            case "task.completed":
                dataToSet['attributes'] = request.body.TaskAttributes;
                dataToSet['sid'] = request.body.TaskSid;
                dataToSet['status'] = request.body.TaskAssignmentStatus;

                syncClient.map('EventStream.' + request.body.TaskQueueSid).then(syncMap => {
                    syncMap.update(request.body.TaskSid, dataToSet);
                });

                taskAttributes = JSON.parse(request.body.TaskAttributes);

                syncClient.maps('TaskList.' + taskAttributes['worker']).then(syncMap => {
                    syncMap.remove(request.body.TaskSid);
                });
                break;

            case "task.updated":
                dataToSet['attributes'] = request.body.TaskAttributes;
                dataToSet['sid'] = request.body.TaskSid;
                dataToSet['status'] = request.body.TaskAssignmentStatus;

                if (request.body.TaskAssignmentStatus == "pending") {
                    syncClient.map('TaskList.Queue').then(syncMap => {
                        syncMap.update(request.body.TaskSid, dataToSet);
                    });

                    syncClient.map('EventStream.' + request.body.TaskQueueSid).then(syncMap => {
                        syncMap.update(request.body.TaskSid, dataToSet);
                    });
                } else {
                    // the task updated event does not include the worker sid, which is the key in the taskList data structure
                    // so we first get it out of the task attributes, where we have saved it
                    twilioClient.taskrouter.workspaces(workspaceSid).tasks(request.body.TaskSid).fetch(function(err, task) {
                        attributes = JSON.parse(task.attributes);

                        syncClient.map('TaskList.' + attributes['worker']).then(syncMap => {
                            syncMap.update(request.body.TaskSid, dataToSet);
                        });
                    });
                }
                break;

            case "reservation.created":
                dataToSet['status'] = request.body.TaskAssignmentStatus;
                dataToSet['reservationSid'] = request.body.ReservationSid;
                dataToSet['attributes'] = request.body.TaskAttributes;
                dataToSet['sid'] = request.body.TaskSid;
                console.log("reservation created of channel type " + request.body.TaskChannelUniqueName)
                console.log("reservation created of channel sid " + request.body.TaskChannelSid)

                if (request.body.TaskChannelUniqueName) {
                    dataToSet['channel'] = request.body.TaskChannelUniqueName;
                } else if (request.body.TaskChannelSid == voiceTaskChannelSid) {
                    dataToSet['channel'] = "voice";
                } else if (request.body.TaskChannelSid == chatTaskChannelSid) {
                    dataToSet['channel'] = "chat";
                }
                console.log(dataToSet['channel'])

                dataToSet['queue'] = request.body.TaskQueueName;

                /*syncClient.map('TaskList.' + request.body.WorkerSid).then(syncMap => {
                    syncMap.set(request.body.TaskSid, dataToSet);
                });*/
                syncClient.map('TaskList.Queue').then(syncMap => {
                    syncMap.remove(request.body.TaskSid);
                });

                var newAttributes = {'worker' : request.body.WorkerSid};
                updateTaskAttributes(request.body.TaskSid, newAttributes);

                

                //dataToSet={};
                try {
                    var addons = JSON.parse(request.body.TaskAddons);
                    dataToSet['name']=addons.nextcaller_advanced_caller_id.records[0].name;
                    dataToSet['address']=addons.nextcaller_advanced_caller_id.records[0].address[0].line1 + " " + addons.nextcaller_advanced_caller_id.records[0].address[0].city + " " + addons.nextcaller_advanced_caller_id.records[0].address[0].zip_code;
                } catch (err) {
                    attributes=JSON.parse(request.body.TaskAttributes);
                    dataToSet['name']=attributes.from;
                }

                dataToSet['profile_pic']="img/unknownavatar.jpeg";
                console.log("reservation was created")
                console.log("setting " +dataToSet);

                syncClient.map('TaskList.' + request.body.WorkerSid).then(syncMap => {
                    syncMap.update(request.body.TaskSid, dataToSet);
                });

                break;

            case "reservation.timeout":
                syncClient.map('TaskList.' + request.body.WorkerSid).then(syncMap => {
                    syncMap.remove(request.body.TaskSid);
                });
                break;

            case "reservation.canceled":
                syncClient.map('TaskList.' + request.body.WorkerSid).then(syncMap => {
                    syncMap.remove(request.body.TaskSid);
                });
                break;
            case "reservation.accepted":
                console.log("reservation was accepted");
                console.log("new status " + request.body.TaskAssignmentStatus)
                dataToSet['status'] = request.body.TaskAssignmentStatus;
                dataToSet['accepted'] = "true";

                syncClient.map('TaskList.' + request.body.WorkerSid).then(syncMap => {
                    syncMap.update(request.body.TaskSid, dataToSet);
                });

                var newAttributes = {'worker':request.body.WorkerSid};
                updateTaskAttributes(request.body.TaskSid, newAttributes);
                break;

            case "task.wrapup":
                dataToSet['status'] = request.body.TaskAssignmentStatus;

                twilioClient.taskrouter.workspaces(workspaceSid).tasks(request.body.TaskSid).fetch(function(err, task) {
                    attributes = JSON.parse(task.attributes);

                    syncClient.map('TaskList.' + attributes['worker']).then(syncMap => {
                        syncMap.update(request.body.TaskSid, dataToSet);
                    });
                });
                break;
        }
    }
    response.send('');
});

app.get('/sendSMS', function(request, response) {
    // send SMS via Twilio Node Helper library
    twilioClient.messages.create({
        to: request.query.to,
        from: request.query.from, // twilio phone number
        body: request.query.body
    }).then(message => {
        console.log('Successfully sent message to: ' + request.query.to);
    }).catch(err => {
        console.log('Failed to send message to: ' + request.query.to);
    });

    // cool, now put this agent message into the chat too
    twilioChatHelper.sendChat(request.query.sid, request.query.body, 'Al Cook');

    response.send('');
});

app.post('/messagestatus', function(request, response) {

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

app.post('/voice', function (request, response) {

  const twiml = new VoiceResponse();

  if (request.toNumber) {
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