import requests 
import json
r = requests.get('https://taskrouter.twilio.com/v1/Workspaces/WS056355824815f89c7cc46e5d8cacaf20/Tasks/WTa861ca759450781a086403064dfbbf29', auth=('AC36a9938f19a9480c595e857f2f1af7dd', '264a2e58db9f0ccc58a3003c2c472164'))
print r.status_code
print r.headers['content-type']
print r.text
jsonResp=json.loads(r.text)
jsonAttr=json.loads(jsonResp['attributes'])
jsonAttr['bot_qualified']="true"
jsonAttr['bot_intent']="angry"
print jsonAttr
r2 = requests.post('https://taskrouter.twilio.com/v1/Workspaces/WS056355824815f89c7cc46e5d8cacaf20/Tasks/WTa861ca759450781a086403064dfbbf29', auth=('AC36a9938f19a9480c595e857f2f1af7dd', '264a2e58db9f0ccc58a3003c2c472164'), data=jsonAttr)



