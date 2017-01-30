var _ = require('../lib/underscore-min.js');
var _k = require('../class/classConstants.js');
var Sms = require('../utils/sms.js'); 
var PhoneFormatter = require('../lib/PhoneFormat.js');

//------------------------------------------------------------------------------
// Local Defines 
//------------------------------------------------------------------------------
var secretPasswordToken = 'FlareBears';

//------------------------------------------------------------------------------
// Public 
//------------------------------------------------------------------------------

//------------------------------------------------------------------------------
// function: getSuggestedFriendsForUser
//
// @params request -
// @params response - 
//------------------------------------------------------------------------------
Parse.Cloud.define("sendVerificationCode", function(request,response) {
  var currentUser = request.user;
  var phoneNumber = request.params.phoneNumber;
	
  if (!phoneNumber) return response.error('Invalid Parameters');
  
  var userQuery = new Parse.Query(Parse.User);
	userQuery.equalTo(_k.userUsernameKey, phoneNumber + "");
	
  userQuery.first({useMasterKey: true}).then(function(user) {
		var min = 1000; var max = 9999;
		var num = Math.floor(Math.random() * (max - min + 1)) + min;

		if (user) {
			user.setPassword(secretPasswordToken + num);
			user.save(null, {useMasterKey: true}).then(function() {
				return Sms.sendActivationCode(phoneNumber, num);
			}).then(function() {
				response.success();
			}, function(err) {
				response.error(err);
			});
		} else {
			var newUser = new Parse.User();
			newUser.setUsername(phoneNumber);
			newUser.setPassword(secretPasswordToken + num);
			newUser.setACL({});
			newUser.save(null, {useMasterKey: true}).then(function(a) {
				return Sms.sendActivationCode(phoneNumber, num);
			}).then(function() {
				response.success();
			}, function(err) {
				response.error(err);
			});
		}
	}, function (err) {
		response.error(err);
	});
  
});

//------------------------------------------------------------------------------
// function: verifyCode
//
// @params request -
// @params response - 
//------------------------------------------------------------------------------
Parse.Cloud.define("verifyCode", function(request, response) {
  	var verificationCode = request.params.verificationCode;
	var phoneNumber = request.params.phoneNumber;

	if (phoneNumber && verificationCode) {
		Parse.User.logIn(phoneNumber, secretPasswordToken + verificationCode).then(function (user) {
      	
      	return user.destroy({useMasterKey: true});
    }).then(function() {
			response.success();
		}, function (err) {
			response.error(err);
		});
	} else {
		response.error('Invalid parameters.');
	}
});

