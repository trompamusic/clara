import { Col, Form, Row } from "react-bootstrap";

import { Button } from "react-bootstrap";
import { BiLinkExternal, BiEdit } from "react-icons/bi";

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { getStringNoLocale } from "@inrupt/solid-client";
import { DCTERMS } from "@inrupt/lit-generated-vocab-common";
import { getScoreDocument, getScoresForUser } from "../util/clara";
import { useSolidAuth } from "@ldo/solid-react";

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

/**
 * A list of options where a user can choose which score to perform
 */
export default function ScoreSelector() {
  const [userUrl, setUserUrl] = useState("");
  const [userScores, setUserScores] = useState<ScoreOption[]>([]);
  const [loadingScores, setLoadingScores] = useState(true);
  const navigate = useNavigate();
  const { session, fetch } = useSolidAuth();

  const loadUrl = (url: string) => {
    navigate(`/add?url=${url}`);
  };

  const performScore = (url: string) => {
    navigate(`/perform?score=${url}`);
  };

  useEffect(() => {
    let ignore = false;
    const getMetadataForScore = async (
      url: string,
    ): Promise<ScoreOption | null> => {
      const doc = await getScoreDocument(url, fetch);
      if (doc) {
        const name = getStringNoLocale(doc!, DCTERMS.title) ?? "unknown";
        return { name, urls: [{ name: "", url }] };
      }
      return null;
    };

    async function fetchExistingScores() {
      getScoresForUser(session.webId!, fetch)
        .then((urls) => {
          Promise.all(
            urls.map((u) => {
              return getMetadataForScore(u);
            }),
          ).then((results) => {
            if (!ignore) {
              const filtered = results.filter(
                (r) => r !== null,
              ) as ScoreOption[];
              setUserScores(filtered);
              setLoadingScores(false);
            }
          });
        })
        .catch(() => {
          setLoadingScores(false);
        });
    }
    if (session.isLoggedIn) {
      fetchExistingScores().catch(console.error);
      return () => {
        ignore = true;
      };
    }
  }, [fetch, session.isLoggedIn, session.webId]);

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
                            loadUrl(url.url);
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
          onSubmit={(e) => {
            e.preventDefault();
            if (userUrl && userUrl !== "") {
              loadUrl(userUrl);
            }
          }}
        >
          <Row>
            <Col sm={11}>
              <Form.Control
                type="input"
                placeholder="Enter URL"
                value={userUrl}
                onChange={(e) => setUserUrl(e.target.value)}
              />
            </Col>
            <Col>
              <Button
                variant="primary"
                type="submit"
                onClick={() => {
                  if (userUrl && userUrl !== "") {
                    loadUrl(userUrl);
                  }
                }}
              >
                Load
              </Button>
            </Col>
          </Row>
        </Form>
        <p>or</p>
        <h3>Load a previous score that you have performed</h3>
        <ul>
          {loadingScores && <li>Loading...</li>}
          {userScores.map((score) => {
            return (
              <li key={score.urls[0].url}>
                <a
                  href={`/perform?score=${score.urls[0].url}`}
                  onClick={(e) => {
                    e.preventDefault();
                    performScore(score.urls[0].url);
                  }}
                >
                  {score.name}
                </a>
                &nbsp;&nbsp;
                <small>
                  <a
                    href={`/editscore?score=${score.urls[0].url}`}
                    className="icon-edit"
                    onClick={(e) => {
                      e.preventDefault();
                      navigate(`/editscore?score=${score.urls[0].url}`);
                    }}
                  >
                    edit
                    <BiEdit />
                  </a>
                </small>
              </li>
            );
          })}
          {!loadingScores && userScores.length === 0 && (
            <li>No scores yet... Load one above</li>
          )}
        </ul>
      </Col>
      <Col sm={2} />
    </Row>
  );
}
