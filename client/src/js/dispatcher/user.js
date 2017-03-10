/**
 * Copyright 2015, Government of Canada.
 * All rights reserved.
 *
 * This source code is licensed under the MIT license.
 *
 * @providesModule User
 */

import { assign, omit, forIn } from "lodash";
import Cookie from "js-cookie";
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

        this.name = data._id;
        Cookie.set("token", data.token, { expires: 7 });

        this.emit("change");
    }

    authorize (data) {
        this.load(data);
        dispatcher.sync();
    }

    deauthorize (data) {

        forIn(dispatcher.db.collectionNames, collectionName => {
            const collection = dispatcher.db[collectionName];
            collection.clear();
            collection.synced = false;
        });

        dispatcher.db.loki.saveDatabase(() => {

            window.location.hash = "home/welcome";

            dispatcher.user = new User();

            this.emit("logout", data);
        });

    }
}
