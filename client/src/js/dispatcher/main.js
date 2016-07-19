var _ = require('lodash');
var Bowser = require('bowser');

var Events = require("./Events.js");
var User = require("./user.js");
var Settings = require('./Settings.js');
var Collection = require("./Collection.js");
var PersistentStorage = require('./PersistentStorage.js');
var Router = require("./Router.js");
var Transactions = require("./transactions.js");

var collectionOperations = ['add', 'update', 'remove'];

function Dispatcher(onReady) {

    // Makes the dispatcher capable of emitting events and being event-bound by other objects.
    this.events = new Events(['syncing', 'synced', 'ping', 'authenticated', 'closed'], this);

    this.browser = _.pick(Bowser, ['name', 'version']);

    this.user = new User();
    this.settings = new Settings();

    this.collections = {
        jobs: new Collection('jobs'),
        samples: new Collection('samples'),
        viruses: new Collection('viruses'),
        hmm: new Collection('hmm'),
        history: new Collection('history'),
        indexes: new Collection('indexes'),
        hosts: new Collection('hosts'),
        users: new Collection('users', false),
        groups: new Collection('groups', false),
        reads: new Collection('reads', false),
        files: new Collection('files', false)
    };
    
    this.storage = null;

    this.runningOperationCount = 0;

    // The router object keeps track of the URL and triggers events when the URL changes. Functions of the object can be
    // used to trigger route changes.
    this.router = new Router();

    // When a request is sent to the server, a transaction ID (TID) can be passed with it. A message will be returned by
    // the server when the operation completes. The message will contain the TID and a boolean value for success.
    this.transactions = new Transactions();

    /**
     * Takes a message object, stringifies it, and sends it to the server via web socket. Binds a transaction ID to the
     * message. When the transaction succeeds or fails, the corresponding callback functions will be called.
     *
     * @param message {object} - the message to send to the server.
     * @param success {func} - the function to call if the transaction succeeds.
     * @param failure {func} - the function to call if the transaction fails.
     * @func
     */
    this.send = function (message, success, failure) {
        message.tid = this.transactions.register(success, failure);
        this.connection.send(JSON.stringify(message));
    };

    this.sync = function () {
        this.send({
            collectionName: 'settings',
            methodName: 'download',
            data: null
        }, function (data) {
            this.settings.update(data);

            this.storage = new PersistentStorage(function () {
                var manifests = _.mapValues(this.collections, function (collection) {
                    return collection.manifest();
                });

                this.send({
                    collectionName: 'dispatcher',
                    methodName: 'sync',
                    data: {manifests: manifests}
                }, this.onSync);

            }, this);
        }.bind(this));
    };

    this.onSync = function (data) {
        this.syncOperationCount = data;
        this.checkSynced();
    }.bind(this);

    this.checkSynced = function () {
        var progress = this.runningOperationCount / this.syncOperationCount;

        if (progress < 1) {
            this.emit('syncing', progress);
            setTimeout(this.checkSynced, 250);
        } else {
            this.emit('synced');
        }
    }.bind(this);

    this.listen = function (name) {
        dispatcher.send({
            collectionName: 'dispatcher',
            methodName: 'listen',
            data: {'name': name}
        });
    };

    this.unlisten = function (name) {
        dispatcher.send({
            collectionName: 'dispatcher',
            methodName: 'unlisten',
            data: {'name': name}
        });
    };

    // When a websocket message is received, this method is called with the message as the sole argument. Every message
    // has a property 'operation' that tells the dispatcher what to do. Illegal operation names will throw an error.
    this.handle = function (message) {

        var operation = message.operation;

        var messageDescriptor = message.collection_name + "." + message.operation;

        console.log(message.collection_name + '.' + message.operation);

        if (_.includes(collectionOperations, operation)) {
            this.collections[message.collection_name][operation](message.data, message.sync);
        }

        else {

            switch (operation) {

                case 'transaction':
                    this.transactions.trigger(message.data.tid, message.data.success, message.data.data);
                    break;

                case 'ping':
                    this.events.emit('ping');
                    break;

                case 'set':
                    this.settings.update(message.data);
                    break;
                
                case 'amend':
                    this.user.load(message.data);
                    break;

                case 'deauthorize':
                    this.user.deauthorize(message.data);
                    break;

                default:
                    console.warn('Received unknown web socket operation in message: ' + messageDescriptor);
            }
        }
    };

    this.establishConnection = function (callback) {

        var dispatcher = this;

        // Setup the Websocket connection.
        var protocol = location.protocol === 'https:' ? 'wss': 'ws';

        dispatcher.connection = new WebSocket(protocol + '://' + location.host + '/ws');

        dispatcher.connection.onopen = function () {
            console.log('Established WebSocket connection.');
            callback();
        };

        dispatcher.connection.onmessage = function (event) {
            dispatcher.handle(JSON.parse(event.data));
        };

        dispatcher.connection.onclose = function () {
            dispatcher.emit('closed');
        };
    };

    this.establishConnection(onReady);
}

module.exports = Dispatcher;