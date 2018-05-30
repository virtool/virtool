import React from "react";
import { connect } from "react-redux";
import { AsyncTypeahead } from "react-bootstrap-typeahead";
import { Row, Col, Panel } from "react-bootstrap";
import { Flex, FlexItem } from "../../../base";
import { getControlReadahead } from "../../actions";
import { editReference } from "../../../references/actions";

class InternalControl extends React.Component {

    render () {

        const selected = this.props.internalControlId ? [this.props.internalControlId] : [];

        return (
            <div>
                <Row>
                    <Col xs={12} md={6}>
                        <Flex alignItems="center" style={{marginBottom: "10px"}}>
                            <FlexItem grow={1} >
                                <strong>Internal Control</strong>
                            </FlexItem>
                        </Flex>
                    </Col>
                    <Col smHidden md={8} />
                </Row>
                <Row>
                    <Col xs={12} mdPush={6} md={6}>
                        <Panel>
                            <Panel.Body>
                                Set an OTU that is spiked into samples to be used as a positive control.
                                Viral abundances in a sample can be calculated as proportions relative to the control.
                            </Panel.Body>
                        </Panel>
                    </Col>
                    <Col xs={12} mdPull={6} md={6}>
                        <Panel>
                            <Panel.Body>
                                <AsyncTypeahead
                                    labelKey="name"
                                    allowNew={false}
                                    isLoading={this.props.readaheadPending}
                                    onSearch={this.props.onGetReadahead.bind(this, this.props.refId)}
                                    onChange={this.props.onUpdate.bind(this, this.props.refId)}
                                    selected={selected}
                                    options={this.props.readahead || []}
                                    renderMenuItemChildren={option => <option key={option.id}>{option.name}</option>}
                                    disabled={!!this.props.isRemote}
                                />
                            </Panel.Body>
                        </Panel>
                    </Col>
                </Row>
            </div>
        );
    }
}

const mapStateToProps = (state) => ({
    settings: state.settings.data,
    readahead: state.settings.readahead,
    readaheadPending: state.settings.readaheadPending,
    internalControlId: state.references.detail.internal_control || null,
    refId: state.references.detail.id,
    isRemote: state.references.detail.remotes_from
});

const mapDispatchToProps = (dispatch) => ({

    onGetReadahead: (refId, term) => {
        dispatch(getControlReadahead(refId, term));
    },

    onUpdate: (refId, selected) => {
        const update = { internal_control: selected.length ? selected[0].id : ""};
        dispatch(editReference(refId, update));
    }

});

export default connect(mapStateToProps, mapDispatchToProps)(InternalControl);
