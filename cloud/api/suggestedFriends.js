var _ = require('../lib/underscore-min.js');
var _k = require('../class/classConstants.js');
var Following = require('../api/following.js');
var Utility = require('../utils/utility.js');
var User = require('../class/user.js');

//------------------------------------------------------------------------------
// Local Defines 
//------------------------------------------------------------------------------

var minMutualFriends = 2;
var maxNumberOfSuggestedFriends = 20;
var maxNumberOfFriendsSearched = 50;

//------------------------------------------------------------------------------
// Public 
//------------------------------------------------------------------------------

//------------------------------------------------------------------------------
// function: getSuggestedFriendsForUser
//
// @params request -
// @params response - 
//------------------------------------------------------------------------------
Parse.Cloud.define("getSuggestedFriendsForUser", function(request, response) {
  var currentUser = request.user;
  
  // Increment views count for Flare
  findSuggestedFriends(currentUser).then(function(suggestedFriends) {
    // Only return a suggested friends up to a maximum number
    suggestedFriends = suggestedFriends.slice(0, maxNumberOfSuggestedFriends-1);    
    response.success(suggestedFriends);
  }, function(error) {
    response.error(error);
  });
});

//------------------------------------------------------------------------------
// function: getMutualFriendsForUsers
//
// @params request -
// @params response - 
//------------------------------------------------------------------------------
Parse.Cloud.define("getMutualFriendsForUser", function(request,response) {
  var currentUser = request.user;
  var otherUserId = request.params.otherUserId;
  var usersOtherUserFollows = [];

  // find the othe user object, get users that friend follows
  User.getUserWithId(otherUserId).then(function(otherUser) {
    
    return Following.getFollowingUsers(otherUser);
  }).then(function(following) {
    usersOtherUserFollows = following; 
    
    return Following.getFollowingUsers(currentUser);
  }).then(function(usersCurrentUserFollows) {
    var mutualFriends = Utility.collectionIntersection(usersCurrentUserFollows, usersOtherUserFollows);
    response.success(mutualFriends);
  }, function(error) {
    response.error(error);
  });
});

//------------------------------------------------------------------------------
// Private
//------------------------------------------------------------------------------

//------------------------------------------------------------------------------
// function: findSuggestedFriends
//
// @params me - user who requested the notification activity
//------------------------------------------------------------------------------
function findSuggestedFriends(me) {
  var promise = new  Parse.Promise();

  var numberOfFriendsSearched = 0;
  var suggestedFriends = [];
  var weightsList = {};  //suggested friends user id and score | k:userId v:number
  
  Following.getFollowingUsers(me).then(function(myFriends) {
    var excludeUsers = myFriends.concat(me);
    
    var serialPromise = Parse.Promise.as();

    _.each(myFriends, function(myFriend) {
      
      serialPromise = serialPromise.then(function() {
        
        numberOfFriendsSearched++;

        // Return early if the number of suggested friends reaches the max number
        if (numberOfFriendsSearched >= maxNumberOfFriendsSearched) {
          return Parse.Promise.as(suggestedFriends);
        }
        
        // Get the suggested freinds from each of my friends
        return getSuggestedFriendsFromFriend(myFriend, suggestedFriends, weightsList, excludeUsers).then(function(updatedSuggestedFriends, updatedWeightsList) {
          suggestedFriends = _.isUndefined(updatedSuggestedFriends) ? [] : updatedSuggestedFriends;
          weightsList = _.isUndefined(updatedWeightsList) ? {} : updatedWeightsList;
         
        });
      });
    });

    return serialPromise;
  }).then(function(newSuggestedFriends, newWeightsList) {
    promise.resolve(suggestedFriends);
  }, function(error){
    promise.reject(error);
  });  

  return promise;
}

//------------------------------------------------------------------------------
// function: getSuggestedFriendsFromFriend
//
// @params followingUsers - user who requested the notification activity
//------------------------------------------------------------------------------
function getSuggestedFriendsFromFriend(myFriend, suggestedFriends, weightsList, excludeUsers) {
  var promise = new Parse.Promise();

  Following.getFollowingUsers(myFriend).then(function(friendsOfFriend) {
    return filterAndWeightUsers(excludeUsers, friendsOfFriend, weightsList);
  }).then(function(filteredFriends, newWeightsList) {
    return combineAndSortSuggestedFriends(suggestedFriends, filteredFriends, newWeightsList);
  }).then(function(newSuggestedFriends, newWeightsList) {
    promise.resolve(newSuggestedFriends, newWeightsList);
  }, function(error) {
    promise.reject(error); 
  });

  return promise;
}

//------------------------------------------------------------------------------
// function: filterAndWeightUser
//
// @params followingUsers - user who requested the notification activity
//------------------------------------------------------------------------------
function filterAndWeightUsers(excludeUsers, friendsOfFriend, weightsList) {

  var promise = new Parse.Promise();

  // Remove any exclude users from the freinds of freinds list
  var filteredFriends =  _.reject(friendsOfFriend, function(item) {
      return _.where(excludeUsers, {id: item.id}).length > 0;
  });

  _.each(filteredFriends, function(friend) {
    // Increment the weight if the friend id exists in the list, otherwise set to 1
    weightsList[friend.id] = _.has(weightsList, friend.id) ? weightsList[friend.id] + 1 : 1;
  });

  promise.resolve(filteredFriends, weightsList);
  return promise;
}

//------------------------------------------------------------------------------
// function: filterAndWeightUser
//
// @params followingUsers - user who requested the notification activity
//------------------------------------------------------------------------------
function combineAndSortSuggestedFriends(suggestedFriends, friendsToAdd, weightsList) {

  var promise = new Parse.Promise();

  // Remove any exclude users from the freinds of freinds list
  var newSuggestedFriends = Utility.collectionUnion(suggestedFriends,friendsToAdd, function(item){
    return item.id;
  }); 

  // Only include friends with minimum number of mutual friends
  newSuggesteFriends = _.reject(newSuggestedFriends, function(item) {
    return (weightsList[item.id] < minMutualFriends);
  });

  // Sorty by ascending order by the weights
  newSuggestedFriends = _.sortBy(newSuggestedFriends, function(friend){
      return weightsList[friend.id];
  });

  // Sort by descending order
  var sortedSuggestedFriends = newSuggestedFriends.reverse();

  promise.resolve(sortedSuggestedFriends, weightsList);
  return promise;
}

