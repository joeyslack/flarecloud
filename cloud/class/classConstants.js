function define(name, value) {
  Object.defineProperty(exports, name, {
    value: value,
    enumerable: true
  });
}


define("appName", "Flare");
define("flareBearUserId", "rOroXQDUjZ");

//------------------------------------------------------------------------------
// Class 
//------------------------------------------------------------------------------

define("classCreatedAt", "createdAt");
define("classUpdatedAt", "updatedAt");
define("classObjectId", "objectId");

// This is a parameter for cloud code function: acceptFollowRequest and declineFollowRequest
// NOTE: can not pass a PFObject to a cloud code function, must pass the object ID string
define("fromUserId", "fromUserId");
define("toUserIds", "toUserIds");

//------------------------------------------------------------------------------
// User Class 
//------------------------------------------------------------------------------

define("userTableName", "User");

// UserClass: Table Column Keys
define("userFullNameKey", "fullName");
define("userEmailKey", "email");
define("userUsernameKey", "username");
define("userDeprecatedPhoneNumberKey", "additional");  // DEPRECATED: This is the name of the old phone number table key, use "normalizedPhoneNumber"
define("userPhoneNumberKey", "normalizedPhoneNumber");
define("userCountryCodeKey", "countryCode");
define("userThumbnailKey", "thumbnail");
define("userLastFlareKey", "flare");
define("userFlareExpiresAtKey", "flareExpiresAt");
define("userViewsTotalKey", "viewsTotal");
define("userHeartsTotalKey", "heartsTotal");
define("userChannelKey", "channel");


//------------------------------------------------------------------------------
// Flare Class 
//------------------------------------------------------------------------------

define("flareTableName", "Flare");

// Flare Class: Table Columns Keys
define("flareUserKey", "user");
define("flareExpiresAtKey", "expiresAt");
define("flareGroupKey", "group");
define("flareVideoKey", "video");
define("flareImageKey", "image");
define("flareThumbnailKey", "thumbnail");
define("flareViewsKey", "views");

//------------------------------------------------------------------------------
// Activity Class 
//------------------------------------------------------------------------------

define("activityTableName", "Activity");

// Activiy Class: Table Columns Keys
define("activityTypeKey", "type");
define("activityFromUserKey", "fromUser");
define("activityFromUserIdStringKey", "fromUserIdString");
define("activityToUserKey", "toUser");
define("activityToUserIdStringKey", "toUserIdString");
define("activityContentKey", "content");
define("activityFlareKey", "flare");
define("activityToUserPhoneNumberKey", "toUserPhoneNumber");
define("activityIsFlareCreationKey", "isFlareCreation");
define("activityCountKey", "count");

// Activity Class: Type Column Values
define("activityTypeFollow", "follow");
define("activityTypeFollowRequest", "followRequest");
define("activityTypeComment", "comment");
define("activityTypeMention", "mention");
define("activityTypeViews", "views");
define("activityTypeHearts", "hearts");
define("activityTypeNewStory", "newStory");
define("activityTypeNewGroupStory", "newGroupStory");
define("activityTypeBlock", "block");

//------------------------------------------------------------------------------
// Invite Class 
//------------------------------------------------------------------------------

define("inviteTableName", "Invite");

// Invite Class: Table Columns Keys
define("inviteFromUserKey", "fromUser");
define("inviteFromUserIdStringKey", "fromUserIdString");
define("inviteGroupKey", "group");
define("inviteGroupIdStringKey", "groupIdString");
define("inviteToPhoneNumberKey", "toPhoneNumber");
define("inviteChannelKey", "channel");

// Invite Class: Channel Type Values
define("inviteChannelSms", "sms");
define("inviteChannelMention", "mention");
define("inviteChannelGroup", "group");

//------------------------------------------------------------------------------
// Group Class 
//------------------------------------------------------------------------------

define("groupTableName", "Group");

// Group Class: Table Columns Keys
define("groupNameKey", "name");
define("groupImageKey", "image");
define("groupUsersKey", "users");
define("groupIsPublicKey", "isPublic");
define("groupLastFlareExpirationDateKey", "lastFlareExpirationDate");
define("groupCreatedByKey", "createdBy");

//------------------------------------------------------------------------------
// Group Membership Class 
//------------------------------------------------------------------------------

define("groupMembershipTableName", "GroupMembership");

// Group Membership Class: Table Columns Keys
define("groupMembershipGroupKey", "group");
define("groupMembershipUserKey", "user");
define("groupMembershipRankKey", "rank");
define("groupMembershipCreatedByKey", "createdBy");

// Group Membership Class: Rank Type Values
define("groupMembershipRankAdmin", "admin");
define("groupMembershipRankMember", "member");

//------------------------------------------------------------------------------
// Push Notification
//------------------------------------------------------------------------------

define("pushPayloadActivityTypeKey", "t");
define("pushPayloadPayloadTypeKey", "p");
define("pushPayloadFromUserObjectIdKey", "fu");
define("pushPayloadToUserObjectIdKey", "tu");
define("pushPayloadPostObjectIdKey", "pid");
define("pushPayloadGroupObjectIdKey", "gid");

// Push payload: activity types 
define("pushPayloadActivityTypeComment", "c");
define("pushPayloadActivityTypeMention", "m");
define("pushPayloadActivityTypeFollow", "f");
define("pushPayloadActivityTypeFollowRequest", "fr");
define("pushPayloadActivityTypeFollowRequestAccepted", "fra");
define("pushPayloadActivityTypeJoin", "j");
define("pushPayloadActivityTypeNewUserStory", "ns");
define("pushPayloadActivityTypeNewGroupStory", "ngs");
define("pushPayloadActivityTypeExpiredStory", "ex");
define("pushPayloadActivityTypeJoinedGroup", "jg");
define("pushPayloadActivityTypeAddMemberToGroup", "amg");
define("pushPayloadActivityTypeViewedMentionReceipt", "vmr");
define("pushPayloadActivityTypeHeart", "h");

// Push payload: payload types 
define("pushPayloadPayloadTypeActivity", "a");
define("pushPayloadPayloadTypePing", "pg");

