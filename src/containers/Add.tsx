// Add a new score
import {useSearchParams} from "react-router-dom";
import React, {useEffect, useState} from "react";
import {useSession} from "@inrupt/solid-ui-react";
import {useInterval} from "../util/hooks";
import Api from "../util/api";
import {getScoreDocument, getScoresForUser} from "../util/clara";

/**
 * The main wrapper to perform a score
 *
 *  - Takes a score URL as a parameter
 *  - Look at the user's pod to see if they already have this URL in their pod
 *  - If so, redirect to that container
 *  - If not, sends a request to the server to set up the score in the user's pod
 *      (download score, get metadata, run initial script)
 *  - Check the status of this request, once it's done redirect to that container
 * @constructor
 */
export default function Add() {
    const [taskId, setTaskId] = useState();
    let [searchParams, setSearchParams] = useSearchParams();
    const {session} = useSession();
    const url = searchParams.get('url');

    // If a resource parameter exists, request to the server to create a container in the pod
    useEffect(() => {
        if (session.info.isLoggedIn && url) {
            let ignore = false;

            getScoresForUser(session.info.webId!, session.fetch).then(scores => {
                scores.filter(score_url => {
                    getScoreDocument(score_url, session.fetch).then(doc => {

                    })
                })


                Api.addScore(
                    url, session.info.webId!
                ).then(data => {
                    if (!ignore) {
                        setTaskId(data.task_id)
                    }
                });
            })

            return () => {
                ignore = true;
            };
        }
    }, [url, session]);


    if (!session.info.isLoggedIn) {
        return <p>You must be logged in</p>
    }

    if (!url) {
        return <p>Error: You need to specify the "url" param</p>
    }

    if (taskId) {
        return <p>Processing file</p>
    } else {
        return <p>
            Loading {url}
        </p>
    }
}