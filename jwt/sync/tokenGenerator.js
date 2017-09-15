require('dotenv').load();

const Twilio = require('twilio');
const AccessToken = Twilio.jwt.AccessToken;
const ChatGrant = AccessToken.ChatGrant;
const SyncGrant = AccessToken.SyncGrant;

function getSyncAndChatToken(identity) {

    const token = new AccessToken(process.env.accountSid, process.env.apiKey, process.env.apiSecret, { ttl: 86400 });   // ttl = 24 hrs
    token.identity = identity;

    const chatGrant = new ChatGrant({
        serviceSid: process.env.chatServiceInstance,
    });
    token.addGrant(chatGrant);

    const syncGrant = new SyncGrant({
        serviceSid: process.env.syncServiceInstance
    });
    token.addGrant(syncGrant);

    return token.toJwt();
}

exports.getSyncAndChatToken = getSyncAndChatToken;
