import {useSearchParams} from "react-router-dom";
import React, {useEffect} from "react";
import Api from "../util/api";
import {useNavigate} from "react-router";

export default function AuthCallback() {

    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [error, setError] = React.useState(false);
    const code = searchParams.get("code");
    const state = searchParams.get("state");

    useEffect(() => {
        if (code && state) {
            let ignore = false;
            Api.doAuthCallback(code, state)
                .then(data => {
                    if (!ignore) {
                        if (data.status === true) {
                            navigate(`/`);
                        } else {
                            setError(true);
                        }
                    }
                });
            return () => {
                ignore = true;
            };
        }
    }, [code, navigate, state]);

    return (
        <div id="auth-callback">
            {!error && <p>Configuring authentication...</p>}
            {error && <p>Oops, an error occurred...</p>}
        </div>
    );
}
