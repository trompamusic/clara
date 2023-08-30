import {NoteSequence, constants, INoteSequence, sequences} from "@magenta/music";
import { Midi } from '@tonejs/midi';
import { TimeSignatureEvent ,TempoEvent } from '@tonejs/midi/dist/Header';
/**
 * Take an array of MIDIMessageEvent objects and convert them to a
 * magenta NoteSequence.
 */
export function jsonMidiToSequenceProto(midiMessages: any): NoteSequence {
    const ns = NoteSequence.create();

    ns.ticksPerQuarter = 500;
    ns.sourceInfo = NoteSequence.SourceInfo.create({
        parser: NoteSequence.SourceInfo.Parser.UNKNOWN_PARSER,
        encodingType: NoteSequence.SourceInfo.EncodingType.MIDI
    });

    // Assume a default time signature of 4/4.
    ns.timeSignatures.push(NoteSequence.TimeSignature.create({
        time: 0,
        numerator: 4,
        denominator: 4,
    }));

    let firstNoteOffset = null;
    let noteOnTimes = {}
    for (const note of midiMessages) {
        const messageType = note.data.messageType;
        const eventTimestamp = note.timestamp / 1000;
        const pitch = note.data.key;
        const velocity = undefined;
        if (firstNoteOffset === null) {
            firstNoteOffset = eventTimestamp;
        }
        const shiftedTimestamp = eventTimestamp - firstNoteOffset;
        if (messageType === "noteon") {
            // @ts-ignore
            noteOnTimes[pitch] = shiftedTimestamp;
        } else if (messageType === "noteoff") {
            // @ts-ignore
            const startTime = noteOnTimes[pitch];
            const endTime = shiftedTimestamp;
            // @ts-ignore
            delete noteOnTimes[pitch];
            ns.notes.push(NoteSequence.Note.create({
                instrument: 1,
                program: 0,
                startTime: Math.round(startTime * 100) / 100,
                endTime: Math.round(endTime * 100) / 100,
                pitch,
                velocity: 127,
                isDrum: false
            }));
            if (endTime > ns.totalTime) {
                ns.totalTime = endTime;
            }
        }
    }

    return ns;
}

export function localSequenceProtoToMidi(ns: INoteSequence) {
    if (sequences.isQuantizedSequence(ns)) {
        ns = sequences.unquantizeSequence(ns);
    }

    const midi = new Midi();
    midi.fromJSON({
        header: {
            name: '',
            ppq: ns.ticksPerQuarter || constants.DEFAULT_TICKS_PER_QUARTER,
            tempos: [],
            timeSignatures: [],
            keySignatures: [],
            meta: []
        },
        tracks: []
    });

    // Add tempo changes. We need to add them in chronological order, so that we
    // can calculate their times correctly.
    const tempos = Array.from(ns.tempos || []) as NoteSequence.ITempo[];
    if (tempos.length === 0) {
        tempos.push({time: 0, qpm: constants.DEFAULT_QUARTERS_PER_MINUTE});
    }
    // @ts-ignore
    tempos.sort((a, b) => a.time - b.time);
    for (const tempo of tempos) {
        if (tempo.time != null) {
            midi.header.tempos.push(<TempoEvent>{
                ticks: midi.header.secondsToTicks(tempo.time),
                bpm: tempo.qpm
            });
        }
        midi.header.update();  // Update the tempo times for secondsToTicks to work.
    }

    // Add time signatures.
    if (!ns.timeSignatures || ns.timeSignatures.length === 0) {
        midi.header.timeSignatures.push({ticks: 0, timeSignature: [4, 4]});
    } else {
        for (const ts of ns.timeSignatures) {
            if (ts.time != null) {
                midi.header.timeSignatures.push(<TimeSignatureEvent>{
                    ticks: midi.header.secondsToTicks(ts.time),
                    timeSignature: [ts.numerator, ts.denominator]
                });
            }
        }
    }
    midi.header.update();

    // TODO: Add key signatures.

    // Add tracks and control changes.
    const tracks = new Map<string, {
        notes: NoteSequence.INote[],
        controlChanges: NoteSequence.IControlChange[]
    }>();
    // @ts-ignore
    for (const note of ns.notes) {
        console.log("add note", note)
        const instrument = note.instrument ? note.instrument : 0;
        const program = (note.program === undefined) ? constants.DEFAULT_PROGRAM :
            note.program;
        const isDrum = !!note.isDrum;
        const key = JSON.stringify([instrument, program, isDrum]);
        if (!tracks.has(key)) {
            tracks.set(key, { notes: [], controlChanges: [] });
        }
        // @ts-ignore
        tracks.get(key).notes.push(note);
        console.log(tracks)
    }
    // @ts-ignore
    for (const controlChange of ns.controlChanges) {
        const instrument = controlChange.instrument ? controlChange.instrument : 0;
        const program = (controlChange.program === undefined)
            ? constants.DEFAULT_PROGRAM : controlChange.program;
        const isDrum = !!controlChange.isDrum;
        const key = JSON.stringify([instrument, program, isDrum]);
        if (!tracks.has(key)) {
            tracks.set(key, { notes: [], controlChanges: [] });
        }
        // @ts-ignore
        tracks.get(key).controlChanges.push(controlChange);
    }

    tracks.forEach((trackData, key) => {
        console.log("track foreach", trackData, key)
        const [program, isDrum] = JSON.parse(key).slice(1);
        const track = midi.addTrack();
        // Cycle through non-drum channels. This is what pretty_midi does and it
        // seems to matter for many MIDI sequencers.
        if (isDrum) {
            track.channel = constants.DRUM_CHANNEL;
        } else {
            track.channel = constants.NON_DRUM_CHANNELS[
            (midi.tracks.length - 1) % constants.NON_DRUM_CHANNELS.length];
        }
        track.instrument.number = program;
        for (const note of trackData.notes) {
            const velocity = (note.velocity === undefined) ?
                constants.DEFAULT_VELOCITY :
                note.velocity;
            track.addNote({
                midi: note.pitch!,
                time: note.startTime!,
                duration: note.endTime! - note.startTime!,
                velocity: (velocity as number + 1) / constants.MIDI_VELOCITIES
            });
        }
        for (const controlChange of trackData.controlChanges) {
            track.addCC({
                number: controlChange.controlNumber!,
                value: controlChange.controlValue!,
                time: controlChange.time!
            });
        }
    });

    // TODO: Support pitch bends.

    return midi.toArray();
}
