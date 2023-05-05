import {useSearchParams} from "react-router-dom";
import React, {useEffect, useState} from "react";
import {useSession} from "@inrupt/solid-ui-react";
import {useInterval} from "../util/hooks";
import Api from "../util/api";

/**
 * The main wrapper to perform a score
 *
 *  - Load the Clara interface, using the score that we downloaded to the user's pod
 */
export default function Perform() {
    let [searchParams, setSearchParams] = useSearchParams();
    const {session} = useSession();
    const container = searchParams.get('container');

    if (!session.info.isLoggedIn) {
        return <p>You must be logged in</p>
    }

    if (!container) {
        return <p>Error: "container" parameter must be specified</p>
    }

    return <p>
        Performing a performance on {container}
    </p>
}
