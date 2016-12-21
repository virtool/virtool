import { capitalize, map, sum, difference, findIndex } from "lodash";

import SuperAgent from "superagent";
import Numeral from "numeral";

var VTUtils = {

    toScientificNotation: function (number) {

        if (number < 0.01 || number > 1000) {
            split = number.toExponential().split('e');
            exponent = split[1].replace('+', '');
            return Numeral(split[0]).format('0.00') + 'e' + exponent;
        } else {
            return Numeral(number).format('0.000');
        }
    },

    formatIsolateName: function (isolate) {
        if (
            isolate.source_type && isolate.source_type !== 'unknown' ||
            isolate.sourceType && isolate.sourceType !== 'unknown'
        ) {
            return (
                capitalize(isolate.source_type || isolate.sourceType) + ' '
                + (isolate.source_name || isolate.sourceName)
            );
        }

        return 'Unnamed';
    },

    square: function (x) {
        return x * x;
    },

    squares: function (values) {
        return values.map(function (x) {
            return this.square(x);
        })
    },

    mean: function (values) {
        return sum(values) / values.length;
    },

    postJSON: function (uri, data, callback) {
        var composedCallback = function (err, response) {
            callback(response.body);
        };

        SuperAgent.post(uri)
            .send(data)
            .type('application/x-www-form-urlencoded; charset=UTF-8')
            .accept('json')
            .end(composedCallback);
    },

    getNewActiveId: function (currentActiveId, oldDocuments, newDocuments) {
        // In this case a new document has been added and should become the new activeId.
        if (newDocuments.length > oldDocuments.length) {
            // Find the new document id.
            return difference(map(newDocuments, '_id'), map(oldDocuments, '_id'))[0];
        }

        // Remove a user.
        if (newDocuments.length < oldDocuments.length) {
            // Find the index of the user document with the current activeId.
            var activeIndex = findIndex(oldDocuments, {_id: currentActiveId});

            if (activeIndex >= newDocuments.length) activeIndex -= 1;

            // If the removed first user is active, set the new first user as active. Otherwise make active the user
            // that occupies that position the old activeId did.
            return newDocuments[activeIndex]._id;
        }

        return currentActiveId;
    },

    numberToWord: function (number) {
        return {
            0: "zero",
            1: "one",
            2: "two",
            3: "three",
            4: "four",
            5: "five",
            6: "six",
            7: "seven",
            8: "eight",
            9: "nine"
        }[Number(number)] || number;
    }
};

module.exports = VTUtils;