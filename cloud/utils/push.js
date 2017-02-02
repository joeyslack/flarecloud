var _ = require('../lib/underscore-min.js');
var _k = require('../class/classConstants.js');
var NameUtil = require('../utils/name.js');

//------------------------------------------------------------------------------
// Public 
//------------------------------------------------------------------------------

//------------------------------------------------------------------------------
// function: alertPayload
//
// @params type - type of push notification (follow, comment, expired flare, etc)
// @params toUser - A single user or list of users to send the push notificaiton
// @params fromUser - THe user which send the notificaiton
// @params post - The post that this push notification is associated
//------------------------------------------------------------------------------
exports.send = function(type, toUsers, fromUser, post, group, text) 
{
  var promise = new Parse.Promise();

  var query = new Parse.Query(Parse.Installation);
  query.containedIn('user', toUsers);

  Parse.Push.send({
    where: query, // Set our Installation query.
    data: alertPayload(type, fromUser, post, group, text)
  }, {useMasterKey: true}).then(function(response) {
    // Push was successful
    //console.log('Sent push.');
    promise.resolve(response);
  }, function(error) {
    //console.log("Push Error " + error.code + " : " + error.message);
    promise.reject(error);
  });

  return promise;
};

//------------------------------------------------------------------------------
// Private
//------------------------------------------------------------------------------

//------------------------------------------------------------------------------
// function: alertMessage
//
// @params type - type of push notification (follow, comment, expired flare, etc)
// @params fullName - name of user which send the notificaiton
//------------------------------------------------------------------------------
var alertMessage = function(type, fullName, groupName, text) 
{
  var message = "";

  var mentionName = NameUtil.getMentionName(fullName);

  switch(type) {
    case _k.pushPayloadActivityTypeComment: 
    {
      var commentText = text;

      if(text.length > 100) {
        commentText = text.substring(0,99);
        commentText = commentText + '...';
      }

      if (!_.isUndefined(mentionName)) {
        message = mentionName + ': ' + commentText;
      }
    }
    break;

    case _k.pushPayloadActivityTypeMention: 
    {
      message = 'Someone mentioned you.'; 

      if (!_.isUndefined(mentionName)) {
        message = mentionName + ' mentioned you.';
      }
    }
    break;

    case _k.pushPayloadActivityTypeFollow:
    {
      message = 'You have a new follower.';

      if (!_.isUndefined(mentionName)) {
        message = mentionName + ' is now following you.';
      }
    }
    break;

    case _k.pushPayloadActivityTypeFollowRequest:
    {
      message = 'You have a new follow request.';

      if (!_.isUndefined(mentionName)) {
        message = mentionName + ' sent a request to follow you.';
      }
    }
    break;

    case _k.pushPayloadActivityTypeFollowRequestAccepted:
    {
      message = 'Your follow request was accepted!';

      if (!_.isUndefined(mentionName)) {
        message =  'You are now following ' + mentionName;
      }
    }
    break;

    case _k.pushPayloadActivityTypeExpiredStory:
      {
      message = 'Your story is about to expire. To keep the party going, send a flare!';
    }
    break;

    case _k.pushPayloadActivityTypeJoinedGroup:
      {
      message = 'Your homie ' + mentionName + ' just joined the ' + groupName + ' group. Get the party started, send a flare!';
    }
    break;

    case _k.pushPayloadActivityTypeNewUserStory:
      {
      message = 'Your friend started a new story!';

      if (!_.isUndefined(mentionName)) {
        message = mentionName + ' started a new story!';
      }
    }
    break;

    case _k.pushPayloadActivityTypeNewGroupStory:
      {
      message = 'A group you follow has a new story!';

      if (!_.isUndefined(groupName) && !_.isUndefined(mentionName)) {
        message =  mentionName + ' started a new ' + groupName + ' group story!';
      }
    }
    break;

    case _k.pushPayloadActivityTypeJoin:
    {
      message = 'Your friend just joined!';

      if (!_.isUndefined(mentionName)) {
        message =  'Your friend ' + mentionName + ' just joined!';
      }
    }
    break;

    case _k.pushPayloadActivityTypeViewedMentionReceipt:
    {
      message = 'Your friend saw your mention!';

      if (!_.isUndefined(mentionName)) {
        message =  mentionName + ' saw your mention!';
      }
    }
    break;
    
    case _k.pushPayloadActivityTypeAddMemberToGroup:
    {
      message = 'Your friend added you to a group ;)';

      if (!_.isUndefined(groupName) && !_.isUndefined(mentionName)) {
        message =  mentionName + ' added you to the ' + groupName + ' group ;)';
      }
    }
    break;

    case _k.pushPayloadActivityTypeHeart:
    {
      message = 'Your friend liked your flare!';

      if (!_.isUndefined(mentionName)) {
        message =  mentionName + ' liked your flare!';
      }
    }
    break;

    default:
      break;
  }

  // Trim our message to 140 characters.
  if (message.length > 140) {
    message = message.substring(0, 140);
  }

  return message;
};

//------------------------------------------------------------------------------
// function: alertPayload
//
// @params type - type of push notification (follow, comment, expired flare, etc)
// @params fromUser - THe user which send the notificaiton
// @params post - The post that this push notification is associated
//------------------------------------------------------------------------------
var alertPayload = function(type, fromUser, post, group, text) 
{
  var payload = {};

  var fromUserName;
  if (!_.isUndefined(fromUser)) {
    fromUserName = fromUser.get(_k.userFullNameKey);
  }

  var groupName;
  if (!_.isUndefined(group)) {
    groupName = group.get(_k.groupNameKey);
  }

  // Generate the push notification payload
  switch(type) {
    case _k.pushPayloadActivityTypeHeart:
    case _k.pushPayloadActivityTypeComment:
    {
      payload = {
        alert: alertMessage(type, fromUserName, undefined, text), // Set our alert message.
        badge: 'Increment', // Increment the target device's badge count.
        // The following keys help Anypic load the correct photo in response to this push notification.
        p: 'a', // Payload Type: Activity
        t: type, // Activity Type: Comment 'c' or mention 'm'
        fu: fromUser.id, // From User
        pid: post.id // Photo Id
      };
    }
    break;

    case _k.pushPayloadActivityTypeMention:
    case _k.pushPayloadActivityTypeViewedMentionReceipt:
    {
      payload = {
        alert: alertMessage(type, fromUserName), // Set our alert message.
        badge: 'Increment', // Increment the target device's badge count.
        // The following keys help Anypic load the correct photo in response to this push notification.
        p: 'a', // Payload Type: Activity
        t: type, // Activity Type: Comment 'c' or mention 'm'
        fu: fromUser.id, // From User
        pid: post.id // Photo Id
      };
    }
    break;

    case _k.pushPayloadActivityTypeFollow:
    case _k.pushPayloadActivityTypeFollowRequest:
    case _k.pushPayloadActivityTypeFollowRequestAccepted:
    {
      payload = {
        alert: alertMessage(type, fromUserName), // Set our alert message.
        badge: 'Increment', // Increment the target device's badge count.
        // The following keys help Anypic load the correct photo in response to this push notification.
        p: 'a', // Payload Type: Activity
        t: type, // Activity Type: follow 'f' or followRequest 'fr'
        fu: fromUser.id // From User
      };
    }
    break;

    case _k.pushPayloadActivityTypeNewUserStory:
      {
      payload = {
        alert: alertMessage(type, fromUserName, groupName), // Set our alert message.
        badge: 'Increment', // Increment the target device's badge count.
        // The following keys help Anypic load the correct photo in response to this push notification.
        p: 'a', // Payload Type: Activity
        t: type, // Activity Type: follow 'f' or followRequest 'fr'
        fu: fromUser.id, // From User
        pid: post.id // Photo Id
      };
    }
    break;

    case _k.pushPayloadActivityTypeNewGroupStory:
      {
      payload = {
        alert: alertMessage(type, fromUserName, groupName), // Set our alert message.
        badge: 'Increment', // Increment the target device's badge count.
        // The following keys help Anypic load the correct photo in response to this push notification.
        p: 'a', // Payload Type: Activity
        t: type, // Activity Type: follow 'f' or followRequest 'fr'
        fu: fromUser.id, // From User
        pid: post.id, // Photo Id
        gid: group.id // group id
      };
    }
    break;

    case _k.pushPayloadActivityTypeExpiredStory:
      {
      payload = {
        alert: alertMessage(type, fromUserName), // Set our alert message.
        badge: 'Increment', // Increment the target device's badge count.
        // The following keys help Anypic load the correct photo in response to this push notification.
        p: 'a', // Payload Type: Activity
        t: type, // Activity Type: follow 'f' or followRequest 'fr'
      };
    }
    break;

    case _k.pushPayloadActivityTypeAddMemberToGroup:
    case _k.pushPayloadActivityTypeJoinedGroup:
      {
      payload = {
        alert: alertMessage(type, fromUserName, groupName), // Set our alert message.
        badge: 'Increment',
        // The following keys help Anypic load the correct photo in response to this push notification.
        p: 'a', // Payload Type: Activity
        t: type, // Activity Type: joined group
        fu: fromUser.id, // From User
        gid: group.id // group id
      };
    }
    break;

    case _k.pushPayloadActivityTypeJoin:
      {
      payload = {
        alert: alertMessage(type, fromUserName), // Set our alert message.
        badge: 'Increment',
        // The following keys help Anypic load the correct photo in response to this push notification.
        p: 'a', // Payload Type: Activity
        t: type, // Activity Type: joined group
        fu: fromUser.id // From User
      };
    }
    break;

    default:
      break;
  }

  return payload;
};

