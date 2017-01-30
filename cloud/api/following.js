var _this = this;
var _k = require('../class/classConstants.js');
var Block = require('../api/block.js');
var Utility = require('../utils/utility.js');

//------------------------------------------------------------------------------
// Public
//------------------------------------------------------------------------------

//------------------------------------------------------------------------------
// function: getFollowingUsers
//
// @params requestUser
//------------------------------------------------------------------------------
exports.getFollowingUsers = function(requestUser) {

  var promise = new Parse.Promise();

  var followingUsersQuery = _this.usersQuery(requestUser);

  followingUsersQuery.find().then(function(followingUsers) {
    promise.resolve(followingUsers);
  },function(error) {
    promise.reject(error);
  });

  return promise;
};

//------------------------------------------------------------------------------
// function: getFollowingAndBlockedUsers
//
// @params requestUser
//------------------------------------------------------------------------------
exports.getFollowingExcludeUsersWhoIBlock = function(requestUser) {

  var promise = new Parse.Promise();

  var followingUsersQuery = _this.usersQuery(requestUser);

  // Exclude Users who have blocked this user
  var blockedQuery = Block.thisUserBlockActivityQuery(requestUser);
  followingUsersQuery.doesNotMatchKeyInQuery(_k.classObjectId, _k.activityToUserIdStringKey, blockedQuery);

  followingUsersQuery.find().then(function(followingUsers) {
    promise.resolve(followingUsers);
  },function(error) {
    promise.reject(error);
  });

  return promise;
};

//------------------------------------------------------------------------------
// function: getFollowingExcludeUsersWhoBlockMe
//
// @params requestUser
//------------------------------------------------------------------------------
exports.getFollowingExcludeUsersWhoBlockMe = function(requestUser) {

  var promise = new Parse.Promise();

  var followingUsersQuery = _this.usersQuery(requestUser);

  // Exclude Users who have blocked this user
  var blockedQuery = Block.blockThisUserActivityQuery(requestUser);
  followingUsersQuery.doesNotMatchKeyInQuery(_k.classObjectId, _k.activityFromUserIdStringKey, blockedQuery);

  followingUsersQuery.find().then(function(followingUsers) {
    promise.resolve(followingUsers);
  },function(error) {
    promise.reject(error);
  });

  return promise;
};

//------------------------------------------------------------------------------
// function: getFollowingExcludeUsersWhoBlockMe
//
// @params requestUser
//------------------------------------------------------------------------------
exports.getFollowingExcludeUsersWhoBlockMeAndWhoIBlock = function(requestUser) {

  var promise = new Parse.Promise();

  var usersFollowingMeWhoDoNotBlockMe;

  var followingUsersQuery = _this.usersQuery(requestUser);
  // Exclude Users who have blocked this user
  var blockedQuery = Block.blockThisUserActivityQuery(requestUser);
  followingUsersQuery.doesNotMatchKeyInQuery(_k.classObjectId, _k.activityFromUserIdStringKey, blockedQuery);

  followingUsersQuery.find().then(function(followingUsersWhoDoNotBlockMe) {
    usersFollowingMeWhoDoNotBlockMe = followingUsersWhoDoNotBlockMe;

    var usersFollowingMeWhoIBlockQuery = _this.usersQuery(requestUser);

   // Exclude Users who have blocked this user
   var whoIblockedQuery = Block.thisUserBlockActivityQuery(requestUser);
   usersFollowingMeWhoIBlockQuery.doesNotMatchKeyInQuery(_k.classObjectId, _k.activityToUserIdStringKey, whoIblockedQuery);

   return usersFollowingMeWhoIBlockQuery.find();
  }).then(function(usersFollowingMeWhoIBlock) {
    var followingUsers = Utility.collectionIntersection(usersFollowingMeWhoIBlock, usersFollowingMeWhoDoNotBlockMe);
    promise.resolve(followingUsers);
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
exports.usersQuery = function(requestUser) {

  var Activity = Parse.Object.extend(_k.activityTableName);
  var activityQuery = new Parse.Query(Activity);

  activityQuery.equalTo(_k.activityFromUserKey, requestUser);
  activityQuery.equalTo(_k.activityTypeKey, _k.activityTypeFollow);
  activityQuery.limit(1000);

  var userQuery = new Parse.Query(Parse.User);
  userQuery.matchesKeyInQuery(_k.classObjectId, _k.activityToUserIdStringKey, activityQuery);
  userQuery.limit(1000);

  return userQuery;
};
