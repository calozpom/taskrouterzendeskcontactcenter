const ClientCapability = require('twilio').jwt.ClientCapability;
const IncomingClientScope = ClientCapability.IncomingClientScope;

function getClientCapabilityToken(accountSid, authToken, identity) {
    const capability = new ClientCapability({
        accountSid: accountSid,
        authToken: authToken,
        ttl: 86400  // time to live == 24 hrs
    });

    capability.addScope(new IncomingClientScope(identity));

    return capability.toJwt();
}

exports.getClientCapabilityToken = getClientCapabilityToken;
