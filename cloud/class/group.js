var _this = this;
var _ = require('cloud/lib/underscore-min.js');
var _k = require('cloud/class/classConstants.js');
var GroupMembership = require('cloud/class/groupMembership.js');

//------------------------------------------------------------------------------
// Public 
//------------------------------------------------------------------------------

/**
* Get Suggested Groups for a user
* @param lat             Latitude
* @param long            Longitude
* @param user (optional) Requesting user
* @param sort (optional) Sort order
* @returns Array
*/
Parse.Cloud.define("getSuggestedGroups", function(request, response) {
  var lat = request.params.lat;
  var long = request.params.long;
  var userId = request.params.user;
  var sort = request.params.sort;

  var promise = new Parse.Promise();
  var query = new Parse.Query(Parse.Object.extend("Group"));
  var groupData = [];
  var suggestedGroups = ["PffrrMg3vS", "tdKR7UtI4x", "HOawUmSMXM", "POukz2riTS"];

  //Public, Catz, Puppy Dogs, Netflix & Chill
  query.containedIn("objectId", suggestedGroups);
  query.include(_k.groupCreatedByKey); //include the user objects
  query.find().then(function(groups) {
    for (var i=0; i<groups.length; i++) {
      groupData[suggestedGroups.indexOf(groups[i].id)] = groups[i];
    }

    response.success(groupData);
  }); 
});

//------------------------------------------------------------------------------
// Cloud Code: deleteGroup
// Called from iOS, handle full deletion of group.
//
// @params request  object
// @params response object
//------------------------------------------------------------------------------
Parse.Cloud.define("deleteGroup", function(request, response) {
  var groupId = request.params.groupId;

  _this.exports.getGroupWithId(groupId).then(function(group) {
    var promise = Parse.Promise.as();

    //1. Remove pending invites to this group
    promise = promise.then(function() {
      return require('cloud/class/invite.js').deleteInvitesForGroup(group.id);
    });

    //2. Remove members from group
    promise = promise.then(function() {
      return GroupMembership.deleteMembers(group);
    });

    //3. Delete the actual group
    promise = promise.then(function() {
      return group.destroy();
    });

    return promise;
  }).then(function(success) {
    response.success("Destroyed group successfully");
  }, function(error) {
    response.error("Error, problem destroying group");
  });
});

//------------------------------------------------------------------------------
// function: getGroupsUserFollows
//
// @params requestUser -
//------------------------------------------------------------------------------
exports.getGroupsUserFollows = function(requestUser) {

  var promise = new Parse.Promise();

  var groupMembershipsQuery = GroupMembership.forUserQuery(requestUser);
  
  groupMembershipsQuery.find().then(function(groupMemberships) {
    var groups = [];
    _.each(groupMemberships, function(groupMembership) {
      var groupObject = groupMembership.get(_k.groupMembershipGroupKey);
      if (!_.isEmpty(groupObject)) {
        groups.push(groupObject);
      }
    });

    promise.resolve(groups);
  }, function(error) {
    console.log("Error: getGroupsUserFollows: " + error.message);
    promise.reject(error);
  });
  
  return promise;
};


//------------------------------------------------------------------------------
// function: getGroupWithId
//
// @params id - group id
//------------------------------------------------------------------------------

exports.getGroupWithId = function(id) 
{
  var promise = new Parse.Promise();

  var GroupClass = Parse.Object.extend(_k.groupTableName);
  var query = new Parse.Query(GroupClass);
  query.equalTo(_k.classObjectId, id);

  query.first().then(function(group){
    promise.resolve(group);
  }, function(error) {
    promise.reject();
  });

  return promise;
};

