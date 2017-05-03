    /**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

export const virusesAPI = {

    find: () => {
        fetch("/api/viruses")
            .then(resp => resp.json());
    },

    create: (virusData) => {
        fetch("/api/viruses", {
            method: "POST",
            body: JSON.stringify(virusData)
        }).then(resp => resp.json());
    },

    get: (virusId) => {
        fetch(`/api/viruses/${virusId}`, {
            method: "GET"
        }).then(resp => resp.json());
    },

    edit: (virusId, update) => {
        fetch(`/api/viruses/${virusId}`, {
            method: "PATCH",
            body: JSON.stringify(update)
        }).then(resp => resp.json());
    },

    remove: virusId => {
        fetch(`/api/viruses/${virusId}`, {
            method: "DELETE"
        }).then(resp => resp.json());
    },

    listIsolates: (virusId) => {
         fetch(`/api/viruses/${virusId}/isolates`)
             .then(resp => resp.json());
    },

    addIsolate: (virusId, isolateData) => {
        fetch(`/api/viruses/${virusId}/isolates`, {
            method: "POST",
            body: JSON.stringify(isolateData)
        }).then(resp => resp.json());
    },

    getIsolate: (virusId, isolateId) => {
        fetch(`/api/viruses/${virusId}/isolates/${isolateId}`)
            .then(resp => resp.json());
    },

    editIsolate: (virusId, isolateId, update) => {
        fetch(`/api/viruses/${virusId}/isolates/${isolateId}`, {
            method: "PATCH",
            body: JSON.stringify(update)
        }).then(resp => resp.json());
    }

};
