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

        var cells = ["name", "host", "isolate"].map(function (field) {

            var inputCell;

            if (this.props.canModify) {
                inputCell = (
                    <InputCell
                        _id={data._id}
                        field={field}
                        value={data[field]}
                        className="col-sm-8"
                        collection={dispatcher.db.samples}
                    />
                );
            } else {
                inputCell = <td className='col-sm-8'>{data.name}</td>;
            }

            return (
                <tr key={field}>
                    <th className="col-md-4">{_.capitalize(field)}</th>
                    {inputCell}
                </tr>
            );

        }, this);

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
                    {cells}
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

                <h5><Icon name='file' /> <strong>Files</strong></h5>
                <table className='table table-condensed table-bordered'>
                  <tbody>
                    <tr>
                      <th className='col-sm-4'>Original Files</th>
                      <td className='col-sm-8'>{data.files.join(', ')}</td>
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