import React, {useState, useEffect} from 'react';
import {useSession} from "@inrupt/solid-ui-react";
import Api from "../util/api";
import {useNavigate} from "react-router";
import {trackToMidi} from "../util/midi";
import { useLocalStorage } from 'usehooks-ts'
import {MidiNoteOnEvent, MidiNoteOffEvent} from "midi-file";

// This isn't expored from tonejs Track, so redefine it
type WithAbsoluteTime = { absoluteTime: number; };

const MIDI_TIMEOUT = 5000; // milliseconds until we decide rehearsal rendition has stopped
let didInit = false;

function localStorageMidiToBlob(midiString: string) {
    const parts = midiString.split(",");
    const buf = new ArrayBuffer(parts.length);
    const bufView = new Uint8Array(buf);
    for (var i=0; i < parts.length; i++) {
      bufView[i] = parseInt(parts[i]);
    }
    return new Blob([bufView], {type: 'audio/midi'});
}

/**
 * Take an array of Uint8Arrays (i.e. midi [event, note, velocity] tuples) and convert them to a midi file
 * @param midiEvents
 */
function midiEventsArrayToMidiFile(midiEvents: any[]) {
    let firstTimestamp = midiEvents[0].timeStamp;
    console.log("midiEventsJson: ", midiEvents);
    const trackNotes = midiEvents.map((e) => {
        const timeStamp = e.timeStamp - firstTimestamp;
        const d = e.data;
        if (d[0] === 144) {
            return {
                type: "noteOn",
                noteNumber: d[1],
                velocity: d[2],
                absoluteTime: timeStamp
            } as (MidiNoteOnEvent & WithAbsoluteTime);
        } else if (d[0] === 128) {
            return {
                type: "noteOff",
                noteNumber: d[1],
                velocity: d[2],
                absoluteTime: timeStamp
            } as (MidiNoteOffEvent & WithAbsoluteTime);
        } else {
            console.log(`Unexpected event type in midi stream: ${d}`);
            return undefined;
        }
    }).filter((e) => e !== undefined);
    return trackToMidi(trackNotes);
}

export default function WebMidiRecorder({score}: {score: string}) {
    const {session} = useSession();
    const webId = session.info.webId ?? "";
    const [midiIn, setMidiIn] = useState([]);
    const [uploadError, setUploadError] = useState(false);
    const [midiSupported, setMidiSupported] = useState(false);
    const [midiEvents, setMidiEvents] = useState<any[]>([])
    const navigate = useNavigate();
    const localStorageKey = `at.ac.mdw.trompa-midiPerformance-${webId}-${score}`;
    const [midiPerformance, setMidiPerformance] = useLocalStorage<string|null>(localStorageKey, null);

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
        if (mes.data.length === 1 && mes.data[0] === 254) {
            // ignore keep-alive (active sense) message
            return
        }
        console.log("RAW MIDI MESSAGE: ", mes.data);
        // @ts-ignore
        setMidiEvents(midiEvents => [...midiEvents, {data: mes.data, timeStamp: mes.timeStamp}]);
        //setUploadError(false);
    }

    // Track MIDI events and start / end rehearsal rendition recordings based on them
    useEffect(() => {

        let timer: string | number | NodeJS.Timeout | undefined;
        if (timer) {
            clearTimeout(timer)
        }
        timer = setTimeout(() => {
            // On timeout, take all events and create a list of MidiNoteOnEvent and MidiNoteOffEvent
            if (midiEvents.length) {
                console.log("I declare a rehearsal to be complete... (working)");
                const midi = midiEventsArrayToMidiFile(midiEvents);
                console.log("... midi converted, uploading")
                setMidiPerformance(midi.toString());
                const payload = new Blob([midi]);
                Api.alignMidi(webId, score, payload)
                    .then((data) => {
                        setMidiPerformance(null);
                        navigate(`/uploadwait?task=${data.task_id}&score=${score}`);
                    })
                    .catch((err) => {
                        console.error(err);
                        setUploadError(true);
                    });
            }
            setMidiEvents([]);
        }, MIDI_TIMEOUT)
        return () => clearTimeout(timer)
    }, [midiEvents, navigate, score, setMidiPerformance, webId]);

    const uploadExistingPerformance = () => {
        if (midiPerformance) {
            console.log(midiPerformance);
            const midiArray = midiPerformance.split(",").map((s) => parseInt(s));
            const midi = new Uint8Array(midiArray);
            const payload = new Blob([midi]);
            console.log("Uploading existing performance: ", midiPerformance);
            Api.alignMidi(webId, score, payload)
                .then((data) => {
                    setMidiPerformance(null);
                    navigate(`/uploadwait?task=${data.task_id}&score=${score}`);
                })
                .catch((err) => {
                    console.error(err);
                    setUploadError(true);
                });
        }
    }

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
                    {uploadError && <p>There was an error uploading your performance. Please try again.</p>}
                    {midiPerformance &&
                    <span>You have a saved performance which wasn't uploaded.
                    <button onClick={uploadExistingPerformance}>Upload it</button>
                    <button onClick={() => {setMidiPerformance(null)}}>Delete it</button></span>
                    }
                </div>
                : <div/>
            }
        </div>
    )
}
