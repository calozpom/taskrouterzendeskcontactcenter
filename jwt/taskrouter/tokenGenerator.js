const taskrouter = require('twilio').jwt.taskrouter;
const util = taskrouter.util;

const TaskRouterCapability = taskrouter.TaskRouterCapability;
const Policy = TaskRouterCapability.Policy;

const TASKROUTER_BASE_URL = 'https://taskrouter.twilio.com';
const version = 'v1';

function getTaskRouterWorkerCapabilityToken(accountSid, authToken, workspaceSid, workerSid) {
    return getTaskRouterCapabilityToken(accountSid, authToken, workspaceSid, workerSid, true);
}

function getTaskRouterWorkspaceCapabilityToken(accountSid, authToken, workspaceSid, workerSid) {
    return getTaskRouterCapabilityToken(accountSid, authToken, workspaceSid, workerSid, false);
}

function buildWorkspacePolicy(workspaceSid, options) {
    options = options || {};
    var resources = options.resources || [];
    var urlComponents = [TASKROUTER_BASE_URL, version, 'Workspaces', workspaceSid]

    return new Policy({
        url: urlComponents.concat(resources).join('/'),
        method: options.method || 'GET',
        allow: true
    });
}

function getTaskRouterCapabilityToken(accountSid, authToken, workspaceSid, workerSid, isWorker) {
    const capability = new TaskRouterCapability({
        accountSid: accountSid,
        authToken: authToken,
        workspaceSid: workspaceSid,
        channelId: workerSid,
        ttl: 86400  // time to live == 24 hrs
    });

    var eventBridgePolicies = util.defaultEventBridgePolicies(accountSid, workerSid);

    if (isWorker) {
        var workspacePolicies = [
            // Workspace fetch Policy
            buildWorkspacePolicy(workspaceSid),
            // Workspace Activities Update Policy
            buildWorkspacePolicy(workspaceSid, { resources: ['Activities'], method: 'POST' }),
            // Workspace Activities Worker Reserations Policy
            buildWorkspacePolicy(workspaceSid, { resources: ['Workers', workerSid, 'Reservations', '**'], method: 'POST' })
        ];
    } else {
        var workspacePolicies = [
            // Workspace Policy
            buildWorkspacePolicy(workspaceSid),
            // Workspace subresources fetch Policy
            buildWorkspacePolicy(workspaceSid, { resources: ['**'] }),
            // Workspace resources update Policy
            buildWorkspacePolicy(workspaceSid, { resources: ['**'], method: 'POST' }),
            // Workspace resources delete Policy
            buildWorkspacePolicy(workspaceSid, { resources: ['**'], method: 'DELETE' })
        ];
    }

    eventBridgePolicies.concat(workspacePolicies).forEach(function (policy) {
        capability.addPolicy(policy);
    });

    return capability.toJwt();
}

exports.getTaskRouterWorkerCapabilityToken = getTaskRouterWorkerCapabilityToken;
exports.getTaskRouterWorkspaceCapabilityToken = getTaskRouterWorkspaceCapabilityToken;