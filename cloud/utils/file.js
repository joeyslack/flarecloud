var _ = require('../lib/underscore-min.js');
var _k = require('../class/classConstants.js');
var DateUtil = require('../utils/date.js');
var Utility = require('../utils/utility.js');

//------------------------------------------------------------------------------
// Cloud Code
//------------------------------------------------------------------------------

//------------------------------------------------------------------------------
// function:  deleteExpiredFiles
//
// @params request - the request payload from the caller
//------------------------------------------------------------------------------
Parse.Cloud.job("deleteExpiredFiles", function(request, status) {
  // Set up to modify user data
  Parse.Cloud.useMasterKey();
 
  // The repeat interval in mins 
  var interval = request.params.intervalInDays;

  // Set the default to a day interval
  if (_.isUndefined(interval) || _.isNull(interval)) {
     interval = 1; // Default interval is 1 day
  }
   
  var currentDate = new Date();
  var currentDateWithInterval = DateUtil.subtractDays(currentDate, interval);
  var currentDateWithIntervalMinusADay = DateUtil.subtractDays(currentDateWithInterval, 1);
 
  // Query the Flare table since the last interval all users
  var Flare = Parse.Object.extend(_k.flareTableName);
  var postQuery = new Parse.Query(Flare);

  postQuery.greaterThan(_k.flareExpiresAtKey, currentDateWithIntervalMinusADay);
  postQuery.lessThan(_k.flareExpiresAtKey, currentDateWithInterval);
  postQuery.include(_k.flareUserKey);

  postQuery.each(function(post) {
  
    //console.log("DELETE: " + post.id + " fromUser: " + post.get(_k.flareUserKey).get(_k.userFullNameKey) + " expirestAt: " + post.get(_k.flareExpiresAtKey));
    // Get the PFFile names for 
    var baseURL = "https://api.parse.com/1/files/";
    var imageURL = post.get(_k.flareImageKey);
    var thumbnailURL = post.get(_k.flareThumbnailKey);
    var videoURL = post.get(_k.flareVideoKey);

    var fileURLs = _.compact([imageURL, thumbnailURL, videoURL]); //remove all falsy values

    if (fileURLs.length > 0) {
      _.each(fileURLs, function(fileURL) {
        var url = baseURL + fileURL.name();
        deletePFFile(url);  
      });
    }
  }).then(function() {
    status.success("Deleted expired files successfully.");
  }, function(error){
    status.error("Error: When deleting expired files " + error.message);
  });
 
});

//------------------------------------------------------------------------------
// Private
//------------------------------------------------------------------------------

//------------------------------------------------------------------------------
// function: deletPFFile
//
// @params fileURL - URL of file to delete on Parse
//------------------------------------------------------------------------------
function deletePFFile(fileURL)
{
  var promise = new Parse.Promise();

  Parse.Cloud.httpRequest({
    method: 'DELETE',
    url: fileURL,
    headers: {
      'X-Parse-Application-Id': Parse.applicationId,
      'X-Parse-Master-Key': Parse.masterKey,
    },
    success: function(httpResponse) {
      promise.resolve();
    },
    error: function(httpResponse) {
      promise.reject();
    }
  });

  return promise;
}
