var _ = require('lodash');
var SuperAgent = require('superagent');
var Numeral = require('numeral');

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
                _.capitalize(isolate.source_type || isolate.sourceType) + ' '
                + (isolate.source_name || isolate.sourceName)
            );
        }

        return 'Unamed';
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
        return _.sum(values) / values.length;
    },

    standardDeviation: function (values) {
        var sumOfSquares = _.sum(this.squares(values));
        return Math.sqrt((sumOfSquares / values.length) - this.square(mean(values)));
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
    }
};

module.exports = VTUtils;