var _this = this;
var _k = require('../class/classConstants.js');
var Block = require('../api/block.js');
var Utility = require('../utils/utility.js');

//------------------------------------------------------------------------------
// Public
//------------------------------------------------------------------------------

//------------------------------------------------------------------------------
// function: getFollowers
//
// @params requestUser
//------------------------------------------------------------------------------
exports.getFollowers = function(requestUser) {

  var promise = new Parse.Promise();

  var followersQuery = _this.usersQuery(requestUser);

  followersQuery.find().then(function(followers) {
    promise.resolve(followers);
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
exports.getFollowersExcludeUsersWhoIBlock = function(requestUser) {

  var promise = new Parse.Promise();

  var followersQuery = _this.usersQuery(requestUser);

  // Exclude Users who have blocked this user
  var blockedQuery = Block.thisUserBlockActivityQuery(requestUser);
  followersQuery.doesNotMatchKeyInQuery(_k.classObjectId, _k.activityToUserIdStringKey, blockedQuery);

  followersQuery.find().then(function(followers) {
    promise.resolve(followers);
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
exports.getFollowersExcludeUsersWhoBlockMe = function(requestUser) {

  var promise = new Parse.Promise();

  var followersQuery = _this.usersQuery(requestUser);

  // Exclude Users who have blocked this user
  var blockedQuery = Block.blockThisUserActivityQuery(requestUser);
  followersQuery.doesNotMatchKeyInQuery(_k.classObjectId, _k.activityFromUserIdStringKey, blockedQuery);

  followersQuery.find().then(function(followers) {
    promise.resolve(followers);
  },function(error) {
    promise.reject(error);
  });

  return promise;
};

//------------------------------------------------------------------------------
// function: getFollowersExcludeUsersWhoBlockMe
//
// @params requestUser
//------------------------------------------------------------------------------
exports.getFollowersExcludeUsersWhoBlockMeAndWhoIBlock = function(requestUser) {

  var promise = new Parse.Promise();

  var followersWhoDoNotBlockMe;

  var followersQuery = _this.usersQuery(requestUser);
  // Exclude Users who have blocked this user
  var blockedQuery = Block.blockThisUserActivityQuery(requestUser);
  followersQuery.doesNotMatchKeyInQuery(_k.classObjectId, _k.activityFromUserIdStringKey, blockedQuery);

  followersQuery.find().then(function(usersWhoDoNotBlockMe) {
    followersWhoDoNotBlockMe = usersWhoDoNotBlockMe;

    var followersWhoIBlockQuery = _this.usersQuery(requestUser);

   // Exclude Users who have blocked this user
   var whoIblockedQuery = Block.thisUserBlockActivityQuery(requestUser);
   followersWhoIBlockQuery.doesNotMatchKeyInQuery(_k.classObjectId, _k.activityToUserIdStringKey, whoIblockedQuery);

   return followersWhoIBlockQuery.find();
  }).then(function(followersWhoIBlock) {
    var followers = Utility.collectionIntersection(followersWhoIBlock, followersWhoDoNotBlockMe);
    promise.resolve(followers);
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

  activityQuery.equalTo(_k.activityToUserKey, requestUser);
  activityQuery.equalTo(_k.activityTypeKey, _k.activityTypeFollow);
  activityQuery.limit(1000);

  var userQuery = new Parse.Query(Parse.User);
  userQuery.matchesKeyInQuery(_k.classObjectId, _k.activityFromUserIdStringKey, activityQuery);
  userQuery.limit(1000);

  return userQuery;
};
