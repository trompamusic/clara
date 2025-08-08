// Add a new score
import { useSearchParams } from "react-router-dom";
import React, { useEffect } from "react";
import { useAuthentication } from "../util/hooks";
import Api from "../util/api";
import { useScoreExists } from "../util/clara";
import { useNavigate } from "react-router";

export default function Add() {
  const [searchParams] = useSearchParams();
  const { isAuthenticated, isLoading, webId } = useAuthentication();
  const url = searchParams.get("url");
  const navigate = useNavigate();
  const { exists, isLoading: scoreLoading, error } = useScoreExists(url);

  if (isLoading) {
    return <p>Checking authentication...</p>;
  }

  if (!isAuthenticated) {
    return <p>You must be logged in</p>;
  }

  if (!exists && !scoreLoading && !error && url && isAuthenticated) {
    Api.addScore(url, webId!).then((data) => {
      navigate(`/addwait?task=${data.task_id}`);
    });
  } else {
    return (
      <p>
        Score already exists, not adding:
        <br />
        {url}
      </p>
    );
  }

  if (!url) {
    return <p>Error: You need to specify the "url" param</p>;
  }

  return <p>Loading {url}</p>;
}
