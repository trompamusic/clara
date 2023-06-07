import React, {useEffect, useState} from "react";
import {useSearchParams} from "react-router-dom";
import {useSession} from "@inrupt/solid-ui-react";
import Companion from "./companion";
import {getPerformanceFromScore, getStorageForUser} from "../util/clara";

/**
 * The main wrapper to perform a score
 *
 *  - Load the Clara interface, using the score that we downloaded to the user's pod
 */
export default function Perform() {
    let [searchParams, setSearchParams] = useSearchParams();
    let [storage, setStorage] = useState('');
    const {session} = useSession();
    const score = searchParams.get('score');

    useEffect(() => {
        let ignore = false;

        async function getStorage() {
            const storage = await getStorageForUser(session.info.webId!, session.fetch)
            if (!ignore) {
                setStorage(storage ? storage : '');
            }
        }
        if (session.info.isLoggedIn) {
            getStorage().catch(console.error);
            return () => {
                ignore = true;
            };
        }
    }, [session]);

    if (!session.info.isLoggedIn) {
        return <p>You must be logged in</p>
    }

    if (!score) {
        return <p>Error: "score" parameter must be specified</p>
    }

    if (storage !== "" && score) {
        return <Companion uri={score} userPOD={storage} userProfile={session.info.webId!}/>
    } else {
        return <p>loading user storage</p>
    }

    // return <CombinedDataProvider datasetUrl={session.info.webId!} thingUrl={session.info.webId}>
    //     {typeof userPOD !== "undefined" && typeof performanceCollection !== "undefined" && annotationCollection !== "undefined" && userProfile !== "undefined"
    //         ? <Companion userPOD = { userPOD } uri = { performanceCollection } annotationContainerUri = { annotationCollection } userProfile = { userProfile } session = { session } />
    //         : <div>Loading... </div>
    //     }
    // </CombinedDataProvider>
}
