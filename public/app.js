/**
 * Created by matth on 23/08/2017.
 */
'use strict';

// Declare app level module which depends on views, and components
(function () {

    angular.module('myApp', ['firebase','ngRoute']);

    function config ($routeProvider, $locationProvider) {
        $routeProvider
            .when('/', {
                templateUrl: 'dashboard/dashboard.view.html',
                controller: 'dashboardCtrl',
                controllerAs: 'vm'
            })
            .otherwise({redirectTo: '/'});

        // use the HTML5 History API
        $locationProvider.html5Mode({
            enabled: true,
            requireBase: false
        });

    }


    angular
        .module('myApp')
        .config(['$routeProvider', '$locationProvider', config])


})();