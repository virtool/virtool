var React = require('react');
var Panel = require('react-bootstrap/lib/Panel');
var Table = require('react-bootstrap/lib/Table');
var Moment = require('moment');
var Numeral = require('numeral');

var Icon = require('virtool/js/components/Base/Icon.jsx');
var InputCell = require('virtool/js/components/Base/InputCell.jsx');

var SampleDetailGeneral = React.createClass({

    propTypes: {
        _id: React.PropTypes.string.isRequired,
        _version: React.PropTypes.number.isRequired,
        name: React.PropTypes.string,
        host: React.PropTypes.string,
        isolate: React.PropTypes.string,
        paired: React.PropTypes.bool.isRequired,
        username: React.PropTypes.string.isRequired,
        added: React.PropTypes.string.isRequired,
        quality: React.PropTypes.object.isRequired
    },

    render: function () {

        var cells = ["name", "host", "isolate"].map(function (field) {

            var inputCell;

            if (this.props.canModify) {
                inputCell = (
                    <InputCell
                        _id={this.props._id}
                        field={field}
                        value={this.props[field]}
                        className="col-sm-8"
                        collection={dispatcher.db.samples}
                    />
                );
            } else {
                inputCell = <td className='col-sm-8'>{this.props[field]}</td>;
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
                <td>{this.props._id}</td>
            </tr>
        ): null;

        var databaseVersionRow = dispatcher.user.settings.show_versions ? (
            <tr>
                <th>Database Version</th>
                <td>{this.props._version}</td>
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
                      <td>{Moment(this.props.added).calendar()}</td>
                    </tr>
                    <tr>
                      <th>Added By</th>
                      <td>{this.props.username}</td>
                    </tr>
                  </tbody>
                </table>

                <h5><Icon name='table' /> <strong>Library Properties</strong></h5>
                <table className='table table-condensed table-bordered'>
                  <tbody>
                    <tr>
                      <th className='col-sm-4'>Read Count</th>
                      <td className='col-sm-8'>{Numeral(this.props.quality.count).format('0.0 a')}</td>
                    </tr>
                    <tr>
                      <th>Length Range</th>
                      <td>{this.props.quality.length.join(' - ')}</td>
                    </tr>
                    <tr>
                      <th>GC Content</th>
                      <td>{Numeral(this.props.quality.gc / 100).format('0.0 %')}</td>
                    </tr>
                    <tr>
                      <th>Paired</th>
                      <td>{this.props.paired ? "Yes": "No"}</td>
                    </tr>
                  </tbody>
                </table>

                <h5><Icon name='file' /> <strong>Files</strong></h5>
                <table className='table table-condensed table-bordered'>
                  <tbody>
                    <tr>
                      <th className='col-sm-4'>Original Files</th>
                      <td className='col-sm-8'>{this.props.files.join(', ')}</td>
                    </tr>
                    <tr>
                      <th>Encoding</th>
                      <td>{this.props.quality.encoding}</td>
                    </tr>
                  </tbody>
                </table>
            </Panel>
        );
    }

});

module.exports = SampleDetailGeneral;