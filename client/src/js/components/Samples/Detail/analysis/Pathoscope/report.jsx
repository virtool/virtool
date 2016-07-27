var React = require('react');
var Alert = require('react-bootstrap/lib/Alert');
var Table = require('react-bootstrap/lib/Table');
var Label = require('react-bootstrap/lib/Label');
var Button = require('react-bootstrap/lib/Button');
var Panel = require('react-bootstrap/lib/Panel');
var Numeral = require('numeral');

var Flex = require('virtool/js/components/Base/Flex.jsx');
var Icon = require('virtool/js/components/Base/Icon.jsx');
var PushButton = require('virtool/js/components/Base/PushButton.jsx');
var Bars = require('./chart/chart.jsx');
var AnalysisTable = require('./table/table.jsx');
var ControlBar = require('./control/bar.jsx');
var Utils = require('virtool/js/Utils');

var Report = React.createClass({

    getInitialState: function () {
        return {
            mode: 'table',
            proportion: false,
            filter: true,
            query: false,
            virus: null,
            isolate: null,
            control: true
        }
    },

    select: function (level, _id) {
        var newState = {};
        newState[level] = _id;
        this.setState(newState);
    },

    ascend: function () {
        if (this.state.virus) this.state.isolate ? this.select('isolate', null): this.select('virus', null);
    },

    setMode: function (mode) {
        this.setState({mode: mode});
    },

    toggleState: function (key) {
        if (this.state.hasOwnProperty(key)) {
            var newState = {};
            newState[key] = !this.state[key];
            this.setState(newState);
        }
    },

    render: function () {

        var names = {
            virus: null,
            isolate: null
        };

        if (this.props.diagnosis.length > 0) {

            var data = this.props.diagnosis.map(function (virus) {

                if (this.state.virus && virus._id === this.state.virus) {
                    names.virus = virus.name;
                }

                var virusLevelData = {
                    pi: 0,
                    best: 0,
                    reads: 0,
                    coverage: 0
                };

                _.merge(virus, virusLevelData);

                // Go through each isolate associated with the virus, adding properties for weight, best-hit, read count,
                // and coverage. These values will be calculated from the sequences owned by each isolate.
                _.forEach(virus.isolates, function (isolate) {
                    // Make a name for the isolate by joining the source type and name, eg. 'Isolate' + 'Q47'.
                    isolate.name = Utils.formatIsolateName(isolate);

                    if (isolate.name === 'unknown unknown') {
                        isolate.name = 'Unnamed Isolate';
                    }

                    if (this.state.isolate && isolate.isolate_id === this.state.isolate) {
                        names.isolate = isolate.name;
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

                        if (hit.coverage > isolate.coverage) isolate.coverage = hit.coverage;
                    });

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

            var internalControlId = dispatcher.settings.get('internal_control_id');

            var useRelative = false;

            var totalReadsMapped = _.sum(_.map(data, 'reads'));

            var numberOfHits = data.length;

            if (this.state.filter) {
                data = _.filter(data, function (document) {
                    return document.pi * totalReadsMapped >= document.ref_length * 0.8 / this.props.maxReadLength;
                }.bind(this));
            }

            var disableControl = true;

            if (dispatcher.settings.get('use_internal_control') && internalControlId) {

                var internalControl = _.find(data, {_id: internalControlId});

                if (internalControl) {

                    disableControl = false;

                    if (this.state.control) {
                        useRelative = true;

                        var controlWeight = internalControl.pi;

                        data = data.map(function (virus) {
                            virus.relative = virus.pi / controlWeight;
                            return virus;
                        });
                    }
                }
            }

            var dataDisplay;

            switch (this.state.mode) {
                case 'table':
                    dataDisplay = (
                        <AnalysisTable
                            data={data}
                            totalReadsMapped={totalReadsMapped}
                            useRelative={useRelative}
                            absolute={this.state.absolute}
                            proportion={this.state.proportion}
                            internalControlId={internalControlId}
                        />
                    );
                    break;

                case 'chart':
                    dataDisplay = <Bars data={data} select={this.select} {...this.state} />;
                    break;
            }

            var title = (
                <span>
                    <strong>{this.props.comments || 'Unnamed Analysis'} </strong>
                    <Label>{Numeral(totalReadsMapped).format('0 a')} mapped reads</Label>&nbsp;
                    <Label>{numberOfHits} virus hits</Label>
                </span>
            );

            var controlProps = {
                title: title,
                setMode: this.setMode,
                ascend: this.ascend,
                toggleProportion: this.toggleProportion,
                toggleState: this.toggleState,
                toggleControl: this.toggleControl,
                virusName: names.virus,
                isolateName: names.isolate,
                onBack: this.props.onBack,
                disableControl: disableControl
            };

            return (
                <div>
                    <Table bordered>
                        <tbody>
                            <tr>
                                <th className='col-md-3'>Reads Mapped</th>
                                <td className='col-md-9'>{this.props.read_count}</td>
                            </tr>
                            <tr>
                                <th>Viruses Hit</th>
                                <td>{this.props.diagnosis.length}</td>
                            </tr>
                        </tbody>
                    </Table>

                    <Panel header={<ControlBar {...this.state} {...controlProps} />}>
                        {dataDisplay}
                    </Panel>
                </div>
            );

        } else {
            return (
                <Alert bsStyle='info' className='text-center'>
                    <p>
                        <Icon name='notification' /> No virus sequences found in sample
                    </p>
                    <Button bsSize='small' onClick={this.props.showListing}>
                        <Icon name='arrow-back' /> Back
                    </Button>
                </Alert>
            )
        }


    }

});

module.exports = Report;