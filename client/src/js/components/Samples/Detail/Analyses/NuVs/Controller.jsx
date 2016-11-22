var _ = require('lodash');
var React = require('react');

var Table = require('react-bootstrap/lib/Table');
var FormGroup = require('react-bootstrap/lib/FormGroup');
var InputGroup = require('react-bootstrap/lib/InputGroup');
var FormControl = require('react-bootstrap/lib/FormControl');
var Dropdown = require('react-bootstrap/lib/Dropdown');
var MenuItem = require('react-bootstrap/lib/MenuItem');

var Flex = require('virtool/js/components/Base/Flex.jsx');
var Icon = require('virtool/js/components/Base/Icon.jsx');

var Button = require('virtool/js/components/Base/PushButton.jsx');
var Checkbox = require('virtool/js/components/Base/Checkbox.jsx');

var NuVsList = require('./List.jsx');

var NuVsController = React.createClass({

    propTypes: {
        data: React.PropTypes.arrayOf(React.PropTypes.object)
    },

    getInitialState: function () {
        return {
            findTerm: "",

            filterSequences: true,
            filterORFs: true
        };
    },

    setFindTerm: function (event) {
        this.setState({
            findTerm: event.target.value
        });
    },

    filter: function (eventKey) {

        switch (eventKey) {

            case "sequences":
                this.setState({filterSequences: !this.state.filterSequences});
                break;

            case "orfs":
                this.setState({filterORFs: !this.state.filterORFs});
                break;

            default:
                var bool = !(this.state.filterSequences || this.state.filterORFs);

                this.setState({
                    filterSequences: bool,
                    filterORFs: bool
                });
        }
    },

    render: function () {

        var data = this.props.data;

        if (this.state.filterORFs) {
            data = data.map(function (sequence) {
                return _.assign({}, sequence, {orfs: _.filter(sequence.orfs, {hasHmm: true})});
            });
        }

        if (this.state.filterSequences) {
            data = _.filter(data, function (sequence) {
                return sequence.hasSignificantOrf;
            });
        }

        return (
            <div>
                <Table bordered>
                    <tbody>
                        <tr>
                            <th className='col-md-3'>Contig Count</th>
                            <td className='col-md-9'>{this.props.data.length}</td>
                        </tr>
                    </tbody>
                </Table>

                <div>
                    <Flex>
                        <Flex.Item>
                            <FormGroup>
                                <InputGroup>
                                    <InputGroup.Addon>
                                        <Icon name="search" /> Find
                                    </InputGroup.Addon>
                                    <FormControl
                                        value={this.state.findTerm}
                                        onChange={this.setFindTerm}
                                        placeholder="Definition, family"
                                    />
                                </InputGroup>
                            </FormGroup>
                        </Flex.Item>
                        <Flex.Item pad>
                            <Button onClick={this.collapseAll}>
                                <Icon name="shrink" />
                            </Button>
                        </Flex.Item>
                        <Flex.Item pad>
                            <Dropdown id="job-clear-dropdown" onSelect={this.handleSelect} className="split-dropdown" pullRight>
                                <Button title="Filter" onClick={this.filter} active={this.state.filterSequences || this.state.filterORFs}>
                                    <Icon name="filter" />
                                </Button>
                                <Dropdown.Toggle />
                                <Dropdown.Menu onSelect={this.filter}>
                                    <MenuItem eventKey="sequences">
                                        <Flex>
                                            <Flex.Item>
                                                <Checkbox checked={this.state.filterSequences} />
                                            </Flex.Item>
                                            <Flex.Item pad={5}>
                                                Sequences
                                            </Flex.Item>
                                        </Flex>
                                    </MenuItem>
                                    <MenuItem eventKey="orfs">
                                        <Flex>
                                            <Flex.Item>
                                                <Checkbox checked={this.state.filterORFs} />
                                            </Flex.Item>
                                            <Flex.Item pad={5}>
                                                ORFs
                                            </Flex.Item>
                                        </Flex>
                                    </MenuItem>
                                </Dropdown.Menu>
                            </Dropdown>
                        </Flex.Item>
                    </Flex>
                </div>

                <NuVsList
                    data={data}
                    analysisId={this.props.analysisId}
                    maxSequenceLength={this.props.maxSequenceLength}
                />
            </div>
        );
    }

});

module.exports = NuVsController;