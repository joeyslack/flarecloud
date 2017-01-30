var _this = this;

var twilioSid = process.env.TWILIO_SID;
var twilioToken = process.env.TWILIO_TOKEN;
var twilio = require('twilio')(twilioSid, twilioToken);

var activeTwilioPhoneNumbers = process.env.TWILIO_NUMBERS.split(",").map(function(item) {
  return item.trim();
});

var branchKey = process.env.BRANCH_KEY;

var _ = require('../lib/underscore-min.js');
var _k = require('../class/classConstants.js');
var Utility = require('../utils/utility.js');
var Analytics = require('../lib/analytics.js');
var NameUtil = require('../utils/name.js');
var PhoneFormatter = require('../lib/PhoneFormat.js');

//------------------------------------------------------------------------------
// Public
//------------------------------------------------------------------------------

//------------------------------------------------------------------------------
// function: sendSmsInvite
//
// @params request -
//------------------------------------------------------------------------------
Parse.Cloud.define("sendSmsInvite", function(request, status) {
  // Set up to modify user data
  Parse.Cloud.useMasterKey();

  var fromUser = request.user;
  var phoneNumbers = request.params.phoneNumber; // This is an array of phone numbers
  var message = request.params.message;
  var flareId = request.params.flareId;
  var group = request.params.group;
  var stage = request.params.stage;
  var tags = request.params.tags;

  addGroupInviteData(group, phoneNumbers, fromUser).then(function() {
    return _this.sendInvite("sms", phoneNumbers, fromUser, flareId, group, stage, tags, message);
  }).then(function() {
    status.success("Sent SMS invite to " + phoneNumbers.length + " phone numbers.");
  }, function(error) {
    console.log("Error in sendSmsInvite *");
    status.error(error);
  });
});

//------------------------------------------------------------------------------
// function: 'Activity' Table - AfterSave
//
// @params request -
//------------------------------------------------------------------------------
exports.sendMentionInvite = function(phoneNumbers, fromUser, flareObject)
{
  return _this.sendInvite("@mention sms", phoneNumbers, fromUser, flareObject.id);
};

//------------------------------------------------------------------------------
// function: 'Activity' Table - AfterSave
//
// @params request -
//------------------------------------------------------------------------------
exports.sendInvite = function(channel, phoneNumbers, fromUser, flareId, group, stage, tags, message)
{
  var sendEach = function(mediaUrl) {
    var promises = [];
    // Send SMS message to phone numbers not on flare
    _.each(phoneNumbers, function(phoneNumber) {
      phoneNumber = PhoneFormatter.cleanPhone(phoneNumber);
      var params = constructBranchParams(channel, stage, tags, phoneNumber, fromUser, flareId, group);
      promises.push(getTrackURLAndSendSMS(phoneNumber, fromUser, params, message, mediaUrl));
    });

    return Parse.Promise.when(promises);
  }

  if (!_.isEmpty(fromUser) && !_.isEmpty(fromUser.id)) {
    return Utility.getProfilePictureForUser(fromUser.id).then(function(imageUrl) {
      return sendEach();
    });
  }
  else {
    return sendEach();
  }
};

//------------------------------------------------------------------------------
// function: 'Activity' Table - AfterSave
//
// @params request -
//------------------------------------------------------------------------------
exports.sendActivationCode = function(phoneNumber, code, language)
{
  var promise = new Parse.Promise();
  var bodyMessage = 'Your verification code for ' + _k.appName + ' is ' + code;

  var twilioPhoneNumber = Utility.randomObjectFromArray(activeTwilioPhoneNumbers);
  var token = twilioSid + ':' + twilioToken;
  var params = {
    To: phoneNumber,
    From: twilioPhoneNumber,
    Body: bodyMessage
  }

  // Manually send twilio sms
  return Parse.Cloud.httpRequest({
    method: 'POST',
    url: 'https://'+ token + '@api.twilio.com/2010-04-01/Accounts/' + twilioSid + '/Messages.json',
    body: serialize(params)
  });
};

//------------------------------------------------------------------------------
// Private
//------------------------------------------------------------------------------
serialize = function(obj) { var str = []; for(var p in obj) if (obj.hasOwnProperty(p)) { str.push(encodeURIComponent(p) + "=" + encodeURIComponent(obj[p])); } return str.join("&"); };

//------------------------------------------------------------------------------
// function: 'Activity' Table - AfterSave
//
// @params request -
//------------------------------------------------------------------------------
var sendSms = function(phoneNumber, fromUser, trackingURL, message, mediaUrl)
{
  var promise = new Parse.Promise();

  if (_.isUndefined(phoneNumber)) {
    return promise.reject("phoneNumber is not defined");
  }

  //var bodyMessage = "Hey a couple of us just got on this app Flare. You should check it out. www.flareapp.co " + trackingURL;
  var bodyMessage = "Add me on Flare! " + trackingURL;
  var twilioPhoneNumber = Utility.randomObjectFromArray(activeTwilioPhoneNumbers);

  if (!_.isEmpty(message)) {
    bodyMessage = message + " " + trackingURL;
  } else if (!_.isUndefined(trackingURL) && !_.isUndefined(fromUser)) {
    //bodyMessage = "Hey, are you using Flare yet? Follow me " + NameUtil.getMentionName(fromUser.get('fullName')) + ". " + trackingURL;
    //bodyMessage = "Add me on Flare! Username: " + NameUtil.getMentionName(fromUser.get('fullName')) + " " + trackingURL;
    bodyMessage = "Psst...You gotta see my secret group. Add me: " + fromUser.get('fullName') + ". " + trackingURL + " \u231b";
  }

  var token = twilioSid + ':' + twilioToken;
  var params = {
    To: phoneNumber,
    From: twilioPhoneNumber,
    Body: bodyMessage
  }

  //Only add embedded media if received from previous promise, and payload is valid
  if (!_.isEmpty(mediaUrl)) {
    params['MediaUrl'] = mediaUrl;
  }

  // Request a deep link URL from Branch Metrics
  return Parse.Cloud.httpRequest({
    method: 'POST',
    url: 'https://'+ token + '@api.twilio.com/2010-04-01/Accounts/' + twilioSid + '/Messages.json',
    body: serialize(params)
  }).then(function(httpResponse) {
    console.log("^^^^^^^^^ send SMS: json.url: " + JSON.stringify(httpResponse) + ", phoneNumber: " + phoneNumber + ", fromUser.get(fullName): " + fromUser.get('fullName'));
    promise.resolve(httpResponse);
  }, function(httpResponse) {
    console.error('^^^^^^^^^^ send SMS: getTrackURLAndSendSMS: Request failed with response code ' + JSON.stringify(httpResponse));

    //Failure, probably due to with retreiving media. Fallback to normal send
    var sendSmsSuccess = sendSmsFallback(phoneNumber, twilioPhoneNumber, bodyMessage);
    if (!sendSmsSuccess) {
      promise.reject(httpResponse);
    }
  });

  return promise;
};

/**
* Send SMS when Parse-Twilio send fails
* (like when their cert expires: https://developers.facebook.com/bugs/1696266953962575/)
* @param phonenumber       string Destination phone number as a string (including country code, etc)
* @param twilioPhoneNumber string Phone number of sender (twilio phone numbers)
* @param bodyMessage       string The SMS Message to be delivered
**/
var sendSmsFallback = function(phoneNumber, twilioPhoneNumber, bodyMessage, error) {
  console.log("Attempting SMS Fallback...");
  var params = "To=" + phoneNumber + "&From=" + twilioPhoneNumber + "&Body=" + encodeURIComponent(bodyMessage);

  // HTTP Request to twilio, return Promise
  return Parse.Cloud.httpRequest({
    method: 'POST',
    url: 'https://'+ twilioSid + ':' + twilioToken + '@api.twilio.com/2010-04-01/Accounts/' + twilioSid + '/Messages.json',
    body: params
  }).then(function(httpResponse) {
    // success
    console.log("SMS Fallback success! " + httpResponse.text);
    return true;
  },function(httpResponse) {
    // error
    console.error('SMS Fallback FAILED with response code ' + httpResponse.status);
    return true;
  });
}

/**
* addGroupInviteData - add invite data for each phone number to a group
* @param group       object
* @param phoneNumber string
* @param fromUser    object
*/
var addGroupInviteData = function(group, phoneNumbers, fromUser)
{
  var promise = new Parse.Promise();

  //Special handling for group invites
  if (group && fromUser) {
    //Add invite to table
    require('cloud/class/group.js').getGroupWithId(group.groupId).then(function(g) {
      require('cloud/class/invite.js').saveForPhoneNumbers(phoneNumbers, fromUser, 'group', g).then(function(invite) {
        //return params;
        promise.resolve(group);
      });
    }, function(error) {
      promise.reject(error);
    });
  }
  else {
    promise.resolve(group);
  }

  return promise;
}

//------------------------------------------------------------------------------
// function: 'Activity' Table - AfterSave
//
// @params request -
//------------------------------------------------------------------------------
var constructBranchParams = function(channel, stage, tags, phoneNumber, fromUser, flareId, group)
{
  // If client somehow sends through a null fromUser
  var fromUserId = _.isEmpty(fromUser) ? null : fromUser.id;
  var fromUserName = _.isEmpty(fromUser) ? null : fromUser.get(_k.userFullNameKey);
  var fromUserEmail = _.isEmpty(fromUser) ? null : fromUser.get(_k.userEmailKey);
  var fromUserPhoneNumber = _.isEmpty(fromUser) ? null : fromUser.get(_k.userPhoneNumberKey);

  // Dictionary of value to attach to the Branch metrics tracking URL
  var dataDict = {
    "fromUser_id": fromUserId,
    "fromUser_name": fromUserName,
    "fromUser_email": fromUserEmail,
    "fromUser_phone": fromUserPhoneNumber,
    "date": Date()
  };

  if (flareId) {
    dataDict.fromUser_postObjectId = flareId;
  }

  if (phoneNumber) {
    dataDict.toUser_phone = phoneNumber;
  }

  if (group) {
    dataDict.fromGroup_id = group.groupId;
    dataDict.fromGroup_name = group.groupName;
  }

  // Create the final parameters that will be attached to the branch link
  var params = {
    "branch_key": branchKey,
    "identity": fromUserId,
    "channel": channel,
    "data": dataDict
  };

  if (group) {
    params.feature = 'group invite';
  } else {
    params.feature = 'invite';
  }

  if(stage) {
    params.stage = stage;
  }

  if (tags) {
    params.tags = tags;
  }

  return params;
};

//------------------------------------------------------------------------------
// function: 'Activity' Table - AfterSave
//
// @params request -
//------------------------------------------------------------------------------
var getTrackURLAndSendSMS = function(phoneNumber, fromUser, params, message, mediaUrl)
{
  if (_.isEmpty(fromUser) || _.isEmpty(phoneNumber)) {
    return;
  }

  var promise = new Parse.Promise();
  console.log("Branch parameters: " + JSON.stringify(params));
  // Request a deep link URL from Branch Metrics
  return Parse.Cloud.httpRequest({
    method: 'POST',
    url: 'https://api.branch.io/v1/url',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(params)
  }).then(function(httpResponse) {
    json_result = JSON.parse(httpResponse.text);
    console.log("json.url: " + json_result.url + ", phoneNumber: " + phoneNumber + ", fromUser.get(fullName): " + fromUser.get('fullName'));
    // Save an event to the analtyics platform to track invites
    // Analytics.sendReferralEvent(fromUser, json_result.url, params.data);

    // Send the SMS invite to download the app
    return sendSms(phoneNumber, fromUser, json_result.url, message, mediaUrl);
  }).then(function() {
    promise.resolve();
  },function(httpResponse) {
    console.log("Error getting Branch link: json.url: " + json_result.url + ", phoneNumber: " + phoneNumber + ", fromUser.get(fullName): " + fromUser.get('fullName'));
    promise.reject();
  });
};
