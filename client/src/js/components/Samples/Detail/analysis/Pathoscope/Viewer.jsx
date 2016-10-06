var React = require('react');
var Row = require('react-bootstrap/lib/Row');
var Col = require('react-bootstrap/lib/Col');
var Grid = require('react-bootstrap/lib/Grid');
var Panel = require('react-bootstrap/lib/Panel');
var Alert = require('react-bootstrap/lib/Button');
var Button = require('react-bootstrap/lib/Button');
var ListGroup = require('react-bootstrap/lib/ListGroup');

var Flex = require('virtool/js/components/Base/Flex.jsx');
var Icon = require('virtool/js/components/Base/Icon.jsx');
var PushButton = require('virtool/js/components/Base/PushButton.jsx');
var PathoscopeController = require('./Controller.jsx');
var Utils = require("virtool/js/Utils");

var Report = React.createClass({

    render: function () {

        if (this.props.diagnosis.length > 0) {

            var data = this.props.diagnosis.map(function (virus) {

                _.merge(virus, {
                    pi: 0,
                    best: 0,
                    reads: 0,
                    coverage: 0,
                    maxGenomeLength: 0,
                    maxDepth: 0
                });

                // Go through each isolate associated with the virus, adding properties for weight, best-hit, read count,
                // and coverage. These values will be calculated from the sequences owned by each isolate.
                _.forEach(virus.isolates, function (isolate) {
                    var isolateDepth = 0;
                    var genomeLength = 0;

                    // Make a name for the isolate by joining the source type and name, eg. 'Isolate' + 'Q47'.
                    isolate.name = Utils.formatIsolateName(isolate);

                    if (isolate.name === 'unknown unknown') {
                        isolate.name = 'Unnamed Isolate';
                    }

                    isolate.pi = 0;
                    isolate.best = 0;
                    isolate.reads = 0;
                    isolate.coverage = 0;

                    // Go through each hit/sequence owned by the isolate and composite its values into the overall isolate
                    // values of weight, best-hit, read count, and coverage.
                    _.forEach(isolate.hits, function (hit) {
                        // Add the following three values to the totals for the isolate.
                        isolate.pi += hit.pi;
                        isolate.best += hit.best;
                        isolate.reads += hit.reads;

                        var hitDepth = _.max(hit.align);

                        if (hitDepth > isolateDepth) {
                            isolateDepth = hitDepth;
                        }

                        genomeLength += hit.align.length;

                        if (hit.coverage > isolate.coverage) isolate.coverage = hit.coverage;
                    });

                    if (genomeLength > virus.maxGenomeLength) {
                        virus.maxGenomeLength = genomeLength;
                    }

                    if (isolateDepth > virus.maxDepth) {
                        virus.maxDepth = isolateDepth;
                    }

                    // Add the following three values onto the totals for the virus.
                    virus.pi += isolate.pi;
                    virus.best += isolate.best;
                    virus.reads += isolate.reads;

                    // Set the virus coverage to the highest coverage for all of the isolates.
                    if (isolate.coverage > virus.coverage) virus.coverage = isolate.coverage;

                }.bind(this));

                virus.isolates = _.sortBy(virus.isolates, 'coverage').reverse();

                return virus;

            }, this);

            return <PathoscopeController data={data} maxReadLength={this.props.maxReadLength} />;
        }

        return (
            <Alert bsStyle='info' className='text-center'>
                <p>
                    <Icon name='notification' /> No virus sequences found in sample
                </p>
                <Button bsSize='small' onClick={this.props.showListing}>
                    <Icon name='arrow-back' /> Back
                </Button>
            </Alert>
        );
    }

});

module.exports = Report;