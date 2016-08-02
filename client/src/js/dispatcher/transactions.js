var _ = require("lodash");

function Transaction(tid, remove) {

    this.tid = tid;
    this.remove = remove;

    this.onSuccess = function () {this.succeeded = true;};
    this.onFailure = function () {this.failed = true;};
    this.onUpdate = function () {console.warn("Unhandled transaction update.");};

    this.succeeded = false;
    this.failed = false;
    this.data = null;

    this.success = function (callback, context) {
        this.onSuccess = function (data) {
            this.finish(callback, data, context);
        };

        if (this.succeeded) this.onSuccess(this.data);

        return this;
    };

    this.failure = function (callback, context) {
        this.onFailure = function (data) {
            this.finish(callback, data, context);
        };

        if (this.failed) this.onFailure(this.data);

        return this;
    };

    this.update = function (callback, context) {
        this.onUpdate = context ? callback.bind(context): callback;
        return this;
    };

    this.finish = function (callback, data, context) {
        if (callback) {
            callback = context ? callback.bind(context) : callback;
            callback(data);
        }

        this.remove(this.tid);
    };

}

function Transactions() {

    this.pending = [];

    this.generateTID = function () {
        // Make a six-digit number as a transactionId

        // If the transactionId doesn't already exist, return it. Otherwise, keep generating until a unique number is
        // found
        tid = Math.ceil(Math.random() * 100000);

        while (this.pending.hasOwnProperty(tid)) {
            console.warn('Unavailable TID, generating another one.');
            tid = Math.ceil(Math.random() * 100000);
        }

        return tid;
    };

    this.new = function () {
        var transaction = new Transaction(this.generateTID(), this.remove);

        console.log("NEW", transaction);

        this.pending.push(transaction);

        return transaction;
    };

    this.fulfill = function (tid, succeeded, data) {
        // Find the index of the transaction.
        var transactionIndex = _.findIndex(this.pending, {tid: tid});

        // Get the transaction object.
        var transaction = this.pending[transactionIndex];

        // Call the appropriate success or failure callback.
        succeeded ? transaction.onSuccess(data): transaction.onFailure(data);

        console.log("FULFILL", transaction);
    };

    this.update = function (tid, data) {
        var transactionObj = _.find(this.pending, {tid: tid});
        transactionObj.onUpdate(data.update);
    };

    this.remove = function (tid) {
        _.remove(this.pending, {tid: tid});
    };
}

module.exports = Transactions;