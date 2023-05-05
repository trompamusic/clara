import {
    useSession,
} from "@inrupt/solid-ui-react";

import React, {useEffect, useState} from "react";
import {createContainerAt, getSolidDataset, getThing, getUrl} from "@inrupt/solid-client";
import {WS} from "@inrupt/vocab-solid-common";
import {authUrl, CLARA_CONTAINER_NAME, deployLocation} from "../config";
import Api from "../util/api";
import {useNavigate} from "react-router";

/**
 * Identifies if a user has set up their account
 * (logged in, we have permission to edit, the clara container exists)
 *
 * Once these steps are done, show the interface to select a score to perform
 */
export default function Startup() {
    const [hasPermission, setHasPermission] = useState(false);
    const [checkingPermission, setCheckingPermission] = useState(true);
    const {session} = useSession();
    const navigate = useNavigate();

    const webId = session.info.webId ?? "";
    const profileParams = new URLSearchParams({
        profile: webId,
        redirect: deployLocation!
    });

    useEffect(() => {
        if (session.info.isLoggedIn) {
            let ignore = false;

            Api.checkUserPermissions(webId)
            .then(data => {
                if (!ignore) {
                    setHasPermission(data.has_permission);
                    setCheckingPermission(false);
                }
            });
            return () => {
                ignore = true;
            };
        }
    }, [session.info.isLoggedIn, webId]);

    // Check if a clara container exists in the user's pod
    useEffect(() => {
        async function fetchClaraContainer() {
            // TODO: We lookup the user's storage multiple times
            const dataset = await getSolidDataset(webId, { fetch: session.fetch });
            const profileDoc = getThing(dataset, webId);
            const storageUrl = getUrl(profileDoc, WS.storage);
            const claraStorageUrl = storageUrl + CLARA_CONTAINER_NAME;
            // TODO: Docs say this raises an error if it already exists, but doesn't seem to be a problem
            await createContainerAt(claraStorageUrl, {fetch: session.fetch});
            if (!ignore) {
                navigate(`/select`);
            }
        }
        let ignore = false;
        if (session.info.isLoggedIn && hasPermission) {
            fetchClaraContainer().catch(console.error);
            return () => {
                ignore = true;
            };
        }
    }, [hasPermission, webId, navigate, session.fetch, session.info.isLoggedIn]);

    if (!session.info.isLoggedIn) {
        return <p>You must be logged in</p>
    }

    if (checkingPermission) {
        return <p>Checking if you have let us store items in your Solid pod...</p>
    } else {
        return <p>You haven't given permission for us to act on your behalf <br/>
            Please visit the <a href={`${authUrl}?${profileParams}`}>Authentication
                page</a> to do this</p>
    }
}
