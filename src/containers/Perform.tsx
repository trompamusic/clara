import React, {useEffect, useState} from "react";
import {useSearchParams} from "react-router-dom";
import { useSolidAuth } from "@ldo/solid-react";
import Companion from "./companion";
import {getStorageForUser} from "../util/clara";
import WebMidiRecorder from "./WebMidiRecorder";
import {useNavigate} from "react-router";


function LinkToUpload({uri}: {uri: string}) {
    const navigate = useNavigate();
    return <a href={`/upload?score=${uri}`} onClick={(e) => {
        e.preventDefault();
        navigate(`/upload?score=${uri}`);
    }}>Upload a performance</a>
}

/**
 * The main wrapper to perform a score
 *
 *  - Load the Clara interface, using the score that we downloaded to the user's pod
 */
export default function Perform() {
    let [searchParams] = useSearchParams();
    let [storage, setStorage] = useState('');
    const { session, fetch } = useSolidAuth();
    const score = searchParams.get('score');

    useEffect(() => {
        let ignore = false;

        async function getStorage() {
            const storage = await getStorageForUser(session.webId!, fetch)
            if (!ignore) {
                setStorage(storage ? storage : '');
            }
        }

        if (session.isLoggedIn) {
            getStorage().catch(console.error);
            return () => {
                ignore = true;
            };
        }
    }, [fetch, session.isLoggedIn, session.webId]);

    if (!session.isLoggedIn) {
        return <p>Checking if you're logged in...</p>
    }

    if (!score) {
        return <p>Error: "score" parameter must be specified</p>
    }

    if (storage !== "" && score) {
        return <div>
            <LinkToUpload uri={score} />
            <WebMidiRecorder score={score} />
            <Companion uri={score} userPOD={storage} userProfile={session.webId!} fetch={fetch} />
        </div>

    } else {
        return <p>Finding your storage location...</p>
    }
}
