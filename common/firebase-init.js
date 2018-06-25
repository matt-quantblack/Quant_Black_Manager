/**
 * Created by matth on 21/12/2016.
 */

var firebase = require('firebase');

module.exports.init = function() {
    var env = 'production';

    // Initialize Firebase
    var config = {
        apiKey: "AIzaSyD9i6MQ-tAn3aLO_RdjLBtF5khNtmCTlaI",
        authDomain: "couch-trader.firebaseapp.com",
        databaseURL: "https://couch-trader.firebaseio.com",
        projectId: "couch-trader",
        storageBucket: "couch-trader.appspot.com",
        messagingSenderId: "261393420680"
    };

    if (env === 'production') {
        var config = {
            apiKey: "AIzaSyB9RWszfjr1Q_KI5MMuAG-lxm-Qhi-GEik",
            authDomain: "quant-black.firebaseapp.com",
            databaseURL: "https://quant-black.firebaseio.com",
            projectId: "quant-black",
            storageBucket: "quant-black.appspot.com",
            messagingSenderId: "123354435248"
        };
    }
    firebase.initializeApp(config);
};

module.exports.firebase = firebase;