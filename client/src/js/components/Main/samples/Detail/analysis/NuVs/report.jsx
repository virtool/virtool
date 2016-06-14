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
var HMMView = require('./HMM/View.jsx');
var ORFView = require('./ORF/View.jsx');

var Report = React.createClass({

    getInitialState: function () {
        return {
            mode: 'hmm',
            significantHMMOnly: true
        };
    },

    setMode: function (mode) {
        console.log('mode: ' + mode);
        this.setState({
            mode: mode
        });
    },

    render: function () {
        console.log(this.props);

        var hmms = this.props.hmm;

        if (this.state.significantHMMOnly) {
            hmms = _.filter(hmms, function (hmm) {
                return hmm.full_e < 0.00001;
            });
        }

        hmms = _.sortBy(hmms, 'full_e');

        var view;

        if (this.state.mode === 'composite') {
            view = <CompositeView {...this.props} />;
        }

        if (this.state.mode === 'hmm') {
            view = <HMMView hmms={hmms} />;
        }

        if (this.state.mode === 'orf') {
            view = <ORFView {...this.props} />;
        }

        var control = <Control mode={this.state.mode} setMode={this.setMode} />;

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
                    {view}
                </Panel>
            </div>
        );
    }

});

module.exports = Report;