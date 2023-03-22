import React, { useState, useEffect } from 'react';
import MIDIMessage from 'midimessage';
import {
    useSession,
    CombinedDataProvider,
} from "@inrupt/solid-ui-react";
import { getSolidDataset, getThing, getUrl } from "@inrupt/solid-client";
import { fetch, handleIncomingRedirect } from "@inrupt/solid-client-authn-browser";
import {WS} from "@inrupt/vocab-solid-common";
import Companion from './companion';

const TROMPA = "http://vocab.trompamusic.eu/vocab#";

const MIDI_TIMEOUT = 5000; // milliseconds until we decide rehearsal rendition has stopped
const MIDI_BATCH_ENDPOINT = "http://127.0.0.1:5000/midiBatch"

export default function Wrapper(props) {
    const {session} = useSession();
    const [userPOD, setUserPOD] = useState(undefined);
    const [performanceCollection, setPerformanceCollection] = useState(undefined);
    const [annotationCollection, setAnnotationCollection] = useState(undefined);
    const [userProfile, setUserProfile] = useState(undefined);
    const [midiSupported, setMidiSupported] = useState(false);
    const [midiIn, setMidiIn] = useState([]);
    const [midiEvents, setMidiEvents] = useState([])

    // Initialise Web-MIDI and Solid redirect
    useEffect(() => {
      if("requestMIDIAccess" in navigator) {
        navigator.requestMIDIAccess({sysex: false})
        .then(
          (midi) => {
              setMidiSupported(true);
              let i = []
              const inputs = midi.inputs.values();
              for (let input = inputs.next(); input && !input.done; input = inputs.next()) {
                input.value.addEventListener('midimessage', (mes) => handleMidiMessage(mes));
                i.push(input.value);
              }
              setMidiIn(i);
          },
          (err) => console.log('Something went wrong', err));
      } else {
        console.warn("Browser does not support WebMIDI");
      }
      handleIncomingRedirect({
        restorePreviousSession: true
      }).then((info) => {
        if(info) {
          console.log(`Logged in with WebID [${info.webId}]`)
        } else {
          console.log("Could not restore previous session");
        }
      })
    }, [])

  // Track MIDI events and start / end rehearsal rendition recordings based on them
  useEffect(() => {
    let timer;
    if(timer) {
      clearTimeout(timer)
    }
    timer = setTimeout(() => {
      if(midiEvents.length) {
        let midiEventsJson = midiEvents
          .map(m => { return {data: MIDIMessage(m), timestamp: m.timeStamp} })
          //.map(m => { m["data"]["channel"] = 0; return m; })
          .sort((a,b) => a.timestamp - b.timestamp);
        let firstTimestamp = midiEventsJson[0].timestamp;
        console.log("midiEventsJson: ", midiEventsJson);
        midiEventsJson.forEach((e) => {
          console.log(e.timestamp - firstTimestamp, e.data, e.data["_messageCode"], e.data["_data"], e.data["messageType"])
        })
        console.log("I declare a rehearsal to be complete: ", midiEventsJson);

        // write the midi events JSON to the clipboard:
/*        navigator.clipboard.writeText(JSON.stringify(midiEventsJson))
          .catch((error) => { alert(`Couldn't copy MIDI notes to clipboard! ${error}`) })
*/

        fetch(MIDI_BATCH_ENDPOINT, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(midiEventsJson)
        }).then(response => response.json())
        .then(data => console.log("GOT RESPONSE: ", data))
      }
      //TODO do something with midiEvents
      setMidiEvents([]);
    }, MIDI_TIMEOUT)
    return () => clearTimeout(timer)
  }, [midiEvents]);


    function handleMidiMessage(mes) {
      if(mes.data.length === 1 && mes.data[0] === 254) {
        // ignore keep-alive (active sense) message
        return
      }
      console.log("RAW MIDI MESSAGE: ", mes.data);
      setMidiEvents(midiEvents => [...midiEvents, mes]);
    }

    async function readProfile() {
        const dataset = await getSolidDataset(session.info.webId.split("#")[0], { fetch: fetch });
        console.log("Obtained dataset: ", dataset)
        const profileDoc = getThing(dataset, session.info.webId)
        setUserPOD(getUrl(profileDoc, WS.storage));
        setPerformanceCollection(getUrl(profileDoc, TROMPA + "hasPerformanceCollection"));
        setAnnotationCollection(getUrl(profileDoc, TROMPA + "hasAnnotationCollection"));
        setUserProfile(session.info.webId);
    }

    useEffect(() => {
        if(session.info.isLoggedIn) {
            readProfile();
        }
    }, [session.info.isLoggedIn])

    return(
        <div id="authWrapper">
          { midiSupported
            ? <div id="midi">
                <span id="recordingIndicator">
                  { midiEvents.length
                  ? <span className="isRecording">Recording</span>
                  : <span className="isNotRecording">Play MIDI notes to start recording</span>
                  }
                </span>
              {/*
                <div id="midiEvents">
                    {midiEvents.map( (ev, ix) => <div key={ev.ix}>{ev.data.join()}</div>)}
                </div>
              */}
              </div>
            : <div/>
          }
            {!(session.info.isLoggedIn)
                ? <div>Please log in </div>
                :   <CombinedDataProvider datasetUrl={session.info.webId} thingUrl={session.info.webId}>
                        {typeof userPOD !== "undefined" && typeof performanceCollection !== "undefined" && annotationCollection !== "undefined" && userProfile !== "undefined"
                            ? <Companion userPOD = { userPOD } uri = { performanceCollection } annotationContainerUri = { annotationCollection } userProfile = { userProfile } session = { session } />
                            : <div>Loading... </div>
                        }
                </CombinedDataProvider>
            }
        </div>
    )
}
