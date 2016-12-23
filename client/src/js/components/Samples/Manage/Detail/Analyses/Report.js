import React from "react";
import Numeral from "numeral";
import { upperFirst, camelCase } from 'lodash';
import { Table } from "react-bootstrap";
import { Icon, Button, RelativeTime } from 'virtool/js/components/Base';

var PathoscopeViewer = require('./Pathoscope/Viewer');
var NuVsViewer = require('./NuVs/Viewer');

var AnalysisReport = React.createClass({

    render: function () {

        let content;
        
        if (this.props.algorithm.indexOf('pathoscope') > -1) {
            content = (
                <PathoscopeViewer
                    {...this.props}
                />
            );
        }

        if (this.props.algorithm === 'nuvs') {
            content = (
                <NuVsViewer
                    {...this.props}
                />
            )
        }

        return (
            <div>
                <Table bordered>
                    <tbody>
                        <tr>
                            <th className='col-md-3'>Name</th>
                            <td className='col-md-9'>{this.props.name || 'Unnamed Analysis'}</td>
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

                <Button bsStyle='primary' onClick={this.props.onBack} block>
                    <Icon name='arrow-back' /> Back
                </Button>
            </div>
        );
    }

});

module.exports = AnalysisReport;