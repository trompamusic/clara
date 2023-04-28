import {useSearchParams} from "react-router-dom";
import React, {useContext, useEffect, useState} from "react";
import {useSession} from "@inrupt/solid-ui-react";
import {fetch} from "@inrupt/solid-client-authn-browser";
import {apiRoot} from "../config";

/**
 * The main wrapper to perform a score
 *
 *  - Takes a score URL as a parameter
 *  - Sends a request to the server to set up the score in the user's pod
 *      (download score, get metadata, run initial script)
 *  - Load the Clara interface, using the score that we downloaded to the user's pod
 * @constructor
 */
export default function Perform() {
    let [searchParams, setSearchParams] = useSearchParams();
    const {session} = useSession();
    const resource = searchParams.get('resource');
    const container = searchParams.get('container');

    // If a resource parameter exists, request to the server to create a container in the pod
    useEffect(() => {
        if (session.info.isLoggedIn && resource) {
            let ignore = false;

            const data = {
                score: resource,
                profile: session.info.webId
            }
            fetch(`${apiRoot}/add`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(data),
            }).then(result => {
                return result.json();
            }).then(data => {
                if (!ignore) {
                    // TODO: Here we get a task id, and we should poll until it's finished
                    // https://overreacted.io/making-setinterval-declarative-with-react-hooks/
                    // We could redirect to use ?container= after this, since we know what the container
                    //   is that we want to perform in
                }
            });
            return () => {
                ignore = true;
            };
        }
    }, [resource]);

    if (!session.info.isLoggedIn) {
        return <p>You must be logged in</p>
    }

    if ((!resource && !container) || (resource && container)) {
        return <p>Error: You need to specify only one of a "resource" or "container"</p>
    }

    return <p>
        Performing a performance on {resource} or {container}
    </p>
}
