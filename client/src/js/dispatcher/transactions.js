import { find, findIndex, remove } from "lodash";

export class Transaction {

    constructor (tid, remove) {
        this.tid = tid;
        this.remove = remove;

        this.succeeded = false;
        this.failed = false;
        this.data = null;
    }

    onSuccess = () => this.succeeded = true;
    onFailure = () => this.failed = true;
    onUpdate = () => console.warn("Unhandled transaction update.");

    success (callback, context) {
        this.onSuccess = (data) => this.finish(callback, data, context);

        if (this.succeeded) {
            this.onSuccess(this.data);
        }

        return this;
    }

    failure (callback, context) {
        this.onFailure = (data) => this.finish(callback, data, context);

        if (this.failed) {
            this.onFailure(this.data);
        }

        return this;
    }

    update (callback, context) {
        this.onUpdate = context ? callback.bind(context): callback;
        return this;
    }

    finish (callback, data, context) {
        if (callback) {
            callback = context ? callback.bind(context) : callback;
            callback(data);
        }

        this.remove(this.tid);
    }

}

export default class Transactions {

    constructor () {
        this.pending = [];
    }

    generateTID () {
        // Make a six-digit number as a transactionId

        // If the transactionId doesn"t already exist, return it. Otherwise, keep generating until a unique number is
        // found
        let tid = Math.ceil(Math.random() * 100000);

        while (this.pending.hasOwnProperty(tid)) {
            console.warn("Unavailable TID, generating another one.");
            tid = Math.ceil(Math.random() * 100000);
        }

        return tid;
    }

    register () {
        const transaction = new Transaction(this.generateTID(), this.remove);
        this.pending.push(transaction);
        return transaction;
    }

    fulfill (tid, succeeded, data) {
        // Find the index of the transaction.
        const transactionIndex = findIndex(this.pending, {tid: tid});

        // Get the transaction object.
        const transaction = this.pending[transactionIndex];

        // Call the appropriate success or failure callback.
        succeeded ? transaction.onSuccess(data): transaction.onFailure(data);
    }

    update (tid, data) {
        find(this.pending, {tid: tid}).onUpdate(data);
    }

    remove (tid) {
        remove(this.pending, {tid: tid});
    }
}
