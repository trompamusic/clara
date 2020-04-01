import React, { Component } from 'react';
import data from '@solid/query-ldflex';
import auth from 'solid-auth-client' ;

import { 
  AuthButton, 
  Value, 
  List, 
  LoggedIn, 
  LoggedOut, 
  useLDflexValue, 
  useLDflexList,
  useLDflex
} from '@solid/react';

import Companion from './companion';

export default function AuthWrapper(props) {
    data.context.extend({
      mo: "http://purl.org/ontology/mo/",
      trompa: "http://vocab.trompamusic.eu/vocab#"
    })
    
    const [val, pending, error] = useLDflex("user.trompa_hasPerformanceCollection");
    let response;
    if(val !== undefined && val !== null) {
      response = <Companion uri={ `${val}` } />
      auth.fetch(`${val}`, { headers: { Accept: "application/ld+json" } })
        .then((body) => body.json())
        .then(console.log)

    }
    else if(pending) 
      response = <p>Loading...</p>
    else if(error) 
      response = <p>Error</p>
    else 
      response = <p> No idea</p>;
    return(
      <div id="authWrapper">
        <AuthButton popup="auth-popup.html" login="Log in" logout="Log out" />
        <LoggedOut>
          <p>Please authenticate with your Solid POD</p>
        </LoggedOut>
        <LoggedIn>
          <p>You are logged in as <Value src="user.name"/>! Yay</p>
          <p>Trying to load <Value src="user.trompa_hasPerformanceCollection"/></p>
          { response }
        </LoggedIn>
      </div>
    )
}
