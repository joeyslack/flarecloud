var _ = require('../lib/underscore-min.js');
var _k = require('../class/classConstants.js');
var Push = require('../utils/push.js');
var User = require('../class/user.js');

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
Parse.Cloud.define("newFriendJoinedNotification", function(request,response) {
  var currentUser = request.user;
  var toUserIds = request.params[_k.toUserIds];

  User.getUsersWithIds(toUserIds).then(function(toUsers) {
    Push.send(_k.pushPayloadActivityTypeJoin, toUsers, currentUser); 
    response.success(toUsers);
  }, function(error) {
    console.log("newFriendJoinedNotification Error: " + error.message);
    response.error(error);
  });
});