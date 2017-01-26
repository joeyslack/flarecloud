var _this = this;
var _k = require('../class/classConstants.js');

//------------------------------------------------------------------------------
// Public 
//------------------------------------------------------------------------------

//------------------------------------------------------------------------------
// function: getBlockedUsers
//
// @params requestUser -
//------------------------------------------------------------------------------
exports.getBlockedUsers = function(requestUser, activeFriends) 
{
  var promise = new Parse.Promise();
 
  var usersQuery = blockedUsersQuery(requestUser);
  
  usersQuery.find().then(function(blockedUsers) {
    promise.resolve(blockedUsers, activeFriends); 
  }, function(error) {
    console.log("Error: getBlockedUsers: " + error.message);
    promise.reject(error);
  });
  
  return promise;
};

//------------------------------------------------------------------------------
// function: blocked - ThisUserActivtyQuery (Return query for the activity table)
//
// @params requestUser - Return activity that blocks the current user
//------------------------------------------------------------------------------
exports.blockThisUserActivityQuery = function(requestUser)
{
  var Activity = Parse.Object.extend(_k.activityTableName);
  var activityQuery = new Parse.Query(Activity);
  activityQuery.include(_k.activityToUserKey);

  activityQuery.equalTo(_k.activityToUserKey, requestUser);
  activityQuery.equalTo(_k.activityTypeKey, _k.activityTypeBlock);
  activityQuery.limit(1000);

  return activityQuery;
};

//------------------------------------------------------------------------------
// function: blocked - usersActivtyQuery (Return query for the activity table)
//
// @params requesUser - return activity that this users blocks another user
//------------------------------------------------------------------------------
exports.thisUserBlockActivityQuery = function(requestUser) 
{
  var Activity = Parse.Object.extend(_k.activityTableName);
  var activityQuery = new Parse.Query(Activity);
  activityQuery.include(_k.activityFromUserKey);

  activityQuery.equalTo(_k.activityFromUserKey, requestUser);
  activityQuery.equalTo(_k.activityTypeKey, _k.activityTypeBlock);
  activityQuery.limit(1000);
 
  return activityQuery;
};

//------------------------------------------------------------------------------
// Private - Queries
//------------------------------------------------------------------------------

//------------------------------------------------------------------------------
// function: blocked - usersQuery
//
// @params requesUser
//------------------------------------------------------------------------------
function blockedUsersQuery(requestUser) 
{
  var activityQuery = this.exports.thisUserBlockActivityQuery(requestUser);

  var userQuery = new Parse.Query(Parse.User);
  userQuery.matchesKeyInQuery(_k.classObjectId, _k.activityToUserIdStringKey, activityQuery);

  return userQuery;
}
