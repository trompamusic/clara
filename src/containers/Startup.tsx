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
    const [authUrl, setAuthUrl] = useState<string>();
    const {session} = useSession();
    const navigate = useNavigate();

    const webId = session.info.webId ?? "";

    useEffect(() => {
        if (session.info.isLoggedIn) {
            let ignore = false;

            Api.checkUserPermissions(webId)
            .then(data => {
                if (!ignore) {
                    if (data.has_permission === false) {
                        // No permission, do a lookup to get the auth URL
                        Api.getBackendAuthenticationUrl(webId, "/").then(data => {
                            setAuthUrl(data.auth_url);
                        })
                        // TODO: Catch error in this request and show error
                    }
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
    // TODO: https://react.dev/learn/you-might-not-need-an-effect
    //  possible that this should be a part of the previous effect?
    useEffect(() => {
        async function fetchClaraContainer() {
            // TODO: We lookup the user's storage multiple times
            const dataset = await getSolidDataset(webId, { fetch: session.fetch });
            const profileDoc = getThing(dataset, webId);
            const storageUrl = getUrl(profileDoc!, WS.storage);
            const claraStorageUrl = storageUrl + CLARA_CONTAINER_NAME;
            // TODO: Node solid server will allow us to create the same container multiple times but inrupt's server won't
            try {
                await createContainerAt(claraStorageUrl, {fetch: session.fetch});
            } catch (e) {
                // TODO: Identify this is a "412 precondition failed" error and ignore it, otherwise re-raise
                console.log("Clara container already exists");
            }
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
            Please visit the <a href={authUrl}>Authentication
                page</a> to do this</p>
    }
}
