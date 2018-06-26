var fbManager = require('../common/firebase-manager');
var fs = require('fs');



module.exports.loggedIn = function(req, res) {

    if(fbManager.data.cred != null)
    {
        res.status(200);
        res.json({'result': fbManager.data.cred });
    }
    else
    {
        res.status(200);
        res.json({'result': null});
    }

};

module.exports.connect = function(req, res) {
    var cred;

    try {
        cred = req.body.cred;
        fbManager.login(cred, function() {

            //save the credentials
            console.log('Writing credentials to ' + '.\\qb_cred.dat');
            fs.writeFile('.\\qb_cred.dat', JSON.stringify(cred), function(err) {
                if(err) console.log('Error saving credentials : ' + err);
            });

            res.status = 200;
            res.json({'success': true});
        })
    } catch(err) {
        res.status(400);
        res.json({error: 'Bad post data: ' + err});
    }
};

module.exports.logout = function(req, res) {

    try {

        fbManager.logout(function() {
            //save the credentials
            console.log('Clearing saved credentials');
            try {
                var filename = '.\\qb_cred.dat';
                if (fs.existsSync(filename))
                    fs.unlinkSync(filename);

            }
            catch(err) {
                console.log(err);
            }
            res.status = 200;
            res.json({'success': true});
        }, function(err) {
            res.status(400);
            res.json({error: 'Error: ' + err});
        });
    }catch(err) {
        res.status(400);
        res.json({error: 'Error: ' + err});
    }
};

module.exports.changeServerPassword = function(req, res) {
    var newPassword;

    try {
        newPassword = req.body.newPassword;


    } catch(err) {
        res.status(400);
        res.json({error: 'Bad post data: ' + err});
    }

    try {

        var child = require('child_process').spawn('C:\\Windows\\System32\\net', ['user', 'Administrator', newPassword]);


        child.on('error', function (err) {
            console.log('Error: ' + err);
        });


        res.status(200);
        res.json({success: true});

    }
    catch(err) {
        res.status(500);
        res.json({error: 'Could not change password: ' + err});
    }
};
