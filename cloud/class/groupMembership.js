var _this = this;
var _ = require('../lib/underscore-min.js');
var _k = require('../class/classConstants.js');
var Push = require('../utils/push.js');
var User = require('../class/user.js');

//------------------------------------------------------------------------------
// Public
//------------------------------------------------------------------------------

//------------------------------------------------------------------------------
// function: acceptFollowRequest
//
// @params request -
// @params response -
//------------------------------------------------------------------------------
Parse.Cloud.define("addMembersToGroup", function(request,response) {
  var currentUser = request.user;
  var adminId = request.params.groupAdminUserId;
  var groupId = request.params.groupId;
  var addMemberUserIds = request.params.groupMemberUserIds;
  var addMemberUsers;

  var group;
  var users = [];

  var getGroupWithIdFunc = require('cloud/class/group.js').getGroupWithId;

  // Increment views count for Flare
  getGroupWithIdFunc(groupId).then(function(groupObject) {
    group = groupObject;
    return User.getUsersWithIds(addMemberUserIds);
  }).then(function(userObjects) {
    addMemberUsers = userObjects;
    return _this.getMemberships(group);
  }).then(function(memberships) {

    var usersInGroup = [];
    _.each(memberships, function(membership) {
      usersInGroup.push(membership.get(_k.groupMembershipUserKey));
    });

    var userObjects = addMemberUsers;

    //Remove add request for user id that is already a member
    addMemberUsers = _.reject(addMemberUsers, function(addUser) {
      return _.where(usersInGroup, {id: addUser.id}).length > 0;
    });

    //If no new members to add then return an error
    if (addMemberUsers.length === 0 && userObjects.length > 0) {
      var groupName = _.isEmpty(group) ? "" : group.get(_k.groupNameKey);
      var groupDescription = " already in the " + groupName + " group.";

      var namesString = "";

      for (var i = 0; i < userObjects.length; i++) {
         var name = userObjects[i].get(_k.userFullNameKey);
         namesString += name;

         if (userObjects.length === 2) {
           namesString += " and ";
         }
         else if (i > 0) {
           if (i === (userObjects.length - 2)) {
             namesString += " and ";
           }
           else if (i < (userObjects.length - 2)) {
             namesString += ", ";
           }
         }
      }

      var errorDescription;
      if (namesString.length > 0) {
         errorDescription = namesString + " is" + groupDescription;
      } else {
         errorDescription = namesString + " are" + groupDescription;
      }

      response.error(errorDescription);
      return;
    }

    var addMembersPromise = [];

    //Add admin
    if (!_.isEmpty(adminId) && currentUser.id === adminId) {
      addMembersPromise.push(saveGroupMembership(group, currentUser, currentUser, "admin"));
    }

    _.each(addMemberUsers, function (member) {
      addMembersPromise.push(saveGroupMembership(group, currentUser, member, "member"));
    });

    return Parse.Promise.when(addMembersPromise);
  }).then(function() {

    // If user adds himself to a group do not send push notification to currentUser
    var notifyMemberUsers = _.reject(addMemberUsers, function(addMember) {
      return addMember.id === currentUser.id;
    });

    return Push.send(_k.pushPayloadActivityTypeAddMemberToGroup, notifyMemberUsers, currentUser, undefined, group);
  }).then(function() {
    // Include the admin user when looking up the group members
    if (!_.isEmpty(adminId) && currentUser.id === adminId) {
      addMemberUsers.push(currentUser);
    }

    return _this.areUsersInGroupQuery(addMemberUsers, group).find({useMasterKey: true});
  }).then(function(newGroupMemberships) {
    response.success(newGroupMemberships);
  }, function(error) {
    console.log("addMembersToGroup Error: " + error.message);
    response.error(error);
  });

});

//------------------------------------------------------------------------------
// function: autofollownewuser
//
// @params request -
//------------------------------------------------------------------------------
exports.newUserJoinedGroup = function(group, fromuser, newuser)
{
  if (_.isUndefined(group) || _.isNull(group) || _.isUndefined(fromUser) || _.isNull(fromUser)) {
    return Parse.Promise.as();
  }

  var promise = new Parse.Promise();

  // Query for any invite for the new user, based on the phone number supplied
  var GroupMemClass = Parse.Object.extend(_k.groupMembershipTableName);
  var groupMemQuery = new Parse.Query(GroupMemClass);

  groupMemQuery.equalTo(_k.groupMembershipGroupKey, group);
  groupMemQuery.equalTo(_k.groupMembershipUserKey, newUser);

  groupMemQuery.first({useMasterKey: true}).then(function(object) {
    // if the user is not part of the group
    if (_.isUndefined(object)) {
      // Send group notififcation before adding the new user to the group
      _this.sendNotificationToGroup(_k.pushPayloadActivityTypeJoinedGroup, group, undefined, newUser);
      return saveGroupMembership(group, fromUser, newUser, "member"); // Cloud code only handles members of groups not admins
    } else {
      console.log("object: " + object.id + "user: " + newUser.id + " is already part of group: " + group.id);
      return Parse.Promise.as();
    }
  }).then(function(){
    promise.resolve();
  }, function(error) {
    console.log("GroupMembership query: addUserToGroup error: " + error.message);
    promise.reject(error);
  });

  return promise;
};

//------------------------------------------------------------------------------
// function: sendNotificationToGroup
//
// @params request -
//------------------------------------------------------------------------------
exports.sendNotificationToGroup = function(pushPayloadType, group, post, fromUser)
{
  if (_.isUndefined(group) || _.isNull(group) || _.isUndefined(fromUser) || _.isNull(fromUser)) {
    return Parse.Promise.as();
  }

  var promise = new Parse.Promise();

  // Query for any invite for the new user, based on the phone number supplied
  var GroupMemClass = Parse.Object.extend(_k.groupMembershipTableName);
  var groupMemQuery = new Parse.Query(GroupMemClass);

  groupMemQuery.equalTo(_k.groupMembershipGroupKey, group);
  groupMemQuery.include(_k.groupMembershipUserKey);
  groupMemQuery.limit(1000);

  groupMemQuery.find({useMasterKey: true}).then(function(objects) {

    var toUsers = [];
    // For user, auto follow
    if (objects.length > 0) {
      _.each(objects, function (object) {
        member = object.get(_k.groupMembershipUserKey);

        if (fromUser.id != member.id) {
          toUsers.push(member);
        }
      });
    }

    if (toUsers.length > 0 ) {
      // Send push notification to users who have invited this user
      return Push.send(pushPayloadType, toUsers, fromUser, post, group);
    } else {
      return Parse.Promise.as();
    }

  }).then(function() {
    promise.resolve();
  }, function(error) {
    console.log("Error: Push notification not sent, unable to find users for group: " + group.id + " error: " + error.message);
    promise.reject(error);
  });

  return promise;
};

//------------------------------------------------------------------------------
// function: groupsUserFollowsQuery
//
// @params user -
//------------------------------------------------------------------------------
exports.forUserQuery = function(user)
{
  var GroupMembership = Parse.Object.extend(_k.groupMembershipTableName);
  var groupMembershipQuery = new Parse.Query(GroupMembership);

  groupMembershipQuery.equalTo(_k.groupMembershipUserKey, user);
  groupMembershipQuery.include(_k.groupMembershipGroupKey);
  groupMembershipQuery.limit(1000);

  return groupMembershipQuery;
};

//------------------------------------------------------------------------------
// function: getMemberships
//
// @params  group object
// @returns array Result of query
//------------------------------------------------------------------------------
exports.getMemberships = function(group)
{
  var groupMembershipQuery = new Parse.Query(_k.groupMembershipTableName);
  groupMembershipQuery.equalTo(_k.groupMembershipGroupKey, group);
  groupMembershipQuery.include(_k.groupMembershipUserKey);

  return groupMembershipQuery.find({useMasterKey: true});
};

//------------------------------------------------------------------------------
// function: deleteMembers
//
// @params  group object
// @returns array Result of query
//------------------------------------------------------------------------------
exports.deleteMembers = function(group)
{
  var groupMembershipQuery = new Parse.Query(_k.groupMembershipTableName);
  groupMembershipQuery.equalTo(_k.groupMembershipGroupKey, group);

  groupMembershipQuery.find({useMasterKey: true}).then(function(members) {
    return Parse.Object.destroyAll(members, {useMasterKey: true});
  });
};

//------------------------------------------------------------------------------
// function: areUsersIngroupQuery
//
// @params user -
//------------------------------------------------------------------------------
exports.areUsersInGroupQuery = function(users, group)
{
  var GroupMembership = Parse.Object.extend(_k.groupMembershipTableName);
  var groupMembershipQuery = new Parse.Query(GroupMembership);

  groupMembershipQuery.containedIn(_k.groupMembershipUserKey, users);
  groupMembershipQuery.equalTo(_k.groupMembershipGroupKey, group);
  groupMembershipQuery.include(_k.groupMembershipGroupKey);
  groupMembershipQuery.include(_k.groupMembershipUserKey);
  groupMembershipQuery.limit(1000);

  return groupMembershipQuery;
};

//------------------------------------------------------------------------------
// Private
//------------------------------------------------------------------------------

//------------------------------------------------------------------------------
// function: groupMembership
//
// @params request -
//------------------------------------------------------------------------------
var saveGroupMembership = function(group, createdBy, user, rank)
{
  if (_.isUndefined(group) || _.isNull(group) || _.isUndefined(user) || _.isNull(user)) {
    return Parse.Promise.as();
  }

  var promise = new Parse.Promise();

  // Add the mention into the Activity class
  var groupMemClass = Parse.Object.extend(_k.groupMembershipTableName);
  var groupMem = new groupMemClass();

  groupMem.set(_k.groupMembershipGroupKey, group);
  groupMem.set(_k.groupMembershipUserKey, user);

  if (!_.isUndefined(createdBy)) {
    groupMem.set(_k.groupMembershipCreatedByKey, createdBy);
  }

  if (!_.isUndefined(rank)) {
    groupMem.set(_k.groupMembershipRankKey, rank);
  }

  var groupMemACL = new Parse.ACL();
  groupMemACL.setPublicReadAccess(true);
  groupMemACL.setPublicWriteAccess(true);
  groupMem.setACL(groupMemACL);

  groupMem.save(null, {useMasterKey: true}).then(function(membership) {
    console.log("Group Membership saved: group: " + membership.get(_k.groupMembershipGroupKey).id + " user: " + membership.get(_k.groupMembershipUserKey).id + " rank: " + membership.get(_k.groupMembershipRankKey));
    promise.resolve(membership);
  }, function(object, error) {
    console.log("failed to create new group membership object with error code: " + error.message);
    promise.reject(error);
  });
};
