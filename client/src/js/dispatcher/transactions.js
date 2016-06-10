var _ = require("lodash");

function Transactions() {

    this.pending = [];

    this.generateTIDString = function () {
        return Math.ceil(Math.random() * 100000);
    };

    this.generateTID = function () {
        // Make a six-digit number as a transactionId

        // If the transactionId doesn't already exist, return it. Otherwise, keep generating until a unique number is
        // found
        var tid = this.generateTIDString();

        while (this.pending.hasOwnProperty(tid)) {
            console.warn('Unavailable TID, generating another one.');
            tid = this.generateTIDString();
        }

        return tid;
    };

    this.register = function (success, failure) {
        var tid = this.generateTID();

        this.pending.push({
            "tid": tid,
            "success": success,
            "failure": failure
        });

        return tid;
    };

    this.trigger = function (tid, success, data) {
        var transactionObj = _.find(this.pending, {tid: tid});

        if (success && transactionObj.success) {
            transactionObj.success(data);
        } else if (!success && transactionObj.failure) {
            transactionObj.failure(data);
        }
    }
}

module.exports = Transactions;