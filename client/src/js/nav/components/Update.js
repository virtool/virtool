import React from "react";
import { connect } from "react-redux";
import { NavItem } from "react-bootstrap";
import { LinkContainer } from "react-router-bootstrap";
import { getSoftwareUpdates } from "../../updates/actions";
import { Icon } from "../../base";

class NotificationIcon extends React.Component {

    componentDidMount () {
        this.props.onGet();

        this.interval = window.setInterval(() => {
            this.props.onGet();
        }, 300000);
    }

    componentWillUnmount () {
        window.clearInterval(this.interval);
    }

    render () {

        console.log(this.props);

        if (this.props.visible) {
            return (
                <LinkContainer to="/administration/updates">
                    <NavItem>
                        <Icon
                            className="icon-pulse"
                            name="arrow-alt-circle-up"
                            tip="Software Update"
                            tipPlacement="left"
                        />
                    </NavItem>
                </LinkContainer>
            );
        }

        return <div />;
    }
}

const mapStateToProps = (state) => {
    console.log(state.account);
    console.log(state.updates.software);

    return {
        visible: !!(state.account.administrator && state.updates.software && state.updates.software.releases.length)
    }
};

const mapDispatchToProps = (dispatch) => ({

    onGet: () => {
        dispatch(getSoftwareUpdates());
    }

});

export default connect(mapStateToProps, mapDispatchToProps)(NotificationIcon);
