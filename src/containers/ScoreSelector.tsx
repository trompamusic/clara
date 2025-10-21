import { Col, Form, Row } from "react-bootstrap";

import { Button } from "react-bootstrap";
import { BiLinkExternal, BiEdit } from "react-icons/bi";

import React, { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router";
import {
  useClaraScore,
  useClaraScoresForUser,
  useScoresMapping,
} from "../util/clara";
import { useAuthentication } from "../util/hooks";
import Api from "../util/api";

import _scores from "../scores.json";
const scores = _scores as ScoreOption[];

interface ScoreUrl {
  name: string;
  url: string;
}

interface ScoreOption {
  name: string;
  description?: string;
  html_url?: string;
  urls: ScoreUrl[];
}

function SingleScore({ score }: { score: string }) {
  const { scoreData, isLoading } = useClaraScore(score);
  const navigate = useNavigate();
  const url = score;
  return !isLoading && scoreData ? (
    <>
      <a
        href={`/perform?score=${url}`}
        onClick={(e) => {
          e.preventDefault();
          navigate(`/perform?score=${url}`);
        }}
      >
        {scoreData?.title}
      </a>
      &nbsp;&nbsp;
      <small>
        <a
          href={`/editscore?score=${url}`}
          className="icon-edit"
          onClick={(e) => {
            e.preventDefault();
            navigate(`/editscore?score=${url}`);
          }}
        >
          edit
          <BiEdit />
        </a>
      </small>
    </>
  ) : (
    <span>Loading...</span>
  );
}

/**
 * A list of options where a user can choose which score to perform
 */
export default function ScoreSelector() {
  const [userUrl, setUserUrl] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { webId, isAuthenticated } = useAuthentication();

  const { scores: userScores, isLoading: loadingScores } =
    useClaraScoresForUser();

  const { items: mappedScores } = useScoresMapping();

  const handleAdd = useCallback(
    async (url: string) => {
      if (!isAuthenticated || !webId) {
        setMessage("You must be logged in");
        return;
      }
      setMessage(null);
      setIsSubmitting(true);
      try {
        if (mappedScores.includes(url)) {
          setMessage("Score already exists; not adding.");
          setIsSubmitting(false);
          return;
        }
        const data = await Api.addScore(url, webId);
        navigate(`/addwait?task=${data.task_id}`);
      } catch (e) {
        setMessage("Error adding score. Please try again.");
        setIsSubmitting(false);
      }
    },
    [isAuthenticated, webId, navigate, mappedScores],
  );

  return (
    <Row>
      <Col sm={2} />
      <Col>
        <p>&nbsp;</p>
        <h2>Load a score</h2>
        <h3>Use a score from the Trompa Encodings repository</h3>
        <div className="list-group">
          {scores.map((score) => {
            return (
              <div className="list-group-item" key={score.html_url}>
                <h5>{score.name}</h5>
                <p>{score.description}</p>
                <ul>
                  {score.urls.map((url) => {
                    return (
                      <li key={url.url}>
                        <a
                          href={`/add?url=${url.url}`}
                          onClick={(e) => {
                            e.preventDefault();
                            setUserUrl(url.url);
                            if (inputRef.current) {
                              inputRef.current.scrollIntoView({
                                behavior: "smooth",
                                block: "center",
                              });
                              setTimeout(() => inputRef.current?.focus(), 300);
                            }
                            handleAdd(url.url);
                          }}
                        >
                          {url.name || score.name}
                        </a>
                        &nbsp;&nbsp;
                        <small>
                          <a
                            href={`https://mei-friend.mdw.ac.at/?file=${url.url}`}
                            className="icon-link"
                            target="_blank"
                            rel="noreferrer"
                          >
                            mei-friend
                            <BiLinkExternal />
                          </a>
                        </small>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
        <p>or</p>
        <h3>Load an MEI URL</h3>
        <Form
          ref={formRef}
          onSubmit={(e) => {
            e.preventDefault();
            if (userUrl && userUrl !== "") {
              handleAdd(userUrl);
            }
          }}
        >
          <Row>
            <Col>
              <Form.Control
                type="input"
                placeholder="Enter URL"
                value={userUrl}
                onChange={(e) => setUserUrl(e.target.value)}
                ref={inputRef}
              />
            </Col>
            <Col xs="auto">
              <Button variant="primary" type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Adding..." : "Add"}
              </Button>
            </Col>
          </Row>
        </Form>
        {message && <p>{message}</p>}
        <p>or</p>
        <h3>Load a previous score that you have performed</h3>
        <ul>
          {loadingScores && <li>Loading...</li>}
          {userScores?.map((score: any) => {
            return (
              <li key={score["@id"]}>
                <SingleScore score={score["@id"]} />
              </li>
            );
          })}
          {!loadingScores && userScores?.size === 0 && (
            <li>No scores yet... Load one above</li>
          )}
        </ul>
      </Col>
      <Col sm={2} />
    </Row>
  );
}
