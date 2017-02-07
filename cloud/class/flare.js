var _this = this;
var _ = require('../lib/underscore-min.js');
var _k = require('../class/classConstants.js');
var DateUtil = require('../utils/date.js');
var Activity = require('../class/activity.js');
var Utility = require('../utils/utility.js');
var Push = require('../utils/push.js');

// Override jobs for now
/*Parse.Cloud.job = function() {
  return true;
}*/

//------------------------------------------------------------------------------
// Local
//------------------------------------------------------------------------------
var processNewPostFunctions = [
  processNewUserStory,
  processNewGroupStory
];

//------------------------------------------------------------------------------
// Cloud Code
//------------------------------------------------------------------------------

//------------------------------------------------------------------------------
// Update the user's "flareExpiresAt" column before flare save
// This should solve an issue if the client code fails to update this
//
// @params request
// @params response
//------------------------------------------------------------------------------
Parse.Cloud.beforeSave('Flare', function(request, response) {
  if (request.user) {
    var object = request.object.toJSON();
    var tomorrow = new Date(new Date().getTime() + 24 * 60 * 60 * 1000);
    // Make sure the date is within acceptable bounds
    var expirationDate = !_.isEmpty(object.expiresAt.iso) || object.expiresAt.iso > tomorrow ?
      tomorrow :
      object.expiresAt.iso;

    // Set expiration date on flare itself beforesave
    request.object.set(_k.flareExpiresAtKey, expirationDate);

    // Group flare
    if (object.group) {
      var Group = Parse.Object.extend("Group");
      var group = new Group();
      group.id = object.group.objectId;

      group.set(_k.groupLastFlareExpirationDateKey, { "__type": "Date", "iso": expirationDate.toISOString() });
      group.save(null, {useMasterKey: true}).then(function() {
        response.success();
      }, function (error) {
        response.error(error);
      });
    }
    // Normal flare
    else {
      var user = request.user;
      user.set(_k.userFlareExpiresAtKey, { "__type": "Date", "iso": expirationDate.toISOString() });
      user.save(null, {useMasterKey: true}).then(function() {
        response.success();
      }, function (error) {
        response.error(error);
      });
    }
  }
  else {
    response.success();
  }
});

//------------------------------------------------------------------------------
// function: 'Flare' Table - AfterSave
//
// @params request -
//------------------------------------------------------------------------------
Parse.Cloud.afterSave('Flare', function(request, response) {

  // Because of a Parse cloud code bug .existed() does not work.
  // https://developers.facebook.com/bugs/1675561372679121/
  //if (request.object.existed()) {
  if (Utility.existed(request.object)) {
    // Object already exists, update to an existing object
    return;
  }

  // afterSave (and beforeSave) only have 3 seconds to run
  // For any long running process call a background job which is allowed 15 mins
  // of runtime
  runJobAfterSavePostObject(request);
});

//------------------------------------------------------------------------------
// function: 'Flare' Table - AfterSave
//
// @params request - the request payload from the caller
// @params status - response to send to the caller
//------------------------------------------------------------------------------
Parse.Cloud.job('afterSavePostObject', function(request, status) {
  processNewPost(request).then(function(){
    status.success("Process After Save Post Object succeeded");
  },function(error){
    status.error("Process After Save Post Object error: " + error.message);
  });
});


//------------------------------------------------------------------------------
// function: incrementViews
//
// @params user - user who made the view request
// @params objectId - object ID of Flare to increment view
//------------------------------------------------------------------------------
Parse.Cloud.define("incrementViews", function(request,response) {
  var field = _k.flareViewsKey;

  // Increment views count for Flare
  incrementCountersForField(field, request).then(function(success) {
    response.success("Successfully incremented views");
  }, function(error) {
    response.error("Failed to increment views for flare: " + request.params.objectId);
  });
});

//------------------------------------------------------------------------------
// function: incrementHearts
//
// @params user - user who made the request
// @params objectId - object ID of Flare to increment hearts counters
//------------------------------------------------------------------------------
Parse.Cloud.define("incrementHearts", function(request, response) {
  var field = "hearts";
  var _sendPush = false;

  incrementCountersForField(field, request).then(function(sendPush) {
    var flareQuery = new Parse.Query(_k.flareTableName);
    _sendPush = sendPush;
    
    return flareQuery.get(request.params.objectId, {useMasterKey: true});
  }).then(function(flare) {
    if (_sendPush) {
      return Push.send(_k.pushPayloadActivityTypeHeart, [flare.get("user", {useMasterKey: true})], request.user, flare);
    }
    else {
      response.success(flare);
    }
  }, function(error) {
    response.error("Failed to increment hearts for flare: " + error.message);
  }).then(function() {
    response.success("Successfully incremented hearts, and sent push");
  }, function(error) {
    response.error(error);
  });
});

//------------------------------------------------------------------------------
// Public
//------------------------------------------------------------------------------

//------------------------------------------------------------------------------
// function: getPostsByUsers
//
// @params users -
// @params date -
//------------------------------------------------------------------------------
exports.getPostsByUsers = function(users, date) {
  var promise = new Parse.Promise();
  var postsQuery = _this.postsByUsersQuery(users, date);

  postsQuery.find({useMasterKey: true}).then(function(posts) {
    promise.resolve(posts);
  }, function(error) {
    console.log("getPostsByUsers: Error: " + error.message);
    promise.reject(error);
  });

  return promise;
};

//------------------------------------------------------------------------------
// function: postsByUsersQuery
//
// @params users -
// @params date -
//------------------------------------------------------------------------------
exports.postsByUsersQuery = function(users, date) {

  var Flare = Parse.Object.extend(_k.flareTableName);
  var postsQuery = new Parse.Query(Flare);

  postsQuery.containedIn(_k.flareUserKey, users);
  postsQuery.greaterThanOrEqualTo(_k.flareExpiresAtKey, date);
  postsQuery.descending(_k.classCreatedAt);
  postsQuery.include(_k.flareUserKey); //include the user objects
  postsQuery.doesNotExist(_k.flareGroupKey);
  postsQuery.limit(1000);

  return postsQuery;
};

//// Last 10 posts
//------------------------------------------------------------------------------
// function: getPostsByUsers
//
// @params users -
// @params date -
//------------------------------------------------------------------------------
exports.getLastTenPostsByUsers = function(users, date)
{
  var promise = new Parse.Promise();

  fetchLastTenPostsByUsers(users).then(function(posts) {
    promise.resolve(posts);
  }, function(error) {
    promise.reject(error);
  });

  return promise;
};

//------------------------------------------------------------------------------
// function:  getLastTenPostsByUsers
//
// @params users -
// @params date -
//------------------------------------------------------------------------------
var fetchLastTenPostsByUsers = function(users)
{
  var postsPromises = [];
  var promise =  new Parse.Promise();

  _.each(users, function(user) {
    var postsQuery = lastTenPostsByUserQuery(user);
    postsPromises.push(postsQuery.find({useMasterKey: true}));
  });

  Parse.Promise.when(postsPromises).then(function() {

    var arrayOfPosts = _.flatten(arguments);
    arrayOfPosts = _.compact(arrayOfPosts);

    promise.resolve(arrayOfPosts);
  });

  return promise;
};

//------------------------------------------------------------------------------
// function: postsByUsersQuery
//
// @params users -
// @params date -
//------------------------------------------------------------------------------
var lastTenPostsByUserQuery = function(user) {

  var Flare = Parse.Object.extend(_k.flareTableName);
  var postsQuery = new Parse.Query(Flare);

  postsQuery.equalTo(_k.flareUserKey, user);
  postsQuery.descending(_k.classCreatedAt);
  postsQuery.include(_k.flareUserKey); //include the user objects
  postsQuery.doesNotExist(_k.flareGroupKey);
  postsQuery.limit(10); //limit to the last ten posts by the user

  return postsQuery;
};


// Last 10 group posts
//------------------------------------------------------------------------------
// function: getPostsByUsers
//
// @params users -
// @params date -
//------------------------------------------------------------------------------
exports.getLastTenPostsByGroups = function(groups, date)
{
  var promise = new Parse.Promise();

  fetchLastTenPostsByGroups(groups).then(function(posts) {
    promise.resolve(posts);
  }, function(error) {
    promise.reject(error);
  });

  return promise;
};

//------------------------------------------------------------------------------
// function:  getLastTenPostsByUsers
//
// @params users -
// @params date -
//------------------------------------------------------------------------------
var fetchLastTenPostsByGroups = function(groups)
{
  var postsPromises = [];
  var promise =  new Parse.Promise();

  _.each(groups, function(group) {
    var postsQuery = lastTenPostsByGroupQuery(group);
    postsPromises.push(postsQuery.find({useMasterKey: true}));
  });

  Parse.Promise.when(postsPromises).then(function() {

    var arrayOfPosts = _.flatten(arguments);
    arrayOfPosts = _.compact(arrayOfPosts);

    promise.resolve(arrayOfPosts);
  });

  return promise;
};

//------------------------------------------------------------------------------
// function: postsByUsersQuery
//
// @params users -
// @params date -
//------------------------------------------------------------------------------
lastTenPostsByGroupQuery = function(group) {

  var Flare = Parse.Object.extend(_k.flareTableName);
  var postsQuery = new Parse.Query(Flare);

  postsQuery.equalTo(_k.flareGroupKey, group);
  postsQuery.descending(_k.classCreatedAt);
  postsQuery.include(_k.flareUserKey); //include the user object
  postsQuery.include(_k.flareGroupKey); //include the group object
  postsQuery.limit(10); //limit to the last ten posts by the user

  return postsQuery;
};

//------------------------------------------------------------------------------
// function: getPreviousPostByUser
//
// @params requestUser -
// @params postCreatedAt -
//------------------------------------------------------------------------------
exports.getPreviousPostByUser = function(requestUser, postCreatedAt) {
  var promise = new Parse.Promise();

  // Query post table for last flare by requestUser
  var previousPostsQuery = previousPostsByUserQuery(requestUser, postCreatedAt);

  previousPostsQuery.first({useMasterKey: true}).then(function(post) {
    promise.resolve(post);
  }, function(error) {
    // This is not an error, if an post is not found this might be the first flare
    // ever created by the user. use a promise resolve in this case
    promise.resolve();
  });

  return promise;
};

//------------------------------------------------------------------------------
// Private
//------------------------------------------------------------------------------

//------------------------------------------------------------------------------
// function: runJobActerSavePostObject
//
// @params request - the request payload from the caller
//------------------------------------------------------------------------------
function runJobAfterSavePostObject(request)
{
  Parse.Cloud.httpRequest({
    url: process.env.SERVER_URL + "/jobs/afterSavePostObject",
    method: "POST",
    headers: {
      'Content-Type': 'application/json',
      'X-Parse-Application-Id': Parse.applicationId,
      'X-Parse-Master-Key': Parse.masterKey
    },
    body: {
      "request": request,
    }
  }).then(function(httpResponse) {
    console.log(" runJobAfterSavePostObject succeeded: " + httpResponse.text);
  }, function(httpResponse) {
    console.log(" runJobAfterSavePostObject: Request failed with response code " + httpResponse.status);
  });
}

//------------------------------------------------------------------------------
// function: processNewPost
//
// @params requestUser - the User who saved the activity object
//------------------------------------------------------------------------------
function processNewPost (payload)
{
  var promise = new Parse.Promise();

  if (_.isUndefined(payload)) {
    promise.resolve();

    return promise;
  }

  //var requestParams = payload.params.request;
  var requestUser = _.isNull(payload.user) ? payload.object.get(_k.flareUserKey) : payload.user;
  var requestUserId = requestUser.id;
  var userQuery = new Parse.Query(Parse.User);

  // Hydrate the parse user object
  userQuery.get(requestUserId, {useMasterKey: true}).then(function(user) {
    requestUser = user;
    var postId = payload.object.id;
    var Flare = Parse.Object.extend(_k.flareTableName);
    var postQuery = new Parse.Query(Flare);

    // Hydrate the post object
    return postQuery.get(postId);
  }).then(function(post) {
    var newPostCreatedAt = post.get(_k.classCreatedAt);
    var promises = [];

    _.each(processNewPostFunctions, function(fnc) {
      promises.push(fnc(requestUser, post, newPostCreatedAt));
    });

    return Parse.Promise.when(promises);
  }).then(function(){
    promise.resolve();
  }, function(error) {
    promise.reject(error);
  });

  return promise;
}

//------------------------------------------------------------------------------
// function: incrementCountersForField
//
// Increment counters for the field selected (i.e. views, hearts)
//
// @params field - field to increment (views, hearts)
// @params request - request from client, which includes the user info
//------------------------------------------------------------------------------
function incrementCountersForField(field, request)
{
  var promise = new Parse.Promise();

  // User that made the request
  requestUser = request.user;

  // Flare object
  var flare = new Parse.Object(_k.flareTableName);
  flare.id = request.params.objectId;

  // Increment count for Flare
  incrementPostCounter(field, flare).then(function(updatedFlare) {
    return incrementAuthorCounter(field+"Total", updatedFlare);
  }).then(function(author) {
    return Activity.itemForCounter(field, flare, author, requestUser);
  }).then(function(sendPush) {
    // Don't send push notification if target user is same as the current user (yourself)
    if (flare.get(_k.flareUserKey) == requestUser[_k.classObjectId]) {
      sendPush = false;
    }

    promise.resolve(sendPush);
  }, function(error) {
    console.log("Failed to increment: " + field + " for post: " + flare.id);
    promise.reject("Failed to increment: " + field + " for post: " + flare.id);
  });

  return promise;
}


//------------------------------------------------------------------------------
// function: incrementPostCounter
//
// Increment counter associated with the post for the field selected (i.e. views, hearts)
//
// @params field - field to increment (views, hearts)
// @params request - request from client, which includes the user info
//------------------------------------------------------------------------------
function incrementPostCounter(field, flare)
{
  var promise = new Parse.Promise();

  // Increment view count for Flare
  flare.increment(field);
  flare.save(null, { useMasterKey: true}).then(function() {
    promise.resolve(flare);
  }, function(flare, error) {
    promise.reject("Unable to find object with id: " + flare.id, error);
  });

  return promise;
}

//------------------------------------------------------------------------------
// function: incrementAuthorCounter
//
// Increment counter associated with the author for the field selected (i.e. views, hearts)
//
// @params field - field to increment (views, hearts)
// @params request - request from client, which includes the user info
//------------------------------------------------------------------------------
function incrementAuthorCounter(field, flare)
{
  var promise = new Parse.Promise();

  var author;
  var Flare = Parse.Object.extend(_k.flareTableName);
  var query = new Parse.Query(Flare);
  query.include(_k.flareUserKey);

  query.get(flare.id, {useMasterKey: true}).then(function(flare) {
    author = flare.get(_k.flareUserKey, {useMasterKey: true});
    author.increment(field);
    return author.save(null, {useMasterKey: true});
  }).then (function() {
    promise.resolve(author);
  }, function(error) {
    console.log("error: incrementAuthorCounter: " + error.message);
    promise.reject(error);
  });

  return promise;
}

//------------------------------------------------------------------------------
// function: handleNewUserStory
//
// @params request - request from client, which includes the user info
// @params date -
//------------------------------------------------------------------------------
function processNewUserStory(requestUser, post, createdAt)
{
  var group = post.get(_k.flareGroupKey);

  // Do not process group posts
  if (!_.isUndefined(group)) {
    return Parse.Promise.as();
  }

  var promise = new Parse.Promise();

  _this.getPreviousPostByUser(requestUser, createdAt).then(function(previousPost) {

    // If there was no previous flare, this could be the first flare the user posted
    if (_.isUndefined(previousPost)) {
      return Activity.saveNewUserStory(requestUser, post);
    }

    // If the last flare was greater than 24 hours then send off a push notifcaiton
    // to all his followers excluding those he blocks
    var previousPostExpiresAt = previousPost.get(_k.flareExpiresAtKey, {useMasterKey: true});

    if (previousPostExpiresAt < createdAt) {
      return Activity.saveNewUserStory(requestUser, post);
    }

    return;
  }).then(function() {
    promise.resolve();
  }, function(error) {
    promise.reject(error);
  });

  // save a new story notification activity
  return promise;
}


//------------------------------------------------------------------------------
// function: handleNewGroupStory
//
// @params request - request from client, which includes the user info
// @params date -
//------------------------------------------------------------------------------
function processNewGroupStory(requestUser, post, createdAt)
{
  var group = post.get(_k.flareGroupKey, {useMasterKey: true});

  // Only process group posts
  if (_.isUndefined(group)) {
    return Parse.Promise.as();
  }

  var promise = new Parse.Promise();

  group.fetch().then(function(group){
    return getPreviousPostFromGroup(group, createdAt);
  }).then(function(previousPost) {

    // If there was no previous flare, this could be the first flare the user posted
    if (_.isUndefined(previousPost)) {
      return Activity.saveNewGroupStory(requestUser, post);
    }

    // If the last flare was greater than 24 hours then send off a push notifcaiton
    // to all his followers excluding those he blocks
    var previousPostExpiresAt = previousPost.get(_k.flareExpiresAtKey, {useMasterKey: true});
    if (previousPostExpiresAt < createdAt) {
      return Activity.saveNewGroupStory(requestUser, post);
    }

    return;
  }).then(function(){
    promise.resolve();
  }, function(error) {
    promise.reject(error);
  });

  // save a new story notification activity
  return promise;
}


//------------------------------------------------------------------------------
// function: previousPostsByUsersQuery
//
// @params users -
// @params newPostCreatedAt -
//------------------------------------------------------------------------------
function previousPostsByUserQuery(user, newPostCreatedAt)
{
  var Flare = Parse.Object.extend(_k.flareTableName);
  var postsQuery = new Parse.Query(Flare);

  postsQuery.equalTo(_k.flareUserKey, user);
  postsQuery.lessThan(_k.classCreatedAt, newPostCreatedAt);
  postsQuery.descending(_k.classCreatedAt);
  postsQuery.include(_k.flareUserKey); //include the user objects
  postsQuery.doesNotExist(_k.flareGroupKey);

  return postsQuery;
}

//------------------------------------------------------------------------------
// function: getPreviousPostFromGroup
//
// @params requestUser -
// @params postCreatedAt -
//------------------------------------------------------------------------------
function getPreviousPostFromGroup(group, postCreatedAt)
{
  var promise = new Parse.Promise();

  // Query post table for last flare by requestUser
  var previousPostsQuery = previousPostsFromGroupQuery(group);

  previousPostsQuery.first({useMasterKey: true}).then(function(post) {
    promise.resolve(post);
  }, function(error) {
    // This is not an error, if an post is not found this might be the first flare
    // ever created by the user. use a promise resolve in this case
    promise.resolve();
  });

  return promise;
}

//------------------------------------------------------------------------------
// function: previousPostsFromGroupQuery
//
// @params users -
// @params date -
//------------------------------------------------------------------------------
function previousPostsFromGroupQuery(group)
{
  var Flare = Parse.Object.extend(_k.flareTableName);
  var postsQuery = new Parse.Query(Flare);

  postsQuery.equalTo(_k.flareGroupKey, group);
  postsQuery.descending(_k.classCreatedAt);
  postsQuery.include(_k.flareUserKey); //include the user objects

  return postsQuery;
}
