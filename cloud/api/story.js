var _ = require('cloud/lib/underscore-min.js');
var _k = require('cloud/class/classConstants.js');
var Group = require('cloud/class/group.js');
var Following = require('cloud/api/following.js');
var Block = require('cloud/api/block.js');
var Flare = require('cloud/class/flare.js');
var User = require('cloud/class/user.js');

var allStoriesFunctions = [
  fetchUserStoriesForUser,
  fetchGroupStoriesForUser
];

var lastTenStoriesFunctions = [
  fetchLastTenUserStoriesForUser,
  fetchLastTenGroupStoriesForUser
];

//------------------------------------------------------------------------------
// function: getAllStoriesForUser
//
// @params request -
// @params response - 
//------------------------------------------------------------------------------
Parse.Cloud.define("getAllStoriesForUser", function(request,response) {

  Parse.Cloud.useMasterKey();

  var currentUser = request.user;
  var currentDate = new Date();
 
  if (_.isNull(currentUser) || _.isUndefined(currentUser)) {
    response.error("Null or invalid request user");
    return;
  }

  // Get group story 
  fetchAllStoriesForUser(currentUser, currentDate).then(function(postsFromUser, postsFromGroups) {
    var allStories = postsFromUser.concat(postsFromGroups);
    return sortAndFilterAllStories(allStories, currentDate);
  }).then(function(posts) {
    response.success(posts);
  }, function(error) {
    console.log("Error: " + error.message);
    response.error(error);
  });

});

//------------------------------------------------------------------------------
// function: getLastTenStoriesForUser
//
// @params request -
// @params response - 
//------------------------------------------------------------------------------
Parse.Cloud.define("getLastTenStoriesForUser", function(request,response) {

  Parse.Cloud.useMasterKey();

  var currentUser = request.user;
  var currentDate = new Date();
 
  if (_.isNull(currentUser) || _.isUndefined(currentUser)) {
    response.error("Null or invalid request user");
    return;
  }

  // Get group story 
  fetchLastTenStoriesForUser(currentUser, currentDate).then(function(postsFromUser, postsFromGroups) {
    var allStories = postsFromUser.concat(postsFromGroups);
    return sortAndFilterAllStories(allStories, currentDate);
  }).then(function(posts) {
    response.success(posts);
  }, function(error) {
    console.log("Error: " + error.message);
    response.error(error);
  });

});

//------------------------------------------------------------------------------
// function: getStoriesFromUsersWithIds
//
// @params request -
// @params response - 
//------------------------------------------------------------------------------
Parse.Cloud.define("getStoriesFromUsersWithIds", function(request,response) {

  Parse.Cloud.useMasterKey();

  var currentDate = new Date();
  var userIds = request.params[_k.toUserIds];

  // Add the Flare bear user.
  userIds.concat(_k.flareBearUserId);

  // Get group story 
  User.getUsersWithIds(userIds).then(function(users) {
    return Flare.getPostsByUsers(users, currentDate);
  }).then(function(posts) {
    return sortAndFilterAllStories(posts, currentDate);
  }).then(function(stories) {
    response.success(stories);
  }, function(error) {
    console.log("Error: " + error.message);
    response.error(error);
  });

});

//------------------------------------------------------------------------------
// function: getGroupStoriesForUser
//
// @params request -
// @params response - 
//------------------------------------------------------------------------------
Parse.Cloud.define("getGroupStoriesForUser", function(request,response) {

  Parse.Cloud.useMasterKey();

  var currentUser = request.user;
  var currentDate = new Date();
  
  // Get group story 
  fetchGroupStoriesForUser(currentUser, currentDate).then(function(posts) {
    response.success(posts);
  }, function(error) {
    console.log("Error: " + error.message);
    response.error(error);
  });
  
});

//------------------------------------------------------------------------------
// function: getUserStoriesForUser
//
// @params request -
// @params response - 
//------------------------------------------------------------------------------
Parse.Cloud.define("getUserStoriesForUser", function(request,response) {

  Parse.Cloud.useMasterKey();

  var currentUser = request.user;
  var currentDate = new Date();
  
  // Get user stories from user
  fetchUserStoriesForUser(currentUser, currentDate).then(function(posts) {
    response.success(posts);
  }, function(error) {
    console.log("Error: getStoriesForUser" + error.message);
    response.error(error);
  });
  
});

// ******* Release 1.28: Deprecate - use getUserStoriesForUser
//------------------------------------------------------------------------------
// function: getStoriesForUser
//
// @params request -
// @params response - 
//------------------------------------------------------------------------------
Parse.Cloud.define("getStoriesForUser", function(request,response) {

  Parse.Cloud.useMasterKey();

  var currentUser = request.user;
  var currentDate = new Date();
  
  // Get user stories from user
  fetchUserStoriesForUser(currentUser, currentDate).then(function(posts) {
    response.success(posts);
  }, function(error) {
    console.log("Error: getStoriesForUser" + error.message);
    response.error(error);
  });
  
});


//------------------------------------------------------------------------------
// Private
//------------------------------------------------------------------------------

//------------------------------------------------------------------------------
// function: sortAndFilterAllStories
//
// @params date - current date
//------------------------------------------------------------------------------
function sortAndFilterAllStories(stories, date) {
  
  var promise = new Parse.Promise();

  // Sort the notifications by createdAt date
  var sorted = _.sortBy(stories, _k.classCreatedAt);

  sorted = _.compact(sorted);

  // Remove any duplicate notifications
  var sortedStories = _.uniq(sorted, function(item) { 
    return item.id;
  });

  promise.resolve(sortedStories.reverse());
  return promise;
}

//------------------------------------------------------------------------------
// function: fetchAllStoriesForUser
//
// @params request -
// @params response - 
//------------------------------------------------------------------------------
function fetchAllStoriesForUser(requestUser, date) {

  var promises = [];
  _.each(allStoriesFunctions, function(fnc) {
    promises.push(fnc(requestUser, date));
  });

  return Parse.Promise.when(promises);
}

//------------------------------------------------------------------------------
// function: fetchLastTenStoriesForUser
//
// @params request -
// @params response - 
//------------------------------------------------------------------------------
function fetchLastTenStoriesForUser(requestUser, date) {

  var promises = [];
  _.each(lastTenStoriesFunctions, function(fnc) {
    promises.push(fnc(requestUser, date));
  });

  return Parse.Promise.when(promises);
}

//------------------------------------------------------------------------------
// Private - User Stories
//------------------------------------------------------------------------------

//------------------------------------------------------------------------------
// function: fetchUserStoriesForUser
//
// @params request -
// @params response - 
//------------------------------------------------------------------------------
function fetchUserStoriesForUser(requestUser, date) {

  var promise = new Parse.Promise();

  // Get user stories from user
  getStoryAuthors(requestUser, date).then(function(authors) {
    return Flare.getPostsByUsers(authors, date);
  }).then(function(posts) {
    promise.resolve(posts);
  }, function(error) {
    console.log("Error: fetchUserStoriesForUser" + error.message);
    promise.reject(error);
  });
  
  return promise;
}

//------------------------------------------------------------------------------
// function: getStoryAuthors
//
// @params requestUser -
//------------------------------------------------------------------------------
function getStoryAuthors(requestUser, date) {

  var promise = new Parse.Promise();

  var userQuery = storyAuthorsUserQuery(requestUser, date);
  userQuery.find().then(function(users) {
    return Block.getBlockedUsers(requestUser, users);
  }).then(function(blockedUsers, activeFriends) {

    // FIlter out blocked users
    var storyAuthors;
    if (_.isUndefined(blockedUsers) || _.isNull(blockedUsers)) {
      storyAuthors = activeFriends;
    } else {
      // Remove any blockedUsers in the Users list  
      storyAuthors =  _.reject(activeFriends, function(item) {
          return _.where(blockedUsers, {id: item.id}).length > 0;
      });
    }

    promise.resolve(storyAuthors);
  }, function(error) {
    console.log("Error: getStoryAuthors: " + error.message);
    promise.reject(error);
  });
  
  return promise;
}

//------------------------------------------------------------------------------
// function: getPostsByUsers
//
// @params users - 
// @params date - 
//------------------------------------------------------------------------------
function getPostsByUsers(users, date) {

  var promise = new Parse.Promise();
 
  var postsQuery = Flare.postsByUsersQuery(users, date);
  postsQuery.find().then(function(posts) {
    promise.resolve(posts);
  }, function(error) {
    promise.reject(error);
  });
  
  return promise;
}

//------------------------------------------------------------------------------
// Private - Last Ten - User Stories
//------------------------------------------------------------------------------

//------------------------------------------------------------------------------
// function: fetchUserStoriesForUser
//
// @params request -
// @params response - 
//------------------------------------------------------------------------------
function fetchLastTenUserStoriesForUser(requestUser, date) {

  var promise = new Parse.Promise();

  // Get user stories from user
  getLastTenStoryAuthors(requestUser, date).then(function(authors) {
    return Flare.getLastTenPostsByUsers(authors, date);
  }).then(function(posts) {
    promise.resolve(posts);
  }, function(error) {
    console.log("Error: fetchUserStoriesForUser" + error.message);
    promise.reject(error);
  });
  
  return promise;
}

//------------------------------------------------------------------------------
// function: getStoryAothors
//
// @params requestUser -
//------------------------------------------------------------------------------
function getLastTenStoryAuthors(requestUser, date) {

  var promise = new Parse.Promise();

  var userQuery = lastTenStoryAuthorsUserQuery(requestUser, date);
  userQuery.find().then(function(users) {
    return Block.getBlockedUsers(requestUser, users);
  }).then(function(blockedUsers, activeFriends) {

    // FIlter out blocked users
    var storyAuthors;
    if (_.isUndefined(blockedUsers) || _.isNull(blockedUsers)) {
      storyAuthors = activeFriends;
    } else {
      // Remove any blockedUsers in the Users list  
      storyAuthors =  _.reject(activeFriends, function(item) {
          return _.where(blockedUsers, {id: item.id}).length > 0;
      });
    }

    promise.resolve(storyAuthors);
  }, function(error) {
    console.log("Error: getStoryAuthors: " + error.message);
    promise.reject(error);
  });
  
  return promise;
}

//------------------------------------------------------------------------------
// Private - Group Stories
//------------------------------------------------------------------------------

//------------------------------------------------------------------------------
// function: fetchGroupStoriesForUser
//
// @params request -
// @params response - 
//------------------------------------------------------------------------------
function fetchGroupStoriesForUser(requestUser, date) {

  var promise = new Parse.Promise();

  // Get group story 
  Group.getGroupsUserFollows(requestUser).then(function(groups) {
    return getPostsForGroups(groups, date);
  }).then(function(posts) {
    promise.resolve(posts);
  }, function(error) {
    console.log("Error: fetchGroupStoriesForUser" + error.message);
    promise.reject(error);
  });
  
  return promise;
}

//------------------------------------------------------------------------------
// function: getPostsForGroups
//
// @params requestUser -
//------------------------------------------------------------------------------
function getPostsForGroups(groups, date) {

  var promise = new Parse.Promise();

  var postsQuery = postsForGroupsQuery(groups, date);
 
  postsQuery.find().then(function(posts) {
    promise.resolve(posts);
  }, function(error) {
    console.log("Error: getPostsForGroups: " + error.message);
    promise.reject(error);
  });
  
  return promise;
}


//------------------------------------------------------------------------------
// Private - Group Stories - last ten
//------------------------------------------------------------------------------
//------------------------------------------------------------------------------
// function: fetchLastTenGroupStoriesForUser
//
// @params request -
// @params response - 
//------------------------------------------------------------------------------
function fetchLastTenGroupStoriesForUser(requestUser, date) {

  var promise = new Parse.Promise();

  // Get group story 
  Group.getGroupsUserFollows(requestUser).then(function(groups) {
    return Flare.getLastTenPostsByGroups(groups);
  }).then(function(posts) {
    promise.resolve(posts);
  }, function(error) {
    console.log("Error: fetchGroupStoriesForUser" + error.message);
    promise.reject(error);
  });
  
  return promise;
}

//------------------------------------------------------------------------------
// Private - Parse Query
//------------------------------------------------------------------------------

//------------------------------------------------------------------------------
// function: storyAuthorsUserQuery
//
// @params requestUser -
// @params date - 
//------------------------------------------------------------------------------
function storyAuthorsUserQuery(requestUser, date) {

  // Query for current user stories
  var currentUserQuery = new Parse.Query(Parse.User);
  currentUserQuery.equalTo(_k.classObjectId, requestUser.id);
  currentUserQuery.greaterThanOrEqualTo(_k.userFlareExpiresAtKey, date);
  currentUserQuery.limit(1000);

  // Query for the flare bear story
  var flareTeamQuery = new Parse.Query(Parse.User);
  flareTeamQuery.equalTo(_k.classObjectId, _k.flareBearUserId); // Flare bear user ID
  flareTeamQuery.greaterThanOrEqualTo(_k.userFlareExpiresAtKey, date);

  // Query for following users
  var followersQuery = Following.usersQuery(requestUser);
  followersQuery.greaterThanOrEqualTo(_k.userFlareExpiresAtKey, date);
  
  // Flare object
  var storyAuthorsQuery = Parse.Query.or(currentUserQuery, followersQuery, flareTeamQuery);
  
  // Exclude Users who have blocked this user
  var blockedQuery = Block.blockThisUserActivityQuery(requestUser);
  storyAuthorsQuery.doesNotMatchKeyInQuery(_k.classObjectId, _k.activityFromUserIdStringKey, blockedQuery);

  storyAuthorsQuery.descending(_k.userFlareExpiresAtKey);
  storyAuthorsQuery.limit(1000); 

  return storyAuthorsQuery;
}

//------------------------------------------------------------------------------
// function: postsByGroupsQuery
//
// @params groups - 
// @params date - 
//------------------------------------------------------------------------------
function postsForGroupsQuery(groups, date) {
 
  var Flare = Parse.Object.extend(_k.flareTableName);
  var postsQuery = new Parse.Query(Flare);

  postsQuery.containedIn(_k.flareGroupKey, groups);
  postsQuery.greaterThanOrEqualTo(_k.flareExpiresAtKey, date);
  postsQuery.descending(_k.classCreatedAt);
  postsQuery.include(_k.flareUserKey); //include the user objects
  postsQuery.include(_k.flareGroupKey); //include the user objects
  postsQuery.limit(1000);

  return postsQuery;
}

//------------------------------------------------------------------------------
// function: lastTenStoryAuthorsUserQuery
//
// @params requestUser -
// @params date - 
//------------------------------------------------------------------------------
function lastTenStoryAuthorsUserQuery(requestUser, date) {

  // Query for current user stories
  var currentUserQuery = new Parse.Query(Parse.User);
  currentUserQuery.equalTo(_k.classObjectId, requestUser.id);

  // Query for the flare bear story
  var flareTeamQuery = new Parse.Query(Parse.User);
  flareTeamQuery.equalTo(_k.classObjectId, "rOroXQDUjZ"); // Flare bear user ID
  flareTeamQuery.greaterThanOrEqualTo(_k.userFlareExpiresAtKey, date);

  // Query for following users
  var followersQuery = Following.usersQuery(requestUser);
  followersQuery.limit(1000);

  // Flare object
  var storyAuthorsQuery = Parse.Query.or(currentUserQuery, followersQuery, flareTeamQuery);
  
  // Exclude Users who have blocked this user
  var blockedQuery = Block.blockThisUserActivityQuery(requestUser);
  storyAuthorsQuery.doesNotMatchKeyInQuery(_k.classObjectId, _k.activityFromUserIdStringKey, blockedQuery);

  storyAuthorsQuery.descending(_k.userFlareExpiresAtKey);
  storyAuthorsQuery.limit(1000); 

  return storyAuthorsQuery;
}

//------------------------------------------------------------------------------
// function: lastTenPostsByGroupsQuery
//
// @params groups - 
// @params date - 
//------------------------------------------------------------------------------
function lastTenPostsForGroupsQuery(groups, date) {
 
  var Flare = Parse.Object.extend(_k.flareTableName);
  var postsQuery = new Parse.Query(Flare);

  postsQuery.containedIn(_k.flareGroupKey, groups);
  postsQuery.descending(_k.classCreatedAt);
  postsQuery.include(_k.flareUserKey); //include the user objects
  postsQuery.include(_k.flareGroupKey); //include the user objects
  postsQuery.limit(1000);

  return postsQuery;
}

