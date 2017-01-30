var _ = require('../lib/underscore-min.js');
var _k = require('../class/classConstants.js');
var ActivityClass = require('../class/activity.js');
var UserClass = require('../class/user.js');
var Push = require('../utils/push.js');

//------------------------------------------------------------------------------
// Local Defines 
//------------------------------------------------------------------------------

//------------------------------------------------------------------------------
// CLoud Code Functions 
//------------------------------------------------------------------------------

//------------------------------------------------------------------------------
// function: acceptFollowRequest
//
// @params request -
// @params response - 
//------------------------------------------------------------------------------
Parse.Cloud.define("acceptFollowRequest", function(request,response) {
  var currentUser = request.user;
  var fromUser = request.params[_k.fromUserId];

  // Increment views count for Flare
  getFollowRequests([fromUser], currentUser).then(function(activities) {
    var promises = [];

    // Save a following activity for each follow request that was accepted by the current user
    _.each(activities, function(activity){
      promises.push(ActivityClass.followUser(activity.get(_k.activityFromUserKey), currentUser));
    });

    return Parse.Promise.when(promises);
  }).then(function() {
    return deleteFollowRequests([fromUser], currentUser);
  }).then(function(fromUsersIds) {
    return UserClass.getUsersWithIds(fromUsersIds);
  }).then(function(users) {
    // Send follow request accepted push notification to the users who sen the follow request
    Push.send(_k.pushPayloadActivityTypeFollowRequestAccepted, users, currentUser);
    response.success(users);
  }, function(error) {
    console.log("acceptFollowRequest Error: " + error.message);
    response.error(error);
  });
  
});

//------------------------------------------------------------------------------
// function: declineFollowRequest
//
// @params request -
// @params response - 
//------------------------------------------------------------------------------
Parse.Cloud.define("declineFollowRequest", function(request,response) {
  var currentUser = request.user;
  var fromUser = request.params[_k.fromUserId];
  
  // Increment views count for Flare
  deleteFollowRequests([fromUser], currentUser).then(function(fromUsersIds) {
    return UserClass.getUsersWithIds(fromUsersIds);
  }).then(function(users) {
    response.success(users);
  }, function(error) {
    console.log("declineFollowRequest Error: " + error.message);
    response.error(error);
  });
  
});

//------------------------------------------------------------------------------
// Private
//------------------------------------------------------------------------------


//------------------------------------------------------------------------------
// function: deleteFollowRequestFromUsers
//
// @params requestUser
//------------------------------------------------------------------------------
var deleteFollowRequests = function(fromUsers, toUser) 
{    
  var promise = new Parse.Promise();

  if (_.isUndefined(fromUsers) || !fromUsers.length ) {
    return Parse.Promise.as("Empty or invalid from user array");
  }

  getFollowRequests(fromUsers, toUser).then(function(activities) {
    var promises = [];

    _.each(activities, function(activity){
      console.log(" Delete: follow request activity: " + activity.get(_k.activityFromUserIdStringKey) + " type: " + activity.get(_k.activityTypeKey));
      promises.push(activity.destroy({useMasterKey: true}));
    });

    return Parse.Promise.when(promises);
  }).then(function(){
    promise.resolve(fromUsers);
  },function(error) {
    promise.reject(error);
  });

  return promise;
};

//------------------------------------------------------------------------------
// function: deleteFollowRequestFromUsers
//
// @params requestUser
//------------------------------------------------------------------------------
var getFollowRequests = function(fromUsers, toUser) 
{
  var promise = new Parse.Promise();

  if (_.isUndefined(fromUsers) || !fromUsers.length ) {
    return Parse.Promise.as("Empty or invalid from user array");
  }

  var followReqQuery = followRequestActivityQuery(fromUsers, toUser); 

  followReqQuery.find({useMasterKey: true}).then(function(activities) {
    promise.resolve(activities);
  },function(error) {
    promise.reject(error);
  });

  return promise;
};

//------------------------------------------------------------------------------
// function: forUserQuery
//
// @params requestUser
//------------------------------------------------------------------------------
var followRequestActivityQuery = function(fromUsers, toUser) {

  var Activity = Parse.Object.extend(_k.activityTableName);
  var activityQuery = new Parse.Query(Activity);

  activityQuery.containedIn(_k.activityFromUserIdStringKey, fromUsers); 
  activityQuery.equalTo(_k.activityToUserKey, toUser);
  activityQuery.equalTo(_k.activityTypeKey, _k.activityTypeFollowRequest);
  activityQuery.include(_k.activityFromUserKey);
  activityQuery.limit(1000);

  return activityQuery;
};

