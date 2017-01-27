# Flare Cloud Code

Flare (iOS) App cloud code. Powerful API to be used for social app.

##Dependencies

* Mongo DB w/ r&w
* S3 Storage bucket (Google or Azure if you use a different adapter)
* A robust .env file containing environment variables (as seen in index.js)
* Parse-Server & Parse-Dashboard
* p12 certificate exports pointing to signing keys with push APNS enabled
* Mailgun (or another provider with a different adapter)


##Installation
* Run `npm install` & resolve errors
* Run `npm start` & pray there are no errors

##Note
SSL, Security, Proxies are up to you.

Good luck!