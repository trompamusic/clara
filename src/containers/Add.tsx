// Add a new score
import {useSearchParams} from "react-router-dom";
import React, {useEffect} from "react";
import {useSession} from "@inrupt/solid-ui-react";
import Api from "../util/api";
import {getScoreDocument, getScoresForUser} from "../util/clara";
import {useNavigate} from "react-router";

export default function Add() {
    let [searchParams] = useSearchParams();
    const {session} = useSession();
    const url = searchParams.get('url');
    const navigate = useNavigate();

    // If a resource parameter exists, request to the server to create a container in the pod
    useEffect(() => {
        if (session.info.isLoggedIn && url) {
            let ignore = false;

            getScoresForUser(session.info.webId!, session.fetch).then(scores => {
                scores.filter(score_url => {
                    return getScoreDocument(score_url, session.fetch).then(doc => {
                        // TODO: Get score document and check if it's the same as the one we're trying to add
                    })
                })


                Api.addScore(
                    url, session.info.webId!
                ).then(data => {
                    if (!ignore) {
                        navigate(`/addwait?task=${data.task_id}`);
                    }
                });
            })

            return () => {
                ignore = true;
            };
        }
    }, [url, session.fetch, session.info.isLoggedIn, session.info.webId, navigate]);


    if (!session.info.isLoggedIn) {
        return <p>You must be logged in</p>
    }

    if (!url) {
        return <p>Error: You need to specify the "url" param</p>
    }

    return <p>
        Loading {url}
    </p>
}
