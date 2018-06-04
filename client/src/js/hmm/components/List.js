import React from "react";
import { FormControl, FormGroup, InputGroup } from "react-bootstrap";
import { connect } from "react-redux";
import { push } from "react-router-redux";

import HMMItem from "./Item";
import HMMInstaller from "./Installer";
import { Icon, LoadingPlaceholder, ViewHeader, ScrollList } from "../../base";
import { createFindURL, getFindTerm } from "../../utils";
import { findHmms } from "../actions";

class HMMList extends React.Component {

    constructor (props) {
        super(props);
        this.state = {
            masterList: this.props.documents,
            list: this.props.documents,
            page: this.props.page
        };
    }

    static getDerivedStateFromProps (nextProps, prevState) {

        if (prevState.masterList === null && nextProps.documents) {
            return {
                masterList: nextProps.documents,
                list: nextProps.documents,
                page: nextProps.page
            };
        }

        if (prevState.page !== nextProps.page) {
            return {
                masterList: prevState.masterList.concat(nextProps.documents),
                list: nextProps.documents,
                page: nextProps.page
            };
        }

        return null;
    }

    rowRenderer = (index) => (
        <HMMItem
            key={this.state.masterList[index].id}
            {...this.state.masterList[index]}
        />
    );

    render () {
        if (this.props.documents === null) {
            return <LoadingPlaceholder />;
        }

        if (this.props.status.installed) {
            return (
                <div>
                    <ViewHeader title="HMMs" />

                    <FormGroup>
                        <InputGroup>
                            <InputGroup.Addon>
                                <Icon name="search" />
                            </InputGroup.Addon>

                            <FormControl
                                type="text"
                                placeholder="Definition, cluster, family"
                                onChange={(e) => this.props.onFind({find: e.target.value})}
                                value={this.props.term}
                            />
                        </InputGroup>
                    </FormGroup>

                    <ScrollList
                        hasNextPage={this.props.page < this.props.page_count}
                        isNextPageLoading={this.props.isLoading}
                        list={this.state.masterList}
                        loadNextPage={this.props.loadNextPage}
                        page={this.state.page}
                        rowRenderer={this.rowRenderer}
                    />
                </div>
            );
        }

        return (
            <div>
                <h3 className="view-header">
                    <strong>
                        HMMs
                    </strong>
                </h3>
                <HMMInstaller />
            </div>
        );
    }
}

const mapStateToProps = (state) => ({
    ...state.hmms,
    term: getFindTerm()
});

const mapDispatchToProps = (dispatch) => ({

    onFind: ({find, page}) => {
        const url = createFindURL({find, page});
        dispatch(push(url.pathname + url.search));
    },

    loadNextPage: (page) => {
        dispatch(findHmms(page));
    }

});

export default connect(mapStateToProps, mapDispatchToProps)(HMMList);
