/**
 * Copyright 2015, Government of Canada.
 * All rights reserved.
 *
 * This source code is licensed under the MIT license.
 *
 * @providesModule User
 */

var Cookie = require('react-cookie');
var Events = require('./Events');

/**
 * An object that manages all user authentication and the user profile.
 *
 * @constructor
 */
var User = function () {

    this.name = null;
    
    this.events = new Events(['change', 'logout'], this);

    this.load = function (data) {
        // Update the username, token, and reset properties with the authorized values.
         _.assign(this, _.omit(data, '_id'));

        this.name = data._id;
        Cookie.save('token', data.token);

        this.emit('change');
    };

    this.authorize = function (data) {
        this.load(data);
        dispatcher.sync();
    };

    this.deauthorize = function (data) {

        dispatcher.db.loki.deleteDatabase({}, function () {
            location.hash = 'home/welcome';
            
            this.name = null;

             _.forIn(dispatcher.db, function (collection) {
                collection.documents = [];
                collection.synced = false;
            });

            this.emit('logout', data);
            
        }.bind(this));

    };

    this.logout = function () {
        dispatcher.send({
            collectionName: 'users',
            methodName: 'logout',
            data: {
                token: this.token
            }
        });
    };
};

module.exports = User;