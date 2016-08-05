from meya import Component
import re
import json
from twilio.rest import TwilioTaskRouterClient

class IntentChecker(Component):

    def start(self):
        account_sid = "AC36a9938f19a9480c595e857f2f1af7dd"
        auth_token  = "264a2e58db9f0ccc58a3003c2c472164"
        print "test test"
        client = TwilioTaskRouterClient(account_sid, auth_token)
      
        # read in the age, and default to `0` if invalid or missing
        text = self.db.flow.get('text') or ""
        taskSid=self.db.user.user_id
        print self.db.user.user_id
        taskSid="WTa38157b48040c397d19781f1857e05eb"
        angry_words=['cancel','hate','suck','yelp']
        words_re = re.compile("|".join(angry_words))
        if words_re.search(text):
            action = "angry"
        else:
            action = "happy"
        task = client.tasks("WS056355824815f89c7cc46e5d8cacaf20").get(taskSid)
        task_attributes= json.loads(task.attributes)
        task_attributes['bot_qualified']='true'
        task_attributes['bot_intent']=action
        print task_attributes
        attribute_string=json.dumps(task_attributes)
        task = client.tasks("WS056355824815f89c7cc46e5d8cacaf20").update(taskSid,attributes=attribute_string)
        message = self.create_message(text=self.db.user.user_id)
        # the action determines which transition is invoked
        # note that no message is returned, just an action
        return self.respond(message=None, action=action)