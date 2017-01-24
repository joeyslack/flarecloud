var _ = require('cloud/lib/underscore-min.js');

//------------------------------------------------------------------------------
// Public 
//------------------------------------------------------------------------------

//------------------------------------------------------------------------------
// function: getFistAndLastName
//
// @params fullName - full name to parse
//
// @returns name dictionary - {firstName:, lastName} 
//------------------------------------------------------------------------------
exports.getMentionName = function(fullName) 
{
  if (_.isUndefined(fullName)) {
    return undefined;
  }

  // Split the fullName string
  var nameArray = fullName.split(/(\s+)/);

  var firstName = "";
  var lastName = "";

  if (nameArray.length >= 3){
    firstName = nameArray[0];
    lastName = nameArray[2];
  } else if (nameArray.length >= 1) {
    firstName = nameArray[0];
  }

  var mentionName = '@' + firstName + lastName;

  //console.log("mention name: " + mentionName);

  return mentionName;
};

//------------------------------------------------------------------------------
// function: getFistAndLastName
//
// @params fullName - full name to parse
//
// @returns name dictionary - {firstName:, lastName} 
//------------------------------------------------------------------------------
exports.getFirstAndLastName = function(fullName) 
{
  if (_.isUndefined(fullName)) {
    return undefined;
  }

  // Split the fullName string
  var nameArray = fullName.split(/(\s+)/);

  var firstName = "";
  var lastName = "";

  if (nameArray.length >= 3){
    firstName = nameArray[0];
    lastName = nameArray[2];
  } else if (nameArray.length >= 1) {
    firstName = nameArray[0];
  }

  //console.log("firstName: " + firstName + " lastName: " + lastName);

  return {firstName:firstName, lastName:lastName};
};
