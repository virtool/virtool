var _ = require('lodash');
var React = require('react');
var Table = require('react-bootstrap/lib/Table');
var Panel = require('react-bootstrap/lib/Panel');
var ListGroup = require('react-bootstrap/lib/ListGroup');
var ListGroupItem = require('react-bootstrap/lib/ListGroupItem');
var Label = require('react-bootstrap/lib/Label');
var Button = require('react-bootstrap/lib/Button');

var Flex = require('virtool/js/components/Base/Flex.jsx');
var Icon = require('virtool/js/components/Base/Icon.jsx');
var PushButton = require('virtool/js/components/Base/PushButton.jsx');

var Control = require('./Control/bar.jsx');
var CompositeView = require('./Composite/View.jsx');

var Report = React.createClass({

    getInitialState: function () {
        return {
            filterHMM: true,
            filterORF: true
        };
    },

    toggleFilterHMM: function () {
        this.setState({
            filterHMM: !this.state.filterHMM
        });
    },

    toggleFilterORF: function () {
        this.setState({
            filterORF: !this.state.filterORF
        });
    },

    render: function () {

        var hmms = this.props.hmm;

        if (this.state.filterHMM) {
            hmms = _.filter(hmms, function (hmm) {
                return hmm.full_e < 10e-15;
            });
        }

        hmms = _.sortBy(hmms, 'full_e');

        var orfs = this.props.orfs;

        if (this.state.filterORF) {
            var orfsToInclude = hmms.map(function (hmm) {
                return hmm.index + '.' + hmm.orf_index;
            });

            orfs = _.filter(orfs, function (orf) {
                return _.includes(orfsToInclude, orf.index + '.' + orf.orf_index);
            });
        }

        var control = (
            <Control
                {...this.state}
                toggleFilterHMM={this.toggleFilterHMM}
                toggleFilterORF={this.toggleFilterORF}
                setMode={this.setMode}

            />
        );

        return (
            <div>
                <Table bordered>
                    <tbody>
                        <tr>
                            <th className='col-md-3'>Contig Count</th>
                            <td className='col-md-9'>{this.props.sequences.length}</td>
                        </tr>
                        <tr>
                            <th className='col-md-3'><abbr title='Open reading frame'>ORF</abbr> Count</th>
                            <td className='col-md-9'>{this.props.orfs.length}</td>
                        </tr>
                        <tr>
                            <th className='col-md-3'>Significant Predictions</th>
                            <td className='col-md-9'>{hmms.length}</td>
                        </tr>
                    </tbody>
                </Table>

                <Panel header={control}>
                    <CompositeView
                        sequences={this.props.sequences}
                        hmms={hmms}
                        orfs={orfs}

                        toggleFilterHMM={this.toggleFilterHMM}
                        toggleFilterORF={this.toggleFilterORF}
                    />
                </Panel>
            </div>
        );
    }

});

module.exports = Report;