/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports ConfirmManagerMixin
 */

'use strict';

/**
 * An object that is attached to a React component by including the ConfirmManagerMixin. It managed showing and hiding
 * confirm modals.
 *
 * @param component - a reference to the component that the ConfirmManager object is attached to.
 * @class
 */
var ConfirmManager = function (component) {

    /**
     * Show a confirm modal.
     *
     * @param {string} operation - the name of the operation being confirmed in the modal.
     * @param {function} callback - the function to be called if the action is confirmed.
     * @param targets - the target objects to perform the action on (documents or document fragments)
     */
    this.show = function (operation, callback, targets) {
        component.setState({
            confirmManagerShow: true,
            confirmManagerCallback: (callback).bind(component),
            confirmManagerOperation: operation,
            confirmManagerTargets: targets instanceof Array ? targets: [targets]
        });
    };

    /**
     * Hide the confirm modal. Sets all state used by the ConfirmManager to initial values.
     */
    this.hide = function () {
        component.setState({
            confirmManagerShow: false,
            confirmManagerCallback: null,
            confirmManagerOperation: null,
            confirmManagerTargets: []
        });
    };

    /**
     * Retrieve state that serves as props for a ConfirmModal component. Intended to be included in the React component
     * definition like <Component {...this.getProps} />
     *
     * @returns {{show: boolean, callback: (*|null), operation: (string|null), targets: (*|Array), onHide: (ConfirmManager.hide|*)}}
     */
    this.getProps = function () {
        return {
            show: component.state.confirmManagerShow,
            callback: component.state.confirmManagerCallback,
            operation: component.state.confirmManagerOperation,
            targets: component.state.confirmManagerTargets,
            onHide: component.confirmManager.hide
        };
    };
};

/**
 * A mixin that included the ConfirmManager object into a React class.
 *
 * @mixin
 */
var ConfirmManagerMixin = {

    getInitialState: function () {
        return {
            confirmManagerShow: false,
            confirmManagerCallback: null,
            confirmManagerOperation: null,
            confirmManagerTargets: []
        };
    },

    componentWillMount: function () {
        this.confirmManager = new ConfirmManager(this);
    }
};

module.exports = ConfirmManagerMixin;

