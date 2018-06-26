var fbManager = require('../common/firebase-manager');
var fs = require('fs');

module.exports.log = function(message) {


    var currentdate = new Date();
    var datetime = "" + currentdate.getDate() + "/"
        + (currentdate.getMonth()+1)  + "/"
        + currentdate.getFullYear() + " @ "
        + currentdate.getHours() + ":"
        + currentdate.getMinutes() + ":"
        + currentdate.getSeconds();

    var error = {
        time: datetime,
        message: message
    };

    console.log(error);
    fs.appendFile('error_log.txt', error.time + ": " + error.message, function (err) {
        if (err) console.log(err);
    });

    fbManager.send_error(error);

};