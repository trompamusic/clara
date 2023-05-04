import {
    useSession,
} from "@inrupt/solid-ui-react";

import React, {useEffect, useState} from "react";
import ScoreSelector from "./ScoreSelector";
import {createContainerAt, getSolidDataset, getThing, getUrl, Thing} from "@inrupt/solid-client";
import {fetch} from "@inrupt/solid-client-authn-browser";
import {WS} from "@inrupt/vocab-solid-common";
import {apiRoot, authUrl} from "../config";

/**
 * Identifies if a user has set up their account
 * (logged in, we have permission to edit, the clara container exists)
 *
 * Once these steps are done, show the interface to select a score to perform
 */
export default function Startup() {
    const [hasPermission, setHasPermission] = useState(false);
    const [hasClaraContainer, setHasClaraContainer] = useState(false);
    const [checkingPermission, setCheckingPermission] = useState(true);
    const [checkingClaraContainer, setCheckingClaraContainer] = useState(true);
    const {session} = useSession();

    const webId = session.info.webId ?? "";
    const profileParams = new URLSearchParams({
        profile: webId,
        redirect: apiRoot
    });

    useEffect(() => {
        if (session.info.isLoggedIn) {
            let ignore = false;

            // use URLSearchParams so that it encodes the parameter (web IDs often have a # in them which
            //   needs to be sent)
            // TODO: This is the endpoint to request if we have permissions for writing
            fetch(`${apiRoot}/check_user_perms?` + profileParams).then(result => {
                return result.json();
            }).then(data => {
                if (!ignore) {
                    setHasPermission(data.has_permission);
                    setCheckingPermission(false);
                }
            });
            return () => {
                ignore = true;
            };
        }
    }, [session.info.isLoggedIn]);

    // Check if a clara container exists in the user's pod
    // TODO: Using async because of existing `readProfile` method... Use regular callbacks?
    useEffect(() => {
        async function fetchClaraContainer() {
            // TODO: We lookup the user's storage multiple times
            const dataset = await getSolidDataset(webId, { fetch: session.fetch });
            const profileDoc = getThing(dataset, webId);
            const storageUrl = getUrl(profileDoc, WS.storage);
            const CLARA_CONTAINER_NAME = "at.ac.mdw.trompa/";
            const claraStorageUrl = storageUrl + CLARA_CONTAINER_NAME;
            // TODO: Docs say this raises an error if it already exists, but doesn't seem to be a problem
            await createContainerAt(claraStorageUrl, {fetch: session.fetch});
            if (!ignore) {
                setHasClaraContainer(true);
                setCheckingClaraContainer(false);
            }
        }
        let ignore = false;
        if (session.info.isLoggedIn && hasPermission) {
            fetchClaraContainer();
            return () => {
                ignore = true;
            };
        }
    }, [hasPermission]);

    if (!session.info.isLoggedIn) {
        return <p>You must be logged in</p>
    }

    if (checkingPermission) {
        return <p>Checking if you have let us store items in your Solid pod...</p>
    } else {

            if (hasPermission) {
                return <ScoreSelector/>
            } else {
                return <p>You haven't given permission for us to act on your behalf <br/>
                    Please visit the <a href={`${authUrl}?${profileParams}`}>Authentication
                        page</a> to do this</p>
            }
    }
}
