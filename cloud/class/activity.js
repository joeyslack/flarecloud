var _ = require('../lib/underscore-min.js');
var _k = require('../class/classConstants.js');
var Sms = require('../utils/sms.js');
var PhoneFormatter = require('../lib/PhoneFormat.js');
var Push = require('../utils/push.js');
var InviteClass = require('../class/invite.js');
var Follower = require('../api/follower.js');
var GroupMembership = require('../class/groupMembership.js');
var Utility = require('../utils/utility.js');
var Block = require('../api/block.js');

// Override jobs for now
// Parse.Cloud.job = function() {
//   return true;
// }

//------------------------------------------------------------------------------
// Local 
//------------------------------------------------------------------------------
var processNewActivityFunctions = [
  processComment,
  processNewUserStory,
  processNewGroupStory,
  processFollowOrFollowRequest
];

var afterSaveActivityProcessTypes = [
  _k.activityTypeComment,
  _k.activityTypeNewStory,
  _k.activityTypeNewGroupStory,
  _k.activityTypeFollow,
  _k.activityTypeFollowRequest
];

//------------------------------------------------------------------------------
// Cloud Code
//------------------------------------------------------------------------------

//------------------------------------------------------------------------------
// function: 'Activity' Table - AfterSave 
//
// @params request -
//------------------------------------------------------------------------------
//Parse.Cloud.beforeSave('Activity', function(request) {
//  
//  var activityType = request.object.get(_k.activityTypeKey);
//  var isCaption = request.object.get(_k.activityIsFlareCreationKey);
//
//  if (isCaption && activityType === _k.activityTypeComment) {
//      
//  }
//});

//------------------------------------------------------------------------------
// function: 'Activity' Table - AfterSave 
//
// @params request -
//------------------------------------------------------------------------------
Parse.Cloud.afterSave('Activity', function(request) {
  var activityType = request.object.get(_k.activityTypeKey);

  if (_.indexOf(afterSaveActivityProcessTypes, activityType) !== -1) {
    // afterSave (and beforeSave) only have 3 seconds to run
    // For any long running process call a background job which is allowed 15 mins
    // of runtime
    //runCloud("jobs", "afterSaveActivityObject", request);
    afterSaveActivityObject(request);
  }
});

//------------------------------------------------------------------------------
// function: 'Activity' Table - BeforeSave 
//
// @params request - the request payload from the caller
// @params response - response to send to the caller
//------------------------------------------------------------------------------
Parse.Cloud.job('afterSaveActivityObject', function(request, status) {
  processNewActivity(request).then(function(){
    status.success("Process afterSaveActivityObject succeeded");
  },function(error){
    status.error("Process afterSaveActivityObject error: " + error.message);
  }); 
});

//------------------------------------------------------------------------------
// Public 
//------------------------------------------------------------------------------

//------------------------------------------------------------------------------
// function: followUser 
//
// @params request -
//------------------------------------------------------------------------------
exports.followUser = function(fromUser, toUser) 
{ 
  var promise = new Parse.Promise();

  if (_.isUndefined(fromUser) || _.isNull(fromUser) || _.isUndefined(toUser) || _.isNull(toUser)) {
    return Parse.Promise.as("Invalid inputs fromUser: " + fromUser + " toUser: " + toUser);
  }

  // Query for any invite for the new user, based on the phone number supplied 
  var ActivityClass = Parse.Object.extend(_k.activityTableName);
  var followQuery = new Parse.Query(ActivityClass);

  followQuery.equalTo(_k.activityFromUserKey, fromUser);
  followQuery.equalTo(_k.activityToUserKey, toUser);
  followQuery.equalTo(_k.activityTypeKey, _k.activityTypeFollow);

  // Make sure there is only one follow activity fromUser --> toUser
  followQuery.first({useMasterKey: true}).then(function(object) {
    if (_.isUndefined(object)) {
      return saveActivity(_k.activityTypeFollow, fromUser, toUser); 
    } else {
      //console.log("user: " + toUser.id + " is already following: " + fromUser.id); 
      return Parse.Promise.as();
    }
  }).then(function(){
    promise.resolve();
  }, function(error) {
    saveActivity(_k.activityTypeFollow, fromUser, toUser).then(function(){
      promise.resolve();
    },function(error) {
      promise.reject();
    }); 
  });

  return promise;
};

//------------------------------------------------------------------------------
// function: itemForCounter
//
// Add or incremnt the activity table with the new action (i.e. views, hearts) 
//
// @params field - field to increment (views, hearts)
// @params request - request from client, which includes the user info
//------------------------------------------------------------------------------
exports.itemForCounter = function(field, flare, toUser, fromUser) 
{
  var promise = new Parse.Promise();
  var newActivity = false;

  var Activity = Parse.Object.extend(_k.activityTableName);
  var activityQuery = new Parse.Query(Activity);
  activityQuery.equalTo(_k.activityFlareKey, flare);
  activityQuery.equalTo(_k.activityFromUserKey, fromUser);
  activityQuery.equalTo(_k.activityToUserKey, toUser);
  activityQuery.equalTo(_k.activityTypeKey, field);
  activityQuery.limit(1000);

  activityQuery.find({useMasterKey: true}).then(function(objects) {

    // Update the object if it exists
    if (objects.length > 0) {
      var incrementPromises = [];

      _.each(objects, function (object) {
          object.increment(_k.activityCountKey);
          incrementPromises.push(object.save(null, {useMasterKey: true}));
      });

      return Parse.Promise.when(incrementPromises);
    } else {
      newActivity = true;
      return addActivityWithCounterField(field, flare, toUser, fromUser);
    }
  }).then(function() {
    promise.resolve(newActivity);
  }, function(error) {
    //console.log(" activity.itemForCounter: error: " + error.message);
    promise.reject(error);
  });

  return promise;
};

//------------------------------------------------------------------------------
// function: saveNewUserStory - activity 
//
// @params request -
//------------------------------------------------------------------------------
exports.saveNewUserStory = function(author, post) 
{
  return Parse.Promise.when(saveActivity(_k.activityTypeNewStory, author, author, post)); 
};

//------------------------------------------------------------------------------
// function: saveNewUserStory - activity 
//
// @params request -
//------------------------------------------------------------------------------
exports.saveNewGroupStory = function(author, post) 
{ 
  return Parse.Promise.when(saveActivity(_k.activityTypeNewGroupStory, author, author, post)); 
};

//------------------------------------------------------------------------------
// Private
//------------------------------------------------------------------------------

//------------------------------------------------------------------------------
// function: runJobAfterSaveActivityObject 
//
// @params request - the request payload from the caller
//------------------------------------------------------------------------------
function afterSaveActivityObject(request) {
  Parse.Cloud.httpRequest({
    url: process.env.SERVER_URL + "/jobs/afterSaveActivityObject",
    method: "POST",
    headers: {
      'Content-Type': 'application/json',
      'X-Parse-Application-Id': Parse.applicationId,
      'X-Parse-Master-Key': Parse.masterKey,
    },
    body: {
      "request": request,
    }
  }).then(function(httpResponse) {
    console.log(" runJobAfterSaveActivityObject succeeded: " + httpResponse.text);
  }, function(httpResponse) {
    console.log(" runJobAfterSaveActivityObject: Request failed with response code " + httpResponse.status);
  });
}

function runCloud(cloudType, cloudFunction, request) {
  cloudType = cloudType == "jobs" ? "jobs" : "functions";

  Parse.Cloud.httpRequest({
    url: process.env.SERVER_URL + "/" + cloudType + "/" + cloudFunction,
    method: "POST",
    headers: {
      'Content-Type': 'application/json',
      'X-Parse-Application-Id': Parse.applicationId,
      'X-Parse-Master-Key': Parse.masterKey,
    },
    body: {
      "request": request
    }
  }).then(function(httpResponse) {
    console.log("~runCloud succeeded: " + httpResponse.text);
  }, function(httpResponse) {
    console.log("~runCloud: Request failed with response code " + httpResponse.status);
  });
}  

//------------------------------------------------------------------------------
// function: processNewActivity
//
// @params requestUser - the User who saved the activity object
// @params activityObject - Activity object
//------------------------------------------------------------------------------
function processNewActivity(payload) 
{
  if (_.isUndefined(payload)) {
    return Parse.Promise.error();
  }

  var promise = new Parse.Promise();
  var requestUser;
  var requestUserId = payload.params.request.object[_k.activityFromUserIdStringKey];
  var userQuery = new Parse.Query(Parse.User);
  var activityId = payload.params.request.object[_k.classObjectId];
  var Activity = Parse.Object.extend(_k.activityTableName);
  var activityQuery = new Parse.Query(Activity);

  // Hydrate the parse user object
  userQuery.get(requestUserId, {useMasterKey: true}).then(function(user) {
    requestUser = user;
  }).then(function() {
    // Get related activity item
    return activityQuery.get(activityId, {useMasterKey: true});
  }).then(function(activityObject) {
    // Check activity types & execute a group of defined functions
    if (typeof activityObject != "undefined" && activityObject) {
      var activityCreatedAt = activityObject.get(_k.classCreatedAt, {useMasterKey: true});
      var activityType = activityObject.get(_k.activityTypeKey, {useMasterKey: true});
      var promises = [];

      _.each(processNewActivityFunctions, function(fnc) {
        promises.push(fnc(requestUser, activityType, activityObject, activityCreatedAt));
      });

      return Parse.Promise.when(promises);
    }
    else {
      return;
    }
  }).then(function(success) {
    promise.resolve("activity processed");
  }, function(error) {
    promise.reject(error);
  });

  return promise;
}

//------------------------------------------------------------------------------
// function: processNewUserStory 
//
// @params requestUser - the User who saved the activity object
// @params activityObject - Activity object
//------------------------------------------------------------------------------
function processNewUserStory (requestUser, type, activityObject, date) 
{
  if (type !== _k.activityTypeNewStory || _.isUndefined(requestUser) || _.isUndefined(activityObject)) {
    return Parse.Promise.as();
  }

  var promise = new Parse.Promise();
  var requestUsersFollowers = [];
  
  Follower.getFollowersExcludeUsersWhoBlockMeAndWhoIBlock(requestUser).then(function(followers) {
    requestUsersFollowers = followers;
    var post = activityObject.get(_k.activityFlareKey, {useMasterKey: true});
    
    return post.fetch();
  }).then(function(postObject) {
    group = postObject.get(_k.flareGroupKey, {useMasterKey: true});

    if (_.isUndefined(group) || group.length === 0) {
      return Push.send(_k.pushPayloadActivityTypeNewUserStory, requestUsersFollowers, requestUser, postObject);
    } else {
      return;
    }
  }).then(function(){
    promise.resolve();
  },function(error) {
    promise.reject();
  });

  return promise;
}

//------------------------------------------------------------------------------
// function: processNewGroupStory 
//
// @params requestUser - the User who saved the activity object
// @params activityObject - Activity object
//------------------------------------------------------------------------------
function processNewGroupStory (requestUser, type, activityObject, date) 
{
  if (type !== _k.activityTypeNewGroupStory || _.isUndefined(requestUser) || _.isUndefined(activityObject)) {
    return Parse.Promise.as();
  }

  var promise = new Parse.Promise();

  var postObject = activityObject.get(_k.activityFlareKey, {useMasterKey: true});
  
  var Flare = Parse.Object.extend(_k.flareTableName);
  var postQuery = new Parse.Query(Flare);

  postQuery.equalTo(_k.classObjectId, postObject.id);
  postQuery.include(_k.flareGroupKey); //include the group object
  
  postQuery.first({useMasterKey: true}).then(function(post) {
    var group = !_.isUndefined(post) ? post.get(_k.flareGroupKey, {useMasterKey: true}) : undefined;
    if (!_.isUndefined(group)){ 
      return GroupMembership.sendNotificationToGroup(_k.pushPayloadActivityTypeNewGroupStory, group, post, requestUser);
    } else {
      return Parse.Promise.as();
    }
  }).then(function(){
    promise.resolve();
  },function(error) {
    promise.reject();
  });

  return promise;
}

//------------------------------------------------------------------------------
// function: processFollow 
//
// @params requestUser - the User who saved the activity object
// @params activityObject - Activity object
//------------------------------------------------------------------------------
function processFollowOrFollowRequest (requestUser, type, activityObject, date) 
{
  if ((type !== _k.activityTypeFollow && type !== _k.activityTypeFollowRequest) || _.isUndefined(requestUser) || _.isUndefined(activityObject)) {
    return Parse.Promise.as();
  }
  
  var promise = new Parse.Promise();
  var toUser = activityObject.get(_k.activityToUserKey, {useMasterKey: true});

  // Check for blocking
  Block.thisUserBlockActivityQuery(toUser).find({useMasterKey: true}).then(function(blockedList) {
    // If block list is found for target follow, see if it matches the request user's id
    if (blockedList) {
      return _.find(blockedList, function(item) {
        return item.get(_k.activityToUserIdStringKey, {useMasterKey: true}) == requestUser.id;
      });
    }

    return true;
  }).then(function(blocked) {
    // if the user is blocked, don't send sms
    if (!blocked) {
      var pushType = (type === _k.activityTypeFollow) ? _k.pushPayloadActivityTypeFollow : _k.pushPayloadActivityTypeFollowRequest;
      return Push.send(pushType, [toUser], requestUser);
    }
    promise.resolve();
  }, function(error) {
    promise.reject(error);
  });

  return promise;
}

//------------------------------------------------------------------------------
// function: processComment 
//
// @params requestUser - the User who saved the activity object
// @params activityObject - Activity object
//------------------------------------------------------------------------------
function processComment (requestUser, type, activityObject, date) 
{
  if (type !== _k.activityTypeComment || _.isUndefined(requestUser) || _.isUndefined(activityObject)) {
    return Parse.Promise.as();
  }

  var promise = new Parse.Promise();
  
  var post = activityObject.get(_k.activityFlareKey, {useMasterKey: true});
  var mentionedUsers= [];
  var toUsers = [];

  //console.log("!!!!!!!!!!!!!!! requestUser: " + requestUser.get(_k.userFullNameKey) + " type: " + type + " activityObject " + activityObject.get(_k.activityTypeKey));
  processMentionedPhoneNumbers(requestUser, type, activityObject).then(function(users) {
    mentionedUsers = users;
    var commentActivityQuery = otherCommentActivityForPostQuery(requestUser, post);

    return commentActivityQuery.find({useMasterKey: true});
  }).then(function(commentActivities) {

    // Only send comment push notificaiton to comment authors that have not been mentioned
    _.each(commentActivities, function(activity) {
      var commentAuthor =  activity.get(_k.activityFromUserKey, {useMasterKey: true});
      var isCommentAuthorInToUsers = _.findWhere(toUsers, {id: commentAuthor.id});
      var isCommentAuthorInMentionedUsers = _.findWhere(mentionedUsers, {id: commentAuthor.id});

      if (_.isUndefined(isCommentAuthorInToUsers) && _.isUndefined(isCommentAuthorInMentionedUsers)) {
        toUsers.push(commentAuthor);
      }
    });

    return post.fetch({useMasterKey: true});
  }).then(function(postObject){
    var comment = activityObject.get(_k.activityContentKey, {useMasterKey: true});
    var postAuthor = postObject.get(_k.flareUserKey, {useMasterKey: true});
    var isPostAuthorInToUsers = _.findWhere(toUsers, {id: postAuthor.id});

    if (_.isUndefined(isPostAuthorInToUsers) && requestUser.id !== postAuthor.id) {
      toUsers.push(postAuthor);
    }

    return Push.send(_k.pushPayloadActivityTypeComment, toUsers, requestUser, post, null, comment);
  }).then(function(){
    promise.resolve();
  },function(error) {
    promise.reject();
  });

  return promise;
}


//------------------------------------------------------------------------------
// function: otherCommentActivityForFlareQuery
//
// @params requestUser - the User who saved the activity object
// @params post -
//------------------------------------------------------------------------------
function otherCommentActivityForPostQuery (fromUser, post) 
{
  var Activity = Parse.Object.extend(_k.activityTableName);
  var activityQuery = new Parse.Query(Activity);
  
  activityQuery.equalTo(_k.activityFlareKey, post);
  activityQuery.notEqualTo(_k.activityFromUserKey, fromUser);
  activityQuery.equalTo(_k.activityTypeKey, _k.activityTypeComment);
  activityQuery.limit(1000);

  return activityQuery;
}

//------------------------------------------------------------------------------
// function: processMentionedPhoneNumbers 
//
// @params requestUser - the User who saved the activity object
// @params activityObject - Activity object
//------------------------------------------------------------------------------
function processMentionedPhoneNumbers (requestUser, type, activityObject) 
{
  if (type !== _k.activityTypeComment || _.isUndefined(activityObject) || _.isUndefined(requestUser)) {
    return Parse.Promise.as();
  }

  var promise = new Parse.Promise();

  var phoneNumbers = activityObject.get(_k.activityToUserPhoneNumberKey, {useMasterKey: true});
  var fromUser = requestUser;
  var flare = activityObject.get(_k.activityFlareKey, {useMasterKey: true});
  var content = activityObject.get(_k.activityContentKey, {useMasterKey: true});

  // Only process @mention for comments/captions on Flare objects
  if (_.isUndefined(phoneNumbers) || _.isUndefined(fromUser)) {
    return Parse.Promise.as();  
  }

  // format the phone number
  var formattedPhoneNumbers = [];
  _.each(phoneNumbers, function(phoneNumber){  
    //console.log("Incoming Phone Number: " + phoneNumber);
    formattedPhoneNumbers.push(PhoneFormatter.formatLocal("US", phoneNumber));
  });

  //Find the user  with the phone numbers registered with the app
  var formattedPhoneUserQuery = new Parse.Query(Parse.User);
  formattedPhoneUserQuery.containedIn(_k.userDeprecatedPhoneNumberKey, formattedPhoneNumbers);
  
  var normalizedPhoneNumbers = [];
  _.each(phoneNumbers, function(phoneNumber){  
    //console.log("Incoming Phone Number: " + phoneNumber);
    normalizedPhoneNumbers.push(PhoneFormatter.cleanPhone(phoneNumber));
  });

  var normalizedPhoneUserQuery = new Parse.Query(Parse.User);
  normalizedPhoneUserQuery.containedIn(_k.userPhoneNumberKey, normalizedPhoneNumbers);
 
  var userQuery = Parse.Query.or(formattedPhoneUserQuery, normalizedPhoneUserQuery);

  var filteredPhoneNumbers = [];
  var toUsers = [];

  userQuery.find({useMasterKey: true}).then(function(users) {
    toUsers = users;
    return saveMentionActivity(content, flare, phoneNumbers, toUsers, fromUser);
  }).then(function(phoneNumbersWithNoActiveUser) {
    filteredPhoneNumbers = phoneNumbersWithNoActiveUser;
    // Send the push notificaiton to the users with account
    return Push.send(_k.pushPayloadActivityTypeMention, toUsers, fromUser, flare);
  }).then(function() {
    // Save an invite into the activity table to allow auto-follow when a new users signs up
    return InviteClass.saveForPhoneNumbers(filteredPhoneNumbers, fromUser, _k.inviteChannelMention);
  }).then(function(){
    // Send SMS to phone numbers NOT found on flare
    return Sms.sendMentionInvite(filteredPhoneNumbers, fromUser, flare);
  }).then(function(){  
    promise.resolve(toUsers);
  }, function(error) {
    // Save an invite into the activity table to allow auto-follow when a new users signs up
    InviteClass.saveForPhoneNumbers(phoneNumbers, fromUser, _k.invitieChannelMention).then(function(){
      // Send SMS to phone numbers NOT found on flare
      return Sms.sendMentionInvite(phoneNumbers, fromUser, flare);
    }).then(function() {  
      promise.resolve();
    }, function(error) {
      promise.reject();
    });
  });

  return promise;
}

//------------------------------------------------------------------------------
// function: processMentionReceipt 
//
// @params flare - the User who saved the activity object
// @params toUser - to user
//------------------------------------------------------------------------------
function processMentionReceipt(flare, userWhoViewed) 
{
  if (_.isUndefined(flare) || _.isUndefined(userWhoViewed)) {
    return Parse.Promise.as();
  }

  var promise = new Parse.Promise();
      
  var Activity = Parse.Object.extend(_k.activityTableName);
  var activityQuery = new Parse.Query(Activity);
  activityQuery.equalTo(_k.activityFlareKey, flare);
  activityQuery.equalTo(_k.activityToUserKey, userWhoViewed);
  activityQuery.equalTo(_k.activityTypeKey, _k.activityTypeMention);
  activityQuery.include(_k.activityFromUserKey);
  activityQuery.limit(1000);
  
  activityQuery.find({useMasterKey: true}).then(function(objects) {

    // Update the object if it exists
    if (objects.length > 0) {

      var mentionCreators = [];
      _.each(objects, function (object) {
          var mentionAuthor = object.get(_k.activityFromUserKey, {useMasterKey: true});
          //console.log("processMentionReceipt: mentionCreator: " + mentionAuthor.get(_k.userFullNameKey));
          mentionCreators.push(mentionAuthor);
      });

      return Push.send(_k.pushPayloadActivityTypeViewedMentionReceipt, mentionCreators, userWhoViewed, flare);
    } else {
      return;
    }
  }).then(function() {
    promise.resolve();
  }, function(error) {
    console.log("processMentionReceipt: error: " + error.message);
    promise.reject(error);
  });


  return promise;
}

//------------------------------------------------------------------------------
// function: saveMentionActivity
//
// @params field - field to increment (views, hearts)
// @params request - request from client, which includes the user info
//------------------------------------------------------------------------------
function saveMentionActivity(content, flare, phoneNumbers, toUsers, fromUser) 
{
  var promise = new Parse.Promise();

  if (_.isUndefined(toUsers) || toUsers.length === 0) {
    return Parse.Promise.as(phoneNumbers);
  }

  var promises = [];
  var filteredPhoneNumbers = [];

  _.each(toUsers, function(toUser){ 
    // remove the phone number from the phone number list, the remaining numbers will be sent an SMS through twilio
    var formattedPhoneNumber = toUser.get(_k.userDeprecatedPhoneNumberKey, {useMasterKey: true}); 
    formattedPhoneNumber = !_.isUndefined(formattedPhoneNumber) ? formattedPhoneNumber : "";

    var normalizedPhoneNumber = toUser.get(_k.userPhoneNumberKey, {useMasterKey: true});
    normalizedPhoneNumber = !_.isUndefined(normalizedPhoneNumber) ? normalizedPhoneNumber : "";

    filteredPhoneNumbers = _.without(phoneNumbers, formattedPhoneNumber, normalizedPhoneNumber);

    promises.push(saveActivity(_k.activityTypeMention, fromUser, toUser, flare, content));
  });

  Parse.Promise.when(promises).then(function(){
    return Parse.Promise.as(filteredPhoneNumbers);
  });
}

//------------------------------------------------------------------------------
// function: addActivityWithCounter
//
// Add an activity to the activity table with the new action (i.e. views, hearts) 
//
// @params field - field to increment (views, hearts)
// @params request - request from client, which includes the user info
//------------------------------------------------------------------------------
function addActivityWithCounterField (field, flare, toUser, fromUser) 
{
  var promise = new Parse.Promise();

  var newCounterActivity;

  var Activity = Parse.Object.extend(_k.activityTableName);
  var newActivity = new Activity();
  newActivity.set(_k.activityTypeKey, field);
  newActivity.set(_k.activityFlareKey, flare);
  newActivity.set(_k.activityFromUserKey, fromUser);
  newActivity.set(_k.activityFromUserIdStringKey, fromUser.id);
  newActivity.set(_k.activityToUserKey, toUser);
  newActivity.set(_k.activityToUserIdStringKey, toUser.id);
  newActivity.set(_k.activityCountKey, 1);
  newActivity.setACL(new Parse.ACL().setPublicReadAccess(true));

  newActivity.save(null, {useMasterKey: true}).then(function(activity) {
    newCounterActivity = activity;

    // Process views in case we need to send off @mention viewed receipts
    if (field === _k.flareViewsKey) {
      return processMentionReceipt(flare, fromUser);
    } else {
      return;
    }
  }).then(function() {
    promise.resolve(newCounterActivity);
  }, function(error){
    promise.reject(error);                       
  });

  return promise;
}

//------------------------------------------------------------------------------
// function: saveActivity
//
// @params phoneNumbers - the phone numbers to either send a push notification or invite 
//------------------------------------------------------------------------------
var saveActivity = function(type, fromUser, toUser, flare, content, phoneNumber) 
{   
  var promise = new Parse.Promise();

  // Add the mention into the Activity class
  var ActivityClass = Parse.Object.extend(_k.activityTableName);
  var activity = new ActivityClass();

  if (!_.isUndefined(type)) {
    activity.set(_k.activityTypeKey, type);
  }

  if (!_.isUndefined(content)) {
    activity.set(_k.activityContentKey, content);
  }

  if (!_.isUndefined(flare)) {
    activity.set(_k.activityFlareKey, flare);
  }

  if (!_.isUndefined(fromUser)) {
    activity.set(_k.activityFromUserKey, fromUser);
    activity.set(_k.activityFromUserIdStringKey, fromUser.id);
  }

  if (!_.isUndefined(toUser)) {
    activity.set(_k.activityToUserKey, toUser);
    activity.set(_k.activityToUserIdStringKey, toUser.id);
  }

  activity.set(_k.activityIsFlareCreationKey, false);
  var activityACL = new Parse.ACL(fromUser);
  activityACL.setPublicReadAccess(true);
  activity.setACL(activityACL);

  activity.save(null, {useMasterKey: true}).then(function(){
    //console.log("fromUser: " + activity.get(_k.activityFromUserIdStringKey) + "toUser: " + activity.get(_k.activityToUserIdStringKey) + "new object created with objectId: " + activity.id);
    promise.resolve();
  },function(error){
    console.log("failed to create new object with error code: " + error.message);
    promise.reject(error);
  });

  return promise;
};
