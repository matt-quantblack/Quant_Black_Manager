var fs = require('fs');
var fbManager = require('../common/firebase-manager');
var err_log = require('../common/error_logger');

function createChartFile(dir, eaNo, symbol, period, ea_name, username, password) {

    console.log('Setting up EA ' + ea_name + " on " + symbol + ", " + period);

    var id = 131742006375446389 + eaNo;

    // Read the file and change its contents
    var filename = '../common/chart_profile.txt';

    fs.readFile(filename, 'utf8', function(err, data) {
        if (err) {
            err_log.log(err);
            return;
        }
        data = data.replace('<!--id-->', id);
        data = data.replace('<!--symbol-->', symbol);
        data = data.replace('<!--period-->', period);
        data = data.replace('<!--ea_name-->', ea_name);
        data = data.replace('<!--username-->', username);
        data = data.replace('<!--password-->', password);

        var num = eaNo.toString();
        if(num.length == 1)
            num = '0' + eaNo;

        fs.writeFile(dir + '\\chart' + num + '.chr', data, function(err) {
            if(err) err_log.log('Error saving profile chart ' + ea_name + ': ' + err);
        });
    });
}

function clearDirectory(dirname) {
    fs.readdir(dirname, function(err, filenames) {
        if (err) {
            err_log.log('Error reading profile directory: ' + err);
            return;
        }
        filenames.forEach(function(filename) {
            fs.unlink(dirname + '\\' + filename, (err) => {
                if (err) err_log.log('Error clearing profile chart: ' + err);
            });
        });
    });
}

module.exports.createProfile = function(dataPath, instanceEAs) {

   var dir = dataPath + 'profiles\\default';

   if(fbManager.data.cred) {
       var uname = fbManager.data.cred.qbUsername;
       var pword = fbManager.data.cred.qbPassword;

       clearDirectory(dir);

       var eaNo = 1;

       if(instanceEAs) {
           instanceEAs.forEach(function (ea) {
               createChartFile(dir, eaNo++, ea.symbol, ea.period, ea.filename, uname, pword);
           });
       }
   }

};

module.exports.startInstance = function(key, instance) {

    var thisModule = this;
    var dataPath = instance.mt4DataPath;

    fbManager.getInstanceEAs(key, function(instanceEAs) {

        thisModule.createProfile(dataPath, instanceEAs);

        console.log('Starting: ' + instance.mt4Path + '\\terminal.exe');
        var spawn = require('child_process').spawn;
        var child = null;
        try {
            child = spawn(instance.mt4Path + '\\terminal.exe');
            fbManager.data.instanceSpawns[key] = child;
        }
        catch(err)
        {
            err_log.log("Error: launch failed for " + instance.mt4Path + " " + err);
        }

        if(child) {

            fbManager.updateInstanceState(key, 'started', true);
            fbManager.updateInstanceState(key, 'active', true);


            child.on('close', function (code) {
                console.log('MT4 exited ' + instance.mt4Path + " (" + code + ")");
                fbManager.updateInstanceState(key, 'started', false);
            });

            child.on('error', function (err) {
                err_log.log('Instance error: ' + err);
            });

            console.log("Loaded instance " + instance.mt4Path);
        }
    });




};

module.exports.stopInstance = function(key, instance) {

    try {

        if(fbManager.data.instanceSpawns.hasOwnProperty(key)) {
            fbManager.data.instanceSpawns[key].kill('SIGTERM');
            console.log("Instance stopped " + instance.mt4Path);
        }

    }
    catch(err)
    {
        err_log.log("Error: could not shutdown " + instance.mt4Path + " " + err);
    }
};