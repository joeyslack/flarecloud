var _ = require('../lib/underscore-min.js');
var _k = require('../class/classConstants.js');
var DateUtil = require('../utils/date.js');
var Following = require('../api/following.js');
var Block = require('../api/block.js');

//------------------------------------------------------------------------------
// Local 
//------------------------------------------------------------------------------
var notificationFunctions = [
  getCommentNotificationsForMyPosts,
  getCommentNotificationsForPostsUserFollows,
  getNewStoryNotifications, 
  getMentionNotifications,
  getViewedMentionNotifications,
  getFollowingUsersYouDoNotFollowNotifications,
  getLast24HrsFollowedNotifications,
  getFollowRequestNotifications,
  getHeartsNotifications
];

//------------------------------------------------------------------------------
// Public 
//------------------------------------------------------------------------------

//------------------------------------------------------------------------------
// function: getStoriesForUser
//
// @params request -
// @params response - 
//------------------------------------------------------------------------------
Parse.Cloud.define("getAllNotificationsForUser", function(request,response) {
  var currentUser = request.user;
  var currentDate = new Date();

  // Increment views count for Flare
  getAllNotificationsForUser(currentUser, currentDate).then(
    function(commentNotifications, commentNotificationsForFollPostsUserFollows, newStoryNotifications, mentionNotifications, viewedMentionNotifications, followedNotifications, last24HrsFollowedNotifications, followRequestNotifications, heartNotifications) {
      var notifications = commentNotifications.concat(commentNotificationsForFollPostsUserFollows, newStoryNotifications, mentionNotifications, viewedMentionNotifications, followedNotifications, last24HrsFollowedNotifications, followRequestNotifications, heartNotifications);
      return sortAndFilterAllNotifications(notifications, currentDate);
    }).then(function(sortedNotifications) {
      response.success(sortedNotifications);
    }, function(error) {
      console.log("Error: " + error.message);
      response.error(error);
    });
});

//------------------------------------------------------------------------------
// Private
//------------------------------------------------------------------------------

//------------------------------------------------------------------------------
// function: getAllNotificationsForUser
//
// @params requestUser - user who requested the notification activity
// @params date - current date
//------------------------------------------------------------------------------
function getAllNotificationsForUser(requestUser, date) {

  var promises = [];

  _.each(notificationFunctions, function(fnc) {
    promises.push(fnc(requestUser, date));
  });

  return Parse.Promise.when(promises);
}

//------------------------------------------------------------------------------
// function: sortAndFilterAllNotifications
//
// @params requestUser - user who requested the notification activity
// @params date - current date
//------------------------------------------------------------------------------
function sortAndFilterAllNotifications(notifications, date) {
  
  var promise = new Parse.Promise();

  // Remove null items
  notifications = _.reject(notifications, function(item) { return _.isEmpty(item); });

  // Sort the notifications by createdAt date
  var sorted = _.sortBy(notifications, _k.classCreatedAt);

  // Remove any duplicate notifications
  var sortedNotifications = _.uniq(sorted, function(item) { 
    return item.id;
  });

  // Only show the notification activity that has a Flare object that has not expired 
  sortedNotifications = _.reject(sortedNotifications, function(notification) {
    if (_.isUndefined(notification) || _.isUndefined(notification.get(_k.activityFlareKey))){
      return false;
    }

    var flareExpiresAtDate = new Date( notification.get(_k.activityFlareKey).get(_k.flareExpiresAtKey));
    var yesterday = DateUtil.subtractDays(date,1);
    return flareExpiresAtDate < yesterday;
  });

  promise.resolve(sortedNotifications.reverse());
  return promise;
}

//------------------------------------------------------------------------------
// function: getCommentNotificationsForMyPosts
//
// @params requestuser - user who requested the notification activity
// @params date - current date
//------------------------------------------------------------------------------
function getCommentNotificationsForMyPosts(requestUser, date) {

  var promise = new Parse.Promise();

  var activityQuery = commentNotificationsForMyPostsQuery(requestUser, date);
  
  activityQuery.find({useMasterKey: true}).then(function(notifications) {
    var filteredNotifications = rejectUsersFromList(notifications, [requestUser]);
    promise.resolve(filteredNotifications);
  }, function(error) {
    console.log("Error: getCommentNotificationsForUsersPosts: " + error.message);
    promise.reject(error);
  });

  return promise;
}

/**
* Get Hearts/Likes notifications
*
* @param requestUser
* @param date
*/
function getHeartsNotifications(requestUser, date) {
  var promise = new Parse.Promise();
  var ActivityClass = Parse.Object.extend(_k.activityTableName);
  var activityQuery = new Parse.Query(ActivityClass);

  activityQuery.equalTo(_k.activityToUserIdStringKey, requestUser.id);
  activityQuery.equalTo(_k.activityTypeKey, _k.activityTypeHearts);
  activityQuery.notEqualTo(_k.activityFromUserIdStringKey, Parse.User.current().id);

  // Only show last 24 hours worth of notifications
  var yesterday = DateUtil.subtractDays(date, 1);
  activityQuery.greaterThanOrEqualTo(_k.classCreatedAt, yesterday);

  // Only get notifications for people you are following
  //activityQuery.containedIn(_k.activityFromUserKey, followingUsers);

  // Include keys
  activityQuery.include(_k.activityFlareKey);
  activityQuery.include(_k.activityFromUserKey);
  activityQuery.include(_k.activityFlareKey + "." + _k.flareUserKey);
  activityQuery.include(_k.activityFlareKey + "." + _k.flareGroupKey);

  activityQuery.descending(_k.classCreatedAt);
  activityQuery.limit(1000);

  activityQuery.find({useMasterKey: true}).then(function(notifications) {
    promise.resolve(notifications);
  }, function(error) {
    console.log("Error: getHeartsNotifications: " + error.message);
    promise.reject(error);
  });

  return promise;
}

//------------------------------------------------------------------------------
// function: getCommentNotificationsForPostsUserFollows
//
// @params requestuser - user who requested the notification activity
// @params date - current date
//------------------------------------------------------------------------------
function getCommentNotificationsForPostsUserFollows(requestUser, date) {

  var promise = new Parse.Promise();

  var activityQuery = commentNotificationsForPostsUserFollowsQuery(requestUser, date);
  
  activityQuery.find({useMasterKey: true}).then(function(notifications) {
    return filterCommentNotificationsForPostsUserFollows(requestUser, notifications);
  }).then(function(filteredNotifications) {
    promise.resolve(filteredNotifications);  
  }, function(error) {
    console.log("Error: getCommentNotificationsForPostsUserFollows: " + error.message);
    promise.reject(error);
  });

  return promise;
}

//------------------------------------------------------------------------------
// function: filterCommentNotificationsForPostsUserFollows
//
// @params requestuser - user who requested the notification activity
// @params notifications - array of the notifications to filter
//------------------------------------------------------------------------------
function filterCommentNotificationsForPostsUserFollows(requestUser, notifications) {

    var promise = new Parse.Promise();

    var filteredNotifications = [];

    // Group by Post ID
    
    var normalizedNotifications = _.reject(notifications, function(notification) {
      var flare = notification.get(_k.activityFlareKey);
      return _.isUndefined(flare);
    });

    var buckets = _.groupBy(normalizedNotifications, function(notification) { 
      return notification.get(_k.activityFlareKey).id;
    });

    // Filter the comments
    _.each(buckets, function(bucketComments) {

      // Make sure the comments are sorted by date (ascending)
      var comments = _.sortBy(bucketComments, _k.classCreatedAt);
      
      // Find the first comment by the request user
      var myFirstCommentIndex = _.findIndex(comments, function(comment) {
        return comment.get(_k.activityFromUserIdStringKey) == requestUser.id;
      });

      var commentsAfterMine = (myFirstCommentIndex != -1) ? comments.slice(myFirstCommentIndex+1) : [];

      // Remove all notifications from the request user
      var filteredComments = rejectUsersFromList(commentsAfterMine, [requestUser]);
      filteredNotifications = filteredNotifications.concat(filteredComments);
    });

    promise.resolve(filteredNotifications);
    return promise;
}

//------------------------------------------------------------------------------
// function: getNewStoryNotifications
//
// @params requestuser - user who requested the notification activity
// @params date - current date
//------------------------------------------------------------------------------
function getNewStoryNotifications(requestUser, date) {

  var promise = new Parse.Promise();

  Following.getFollowingExcludeUsersWhoBlockMeAndWhoIBlock(requestUser).then(function(followingUsers) {
    var activityQuery = newStoryNotificationsQuery(requestUser, followingUsers, date);

    activityQuery.find({useMasterKey: true}).then(function(notifications) {
      return filterNewStoryNotifications(notifications, requestUser);
    }).then(function(filteredNotifications) {
      promise.resolve(filteredNotifications);  
    }, function(error) {
      console.log("Error: getNewStoryNotifications: " + error.message);
      promise.reject(error);
    });
  }, function(error) {
    console.log("Error: getNewStoryNotifications - getfollowingUsers: " + error.message);
    promise.reject(error);
  });
    
  return promise;
}

//------------------------------------------------------------------------------
// function: filterCommentNotificationsForPostsUserFollows
//
// @params notifications - array of notifications to filter
// @params requestuser - user who requested the notification activity
//------------------------------------------------------------------------------
function filterNewStoryNotifications(notifications, requestUser) {

    var promise = new Parse.Promise();

    // Remove any notifications from the request user  
    var filteredNotifications = rejectUsersFromList(notifications, [requestUser]);
    
    promise.resolve(filteredNotifications);
    return promise;
}

//------------------------------------------------------------------------------
// function: getMentionNotifications
//
// @params requestuser - user who requested the notification activity
// @params date - current date
//------------------------------------------------------------------------------
function getMentionNotifications(requestUser, date) {

  var promise = new Parse.Promise();

  var activityQuery = mentionNotificationsQuery(requestUser, date);
  
  activityQuery.find({useMasterKey: true}).then(function(notifications) {
    var filteredNotifications = rejectUsersFromList(notifications, [requestUser]);
    promise.resolve(filteredNotifications);  
  }, function(error) {
    console.log("Error: getMentionNotifications: " + error.message);
    promise.reject(error);
  });

  return promise;
}

//------------------------------------------------------------------------------
// function: getViewedMentionNotifications
//
// @params requestuser - user who requested the notification activity
// @params date - current date
//------------------------------------------------------------------------------
function getViewedMentionNotifications(requestUser, date) {

  var promise = new Parse.Promise();
  var mentionedActivities = [];

  var activityQuery = userMentionedNotificationsQuery(requestUser, date);
 
  activityQuery.find({useMasterKey: true}).then(function(activities) {
    mentionedActivities = activities;
    var viewedActivityQuery = viewedMentionNotificationsQuery(requestUser, date, activities);
    
    return viewedActivityQuery.find({useMasterKey: true});
  }).then(function(viewedActivities) {
    var filteredNotifications = [];

    var mentionedActivitiesArray = [];

    normalizedMentionedActivities = _.reject(mentionedActivities, function(activity) {
      return _.isUndefined(activity.get(_k.activityFlareKey));
    });

    // Array of key/values indicating the mention activity created by user 
    _.each(normalizedMentionedActivities, function(mention) {
      var object = {"toUserIdString" : mention.get(_k.activityToUserIdStringKey), "flareId": mention.get(_k.activityFlareKey).id};
      mentionedActivitiesArray.push(object);
    });

    // Filter the viewed activity for only those that match the mention activity created by the user
    if (!_.isUndefined(viewedActivities) && viewedActivities.length > 0) {

      normalizedViewedActivities = _.reject(viewedActivities, function(activity) {
        return _.isUndefined(activity.get(_k.activityFlareKey));
      });

      filteredNotifications = _.filter(normalizedViewedActivities, function(activity) {
        return _.where(mentionedActivitiesArray, {"toUserIdString": activity.get(_k.activityFromUserIdStringKey), "flareId": activity.get(_k.activityFlareKey).id}).length > 0;
      });
    }
    
    promise.resolve(filteredNotifications);  
  }, function(error) {
    console.log("Error: getViewedMentionNotifications: " + error.message);
    promise.reject(error);
  });

  return promise;
}
//------------------------------------------------------------------------------
// function: getFollowngUserYouDoNotFollowedNotifications
//
// @params requestuser - user who requested the notification activity
// @params date - current date
//------------------------------------------------------------------------------
function getFollowingUsersYouDoNotFollowNotifications(requestUser, date) {

  var promise = new Parse.Promise();

  var followedNotifications = [];
  var activityQuery = followedNotificationsQuery(requestUser);
  
  activityQuery.find({useMasterKey: true}).then(function(notifications) {
    followedNotifications = notifications;

    // Get all people you follow
    return Following.getFollowingUsers(requestUser);
  }).then(function(followingUsers) {

    // fitler out people requestUser already follows or blocks
    var filteredNotifications = rejectUsersFromList(followedNotifications, followingUsers);
    
    filteredNotifications = _.uniq(filteredNotifications, function(item) { 
      return item.get(_k.activityFromUserIdStringKey);
    });

    promise.resolve(filteredNotifications);  
  }, function(error) {
    console.log("Error: getFollowedNotifications: " + error.message);
    promise.reject(error);
  });

  return promise;
}

//------------------------------------------------------------------------------
// function: getMentionNotifications
//
// @params requestuser - user who requested the notification activity
// @params date - current date
//------------------------------------------------------------------------------
function getLast24HrsFollowedNotifications(requestUser, date) 
{
  var promise = new Parse.Promise();

  var activityQuery = followedNotificationsQuery(requestUser, date);
  
  activityQuery.find({useMasterKey: true}).then(function(notifications) {
    var filteredNotifications = rejectUsersFromList(notifications, [requestUser]);
    promise.resolve(filteredNotifications);  
  }, function(error) {
    console.log("Error: getlast24HrsFollowedNotifications: " + error.message);
    promise.reject(error);
  });

  return promise;
}

//------------------------------------------------------------------------------
// function: getFollowRequestNotifications
//
// @params requestUser - user who requested the notification activity
// @params date - current date
//------------------------------------------------------------------------------
function getFollowRequestNotifications(requestUser, date) {

  var promise = new Parse.Promise();

  var activityQuery = followRequestNotificationsQuery(requestUser);
  
  activityQuery.find({useMasterKey: true}).then(function(notifications) {
//  console.log("2. ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ filteredNotifications: " + filteredNotifications.length);
//    _.each(filteredNotifications, function(notification) {
//      console.log("    Filtered: follow request from: " + notification.get(_k.activityFromUserKey).get(_k.userFullNameKey) + " id: " + notification.get(_k.activityFromUserIdStringKey));
//    });

    promise.resolve(notifications);  
  }, function(error) {
    console.log("Error: getFollowRequestNotifications: " + error.message);
    promise.reject(error);
  });

  return promise;
}

//------------------------------------------------------------------------------
// function: rejectUserFromList 
//
// @params list -
// @params user -
//------------------------------------------------------------------------------
function rejectUsersFromList(list, users) {
  var filteredList = _.reject(list, function(activity) {
    //return user.id == activity.get(_k.activityFromUserIdStringKey);
    return _.where(users, {id: activity.get(_k.activityFromUserIdStringKey)}).length > 0;
  });

  return filteredList;
}

//------------------------------------------------------------------------------
// Private - Queries
//------------------------------------------------------------------------------

//------------------------------------------------------------------------------
// function: commentNotificationsForMyPostsQuery
//
// @params requestUser - user who requested the notification activity
// @params date - current date 
//------------------------------------------------------------------------------
function commentNotificationsForMyPostsQuery(requestUser, date) {

  var ActivityClass = Parse.Object.extend(_k.activityTableName);
  var activityQuery = new Parse.Query(ActivityClass);

  // New story type 
  activityQuery.equalTo(_k.activityTypeKey, _k.activityTypeComment);
 
  // Only show last 24 hours worth of new story notifications
  var yesterday = DateUtil.subtractDays(date, 1);
  activityQuery.greaterThanOrEqualTo(_k.classCreatedAt, yesterday);
  
  // 
  activityQuery.equalTo(_k.activityToUserKey, requestUser);
  activityQuery.equalTo(_k.activityIsFlareCreationKey, false);

  // Include kys
  activityQuery.include(_k.activityFlareKey);
  activityQuery.include(_k.activityFromUserKey);
  activityQuery.include(_k.activityFlareKey + "." + _k.flareUserKey);
  activityQuery.include(_k.activityFlareKey + "." + _k.flareGroupKey);

  activityQuery.descending(_k.classCreatedAt);
  activityQuery.limit(1000);

  return activityQuery;
}

//------------------------------------------------------------------------------
// function: commentsNotificationsForPostsUserFollowsQuery
//
// @params requestUser -
// @params date - 
//------------------------------------------------------------------------------
function commentNotificationsForPostsUserFollowsQuery(requestUser, date) {

  var ActivityClass = Parse.Object.extend(_k.activityTableName);
  var followedPostsQuery = new Parse.Query(ActivityClass);

  // Comment type 
  followedPostsQuery.equalTo(_k.activityTypeKey, _k.activityTypeComment);
 
  // Only show last 24 hours worth of new story notifications
  var yesterday = DateUtil.subtractDays(date, 1);
  followedPostsQuery.greaterThanOrEqualTo(_k.classCreatedAt, yesterday);
  
  // 
  followedPostsQuery.equalTo(_k.activityFromUserKey, requestUser);
  followedPostsQuery.equalTo(_k.activityIsFlareCreationKey, false);
  followedPostsQuery.limit(1000);

  // Other Commenters on the Posts that the requested user has commented on
  var otherCommentersPostsQuery = new Parse.Query(ActivityClass);

  otherCommentersPostsQuery.equalTo(_k.activityTypeKey, _k.activityTypeComment);
  otherCommentersPostsQuery.matchesKeyInQuery(_k.activityFlareKey, _k.activityFlareKey, followedPostsQuery);
  otherCommentersPostsQuery.equalTo(_k.activityIsFlareCreationKey, false);
  otherCommentersPostsQuery.greaterThanOrEqualTo(_k.classCreatedAt, yesterday);
  
  // Include kys
  otherCommentersPostsQuery.include(_k.activityFlareKey);
  otherCommentersPostsQuery.include(_k.activityFromUserKey);
  otherCommentersPostsQuery.include(_k.activityFlareKey + "." + _k.flareUserKey);
  otherCommentersPostsQuery.include(_k.activityFlareKey + "." + _k.flareGroupKey);

  otherCommentersPostsQuery.descending(_k.classCreatedAt);
  otherCommentersPostsQuery.limit(1000);

  return otherCommentersPostsQuery;
}

//------------------------------------------------------------------------------
// function: newStoryNotificationsQuery
//
// @params requestUser -
// @params date - 
//------------------------------------------------------------------------------
function newStoryNotificationsQuery(requestUser, followingUsers, date) {

  var ActivityClass = Parse.Object.extend(_k.activityTableName);
  var activityQuery = new Parse.Query(ActivityClass);

  // New story type 
  activityQuery.equalTo(_k.activityTypeKey, _k.activityTypeNewStory);
  
  // Only show last 24 hours worth of new story notifications
  var yesterday = DateUtil.subtractDays(date, 1);
  activityQuery.greaterThanOrEqualTo(_k.classCreatedAt, yesterday);
  
  // Only get new story notifications for people you are following
  activityQuery.containedIn(_k.activityFromUserKey, followingUsers);

  // Include kys
  activityQuery.include(_k.activityFlareKey);
  activityQuery.include(_k.activityFromUserKey);
  activityQuery.include(_k.activityFlareKey + "." + _k.flareUserKey);
  activityQuery.include(_k.activityFlareKey + "." + _k.flareGroupKey);

  activityQuery.descending(_k.classCreatedAt);
  activityQuery.limit(1000);

  return activityQuery;
}

//------------------------------------------------------------------------------
// function: mentionNotificationsQuery
//
// @params requestUser -
// @params date - 
//------------------------------------------------------------------------------
function mentionNotificationsQuery(requestUser, date, followingUsers) {

  var ActivityClass = Parse.Object.extend(_k.activityTableName);
  var activityQuery = new Parse.Query(ActivityClass);

  // New story type 
  activityQuery.equalTo(_k.activityTypeKey, _k.activityTypeMention); 
  activityQuery.equalTo(_k.activityToUserKey, requestUser);

  // Only show last 24 hours worth of new story notifications
  if (!_.isUndefined(date)) {
    var yesterday = DateUtil.subtractDays(date, 1);
    activityQuery.greaterThanOrEqualTo(_k.classCreatedAt, yesterday);
  }

  if (!_.isUndefined(followingUsers)) {
    // Only get new story notifications for people you are following
    activityQuery.containedIn(_k.activityFromUserKey, followingUsers);
  }

  // Include kys
  activityQuery.include(_k.activityFlareKey);
  activityQuery.include(_k.activityFromUserKey);
  activityQuery.include(_k.activityFlareKey + "." + _k.flareUserKey);
  activityQuery.include(_k.activityFlareKey + "." + _k.flareGroupKey);

  activityQuery.descending(_k.classCreatedAt);
  activityQuery.limit(1000);

  return activityQuery;
}

//------------------------------------------------------------------------------
// function: mentionNotificationsQuery
//
// @params requestUser -
// @params date - 
//------------------------------------------------------------------------------
function userMentionedNotificationsQuery(requestUser, date) {

  var ActivityClass = Parse.Object.extend(_k.activityTableName);
  var activityQuery = new Parse.Query(ActivityClass);

  // Mention type 
  activityQuery.equalTo(_k.activityTypeKey, _k.activityTypeMention); 
  activityQuery.equalTo(_k.activityFromUserKey, requestUser);

  // Only show last 24 hours worth of activity 
  if (!_.isUndefined(date)) {
    var yesterday = DateUtil.subtractDays(date, 1);
    activityQuery.greaterThanOrEqualTo(_k.classCreatedAt, yesterday);
  }

  // Include kys
  activityQuery.include(_k.activityFlareKey);
  activityQuery.include(_k.activityFromUserKey);
  activityQuery.include(_k.activityToUserKey);
  activityQuery.include(_k.activityFlareKey + "." + _k.flareUserKey);
  activityQuery.include(_k.activityFlareKey + "." + _k.flareGroupKey);
  
  activityQuery.descending(_k.classCreatedAt);
  activityQuery.limit(1000);

  return activityQuery;
}

//------------------------------------------------------------------------------
// function: mentionNotificationsQuery
//
// @params requestUser -
// @params date - 
// @params mentionActivities - 
//------------------------------------------------------------------------------
function viewedMentionNotificationsQuery(requestUser, date, mentionActivities) {

  var ActivityClass = Parse.Object.extend(_k.activityTableName);
  var activityQuery = new Parse.Query(ActivityClass);

  // Mention type 
  activityQuery.equalTo(_k.activityTypeKey, _k.activityTypeViews); 

  // Only show last 24 hours worth of new story notifications
  if (!_.isUndefined(date)) {
    var yesterday = DateUtil.subtractDays(date, 1);
    activityQuery.greaterThanOrEqualTo(_k.classCreatedAt, yesterday);
  }

  // Include keys
  activityQuery.include(_k.activityFlareKey);
  activityQuery.include(_k.activityFromUserKey);
  activityQuery.include(_k.activityToUserKey);
  activityQuery.include(_k.activityFlareKey + "." + _k.flareUserKey);
  activityQuery.include(_k.activityFlareKey + "." + _k.flareGroupKey);
  
  activityQuery.descending(_k.classCreatedAt);
  activityQuery.limit(1000);

  // Viewed the mention
  var mentionFlares = [];
  _.each(mentionActivities, function(activity) {
    mentionFlares.push(activity.get(_k.activityFlareKey));
  });
  
  activityQuery.containedIn(_k.activityFlareKey, mentionFlares);

  return activityQuery;
}

//------------------------------------------------------------------------------
// function: followedNotificationsQuery
//
// @params requestUser -
// @params date - 
//------------------------------------------------------------------------------
function followedNotificationsQuery(requestUser, date, followingUsers) {

  var ActivityClass = Parse.Object.extend(_k.activityTableName);
  var activityQuery = new Parse.Query(ActivityClass);

  // New story type 
  activityQuery.equalTo(_k.activityTypeKey, _k.activityTypeFollow); 
  activityQuery.equalTo(_k.activityToUserKey, requestUser);

  // Only show last 24 hours worth of notifications if 'date' is defined
  if (!_.isUndefined(date)) {
    var yesterday = DateUtil.subtractDays(date, 1);
    activityQuery.greaterThanOrEqualTo(_k.classCreatedAt, yesterday);
  }

  if (!_.isUndefined(followingUsers)) {
    // Only get new story notifications for people you are following
    activityQuery.notContainedIn(_k.activityFromUserKey, followingUsers);
  }

  // Include kys
  activityQuery.include(_k.activityFromUserKey);

  activityQuery.descending(_k.classCreatedAt);
  activityQuery.limit(1000);

  return activityQuery;
}

//------------------------------------------------------------------------------
// function: followRequestNotificationsQuery
//
// @params requestUser -
// @params date - 
//------------------------------------------------------------------------------
function followRequestNotificationsQuery(requestUser, date, followingUsers) {

  var ActivityClass = Parse.Object.extend(_k.activityTableName);
  var activityQuery = new Parse.Query(ActivityClass);

  // New story type 
  activityQuery.equalTo(_k.activityTypeKey, _k.activityTypeFollowRequest); 
  activityQuery.equalTo(_k.activityToUserKey, requestUser);

  // Only show last 24 hours worth of notifications if 'date' is defined
  if (!_.isUndefined(date)) {
    var yesterday = DateUtil.subtractDays(date, 1);
    activityQuery.greaterThanOrEqualTo(_k.classCreatedAt, yesterday);
  }

  if (!_.isUndefined(followingUsers)) {
    // Only get new story notifications for people you are following
    activityQuery.notContainedIn(_k.activityFromUserKey, followingUsers);
  }

  // Filter out request if user is blocked
  var blockedQuery = Block.thisUserBlockActivityQuery(requestUser);
  activityQuery.doesNotMatchKeyInQuery(_k.activityFromUserIdStringKey, _k.activityToUserIdStringKey, blockedQuery);

  // Include kys
  activityQuery.include(_k.activityFromUserKey);

  activityQuery.descending(_k.classCreatedAt);
  activityQuery.limit(1000);

  return activityQuery;
}
