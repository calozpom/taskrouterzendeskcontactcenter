function changeState(state) {
    console.log("trying to change state to state " + state);
    var activitySid = "WAbc57093ed33d341e926d9db5e73525ad";
    switch (state) {
        case "Idle":
            activitySid = "WAbc57093ed33d341e926d9db5e73525ad";
            break;
        case "Offline":
            activitySid = "WA7d69025af6c5acae76faad56da32698e";
            break;
        case "Busy":
            activitySid = "WA6492c399f88532c2935ca7fcbfe56e9b";
            break;
    }
    console.log(activitySid);
    worker.update("ActivitySid", activitySid, function(error, worker) {
        if (error) {
            console.log(error.code);
            console.log(error.message);
        } else {
            console.log(worker.activityName); // "Offline"
        }
    });
}


function sendSMS(from, to, sid, body) {
    $.ajax({
        url: 'sendSMS',
        data: { 'from': from, 'to': to, 'sid': sid, 'body': body },
        type: 'get',
        success: function(output) {
            console.log("SMS sent OK");

        }
    });


}



function updateCapacity(number, workerSid) {
    $.ajax({
        url: 'updateCapacity',
        data: { 'capacity': number, 'workerSid': workerSid },
        type: 'get',
        success: function(output) {
            console.log("received OK from request to update capacity");

        }
    });
}

function acceptTask(tasksid, reservationsid) {
    $.ajax({
        url: 'acceptTask',
        data: { 'tasksid': tasksid, 'reservationsid': reservationsid },
        type: 'get',
        success: function(output) {
            console.log("received OK to accept task");

        }
    });
}



function completeTask(sid) {
    console.log("completing task");
    $.ajax({
        url: 'completeTask',
        data: { 'sid': sid },
        type: 'get',
        success: function(output) {
            console.log("task completed OK");

        }
    });
    //used to do firebase update here but moved server side for security
    //myFirebase.child(sid).remove();
    var element = $("#taskDiv" + sid);
    element.fadeOut(function() {
        element.remove();
    })


}


