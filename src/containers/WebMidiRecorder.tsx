import React, {useState, useEffect} from 'react';
import MIDIMessage from 'midimessage';
import {useSession} from "@inrupt/solid-ui-react";
import Api from "../util/api";


const MIDI_TIMEOUT = 5000; // milliseconds until we decide rehearsal rendition has stopped
let didInit = false;

export default function WebMidiRecorder({score}: {score: string}) {
    const {session} = useSession();
    const webId = session.info.webId ?? "";
    const [midiIn, setMidiIn] = useState([]);
    const [midiSupported, setMidiSupported] = useState(false);
    const [midiEvents, setMidiEvents] = useState([])

    useEffect(() => {
        if (!didInit) {
            didInit = true;
            if ("requestMIDIAccess" in navigator) {
                // @ts-ignore
                navigator.requestMIDIAccess({sysex: false})
                    .then(
                        (midi: any) => {
                            setMidiSupported(true);
                            let i = []
                            const inputs = midi.inputs.values();
                            for (let input = inputs.next(); input && !input.done; input = inputs.next()) {
                                console.log("MIDI input: ", input.value);
                                input.value.addEventListener('midimessage', (mes: any) => handleMidiMessage(mes));
                                i.push(input.value);
                            }
                            // @ts-ignore
                            setMidiIn(i);
                        },
                        (err: any) => console.log('Something went wrong', err));
            } else {
                console.warn("Browser does not support WebMIDI");
            }
        }
    }, []);

    function handleMidiMessage(mes: any) {
        console.log("RAW MIDI MESSAGE: ", mes.data);
        if (mes.data.length === 1 && mes.data[0] === 254) {
            // ignore keep-alive (active sense) message
            return
        }
        // @ts-ignore
        setMidiEvents([...midiEvents, mes]);
    }

    // Track MIDI events and start / end rehearsal rendition recordings based on them
    useEffect(() => {

        let timer: string | number | NodeJS.Timeout | undefined;
        if (timer) {
            clearTimeout(timer)
        }
        timer = setTimeout(() => {
            if (midiEvents.length) {
                let midiEventsJson = midiEvents
                    .map((m: any) => {
                        return {data: MIDIMessage(m), timestamp: m.timeStamp}
                    })
                    .sort((a, b) => a.timestamp - b.timestamp);
                let firstTimestamp = midiEventsJson[0].timestamp;
                console.log("midiEventsJson: ", midiEventsJson);
                midiEventsJson.forEach((e) => {
                    console.log(e.timestamp - firstTimestamp, e.data, e.data["_messageCode"], e.data["_data"], e.data["messageType"])
                })
                console.log("I declare a rehearsal to be complete: ", midiEventsJson);

                Api.alignWebMidi(webId, score, JSON.stringify(midiEventsJson))
                    .then(data => console.log("GOT RESPONSE: ", data))
            }
            setMidiEvents([]);
        }, MIDI_TIMEOUT)
        return () => clearTimeout(timer)
    }, [midiEvents, score, webId]);



    return (
        <div id="authWrapper">
            {midiSupported
                ? <div id="midi">
                <span id="recordingIndicator">
                  {midiEvents.length
                      ? <span className="isRecording">Recording</span>
                      : <span className="isNotRecording">Play MIDI notes to start recording</span>
                  }
                </span>
                </div>
                : <div/>
            }
        </div>
    )
}
