require('dotenv').load();
const Twilio = require('twilio');

const accountSid = process.env.accountSid;
const authToken = process.env.authToken;
const chatServiceInstance = process.env.chatServiceInstance;

const twilioClient = new Twilio(accountSid, authToken);
const chatService = twilioClient.chat.services(chatServiceInstance);

// this serves as a helper to send messages to a specific Channel, identifiable by the uniqueName, as a specific User
// it does all the heavy lifting of finding/creating a Channel,
// finding/creating a User, making the User a Member of the Channel,
// and ultimately, sending the message into the Channel as a verifiable Member of that Channel
function sendChat(channelUniqueName, messageBody, identity) {
    console.log('Fetching channel ' + channelUniqueName);
    chatService.channels(channelUniqueName).fetch().then(fetchedChannel => {
        // make sure a User exists
        chatService.users.create({
            identity: identity
        }).then(createdUser => {    // send the chat message
            sendChatMessage(fetchedChannel.sid, messageBody, identity); // you can fetch channels by unique name, but everything else requires sid, huh?
        }).catch(err => {
            if (err.status == 409) {    // user already exists, proceed with sending the chat message
                sendChatMessage(fetchedChannel.sid, messageBody, identity);
            }
        });
    }).catch(err => {
        console.log('Failed to fetch Channel ' + channelUniqueName);
        console.log(err);
        console.log(err.status);

        if (err.status == 404) {    // channel doesn't exist, must create it first
            console.log('Trying to create Channel instead');
            chatService.channels.create({
                uniqueName: channelUniqueName
            }).then(createdChannel => {
                console.log('Created a Channel ' + channelUniqueName);
                // make sure a User exists
                chatService.users.create({
                    identity: identity
                }).then(createdUser => {    // send the chat message
                    sendChatMessage(createdChannel.sid, messageBody, identity);
                }).catch(err => {
                    console.log('Failed to create Channel ' + channelUniqueName);
                    console.log(err);

                    if (err.status == 409) {    // user already exists, proceed with sending the chat message
                        console.log('The user already exists');
                        sendChatMessage(createdChannel.sid, messageBody, identity);
                    }
                });
            }).catch(err => {
                console.log('Failed to create Channel for Task: ' + channelUniqueName);
                console.log('Error: ' + err);
            });
        }
    });
}

function sendChatMessage(channelSid, messageBody, identity) {
    console.log('sendChatMessage()');

    // Send the message to Twilio Chat container
    chatService.channels(channelSid).members.create({    // add this User as a member of this Channel
        identity: identity
    }).then(createdMember => {
        console.log('Added the User ' + identity + ' as a member of the Channel: ' + channelSid + '. Proceeding to send message to Chat container.');
        sendMessage(channelSid, messageBody, identity);     // send the message
    }).catch(err => {
        console.log('Error: ' + err);
        // status == 409: Member already exists, just insert
        if (err.status == 409) {
            sendMessage(channelSid, messageBody, identity); // bruh already exists, send the message
        }
    });
}

function sendMessage(channelSid, messageBody, identity) {
    console.log('sendMessage()');

    chatService.channels(channelSid).messages.create({
        from: identity,
        body: messageBody
    }).then(response => {
        console.log('Successfully inserted message into Chat Channel ' + channelSid);
        console.log('Message: ' + response);
    }).catch(err => {
        console.log('Failed to insert message into Chat Channel ' + channelSid);
        console.log('Error: ' + err);
    });
}

exports.sendChat = sendChat;
