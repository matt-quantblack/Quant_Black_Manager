var firebase = require('../common/firebase-init').firebase;
var https = require('https');
var fs = require('fs');

var user = null;

var child;

var mt4Terminal = "C:\\Program\ Files\ (x86)\\MetaTrader 4 IC Markets\\terminal.exe";
var mt4DataPath = "C:\\Users\\matth\\AppData\\Roaming\\MetaQuotes\\Terminal\\1DAFD9A7C67DC84FE37EAA1FC1E5CF75\\MQL4";

var fbError = function(err) {
    console.log(err);
};

var fileDownloaded = function(err) {
    console.log("downloaded");


    //child.kill('SIGTERM');
};

var strategyFileAdded = function(snapshot) {

    var fileInfo = snapshot.val();
    //check if version is different from current one


    var file = fs.createWriteStream(mt4DataPath + "\\Experts\\file.ex4");
    https.get(fileInfo.url, function(response) {
        response.pipe(file);
        file.on('finish', function() {
            file.close(fileDownloaded);  // close() is async, call cb after close completes.
        });
    }).on('error', function(err) { // Handle errors
        fs.unlink(dest); // Delete the file async. (But we don't check the result)
        fileDownloaded(err.message);
    });
    console.log();
};

var strategyAccessAdded = function(snapshot) {
    firebase.database().ref('strategies/' + snapshot.key + '/fileUrls').on('child_added', strategyFileAdded, fbError);
};

module.exports.initFileWatcher = function() {
    var spawn = require('child_process').spawn;
    child = spawn(mt4Terminal, ['start.ini']);


    child.on('close', function (code) {
        console.log('process exit code ' + code);
    });

    firebase.auth().signInWithEmailAndPassword("matt@enzymelabs.com.au", "m230681b").catch(function (err) {
        console.log(err.message);
    });

    firebase.auth().onAuthStateChanged(function(loggedUser) {

        user = loggedUser;

        if (user) {
            firebase.database().ref('strategy_access_by_uid/' + user.uid + "/user").on('child_added', strategyAccessAdded, fbError);
            firebase.database().ref('strategy_access_by_uid/' + user.uid + "/owner").on('child_added', strategyAccessAdded, fbError);
        } else {
            // No user is signed in.
        }
    });

};