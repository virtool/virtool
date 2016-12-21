var React = require('react');
var Row = require('react-bootstrap/lib/Row');
var Col = require('react-bootstrap/lib/Col');
var Grid = require('react-bootstrap/lib/Grid');
var Dropdown = require('react-bootstrap/lib/Dropdown');
var MenuItem = require('react-bootstrap/lib/MenuItem');
var FormGroup = require('react-bootstrap/lib/FormGroup');
var InputGroup = require('react-bootstrap/lib/InputGroup');
var FormControl = require('react-bootstrap/lib/FormControl');
var ButtonGroup = require('react-bootstrap/lib/ButtonGroup');
var ButtonToolbar = require('react-bootstrap/lib/ButtonToolbar');

var Icon = require('virtool/js/components/Base/Icon.jsx');
var Flex = require('virtool/js/components/Base/Flex.jsx');
var Button = require('virtool/js/components/Base/PushButton.jsx');
var Checkbox = require('virtool/js/components/Base/Checkbox.jsx');

var PathoscopeList = require('./List.jsx');

var PathoscopeController = React.createClass({

    getInitialState: function () {
        return {
            filterViruses: true,
            filterIsolates: true,

            findTerm: "",

            sortKey: "coverage",
            sortDescending: true,

            showReads: false,
            expanded: []
        };
    },

    collapseAll: function () {
        this.setState({
            expanded: []
        });
    },

    toggleIn: function (virusId) {
        this.setState({
            expanded: _.xor(this.state.expanded, [virusId])
        });
    },

    toggleShowReads: function () {
        this.setState({showReads: !this.state.showReads});
    },

    setFindTerm: function (event) {
        this.setState({findTerm: event.target.value});
    },

    setSortKey: function (event) {
        this.setState({sortKey: event.target.value});
    },

    toggleSortDescending: function () {
        this.setState({sortDescending: !this.state.sortDescending});
    },

    filter: function (eventKey) {

        switch (eventKey) {

            case "viruses":
                this.setState({filterViruses: !this.state.filterViruses});
                break;

            case "isolates":
                this.setState({filterIsolates: !this.state.filterIsolates});
                break;

            default:
                var bool = !(this.state.filterViruses || this.state.filterIsolates);

                this.setState({
                    filterViruses: bool,
                    filterIsolates: bool
                });
        }
    },

    render: function () {

        var data = _.sortBy(this.props.data, this.state.sortKey);

        if (this.state.filterViruses) {
            var totalReadsMapped = _.sum(_.map(data, "reads"));

            var re = this.state.findTerm ? new RegExp(this.state.findTerm, "i"): null;

            data = _.filter(data, function (virus) {
                return (
                    (virus.pi * totalReadsMapped >= virus.ref_length * 0.8 / this.props.maxReadLength) &&
                    (!re || (re.test(virus.abbreviation) || re.test(virus.name)))
                );
            }.bind(this));
        }

        if (this.state.filterIsolates) {
            data = data.map(function (virus) {
                var minIsolateWeight = 0.03 * virus.pi;

                var filteredVirus = _.clone(virus);

                filteredVirus.isolates = _.filter(filteredVirus.isolates, function (isolate) {
                    return isolate.pi >= minIsolateWeight;
                });

                return filteredVirus;
            });
        }

        if (this.state.sortDescending) {
            data.reverse();
        }

        return (
            <div>
                <div>
                    <Flex>
                        <Flex.Item grow={4}>
                            <FormGroup>
                                <InputGroup>
                                    <InputGroup.Addon>
                                        <Icon name="search" /> Find
                                    </InputGroup.Addon>
                                    <FormControl value={this.state.findTerm} onChange={this.setFindTerm} />
                                </InputGroup>
                            </FormGroup>
                        </Flex.Item>

                        <Flex.Item pad>
                            <FormGroup>
                                <InputGroup>
                                    <InputGroup.Addon>
                                        <Icon name="sort" /> Sort
                                    </InputGroup.Addon>
                                    <FormControl componentClass="select" value={this.state.sortKey} onChange={this.setSortKey}>
                                        <option className="text-primary" value="coverage">Coverage</option>
                                        <option className="text-success" value="pi">Weight</option>
                                        <option className="text-danger" value="best">Best Hit</option>
                                    </FormControl>
                                    <InputGroup.Button>
                                        <Button title="Sort Direction" onClick={this.toggleSortDescending}>
                                            <Icon name={this.state.sortDescending ? "sort-desc": "sort-asc"} />
                                        </Button>
                                    </InputGroup.Button>
                                </InputGroup>
                            </FormGroup>
                        </Flex.Item>

                        <Flex.Item pad>
                            <Button title="Collapse" onClick={this.collapseAll} disabled={this.state.expanded.length === 0}>
                                <Icon name='shrink' />
                            </Button>
                        </Flex.Item>

                        <Flex.Item pad>
                            <Button title="Change Weight Format" active={!this.state.showReads} onClick={this.toggleShowReads}>
                                <Icon name='pie' />
                            </Button>

                        </Flex.Item>

                        <Flex.Item pad>
                            <Dropdown id="job-clear-dropdown" onSelect={this.handleSelect} className="split-dropdown" pullRight>
                                <Button title="Filter" onClick={this.filter} active={this.state.filterViruses || this.state.filterIsolates}>
                                    <Icon name="filter" />
                                </Button>
                                <Dropdown.Toggle />
                                <Dropdown.Menu onSelect={this.filter}>
                                    <MenuItem eventKey="viruses">
                                        <Flex>
                                            <Flex.Item>
                                                <Checkbox checked={this.state.filterViruses} />
                                            </Flex.Item>
                                            <Flex.Item pad={5}>
                                                Viruses
                                            </Flex.Item>
                                        </Flex>
                                    </MenuItem>
                                    <MenuItem eventKey="isolates">
                                        <Flex>
                                            <Flex.Item>
                                                <Checkbox checked={this.state.filterIsolates} />
                                            </Flex.Item>
                                            <Flex.Item pad={5}>
                                                Isolates
                                            </Flex.Item>
                                        </Flex>
                                    </MenuItem>
                                </Dropdown.Menu>
                            </Dropdown>
                        </Flex.Item>
                    </Flex>
                </div>

                <PathoscopeList
                    data={data}
                    expanded={this.state.expanded}
                    toggleIn={this.toggleIn}
                    showReads={this.state.showReads}
                />
            </div>
        );
    }

});

module.exports = PathoscopeController;