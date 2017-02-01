var _ = require('../lib/underscore-min.js');
var _k = require('../class/classConstants.js');
var Push = require('../utils/push.js');
var DateUtil = require('../utils/date.js');
var Utility = require('../utils/utility.js');
var PhoneFormat = require('../lib/PhoneFormat.js');

// Override jobs for now
Parse.Cloud.job = function() {
  return true;
}

//------------------------------------------------------------------------------
// Cloud Code
//------------------------------------------------------------------------------


//------------------------------------------------------------------------------
// function: processNewUserSignUp 
//
// @params request - the request payload from the caller
//------------------------------------------------------------------------------
Parse.Cloud.define("processNewUserSignUp", function(request, response) {

  // afterSave (and beforeSave) only have 3 seconds to run
  // For any long running process call a background job which is allowed 15 mins
  // of runtime
  runJobNewUserObject(request);

  response.success();
});

//------------------------------------------------------------------------------
// function: 'User' Table - AfterSave 
//
// @params request - the request payload from the caller
// @params status - response to send to the caller
//------------------------------------------------------------------------------
Parse.Cloud.job('processNewUserObjectJob', function(request, status) {

  console.log("processNewUserObjectJob: " + JSON.stringify(request));

  processNewUserObject(request).then(function(){
    status.success("Process new user object succeeded");
  },function(error){
    status.error("Process new user object error: " + error.message);
  }); 
});

//------------------------------------------------------------------------------
// function:  
//
// @params request - the request payload from the caller
//------------------------------------------------------------------------------
Parse.Cloud.job("checkForExpiredPosts", function(request, status) {
  // The repeat interval in mins 
  var interval = request.params.interval;
 
  // Set the default to 60 min interval
  if (_.isUndefined(interval) || _.isNull(interval)) {
     interval = 60; //default to 60 mins
  }
   
  var currentDate = new Date();
  var currentDateWithInterval = DateUtil.subtractMinutes(currentDate, interval);
 
  // Query for all users
  var query = new Parse.Query(Parse.User);
  query.each(function(user) {
   
    // Send Push notification for expired post
    var expiresDate = user.get(_k.userFlareExpiresAtKey);
 
    if (expiresDate < currentDate && expiresDate > currentDateWithInterval) {
      Push.send(_k.pushPayloadActivityTypeExpiredStory, [user]);
 
      console.log("sent expired flare push notification to user: " + user.get(_k.userUsernameKey));
    }
 
  }).then(function() {
    status.success("Checked User's Flare Expiration successfully.");
  }, function(error){
    status.error("Error: Checked User Flare Expiration: " + error.message);
  });
 
});

//------------------------------------------------------------------------------
// function: migrateUsersLowerCaseEmail 
//
// @params request - the request payload from the caller
//------------------------------------------------------------------------------
Parse.Cloud.job("migrateUsersLowerCaseEmail", function(request, response) {
  // Query for all users
  var query = new Parse.Query(Parse.User);
  query.each(function(user) {
   
    var email = user.get(_k.userEmailKey);
    var lowerCaseEmail = _.isUndefined(email) ? undefined : email.toLowerCase();

    user.set(_k.userEmailKey, lowerCaseEmail);
    
    var username = user.get(_k.userUsernameKey);
    var lowerCaseUsername = _.isUndefined(username) ? undefined : username.toLowerCase();

    user.set(_k.userUsernameKey, lowerCaseUsername);

    console.log(" email: " + lowerCaseEmail + " username: " + lowerCaseUsername);
    return user.save(null, {useMasterKey: true});

  }).then(function() {
    response.success("Success: migrate users lower case");
  }, function(error){
    response.error("Error: migrate users lower case: " + error.message);
  });
 
});

//------------------------------------------------------------------------------
// function: migrateAllUsersPhoneNumber 
//
// @params request - the request payload from the caller
//------------------------------------------------------------------------------
Parse.Cloud.job("migrateUsersPhoneNumber", function(request, response) {
  // Query for all users
  var query = new Parse.Query(Parse.User);
  query.each(function(user) {
   
    var deprecatedPhoneNumber = user.get(_k.userDeprecatedPhoneNumberKey);
    
    console.log(" deprecatedPhoneNumber: " + deprecatedPhoneNumber);
   
    if (_.isUndefined(deprecatedPhoneNumber)) {
      return;
    }

    //deprecatedPhoneNumber = PhoneFormat.cleanPhone(deprecatedPhoneNumber);

    var newPhoneNumberField = user.get(_k.userPhoneNumberKey);
    var countryCode = user.get(_k.userCountryCodeKey);

    if (_.isUndefined(newPhoneNumberField) || _.isNull(newPhoneNumberField) || newPhoneNumberField.length === 0) {
      var normalizedPhoneNumber = PhoneFormat.formatE164("US", deprecatedPhoneNumber);

      user.set(_k.userPhoneNumberKey, normalizedPhoneNumber);
      user.set(_k.userCountryCodeKey, 1);
      
      console.log(" name: " + user.get(_k.userFullNameKey) + " new phone number: " + normalizedPhoneNumber);
      return user.save(null, {useMasterKey: true});
    }

  }).then(function() {
    response.success("Success: migrate all users phone numbers");
  }, function(error){
    reponse.error("Error: migrate all users phone numbers: " + error.message);
  });
 
});

//------------------------------------------------------------------------------
// function: deleteInvalidUsers 
//
// @params request - the request payload from the caller
//------------------------------------------------------------------------------
Parse.Cloud.job("deleteInvalidUsers", function(request, response) { 
  var currentDate = new Date();
  var currentDateWithInterval = DateUtil.subtractDays(currentDate, 1);
  
  // Query for all users
  var query = new Parse.Query(Parse.User);
  query.each(function(user) {
    var updatedAt = user.get(_k.classUpdatedAt);

    var email = user.get(_k.userEmailKey);
    var fullName = user.get(_k.userFullNameKey);
    var channel = user.get(_k.userChannelKey);

    if (updatedAt < currentDateWithInterval && _.isUndefined(email) && _.isUndefined(fullName) && _.isUndefined(channel)) {
      return user.destroy({useMasterKey: true});
    }

  }).then(function() {
    response.success("Success: migrate users lower case");
  }, function(error){
    response.error("Error: migrate users lower case: " + error.message);
  });
 
});

//------------------------------------------------------------------------------
// Public
//------------------------------------------------------------------------------

//------------------------------------------------------------------------------
// function: getUsersWithIds
//
// @params userIds - list of user ids to matach the user
//------------------------------------------------------------------------------

exports.getUsersWithIds = function(userIds) 
{
  var promise = new Parse.Promise();

  var query = new Parse.Query(Parse.User);
  query.containedIn(_k.classObjectId, userIds);

  query.find({useMasterKey: true}).then(function(users){
    promise.resolve(users);
  }, function(error) {
    promise.reject();
  });

  return promise;
};

//------------------------------------------------------------------------------
// function: getUserWithId
//
// @params userIds - list of user ids to matach the user
//------------------------------------------------------------------------------

exports.getUserWithId = function(id) 
{
  var promise = new Parse.Promise();

  var query = new Parse.Query(Parse.User);
  query.equalTo(_k.classObjectId, id);

  query.first({useMasterKey: true}).then(function(user){
    promise.resolve(user);
  }, function(error) {
    promise.reject();
  });

  return promise;
};

//------------------------------------------------------------------------------
// Private
//------------------------------------------------------------------------------

//------------------------------------------------------------------------------
// function: runJobActerSaveUserObject 
//
// @params request - the request payload from the caller
//------------------------------------------------------------------------------
function runJobNewUserObject(request)
{
  console.log(" runJobNewUserObject: " + JSON.stringify(request));
  Parse.Cloud.httpRequest({
    url: "https://api.parse.com/1/jobs/processNewUserObjectJob",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Parse-Application-Id": Parse.applicationId,
      "X-Parse-Master-Key": Parse.masterKey,
    },
    body: {
      "request": request
    },
    success: function(httpResponse) {
      console.log(" runJobNewUserObject succeeded: " + httpResponse.text);
    },
    error: function(httpResponse) {
      console.log(" runJobNewUserObject: Request failed with response code " + httpResponse.status);
    }
  });
}

//------------------------------------------------------------------------------
// function: processAfterSaveUserObject 
//
// @params request - the request payload from the caller
//------------------------------------------------------------------------------
function processNewUserObject(payload)
{
  var promise = new Parse.Promise();

  var requestUser = payload.params.user;
  var phoneNumber = _.isEmpty(payload.params.user.normalizedPhoneNumber) ? 
    PhoneFormat.formatE164("US", payload.params.user.phoneNumber) :
    payload.params.user.normalizedPhoneNumber;

  console.log("phoneNumber: " + phoneNumber);

  var Invite = require('invite.js');

  // User query
  var userQuery = new Parse.Query(Parse.User);
  userQuery.equalTo(_k.userPhoneNumberKey, phoneNumber);

  // Hydrate the parse user object
  userQuery.first({useMasterKey: true}).then(function(user) {
    //console.log("user: " + JSON.stringify(user));
    requestUser = user;
    // Search the activity table for any invite events, auto-follow those users
    return Invite.autoFollowNewUser(requestUser);
  }).then(function() {
    // Search the activity table for any invite events, auto-follow those users
    return Invite.autoFollowNewUserGroups(requestUser);
  }).then(function() {
    promise.resolve();
  }, function(error) {
    console.log("processNewUserObject Error: " + error.message);
    promise.reject(error);
  });

  return promise;
}
