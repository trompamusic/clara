import React, { useState, useEffect  } from 'react';
import data from '@solid/query-ldflex';
import auth from 'solid-auth-client' ;
import * as jsonld from 'jsonld';

import { 
  AuthButton, 
  Value, 
  List, 
  LiveUpdate,
  LoggedIn, 
  LoggedOut, 
  useLDflexValue, 
  useLDflexList,
  useLDflex
} from '@solid/react';

import Companion from './companion';

export default function SolidWrapper(props) {
    data.context.extend({
      mo: "http://purl.org/ontology/mo/",
      trompa: "http://vocab.trompamusic.eu/vocab#"
    })
  /*
    const [val, pending, error] = useLDflex("user.trompa_hasPerformanceCollection");
    const [performanceCollection, setPerformanceCollection] = useState({});

    if(val !== undefined && val !== null) {
      auth.fetch(`${val}`, { headers: { Accept: "application/ld+json" } })
        .then((body) => body.json())
        .then(setPerformanceCollection)
    }*/
  /* 
    else if(pending) 
      setPerformanceCollection("Loading...");
    else if(error) 
      setPerformanceCollection("Error");
    else 
      setPerformanceCollection("No idea");*/
    const performanceCollection = useLDflexValue("user.trompa_hasPerformanceCollection");
    return(
      <div id="authWrapper">
        <AuthButton popup="auth-popup.html" login="Log in" logout="Log out" />
        <LoggedOut>
          <p>Please authenticate with your Solid POD</p>
        </LoggedOut>
        <LoggedIn>
          <p>You are logged in as <Value src="user.name"/>! Yay</p>
          { performanceCollection 
           ? <Companion uri = { `${performanceCollection}` }/>
           : <p>Trying to load <Value src="user.trompa_hasPerformanceCollection"/></p>
          }
        </LoggedIn>
      </div>
    )
}
