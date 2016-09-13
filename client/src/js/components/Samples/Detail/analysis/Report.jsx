var _ = require('lodash');
var Numeral = require('numeral');
var React = require('react');
var Row = require('react-bootstrap/lib/Row');
var Col = require('react-bootstrap/lib/Col');
var Panel = require('react-bootstrap/lib/Panel');
var Table = require('react-bootstrap/lib/Table');
var Input = require('react-bootstrap/lib/InputGroup');

var Icon = require('virtool/js/components/Base/Icon.jsx');
var PushButton = require('virtool/js/components/Base/PushButton.jsx');
var RelativeTime = require('virtool/js/components/Base/RelativeTime.jsx');

var PathoscopeReport = require('./Pathoscope/report.jsx');
var NuVsReport = require('./NuVs/report.jsx');

var AnalysisReport = React.createClass({

    render: function () {
        
        if (this.props.algorithm.indexOf('pathoscope') > -1) {
            content = (
                <PathoscopeReport
                    {...this.props}
                />
            );
        }

        if (this.props.algorithm === 'nuvs') {
            content = (
                <NuVsReport
                    {...this.props}
                />
            )
        }

        return (
            <div>
                <Table bordered>
                    <tbody>
                        <tr>
                            <th className='col-md-3'>Nickname</th>
                            <td className='col-md-9'>{this.props.comments || 'Unnamed Analysis'}</td>
                        </tr>
                        <tr>
                            <th>Algorithm</th>
                            <td>{this.props.algorithm === 'nuvs' ? 'NuVs': _.upperFirst(_.camelCase(this.props.algorithm))}</td>
                        </tr>
                        <tr>
                            <th>Library Read Count</th>
                            <td>{Numeral(this.props.readCount).format()}</td>
                        </tr>
                        <tr>
                            <th>Added</th>
                            <td><RelativeTime time={this.props.timestamp} /></td>
                        </tr>
                        <tr>
                            <th>User</th>
                            <td>{this.props.username}</td>
                        </tr>
                    </tbody>
                </Table>

                {content}

                <PushButton bsStyle='primary' onClick={this.props.onBack} block>
                    <Icon name='arrow-back' /> Back
                </PushButton>
            </div>
        );
    }

});

module.exports = AnalysisReport;