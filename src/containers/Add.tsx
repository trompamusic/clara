// Add a new score
import { useSearchParams } from "react-router-dom";
import React, { useEffect } from "react";
import { useSolidAuth } from "@ldo/solid-react";
import Api from "../util/api";
import { useScoreExists } from "../util/clara";
import { useNavigate } from "react-router";

export default function Add() {
  const [searchParams] = useSearchParams();
  const { session } = useSolidAuth();
  const url = searchParams.get("url");
  const navigate = useNavigate();
  const { exists, isLoading, error } = useScoreExists(url);

  if (!exists && !isLoading && !error && url && session.isLoggedIn) {
    Api.addScore(url, session.webId!).then((data) => {
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

  if (!session.isLoggedIn) {
    return <p>You must be logged in</p>;
  }

  if (!url) {
    return <p>Error: You need to specify the "url" param</p>;
  }

  return <p>Loading {url}</p>;
}
