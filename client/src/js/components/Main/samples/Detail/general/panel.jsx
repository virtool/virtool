var React = require('react');
var Panel = require('react-bootstrap/lib/Panel');
var Table = require('react-bootstrap/lib/Table');
var Moment = require('moment');
var Numeral = require('numeral');

var Icon = require('virtool/js/components/Base/Icon.jsx');
var InputCell = require('virtool/js/components/Base/InputCell.jsx');

var General = React.createClass({

    render: function () {

        var data = this.props.data;

        var paired = 'No';
        if (data.paired) {paired = 'Yes';}

        var nameCell;
        var hostCell;
        var isolateCell;

        if (this.props.canModify) {
            nameCell = <InputCell {...this.props} field="name" value={data.name} className='col-sm-8' />;
            hostCell = <InputCell {...this.props} field="host" value={data.host} className='col-sm-8' />;
            isolateCell = <InputCell {...this.props} field="isolate" value={data.isolate} className='col-sm-8' />;
        } else {
            nameCell = <td className='col-sm-8'>{data.name}</td>;
            hostCell = <td className='col-sm-8'>{data.host}</td>;
            isolateCell = <td className='col-sm-8'>{data.isolate}</td>;
        }

        var databaseIdRow = dispatcher.user.settings.show_ids ? (
            <tr>
                <th>Database ID</th>
                <td>{data._id}</td>
            </tr>
        ): null;

        var databaseVersionRow = dispatcher.user.settings.show_versions ? (
            <tr>
                <th>Database Version</th>
                <td>{data._version}</td>
            </tr>
        ): null;

        return (
            <Panel className='tab-panel'>
                <h5>
                    <span>
                        <Icon name='tag' /> <strong>General</strong>
                    </span>
                </h5>
                <table className='table table-bordered'>
                  <tbody>
                    <tr>
                      <th className='col-sm-4'>Name</th>
                        {nameCell}
                    </tr>
                    <tr>
                      <th>Host</th>
                        {hostCell}
                    </tr>
                    <tr>
                      <th>Isolate</th>
                        {isolateCell}
                    </tr>
                    {databaseIdRow}
                    {databaseVersionRow}
                    <tr>
                      <th>Added</th>
                      <td>{Moment(data.added).calendar()}</td>
                    </tr>
                    <tr>
                      <th>Added By</th>
                      <td>{data.username}</td>
                    </tr>
                  </tbody>
                </table>

                <h5><Icon name='table' /> <strong>Library Properties</strong></h5>
                <table className='table table-condensed table-bordered'>
                  <tbody>
                    <tr>
                      <th className='col-sm-4'>Read Count</th>
                      <td className='col-sm-8'>{Numeral(data.quality.count).format('0.0 a')}</td>
                    </tr>
                    <tr>
                      <th>Length Range</th>
                      <td>{data.quality.length.join(' - ')}</td>
                    </tr>
                    <tr>
                      <th>GC Content</th>
                      <td>{Numeral(data.quality.gc).format('0.0 %')}</td>
                    </tr>
                    <tr>
                      <th>Paired</th>
                      <td>{paired}</td>
                    </tr>
                  </tbody>
                </table>

                <h5><Icon name='cabinet' /> <strong>Files</strong></h5>
                <table className='table table-condensed table-bordered'>
                  <tbody>
                    <tr>
                      <th className='col-sm-4'>Original Files</th>
                      <td className='col-sm-8'>{data.files.join(', ')}</td>
                    </tr>
                    <tr>
                      <th>Format</th>
                      <td>{data.format.toUpperCase()}</td>
                    </tr>
                    <tr>
                      <th>Encoding</th>
                      <td>{data.quality.encoding}</td>
                    </tr>
                  </tbody>
                </table>
            </Panel>
        );
    }

});

module.exports = General;