require('dotenv').load();

var req = require('request');

// Twilio creds (for everything but Twilio Understand)
var accountSid = process.env.accountSid;
var authToken = process.env.authToken;

var understandServiceInstance = process.env.understandServiceInstance;
var understandModelBuildSid = process.env.understandModelBuildSid;

function getResponseBasedOnSentiment(queryMessage) {

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

    // req(options, function (error, response, body) {
    //     if (error) {
    //         console.log('error');
    //     }
    //
    //     var understandResponse = JSON.parse(body);
    //     // console.log(understandResponse.results.intent);
    //
    //     return understandResponse;
    // });
}


var a = getResponseBasedOnSentiment("testing testing");
console.log(a);
