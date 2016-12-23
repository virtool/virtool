import React from "react";
import { merge, forEach, sortBy, max } from "lodash";
import { formatIsolateName } from "virtool/js/utils";
import { Alert } from "react-bootstrap";
import { Flex, Icon, Button } from 'virtool/js/components/Base';

var PathoscopeController = require('./Controller');

var Report = React.createClass({

    render: function () {

        if (this.props.diagnosis.length > 0) {

            var mappedReadCount = this.props.read_count;

            var data = this.props.diagnosis.map((virus) => {

                merge(virus, {
                    pi: 0,
                    best: 0,
                    reads: 0,
                    coverage: 0,
                    maxGenomeLength: 0,
                    maxDepth: 0
                });

                // Go through each isolate associated with the virus, adding properties for weight, best-hit, read count,
                // and coverage. These values will be calculated from the sequences owned by each isolate.
                forEach(virus.isolates, (isolate) => {
                    var isolateDepth = 0;
                    var genomeLength = 0;

                    // Make a name for the isolate by joining the source type and name, eg. 'Isolate' + 'Q47'.
                    isolate.name = formatIsolateName(isolate);

                    if (isolate.name === 'unknown unknown') {
                        isolate.name = 'Unnamed Isolate';
                    }

                    isolate.pi = 0;
                    isolate.best = 0;
                    isolate.reads = 0;
                    isolate.coverage = 0;

                    // Go through each hit/sequence owned by the isolate and composite its values into the overall isolate
                    // values of weight, best-hit, read count, and coverage.
                    forEach(isolate.hits, (hit) => {
                        hit.reads = Math.round(hit.pi * mappedReadCount);

                        // Add the following three values to the totals for the isolate.
                        isolate.pi += hit.pi;
                        isolate.best += hit.best;
                        isolate.reads += hit.reads;

                        var hitDepth = max(hit.align);

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

                });

                virus.isolates = sortBy(virus.isolates, 'coverage').reverse();

                return virus;

            });

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