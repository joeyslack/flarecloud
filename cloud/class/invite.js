var _ = require('../lib/underscore-min.js');
var _k = require('../class/classConstants.js');
var GroupMembership = require('../class/groupMembership.js');

//------------------------------------------------------------------------------
// Public 
//------------------------------------------------------------------------------

//------------------------------------------------------------------------------
// function: autoFollowNewUser 
//
// @params request -
//------------------------------------------------------------------------------
exports.autoFollowNewUser = function(newUser) 
{
  if (_.isUndefined(newUser) || _.isNull(newUser)) {
    return;
  }
  
  var promise = new Parse.Promise();

  // Query for any invite for the new user, based on the phone number supplied 
  var phoneNumber = newUser.get(_k.userDeprecatedPhoneNumberKey, {useMasterKey: true});
  phoneNumber = !_.isUndefined(phoneNumber) ? phoneNumber : "";

  var normalizedPhoneNumber = newUser.get(_k.userPhoneNumberKey, {useMasterKey: true});
  normalizedPhoneNumber = !_.isUndefined(normalizedPhoneNumber) ? normalizedPhoneNumber : "";

  console.log(" autoFollowNewUser: normalizedPhoneNumber: " + normalizedPhoneNumber);
  
  var InviteClass = Parse.Object.extend(_k.inviteTableName);
  var phoneNumberInviteQuery = new Parse.Query(InviteClass);

  phoneNumberInviteQuery.doesNotExist(_k.inviteGroupKey);
  phoneNumberInviteQuery.equalTo(_k.inviteToPhoneNumberKey, phoneNumber);
  phoneNumberInviteQuery.include(_k.inviteFromUserKey);

  var normalizedPhoneNumberInviteQuery = new Parse.Query(InviteClass);

  normalizedPhoneNumberInviteQuery.doesNotExist(_k.inviteGroupKey);
  normalizedPhoneNumberInviteQuery.equalTo(_k.inviteToPhoneNumberKey, normalizedPhoneNumber);
  normalizedPhoneNumberInviteQuery.include(_k.inviteFromUserKey);
  
  var inviteQuery = Parse.Query.or(phoneNumberInviteQuery, normalizedPhoneNumberInviteQuery);
  inviteQuery.first({useMasterKey: true}).then(function(objects) {

    if (_.isUndefined(objects)) {
      return;
    }

    var followUser = require('activity.js').followUser;

    // For each invite, auto follow  
    if (objects.length > 0) {

      var followPromises = [];

      _.each(objects, function (object) {
        // Save a follow object for each pending invite for thie new user
        var fromUser = object.get("fromUser", {useMasterKey: true});
        followPromises.push(followUser(fromUser, newUser)); 

        // TODO: maybe send a push notification to the existing user that a friend has joined flare
      });

      return Parse.Promise.when(followPromises);
    } else {
      return;
    }

  }).then(function(){
    promise.resolve();
  }, function(error) {
    console.log("Error auto-following new user: " + error.message);
    promise.reject(error);
  });

  return promise;
};


//------------------------------------------------------------------------------
// function: autoFollowNewUserGroups 
//
// @params request -
//------------------------------------------------------------------------------
exports.autoFollowNewUserGroups = function(newUser) 
{
  
  if (_.isUndefined(newUser) || _.isNull(newUser)) {
    return;
  }

  var promise = new Parse.Promise();

  // Query for any invite for the new user, based on the phone number supplied 
  var phoneNumber = newUser.get(_k.userDeprecatedPhoneNumberKey, {useMasterKey: true});
  phoneNumber = !_.isUndefined(phoneNumber) ? phoneNumber : "";

  var normalizedPhoneNumber = newUser.get(_k.userPhoneNumberKey, {useMasterKey: true});
  normalizedPhoneNumber = !_.isUndefined(normalizedPhoneNumber) ? normalizedPhoneNumber : "";

  console.log("normalizedPhoneNumber: " + normalizedPhoneNumber);
  var InviteClass = Parse.Object.extend(_k.inviteTableName);
  var phoneNumberInviteQuery = new Parse.Query(InviteClass);

  phoneNumberInviteQuery.exists(_k.inviteGroupKey);
  phoneNumberInviteQuery.equalTo(_k.inviteToPhoneNumberKey, phoneNumber);
  phoneNumberInviteQuery.include(_k.inviteFromUserKey);

  var normalizedPhoneNumberInviteQuery = new Parse.Query(InviteClass);

  normalizedPhoneNumberInviteQuery.exists(_k.inviteGroupKey);
  normalizedPhoneNumberInviteQuery.equalTo(_k.inviteToPhoneNumberKey, normalizedPhoneNumber);
  normalizedPhoneNumberInviteQuery.include(_k.inviteFromUserKey);
  
  var groupsInviteQuery = Parse.Query.or(phoneNumberInviteQuery, normalizedPhoneNumberInviteQuery);

  groupsInviteQuery.limit(1000);
  groupsInviteQuery.include(_k.inviteFromUserKey);

  groupsInviteQuery.find({useMasterKey: true}).then(function(objects) {

    console.log("groups: "+ JSON.stringify(objects));
    // For each invite, auto follow  
    if (objects.length > 0) {

      var followUser = require('activity.js').followUser;

      var followUsersPromises = [];

      _.each(objects, function (object) {
        // Save a follow object for each pending invite for thie new user
        var group = object.get(_k.inviteGroupKey, {useMasterKey: true});
        var fromUser = object.get(_k.inviteFromUserKey, {useMasterKey: true});

        GroupMembership.newUserJoinedGroup(group, fromUser, newUser); 

        // If someone invites you to a group, auto-follow the person that invited you
        followUsersPromises.push(followUser(fromUser, newUser));

        // TODO: maybe send a push notification to the existing user that a friend has joined flare

      });

      return Parse.Promise.when(followUsersPromises);
    } else {
      return;
    }
  }).then(function(){
    promise.resolve();
  }, function(error) {
    console.log("`Error - adding user: " + newUser.get(_k.userFullNameKey, {useMasterKey: true}) + "(" + newUser.id +") to the group: " + group.id + " error: "+ error.message);
    promise.reject(error);
  });

  return promise;
};

//------------------------------------------------------------------------------
// function: deleteInvitesForGroup
//
// @params request -
//------------------------------------------------------------------------------
exports.deleteInvitesForGroup = function(groupId)
{
  var InviteClass = Parse.Object.extend(_k.inviteTableName);
  var invitesQuery = new Parse.Query(InviteClass);
  
  invitesQuery.equalTo(_k.inviteGroupIdStringKey, groupId);
  invitesQuery.find({useMasterKey: true}).then(function(invites) {
    return Parse.Object.destroyAll(invites, {useMasterKey: true});
  });
};

//------------------------------------------------------------------------------
// function: saveForPhoneNumbers
//
// @params phoneNumbers - the phone numbers to either send a push notification or invite 
//------------------------------------------------------------------------------
exports.saveForPhoneNumbers = function(phoneNumbers, fromUser, channel, group) 
{
  var promise = new Parse.Promise();
  var invitesQuery = inviteFromUserToPhoneNumbersQuery(fromUser, phoneNumbers, channel, group);

  console.log(invitesQuery);
  invitesQuery.find({useMasterKey: true}).then(function(invites) {

    var inviteExistsForPhoneNumbers = [];
    _.each(invites, function(invite) {
      var invitedPhoneNumber = invite.get(_k.inviteToPhoneNumberKey, {useMasterKey: true});
      inviteExistsForPhoneNumbers.push(invitedPhoneNumber);
    });

    // Remove the phone numbers that have already been invited
    var filteredPhoneNumbers = _.difference(phoneNumbers, inviteExistsForPhoneNumbers);

    if (_.isUndefined(filteredPhoneNumbers) || filteredPhoneNumbers.length === 0) {
      return Parse.Promise.as();
    }

    var invitePromises = [];

    _.each(filteredPhoneNumbers, function(phoneNumber) {
      console.log("Saved invite for phoneNumbers: " + phoneNumber);
      invitePromises.push(saveInvite(fromUser, phoneNumber, channel, group));
    });

    return Parse.Promise.when(invitePromises);
  }).then(function() {
    promise.resolve();
  },function(error) {
    promise.reject(error);
  });

  return promise;
};


//------------------------------------------------------------------------------
// Private 
//------------------------------------------------------------------------------

//------------------------------------------------------------------------------
// function: inviteFromUserToPhoneNumbersQuery 
//
// @params request -
//------------------------------------------------------------------------------
var inviteFromUserToPhoneNumbersQuery = function(fromUser, phoneNumbers, channel, group) 
{
  var Invite = Parse.Object.extend(_k.inviteTableName);
  var invitesQuery = new Parse.Query(Invite);

  invitesQuery.equalTo(_k.inviteFromUserKey, fromUser);
  invitesQuery.equalTo(_k.inviteChannelKey, channel);
  invitesQuery.containedIn(_k.inviteToPhoneNumberKey, phoneNumbers);

  if (!_.isUndefined(group)) {
    invitesQuery.equalTo(_k.inviteGroupKey, group);
  }

  invitesQuery.include(_k.inviteGroupKey); //include the user objects
  invitesQuery.include(_k.inviteFromUserKey); //include the user objects

  return invitesQuery;
};

//------------------------------------------------------------------------------
// function: saveInvite 
//
// @params request -
//------------------------------------------------------------------------------
var saveInvite = function(fromUser, phoneNumber, channel, group) 
{
  var promise = new Parse.Promise();

  // Add the mention into the Activity class
  var InviteClass = Parse.Object.extend(_k.inviteTableName);
  var invite = new InviteClass();

  if (!_.isUndefined(fromUser)) {
    invite.set(_k.inviteFromUserKey, fromUser);
    invite.set(_k.inviteFromUserIdStringKey, fromUser.id);
  }

  if (!_.isUndefined(group)) {
    invite.set(_k.inviteGroupKey, group);
    invite.set(_k.inviteGroupIdStringKey, group.id);
  }

  if (!_.isUndefined(phoneNumber)) {
    invite.set(_k.inviteToPhoneNumberKey, phoneNumber);
  }

  if (!_.isUndefined(channel)) {
    invite.set(_k.inviteChannelKey, channel);
  }

  var inviteACL = new Parse.ACL(fromUser);
  inviteACL.setPublicReadAccess(true);
  invite.setACL(inviteACL);

  invite.save(null, {useMasterKey: true}).then(function(invite) {
    console.log("Invite saved: fromUser: " + invite.get(_k.inviteFromUserIdStringKey, {useMasterKey: true}) + " phoneNumber: " + invite.get(_k.inviteToPhoneNumberKey, {useMasterKey: true}) + " channel: " + invite.get(_k.inviteChannelKey, {useMasterKey: true}) + " group: " + invite.get(_k.inviteGroupIdStringKey, {useMasterKey: true}));

    promise.resolve();
  }, function(invite, error) {
    console.log("failed to create new invite object with error code: " + error.message);
    promise.reject(error);
  });

  return promise;
};
