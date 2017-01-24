var _ = require('cloud/lib/underscore-min.js');
var _k = require('cloud/class/classConstants.js');
var Push = require('cloud/utils/push.js');
var User = require('cloud/class/user.js');

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

  Parse.Cloud.useMasterKey();

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

