//------------------------------------------------------------------------------
// Public 
//------------------------------------------------------------------------------
 
//------------------------------------------------------------------------------
// function: addDays 
//
// @params date - reference date
// @params days - number of days to add to the reference date
//------------------------------------------------------------------------------
exports.addDays = function(date, days) {
  var tomorrow = new Date(date);
  tomorrow.setDate(tomorrow.getDate() + days);
  return tomorrow;
};

//------------------------------------------------------------------------------
// function:  subtractDays 
//
// @params date - reference date
// @params days - number of days to subract from the reference date
//------------------------------------------------------------------------------
exports.subtractDays = function(date, days) {
  var yesterday = new Date(date);
  yesterday.setDate(yesterday.getDate() - days);
  return yesterday;
};

//------------------------------------------------------------------------------
// function:  subtractMinutes 
//
// CAUTION: DO not subtract a day 
// see: http://stackoverflow.com/questions/1197928/how-to-add-30-minutes-to-a-javascript-date-object
//
// @params request - the request payload from the caller
//------------------------------------------------------------------------------
exports.subtractMinutes = function(date, minutes) {
  return new Date(date.getTime() - minutes*60000);
};
 
//------------------------------------------------------------------------------
// function:  addMinutes 
//
// CAUTION: DO not add a day 
// see: http://stackoverflow.com/questions/1197928/how-to-add-30-minutes-to-a-javascript-date-object
//
// @params request - the request payload from the caller
//------------------------------------------------------------------------------
exports.addMinutes = function(date, minutes) {
  return new Date(date.getTime() + minutes*60000);
};
