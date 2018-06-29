/**
 * Created by matth on 19/01/2017.
 */
(function () {

    "use strict";

    angular
        .module('myApp')
        .controller('dashboardCtrl', dashboardCtrl);

    dashboardCtrl.$inject = ['$http', '$scope', '$interval'];
    function dashboardCtrl ($http, $scope, $interval) {

        var vm = this;

        vm.instances = {};

        vm.user = null;
        vm.updating = false;

        vm.checkingCred = true;
        vm.hasCred = false;


        vm.cred = {
            qbUsername: '',
            qbPassword: ''
        };

        $http.get("/api/loggedIn")
            .then(function(response) {
                vm.status = response.status;
                if(response.data.result) {
                    vm.cred = response.data.result;
                    vm.hasCred = true;

                    //login on the front end as well
                    firebase.auth().signInWithEmailAndPassword(vm.cred.qbUsername, vm.cred.qbPassword).catch(function (err) {
                        console.log(err.message);
                    });
                }
                else
                    vm.hasCred = false;
                vm.checkingCred = false;
                if (!$scope.$$phase) $scope.$apply();
            }, function(response) {
                vm.checkingCred = false;
                vm.status = response.data || 'Request failed';
                vm.response = response.status;
                if (!$scope.$$phase) $scope.$apply();
            });


        firebase.auth().onAuthStateChanged(function(user) {
            vm.updating = false;
            if(user) {
                vm.user = user;

                firebase.database().ref(user.uid + '/qb_manager/instances').on('child_added', function (snapshot) {
                    vm.instances[snapshot.key] = snapshot.val();

                    firebase.database().ref(user.uid + '/qb_manager/instances/' + snapshot.key).on('child_changed', function (snap) {
                        vm.instances[snapshot.key][snap.key] = snap.val();
                        if (!$scope.$$phase) $scope.$apply();
                    });
                    if (!$scope.$$phase) $scope.$apply();
                });

                firebase.database().ref(user.uid + '/qb_manager/instances').on('child_removed', function(snapshot) {
                    if(vm.instances.hasOwnProperty(snapshot.key)) {
                        delete vm.instances[snapshot.key];
                        if (!$scope.$$phase) $scope.$apply();
                    }
                });


            }
            else {
                vm.user = null;
                if (!$scope.$$phase) $scope.$apply();
            }
        });

        vm.logout = function() {
            vm.updating = true;
            $http.get("/api/logout")
                .then(function(response) {
                    //login on the front end as well
                    vm.status = response.status;
                    vm.hasCred = false;
                    firebase.auth().signOut();
                }, function(response) {
                    vm.status = response.status;
                    vm.response = response.data || 'Request failed';
                });
        };

        vm.connect = function() {
            vm.updating = true;
            $http.post("/api/connect", { 'cred': vm.cred})
                .then(function(response) {
                    //login on the front end as well
                    firebase.auth().signInWithEmailAndPassword(vm.cred.qbUsername, vm.cred.qbPassword).catch(function (err) {
                        console.log(err.message);
                    });
                    vm.hasCred = true;
                    vm.updating = false;
                    vm.status = response.status;
                    vm.response = response.data;
                    if (!$scope.$$phase) $scope.$apply();
                }, function(response) {
                    vm.status = response.status;
                    vm.response = response.data || 'Request failed';
                });
        };

        var doneUpdate = function() {
            vm.updating = false;
            if (!$scope.$$phase) $scope.$apply();
        };

        vm.stop = function(key) {
            vm.updating = true;
            firebase.database().ref(vm.user.uid + '/qb_manager/instances/' + key + '/active').set(false).then(doneUpdate, doneUpdate);
        };

        vm.launch = function(key) {
            vm.updating = true;
            firebase.database().ref(vm.user.uid + '/qb_manager/instances/' + key + '/active').set(true).then(doneUpdate, doneUpdate);
        };

        vm.update = function(key, field, value) {
            vm.updating = true;
            firebase.database().ref(vm.user.uid + '/qb_manager/instances/' + key + '/' + field).set(value).then(doneUpdate, doneUpdate);
        };

        vm.addNew = function() {
            vm.updating = true;
            vm.instance.started = false;
            vm.instance.active = false;
            vm.instance.hide = false;
            var key = firebase.database().ref(vm.user.uid + '/qb_manager/instances').push().getKey();
            firebase.database().ref(vm.user.uid + '/qb_manager/instances/' + key).set(vm.instance).then(function() {
                vm.instance.broker = "";
                vm.instance.type = "";
                vm.instance.description = "";
                vm.instance.mt4Path = "";
                vm.instance.mt4DataPath = "";
                vm.updating = false;
                if (!$scope.$$phase) $scope.$apply();
            }, doneUpdate);
        };

        vm.remove = function(key) {
            var r = confirm("Are you sure you want to delete this MT4 Instance?");
            if (r == true) {
                firebase.database().ref(vm.user.uid + '/qb_manager/instances/' + key).remove();
            }
        };

        vm.changeServerPassword = function() {
            vm.serverPassError = "";
          if(vm.serverPassword != vm.serverPassword2)
              vm.serverPassError = "Passwords don't match.";
          else if(vm.serverPassword.length < 8)
              vm.serverPassError = "Password must be at least 8 characters.";
          else if(!(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/.test(vm.serverPassword)))
          {
              vm.serverPassError = "Password must contain at least 1 lower case, 1 upper case and 1 number.";
          }
          else {
              vm.serverPasswordSuccess = false;
              vm.passwordChanging = true;
              $http.post("/api/changeServerPassword", {'newPassword': vm.serverPassword})
                  .then(function(response) {
                      vm.status = response.status;
                      if(response.status == 200) {
                          vm.serverPasswordSuccess = true;
                      }
                      else
                      {
                          vm.serverPassError = response.data;
                      }
                      vm.passwordChanging = false;
                      if (!$scope.$$phase) $scope.$apply();
                  }, function(response) {
                      vm.passwordChanging = false;
                      vm.status = response.data || 'Request failed';
                      vm.serverPassError = response.status;
                      if (!$scope.$$phase) $scope.$apply();
                  });
          }

        };

    }

})();