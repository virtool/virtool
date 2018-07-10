import React from "react";
import {Dropdown, FormControl, FormGroup, InputGroup, MenuItem} from "react-bootstrap";
import {connect} from "react-redux";
import {Button, Checkbox, Flex, FlexItem, Icon} from "../../../base/index";
import {
    collapseAnalysis,
    setPathoscopeFilter,
    setSortKey,
    toggleCrop,
    togglePathoscopeSortDescending,
    toggleShowPathoscopeMedian,
    toggleShowPathoscopeReads
} from "../../actions";

export const PathoscopeToolbar = (props) => {

    const {
        crop,
        filterIsolates,
        filterOTUs,
        onCollapse,
        onFilter,
        onSetSortKey,
        onToggleCrop,
        onToggleShowMedian,
        onToggleShowReads,
        onToggleSortDescending,
        showMedian,
        showReads,
        sortDescending,
        sortKey
    } = props;

    return (
        <div className="toolbar">
            <FormGroup>
                <InputGroup>
                    <InputGroup.Button>
                        <Button
                            title="Sort Direction"
                            onClick={onToggleSortDescending}
                            tip="Sort List"
                        >
                            <Icon
                                name={sortDescending ? "sort-amount-down" : "sort-amount-up"}
                            />
                        </Button>
                    </InputGroup.Button>
                    <FormControl
                        componentClass="select"
                        value={sortKey}
                        onChange={onSetSortKey}
                    >
                        <option className="text-primary" value="coverage">
                            Coverage
                        </option>
                        <option className="text-success" value="pi">
                            Weight
                        </option>
                        <option className="text-danger" value="maxDepth">
                            Depth
                        </option>
                    </FormControl>
                </InputGroup>
            </FormGroup>

            <Button
                icon="compress"
                title="Collapse"
                tip="Collapse Opened"
                onClick={onCollapse}
                className="hidden-xs"
                disabled={false}
            />

            <Button
                icon="chart-pie"
                title="Change Weight Format"
                tip="Change Weight Format"
                active={!showReads}
                className="hidden-xs"
                onClick={onToggleShowReads}
            />

            <Button
                icon="chart-bar"
                title="Show Isolate Median"
                tip="Show Isolate Median"
                active={showMedian}
                className="hidden-xs"
                onClick={onToggleShowMedian}
            />

            <Button
                icon="crop"
                title="Crop Outliers"
                tip="Crop Outliers"
                active={crop}
                className="hidden-xs"
                onClick={onToggleCrop}
            />

            <Dropdown
                id="job-clear-dropdown"
                onSelect={onFilter}
                className="split-dropdown"
                pullRight
                style={{zIndex: "1"}}
            >
                <Button
                    title="Filter"
                    tip="Filter Results"
                    onClick={onFilter}
                    active={filterOTUs || filterIsolates}
                >
                    <Icon name="filter" />
                </Button>
                <Dropdown.Toggle />
                <Dropdown.Menu onSelect={onFilter}>
                    <MenuItem eventKey="OTUs">
                        <Flex>
                            <FlexItem>
                                <Checkbox checked={filterOTUs} />
                            </FlexItem>
                            <FlexItem pad={5}>
                                OTUs
                            </FlexItem>
                        </Flex>
                    </MenuItem>
                    <MenuItem eventKey="isolates">
                        <Flex>
                            <FlexItem>
                                <Checkbox checked={filterIsolates} />
                            </FlexItem>
                            <FlexItem pad={5}>
                                Isolates
                            </FlexItem>
                        </Flex>
                    </MenuItem>
                </Dropdown.Menu>
            </Dropdown>
        </div>
    );
};

const mapStateToProps = (state) => ({
    ...state.analyses
});

const mapDispatchToProps = (dispatch) => ({

    onCollapse: () => {
        dispatch(collapseAnalysis());
    },

    onFilter: (key) => {
        dispatch(setPathoscopeFilter(key));
    },

    onSetSortKey: (key) => {
        dispatch(setSortKey(key));
    },

    onToggleCrop: () => {
        dispatch(toggleCrop());
    },

    onToggleShowMedian: () => {
        dispatch(toggleShowPathoscopeMedian());
    },

    onToggleShowReads: () => {
        dispatch(toggleShowPathoscopeReads());
    },

    onToggleSortDescending: () => {
        dispatch(togglePathoscopeSortDescending());
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(PathoscopeToolbar);
