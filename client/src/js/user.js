/**
 * Copyright 2015, Government of Canada.
 * All rights reserved.
 *
 * This source code is licensed under the MIT license.
 *
 * @providesModule User
 */

import { assign, omit } from "lodash";
import Events from "./events";

/**
 * An object that manages all user authentication and the user profile.
 *
 * @constructor
 */
export default class User {

    constructor () {
        this.name = null;
        this.events = new Events(["change", "logout"], this);
    }

    load (data) {
        // Update the username, token, and reset properties with the authorized values.
         assign(this, omit(data, "_id"));
    }
}
