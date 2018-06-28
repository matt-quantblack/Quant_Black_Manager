
var firebase = require('./firebase-init').firebase;
var dataObj = require('./firebase-data');
var im = require('./instance_manager');
var https = require('https');
var fs = require('fs');
var err_log = require('../common/error_logger');

var loginSuccess = null;

module.exports.data = dataObj.data;

module.exports.logout = function(onSuccess, onFail) {

    //close down all instances
    Object.keys(dataObj.data.instanceSpawns).forEach(function(key) {
        im.stopInstance(key, dataObj.data.qbManagerSettings.instances[key]);
        firebase.database().ref(dataObj.data.userDataPath + dataObj.data.user.uid + '/qb_manager/instances/' + key + '/started').set(false);
    });

    //stop listeners
    dataObj.data.listeners.forEach(function (value) {
        firebase.database().ref(value.path).off(value.type, value.listener);
    });

    Object.keys(dataObj.data.instanceSpawns).forEach(function(key) {
        delete dataObj.data.instanceSpawns[key];
    });

    dataObj.data.listeners = [];
    dataObj.data.qbManagerSettings = null;
    dataObj.data.user = null;
    dataObj.data.cred = null;

    firebase.auth().signOut().then(function() {
        onSuccess();
    }, function(err) {
        onFail(err);
    });
};

module.exports.setAuthStateChanged = function() {
    firebase.auth().onAuthStateChanged(function(loggedUser) {

        dataObj.data.user = loggedUser;

        if (dataObj.data.user) {
            console.log("Logged into Quant Black");

            //get qbManager settings
            firebase.database().ref(dataObj.data.userDataPath + dataObj.data.user.uid + '/qb_manager').once('value').then(function(snapshot) {
                console.log("Downloaded QB Manager Settings");

                if(!snapshot.exists()) {
                    dataObj.data.qbManagerSettings = {
                        strategies: {},
                        instances: {},
                        instance_eas: {}
                    };
                }
                else
                    dataObj.data.qbManagerSettings = snapshot.val();

                if(!dataObj.data.qbManagerSettings.hasOwnProperty('instances'))
                    dataObj.data.qbManagerSettings.instances = {};

                if(!dataObj.data.qbManagerSettings.hasOwnProperty('instance_eas'))
                    dataObj.data.qbManagerSettings.instance_eas = {};

                if(!dataObj.data.qbManagerSettings.hasOwnProperty('strategies'))
                    dataObj.data.qbManagerSettings.strategies = {};


                //listen for new versions of existing strategies if on auto update
                //first listen for any new strategies that are added in case there were none to start with
                dataObj.data.listeners.push({
                    path: dataObj.data.userDataPath + dataObj.data.user.uid + '/qb_manager/strategies',
                    type: 'child_added',
                    listener: firebase.database().ref(dataObj.data.userDataPath + dataObj.data.user.uid + '/qb_manager/strategies').on('child_added', function(strategySnapshot) {

                        dataObj.data.qbManagerSettings.strategies[strategySnapshot.key] = strategySnapshot.val();

                        if(dataObj.data.qbManagerSettings.strategies[strategySnapshot.key].autoUpdate) {
                            dataObj.data.listeners.push({
                                path: 'strategies/' + strategySnapshot.key + '/versions',
                                type: 'child_added',
                                listener:
                                    firebase.database().ref('strategies/' + strategySnapshot.key + '/versions').on('child_added', strategyChange)
                            });
                        }
                    })
                });

                //listen for any new strategies added to the qb manager
                dataObj.data.listeners.push({
                    path: dataObj.data.userDataPath + dataObj.data.user.uid + '/qb_manager/strategies',
                    type: 'child_added',
                    listener: firebase.database().ref(dataObj.data.userDataPath + dataObj.data.user.uid + '/qb_manager/strategies').on('child_added', strategyAdded) });


                //create the default instance
                if(Object.keys(dataObj.data.qbManagerSettings.instances).length == 0) {
                    var ref = firebase.database().ref(dataObj.data.userDataPath + dataObj.data.user.uid + '/qb_manager');
                    var key1 = ref.child("instances").push().getKey();
                    var key2 = ref.child("instances").push().getKey();
                    var key3 = ref.child("instances").push().getKey();
                    var key4 = ref.child("instances").push().getKey();

                    var defaultInstances = {};
                    defaultInstances[key1] =  {
                        broker: 'IC Markets',
                        type: 'Live',
                        description: 'Main trading account',
                        started: false,
                        active: false,
                        mt4DataPath: "C:\\Users\\Administrator\\AppData\\Roaming\\MetaQuotes\\Terminal\\DB6F816F93FAFEB829F5B751EE420D72\\",
                        mt4Path: "C:\\Program Files (x86)\\MetaTrader 4 IC Markets Live"
                    };
                    defaultInstances[key2] =  {
                        broker: 'IC Markets',
                        type: 'Demo',
                        description: 'Test account',
                        started: false,
                        active: false,
                        mt4DataPath: "C:\\Users\\Administrator\\AppData\\Roaming\\MetaQuotes\\Terminal\\092E4CE6D7B6FFE37BB5A4B3218EB174\\",
                        mt4Path: "C:\\Program Files (x86)\\MetaTrader 4 IC Markets Demo"
                    };
                    defaultInstances[key3] =  {
                        broker: 'Pepperstone',
                        type: 'Live',
                        description: 'Main trading account',
                        started: false,
                        active: false,
                        mt4DataPath: "C:\\Users\\Administrator\\AppData\\Roaming\\MetaQuotes\\Terminal\\36CB4805486590409E797894D40994CD\\",
                        mt4Path: "C:\\Program Files (x86)\\Pepperstone MetaTrader 4 Live"
                    };
                    defaultInstances[key4] =  {
                        broker: 'Pepperstone',
                        type: 'Demo',
                        description: 'Test account',
                        started: false,
                        active: false,
                        mt4DataPath: "C:\\Users\\Administrator\\AppData\\Roaming\\MetaQuotes\\Terminal\\AF3F0D3AEBFE644DC833FA7977623A5F\\",
                        mt4Path: "C:\\Program Files (x86)\\Pepperstone MetaTrader 4 Demo"
                    };

                    dataObj.data.qbManagerSettings.instances = defaultInstances;

                    ref.set(dataObj.data.qbManagerSettings).then(function() {
                        console.log("Created default settings");
                    })

                }

                //go through each instance and register for updates to
                dataObj.data.listeners.push({
                    path: dataObj.data.userDataPath + dataObj.data.user.uid + '/qb_manager/instances',
                    type: 'child_changed',
                    listener:
                        firebase.database().ref(dataObj.data.userDataPath + dataObj.data.user.uid + '/qb_manager/instances').on('child_changed', function(snapshot) {
                            var thisInstance = dataObj.data.qbManagerSettings.instances[snapshot.key];
                            var updatedInstance = snapshot.val();
                            if(thisInstance.active && !updatedInstance.active)
                                im.stopInstance(snapshot.key, thisInstance);
                            else if(!thisInstance.active && updatedInstance.active)
                                im.startInstance(snapshot.key, thisInstance);
                            dataObj.data.qbManagerSettings.instances[snapshot.key] = updatedInstance;

                        })});

                //set listeners for each instance
                Object.keys(dataObj.data.qbManagerSettings.instances).forEach(function (key) {

                    //start any instances that are in active state
                    if(dataObj.data.qbManagerSettings.instances[key].active)
                        im.startInstance(key, dataObj.data.qbManagerSettings.instances[key]);

                    //listen for any changes to the instance dataPath or program path
                    dataObj.data.listeners.push({
                        path: dataObj.data.userDataPath + dataObj.data.user.uid + '/qb_manager/instances/' + key + '/mt4Path',
                        type: 'value',
                        listener:
                            firebase.database().ref(dataObj.data.userDataPath + dataObj.data.user.uid + '/qb_manager/instances/' + key + '/mt4Path').on('value', function(snap) {
                                dataObj.data.qbManagerSettings.instances[key].mt4Path = snap.val();
                            })
                    });
                    dataObj.data.listeners.push({
                        path: dataObj.data.userDataPath + dataObj.data.user.uid + '/qb_manager/instances/' + key + '/mt4DataPath',
                        type: 'value',
                        listener:
                            firebase.database().ref(dataObj.data.userDataPath + dataObj.data.user.uid + '/qb_manager/instances/' + key + '/mt4DataPath').on('value', function(snap) {
                                dataObj.data.qbManagerSettings.instances[key].mt4DataPath = snap.val();
                            })
                    });


                    //listen for any restart requests
                    dataObj.data.listeners.push({
                        path: dataObj.data.userDataPath + dataObj.data.user.uid + '/qb_manager/instances/' + key + '/restart',
                        type: 'value',
                        listener:
                            firebase.database().ref(dataObj.data.userDataPath + dataObj.data.user.uid + '/qb_manager/instances/' + key + '/restart').on('value', function (snapshot) {
                                if (snapshot.val() == true)
                                    restartInstance(key);
                            })
                    });
                });

                //first listen for any new instance_eas that are added in case there were none to start with
                dataObj.data.listeners.push({
                    path: dataObj.data.userDataPath + dataObj.data.user.uid + '/qb_manager/instance_eas',
                    type: 'child_added',
                    listener:
                        firebase.database().ref(dataObj.data.userDataPath + dataObj.data.user.uid + '/qb_manager/instance_eas').on('child_added', function(ieaSnap) {
                            dataObj.data.qbManagerSettings.instance_eas[ieaSnap.key] = ieaSnap.val();

                            var count = ieaSnap.val().length.toString();

                            ieaSnap.val().forEach(function(ea) {
                                strategyAddedToInstance(ea);
                            });

                            //then listen for any strategies that have been added to this instance
                            dataObj.data.listeners.push({
                                path: dataObj.data.userDataPath + dataObj.data.user.uid + '/qb_manager/instance_eas/' + ieaSnap.key,
                                type: 'child_added',
                                listener:
                                    firebase.database().ref(dataObj.data.userDataPath + dataObj.data.user.uid + '/qb_manager/instance_eas/' + ieaSnap.key).orderByKey().startAt(count).on('child_added', function(stratSnap) {
                                        dataObj.data.qbManagerSettings.instance_eas[ieaSnap.key].push(stratSnap.val());
                                        strategyAddedToInstance(stratSnap.val());
                                    })
                            });

                        })
                });

            }, function(err) {
                err_log.log("ERROR: Could not download QB Manager Settings! " + err);
            });



            if(loginSuccess)
                loginSuccess();
        } else {
            // No user is signed in.
        }
    });
};

module.exports.login = function(cred, onSuccess) {
    loginSuccess = onSuccess;

    dataObj.data.cred = cred;

    firebase.auth().signInWithEmailAndPassword(cred.qbUsername, cred.qbPassword).catch(function (err) {
        err_log.log(err.message);
    });


};

module.exports.updateInstanceState = function(key, field, state) {
    if(dataObj.data.user)
        firebase.database().ref(dataObj.data.userDataPath + dataObj.data.user.uid + '/qb_manager/instances/' + key + '/' + field).set(state);
};

module.exports.getInstanceEAs = function(key, onSuccess) {
    firebase.database().ref(dataObj.data.userDataPath + dataObj.data.user.uid + '/qb_manager/instance_eas/' + key).once('value')
        .then(function(snapshot) {
            if(onSuccess)
                onSuccess(snapshot.val());
        });
};

module.exports.send_error = function(error)
{
    if(dataObj.data.user) {
        var ref = firebase.database().ref(dataObj.data.userDataPath + dataObj.data.user.uid + '/qb_manager');
        var key = ref.child('errors').push().getKey();
        ref.child('errors/' + key).set(error);
    }
};

function eaDownloaded(strategyKey, fileLocation, dest, qbManagerUpdate)
{
    var updates = {};
    if(qbManagerUpdate)
        updates = qbManagerUpdate;


    //copy the file to every instance
    if(dataObj.data.qbManagerSettings.hasOwnProperty('instances'))
    {

        if(dataObj.data.qbManagerSettings.hasOwnProperty('instances')) {
            Object.keys(dataObj.data.qbManagerSettings.instances).forEach(function (key) {
                var instance = dataObj.data.qbManagerSettings.instances[key];
                var instance_eas = dataObj.data.qbManagerSettings.instance_eas[key];

                if(instance_eas) {
                    instance_eas.forEach(function (val) {
                        if (instance.hasOwnProperty('mt4DataPath')) {

                            if(fs.existsSync(instance.mt4DataPath)) {

                                if(strategyKey == val.strategyKey) {
                                    //copy over old versions of this strategy
                                    var path = instance.mt4DataPath + 'MQL4\\Experts\\' + val.filename + '.ex4';
                                    try {
                                        //copy across the new one
                                        fs.copyFileSync(fileLocation, path);
                                        console.log('Downloaded to ' + path);

                                        if (instance.started) {
                                            updates[dataObj.data.userDataPath + dataObj.data.user.uid + '/qb_manager/instances/' + key + '/requires_restart'] = true;
                                            console.log("Instance running so restart required.")
                                        }
                                        else
                                            console.log("Instance stopped, no restart required.")
                                    }
                                    catch (err) {
                                        err_log.log("Could not copy " + instance.mt4DataPath + dest + ": " + err);
                                    }
                                }
                            }
                            else
                                err_log.log("MT4 Data Path " + instance.mt4DataPath + " does not exist.");

                        }
                    });
                }

            });
        }
    }



    firebase.database().ref().update(updates);

}

function downloadEA(dest, key, strategy, qbManagerUpdate) {

    //create a file stream in a temp location
    var file = fs.createWriteStream(dest);

    https.get(strategy.url, function(response) {
        response.pipe(file);
        file.on('finish', function() {
            file.close(function() {
                eaDownloaded(key, dest, 'MQL4\\Experts\\' + strategy.filename + '.ex4', qbManagerUpdate);
            });  // close() is async, call cb after close completes.
        });
    }).on('error', function(err) { // Handle errors
        fs.unlink(file); // Delete the file async. (But we don't check the result)
        err_log.log(err.message);
    });
}

function strategyAdded(snapshot) {

    var strategy = snapshot.val();

    var dir = __dirname + '/../downloaded_strategies';

    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir);
    }

    var dest = dir + '/'+ strategy.filename + '.ex4';

    //only download this if it isn't already in the strateies list
    if(!fs.existsSync(dest)) {
        console.log('Downloading new strategy ' + snapshot.key);
        //add to the local qb manager variable
        dataObj.data.qbManagerSettings.strategies[snapshot.key] = strategy;
        //download the strategy
        downloadEA(dest, snapshot.key, strategy);
    }

}


function strategyAddedToInstance(strategy) {



    if(dataObj.data && dataObj.data.hasOwnProperty('qbManagerSettings') &&
        dataObj.data.qbManagerSettings.hasOwnProperty('strategies') &&
        dataObj.data.qbManagerSettings.strategies.hasOwnProperty(strategy.strategyKey)) {

        //the ea should already be downloaded
        console.log("Setting up " + strategy.strategyKey  + " on instance");
        var dest = __dirname + '/../downloaded_strategies/' + strategy.filename + '.ex4';
        eaDownloaded(strategy.strategyKey, dest, 'MQL4\\Experts\\' + strategy.filename + '.ex4');
    }

}

function strategyChange(snapshot) {
    var strategyUpdate = snapshot.val();

    if(dataObj.data && dataObj.data.hasOwnProperty('qbManagerSettings') &&
        dataObj.data.qbManagerSettings.hasOwnProperty('strategies') &&
        dataObj.data.qbManagerSettings.strategies.hasOwnProperty(strategyUpdate.strategyKey))
    {
        var existingStrategy = dataObj.data.qbManagerSettings.strategies[strategyUpdate.strategyKey];
        if(existingStrategy.version < strategyUpdate.version)
        {
            var dest = __dirname + '/../downloaded_strategies/'+ strategyUpdate.filename + '.ex4';

            var updates = {};
            updates[dataObj.data.userDataPath + dataObj.data.user.uid + '/qb_manager/strategies/' + strategyUpdate.strategyKey + '/version'] = strategyUpdate.version;
            updates[dataObj.data.userDataPath + dataObj.data.user.uid + '/qb_manager/strategies/' + strategyUpdate.strategyKey + '/filename'] = strategyUpdate.filename;
            updates[dataObj.data.userDataPath + dataObj.data.user.uid + '/qb_manager/strategies/' + strategyUpdate.strategyKey + '/url'] = strategyUpdate.url;

            console.log('Updating new version for strategy ' + strategyUpdate.strategyKey);
            downloadEA(dest, strategyUpdate.strategyKey, strategyUpdate, updates);
        }
    }

}

function restartInstance(key)
{
    //update the database
    var updates = {};
    updates[dataObj.data.userDataPath + dataObj.data.user.uid + '/qb_manager/instances/' + key + '/restart'] = null;
    updates[dataObj.data.userDataPath + dataObj.data.user.uid + '/qb_manager/instances/' + key + '/requires_restart'] = null;
    firebase.database().ref().update(updates);

    //stop then start the instance
    if(dataObj.data.qbManagerSettings.instances.hasOwnProperty(key)) {
        im.stopInstance(key, dataObj.data.qbManagerSettings.instances[key]);
        im.startInstance(key, dataObj.data.qbManagerSettings.instances[key]);
    }
}