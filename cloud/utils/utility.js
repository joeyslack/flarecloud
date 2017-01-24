var _ = require('cloud/lib/underscore-min.js');
var _k = require('cloud/class/classConstants.js');

//------------------------------------------------------------------------------
// function: collectionUnion
//
//------------------------------------------------------------------------------
exports.collectionUnion = function() 
{
  var args = Array.prototype.slice.call(arguments);
  var it = args.pop();

  return _.uniq(_.flatten(args, true), it);
};


//------------------------------------------------------------------------------
// function: collectionIntersection
//
//------------------------------------------------------------------------------
exports.collectionIntersection = function(array) 
{
  var slice = Array.prototype.slice;
  var rest = slice.call(arguments, 1);
  return _.filter(_.uniq(array), function(item) {
    return _.every(rest, function(other) {
      //return _.indexOf(other, item) >= 0;
      return _.any(other, function(element) { return element.id === item.id; });
    });
  });
};

//------------------------------------------------------------------------------
// function: existed
//
//------------------------------------------------------------------------------
exports.existed = function(object) 
{
  var createdAt = object.get(_k.classCreatedAt);
  var updatedAt = object.get(_k.classUpdatedAt);
  
  return (createdAt.getTime() != updatedAt.getTime());
};

//------------------------------------------------------------------------------
// function: randomObjectFromArray
//
//------------------------------------------------------------------------------
exports.randomObjectFromArray = function(array) 
{
  if (_.isUndefined(array) || _.isNull(array) || array.length <= 1) {
    return;
  }

  var min = 0; var max = array.length;
  var index = Math.floor(Math.random() * (max - min) + min);

  return array[index];
};

//------------------------------------------------------------------------------
// function: getInviteMediaUrl
//
//------------------------------------------------------------------------------
exports.getInviteMediaUrl = function(fromUser) 
{
  if (_.isUndefined(fromUser) || _.isNull(fromUser)){
    return;
  }

  var promise = new Parse.Promise();
  var today = new Date();
  var getPreviousPostByUserFunc = require('cloud/class/flare.js').getPreviousPostByUser;

  getPreviousPostByUserFunc(fromUser, today).then(function(post) {
    
    if (_.isEmpty(post)) {
       promise.resolve("No image found");
       return;
    }

    var imageUrl = post.get(_k.flareImageKey);
    var videoUrl = post.get(_k.flareVideoKey);

    promise.resolve(imageUrl, videoUrl);
  }, function(error) {
    // This is not an error, if an post is not found this might be the first flare
    // ever created by the user. use a promise resolve in this case
    promise.reject(error);
  });

  return promise;
};

/**
* Get profile picture
* @param   id  string  user id
* @returns promise
**/
exports.getProfilePictureForUser = function(id) {
  if (_.isEmpty(id)) {
    promise.resolve("no user id provided");
    return promise;
  }

  var promise = new Parse.Promise();
  var query = new Parse.Query(Parse.User);
  query.equalTo(_k.classObjectId, id);

  query.first().then(function(user) {

    if (!_.isEmpty(user.get('thumbnail'))) {
      promise.resolve(user.get('thumbnail'));
    }
    else {
      promise.resolve();
    }
  }, function(error) {
    promise.reject(error);
  });

  return promise;
}
