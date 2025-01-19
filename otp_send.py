import random
import smtplib
import os
import sys
import time

random.seed(time.time())

from email.message import EmailMessage
otp = ""
for i in range(6):
    otp += str(random.randint(1,9))

print(otp)
server = smtplib.SMTP(host='smtp.gmail.com',port=587)
server.starttls()

from_mail = 'mahindragowdkatta@gmail.com'
server.login(user=from_mail,password=os.getenv('EMAIL_PASSWORD'))
to_mail = sys.argv[1]
msg = EmailMessage()
msg['subject'] = 'OTP Verification'
msg['from'] = from_mail
msg['to'] = to_mail
msg.set_content("Your OTP is: "+otp)

server.send_message(msg)
server.quit()